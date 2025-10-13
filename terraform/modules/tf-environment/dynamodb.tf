locals {
  # Set protection based on environment name
  enable_deletion_protection = false
}

# DynamoDB Table for Image Recognition
resource "aws_dynamodb_table" "image_recognition_table" {
  name         = "${var.project_name}-${var.environment}-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ImageId"
  range_key    = "CreatedAt"

  # Primary key attributes
  attribute {
    name = "ImageId"
    type = "S"
  }

  attribute {
    name = "CreatedAt"
    type = "S"
  }

  # For label searching functionality
  attribute {
    name = "LabelValue"
    type = "S"
  }

  # Global Secondary Index for label searching
  global_secondary_index {
    name            = "LabelIndex"
    hash_key        = "LabelValue"
    projection_type = "ALL"
  }

  # Optional: GSI for status filtering (if you want to optimize status queries)
  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    projection_type = "ALL"
  }

  # Enable server-side encryption
  server_side_encryption {
    enabled = true
  }

  # Enable point-in-time recovery for production workloads
  point_in_time_recovery {
    enabled = true
  }

  # Table-level settings
  deletion_protection_enabled = false

  # Stream configuration for real-time processing (optional)
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = {
    Name        = "${var.project_name}-${var.environment}-table"
    Environment = var.environment
    Project     = var.project_name
  }
}
