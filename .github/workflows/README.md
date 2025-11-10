# 🚀 CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipelines for the Image Recognition API project.

---

## 🎯 Overview

The project uses GitHub Actions for automated CI/CD with the following pipelines:

| Pipeline | Trigger | Purpose |
|----------|---------|---------|
| **CI Pipeline** | Pull Request to `develop` | Runs linting, tests, and Terraform validation |
| **Playwright Tests** | Pull Request to `develop` | Executes API integration tests |
| **Dev Build & Deploy** | Push to `develop` | Builds Docker image and deploys to DEV/QA |
| **Terraform Pipeline** | Manual (`workflow_dispatch`) | Infrastructure provisioning/destruction |
| **Production Deploy** | Manual (`workflow_dispatch`) | Deploys specific docker version to PROD |

---

## 🏗️ Pipeline Architecture

### **Complete CI/CD Flow Diagram**

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEVELOPMENT WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

    Developer creates PR to develop
              ↓
    ┌─────────────────────┐
    │   CI Pipeline       │ ← Automatic
    │  ─────────────────  │
    │  • Linting          │
    │  • Unit Tests       │
    │  • Coverage Check   │
    │  • Terraform Lint   │
    └─────────────────────┘
              ↓
    ┌─────────────────────┐
    │ Playwright Tests    │ ← Automatic
    │  ─────────────────  │
    │  • API Tests        │
    └─────────────────────┘
              ↓
      PR Approved & Merged to develop
              ↓
    ┌─────────────────────────────────────┐
    │   Dev Build & Deploy                │ ← Automatic
    │  ───────────────────────────────    │
    │  1. Build Docker Image              │
    │  2. Push to ECR                     │
    │  3. Deploy to DEV (automatic)       │
    │  4. Deploy to QA (manual approval)  │
    └─────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE MANAGEMENT                              │
└─────────────────────────────────────────────────────────────────────────────┘

    Manual Trigger via GitHub UI
              ↓
    ┌─────────────────────┐
    │ Terraform Pipeline  │ ← Manual
    │  ─────────────────  │
    │  • Select Env       │
    │    (DEV/QA/PROD)    │
    │  • Select Action    │
    │    (plan/apply/     │
    │     destroy)        │
    │  • Provision/Update │
    │    Infrastructure   │
    └─────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION DEPLOYMENT                               │
└─────────────────────────────────────────────────────────────────────────────┘

    Manual Trigger via GitHub UI
              ↓
    ┌─────────────────────┐
    │  Production Deploy  │ ← Manual
    │  ─────────────────  │
    │  • Specify Version  │
    │    (e.g., v1.42)    │
    │  • Deploy to PROD   │
    │  • Wait for         │
    │    Stability        │
    └─────────────────────┘
```

---

## 📦 Workflows

### **1. CI Pipeline** (`ci-pipeline.yml`)

**Trigger:** Pull Request to `develop` branch

**Jobs:**

- ✅ **Linting**: Runs ESLint, Prettier checks
- ✅ **Unit Tests**: Executes Jest tests with coverage
- ✅ **Terraform Validation**: Validates Terraform configs

**Flow Diagram:**

```text
    PR Created/Updated to develop
         ↓
    ┌────────────────────────────┐
    │  Job 1: Lint               │
    │  ────────────────────────  │
    │  • Checkout code           │
    │  • Setup pnpm + Node       │
    │  • Run quality:check       │
    └────────────────────────────┘
         ↓
    ┌────────────────────────────┐
    │  Job 2: Test               │
    │  ────────────────────────  │
    │  • Checkout code           │
    │  • Setup pnpm + Node       │
    │  • Run test:coverage       │
    │  • Check 80% threshold     │
    │  • Upload to Codecov       │
    │  • Comment PR with results │
    └────────────────────────────┘
         ↓
    ┌────────────────────────────┐
    │  Job 3: Terraform Lint     │
    │  ────────────────────────  │
    │  • Checkout code           │
    │  • Setup Terraform         │
    │  • Run terraform fmt       │
    │  • Run TFLint              │
    │  • Run Checkov             │
    └────────────────────────────┘
         ↓
    ┌────────────────────────────┐
    │  Job 4: CI Status          │
    │  ────────────────────────  │
    │  • Check all jobs status   │
    │  • Comment PR with summary │
    └────────────────────────────┘
