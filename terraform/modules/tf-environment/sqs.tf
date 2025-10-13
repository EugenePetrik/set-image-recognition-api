data "aws_caller_identity" "current" {}

# SQS Queue for Lambda processing
resource "aws_sqs_queue" "image_processing" {
  name                       = "${var.project_name}-${var.environment}-image-processing"
  visibility_timeout_seconds = 900     # 15 minutes (safe for 300s Lambda timeout)
  message_retention_seconds  = 1209600 # 14 days

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.image_processing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-image-processing"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Dead Letter Queue for failed messages
resource "aws_sqs_queue" "image_processing_dlq" {
  name = "${local.name_prefix}-image-processing-dlq"

  # DLQ configuration
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true

  tags = merge(var.common_tags, {
    Name = "${local.name_prefix}-image-processing-dlq"
    Type = "SQS Dead Letter Queue"
  })
}

# SQS Queue Policy - Allow SNS to send messages
resource "aws_sqs_queue_policy" "image_processing_policy" {
  queue_url = aws_sqs_queue.image_processing.id

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "${local.name_prefix}-sqs-policy"
    Statement = [
      {
        Sid    = "AllowSNSPublish"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.image_processing.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.image_processing.arn
          }
        }
      },
      {
        Sid    = "AllowLambdaAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.image_processing.arn
        Condition = {
          StringEquals = {
            "aws:PrincipalTag/Environment" = var.environment
          }
        }
      }
    ]
  })
}

# SNS Subscription - Connect SNS Topic to SQS Queue
resource "aws_sns_topic_subscription" "sqs_target" {
  topic_arn = aws_sns_topic.image_processing.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.image_processing.arn

  raw_message_delivery = true

  filter_policy = jsonencode({
    eventSource = ["aws:s3"]
  })

  depends_on = [aws_sqs_queue_policy.image_processing_policy]
}
