import boto3
import json

from twitch_chat_analysis.algo1 import run as algo1Runner
from twitch_chat_analysis.algo2 import run as algo2Runner
from twitch_chat_analysis.algo3_5 import run as algo3_5Runner
from twitch_chat_analysis.algo3_0 import run as algo3_0Runner
from db import connect_to_db
s3 = boto3.client('s3')


def store_in_db(key, clip_timestamps):
    db = connect_to_db()
    search = {"videoId": key}
    update = {
        '$set': {
            'clips': clip_timestamps
        },
    }

    result = db['timestamps'].update_one(search, update, upsert=True)
    print(result)
    return result


def handler(event, context):
    data = event['Records'][0]['s3']
    bucket = data['bucket']['name']
    key = data['object']['key']

    obj = s3.get_object(Bucket=bucket, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))
    algo1 = algo1Runner(all_messages, sort_by='rel', min_=2),
    algo2 = algo2Runner(all_messages, min_=2)
    algo3 = algo3_0Runner(all_messages, min_=2, min_words=5)
    algo4 = algo3_5Runner(all_messages, goal='num_words', min_=2)
    clips = {"algo1": algo1, "algo2": algo2, "algo3": algo3, algo4: 'algo4'}
    store_in_db(key, clips)
    return clips