```

**PR Comment Example:**

```markdown
## 🔍 CI Pipeline Results

**Status:** ✅ PASSED (3/3)

| Check | Status |
|-------|--------|
| lint | ✅ success |
| test | ✅ success |
| terraform | ✅ success |
```

---

### **2. Playwright API Tests** (`playwright-tests.yml`)

**Trigger:**

- Push to `develop`
- Pull Request to `develop`

**Purpose:** Run integration tests against deployed API

**Flow Diagram:**

```text
    Push/PR to develop
         ↓
    ┌────────────────────────────────────┐
    │  Set API Base URL                  │
    │  ────────────────────────────────  │
    │  Branch = develop → DEV API URL    │
    │  Branch = qa → QA API URL          │
    └────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────┐
    │  Setup Environment                 │
    │  ────────────────────────────────  │
    │  • Install pnpm                    │
    │  • Install Node.js                 │
    │  • Install dependencies            │
    │  • Install Playwright              │
    └────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────┐
    │  Run API Tests                     │
    │  ────────────────────────────────  │
    │  • Health checks                   │
    │  • Image upload tests              │
    │  • Image retrieval tests           │
    │  • Search tests                    │
    │  • Delete tests                    │
    └────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────┐
    │  Upload Results                    │
    │  ────────────────────────────────  │
    │  • Playwright HTML report          │
    │  • JUnit XML results               │
    │  • Comment PR with summary         │
    └────────────────────────────────────┘
```

**Environment Selection:**

| Branch | API URL Secret Used | Environment |
|--------|---------------------|-------------|
| `develop` | `API_BASE_URL_DEV` | DEV |
| `release` | `API_BASE_URL_QA` | QA |

**PR Comment Example:**

```markdown
## 🎭 Playwright API Tests Results

**Environment:** DEV
**Branch:** feature/new-api
**Commit:** `abc1234`

### 📊 Test Results

| Metric | Count |
|--------|-------|
| Total Tests | 25 |
| ✅ Passed | 24 |
| ❌ Failed | 1 |
| ⏭️ Skipped | 0 |
```

---

### **3. Dev Build & Deploy** (`dev-docker-build-deploy.yml`)

**Trigger:** Push to `develop` branch

**Purpose:** Build Docker image and deploy to DEV → QA environments

**Flow Diagram:**

```text
    Push to develop
         ↓
    ┌────────────────────────────────────────────┐
    │  Job 1: Docker Build                       │
    │  ────────────────────────────────────────  │
    │  • Checkout code                           │
    │  • Configure AWS credentials               │
    │  • Login to ECR                            │
    │  • Build Docker image                      │
    │    Image: {ECR}/image-recognition-api:v1.X │
    │  • Push to ECR                             │
    └────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────┐
    │  Job 2: Deploy DEV (Automatic)             │
    │  ────────────────────────────────────────  │
    │  Environment: Development                  │
    │  • Download ECS task definition            │
    │  • Update task with new image              │
    │  • Deploy to ECS cluster                   │
    │    - Cluster: image-recognition-api-dev    │
    │    - Service: image-recognition-api-dev    │
    │  • Wait for service stability              │
    └────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────┐
    │  Job 3: Deploy QA (Manual Approval)        │
    │  ────────────────────────────────────────  │
    │  Environment: QA                           │
    │  ⏸️  WAITING FOR MANUAL APPROVAL           │
    │  • Download ECS task definition            │
    │  • Update task with new image              │
    │  • Deploy to ECS cluster                   │
    │    - Cluster: image-recognition-api-qa     │
    │    - Service: image-recognition-api-qa     │
    │  • Wait for service stability              │
    └────────────────────────────────────────────┘
```

**Docker Image Versioning:**

```text
Format: v1.{github.run_number}
Example: v1.42, v1.43, v1.44, ...
```

**Deployment Summary Output:**

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ECS Deployment Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cluster: image-recognition-api-dev-cluster
Service: image-recognition-api-dev-service
Image: 123456789.dkr.ecr.us-east-1.amazonaws.com/image-recognition-api:v1.42
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### **4. Terraform Pipeline** (`terraform-pipeline.yml`)

```text
**Trigger:** Manual (`workflow_dispatch`)

**Purpose:** Provision, update, or destroy AWS infrastructure

