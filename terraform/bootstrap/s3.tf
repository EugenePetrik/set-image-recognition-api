# S3 buckets for Terraform state (one per environment)
resource "aws_s3_bucket" "terraform_state" {
  for_each = toset(var.environments)
  
  bucket        = "${var.project_name}-terraform-state-${each.value}-${local.account_id}"
  force_destroy = var.force_destroy

  tags = {
    Name        = "${var.project_name}-terraform-state-${each.value}"
    Environment = each.value
    Purpose     = "terraform-state"
  }
}

# Enable versioning for state buckets
resource "aws_s3_bucket_versioning" "terraform_state" {
  for_each = aws_s3_bucket.terraform_state
  
  bucket = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption for state buckets
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  for_each = aws_s3_bucket.terraform_state
  
  bucket = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Block public access for state buckets
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  for_each = aws_s3_bucket.terraform_state
  
  bucket = each.value.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle configuration to manage old versions
resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  for_each = aws_s3_bucket.terraform_state
  
  bucket = each.value.id

  rule {
    id     = "terraform_state_lifecycle"
    status = "Enabled"

    filter {
      prefix = ""
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
