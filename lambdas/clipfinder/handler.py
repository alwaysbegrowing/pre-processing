import json
import os
import boto3
from pillaralgos import algo1, algo2, algo3_0, algo3_5, brain

from db import connect_to_db

s3 = boto3.client('s3')
SNS = boto3.client('sns')
THUMBNAIL_GENERATOR_TOPIC = os.getenv('TOPIC')


def sendSnsMessage(videoId, topic):

    return SNS.publish(
        TargetArn=topic,
        Message=videoId,
        MessageStructure='string',
        MessageDeduplicationId=videoId,
        MessageGroupId="clipa"
    )


def store_in_db(key, clip_timestamps):
    db = connect_to_db()
    search = {"videoId": key}
    update = {
        '$set': {
            'clips': clip_timestamps
        },
    }

    result = db['timestamps'].update_one(search, update, upsert=True)

    return result


def generate_clip_id(key, clip):
    clip_id = f"{key}-{clip['startTime']}-{clip['endTime']}"
    return clip_id


def hydrate_clips(clips, key):
    for clip in clips:
        clip['id'] = generate_clip_id(key, clip)
    return clips


def handler(event, context):
    print(json.dumps(event, default=str))

    message = event['Records'][0]['Sns']['Message']
    event = json.loads(message)

    data = event['Records'][0]['s3']
    bucket = data['bucket']['name']
    key = data['object']['key']

    print(json.dumps({'videoId': key}))

    obj = s3.get_object(Bucket=bucket, Key=key)
    all_messages = json.loads(obj['Body'].read().decode('utf-8'))

    brain_results = algo1.run(all_messages, min_=.75, limit=10)

    # only print out algo1's length since we're using it twice
    hydrated_brain_results = hydrate_clips(brain_results, key)

    # clips that the algorithm found
    clips = {
        "brain": hydrated_brain_results,
    }

    print(json.dumps({'found_clips': clips}))

    store_in_db(key, clips)
    print(json.dumps({"event_published": sendSnsMessage(
        key, THUMBNAIL_GENERATOR_TOPIC)}))
    return clips
