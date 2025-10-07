# Common variables
variable "project_name" {
  type        = string
  description = "Name of the project"
  default     = "image-recognition"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, qa, prod)"
  
  validation {
    condition     = contains(["dev", "qa", "prod"], var.environment)
    error_message = "Environment must be dev, qa, or prod."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for resources"
  default     = "us-east-1"
}

# Infrastructure variables from tf-environment module
variable "vpc_id" {
  type        = string
  description = "VPC ID from tf-environment module"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs from tf-environment module"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs from tf-environment module"
}

variable "s3_bucket_arn" {
  type        = string
  description = "S3 bucket ARN from tf-environment module"
}

variable "sns_topic_arn" {
  type        = string
  description = "SNS topic ARN from tf-environment module"
}

variable "sqs_queue_arn" {
  type        = string
  description = "SQS queue ARN from tf-environment module"
}

variable "dynamodb_table_name" {
  type        = string
  description = "DynamoDB table name from tf-environment module"
}

variable "dynamodb_table_arn" {
  type        = string
  description = "DynamoDB table ARN from tf-environment module"
}

variable "lambda_security_group_id" {
  type        = string
  description = "Lambda security group ID from tf-environment module"
}

# ALB variables (for future implementation)
variable "certificate_arn" {
  type        = string
  description = "SSL certificate ARN for ALB"
  default     = ""
}

variable "domain_name" {
  type        = string
  description = "Domain name for the application"
  default     = ""
}

# ECS variables (for future implementation)
variable "desired_count" {
  type        = number
  description = "Desired number of ECS tasks"
  default     = 2
}
