import boto3
import json
from clipalgo import run
from db import connect_to_db
s3 = boto3.client('s3')


def store_in_db(key, timestamps):
    db = connect_to_db()
    search = {"videoId": key}
    update = {
        '$set': {
            'clips': {
                'algo1': timestamps
            }
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
    timestamps = run(all_messages)
    print(timestamps)
    store_in_db(key, timestamps)
    return timestamps
