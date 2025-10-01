# SNS Topic for image processing notifications
resource "aws_sns_topic" "image_processing" {
  name = "${local.name_prefix}-image-processing"

  tags = merge(local.resource_tags, {
    Name    = "${local.name_prefix}-image-processing"
    Purpose = "image-processing-notifications"
  })
}

# SNS Topic Policy to allow S3 to publish messages
data "aws_iam_policy_document" "image_processing_policy" {
  statement {
    sid    = "AllowS3Publish"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }

    actions = ["sns:Publish"]

    resources = [aws_sns_topic.image_processing.arn]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [aws_s3_bucket.images_bucket.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_sns_topic_policy" "image_processing_policy" {
  arn    = aws_sns_topic.image_processing.arn
  policy = data.aws_iam_policy_document.image_processing_policy.json
}
