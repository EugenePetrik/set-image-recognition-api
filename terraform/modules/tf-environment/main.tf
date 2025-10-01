# tf-environment module - Persistent Infrastructure
# This module creates persistent AWS resources that exist independently of application deployments

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.common_tags
  }
}

# Local values for resource naming
locals {
  # Common naming convention
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Resource tags
  resource_tags = merge(var.common_tags, {
    Environment = var.environment
    Region      = var.aws_region
    AccountId   = var.aws_account_id
  })
}
