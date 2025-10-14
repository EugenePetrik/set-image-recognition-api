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

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.images_bucket.id
  topic {
    topic_arn     = aws_sns_topic.image_processing.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "images/"
  }
  depends_on = [aws_s3_bucket.images_bucket]
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

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "images_bucket_versioning" {
  bucket = aws_s3_bucket.images_bucket.id

  versioning_configuration {
    status = var.s3_versioning_enabled ? "Enabled" : "Suspended"
  }
}