**Flow Diagram:**

```

```text
    Manual Trigger from GitHub UI
         ↓
    Select Environment: DEV | QA | PROD
    Select Action: plan | apply | destroy
         ↓
    ┌────────────────────────────────────────────┐
    │  Set Environment Variables                 │
    │  ────────────────────────────────────────  │
    │  DEV  → terraform/tf-dev/                  │
    │  QA   → terraform/tf-qa/                   │
    │  PROD → terraform/tf-prod/                 │
    └────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────────┐
    │  Terraform Workflow                        │
    │  ────────────────────────────────────────  │
    │  • Checkout code                           │
    │  • Setup Terraform v1.6.6                  │
    │  • Run terraform fmt -check                │
    │  • Run terraform init                      │
    │  • Run terraform validate                  │
    │  • Run terraform plan                      │
    │       ↓                                    │
    │  If action = "apply":                      │
    │  • Run terraform apply                     │
    │  • Display deployment info                 │
    │       ↓                                    │
    │  If action = "destroy":                    │
    │  • Run terraform destroy                   │
    └────────────────────────────────────────────┘
```

**Manual Workflow Inputs:**

| Input | Type | Options | Default |
|-------|------|---------|---------|
| `environment` | choice | DEV, QA, PROD | DEV |
| `terraform-action` | choice | plan, apply, destroy | apply |

**Usage Examples:**

**Deploy DEV Infrastructure:**

```bash
1. Go to Actions → Terraform Pipeline
2. Click "Run workflow"
3. Select:
   - Environment: DEV
   - Action: apply
4. Click "Run workflow"
```

**Plan PROD Changes:**

```bash
1. Go to Actions → Terraform Pipeline
2. Click "Run workflow"
3. Select:
   - Environment: PROD
   - Action: plan
4. Review plan output
```

**Destroy QA Environment:**

```bash
1. Go to Actions → Terraform Pipeline
2. Click "Run workflow"
3. Select:
   - Environment: QA
   - Action: destroy
4. Confirm destruction
```

**Deployment Info Output:**

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Terraform Apply Complete - DEV Environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Deployment Information:

  Environment:      dev
  AWS Region:       us-east-1

🔗 Application URLs:
  Application:      http://image-recognition-api-dev-alb-123.us-east-1.elb.amazonaws.com
  Health Check:     http://image-recognition-api-dev-alb-123.us-east-1.elb.amazonaws.com/api/v1/health
  API Docs:         http://image-recognition-api-dev-alb-123.us-east-1.elb.amazonaws.com/api/docs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### **5. Production Deploy** (`prod-deploy.yml`)

**Trigger:** Manual (`workflow_dispatch` - called by other workflows or manual dispatch)

**Purpose:** Deploy a specific Docker image version to PROD

**Flow Diagram:**

```text
    Manual Trigger with Version Input
         ↓
    Input: version (e.g., v1.42)
         ↓
    ┌────────────────────────────────────────────┐
    │  Production Deployment                     │
    │  ────────────────────────────────────────  │
    │  • Checkout code                           │
    │  • Configure AWS credentials               │
    │  • Download ECS task definition            │
    │    Task: image-recognition-api-prod-task   │
    │  • Update task with specified image        │
    │    Image: {ECR}/image-recognition-api:v1.X │
    │  • Deploy to ECS cluster                   │
    │    - Cluster: image-recognition-api-prod   │
    │    - Service: image-recognition-api-prod   │
    │  • Wait for service stability              │
    │  • Display deployment summary              │
    └────────────────────────────────────────────┘
```

---

## 🌊 Environment Flow

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     DEV     │────▶│     QA      │────▶│    PROD     │
│  (Automatic)│     │  (Approval) │     │  (Manual)   │
└─────────────┘     └─────────────┘     └─────────────┘
      ↓                    ↓                    ↓
 Continuous          Manual Gate         Specific
 Deployment          Required            Version
```

### **Environment Characteristics**

| Environment | Trigger | Approval | Purpose |
|-------------|---------|----------|---------|
| **DEV** | Automatic on merge to `develop` | ❌ None | Development and testing |
| **QA** | Automatic after DEV | ✅ Required | QA testing and validation |
| **PROD** | Manual | ✅ Required | Production environment |

---

## 🌳 Branch Strategy

