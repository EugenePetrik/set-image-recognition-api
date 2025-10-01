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

  # PROD-specific S3 configuration (most conservative)
  s3_bucket_force_destroy = var.s3_bucket_force_destroy  # Configurable but defaults to safe false
  s3_lifecycle_enabled   = true
  s3_versioning_enabled  = true

  # DynamoDB configuration - consider provisioned for production predictability
  dynamodb_billing_mode = "PAY_PER_REQUEST"  # Can be changed to PROVISIONED later

  # Tags
  common_tags = {
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
    Purpose       = "production"
    CriticalLevel = "high"
    BackupPolicy  = "required"
  }
}
