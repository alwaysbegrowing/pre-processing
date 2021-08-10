import json
import os

import arrow
import boto3

from twitch import get_info
from db import input_ccc

s3 = boto3.client('s3')

# make this user configurable later?
CLIP_LENGTH = 30 # seconds

BUCKET = os.getenv('BUCKET')

def generate_clip_id(key, start_time, end_time):
    clip_id = f"{key}-{start_time}-{end_time}"
    return clip_id

def is_moderator(message):
    try:
        badges = message['message']['user_badges']
        for badge in badges:
            if 'moderator' in badge['_id']:
                return True
    except KeyError:
        pass

    return False

def handler(event, context):
    print(json.dumps(event, default=str))

    key = event['Records'][0]['Sns']['Message']

    stream_data = get_info(key)

    display_name = stream_data['user_login']

    print(json.dumps({'videoId': key}))

    obj = s3.get_object(Bucket=BUCKET, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))

    clip_command_timestamps = []

    for message in all_messages:
        try:
            commenter = message['commenter']['display_name']
            is_mod = is_moderator(message)
            if display_name in commenter or is_mod:
                body = message['message']['body']
                if '!clip' in body:
                    clip_command_timestamps.append(arrow.get(message['created_at']))
        except KeyError:
            continue

    stream_start_time = arrow.get(stream_data['created_at'])

    clips = []

    for clip_command in clip_command_timestamps:
        end_time = round(arrow.get(clip_command).timestamp() - stream_start_time.timestamp(), 2)
        start_time = round(end_time - CLIP_LENGTH, 2)
        clip_id = generate_clip_id(key, start_time, end_time)
        clips.append({
            'startTime': start_time,
            'endTime': end_time,
            'id': clip_id
        })

    resp = input_ccc(key, clips)

    print(json.dumps({'#clips': len(clips), 'clips': clips, 'db_resp': resp.modified_count}))

    return {}
