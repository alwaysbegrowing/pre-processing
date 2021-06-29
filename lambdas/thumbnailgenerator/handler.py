import json
import streamlink
import os
import time
from db import connect_to_db, input_thumbnail_urls
from bson.json_util import dumps, loads
import boto3
from botocore.exceptions import ClientError

AWS_BUCKET = os.getenv('BUCKET')

TWITCH_BASE_URL = "https://twitch.tv/videos/"

def upload_to_s3(file_name, bucket, object_name=None):
    """Upload a file to an S3 bucket

    :param file_name: File to upload
    :param bucket: Bucket to upload to
    :param object_name: S3 object name. If not specified then file_name is used
    :return: True if file was uploaded, else False
    """

    if object_name is None:
        object_name = file_name

    s3_client = boto3.client('s3')
    try:
        response = s3_client.upload_file(file_name, bucket, object_name, ExtraArgs={'ACL': 'public-read'})
    except ClientError as e:
        print(e)
        return False
    return True

def get_clips_from_db(videoId: str):
    db = connect_to_db()
    timestamps = db['timestamps']

    search = {"videoId": videoId }

    result = timestamps.find_one(search)
    print(result)
    video_timestamps = result['clips']['brain']
    return video_timestamps

def get_manifest_url(stream_url):
    s = streamlink.streams(stream_url)
    high_quality_manifest = s['best']
    return high_quality_manifest.url

def generate_thumbnails(videoId: str):
    os.chdir('/tmp')

    clip_data = get_clips_from_db(videoId)
    if clip_data is None:
        print('No clip data found.')
        return

    stream_url = TWITCH_BASE_URL + videoId
    high_quality_manifest_url = get_manifest_url(stream_url)
    thumbnail_urls = {}

    # OPTIONAL : to make code more readable, can use this library instead of a subprocess call https://github.com/kkroening/ffmpeg-python/blob/master/examples/README.md#generate-thumbnail-for-video
    for clip in clip_data:
        formatted_timestamp = time.strftime('%H:%M:%S', time.gmtime(int(clip["startTime"])))
        clip_id = f"{videoId}-{clip['startTime']}-{clip['endTime']}"
        output_filename = f"{clip_id}.jpg"
        ffmpeg_command = f"ffmpeg -ss {formatted_timestamp} -i {high_quality_manifest_url} -vframes 1 -q:v 2 {output_filename}"
        os.system(ffmpeg_command)

        if(upload_to_s3(output_filename, AWS_BUCKET)):
            s3_url = f"https://{AWS_BUCKET}.s3.amazonaws.com/{output_filename}"
            thumbnail_urls[clip_id] = s3_url
            os.remove(output_filename)
        else:
            print(json.dumps({'error_uploading_thumbnail_to_s3': output_filename, "s3_url": s3_url}))
            continue

    input_thumbnail_urls(videoId, thumbnail_urls)

def handler(event, context):
    video_id = event['Records'][0]['Sns']['Message']
    print(video_id)
    generate_thumbnails(str(video_id))
    return {}
