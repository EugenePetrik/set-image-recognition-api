"""
AWS Helper utilities for infrastructure testing
"""
import boto3
import json
import os
from typing import Dict, List, Optional, Any
from botocore.exceptions import ClientError


class AWSResourceHelper:
    """Helper class for AWS resource validation and testing"""
    
    def __init__(self, environment: str = "dev", region: str = "us-east-1"):
        self.environment = environment
        self.region = region
        self.project_name = "image-recognition-api"
        
        # Initialize AWS clients
        self.s3_client = boto3.client('s3', region_name=region)
        self.dynamodb_client = boto3.client('dynamodb', region_name=region)
        self.ecs_client = boto3.client('ecs', region_name=region)
        self.lambda_client = boto3.client('lambda', region_name=region)
        self.elbv2_client = boto3.client('elbv2', region_name=region)
        self.sns_client = boto3.client('sns', region_name=region)
        self.sqs_client = boto3.client('sqs', region_name=region)
        self.iam_client = boto3.client('iam', region_name=region)
        self.ec2_client = boto3.client('ec2', region_name=region)
    
    def get_resource_name(self, resource_type: str, suffix: str = "") -> str:
        """Generate expected resource name based on naming convention"""
        if suffix:
            return f"{self.project_name}-{self.environment}-{resource_type}-{suffix}"
        return f"{self.project_name}-{self.environment}-{resource_type}"
    
    def resource_exists(self, resource_type: str, resource_identifier: str) -> bool:
        """Check if a resource exists in AWS"""
        try:
            if resource_type == "s3_bucket":
                self.s3_client.head_bucket(Bucket=resource_identifier)
            elif resource_type == "dynamodb_table":
                self.dynamodb_client.describe_table(TableName=resource_identifier)
            elif resource_type == "lambda_function":
                self.lambda_client.get_function(FunctionName=resource_identifier)
            elif resource_type == "ecs_cluster":
                response = self.ecs_client.describe_clusters(clusters=[resource_identifier])
                return len(response['clusters']) > 0 and response['clusters'][0]['status'] == 'ACTIVE'
            elif resource_type == "ecs_service":
                cluster_name = self.get_resource_name("cluster")
                response = self.ecs_client.describe_services(
                    cluster=cluster_name,
                    services=[resource_identifier]
                )
                return len(response['services']) > 0 and response['services'][0]['status'] == 'ACTIVE'
            return True
        except ClientError:
            return False
    
    def get_s3_bucket_config(self, bucket_name: str) -> Dict[str, Any]:
        """Get S3 bucket configuration"""
        try:
            config = {}
            
            # Get bucket policy
            try:
                policy_response = self.s3_client.get_bucket_policy(Bucket=bucket_name)
                config['policy'] = json.loads(policy_response['Policy'])
            except ClientError as e:
                if e.response['Error']['Code'] != 'NoSuchBucketPolicy':
                    raise
                config['policy'] = None
            
            # Get bucket versioning
            versioning_response = self.s3_client.get_bucket_versioning(Bucket=bucket_name)
            config['versioning'] = versioning_response.get('Status', 'Disabled')
            
            # Get bucket encryption
            try:
                encryption_response = self.s3_client.get_bucket_encryption(Bucket=bucket_name)
                config['encryption'] = encryption_response['ServerSideEncryptionConfiguration']
            except ClientError as e:
                if e.response['Error']['Code'] != 'ServerSideEncryptionConfigurationNotFoundError':
                    raise
                config['encryption'] = None
            
            # Get public access block
            try:
                pab_response = self.s3_client.get_public_access_block(Bucket=bucket_name)
                config['public_access_block'] = pab_response['PublicAccessBlockConfiguration']
            except ClientError:
                config['public_access_block'] = None
            
            return config
        except ClientError as e:
            raise Exception(f"Failed to get S3 bucket configuration: {e}")
    
    def get_dynamodb_table_config(self, table_name: str) -> Dict[str, Any]:
        """Get DynamoDB table configuration"""
        try:
            response = self.dynamodb_client.describe_table(TableName=table_name)
            table = response['Table']
            
            return {
                'table_name': table['TableName'],
                'table_status': table['TableStatus'],
                'key_schema': table['KeySchema'],
                'attribute_definitions': table['AttributeDefinitions'],
                'billing_mode': table.get('BillingModeSummary', {}).get('BillingMode', 'PROVISIONED'),
                'global_secondary_indexes': table.get('GlobalSecondaryIndexes', []),
                'local_secondary_indexes': table.get('LocalSecondaryIndexes', []),
                'stream_specification': table.get('StreamSpecification', {}),
                'sse_description': table.get('SSEDescription', {})
            }
        except ClientError as e:
            raise Exception(f"Failed to get DynamoDB table configuration: {e}")
    
    def get_ecs_service_config(self, service_name: str, cluster_name: str) -> Dict[str, Any]:
        """Get ECS service configuration"""
        try:
            response = self.ecs_client.describe_services(
                cluster=cluster_name,
                services=[service_name]
            )
            
            if not response['services']:
                raise Exception(f"ECS service {service_name} not found in cluster {cluster_name}")
            
            service = response['services'][0]
            
            # Get task definition
            task_def_response = self.ecs_client.describe_task_definition(
                taskDefinition=service['taskDefinition']
            )
            
            return {
                'service_name': service['serviceName'],
                'status': service['status'],
                'running_count': service['runningCount'],
                'desired_count': service['desiredCount'],
                'task_definition': task_def_response['taskDefinition'],
                'load_balancers': service.get('loadBalancers', []),
                'service_registries': service.get('serviceRegistries', []),
                'network_configuration': service.get('networkConfiguration', {}),
                'launch_type': service.get('launchType', 'EC2'),
                'capacity_provider_strategy': service.get('capacityProviderStrategy', [])
            }
        except ClientError as e:
            raise Exception(f"Failed to get ECS service configuration: {e}")
