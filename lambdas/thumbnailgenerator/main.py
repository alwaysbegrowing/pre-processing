import json
import streamlink
import os
import time
from db import connect_to_db, input_thumbnail_urls
from bson.json_util import dumps, loads
import boto3
from botocore.exceptions import ClientError

AWS_BUCKET = "prod-prodthumbnails"

TWITCH_BASE_URL = "https://twitch.tv/videos/"

videoId = "1024956589"
# file_name = '1024956589-29604.052-29647.544.jpg'

# s3 = boto3.connect_s3(AWS_ACCESS_KEY_ID,
#                       AWS_SECRET_ACCESS_KEY)

def upload_to_s3(file_name, bucket, object_name=None):
    """Upload a file to an S3 bucket

    :param file_name: File to upload
    :param bucket: Bucket to upload to
    :param object_name: S3 object name. If not specified then file_name is used
    :return: True if file was uploaded, else False
    """

    # If S3 object_name was not specified, use file_name
    if object_name is None:
        object_name = file_name

    # Upload the file
    s3_client = boto3.client('s3')
    try:
        response = s3_client.upload_file(file_name, bucket, object_name, ExtraArgs={'ACL': 'public-read'})
    except ClientError as e:
        logging.error(e)
        return False
    return True

def get_clips_from_db(videoId):
    db = connect_to_db()
    search = {"videoId": videoId}

    result = db.timestamps.find_one(search, {"clips.brain"})["clips"]["brain"]

    return result

def get_manifest_url(stream_url):
    s = streamlink.streams(stream_url)
    high_quality_manifest = s['best']
    return high_quality_manifest.url

def generate_thumbnails(videoId):
    clip_data = get_clips_from_db(videoId)
    stream_url = TWITCH_BASE_URL + videoId
    high_quality_manifest_url = get_manifest_url(stream_url)
    thumbnail_urls = {}

    # OPTIONAL : to make code more readable, can use this instead of a subprocess call https://github.com/kkroening/ffmpeg-python/blob/master/examples/README.md#generate-thumbnail-for-video
    for clip in clip_data:
        formatted_timestamp = time.strftime('%H:%M:%S', time.gmtime(int(clip["startTime"])))
        clip_id = f"{videoId}-{clip['startTime']}-{clip['endTime']}"
        output_filename = f"{clip_id}.jpg"
        ffmpeg_command = f"ffmpeg -ss {formatted_timestamp} -i {high_quality_manifest_url} -vframes 1 -q:v 2 {output_filename}"
        # TODO possible bug for below command: if duplicate file is found the terminal asks for user input to confirm if it should replace the existing file. if the dialog opens on the lambda, the lambda may time out
        os.system(ffmpeg_command)
        if(upload_to_s3(output_filename, AWS_BUCKET)):
            s3_url = f"https://{AWS_BUCKET}.s3.amazonaws.com/{output_filename}"
            thumbnail_urls[clip_id] = s3_url
            os.remove(output_filename)
        else:
            print(json.dumps({'error_uploading_thumbnail_to_s3': output_filename, "s3_url": s3_url}))
            continue
    input_thumbnail_urls(videoId, thumbnail_urls)

if __name__ == "__main__":
    generate_thumbnails(videoId)
    # print(upload_to_s3(file_name, AWS_BUCKET))
    # get_clips_from_db(videoId)
    # get_manifest_url(TWITCH_BASE_URL + videoId)