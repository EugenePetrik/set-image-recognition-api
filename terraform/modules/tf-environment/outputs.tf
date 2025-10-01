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
