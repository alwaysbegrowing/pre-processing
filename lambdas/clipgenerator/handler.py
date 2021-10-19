import json
import boto3
import uuid
from pillaralgos import algo1, algo2, algo3_0, algo3_5, brain

from db import connect_to_db

s3 = boto3.client('s3')
SNS = boto3.client('sns')
MINIMUM_CLIP_LENGTH = 1 # seconds


def store_in_db(key, clip_timestamps):
    db = connect_to_db()
    search = {"videoId": key}
    update = {
        '$set': {
            'clips': clip_timestamps
        },
    }

    result = db['timestamps'].update_one(search, update, upsert=True)

    return result

def generate_clip_id(key, clip):
    clip_id = f"{key}-{clip['startTime']}-{clip['endTime']}"
    return clip_id

def hydrate_and_filter_clips(clips, key):
    long_enough_clips = []

    for clip in clips:
        length = clip['endTime'] - clip['startTime']
        if length >= MINIMUM_CLIP_LENGTH:
            clip['id'] = str(uuid.uuid4())
            long_enough_clips.append(clip)
       
    return long_enough_clips

def handler(event, context):
    print(json.dumps(event, default=str))

    bucket = event['Bucket']
    key = event['Key']

    obj = s3.get_object(Bucket=bucket, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))

    brain_results = algo1.run(all_messages, min_=.75, limit=10)

    hydrated_brain_results = hydrate_and_filter_clips(brain_results, key)

    # this fixes current bug where brain_results is a nparray which we can't return or store 
    if not hydrated_brain_results:
        return []

    clips = {
        "brain": hydrated_brain_results,
    }

    store_in_db(key, clips)
    return hydrated_brain_results
