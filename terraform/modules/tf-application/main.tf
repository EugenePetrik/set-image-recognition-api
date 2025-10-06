# tf-application module main configuration
# This module creates application-specific infrastructure that depends on tf-environment

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# Lambda function is defined in lambda.tf
# ALB configuration will be added in alb.tf (future)
# ECS configuration will be added in ecs.tf (future)
# IAM roles will be added in iam.tf (future)
