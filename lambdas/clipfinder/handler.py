import json
import os

import boto3
from pillaralgos import algo1, algo2, algo3_0, algo3_5

from db import connect_to_db
from secrets import get_secret
from clip_lib import twitch_auth, get_ccc_start_end_times

s3 = boto3.client('s3')
TWITCH_CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
TWITCH_CLIENT_SECRET_ARN = os.getenv('TWITCH_CLIENT_SECRET_ARN')
TWITCH_CLIENT_SECRET = get_secret(TWITCH_CLIENT_SECRET_ARN)


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

def get_ccc(ccc_data):
    '''
    `ccc_data` should simply be a list of clip URLs

    outputs a list that looks like the following:
    [{'startTime': 50, 'endTime': 60}, {'startTime': 120, 'endTime': 155.1}]
    '''
    if ccc_data is None:
        return []

    if type(ccc_data) is str:
        ccc_data = json.loads(ccc_data)

    access_token = twitch_auth(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)['access_token']

    return_data = []

    for clip_url in ccc_data:
        clip_slug = clip_url.split('/')[-1]
        start_time, end_time = get_ccc_start_end_times(TWITCH_CLIENT_ID, access_token, clip_slug)

        return_data.append({
            'startTime': start_time,
            'endTime': end_time
        })

    return return_data

def handler(event, context):
    data = event['Records'][0]['s3']
    bucket = data['bucket']['name']
    key = data['object']['key']
    ccc_data = data['object'].get('ccc')

    obj = s3.get_object(Bucket=bucket, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))
    algo1_result = algo1.run(all_messages, min_=.5,  limit=10)
    algo2_result = algo2.run(all_messages, min_=.5,  limit=10)
    algo3 = algo3_0.run(all_messages, min_=.5,  limit=10)
    algo4 = algo3_5.run(all_messages, min_=.5,  limit=10)
    ccc = get_ccc(ccc_data)
    clips = {
        "algo1": algo1_result, 
        "algo2": algo2_result, 
        "algo3": algo3, 
        "algo4": algo4,
        "ccc": ccc
    }
    store_in_db(key, clips)
    return clips
