# Default security group for ECS tasks
resource "aws_security_group" "ecs_tasks" {
  count       = length(var.security_group_ids) == 0 ? 1 : 0
  name_prefix = "${var.project_name}-${var.environment}-ecs-tasks"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    protocol        = "tcp"
    from_port       = 3000
    to_port         = 3000
    security_groups = [aws_security_group.alb_sg.id] # Fixed reference
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-ecs-tasks"
    Project     = var.project_name
    Environment = var.environment
  }
}
