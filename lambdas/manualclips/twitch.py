import os

import requests

from get_secret import get_secret

TWITCH_CLIENT_ID = os.getenv("TWITCH_CLIENT_ID")
TWITCH_CLIENT_SECRET = get_secret(os.getenv('TWITCH_CLIENT_SECRET_ARN'))

# authenticates with twitch and returns an access token
def twitch_auth():
    
    queries = {
        'client_id': TWITCH_CLIENT_ID,
        'client_secret': TWITCH_CLIENT_SECRET,
        'grant_type': 'client_credentials'
    }

    resp = requests.post('https://id.twitch.tv/oauth2/token', params=queries)
    resp.raise_for_status()

    return resp.json()['access_token']

# gets stream data from twitch
def get_info(key):
    queries = {'id': key}

    access_token = twitch_auth()

    headers = {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': f'Bearer {access_token}'
    }

    resp = requests.get('https://api.twitch.tv/helix/videos', params=queries, headers=headers)
    resp.raise_for_status()

    data = resp.json().get('data')

    if data is None:
        return None

    return data[0] 

if __name__=='__main__':
    print(get_info('1036509656'))
