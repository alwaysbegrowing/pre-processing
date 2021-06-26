import json
import streamlink
import os
import time
from db import connect_to_db
from bson.json_util import dumps, loads

f = open('data.json')
data = json.load(f)

TWITCH_BASE_URL = "https://twitch.tv/videos/"

videoId = "1024956589"

def get_clips_from_db(videoId):
    db = connect_to_db()
    search = {"videoId": videoId}

    result = db.timestamps.find_one(search, {"clips.brain"})["clips"]["brain"]
    print(result)

    return result

def get_manifest_url(stream_url):
    s = streamlink.streams(stream_url)
    high_quality_manifest = s['best']
    return high_quality_manifest.url

def generate_thumbnails(videoId):
    clip_data = get_clips_from_db(videoId)

    stream_url = TWITCH_BASE_URL + videoId
    high_quality_manifest_url = get_manifest_url(stream_url)

    # OPTIONAL : to make code more readable, can use this instead of a subprocess call https://github.com/kkroening/ffmpeg-python/blob/master/examples/README.md#generate-thumbnail-for-video
    for clip in clip_data:
        formatted_timestamp = time.strftime('%H:%M:%S', time.gmtime(int(clip["startTime"])))
        output_filename = f"{videoId}-{clip['startTime']}-{clip['endTime']}.jpg"
        ffmpeg_command = f"ffmpeg -ss {formatted_timestamp} -i {high_quality_manifest_url} -vframes 1 -q:v 2 {output_filename}"
        os.system(ffmpeg_command)
        # TODO upload to s3 bucket
        # TODO save s3 url to mongo
    f.close()

if __name__ == "__main__":
    generate_thumbnails(videoId)
    # get_clips_from_db(videoId)
    # get_manifest_url(TWITCH_BASE_URL + videoId)