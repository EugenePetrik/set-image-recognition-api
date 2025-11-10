variable "environment" {
  description = "Deployment environment (dev, qa, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "qa", "prod"], var.environment)
    error_message = "Environment must be dev, qa, or prod."
  }
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "image-recognition-api"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "image-recognition-api"
    Environment = "tf-environment"
  }
}

variable "s3_bucket_force_destroy" {
  description = "Force destroy S3 bucket even if not empty"
  type        = bool
  default     = true
}

variable "s3_lifecycle_enabled" {
  description = "Enable S3 lifecycle management"
  type        = bool
  default     = true
}

variable "s3_versioning_enabled" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode"
  type        = string
  default     = "PAY_PER_REQUEST"
  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.dynamodb_billing_mode)
    error_message = "Billing mode must be PAY_PER_REQUEST or PROVISIONED."
  }
}

variable "sns_topic_name" {
  description = "SNS topic name (will be prefixed with environment)"
  type        = string
  default     = "image-processing"
}

variable "sns_delivery_policy" {
  description = "SNS delivery policy configuration"
  type        = map(any)
  default = {
    http = {
      defaultHealthyRetryPolicy = {
        minDelayTarget     = 20
        maxDelayTarget     = 20
        numRetries         = 3
        numMaxDelayRetries = 0
        numMinDelayRetries = 0
        numNoDelayRetries  = 0
        backoffFunction    = "linear"
      }
      disableSubscriptionOverrides = false
    }
  }
}

variable "vpc_cidr_block" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Map from availability zone suffix to CIDR"
  type        = map(string)
  default = {
    a = "10.20.1.0/24"
    b = "10.20.2.0/24"
  }
}

variable "private_subnet_cidrs" {
  description = "Map from availability zone suffix to CIDR"
  type        = map(string)
  default = {
    a = "10.20.11.0/24"
    b = "10.20.12.0/24"
  }
}
