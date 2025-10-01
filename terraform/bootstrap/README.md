# Bootstrap Terraform Configuration for Remote State

This directory contains the bootstrap configuration to set up the S3 buckets and DynamoDB table required for Terraform remote state management.

## Purpose

- Creates S3 buckets for storing Terraform state files (one per environment: dev, qa, prod)
- Creates a DynamoDB table for state locking to prevent concurrent modifications
- Configures proper security settings (encryption, versioning, lifecycle policies)

## Usage

### 1. Initialize and Apply Bootstrap Configuration

```bash
cd terraform/bootstrap

# Initialize Terraform
terraform init

# Plan the changes
terraform plan

# Apply the configuration
terraform apply
```

### 2. Note the Outputs

After applying, note the outputs which will be used to configure backend for each environment:

```bash
terraform output
```

## Resources Created

### S3 Buckets

- `image-recognition-api-terraform-state-dev-{account-id}`
- `image-recognition-api-terraform-state-qa-{account-id}`
- `image-recognition-api-terraform-state-prod-{account-id}`

Features:

- Versioning enabled
- Server-side encryption (AES256)
- Public access blocked
- Lifecycle policy (90-day retention for old versions)

### DynamoDB Table

- `image-recognition-api-terraform-state-lock`

Features:

- Pay-per-request billing
- Point-in-time recovery enabled
- Server-side encryption enabled

## Security Considerations

- All S3 buckets have public access blocked
- Server-side encryption is enabled on all resources
- Proper IAM permissions should be configured for accessing these resources

## Cleanup

⚠️ **Warning**: Only delete these resources if you no longer need any Terraform-managed infrastructure.

```bash
terraform destroy
```

## Next Steps

After running this bootstrap:

1. Use the output values to configure backend in each environment (dev, qa, prod)
2. Each environment will reference these buckets for state management
