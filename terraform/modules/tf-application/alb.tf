# Application Load Balancer configuration

# Security Group for ALB
resource "aws_security_group" "alb_sg" {
  name        = "${var.project_name}-${var.environment}-alb-sg"
  description = "Security group for Image Recognition ALB"
  vpc_id      = var.vpc_id

  # Allow HTTP traffic from internet
  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow HTTPS traffic from internet (if certificate is provided)
  dynamic "ingress" {
    for_each = var.certificate_arn != "" ? [1] : []
    content {
      description = "HTTPS from internet"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  # Allow all outbound traffic
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name          = "${var.project_name}-${var.environment}-alb-sg"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# Security Group for ECS Tasks
resource "aws_security_group" "ecs_tasks_sg" {
  name        = "${var.project_name}-${var.environment}-ecs-tasks-sg"
  description = "Security group for Image Recognition ECS tasks"
  vpc_id      = var.vpc_id

  # Allow traffic from ALB security group only
  ingress {
    description     = "Traffic from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  # Allow all outbound traffic for AWS service calls
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name          = "${var.project_name}-${var.environment}-ecs-tasks-sg"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "prod" ? true : false

  # Access logs (optional - can be enabled for production)
  # access_logs {
  #   bucket  = aws_s3_bucket.lb_logs.bucket
  #   prefix  = "test-lb"
  #   enabled = true
  # }

  tags = {
    Name          = "${var.project_name}-${var.environment}-alb"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# Target Group for ECS Tasks
resource "aws_lb_target_group" "ecs_targets" {
  name        = "${var.project_name}-${var.environment}-targets"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  # Health check configuration matching the working solution
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/v1/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  # Deregistration delay
  deregistration_delay = 30

  tags = {
    Name          = "${var.project_name}-${var.environment}-targets"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# HTTP Listener (always created)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  # Default action - forward to target group or redirect to HTTPS
  dynamic "default_action" {
    for_each = var.certificate_arn != "" ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  dynamic "default_action" {
    for_each = var.certificate_arn == "" ? [1] : []
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.ecs_targets.arn
    }
  }

  tags = {
    Name          = "${var.project_name}-${var.environment}-http-listener"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# HTTPS Listener (only if certificate is provided)
resource "aws_lb_listener" "https" {
  count             = var.certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs_targets.arn
  }

  tags = {
    Name          = "${var.project_name}-${var.environment}-https-listener"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}
