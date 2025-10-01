output "s3_bucket_names" {
  description = "Names of the S3 buckets created for Terraform state"
  value = {
    for env, bucket in aws_s3_bucket.terraform_state : env => bucket.bucket
  }
}

output "s3_bucket_arns" {
  description = "ARNs of the S3 buckets created for Terraform state"
  value = {
    for env, bucket in aws_s3_bucket.terraform_state : env => bucket.arn
  }
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for state locking"
  value       = aws_dynamodb_table.terraform_state_lock.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table for state locking"
  value       = aws_dynamodb_table.terraform_state_lock.arn
}

output "backend_configurations" {
  description = "Backend configurations for each environment"
  value = {
    for env, bucket in aws_s3_bucket.terraform_state : env => {
      bucket         = bucket.bucket
      key            = "terraform.tfstate"
      region         = var.aws_region
      dynamodb_table = aws_dynamodb_table.terraform_state_lock.name
      encrypt        = true
    }
  }
}
