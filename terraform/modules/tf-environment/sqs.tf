# SQS Queue for Lambda processing
resource "aws_sqs_queue" "image_processing" {
  name = "${local.name_prefix}-image-processing"

  # Queue configuration
  visibility_timeout_seconds = 60  # Lambda timeout + buffer
  message_retention_seconds  = 1209600  # 14 days
  max_message_size           = 262144   # 256 KB
  delay_seconds              = 0
  receive_wait_time_seconds  = 0

  # Dead letter queue configuration
  sqs_managed_sse_enabled = true

  # Re-drive policy for failed messages
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.image_processing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(var.common_tags, {
    Name = "${local.name_prefix}-image-processing"
    Type = "SQS Queue"
  })
}

# Dead Letter Queue for failed messages
resource "aws_sqs_queue" "image_processing_dlq" {
  name = "${local.name_prefix}-image-processing-dlq"

  # DLQ configuration
  message_retention_seconds  = 1209600  # 14 days
  sqs_managed_sse_enabled    = true

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

  # Enable raw message delivery for easier Lambda processing
  raw_message_delivery = true

  # Filter policy (optional - can be used to filter specific events)
  filter_policy = jsonencode({
    eventSource = ["aws:s3"]
  })

  depends_on = [aws_sqs_queue_policy.image_processing_policy]
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}
