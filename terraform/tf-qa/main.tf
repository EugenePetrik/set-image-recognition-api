# QA Environment Configuration
# This file demonstrates usage of the tf-environment module

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Call tf-environment module
module "environment" {
  source = "../modules/tf-environment"

  # Required variables
  environment    = var.environment
  aws_region     = var.aws_region
  aws_account_id = data.aws_caller_identity.current.account_id
  project_name   = var.project_name

  # QA-specific S3 configuration
  s3_bucket_force_destroy = var.s3_bucket_force_destroy
  s3_lifecycle_enabled    = true
  s3_versioning_enabled   = true

  # DynamoDB configuration
  dynamodb_billing_mode = "PAY_PER_REQUEST"

  # Tags
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "qa-testing"
  }
}

# Call tf-application module
module "application" {
  source = "../modules/tf-application"

  # Required variables
  project_name   = var.project_name
  environment    = var.environment
  aws_region     = var.aws_region

  # Infrastructure inputs from tf-environment module
  vpc_id                    = module.environment.vpc_id
  private_subnet_ids        = module.environment.private_subnet_ids
  public_subnet_ids         = module.environment.public_subnet_ids
  s3_bucket_arn             = module.environment.s3_bucket_arn
  sns_topic_arn             = module.environment.sns_topic_arn
  sqs_queue_arn             = module.environment.sqs_queue_arn
  dynamodb_table_name       = module.environment.dynamodb_table_name
  dynamodb_table_arn        = module.environment.dynamodb_table_arn
  lambda_security_group_id  = module.environment.lambda_security_group_id

  # Application-specific configuration
  ecr_repository_url    = var.ecr_repository_url
  container_image_tag   = var.container_image_tag
  desired_count         = var.desired_count
  task_cpu              = var.task_cpu
  task_memory           = var.task_memory
  certificate_arn       = var.certificate_arn
  domain_name           = var.domain_name

  depends_on            = [module.environment]
}

# Outputs
output "environment_outputs" {
  description = "Outputs from tf-environment module"
  value = {
    s3_bucket_name      = module.environment.s3_bucket_name
    dynamodb_table_name = module.environment.dynamodb_table_name
    sqs_queue_url       = module.environment.sqs_queue_url
    sns_topic_arn       = module.environment.sns_topic_arn
  }
}

output "application_outputs" {
  description = "Outputs from tf-application module"
  value = {
    alb_dns_name          = module.application.alb_dns_name
    ecs_cluster_name      = module.application.ecs_cluster_name
    ecs_service_name      = module.application.ecs_service_name
    lambda_function_name  = module.application.lambda_function_name
  }
}

output "deployment_info" {
  description = "Key information for QA testing and validation"
  value = {
    environment           = var.environment
    application_url       = "http://${module.application.alb_dns_name}"
    health_check_url      = "http://${module.application.alb_dns_name}/api/v1/health"
    api_docs_url          = "http://${module.application.alb_dns_name}/api/docs"
  }
}
