import json
import re

import requests


def twitch_auth(client_id, client_secret):
    queries = {
        'client_id': client_id,
        'client_secret': client_secret,
        'grant_type': 'client_credentials'
    }

    resp = requests.post('https://id.twitch.tv/oauth2/token', params=queries)
    return resp.json()


def get_video_ccc(twitch_client_id, access_token, twitch_id, video_id):
    '''
    Gets last 100 user clips and check to make sure they are a part of the specified video
    '''
    headers = {
        'Client-Id': twitch_client_id,
        'Authorization': f'Bearer {access_token}'
    }

    query = {
        'broadcaster_id': twitch_id,
        'first': 100
    }

    resp = requests.get('https://api.twitch.tv/helix/clips', headers=headers, params=query)

    resp.raise_for_status()

    user_clips = resp.json()['data']

    video_clips = []

    for clip in user_clips:
        if clip['video_id'] == video_id:
            video_clips.append(clip)

    return video_clips


def twitch_time_to_seconds(duration):
    total = 0

    hour_list = re.findall(r'\dh', duration)
    if hour_list:
        hour_str = hour_list[0].replace('h', '')
        total += int(hour_str) * 3600

    minute_list = re.findall(r'\dm', duration)
    if minute_list:
        minute_str = minute_list[0].replace('m', '')
        total += int(minute_str) * 60

    second_list = re.findall(r'\ds', duration)
    if second_list:
        second_str = second_list[0].replace('s', '')
        total += int(second_str)

    return total


def get_ccc_start_end_times(clip_data):
    gql_url = "https://gql.twitch.tv/gql"
    gql_payload = [{
        'operationName': 'ClipsChatCard',
        'variables': {
            'slug': clip_data['id']
        },
        'extensions': {
            'persistedQuery': {
                'version': 1,
                'sha256Hash': '94c1c7d97d860722a5b7ef3c3b3de3783b37fc32d69bcccc8ea0cda372cf1f01'
            }
        }
    }]

    gql_headers = {
        'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko'
    }

    gql_resp = requests.post(gql_url, headers=gql_headers, json=gql_payload)

    gql_data = gql_resp.json()

    start_time = gql_data[0]['data']['clip']['videoOffsetSeconds']

    duration = clip_data.get('duration')
    if duration is None:
        raise AssertionError('Could not find duration in API response.')

    if type(duration) is str:
        duration = twitch_time_to_seconds(duration)

    types = [int, str, float]
    if not any(type(duration) is t for t in types):
        print(type(duration))
        raise AssertionError('Duration is not an integer, float, or string.')

    end_time = start_time + duration

    return start_time, end_time

# def get_ccc(twitch_client_id, access_token, ccc_data):
#     '''
#     `ccc_data` should simply be a list of clip URLs

#     outputs a list that looks like the following:
#     [{'startTime': 50, 'endTime': 60}, {'startTime': 120, 'endTime': 155.1}]
#     '''
#     if ccc_data is None:
#         return []

#     if type(ccc_data) is str:
#         ccc_data = json.loads(ccc_data)

#     return_data = []

#     for clip_url in ccc_data:
#         clip_slug = clip_url.split('/')[-1]
#         start_time, end_time = get_ccc_start_end_times(twitch_client_id, access_token, clip_slug)

#         return_data.append({
#             'startTime': start_time,
#             'endTime': end_time
#         })

#     return return_data
