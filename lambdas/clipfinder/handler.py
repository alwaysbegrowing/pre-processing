import json
import os

import boto3
from pillaralgos import algo1, algo2, algo3_0, algo3_5, brain

from db import connect_to_db

s3 = boto3.client('s3')

def store_in_db(key, clip_timestamps):
    db = connect_to_db()
    search = {"videoId": key}
    update = {
        '$set': {
            'clips': clip_timestamps
        },
    }

    result = db['timestamps'].update_one(search, update, upsert=True)
    print(result)
    return result

def handler(event, context):
    data = event['Records'][0]['s3']
    bucket = data['bucket']['name']
    key = data['object']['key']

    print(f'Finding data for video {key}')

    obj = s3.get_object(Bucket=bucket, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))

    brain_results = algo1.run(all_messages, min_=.75,  limit=10)
    algo1_clips = algo1.run(all_messages, min_=0.70, limit=10)


    print(f'Found {len(brain_results)} clips. Adding to database.')

    clips = {
        "brain": brain_results, 
        "algo1": algo1_clips
    }
    
    store_in_db(key, clips)
    return clips
