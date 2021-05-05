import json
import os

import boto3
from pillaralgos import algo1, algo2, algo3_0, algo3_5

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
    algo1_result = algo1.run(all_messages, min_=.5,  limit=10)
    algo2_result = algo2.run(all_messages, min_=.5,  limit=10)
    algo3 = algo3_0.run(all_messages, min_=.5,  limit=10)
    algo4 = algo3_5.run(all_messages, min_=.5,  limit=10)
    clips = {
        "algo1": algo1_result, 
        "algo2": algo2_result, 
        "algo3": algo3, 
        "algo4": algo4,
    }
    store_in_db(key, clips)
    return clips
