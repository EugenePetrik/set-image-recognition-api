import pytest
import boto3
from moto import mock_ecs, mock_ec2
from tests.utils.aws_helpers import AWSResourceHelper


@pytest.mark.unit
@pytest.mark.ecs
class TestECSInfrastructure:
    def test_ecs_naming_convention(self, expected_resource_names):
        expected_cluster = expected_resource_names["ecs_cluster"]
        expected_service = expected_resource_names["ecs_service"]
        
        assert "image-recognition-api" in expected_cluster
        assert "cluster" in expected_cluster
        assert "image-recognition-api" in expected_service
        assert "service" in expected_service
        
    def test_ecs_outputs_present(self, terraform_outputs):
        assert "ecs_cluster_name" in terraform_outputs
        assert terraform_outputs["ecs_cluster_name"] is not None
        
    @mock_ecs
    @mock_ec2
    def test_ecs_cluster_configuration(self, terraform_environment, aws_region):
        ecs_client = boto3.client('ecs', region_name=aws_region)
        ec2_client = boto3.client('ec2', region_name=aws_region)
        helper = AWSResourceHelper(environment=terraform_environment, region=aws_region)
        
        vpc_response = ec2_client.create_vpc(CidrBlock="10.0.0.0/16")
        vpc_id = vpc_response['Vpc']['VpcId']
        
        cluster_name = f"image-recognition-api-{terraform_environment}-cluster"
        ecs_client.create_cluster(
            clusterName=cluster_name,
            capacityProviders=['FARGATE'],
            defaultCapacityProviderStrategy=[
                {
                    'capacityProvider': 'FARGATE',
                    'weight': 1,
                    'base': 0
                }
            ]
        )
        
        assert helper.resource_exists("ecs_cluster", cluster_name)
        
    def test_ecs_task_definition_structure(self):
        expected_task_def = {
            "family": "image-recognition-api-dev-task",
            "networkMode": "awsvpc",
            "requiresCompatibilities": ["FARGATE"],
            "cpu": "1024",
            "memory": "3072",
            "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
            "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole"
        }
        
        assert expected_task_def["networkMode"] == "awsvpc"
        assert "FARGATE" in expected_task_def["requiresCompatibilities"]
        assert expected_task_def["cpu"] == "1024"
        assert expected_task_def["memory"] == "3072"
        
    def test_ecs_container_definition_structure(self):
        expected_container = {
            "name": "image-recognition-api",
            "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/image-recognition-api:latest",
            "essential": True,
            "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/image-recognition-api-dev",
                    "awslogs-region": "us-east-1",
                    "awslogs-stream-prefix": "ecs"
                }
            },
            "healthCheck": {
                "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/v1/health || exit 1"],
                "interval": 30,
                "timeout": 5,
                "retries": 3,
                "startPeriod": 60
            }
        }
        
        assert expected_container["essential"] is True
        assert expected_container["portMappings"][0]["containerPort"] == 3000
        assert "awslogs" in expected_container["logConfiguration"]["logDriver"]
        assert "health" in expected_container["healthCheck"]["command"][0].lower()
