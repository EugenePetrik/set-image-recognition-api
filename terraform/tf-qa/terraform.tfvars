# QA Environment Configuration
environment  = "qa"
aws_region   = "us-east-1"
project_name = "image-recognition-api"
vpc_cidr     = "10.1.0.0/16"

# S3 Configuration
s3_bucket_force_destroy = true # Can be set to false for safety

# Application Configuration
ecr_repository_url  = "354583059859.dkr.ecr.us-east-1.amazonaws.com/image-recognition-api"
container_image_tag = "latest"
desired_count       = 2
task_cpu            = 256
task_memory         = 512

