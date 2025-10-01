# Terraform Local State Setup

## Overview

This project uses **local Terraform state files** as specified in the requirements. Each environment manages its own `.tfstate` file locally.

## Project Structure

Following the exact requirements structure:

```text
terraform/
├── modules/
│   ├── tf-environment/     # Persistent infrastructure module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── versions.tf
│   │   ├── datasources.tf
│   │   ├── s3_bucket.tf    # S3 bucket for image storage
│   │   ├── sns_topic.tf    # SNS topic for notifications
│   │   ├── sqs.tf          # SQS queue for message processing
│   │   ├── dynamodb.tf     # DynamoDB for recognition results
│   │   └── networking.tf   # VPC endpoints and connectivity
│   └── tf-application/     # Application infrastructure module
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── versions.tf
│       ├── datasources.tf
│       ├── lambda.tf       # Lambda for image recognition
│       ├── ecs.tf          # ECS cluster and services
│       ├── alb.tf          # Application Load Balancer
│       └── iam.tf          # IAM roles and policies
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

```bash
cd terraform/tf-dev
terraform init
terraform validate
terraform plan
terraform apply
```

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
- DynamoDB: `image-recognition-{env}-table`
- SNS Topic: `image-recognition-api-{env}-image-processing`
- SQS Queue: `image-recognition-api-{env}-processing-queue`

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

## Next Steps

1. ✅ Environment setup complete
2. ⏳ Implement tf-environment module components
3. ⏳ Implement tf-application module
4. ⏳ Add static code analysis
5. ⏳ Create infrastructure tests

---

**Note**: This setup follows the exact requirements specification without remote state management.
