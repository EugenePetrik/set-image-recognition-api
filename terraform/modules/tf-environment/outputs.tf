# S3 Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for image storage"
  value       = aws_s3_bucket.images_bucket.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.images_bucket.arn
}

output "s3_bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.images_bucket.bucket_domain_name
}

output "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  value       = aws_s3_bucket.images_bucket.bucket_regional_domain_name
}

# Environment Variable for Application Configuration
output "s3_bucket_name_env" {
  description = "Environment variable value for AWS_S3_BUCKET_NAME"
  value       = aws_s3_bucket.images_bucket.id
}

# SNS Outputs
output "sns_topic_arn" {
  description = "ARN of the SNS topic for image processing"
  value       = aws_sns_topic.image_processing.arn
}

output "sns_topic_name" {
  description = "Name of the SNS topic"
  value       = aws_sns_topic.image_processing.name
}

output "sns_topic_id" {
  description = "ID of the SNS topic"
  value       = aws_sns_topic.image_processing.id
}

output "sns_topic_display_name" {
  description = "Display name of the SNS topic"
  value       = aws_sns_topic.image_processing.display_name
}

# SQS Outputs
output "sqs_queue_url" {
  description = "URL of the SQS queue for image processing"
  value       = aws_sqs_queue.image_processing.id
}

output "sqs_queue_arn" {
  description = "ARN of the SQS queue"
  value       = aws_sqs_queue.image_processing.arn
}

output "sqs_queue_name" {
  description = "Name of the SQS queue"
  value       = aws_sqs_queue.image_processing.name
}

output "sqs_dlq_url" {
  description = "URL of the SQS dead letter queue"
  value       = aws_sqs_queue.image_processing_dlq.id
}

output "sqs_dlq_arn" {
  description = "ARN of the SQS dead letter queue"
  value       = aws_sqs_queue.image_processing_dlq.arn
}

# DynamoDB Outputs
output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for image recognition"
  value       = aws_dynamodb_table.image_recognition_table.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table for image recognition"
  value       = aws_dynamodb_table.image_recognition_table.arn
}

output "dynamodb_table_id" {
  description = "ID of the DynamoDB table for image recognition"
  value       = aws_dynamodb_table.image_recognition_table.id
}

output "dynamodb_stream_arn" {
  description = "ARN of the DynamoDB stream for image recognition table"
  value       = aws_dynamodb_table.image_recognition_table.stream_arn
}

output "dynamodb_label_index_name" {
  description = "Name of the LabelIndex GSI"
  value       = "LabelIndex"
}

output "dynamodb_status_index_name" {
  description = "Name of the StatusIndex GSI"
  value       = "StatusIndex"
}

# Environment Variable for Application Configuration
output "dynamodb_table_name_env" {
  description = "Environment variable value for AWS_DYNAMODB_TABLE_NAME"
  value       = aws_dynamodb_table.image_recognition_table.name
}

# General Outputs
output "region" {
  description = "AWS region"
  value       = var.aws_region
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "name_prefix" {
  description = "Common name prefix used for resources"
  value       = local.name_prefix
}
