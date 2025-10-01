# Terraform Local State Setup

## Overview

This project uses **local Terraform state files** as specified in the requirements. Each environment manages its own `.tfstate` file locally.

## Project Structure

Following the exact requirements structure:

```text
terraform/
├── modules/
│   ├── tf-environment/     # Persistent infrastructure module ✅ IMPLEMENTED
│   │   ├── main.tf         # ✅ Module configuration and locals
│   │   ├── variables.tf    # ✅ All required variables defined  
│   │   ├── outputs.tf      # ✅ Resource outputs + env vars
│   │   ├── versions.tf     # ✅ Provider requirements
│   │   ├── datasources.tf  # ✅ AWS account data source
│   │   ├── s3_bucket.tf    # ✅ S3 bucket with public access, encryption, lifecycle
│   │   ├── sns_topic.tf    # ✅ SNS topic with encryption and delivery policies
│   │   ├── sqs.tf          # ✅ SQS queue + DLQ + SNS subscription
│   │   ├── dynamodb.tf     # ✅ DynamoDB table with GSI indexes
│   │   └── networking.tf   # 🔄 VPC endpoints (placeholder)
│   └── tf-application/     # Application infrastructure module 🔄 IN PROGRESS
│       ├── main.tf         # 🔄 Module structure (placeholder)
│       ├── variables.tf    # 🔄 Variables (placeholder)
│       ├── outputs.tf      # 🔄 Outputs (placeholder)
│       ├── versions.tf     # 🔄 Provider requirements (placeholder)
│       ├── datasources.tf  # 🔄 Data sources (placeholder)
│       ├── lambda.tf       # 🔄 Lambda for image recognition (placeholder)
│       ├── ecs.tf          # 🔄 ECS cluster and services (placeholder)
│       ├── alb.tf          # 🔄 Application Load Balancer (placeholder)
│       └── iam.tf          # 🔄 IAM roles and policies (placeholder)
├── tf-dev/                 # DEV environment
│   ├── main.tf
│   ├── variables.tf
│   ├── terraform.tfvars.example
│   └── versions.tf
├── tf-qa/                  # QA environment
│   ├── main.tf
│   ├── variables.tf
│   ├── terraform.tfvars.example
│   └── versions.tf
└── tf-prod/                # PROD environment
    ├── main.tf
    ├── variables.tf
    ├── terraform.tfvars.example
    └── versions.tf
```

## Environment Setup

### Step 1: Copy Configuration Template

For each environment you want to work with:

```bash
# DEV Environment
cd terraform/tf-dev
cp terraform.tfvars.example terraform.tfvars

# QA Environment
cd terraform/tf-qa
cp terraform.tfvars.example terraform.tfvars

# PROD Environment
cd terraform/tf-prod
cp terraform.tfvars.example terraform.tfvars
```

### Step 2: Customize Settings

Edit the `terraform.tfvars` file for your specific needs:

```hcl
environment             = "dev"
aws_region              = "us-east-1"
project_name            = "image-recognition-api"
s3_bucket_force_destroy = true
```

### Step 3: Initialize and Deploy

⚠️ **Recommended deployment order**: DEV → QA → PROD

```bash
# DEV Environment (development and testing)
cd terraform/tf-dev
terraform init
terraform validate
terraform plan
terraform apply

# QA Environment (quality assurance)
cd terraform/tf-qa
terraform init
terraform validate
terraform plan
terraform apply

# PROD Environment (production - deploy last)
cd terraform/tf-prod
terraform init
terraform validate
terraform plan
terraform apply
```

### Current Deployment Status

**✅ Ready for deployment:**

- S3 bucket with public access and encryption
- SNS topic with delivery policies and encryption
- SQS queue with dead letter queue support
- DynamoDB table with optimized GSI indexes
- Complete S3→SNS→SQS→Lambda notification pipeline

**🔄 Infrastructure Flow:**

1. Image uploaded to S3 (`images/` prefix)
2. S3 triggers SNS notification
3. SNS delivers message to SQS queue
4. SQS queues message for Lambda processing
5. Lambda processes image and stores results in DynamoDB

## State Management

### Local State Files

- Each environment has its own `.tfstate` file
- State files are **NOT** committed to git (see `.gitignore`)
- State files contain sensitive information and AWS resource IDs

### State File Locations

```text
tf-dev/terraform.tfstate      # DEV environment state
tf-qa/terraform.tfstate       # QA environment state  
tf-prod/terraform.tfstate     # PROD environment state
```

