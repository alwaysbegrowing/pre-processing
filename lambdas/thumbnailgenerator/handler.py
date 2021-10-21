import json
import streamlink
import os
import time
from bson.json_util import dumps, loads
import boto3
from botocore.exceptions import ClientError
import itertools
import uuid

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

def get_manifest_url(stream_url):
    s = streamlink.streams(stream_url)
    best = s.get('best')
    if not best:
        return s.get('source').url
    return best.url

def generate_thumbnails(videoId: str, clips: list[dict]):
    os.chdir('/tmp')

    stream_url = TWITCH_BASE_URL + videoId
    high_quality_manifest_url = get_manifest_url(stream_url)
    thumbnail_urls = []

    # OPTIONAL : to make code more readable, can use this library instead of a subprocess call https://github.com/kkroening/ffmpeg-python/blob/master/examples/README.md#generate-thumbnail-for-video
    for clip in clips:
        formatted_timestamp = time.strftime('%H:%M:%S', time.gmtime(int(clip["startTime"])))
        clip_id = str(uuid.uuid4())
        output_filename = f"{clip_id}.jpg"
        ffmpeg_command = f"ffmpeg -ss {formatted_timestamp} -i {high_quality_manifest_url} -vframes 1 -q:v 2 {output_filename}"
        print(ffmpeg_command)
        os.system(ffmpeg_command)

        if(upload_to_s3(output_filename, AWS_BUCKET)):
            s3_url = f"https://{AWS_BUCKET}.s3.amazonaws.com/{output_filename}"
            thumbnail_urls.append(s3_url)
            os.remove(output_filename)
        else:
            print(json.dumps({'error_uploading_thumbnail_to_s3': output_filename, "s3_url": s3_url}))
            continue

    return thumbnail_urls

def handler(event, context):
    print(json.dumps(event, default=str))
    video_id = event['videoId']
    clips_by_type = event['clips']
    
    
    thumbnail_urls = [generate_thumbnails(video_id, clips) for clips in clips_by_type]
    return thumbnail_urls
