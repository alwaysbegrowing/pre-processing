import json
import streamlink
import os
import time
from bson.json_util import dumps, loads
import boto3
import uuid


cant_make_thumbnail_subscriber_only_vod_thumbnail = "https://apppillargg-misc-assets.s3.amazonaws.com/Can't+Made+Thumbnail+for+Subscribe+only+Vods.png"
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
    s3_client.upload_file(file_name, bucket, object_name,
                          ExtraArgs={'ACL': 'public-read'})
    return True


def get_manifest_url(stream_url):
    print(f'about to get download url for {stream_url}')
    try:
        s = streamlink.streams(stream_url)
    except streamlink.PluginError as e:
        print(f'error getting download url: {e}')
        return None
    best = s.get('best')
    if not best:
        return s.get('source').url
    print('got url {best.url}')
    return best.url


def generate_thumbnails(url: str, clips: list[dict]):

    if not url:
        return [cant_make_thumbnail_subscriber_only_vod_thumbnail for _ in clips]

    os.chdir('/tmp')
    thumbnail_urls = []
    # OPTIONAL : to make code more readable, can use this library instead of a subprocess call https://github.com/kkroening/ffmpeg-python/blob/master/examples/README.md#generate-thumbnail-for-video
    for clip in clips:
        formatted_timestamp = time.strftime(
            '%H:%M:%S', time.gmtime(int(clip["startTime"])))
        clip_id = str(uuid.uuid4())
        output_filename = f"{clip_id}.jpg"
        ffmpeg_command = f"ffmpeg -ss {formatted_timestamp} -i {url} -vframes 1 -q:v 2 {output_filename}"
        print(ffmpeg_command)
        os.system(ffmpeg_command)

        upload_to_s3(output_filename, AWS_BUCKET)
        s3_url = f"https://{AWS_BUCKET}.s3.amazonaws.com/{output_filename}"
        thumbnail_urls.append(s3_url)
        os.remove(output_filename)

    return thumbnail_urls


def handler(event, context):
    print(json.dumps(event, default=str))
    video_id = event['videoId']
    clips_by_type = event['clips']

    stream_url = TWITCH_BASE_URL + video_id
    high_quality_manifest_url = get_manifest_url(stream_url)
    thumbnail_urls = [generate_thumbnails(
        high_quality_manifest_url, clips) for clips in clips_by_type]
    return thumbnail_urls
