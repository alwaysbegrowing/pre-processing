import json
import boto3
import uuid
from pillaralgos import algo1, algo2, algo3_0, algo3_5, brain


s3 = boto3.client('s3')
SNS = boto3.client('sns')
MINIMUM_CLIP_LENGTH = 1  # seconds



def handler(event, context):
    print(json.dumps(event, default=str))

    bucket = event['Bucket']
    key = event['Key']

    obj = s3.get_object(Bucket=bucket, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))

    brain_results = algo1.run(all_messages, min_=.75, limit=10)


    # this fixes current bug where brain_results is a nparray which we can't return
    if not brain_results:
        return []

    return brain_results
