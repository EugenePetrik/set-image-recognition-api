# PROD Environment Configuration
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

provider "aws" {
  region = var.aws_region
}

module "environment" {
  source = "../modules/tf-environment"

  environment  = var.environment
  aws_region   = var.aws_region
  project_name = var.project_name

  s3_bucket_force_destroy = var.s3_bucket_force_destroy
}

module "application" {
  source = "../modules/tf-application"

  environment  = var.environment
  aws_region   = var.aws_region
  project_name = var.project_name

  vpc_id                   = module.environment.vpc_id
  public_subnet_ids        = module.environment.public_subnet_ids
  s3_bucket_arn            = module.environment.s3_bucket_arn
  sns_topic_arn            = module.environment.sns_topic_arn
  sqs_queue_arn            = module.environment.sqs_queue_arn
  dynamodb_table_name      = module.environment.dynamodb_table_name
  dynamodb_table_arn       = module.environment.dynamodb_table_arn
  lambda_security_group_id = module.environment.lambda_security_group_id
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
    alb_dns_name         = module.application.alb_dns_name
    ecs_cluster_name     = module.application.ecs_cluster_name
    ecs_service_name     = module.application.ecs_service_name
    lambda_function_name = module.application.lambda_function_name
  }
}

output "deployment_info" {
  description = "Key information for production deployment"
  value = {
    environment      = var.environment
    application_url  = "http://${module.application.alb_dns_name}"
    health_check_url = "http://${module.application.alb_dns_name}/api/v1/health"
    api_docs_url     = "http://${module.application.alb_dns_name}/api/docs"
  }
}
