"""
Test fixtures for Terraform outputs and configurations
"""
import pytest
import os
import json
import subprocess
from typing import Dict, Any, Optional


@pytest.fixture(scope="session")
def terraform_environment() -> str:
    """Get the Terraform environment from environment variable or default to dev"""
    return os.getenv("TF_ENVIRONMENT", "dev")


@pytest.fixture(scope="session")
def aws_region() -> str:
    """Get the AWS region from environment variable or default"""
    return os.getenv("AWS_REGION", "us-east-1")


@pytest.fixture(scope="session")
def project_name() -> str:
    """Get the project name"""
    return "image-recognition-api"


@pytest.fixture(scope="session")
def terraform_outputs(terraform_environment: str) -> Dict[str, Any]:
    """
    Get Terraform outputs from the specified environment
    This fixture runs terraform output command to get actual deployed resources
    """
    terraform_dir = f"../tf-{terraform_environment}"
    
    try:
        # Change to terraform directory and get outputs
        result = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=terraform_dir,
            capture_output=True,
            text=True,
            check=True
        )
        
        outputs = json.loads(result.stdout)
        
        # Extract values from Terraform output format
        extracted_outputs = {}
        for key, value in outputs.items():
            extracted_outputs[key] = value.get("value")
        
        return extracted_outputs
    
    except subprocess.CalledProcessError as e:
        pytest.skip(f"Failed to get Terraform outputs: {e}")
    except json.JSONDecodeError as e:
        pytest.skip(f"Failed to parse Terraform outputs JSON: {e}")
    except Exception as e:
        pytest.skip(f"Unexpected error getting Terraform outputs: {e}")


@pytest.fixture(scope="session")
def expected_resource_names(terraform_environment: str, project_name: str) -> Dict[str, str]:
    """Generate expected resource names based on naming convention"""
    return {
        "s3_bucket": f"{project_name}-{terraform_environment}-images",
        "dynamodb_table": f"{project_name}-{terraform_environment}-images",
        "sns_topic": f"{project_name}-{terraform_environment}-image-notifications",
        "sqs_queue": f"{project_name}-{terraform_environment}-image-processing",
        "lambda_function": f"{project_name}-{terraform_environment}-image-processor",
        "ecs_cluster": f"{project_name}-{terraform_environment}-cluster",
        "ecs_service": f"{project_name}-{terraform_environment}-service",
        "alb": f"{project_name}-{terraform_environment}-alb",
        "target_group": f"{project_name}-{terraform_environment}-tg"
    }


@pytest.fixture
def mock_terraform_outputs():
    """Mock Terraform outputs for testing without actual infrastructure"""
    return {
        "s3_bucket_name": {
            "value": "image-recognition-api-dev-images-abc123"
        },
        "dynamodb_table_name": {
            "value": "image-recognition-api-dev-images"
        },
        "sns_topic_arn": {
            "value": "arn:aws:sns:us-east-1:123456789012:image-recognition-api-dev-image-notifications"
        },
        "sqs_queue_arn": {
            "value": "arn:aws:sqs:us-east-1:123456789012:image-recognition-api-dev-image-processing"
        },
        "ecs_cluster_name": {
            "value": "image-recognition-api-dev-cluster"
        },
        "alb_dns_name": {
            "value": "image-recognition-api-dev-alb-123456789.us-east-1.elb.amazonaws.com"
        }
    }
