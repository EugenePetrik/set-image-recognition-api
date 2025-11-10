variable "environment" {
  description = "Deployment environment (dev, qa, prod)"
  type        = string
  default     = "qa"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "image-recognition-api"
}

variable "s3_bucket_force_destroy" {
  description = "Force destroy S3 bucket even if not empty"
  type        = bool
  default     = false
}

variable "ecr_repository_url" {
  description = "ECR repository URL for the container image"
  type        = string
}

variable "container_image_tag" {
  description = "Container image tag to deploy"
  type        = string
  default     = "qa"
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "task_cpu" {
  description = "CPU units for the ECS task"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Memory for the ECS task"
  type        = number
  default     = 512
}
