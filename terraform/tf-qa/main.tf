# QA Environment Configuration

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

terraform {
  backend "s3" {
    bucket         = "image-recognition-dev-bucket-354583059859"
    key            = "state/qa/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "your-terraform-lock-table"
    encrypt        = true
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

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
  private_subnet_ids       = module.environment.private_subnet_ids
  s3_bucket_arn            = module.environment.s3_bucket_arn
  sns_topic_arn            = module.environment.sns_topic_arn
  sqs_queue_arn            = module.environment.sqs_queue_arn
  dynamodb_table_name      = module.environment.dynamodb_table_name
  dynamodb_table_arn       = module.environment.dynamodb_table_arn
  lambda_security_group_id = module.environment.lambda_security_group_id
}

# ===================================================================
# GitHub Secrets
# ===================================================================

output "github_secrets" {
  description = "Values to add as GitHub Secrets (for QA environment)"
  value = {
    # AWS Configuration
    AWS_REGION     = var.aws_region
    AWS_ACCOUNT_ID = data.aws_caller_identity.current.account_id

    # ECS Configuration
    ECS_CLUSTER_QA = module.application.ecs_cluster_name
    ECS_SERVICE_QA = module.application.ecs_service_name

    # Lambda Configuration
    LAMBDA_FUNCTION_QA = module.application.lambda_function_name

    # S3 Bucket
    S3_BUCKET_QA = module.environment.s3_bucket_name

    # DynamoDB Table
    DYNAMODB_TABLE_QA = module.environment.dynamodb_table_name

    # SNS Topic
    SNS_TOPIC_ARN_QA = module.environment.sns_topic_arn

    # SQS Queue
    SQS_QUEUE_URL_QA = module.environment.sqs_queue_url
  }
}

# ===================================================================
# Detailed Outputs (for reference and debugging)
# ===================================================================

output "environment_outputs" {
  description = "Outputs from tf-environment module"
  value = {
    vpc_id              = module.environment.vpc_id
    s3_bucket_name      = module.environment.s3_bucket_name
    s3_bucket_arn       = module.environment.s3_bucket_arn
    dynamodb_table_name = module.environment.dynamodb_table_name
    dynamodb_table_arn  = module.environment.dynamodb_table_arn
    sqs_queue_url       = module.environment.sqs_queue_url
    sqs_queue_arn       = module.environment.sqs_queue_arn
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
  description = "Key information for QA testing and validation"
  value = {
    environment      = var.environment
    aws_region       = var.aws_region
    aws_account_id   = data.aws_caller_identity.current.account_id
    application_url  = "http://${module.application.alb_dns_name}"
    health_check_url = "http://${module.application.alb_dns_name}/api/v1/health"
    api_docs_url     = "http://${module.application.alb_dns_name}/api/docs"
  }
}
