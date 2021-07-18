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


def get_games(twitch_client_id, access_token, length):
    '''

    :param twitch_client_id:string
    :param access_token:string
    :param length:int
    :return: list of games, length long
    '''

    headers = {
        'Client-Id': twitch_client_id,
        'Authorization': f'Bearer {access_token}'
    }

    query = {
        'first': length
    }

    resp = requests.get('https://api.twitch.tv/helix/games/top', headers=headers, params=query)

    data = resp.json()['data']
    return data

def get_ccc_for_game(twitch_client_id, access_token, game_id, start_date, number_of_clips):
    '''
    Gets last 100 CCCs per game and check to make sure they are a part of the specified video
    '''
    headers = {
        'Client-Id': twitch_client_id,
        'Authorization': f'Bearer {access_token}'
    }

    query = {
        'game_id': game_id,
        'first': number_of_clips,
        'started_at': start_date
    }

    resp = requests.get('https://api.twitch.tv/helix/clips', headers=headers, params=query)

    resp.raise_for_status()

    data = resp.json()['data']

    return data


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

def get_video_details(twitch_client_id, access_token, video_id):
    '''
    Gets last 100 CCCs per game and check to make sure they are a part of the specified video
    '''
    headers = {
        'Client-Id': twitch_client_id,
        'Authorization': f'Bearer {access_token}'
    }

    query = {
        'id': video_id
    }

    resp = requests.get('https://api.twitch.tv/helix/videos', headers=headers, params=query)

    resp.raise_for_status()

    data = resp.json()['data']

    return data


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

    # print("START_TIME: ", start_time)
    if start_time is None:
        raise AssertionError('Could not find videoOffsestSeconds in API response. GQL response data: ', gql_data)

    duration = clip_data.get('duration')
    if duration is None:
        raise AssertionError('Could not find duration in API response.')

    if type(duration) is str:
        duration = twitch_time_to_seconds(duration)

    types = [int, str, float]
    if not any(type(duration) is t for t in types):
        # print(type(duration))
        raise AssertionError('Duration is not an integer, float, or string.')

    end_time = start_time + duration

    return start_time, end_time
