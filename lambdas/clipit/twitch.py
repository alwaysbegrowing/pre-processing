import os

import requests

from get_secret import get_secret

TWITCH_CLIENT_ID = os.getenv("TWITCH_CLIENT_ID")
TWITCH_CLIENT_SECRET = get_secret(os.getenv('TWITCH_CLIENT_SECRET_ARN'))

def twitch_auth():
    
    queries = {
        'client_id': TWITCH_CLIENT_ID,
        'client_secret': TWITCH_CLIENT_SECRET,
        'grant_type': 'client_credentials'
    }

    resp = requests.post('https://id.twitch.tv/oauth2/token', params=queries)
    resp.raise_for_status()

    return resp.json()['access_token']

def get_stream(login):
    queries = {'user_login': login}

    access_token = twitch_auth()

    headers = {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': f'Bearer {access_token}'
    }

    resp = requests.get('https://api.twitch.tv/helix/streams', params=queries, headers=headers)
    resp.raise_for_status()

    return resp.json()

if __name__=='__main__':
    print(get_stream('jeditobiwan'))