# Backend configuration for DEV environment
terraform {
  backend "s3" {
    bucket         = "image-recognition-api-terraform-state-dev-354583059859"
    key            = "environment/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "image-recognition-api-terraform-state-lock"
    encrypt        = true
  }
}
