import json
import os

import arrow
import boto3

from twitch import get_info

s3 = boto3.client('s3')


MAX_CLIP_LENGTH_IN_SECONDS = 180
MIN_CLIP_LENGTH_IN_SECONDS = 15
DEFAULT_CLIP_LENGTH_IN_SECONDS = 60


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
                    current_clip_length = DEFAULT_CLIP_LENGTH_IN_SECONDS

                    # split at the space
                    clip_command_parts = body.split(' ')

                    # if there is more than one part
                    if len(clip_command_parts) > 1:
                        try:
                            current_clip_length = int(clip_command_parts[1])
                        except IndexError:
                            current_clip_length = DEFAULT_CLIP_LENGTH_IN_SECONDS

                    # make sure the clip length is not longer than the max
                    if current_clip_length > MAX_CLIP_LENGTH_IN_SECONDS:
                        current_clip_length = MAX_CLIP_LENGTH_IN_SECONDS

                    if current_clip_length < MIN_CLIP_LENGTH_IN_SECONDS:
                        current_clip_length = MIN_CLIP_LENGTH_IN_SECONDS

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
        clips.append({
            'startTime': start_time,
            'endTime': end_time,
        })

    return clips
