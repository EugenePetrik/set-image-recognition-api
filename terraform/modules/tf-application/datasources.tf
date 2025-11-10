# Data sources for tf-application module

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_partition" "current" {}

data "aws_ecr_repository" "app" {
  name = "image-recognition-api"
}
