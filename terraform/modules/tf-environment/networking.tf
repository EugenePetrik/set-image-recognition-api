# Get default VPC
data "aws_vpc" "default" {
  default = true
}

# Get default subnets
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_subnet" "default" {
  for_each = toset(data.aws_subnets.default.ids)
  id       = each.value
}

locals {
  public_subnet_ids  = data.aws_subnets.default.ids
  private_subnet_ids = data.aws_subnets.default.ids
}

# Security Group for VPC Endpoints
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${local.name_prefix}-vpc-endpoints-"
  description = "Security group for VPC endpoints"
  vpc_id      = data.aws_vpc.default.id

  # Allow HTTPS traffic from VPC (VPC endpoints use HTTPS)
  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }

  # Restrict outbound traffic
  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }

  tags = merge(var.common_tags, {
    Name    = "${local.name_prefix}-vpc-endpoints-sg"
    Type    = "Security Group"
    Purpose = "vpc-endpoints-access"
  })
}

# S3 VPC Endpoint (Gateway endpoint)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = data.aws_vpc.default.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = data.aws_route_tables.default.ids

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          "*"
        ]
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name    = "${local.name_prefix}-s3-endpoint"
    Type    = "VPC Endpoint"
    Service = "S3"
  })
}

# Get default route tables for S3 endpoint
data "aws_route_tables" "default" {
  vpc_id = data.aws_vpc.default.id
}

# ECR API VPC Endpoint (Interface endpoint)
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id             = data.aws_vpc.default.id
  service_name       = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = data.aws_subnets.default.ids
  security_group_ids = [aws_security_group.vpc_endpoints.id]

  private_dns_enabled = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetRepositoryPolicy",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:DescribeImages",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name    = "${local.name_prefix}-ecr-api-endpoint"
    Type    = "VPC Endpoint"
    Service = "ECR API"
  })
}

# ECR DKR VPC Endpoint (Interface endpoint)
resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id             = data.aws_vpc.default.id
  service_name       = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = data.aws_subnets.default.ids
  security_group_ids = [aws_security_group.vpc_endpoints.id]

  private_dns_enabled = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name    = "${local.name_prefix}-ecr-dkr-endpoint"
    Type    = "VPC Endpoint"
    Service = "ECR DKR"
  })
}

# DynamoDB VPC Endpoint (Gateway endpoint)
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = data.aws_vpc.default.id
  service_name      = "com.amazonaws.${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = data.aws_route_tables.default.ids

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:DescribeTable",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = [
          aws_dynamodb_table.image_recognition_table.arn,
          "${aws_dynamodb_table.image_recognition_table.arn}/index/*",
          "${aws_dynamodb_table.image_recognition_table.arn}/stream/*"
        ]
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name    = "${local.name_prefix}-dynamodb-endpoint"
    Type    = "VPC Endpoint"
    Service = "DynamoDB"
  })
}

# CloudWatch Logs VPC Endpoint (Interface endpoint)
resource "aws_vpc_endpoint" "logs" {
  vpc_id             = data.aws_vpc.default.id
  service_name       = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = data.aws_subnets.default.ids
  security_group_ids = [aws_security_group.vpc_endpoints.id]

  private_dns_enabled = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutRetentionPolicy"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name    = "${local.name_prefix}-logs-endpoint"
    Type    = "VPC Endpoint"
    Service = "CloudWatch Logs"
  })
}

# Security Group for Application Load Balancer
resource "aws_security_group" "alb" {
  name_prefix = "${local.name_prefix}-alb-"
  description = "Security group for Application Load Balancer"
  vpc_id      = data.aws_vpc.default.id

  # Allow inbound HTTP traffic from internet
  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name    = "${local.name_prefix}-alb-sg"
    Type    = "Security Group"
    Purpose = "application-load-balancer"
  })
}

# Security Group for Lambda Functions
resource "aws_security_group" "lambda" {
  name_prefix = "${local.name_prefix}-lambda-"
  description = "Security group for Lambda functions"
  vpc_id      = data.aws_vpc.default.id

  egress {
    description = "HTTPS to AWS services"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS resolution"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name    = "${local.name_prefix}-lambda-sg"
    Type    = "Security Group"
    Purpose = "lambda-functions"
  })
}
