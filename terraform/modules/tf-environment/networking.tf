data "aws_availability_zones" "available" {
  state = "available"
}

######################
# Core VPC resources
######################
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-vpc"
    Environment = var.environment
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-igw"
    Environment = var.environment
  })
}

########################
# Public subnets / RTB
########################
resource "aws_subnet" "public" {
  for_each                = var.public_subnet_cidrs
  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value
  availability_zone       = "${var.aws_region}${each.key}"
  map_public_ip_on_launch = true

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-public-${each.key}"
    Environment = var.environment
    Tier        = "public"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-public-rt"
    Environment = var.environment
    Tier        = "public"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

#############################
# Private subnets / RTB / NAT
#############################
resource "aws_subnet" "private" {
  for_each                = var.private_subnet_cidrs
  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value
  availability_zone       = "${var.aws_region}${each.key}"
  map_public_ip_on_launch = false

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-private-${each.key}"
    Environment = var.environment
    Tier        = "private"
  })
}

resource "aws_eip" "nat" {
  for_each   = aws_subnet.public
  domain     = "vpc"
  depends_on = [aws_internet_gateway.this]

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-nat-eip-${each.key}"
    Environment = var.environment
  })
}

resource "aws_nat_gateway" "this" {
  for_each       = aws_subnet.public
  allocation_id  = aws_eip.nat[each.key].id
  subnet_id      = each.value.id
  connectivity_type = "public"

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-nat-${each.key}"
    Environment = var.environment
  })
}

resource "aws_route_table" "private" {
  for_each = aws_subnet.private
  vpc_id   = aws_vpc.this.id

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-private-rt-${each.key}"
    Environment = var.environment
    Tier        = "private"
  })
}

resource "aws_route" "private_to_internet" {
  for_each               = aws_route_table.private
  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[each.key].id
}

resource "aws_route_table_association" "private" {
  for_each       = aws_subnet.private
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[each.key].id
}

####################################
# Security groups (ALB / Lambda / VPCE)
####################################
resource "aws_security_group" "alb" {
  name_prefix = "${local.name_prefix}-alb-"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-alb-sg"
    Environment = var.environment
    Purpose     = "application-load-balancer"
  })
}

resource "aws_security_group" "lambda" {
  name_prefix = "${local.name_prefix}-lambda-"
  description = "Security group for Lambda functions"
  vpc_id      = aws_vpc.this.id

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
    Name        = "${local.name_prefix}-lambda-sg"
    Environment = var.environment
    Purpose     = "lambda-functions"
  })
}

resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${local.name_prefix}-vpce-"
  description = "Security group for interface VPC endpoints"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr_block]
  }

  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr_block]
  }

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-vpce-sg"
    Environment = var.environment
    Purpose     = "vpc-endpoints-access"
  })
}

####################
# VPC endpoints
####################
locals {
  private_subnet_ids = values(aws_subnet.private)[*].id
  private_route_table_ids = values(aws_route_table.private)[*].id
}

# S3 gateway endpoint
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = local.private_route_table_ids

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ]
      Resource = "*"
    }]
  })

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-s3-endpoint"
    Environment = var.environment
    Service     = "S3"
  })
}

# DynamoDB gateway endpoint
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = local.private_route_table_ids

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
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
      Resource = "*"
    }]
  })

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-dynamodb-endpoint"
    Environment = var.environment
    Service     = "DynamoDB"
  })
}

# Interface endpoints
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = local.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-ecr-api-endpoint"
    Environment = var.environment
    Service     = "ECR API"
  })
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = local.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-ecr-dkr-endpoint"
    Environment = var.environment
    Service     = "ECR DKR"
  })
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = local.private_subnet_ids
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = merge(var.common_tags, {
    Name        = "${local.name_prefix}-logs-endpoint"
    Environment = var.environment
    Service     = "CloudWatch Logs"
  })
}
