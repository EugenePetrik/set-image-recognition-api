# Lambda function configuration

# Create ZIP archive of Lambda function code
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda-function.zip"
}

# IAM role for Lambda function
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-lambda-role"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# IAM policy for Lambda function
resource "aws_iam_policy" "lambda_policy" {
  name        = "${var.project_name}-${var.environment}-lambda-policy"
  description = "IAM policy for image recognition Lambda function"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AmazonRekognitionReadOnlyAccess"
        Effect = "Allow"
        Action = [
          "rekognition:CompareFaces",
          "rekognition:DetectFaces",
          "rekognition:DetectLabels",
          "rekognition:ListCollections",
          "rekognition:ListFaces",
          "rekognition:SearchFaces",
          "rekognition:SearchFacesByImage",
          "rekognition:DetectText",
          "rekognition:GetCelebrityInfo",
          "rekognition:RecognizeCelebrities",
          "rekognition:DetectModerationLabels",
          "rekognition:GetLabelDetection",
          "rekognition:GetFaceDetection",
          "rekognition:GetContentModeration",
          "rekognition:GetPersonTracking",
          "rekognition:GetCelebrityRecognition",
          "rekognition:GetFaceSearch",
          "rekognition:GetTextDetection",
          "rekognition:GetSegmentDetection",
          "rekognition:DescribeStreamProcessor",
          "rekognition:ListStreamProcessors",
          "rekognition:DescribeProjects",
          "rekognition:DescribeProjectVersions",
          "rekognition:DetectCustomLabels",
          "rekognition:DetectProtectiveEquipment",
          "rekognition:ListTagsForResource",
          "rekognition:ListDatasetEntries",
          "rekognition:ListDatasetLabels",
          "rekognition:DescribeDataset",
          "rekognition:ListProjectPolicies",
          "rekognition:ListUsers",
          "rekognition:SearchUsers",
          "rekognition:SearchUsersByImage",
          "rekognition:GetMediaAnalysisJob",
          "rekognition:ListMediaAnalysisJobs"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:*"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${var.s3_bucket_arn}/*",
          "${var.s3_bucket_arn}/"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-lambda-policy"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  policy_arn = aws_iam_policy.lambda_policy.arn
  role       = aws_iam_role.lambda_role.name
}

# Lambda function
resource "aws_lambda_function" "image_recognition" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-${var.environment}-image-recognition"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.lambda_handler"
  runtime          = "python3.9"
  timeout          = 300
  memory_size      = 512
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      AWS_DYNAMODB_TABLE_NAME = var.dynamodb_table_name
      LOG_LEVEL               = "INFO"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy_attachment,
    aws_cloudwatch_log_group.lambda_logs,
  ]

  tags = {
    Name        = "${var.project_name}-${var.environment}-image-recognition"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-image-recognition"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-${var.environment}-lambda-logs"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Lambda Event Source Mapping for SQS
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn                   = var.sqs_queue_arn
  function_name                      = aws_lambda_function.image_recognition.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5

  depends_on = [aws_lambda_function.image_recognition]
}
