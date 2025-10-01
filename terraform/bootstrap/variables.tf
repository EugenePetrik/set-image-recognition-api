variable "aws_region" {
  type        = string
  description = "AWS region for resources"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Name of the project"
  default     = "image-recognition-api"
}

variable "environments" {
  type        = list(string)
  description = "List of environments to create state buckets for"
  default     = ["dev", "qa", "prod"]
}

variable "force_destroy" {
  type        = bool
  description = "Allow force destroy of S3 buckets (only for dev/testing)"
  default     = false
}
