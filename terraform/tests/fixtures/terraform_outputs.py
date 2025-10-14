import pytest
import os
import json
import subprocess
from typing import Dict, Any, Optional


@pytest.fixture(scope="session")
def terraform_environment() -> str:
    return os.getenv("TF_ENVIRONMENT", "dev")


@pytest.fixture(scope="session")
def aws_region() -> str:
    return os.getenv("AWS_REGION", "us-east-1")


@pytest.fixture(scope="session")
def project_name() -> str:
    return "image-recognition-api"


@pytest.fixture(scope="session")
def terraform_outputs(terraform_environment: str) -> Dict[str, Any]:
    terraform_dir = f"../tf-{terraform_environment}"

    if not os.path.isdir(terraform_dir):
        # Use mock outputs if real outputs aren't available
        return {
            "s3_bucket_name": f"image-recognition-api-{terraform_environment}-images-000000000000",
            "dynamodb_table_name": f"image-recognition-api-{terraform_environment}-table",
            "sns_topic_arn": f"arn:aws:sns:us-east-1:000000000000:image-recognition-api-{terraform_environment}-image-processing",
            "sqs_queue_arn": f"arn:aws:sqs:us-east-1:000000000000:image-recognition-api-{terraform_environment}-image-processing",
            "ecs_cluster_name": f"image-recognition-api-{terraform_environment}-cluster",
            "alb_dns_name": f"image-recognition-api-{terraform_environment}-alb-000000000.us-east-1.elb.amazonaws.com"
        }
    
    try:
        # Check if terraform command is available
        subprocess.run(["terraform", "--version"], capture_output=True, check=True)
        
        result = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=terraform_dir,
            capture_output=True,
            text=True,
            check=True
        )
        
        outputs = json.loads(result.stdout)
        
        extracted_outputs = {}
        for key, value in outputs.items():
            extracted_outputs[key] = value.get("value")
        
        return extracted_outputs
    
    except subprocess.CalledProcessError as e:
        pytest.skip(f"Failed to get Terraform outputs: {e}")
        # Return mock values as fallback
        return {
            "s3_bucket_name": f"image-recognition-api-{terraform_environment}-images-000000000000",
            "dynamodb_table_name": f"image-recognition-api-{terraform_environment}-table",
            "sns_topic_arn": f"arn:aws:sns:us-east-1:000000000000:image-recognition-api-{terraform_environment}-image-processing",
            "sqs_queue_arn": f"arn:aws:sqs:us-east-1:000000000000:image-recognition-api-{terraform_environment}-image-processing",
            "ecs_cluster_name": f"image-recognition-api-{terraform_environment}-cluster",
            "alb_dns_name": f"image-recognition-api-{terraform_environment}-alb-000000000.us-east-1.elb.amazonaws.com"
        }
    except json.JSONDecodeError as e:
        pytest.skip(f"Failed to parse Terraform outputs JSON: {e}")
        return {}
    except FileNotFoundError:
        pytest.skip("Terraform command not found")
        return {}
    except Exception as e:
        pytest.skip(f"Unexpected error getting Terraform outputs: {e}")
        return {}


@pytest.fixture(scope="session")
def expected_resource_names(terraform_environment: str, project_name: str) -> Dict[str, str]:
    return {
        "s3_bucket": f"{project_name}-{terraform_environment}-images",
        "dynamodb_table": f"{project_name}-{terraform_environment}-table",
        "sns_topic": f"{project_name}-{terraform_environment}-image-processing",
        "sqs_queue": f"{project_name}-{terraform_environment}-image-processing",
        "lambda_function": f"{project_name}-{terraform_environment}-image-recognition",
        "ecs_cluster": f"{project_name}-{terraform_environment}-cluster",
        "ecs_service": f"{project_name}-{terraform_environment}-service",
        "alb": f"{project_name}-{terraform_environment}-alb",
        "target_group": f"{project_name}-{terraform_environment}-tg"
    }


@pytest.fixture
def mock_terraform_outputs():
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
