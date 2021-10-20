import os
import json

from clip_lib import twitch_auth, get_video_ccc, get_ccc_start_end_times
from get_secret import get_secret

TWITCH_CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
TWITCH_CLIENT_SECRET = get_secret(os.getenv('TWITCH_CLIENT_SECRET_ARN'))

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

    return data