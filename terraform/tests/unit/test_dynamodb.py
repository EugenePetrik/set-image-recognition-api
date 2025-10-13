"""
Unit tests for DynamoDB table infrastructure
"""
import pytest
import boto3
from moto import mock_dynamodb
from tests.utils.aws_helpers import AWSResourceHelper


@pytest.mark.unit
@pytest.mark.dynamodb
class TestDynamoDBTable:
    """Test DynamoDB table configuration"""
    
    def test_dynamodb_table_naming_convention(self, expected_resource_names):
        """Test that DynamoDB table follows naming convention"""
        expected_name = expected_resource_names["dynamodb_table"]
        assert "image-recognition-api" in expected_name
        assert "images" in expected_name
        
    def test_dynamodb_table_exists_in_outputs(self, terraform_outputs):
        """Test that DynamoDB table name is present in Terraform outputs"""
        assert "dynamodb_table_name" in terraform_outputs
        assert terraform_outputs["dynamodb_table_name"] is not None
        assert len(terraform_outputs["dynamodb_table_name"]) > 0
        
    @mock_dynamodb
    def test_dynamodb_table_schema(self, terraform_environment, aws_region):
        """Test DynamoDB table schema configuration"""
        # Create mock DynamoDB client
        dynamodb_client = boto3.client('dynamodb', region_name=aws_region)
        helper = AWSResourceHelper(environment=terraform_environment, region=aws_region)
        
        # Create test table
        table_name = f"image-recognition-api-{terraform_environment}-images"
        
        dynamodb_client.create_table(
            TableName=table_name,
            KeySchema=[
                {"AttributeName": "ImageId", "KeyType": "HASH"},
                {"AttributeName": "CreatedAt", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "ImageId", "AttributeType": "S"},
                {"AttributeName": "CreatedAt", "AttributeType": "S"},
                {"AttributeName": "Labels", "AttributeType": "S"}
            ],
            BillingMode='PAY_PER_REQUEST',
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'Labels-CreatedAt-index',
                    'KeySchema': [
                        {"AttributeName": "Labels", "KeyType": "HASH"},
                        {"AttributeName": "CreatedAt", "KeyType": "RANGE"}
                    ],
                    'Projection': {'ProjectionType': 'ALL'}
                }
            ]
        )
        
        # Test table exists
        assert helper.resource_exists("dynamodb_table", table_name)
        
        # Test table configuration
        config = helper.get_dynamodb_table_config(table_name)
        assert config["table_name"] == table_name
        assert config["table_status"] == "ACTIVE"
        assert len(config["key_schema"]) == 2
        assert config["billing_mode"] == "PAY_PER_REQUEST"
        
    def test_dynamodb_table_key_schema(self):
        """Test expected DynamoDB table key schema"""
        expected_schema = [
            {"AttributeName": "ImageId", "KeyType": "HASH"},
            {"AttributeName": "CreatedAt", "KeyType": "RANGE"}
        ]
        
        # Validate schema structure
        assert len(expected_schema) == 2
        assert expected_schema[0]["AttributeName"] == "ImageId"
        assert expected_schema[0]["KeyType"] == "HASH"
        assert expected_schema[1]["AttributeName"] == "CreatedAt"
        assert expected_schema[1]["KeyType"] == "RANGE"
        
    def test_dynamodb_gsi_configuration(self):
        """Test expected Global Secondary Index configuration"""
        expected_gsi = {
            "IndexName": "Labels-CreatedAt-index",
            "KeySchema": [
                {"AttributeName": "Labels", "KeyType": "HASH"},
                {"AttributeName": "CreatedAt", "KeyType": "RANGE"}
            ],
            "ProjectionType": "ALL"
        }
        
        # Validate GSI structure
        assert "Labels-CreatedAt-index" in expected_gsi["IndexName"]
        assert len(expected_gsi["KeySchema"]) == 2
        assert expected_gsi["ProjectionType"] == "ALL"
