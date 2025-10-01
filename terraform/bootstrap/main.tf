# Bootstrap configuration to create S3 buckets and DynamoDB table for Terraform remote state
# This should be run once before setting up the main infrastructure

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "image-recognition-api"
      ManagedBy   = "terraform"
      Environment = "bootstrap"
    }
  }
}

# Get current AWS account ID and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
}
