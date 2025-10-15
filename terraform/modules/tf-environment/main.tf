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
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
