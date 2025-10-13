# SNS Topic for image processing notifications
resource "aws_sns_topic" "image_processing" {
  name         = "${local.name_prefix}-${var.sns_topic_name}"
  display_name = "${title(var.environment)} Image Processing Notifications"

  # Configure delivery policy for better reliability
  delivery_policy = jsonencode(var.sns_delivery_policy)

  # Enable server-side encryption
  kms_master_key_id = "alias/aws/sns"

  tags = merge(local.resource_tags, {
    Name    = "${local.name_prefix}-${var.sns_topic_name}"
    Purpose = "image-processing-notifications"
    Type    = "notification"
  })
}

# SNS Topic Policy to allow S3 to publish messages
data "aws_iam_policy_document" "image_processing_policy" {
  # Allow S3 service to publish messages
  statement {
    sid    = "AllowS3Publish"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }

    actions = [
      "sns:Publish"
    ]

    resources = [aws_sns_topic.image_processing.arn]

    # Restrict to specific S3 bucket only
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_s3_bucket.images_bucket.arn]
    }

    # Ensure it's from the correct AWS account
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }

  # Allow account owner to manage the topic
  statement {
    sid    = "AllowAccountOwnerFullAccess"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.aws_account_id}:root"]
    }

    actions = [
      "sns:*"
    ]

    resources = [aws_sns_topic.image_processing.arn]
  }

  # Allow SQS service to subscribe (for future SQS integration)
  statement {
    sid    = "AllowSQSSubscribe"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["sqs.amazonaws.com"]
    }

    actions = [
      "sns:Subscribe",
      "sns:Receive"
    ]

    resources = [aws_sns_topic.image_processing.arn]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_sns_topic_policy" "image_processing_policy" {
  arn = aws_sns_topic.image_processing.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowS3ToPublish"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.image_processing.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}
