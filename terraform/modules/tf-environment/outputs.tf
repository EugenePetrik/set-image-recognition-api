output "s3_bucket_name" {
  description = "Name of the S3 bucket for image storage"
  value       = aws_s3_bucket.images_bucket.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.images_bucket.arn
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for image processing"
  value       = aws_sns_topic.image_processing.arn
}

output "sqs_queue_url" {
  description = "URL of the SQS queue for image processing"
  value       = aws_sqs_queue.image_processing.id
}

output "sqs_queue_arn" {
  description = "ARN of the SQS queue"
  value       = aws_sqs_queue.image_processing.arn
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for image recognition"
  value       = aws_dynamodb_table.image_recognition_table.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table for image recognition"
  value       = aws_dynamodb_table.image_recognition_table.arn
}


output "vpc_id" {
  value       = aws_vpc.this.id
  description = "ID of the VPC"
}

output "public_subnet_ids" {
  value       = values(aws_subnet.public)[*].id
  description = "IDs of the public subnets"
}

output "private_subnet_ids" {
  value       = local.private_subnet_ids
  description = "IDs of the private subnets"
}

output "alb_security_group_id" {
  value       = aws_security_group.alb.id
  description = "Security group ID for the ALB"
}

output "lambda_security_group_id" {
  value       = aws_security_group.lambda.id
  description = "Security group ID for Lambda functions"
}
