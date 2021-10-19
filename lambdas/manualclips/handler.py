import json
import os

import arrow
import boto3

from twitch import get_info
from db import save_clips, get_clip_length

s3 = boto3.client('s3')


# max clip length
MAX_CLIP_LENGTH = 180  # In seconds. 3 minutes.
# min clip length
MIN_CLIP_LENGTH = 15  # In seconds.
DEFAULT_CLIP_LENGTH = 60
# generates a clip id


def generate_clip_id(key, start_time, end_time):
    clip_id = f"{key}-{start_time}-{end_time}"
    return clip_id

# checks if a user is a moderator


def is_moderator_or_streamer(message):
    try:
        badges = message['message']['user_badges']
        for badge in badges:
            if badge['_id'] == 'moderator' or badge['_id'] == 'broadcaster':
                return True
    except KeyError:
        pass

    return False


def handler(event, context):
    print(json.dumps(event, default=str))

    bucket = event['Bucket']
    key = event['Key']

    stream_data = get_info(key)

    # gets messages from the S3 bucket
    obj = s3.get_object(Bucket=bucket, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))

    clip_command_timestamps = []

    # gets all messages that start with !clip
    # that were sent by a moderator or the broadcaster
    for message in all_messages:
        try:
            has_acess_to_create_manual_clips = is_moderator_or_streamer(
                message)

            if has_acess_to_create_manual_clips:
                body = message['message']['body']
                if body.startswith('!clip'):
                    # add the clip end time to the list
                    current_clip_length = DEFAULT_CLIP_LENGTH

                    # split at the space
                    clip_command_parts = body.split(' ')

                    # if there is more than one part
                    if len(clip_command_parts) > 1:
                        try:
                            current_clip_length = int(clip_command_parts[1])
                        except IndexError:
                            current_clip_length = DEFAULT_CLIP_LENGTH

                    # make sure the clip length is not longer than the max
                    if current_clip_length > MAX_CLIP_LENGTH:
                        current_clip_length = MAX_CLIP_LENGTH

                    if current_clip_length < MIN_CLIP_LENGTH:
                        current_clip_length = MIN_CLIP_LENGTH

                    clip_command_timestamps.append({
                        'created_at': message['created_at'],
                        'length': current_clip_length
                    })
        except KeyError:
            continue

    # if the clip_command_timestamps list is empty
    if not clip_command_timestamps:
        return []

    # gets the start time of the stream
    stream_start_time = arrow.get(stream_data['created_at'])

    clips = []

    # create all of the manual clips
    for clip_command in clip_command_timestamps:
        end_time = round(arrow.get(clip_command['created_at']).timestamp(
        ) - stream_start_time.timestamp(), 2)
        start_time = round(end_time - clip_command['length'], 2)
        clip_id = generate_clip_id(key, start_time, end_time)
        clips.append({
            'startTime': start_time,
            'endTime': end_time,
            'id': clip_id
        })

    # save the clips to the database
    resp = save_clips(key, clips)

    print(json.dumps({'num_clips_created': len(clips),
          'clips': clips, 'db_resp': resp.modified_count}))

    return clips
