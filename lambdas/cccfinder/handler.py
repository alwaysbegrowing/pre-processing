import os
import json

from clip_lib import twitch_auth, get_video_ccc, get_ccc_start_end_times
from db import input_ccc
from get_secret import get_secret

TWITCH_CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
TWITCH_CLIENT_SECRET = get_secret(os.getenv('TWITCH_CLIENT_SECRET_ARN'))

def handler(event, context):
    '''
    Event should have the following information: The user's Twitch ID and the video ID
    '''

    print(json.dumps(event, default=str))

    access_token = twitch_auth(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)['access_token']

    video_id = event['Records'][0]['Sns']['MessageAttributes']['VideoId']['Value']

    print(json.dumps({'videoId': video_id}))
    
    ccc_data = get_video_ccc(TWITCH_CLIENT_ID, access_token, video_id)

    data = []

    for clip in ccc_data:
        start_time, end_time = get_ccc_start_end_times(clip)
        data.append({'startTime': start_time, 'endTime': end_time})
    
    # the number of ccc clips found and the list of the ccc clips
    print(json.dumps({'number_of_clips':len(data), 'ccc_clips':data}))
    
    input_ccc(video_id, data)

    return {}