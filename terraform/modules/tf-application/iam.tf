# IAM Roles for ECS Tasks

# ECS Task Execution Role - for pulling ECR images and pushing logs
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-${var.environment}-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name          = "${var.project_name}-${var.environment}-task-execution-role"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# Attach AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
  role       = aws_iam_role.ecs_task_execution_role.name
}

# Attach CloudWatch Logs policy for logging
resource "aws_iam_role_policy_attachment" "ecs_task_execution_logs_policy" {
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
  role       = aws_iam_role.ecs_task_execution_role.name
}

# ECS Task Role - for application to access AWS services
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-${var.environment}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name          = "${var.project_name}-${var.environment}-task-role"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# Custom policy for application permissions
resource "aws_iam_policy" "ecs_task_policy" {
  name        = "${var.project_name}-${var.environment}-task-policy"
  description = "IAM policy for ECS task to access AWS services"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${var.s3_bucket_arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = var.s3_bucket_arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*"
        ]
      }
    ]
  })

  tags = {
    Name          = "${var.project_name}-${var.environment}-task-policy"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
  }
}

# Attach custom policy to task role
resource "aws_iam_role_policy_attachment" "ecs_task_policy_attachment" {
  policy_arn = aws_iam_policy.ecs_task_policy.arn
  role       = aws_iam_role.ecs_task_role.name
}