```text
main (production)
  ↑
  │ Manual promotion
  │
release (QA)
  ↑
  │ Automatic deployment
  │
develop (DEV)
  ↑
  │ PR + CI checks
  │
feature/* branches
```

### **Branch Flow**

1. **Feature Development**

   ```bash
   git checkout -b feature/new-api
   # Make changes
   git push origin feature/new-api
   # Create PR to develop
   ```

2. **CI Pipeline Runs**
   - Linting
   - Unit tests
   - Terraform validation
   - API tests

3. **Merge to Develop**
   - Triggers Dev Build & Deploy
   - Deploys to DEV automatically
   - Requires approval for QA

4. **Promote to Release**

   ```bash
   git checkout release
   git merge develop
   git push origin release
   ```

5. **Promote to Production**
   - Manually trigger Production Deploy
   - Specify tested version from QA

---

## 🔐 Required Secrets

Configure these secrets in GitHub repository settings:

### **AWS Credentials**

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCOUNT_ID` | AWS account ID | `123456789012` |
| `ECR_REPOSITORY` | ECR repository name | `image-recognition-api` |

### **API Base URLs**

| Secret | Description | Example |
|--------|-------------|---------|
| `API_BASE_URL_DEV` | DEV API URL | `http://dev-alb-123.us-east-1.elb.amazonaws.com` |
| `API_BASE_URL_QA` | QA API URL | `http://qa-alb-456.us-east-1.elb.amazonaws.com` |
| `API_BASE_URL_PROD` | PROD API URL | `http://prod-alb-789.us-east-1.elb.amazonaws.com` |

---

## 🚀 Deployment Process

### **Full Deployment Workflow**

```text
┌─────────────────────────────────────────────────────────────────┐
│                  Step 1: Infrastructure Setup                    │
└─────────────────────────────────────────────────────────────────┘
    Manually run Terraform Pipeline
    • Environment: DEV
    • Action: apply
    ↓ Creates: VPC, ECS Cluster, ALB, S3, DynamoDB, etc.


┌─────────────────────────────────────────────────────────────────┐
│                  Step 2: Application Development                 │
└─────────────────────────────────────────────────────────────────┘
    Developer creates feature branch
    • Implement changes
    • Create PR to develop
    ↓ Triggers: CI Pipeline + Playwright Tests


┌─────────────────────────────────────────────────────────────────┐
│                  Step 3: DEV Deployment                          │
└─────────────────────────────────────────────────────────────────┘
    PR merged to develop
    ↓ Automatic: Dev Build & Deploy workflow
    • Builds Docker image (v1.X)
    • Pushes to ECR
    • Deploys to DEV environment
    ↓ DEV is now running v1.X


┌─────────────────────────────────────────────────────────────────┐
│                  Step 4: QA Deployment                           │
└─────────────────────────────────────────────────────────────────┘
    Manual approval required
    ↓ Approve deployment in GitHub Actions
    • Deploys same image (v1.X) to QA
    ↓ QA team tests application


┌─────────────────────────────────────────────────────────────────┐
│                  Step 5: Production Deployment                   │
└─────────────────────────────────────────────────────────────────┘
    Manually trigger Production Deploy
    • Specify version: v1.X
    ↓ Deploys to PROD environment
    ↓ PROD is now running v1.X
```

### **Quick Deployment Guide**

#### **Deploy New Feature to DEV**

```bash
# No manual steps needed!
# Just merge PR to develop branch
git checkout develop
git merge feature/new-api
git push origin develop
# ✅ Automatic deployment to DEV
```

#### **Deploy to QA**

```bash
# After DEV deployment succeeds:
1. Go to Actions → Latest "Build and Deploy DEV" run
2. Click "Review deployments" for QA job
3. Click "Approve and deploy"
# ✅ Deploys to QA
```

#### **Deploy to PROD**

```bash
# After QA testing complete:
1. Go to Actions → Production Deploy
2. Click "Run workflow"
3. Enter version (e.g., v1.42)
4. Click "Run workflow"
# ✅ Deploys to PROD
```

#### **Update Infrastructure**

```bash
# For any environment:
1. Go to Actions → Terraform Pipeline
2. Click "Run workflow"
3. Select:
   - Environment: DEV/QA/PROD
   - Action: apply
4. Click "Run workflow"
# ✅ Updates infrastructure
```
