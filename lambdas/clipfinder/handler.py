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

    obj = s3.get_object(Bucket=bucket, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))

    brain = brain.run(all_messages, clip_length=.75)

    clips = {
        "brain": brain, 
    }
    
    store_in_db(key, clips)
    return clips
