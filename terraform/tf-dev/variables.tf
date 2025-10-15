variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
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

variable "ecr_repository_url" {
  description = "ECR repository URL for the container image"
  type        = string
}

variable "container_image_tag" {
  description = "Container image tag to deploy"
  type        = string
  default     = "latest"
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
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
