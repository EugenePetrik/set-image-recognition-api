# QA Environment Variables

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "qa"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "image-recognition-api"
}

variable "s3_bucket_force_destroy" {
  description = "Force destroy S3 bucket even if not empty"
  type        = bool
  default     = true
}
