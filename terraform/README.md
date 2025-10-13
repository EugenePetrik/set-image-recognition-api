# Terraform Local State Setup

## Overview

This project uses **local Terraform state files** as specified in the requirements. Each environment manages its own `.tfstate` file locally.

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
environment  = "dev"
aws_region   = "us-east-1"
project_name = "image-recognition-api"

# S3 Configuration
s3_bucket_force_destroy = true

# Application Configuration
ecr_repository_url  = ""
container_image_tag = "latest"
desired_count       = 2
task_cpu            = 256
task_memory         = 512
certificate_arn     = ""
domain_name         = ""
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

```bash
# Code formatting
terraform fmt -recursive
```

```bash
# Destroy resources
terraform destroy
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

### Resource Naming Convention

Resources are named following the pattern:

- S3 Bucket: `image-recognition-api-{env}-images-{account-id}`
- DynamoDB: `image-recognition-api-{env}-table`
- SNS Topic: `image-recognition-api-{env}-image-processing`
- SQS Queue: `image-recognition-api-{env}-image-processing`
- SQS DLQ: `image-recognition-api-{env}-image-processing-dlq`

### Required Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Resource Names (from Terraform outputs)
AWS_S3_BUCKET_NAME=image-recognition-api-{env}-images-{account-id}
AWS_DYNAMODB_TABLE_NAME=image-recognition-api-{env}-table
```

## Static Code Analysis

### Install TFLint

```bash
# Install via Homebrew (recommended)
brew install tflint
# Verify installation
tflint --version
```

```bash
# Via curl (if Homebrew not available)
curl -s https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash
```

### Initialize TFLint

```bash
cd ~/terraform
tflint --init

# Verify initialization
tflint --version
```

### Run TFLint Analysis

```bash
# Run TFLint on root directory
tflint
```

### Install Checkov

```bash
# Install via pip
pip3 install checkov

# Or install via Homebrew
brew install checkov

# Verify installation
checkov --version
```

### Run Checkov Analysis

```bash
# Run Checkov on root directory
checkov --config-file .checkov.yaml
```

### Install TFSec

```bash
# Install via Homebrew (recommended)
brew install tfsec

# Or install via curl
curl -s https://raw.githubusercontent.com/aquasecurity/tfsec/master/scripts/install_linux.sh | bash

# Verify installation
tfsec --version
```

### Run TFSec Analysis

```bash
# Run TFSec on root directory
tfsec --config-file .tfsec.yaml
```

## Testing

### Install dependencies

```bash
# Install dependencies
pip install -r requirements.txt
```

### Run tests

```bash
pytest -v -m "unit" --cov=tests --cov-report=html
```
