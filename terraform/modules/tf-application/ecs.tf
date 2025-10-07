# ECS Infrastructure Configuration

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}-cluster"

  tags = {
    Name          = "${var.project_name}-${var.environment}-cluster"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }
}

# CloudWatch Log Group for ECS
resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = "/ecs/${var.project_name}-${var.environment}"
  retention_in_days = 7

  tags = {
    Name          = "/ecs/${var.project_name}-${var.environment}"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "main" {
  family                   = "${var.project_name}-${var.environment}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "${var.project_name}-api"
      image     = "${var.ecr_repository_url}:${var.container_image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "API_VERSION"
          value = "v1"
        },
        {
          name  = "API_PREFIX"
          value = "api"
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "AWS_S3_BUCKET_NAME"
          value = split("/", var.s3_bucket_arn)[1]  # Extract bucket name from ARN
        },
        {
          name  = "AWS_DYNAMODB_TABLE_NAME"
          value = var.dynamodb_table_name
        },
        {
          name  = "MAX_FILE_SIZE"
          value = "5242880"
        },
        {
          name  = "ALLOWED_MIME_TYPES"
          value = "image/jpeg,image/png,image/gif,image/webp"
        },
        {
          name  = "THROTTLE_TTL"
          value = "60"
        },
        {
          name  = "THROTTLE_LIMIT"
          value = "100"
        },
        {
          name  = "UPLOAD_THROTTLE_LIMIT"
          value = "10"
        },
        {
          name  = "LOG_LEVEL"
          value = "info"
        },
        {
          name  = "HEALTH_CHECK_TIMEOUT"
          value = "10000"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_logs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name          = "${var.project_name}-${var.environment}-task"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# ECS Service
resource "aws_ecs_service" "main" {
  name            = "${var.project_name}-${var.environment}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.desired_count

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks_sg.id]
    assign_public_ip = true  # Required for Fargate tasks to pull images from ECR
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecs_targets.arn
    container_name   = "${var.project_name}-api"
    container_port   = 3000
  }

  health_check_grace_period_seconds = 300

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_task_execution_policy,
    aws_iam_role_policy_attachment.ecs_task_policy_attachment
  ]

  tags = {
    Name          = "${var.project_name}-${var.environment}-service"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# Application Auto Scaling Target
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.main.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  tags = {
    Name          = "${var.project_name}-${var.environment}-scaling-target"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# CPU-based Auto Scaling Policy
resource "aws_appautoscaling_policy" "ecs_cpu_policy" {
  name               = "${var.project_name}-${var.environment}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_out_cooldown = 300
    scale_in_cooldown  = 300
  }
}

# Memory-based Auto Scaling Policy
resource "aws_appautoscaling_policy" "ecs_memory_policy" {
  name               = "${var.project_name}-${var.environment}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_out_cooldown = 300
    scale_in_cooldown  = 300
  }
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"

  dimensions = {
    ServiceName = aws_ecs_service.main.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Name          = "${var.project_name}-${var.environment}-high-cpu"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_memory" {
  alarm_name          = "${var.project_name}-${var.environment}-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS memory utilization"

  dimensions = {
    ServiceName = aws_ecs_service.main.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Name          = "${var.project_name}-${var.environment}-high-memory"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}
