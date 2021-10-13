import json
import os
import boto3
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

def hydrate_clips(clips, key):
    # Python will not allow you to remove
    # items mid-iteration. This was the 
    # recommended solution on StackOverflow
    clips_to_remove = []

    for clip in clips:
        length = clip['endTime'] - clip['startTime']
        if length < MINIMUM_CLIP_LENGTH:
            clips_to_remove.append(clip)
            continue
        clip['id'] = generate_clip_id(key, clip)

    for clip in clips_to_remove:
        clips.remove(clip)

    return clips

def handler(event, context):
    print(json.dumps(event, default=str))

    bucket = event['Bucket']
    key = event['Key']

    obj = s3.get_object(Bucket=bucket, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))

    brain_results = algo1.run(all_messages, min_=.75, limit=10)

    hydrated_brain_results = hydrate_clips(brain_results, key)

    clips = {
        "brain": hydrated_brain_results,
    }

    print(json.dumps({'found_clips': clips}))

    store_in_db(key, clips)
    return clips