### ⚠️ Important Notes

- **Backup your state files** before major changes
- **Never** commit `.tfstate` files to git
- **Never** edit state files manually
- Use `terraform state` commands for state management

## Resource Naming Convention

Resources are named following the pattern:

- S3 Bucket: `image-recognition-api-{env}-images-{account-id}`
- DynamoDB: `image-recognition-api-{env}-table`
- SNS Topic: `image-recognition-api-{env}-image-processing`
- SQS Queue: `image-recognition-api-{env}-image-processing`
- SQS DLQ: `image-recognition-api-{env}-image-processing-dlq`

## Environment Isolation

Each environment creates completely separate AWS resources:

| Environment | Purpose | S3 Force Destroy | Resource Naming |
|-------------|---------|------------------|-----------------|
| **DEV** | Development testing | `true` | `*-dev-*` |
| **QA** | Quality assurance | `false` | `*-qa-*` |
| **PROD** | Production workloads | `false` | `*-prod-*` |

## Troubleshooting

### Common Issues

**Error: "Bucket already exists"**

- S3 bucket names must be globally unique
- Change the `project_name` variable

**Error: "Access Denied"**

- Check AWS credentials: `aws sts get-caller-identity`
- Ensure proper IAM permissions

**State Lock Issues**

- Not applicable (using local state)
- Remove `.terraform.lock.hcl` and run `terraform init`

### Recovery Commands

```bash
# Reinitialize environment
rm -rf .terraform .terraform.lock.hcl
terraform init

# Check current state
terraform show

# Import existing resource (if needed)
terraform import aws_s3_bucket.example bucket-name
```

## Implementation Status

### tf-environment Module (Persistent Infrastructure)

- ✅ **S3 Bucket**: Public access, encryption, lifecycle policies, S3→SNS notifications
- ✅ **SNS Topic**: Encrypted, delivery policies, comprehensive IAM policies
- ✅ **SQS Queue**: Non-FIFO queue, dead letter queue, SNS subscription
- ✅ **DynamoDB**: Single table with GSIs for labels and status queries
- ⏳ **Networking**: VPC endpoints, security groups (placeholder files exist)

### tf-application Module (Application Infrastructure)

- ⏳ **Lambda Function**: Image recognition processing (placeholder files exist)
- ⏳ **ECS Cluster**: Application hosting (placeholder files exist)
- ⏳ **ALB**: Load balancing (placeholder files exist)
- ⏳ **IAM Roles**: Service permissions (placeholder files exist)

### Next Steps

1. ✅ Environment setup complete
2. ✅ Core tf-environment module (S3, SNS, SQS, DynamoDB)
3. ⏳ Complete networking setup (VPC endpoints)
4. ⏳ Implement tf-application module
5. ⏳ Add static code analysis
6. ⏳ Create infrastructure tests

## Application Configuration

After deploying infrastructure, configure your application with these environment variables:

```bash
# Get the actual resource names from Terraform outputs
terraform output s3_bucket_name_env
terraform output dynamodb_table_name_env
```

### Required Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Resource Names (from Terraform outputs)
AWS_S3_BUCKET_NAME=image-recognition-api-{env}-images-{account-id}
AWS_DYNAMODB_TABLE_NAME=image-recognition-api-{env}-table

# Example for DEV environment
AWS_S3_BUCKET_NAME=image-recognition-api-dev-images-354583059859
AWS_DYNAMODB_TABLE_NAME=image-recognition-api-dev-table
```

### Getting Environment Variable Values

```bash
# For DEV environment
cd terraform/tf-dev
echo "AWS_S3_BUCKET_NAME=$(terraform output -raw s3_bucket_name_env)"
echo "AWS_DYNAMODB_TABLE_NAME=$(terraform output -raw dynamodb_table_name_env)"

# For QA environment
cd terraform/tf-qa
echo "AWS_S3_BUCKET_NAME=$(terraform output -raw s3_bucket_name_env)"
echo "AWS_DYNAMODB_TABLE_NAME=$(terraform output -raw dynamodb_table_name_env)"

# For PROD environment
cd terraform/tf-prod
echo "AWS_S3_BUCKET_NAME=$(terraform output -raw s3_bucket_name_env)"
echo "AWS_DYNAMODB_TABLE_NAME=$(terraform output -raw dynamodb_table_name_env)"
```

---

**Note**: This setup follows the exact requirements specification without remote state management.
