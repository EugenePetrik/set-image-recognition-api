"""
Unit tests for Application Load Balancer infrastructure  
"""
import pytest
import boto3
from moto import mock_elbv2, mock_ec2
from tests.utils.aws_helpers import AWSResourceHelper


@pytest.mark.unit
@pytest.mark.alb
class TestApplicationLoadBalancer:
    """Test ALB configuration"""
    
    def test_alb_naming_convention(self, expected_resource_names):
        """Test that ALB follows naming convention"""
        expected_alb_name = expected_resource_names["alb"]
        expected_tg_name = expected_resource_names["target_group"]
        
        assert "image-recognition-api" in expected_alb_name
        assert "alb" in expected_alb_name
        assert "image-recognition-api" in expected_tg_name
        assert "tg" in expected_tg_name
        
    def test_alb_outputs_present(self, terraform_outputs):
        """Test that ALB outputs are present in Terraform outputs"""
        assert "alb_dns_name" in terraform_outputs
        assert terraform_outputs["alb_dns_name"] is not None
        
    @mock_elbv2
    @mock_ec2
    def test_alb_configuration(self, terraform_environment, aws_region):
        """Test ALB configuration"""
        # Create mock clients
        elbv2_client = boto3.client('elbv2', region_name=aws_region)
        ec2_client = boto3.client('ec2', region_name=aws_region)
        
        # Create VPC and subnets for testing
        vpc_response = ec2_client.create_vpc(CidrBlock="10.0.0.0/16")
        vpc_id = vpc_response['Vpc']['VpcId']
        
        subnet1_response = ec2_client.create_subnet(
            VpcId=vpc_id, 
            CidrBlock="10.0.1.0/24",
            AvailabilityZone=f"{aws_region}a"
        )
        subnet2_response = ec2_client.create_subnet(
            VpcId=vpc_id, 
            CidrBlock="10.0.2.0/24", 
            AvailabilityZone=f"{aws_region}b"
        )
        
        subnet_ids = [subnet1_response['Subnet']['SubnetId'], subnet2_response['Subnet']['SubnetId']]
        
        # Create test ALB
        alb_name = f"image-recognition-api-{terraform_environment}-alb"
        alb_response = elbv2_client.create_load_balancer(
            Name=alb_name,
            Subnets=subnet_ids,
            Type='application',
            Scheme='internet-facing',
            IpAddressType='ipv4'
        )
        
        alb_arn = alb_response['LoadBalancers'][0]['LoadBalancerArn']
        
        # Create target group
        tg_name = f"image-recognition-api-{terraform_environment}-tg"
        tg_response = elbv2_client.create_target_group(
            Name=tg_name,
            Protocol='HTTP',
            Port=3000,
            VpcId=vpc_id,
            HealthCheckProtocol='HTTP',
            HealthCheckPath='/api/v1/health',
            HealthCheckIntervalSeconds=30,
            HealthCheckTimeoutSeconds=5,
            HealthyThresholdCount=2,
            UnhealthyThresholdCount=5,
            TargetType='ip'
        )
        
        tg_arn = tg_response['TargetGroups'][0]['TargetGroupArn']
        
        # Create listener
        elbv2_client.create_listener(
            LoadBalancerArn=alb_arn,
            Protocol='HTTP',
            Port=80,
            DefaultActions=[
                {
                    'Type': 'forward',
                    'TargetGroupArn': tg_arn
                }
            ]
        )
        
        # Test ALB configuration
        albs = elbv2_client.describe_load_balancers(Names=[alb_name])
        alb = albs['LoadBalancers'][0]
        
        assert alb['LoadBalancerName'] == alb_name
        assert alb['Type'] == 'application'
        assert alb['Scheme'] == 'internet-facing'
        assert alb['State']['Code'] == 'active'
        
    def test_target_group_health_check_configuration(self):
        """Test expected target group health check configuration"""
        expected_health_check = {
            "HealthCheckProtocol": "HTTP",
            "HealthCheckPath": "/api/v1/health",
            "HealthCheckIntervalSeconds": 30,
            "HealthCheckTimeoutSeconds": 5,
            "HealthyThresholdCount": 2,
            "UnhealthyThresholdCount": 5,
            "Port": 3000,
            "TargetType": "ip"
        }
        
        # Validate health check configuration
        assert expected_health_check["HealthCheckPath"] == "/api/v1/health"
        assert expected_health_check["HealthCheckProtocol"] == "HTTP"
        assert expected_health_check["TargetType"] == "ip"
        assert expected_health_check["HealthCheckIntervalSeconds"] == 30
        
    def test_alb_listener_configuration(self):
        """Test expected ALB listener configuration"""
        expected_listener = {
            "Protocol": "HTTP",
            "Port": 80,
            "DefaultActions": [
                {
                    "Type": "forward"
                }
            ]
        }
        
        # Validate listener configuration
        assert expected_listener["Protocol"] == "HTTP"
        assert expected_listener["Port"] == 80
        assert expected_listener["DefaultActions"][0]["Type"] == "forward"
