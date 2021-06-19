import json
import streamlink
import os
import time

f = open('data.json')
data = json.load(f)

TWITCH_BASE_URL = "https://twitch.tv/videos/"

def generate_thumbnails(clip_data):
    videoId = clip_data["videoId"]
    stream_url = TWITCH_BASE_URL + videoId
    # get manifest url for the stream_url
    # TODO UNCOMMENT this + test on non-airplane wifi
#     s = streamlink.streams(stream_url)
#     high_quality_manifest = s['best']
    high_quality_manifest = "https://d2vjef5jvl6bfs.cloudfront.net/6cf82e20ebec88feebc9_nmplol_42448051661_1624107586/chunked/index-dvr.m3u8"
    # OPTIONAL : to make code more readable, can use this instead of a subprocess call https://github.com/kkroening/ffmpeg-python/blob/master/examples/README.md#generate-thumbnail-for-video
    for clip in clip_data["clips"]["brain"]:
        formatted_timestamp = time.strftime('%H:%M:%S', time.gmtime(int(clip["startTime"])))
        output_filename = f"{videoId}-{clip['startTime']}-{clip['endTime']}.jpg"
        ffmpeg_command = f"ffmpeg -ss {formatted_timestamp} -i {high_quality_manifest} -vframes 1 -q:v 2 {output_filename}"
        os.system(ffmpeg_command)
        # TODO upload to s3 bucket
        # TODO save s3 url to mongo
    f.close()

if __name__ == "__main__":
    generate_thumbnails(data)