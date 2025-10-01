# DynamoDB Table for Image Recognition
resource "aws_dynamodb_table" "image_recognition_table" {
  name           = "${local.name_prefix}-table"
  billing_mode   = var.dynamodb_billing_mode
  hash_key       = "ImageId"
  range_key      = "CreatedAt"

  # Conditional capacity settings (only used when billing_mode is PROVISIONED)
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  # Primary key attributes
  attribute {
    name = "ImageId"
    type = "S"  # String
  }

  attribute {
    name = "CreatedAt"
    type = "S"  # String (ISO 8601 timestamp or "METADATA")
  }

  # GSI attributes for label searches (matching service expectations)
  attribute {
    name = "LabelValue"
    type = "S"  # String - matches service query
  }

  attribute {
    name = "status"
    type = "S"  # String - for status-based queries
  }

  # Global Secondary Index for label searches (matches service query pattern)
  global_secondary_index {
    name            = "LabelIndex"
    hash_key        = "LabelValue"
    projection_type = "ALL"

    # Conditional capacity settings for GSI
    read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  # Global Secondary Index for status-based queries
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "CreatedAt"
    projection_type = "ALL"

    # Conditional capacity settings for GSI
    read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
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
  deletion_protection_enabled = var.environment == "prod" ? true : false

  # Stream configuration for real-time processing (optional)
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-table"
    Type        = "DynamoDB Table"
    Purpose     = "image-recognition-data"
    Environment = var.environment
    DataType    = "image-metadata-and-results"
  })

  # Lifecycle management
  lifecycle {
    prevent_destroy = true
  }
}

# Auto Scaling for PROVISIONED billing mode (optional)
resource "aws_appautoscaling_target" "dynamodb_table_read_target" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" ? 1 : 0
  max_capacity       = 100
  min_capacity       = 5
  resource_id        = "table/${aws_dynamodb_table.image_recognition_table.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_target" "dynamodb_table_write_target" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" ? 1 : 0
  max_capacity       = 100
  min_capacity       = 5
  resource_id        = "table/${aws_dynamodb_table.image_recognition_table.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "dynamodb_table_read_policy" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" ? 1 : 0
  name               = "${local.name_prefix}-read-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.dynamodb_table_read_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.dynamodb_table_read_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.dynamodb_table_read_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value = 70
  }
}

resource "aws_appautoscaling_policy" "dynamodb_table_write_policy" {
  count              = var.dynamodb_billing_mode == "PROVISIONED" ? 1 : 0
  name               = "${local.name_prefix}-write-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.dynamodb_table_write_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.dynamodb_table_write_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.dynamodb_table_write_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value = 70
  }
}
