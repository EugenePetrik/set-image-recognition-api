resource "aws_sns_topic" "image_processing" {
  name         = "${local.name_prefix}-${var.sns_topic_name}"
  display_name = "${title(var.environment)} Image Processing Notifications"

  # Configure delivery policy for better reliability
  delivery_policy = jsonencode(var.sns_delivery_policy)

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-${var.sns_topic_name}"
    Purpose = "image-processing-notifications"
    Type    = "notification"
  })
}

resource "aws_sns_topic_policy" "image_processing_policy" {
  arn = aws_sns_topic.image_processing.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.image_processing.arn
        Condition = {
          ArnLike = {
            "aws:SourceArn" = aws_s3_bucket.images_bucket.arn
          }
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
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

  depends_on = [aws_sqs_queue_policy.image_processing_policy]
}
