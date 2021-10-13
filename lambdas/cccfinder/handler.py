import os
import json
import boto3

from clip_lib import twitch_auth, get_video_ccc, get_ccc_start_end_times
from db import input_ccc
from get_secret import get_secret

TWITCH_CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
TWITCH_CLIENT_SECRET = get_secret(os.getenv('TWITCH_CLIENT_SECRET_ARN'))

def generate_clip_id(key, clip):
    clip_id = f"{key}-{clip['startTime']}-{clip['endTime']}"
    return clip_id

def hydrate_clips(clips, key):
    for clip in clips:
        clip['id'] = generate_clip_id(key, clip)
    return clips

def handler(event, context):
    print(json.dumps(event, default=str))
    video_id = event['videoId']


    access_token = twitch_auth(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)['access_token']
    ccc_data = get_video_ccc(TWITCH_CLIENT_ID, access_token, video_id)

    data = []

    for clip in ccc_data:
        start_time, end_time = get_ccc_start_end_times(clip)
        clip['startTime'] = start_time
        clip['endTime'] = end_time
        clip['twitchClipId'] = clip['id']
        data.append(clip)

    hydrated_ccc_results = hydrate_clips(data, video_id)

    result = input_ccc(video_id, hydrated_ccc_results)
    # the number of ccc clips found and the list of the ccc clips
    print(json.dumps({'number_of_clips':len(hydrated_ccc_results), 'ccc_clips':hydrated_ccc_results, 'result': str(result)}))

    return data