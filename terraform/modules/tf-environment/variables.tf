variable "environment" {
  description = "Environment name (dev, qa, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "qa", "prod"], var.environment)
    error_message = "Environment must be dev, qa, or prod."
  }
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "image-recognition-api"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "image-recognition-api"
    ManagedBy = "terraform"
    Module    = "tf-environment"
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
