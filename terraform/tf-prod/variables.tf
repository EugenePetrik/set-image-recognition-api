# PROD Environment Variables

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
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
  description = "Force destroy S3 bucket even if not empty (DANGEROUS in production)"
  type        = bool
  default     = false
}

# Application-specific variables
variable "ecr_repository_url" {
  description = "ECR repository URL for the container image"
  type        = string
}

variable "container_image_tag" {
  description = "Container image tag to deploy"
  type        = string
  default     = "stable"
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 3
}

variable "task_cpu" {
  description = "CPU units for the ECS task"
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Memory for the ECS task"
  type        = number
  default     = 1024
}

variable "certificate_arn" {
  description = "SSL certificate ARN for ALB"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}
