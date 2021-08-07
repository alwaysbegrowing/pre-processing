import os
from datetime import datetime

import arrow

from twitch import get_stream

def handler(event, context):
    now = arrow.get(datetime.now())
    login = event['Records'][0]['Sns']['MessageAttributes']['UserLogin']['Value']

    stream_info = get_stream(login)

    raw_start_time = stream_info['data'][0].get('started_at')

    start_time = arrow.get(raw_start_time)

    