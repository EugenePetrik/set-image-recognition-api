# Image Recognition API

A cloud-native image recognition API built with NestJS and AWS services. This application allows users to upload images, automatically detect objects using AWS Rekognition, and search images by detected labels.

## 🏗️ Architecture Overview

```text
                                     ┌─────────────────┐
                                     │                 │
                           ┌────────▶│   NestJS API    │◀─────────┐
                           │         │                 │          │
                           │         └─────────────────┘          │
                           │                                      │
                           ▼                                      ▼
                      ┌─────────┐                          ┌───────────┐
                      │         │                          │           │
                      │   S3    │                          │ DynamoDB  │
                      │ Bucket  │                          │   Table   │
                      │         │                          │           │
                      └────┬────┘                          └───────────┘
                           │                                      ▲
                           │ (S3 Event)                           │
                           ▼                                      │
                      ┌─────────┐    ┌─────────┐    ┌─────────────┴───┐
                      │   SNS   │───▶│   SQS   │───▶│ Lambda Function │
                      │  Topic  │    │  Queue  │    │  (Rekognition)  │
                      └─────────┘    └─────────┘    └─────────────────┘
```

### Data Flow

1. **📤 Image Upload**: Client uploads image via NestJS API
2. **📁 S3 Storage**: API stores image in S3 bucket
3. **📢 Event Trigger**: S3 triggers SNS notification
4. **📨 Queue Processing**: SNS delivers message to SQS queue
5. **⚡ Lambda Processing**: Lambda function polls SQS and processes image
6. **🔍 Image Analysis**: Lambda calls AWS Rekognition to detect labels
7. **💾 Result Storage**: Lambda stores analysis results in DynamoDB
8. **🔍 Search & Retrieval**: API provides search and retrieval endpoints

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and pnpm
- AWS Account with configured credentials
- AWS CLI configured with appropriate permissions

### Installation

````bash
# Clone the repository
git clone <repository-url>
cd image-recognition-api

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
````

## Environment Configuration

Update `.env` with your AWS configuration:

```bash
# Application Configuration
NODE_ENV=development
PORT=3000

# AWS Configuration
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# S3 Configuration
AWS_S3_BUCKET_NAME=

# DynamoDB Configuration
AWS_DYNAMODB_TABLE_NAME=

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,image/webp

# Rate Limiting Configuration
THROTTLE_TTL=60
THROTTLE_LIMIT=100
UPLOAD_THROTTLE_LIMIT=10
```

## Development

```bash
# Development mode with hot reload
pnpm run start:dev

# Enable debug logging
LOG_LEVEL=debug pnpm run start:dev

# Build the application
pnpm run build

# Production mode
pnpm run start:prod

# Run tests
pnpm run test

# Run tests with coverage
pnpm run test:coverage

# Code quality checks
pnpm run quality:check

# Fix code quality issues
pnpm run quality:fix
```

## 🛠️ AWS Services Setup

### Required AWS Services

1. **S3 Bucket** - store uploaded images
2. **DynamoDB Table** - store image metadata and labels
3. **SNS Topic** - handle S3 event notifications
4. **SQS Queue** - queue processing tasks
5. **Lambda Function** - process images with Rekognition
6. **IAM Roles** - permissions for services communication

### DynamoDB Table Structure

```json
{
  "TableName": "image-recognition-dev-table",
  "KeySchema": [
    { "AttributeName": "ImageId", "KeyType": "HASH" },
    { "AttributeName": "CreatedAt", "KeyType": "RANGE" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "ImageId", "AttributeType": "S" },
    { "AttributeName": "CreatedAt", "AttributeType": "S" },
    { "AttributeName": "LabelValue", "AttributeType": "S" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "LabelIndex",
      "KeySchema": [
        { "AttributeName": "LabelValue", "KeyType": "HASH" },
        { "AttributeName": "CreatedAt", "KeyType": "RANGE" }
      ]
    }
  ]
}
```

### Lambda Function

The Lambda function (`lambda_function.py`) processes images using AWS Rekognition:

- **Trigger**: SQS messages from S3 events
- **Processing**: detects labels with minimum 75% confidence
- **Storage**: updates DynamoDB with recognition results
- **Error Handling**: comprehensive logging and error recovery

## 📚 API Documentation

### Base URL

```text
http://localhost:3000
```

### Health Check

```bash
GET /health
```

### Image Upload

```bash
POST /image
Content-Type: multipart/form-data

Body:
- file: image file (jpeg, png, gif, webp)
- description: optional description
```

### Get All Images

```bash
GET /image?page=1&limit=10
```

### Get Image by ID

```bash
GET /image/:id
```

### Get Image File

```bash
GET /image/file/:id
```

### Search Images by Label

```bash
GET /image/search?label=car&confidence=80&page=1&limit=10
```

### Get Available Labels

```bash
GET /image/labels?limit=50&minCount=1
```

### Delete Image

```bash
DELETE /image/:id
```

### Interactive API Documentation

Visit `http://localhost:3000/api/docs` for Swagger UI documentation.

## 🔧 Features

### ✅ Core Functionality

- **Image Upload**: multi-format image upload with validation
- **Automatic Recognition**: AWS Rekognition integration
- **Label Search**: search images by detected objects
- **Pagination**: efficient pagination for all endpoints
- **Type Safety**: full TypeScript implementation
- **Error Handling**: comprehensive error handling and logging

### ✅ Quality & Security

- **Input Validation**: class-validator for request validation
- **Rate Limiting**: configurable rate limiting
- **File Validation**: MIME type and size validation
- **API Documentation**: OpenAPI/Swagger documentation

### ✅ Development Experience

- **Hot Reload**: development mode with automatic restart
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks
- **Testing**: Jest unit and integration tests
- **Type Checking**: full TypeScript coverage

## 🧪 Testing

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Generate coverage report
pnpm run test:coverage
```

## 🚢 Deployment

### Docker

The application includes a comprehensive Docker setup with multi-stage builds, pnpm optimization, and development/production environments.

### Quick Start with Docker

```bash
# Build optimized image (~150MB)
pnpm docker:build

# Start production environment
pnpm docker:up

# Scale application horizontally
docker-compose up --scale app=3 -d
```

#### Container Management

```bash
# View logs
docker-compose logs -f app-dev

# Execute commands in container
docker-compose exec app-dev sh

# Stop services
pnpm docker:down

# Complete cleanup (containers, images, volumes)
pnpm docker:clean
```

#### Docker Environment Setup

Create environment files for different stages:

```bash
# Development
cp .env.example .env.development

# Production
cp .env.example .env.production

# Use specific environment
docker-compose --env-file .env.production up app
```

### AWS Deployment

Quick deployment overview:

1. **ECR Repository**: create and push Docker images to ECR
2. **ECS Infrastructure**: set up Fargate cluster with Application Load Balancer
3. **Auto Scaling**: configure automatic scaling based on CPU/memory
4. **Monitoring**: CloudWatch alarms and logging
