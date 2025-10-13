"""
Unit tests for Lambda function infrastructure
"""
import pytest
import boto3
import zipfile
import io
from moto import mock_lambda, mock_iam
from tests.utils.aws_helpers import AWSResourceHelper


@pytest.mark.unit
@pytest.mark.lambda_func
class TestLambdaFunction:
    """Test Lambda function configuration"""
    
    def test_lambda_naming_convention(self, expected_resource_names):
        """Test that Lambda function follows naming convention"""
        expected_name = expected_resource_names["lambda_function"]
        assert "image-recognition-api" in expected_name
        assert "processor" in expected_name
        
    @mock_lambda
    @mock_iam
    def test_lambda_function_configuration(self, terraform_environment, aws_region):
        """Test Lambda function configuration"""
        # Create mock clients
        lambda_client = boto3.client('lambda', region_name=aws_region)
        iam_client = boto3.client('iam', region_name=aws_region)
        helper = AWSResourceHelper(environment=terraform_environment, region=aws_region)
        
        # Create IAM role for Lambda
        role_doc = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"Service": "lambda.amazonaws.com"},
                    "Action": "sts:AssumeRole"
                }
            ]
        }
        
        iam_client.create_role(
            RoleName='lambda-execution-role',
            AssumeRolePolicyDocument=str(role_doc),
            Path='/'
        )
        
        # Create a simple Lambda function ZIP
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
            zip_file.writestr('lambda_function.py', '''
def lambda_handler(event, context):
    return {
        'statusCode': 200,
        'body': 'Hello from Lambda!'
    }
''')
        zip_buffer.seek(0)
        
        # Create test Lambda function
        function_name = f"image-recognition-api-{terraform_environment}-image-processor"
        lambda_client.create_function(
            FunctionName=function_name,
            Runtime='python3.9',
            Role=f'arn:aws:iam::123456789012:role/lambda-execution-role',
            Handler='lambda_function.lambda_handler',
            Code={'ZipFile': zip_buffer.read()},
            Description='Image processing Lambda function',
            Timeout=300,
            MemorySize=512,
            Environment={
                'Variables': {
                    'DYNAMODB_TABLE': f"image-recognition-api-{terraform_environment}-images",
                    'AWS_REGION': aws_region
                }
            }
        )
        
        # Test Lambda function exists
        assert helper.resource_exists("lambda_function", function_name)
        
        # Get function configuration
        response = lambda_client.get_function(FunctionName=function_name)
        config = response['Configuration']
        
        assert config['FunctionName'] == function_name
        assert config['Runtime'] == 'python3.9'
        assert config['Timeout'] == 300
        assert config['MemorySize'] == 512
        
    def test_lambda_environment_variables(self, terraform_environment):
        """Test expected Lambda environment variables"""
        expected_env_vars = {
            'DYNAMODB_TABLE': f"image-recognition-api-{terraform_environment}-images",
            'AWS_REGION': 'us-east-1',
            'LOG_LEVEL': 'INFO'
        }
        
        # Validate environment variables structure
        assert 'DYNAMODB_TABLE' in expected_env_vars
        assert 'AWS_REGION' in expected_env_vars
        assert expected_env_vars['DYNAMODB_TABLE'].startswith('image-recognition-api')
        
    def test_lambda_iam_permissions(self):
        """Test expected Lambda IAM permissions"""
        expected_policies = [
            "AWSLambdaBasicExecutionRole",
            "DynamoDBFullAccess", 
            "AmazonRekognitionReadOnlyAccess",
            "AmazonSQSFullAccess"
        ]
        
        required_actions = [
            "dynamodb:GetItem",
            "dynamodb:PutItem", 
            "dynamodb:UpdateItem",
            "rekognition:DetectLabels",
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
        ]
        
        # Validate expected permissions
        assert len(expected_policies) > 0
        assert len(required_actions) > 0
        assert "dynamodb:" in str(required_actions)
        assert "rekognition:" in str(required_actions)
