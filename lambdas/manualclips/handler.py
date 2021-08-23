import json
import os

import arrow
import boto3

from twitch import get_info
from db import save_clips, get_clip_length

s3 = boto3.client('s3')

BUCKET = os.getenv('BUCKET')

# generates a clip id
def generate_clip_id(key, start_time, end_time):
    clip_id = f"{key}-{start_time}-{end_time}"
    return clip_id

# checks if a user is a moderator
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

    # gets the S3 event from the SNS event
    message = event['Records'][0]['Sns']['Message']
    event = json.loads(message)

    # gets the clip key from the S3 event
    data = event['Records'][0]['s3']
    key = data['object']['key']

    # get stream info from twitch api
    stream_data = get_info(key)

    # get streamer name from stream data
    streamer_name = stream_data['user_login']

    print(json.dumps({'videoId': key}))

    # gets messages from the S3 bucket
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))

    clip_command_timestamps = []

    # gets all messages that start with !clip
    # that were sent by a moderator or the broadcaster
    for message in all_messages:
        try:
            # gets the display name
            commenter_display_name = message['commenter']['display_name']
            
            # checks if the user is a moderator
            is_mod = is_moderator(message)
            # or is the streamer
            is_streamer = streamer_name in commenter_display_name
            
            # if the user is a moderator or the streamer
            if is_streamer or is_mod:
                body = message['message']['body']
                if body.startswith('!clip'):
                    # add the clip end time to the list
                    clip_command_timestamps.append(arrow.get(message['created_at']))
        except KeyError:
            continue

    # if the clip_command_timestamps list is empty
    if not clip_command_timestamps:
        return {}

    # get the clip length
    clip_length = get_clip_length(streamer_name)

    # if clip length is none
    if clip_length is None:
        return {'error': f'User {streamer_name} not found!'}

    # gets the start time of the stream
    stream_start_time = arrow.get(stream_data['created_at'])

    clips = []

    # create all of the manual clips 
    for clip_command in clip_command_timestamps:
        end_time = round(arrow.get(clip_command).timestamp() - stream_start_time.timestamp(), 2)
        start_time = round(end_time - clip_length, 2)
        clip_id = generate_clip_id(key, start_time, end_time)
        clips.append({
            'startTime': start_time,
            'endTime': end_time,
            'id': clip_id
        })

    # save the clips to the database
    resp = save_clips(key, clips)

    print(json.dumps({'num_clips_created': len(clips), 'clips': clips, 'db_resp': resp.modified_count}))

    return {}
