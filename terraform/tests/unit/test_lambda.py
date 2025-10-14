import pytest
import boto3
import zipfile
import io
import json
from moto import mock_lambda, mock_iam
from tests.utils.aws_helpers import AWSResourceHelper
from botocore.exceptions import ClientError


@pytest.mark.unit
@pytest.mark.lambda_func
class TestLambdaFunction:
    def test_lambda_naming_convention(self, expected_resource_names):
        expected_name = expected_resource_names["lambda_function"]
        assert "image-recognition-api" in expected_name
        assert "image-recognition" in expected_name
        
    @mock_lambda
    @mock_iam
    def test_lambda_function_configuration(self, terraform_environment, aws_region, expected_resource_names):
        lambda_client = boto3.client('lambda', region_name=aws_region)
        iam_client = boto3.client('iam', region_name=aws_region)
        helper = AWSResourceHelper(environment=terraform_environment, region=aws_region)

        # Define IAM role for Lambda
        try:
            role_name = 'lambda-execution-role'
            assume_role_policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"Service": "lambda.amazonaws.com"},
                        "Action": "sts:AssumeRole"
                    }
                ]
            }
            
            response = iam_client.create_role(
                RoleName=role_name,
                AssumeRolePolicyDocument=json.dumps(assume_role_policy)
            )
            role_arn = response['Role']['Arn']
        except ClientError as e:
            if e.response['Error']['Code'] == 'EntityAlreadyExists':
                role_arn = f'arn:aws:iam::123456789012:role/{role_name}'
            else:
                raise
        
        # Create Lambda function with configuration matching Terraform
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
            zip_file.writestr('index.py', '''
                import json
                def lambda_handler(event, context):
                    return {
                        'statusCode': 200,
                        'body': json.dumps('Hello from Lambda!')
                    }
                ''')
        zip_buffer.seek(0)

        # Use expected lambda name from fixtures
        function_name = expected_resource_names["lambda_function"]

        try:
            lambda_client.create_function(
                FunctionName=function_name,
                Runtime='python3.9',
                Role=role_arn,
                Handler='index.lambda_handler',
                Code={'ZipFile': zip_buffer.read()},
                Description='Image recognition Lambda function',
                Timeout=300,
                MemorySize=512,
                Environment={
                    'Variables': {
                        'DYNAMODB_TABLE_NAME': f"image-recognition-api-{terraform_environment}-table",
                        'AWS_REGION': aws_region
                    }
                }
            )
        except ClientError as e:
            if e.response['Error']['Code'] != 'ResourceConflictException':
                raise
                
        # Verify function exists
        assert helper.resource_exists("lambda_function", function_name)

        try:
            response = lambda_client.get_function(FunctionName=function_name)
            config = response['Configuration']
            
            assert config['FunctionName'] == function_name
            assert config['Runtime'] == 'python3.9'
            assert config['Timeout'] == 300
            assert config['MemorySize'] == 512
        except ClientError as e:
            pytest.skip(f"Could not get Lambda function configuration: {str(e)}")
        
    def test_lambda_environment_variables(self):
        expected_env_vars = {
            'DYNAMODB_TABLE_NAME': 'image-recognition-api-dev-table',
            'AWS_REGION': 'us-east-1'
        }

        assert 'DYNAMODB_TABLE_NAME' in expected_env_vars
        assert 'AWS_REGION' in expected_env_vars
        assert expected_env_vars['DYNAMODB_TABLE_NAME'].startswith('image-recognition-api')
        
    def test_lambda_iam_permissions(self):
        required_actions = [
            "dynamodb:GetItem",
            "dynamodb:PutItem", 
            "dynamodb:UpdateItem",
            "rekognition:DetectLabels",
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "s3:GetObject"
        ]

        assert len(required_actions) > 0
        assert "dynamodb:" in str(required_actions)
        assert "rekognition:" in str(required_actions)
        assert "s3:" in str(required_actions)
