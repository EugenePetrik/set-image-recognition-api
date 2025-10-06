import json
import boto3
import urllib.parse
from datetime import datetime
from decimal import Decimal
import logging
import os

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
rekognition_client = boto3.client('rekognition')

# Environment variables
DYNAMODB_TABLE = os.environ.get('DYNAMODB_TABLE_NAME')

if not DYNAMODB_TABLE:
    raise ValueError("DYNAMODB_TABLE_NAME environment variable is required")

table = dynamodb.Table(DYNAMODB_TABLE)

def lambda_handler(event, context):
    """
    Lambda function to process image recognition from SQS messages
    """
    try:
        logger.info(f"Processing {len(event['Records'])} SQS records")
        
        # Process each SQS record
        for record in event['Records']:
            # Parse SNS message from SQS
            sns_message = json.loads(record['body'])
            s3_event = json.loads(sns_message['Message'])
            
            # Process each S3 record
            for s3_record in s3_event['Records']:
                bucket_name = s3_record['s3']['bucket']['name']
                object_key = urllib.parse.unquote_plus(s3_record['s3']['object']['key'])
                
                logger.info(f"Processing image: {bucket_name}/{object_key}")
                
                # Skip if not an image file
                if not is_image_file(object_key):
                    logger.info(f"Skipping non-image file: {object_key}")
                    continue
                
                # Analyze image with Rekognition
                labels = analyze_image(bucket_name, object_key)
                
                # Store metadata in DynamoDB
                store_image_metadata(bucket_name, object_key, s3_record, labels)
                
                logger.info(f"Successfully processed image: {object_key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Successfully processed images',
                'processed_count': len(event['Records'])
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing images: {str(e)}")
        raise e

def is_image_file(object_key):
    """
    Check if the file is an image based on extension
    """
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    return any(object_key.lower().endswith(ext) for ext in image_extensions)

def analyze_image(bucket_name, object_key):
    """
    Analyze image using AWS Rekognition
    """
    try:
        response = rekognition_client.detect_labels(
            Image={
                'S3Object': {
                    'Bucket': bucket_name,
                    'Name': object_key
                }
            },
            MaxLabels=10,
            MinConfidence=75.0
        )
        
        labels = []
        for label in response['Labels']:
            labels.append({
                'Name': label['Name'],
                'Confidence': Decimal(str(round(label['Confidence'], 2)))
            })
        
        logger.info(f"Detected {len(labels)} labels for {object_key}")
        return labels
        
    except Exception as e:
        logger.error(f"Error analyzing image {object_key}: {str(e)}")
        return []

def store_image_metadata(bucket_name, object_key, s3_record, labels):
    """
    Update existing image metadata with recognition results
    """
    try:
        # Extract image ID from S3 key (format: images/img_TIMESTAMP.ext)
        image_filename = object_key.split('/')[-1]  # Get filename from path
        image_id = image_filename.split('.')[0]     # Remove extension to get image ID
        
        # Get object metadata
        s3_object = s3_record['s3']['object']
        
        # Extract primary label for GSI
        primary_label = labels[0]['Name'] if labels else 'unknown'
        
        # Update the existing metadata record
        response = table.update_item(
            Key={
                'ImageId': image_id,
                'CreatedAt': 'METADATA'
            },
            UpdateExpression='SET #status = :status, #labels = :labels, #labelValue = :labelValue, #processedAt = :processedAt',
            ExpressionAttributeNames={
                '#status': 'status',
                '#labels': 'labels',
                '#labelValue': 'LabelValue',
                '#processedAt': 'ProcessedAt'
            },
            ExpressionAttributeValues={
                ':status': 'processed',
                ':labels': labels,
                ':labelValue': primary_label,
                ':processedAt': datetime.now().isoformat()
            },
            ReturnValues='UPDATED_NEW'
        )
        
        logger.info(f"Updated metadata for {image_id} with {len(labels)} labels")
        
    except Exception as e:
        logger.error(f"Error updating metadata for {object_key}: {str(e)}")
        raise e
