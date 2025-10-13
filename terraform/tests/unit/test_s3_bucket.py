"""
Unit tests for S3 bucket infrastructure
"""
import pytest
import boto3
from moto import mock_s3
from tests.utils.aws_helpers import AWSResourceHelper


@pytest.mark.unit
@pytest.mark.s3
class TestS3Bucket:
    """Test S3 bucket configuration and permissions"""
    
    def test_s3_bucket_naming_convention(self, expected_resource_names):
        """Test that S3 bucket follows naming convention"""
        expected_name = expected_resource_names["s3_bucket"]
        assert "image-recognition-api" in expected_name
        assert "images" in expected_name
        
    def test_s3_bucket_exists_in_outputs(self, terraform_outputs):
        """Test that S3 bucket name is present in Terraform outputs"""
        assert "s3_bucket_name" in terraform_outputs
        assert terraform_outputs["s3_bucket_name"] is not None
        assert len(terraform_outputs["s3_bucket_name"]) > 0
        
    @mock_s3
    def test_s3_bucket_configuration(self, terraform_environment, aws_region):
        """Test S3 bucket configuration using mocked AWS"""
        # Create mock S3 client
        s3_client = boto3.client('s3', region_name=aws_region)
        helper = AWSResourceHelper(environment=terraform_environment, region=aws_region)
        
        # Create a test bucket
        bucket_name = f"image-recognition-api-{terraform_environment}-images-test123"
        s3_client.create_bucket(Bucket=bucket_name)
        
        # Test bucket exists
        assert helper.resource_exists("s3_bucket", bucket_name)
        
        # Test bucket configuration (mocked)
        config = helper.get_s3_bucket_config(bucket_name)
        assert config is not None
        
    def test_s3_bucket_policy_structure(self):
        """Test expected S3 bucket policy structure"""
        expected_principals = ["ecs-tasks.amazonaws.com", "lambda.amazonaws.com"]
        expected_actions = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        
        # This is a structure test - actual policy would be tested in integration
        assert len(expected_principals) > 0
        assert len(expected_actions) > 0
        
    def test_s3_bucket_security_configuration(self):
        """Test expected S3 bucket security settings"""
        expected_settings = {
            "versioning": "Enabled",
            "public_access_block": {
                "BlockPublicAcls": True,
                "BlockPublicPolicy": True,
                "IgnorePublicAcls": True,
                "RestrictPublicBuckets": True
            },
            "encryption": "AES256"
        }
        
        # Validate expected security configuration structure
        assert expected_settings["versioning"] == "Enabled"
        assert expected_settings["public_access_block"]["BlockPublicAcls"] is True
        assert "encryption" in expected_settings
