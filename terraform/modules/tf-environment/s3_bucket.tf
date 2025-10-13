# S3 Bucket for image storage
resource "aws_s3_bucket" "images_bucket" {
  bucket        = "${var.project_name}-${var.environment}-images-${var.aws_account_id}"
  force_destroy = var.s3_bucket_force_destroy

  tags = merge(var.common_tags, {
    Name        = "${var.project_name}-${var.environment}-images"
    Environment = var.environment
    Purpose     = "image-storage"
  })
}

# S3 Bucket Public Access Block - Allow public ACLs as required
resource "aws_s3_bucket_public_access_block" "images_bucket_pab" {
  bucket = aws_s3_bucket.images_bucket.id

  block_public_acls       = false # Allow public ACLs as required
  block_public_policy     = false # Allow public policies
  ignore_public_acls      = false # Don't ignore public ACLs
  restrict_public_buckets = false # Allow public buckets
}

# S3 Bucket Ownership Controls
resource "aws_s3_bucket_ownership_controls" "images_bucket_ownership" {
  bucket = aws_s3_bucket.images_bucket.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }

  depends_on = [aws_s3_bucket_public_access_block.images_bucket_pab]
}

# S3 Bucket ACL - Public read access as required
resource "aws_s3_bucket_acl" "images_bucket_acl" {
  bucket = aws_s3_bucket.images_bucket.id
  acl    = "public-read"

  depends_on = [
    aws_s3_bucket_public_access_block.images_bucket_pab,
    aws_s3_bucket_ownership_controls.images_bucket_ownership
  ]
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "images_bucket_versioning" {
  bucket = aws_s3_bucket.images_bucket.id

  versioning_configuration {
    status = var.s3_versioning_enabled ? "Enabled" : "Suspended"
  }
}

# S3 Bucket Server-Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "images_bucket_encryption" {
  bucket = aws_s3_bucket.images_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "images_bucket_lifecycle" {
  count = var.s3_lifecycle_enabled ? 1 : 0

  bucket = aws_s3_bucket.images_bucket.id

  rule {
    id     = "image_lifecycle_rule"
    status = "Enabled"

    # Filter to apply only to image files
    filter {
      prefix = "images/"
    }

    # Transition to Intelligent Tiering after 0 days (immediate)
    transition {
      days          = 0
      storage_class = "INTELLIGENT_TIERING"
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    # Clean up old object versions (if versioning is enabled)
    dynamic "noncurrent_version_transition" {
      for_each = var.s3_versioning_enabled ? [1] : []
      content {
        noncurrent_days = 30
        storage_class   = "STANDARD_IA"
      }
    }

    dynamic "noncurrent_version_transition" {
      for_each = var.s3_versioning_enabled ? [1] : []
      content {
        noncurrent_days = 90
        storage_class   = "GLACIER"
      }
    }

    dynamic "noncurrent_version_expiration" {
      for_each = var.s3_versioning_enabled ? [1] : []
      content {
        noncurrent_days = 365
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.images_bucket_versioning]
}

# S3 Bucket Policy
data "aws_iam_policy_document" "images_bucket_policy" {
  # Allow ECS tasks to PUT objects
  statement {
    sid    = "AllowECSPutObjects"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.aws_account_id}:role/${var.project_name}-${var.environment}-ecs-task-role"]
    }

    actions = [
      "s3:PutObject",
      "s3:PutObjectAcl"
    ]

    resources = [
      "*"
    ]
  }

  # Allow Lambda to GET/LIST objects
  statement {
    sid    = "AllowLambdaGetObjects"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.aws_account_id}:role/${var.project_name}-${var.environment}-lambda-role"]
    }

    actions = [
      "s3:GetObject",
      "s3:ListBucket"
    ]

    resources = [
      "*"
    ]
  }

  # Deny insecure connections
  statement {
    sid    = "DenyInsecureConnections"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      "*"
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "images_bucket_policy" {
  bucket = aws_s3_bucket.images_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "ecs-tasks.amazonaws.com"
          ]
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.images_bucket.arn}/*"
      }
    ]
  })
}

# S3 Bucket Notification (will be configured after SNS topic is created)
resource "aws_s3_bucket_notification" "images_bucket_notification" {
  bucket = aws_s3_bucket.images_bucket.id

  topic {
    topic_arn     = aws_sns_topic.image_processing.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "images/"
    filter_suffix = ""
  }

  depends_on = [
    aws_sns_topic_policy.image_processing_policy
  ]
}
