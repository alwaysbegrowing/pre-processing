import asyncio
import math
import os
import time

from pymongo import MongoClient
import cv2
import numpy

scale_factor = 1.2
min_neighbors = 3
min_size = (50, 50)

PREFIX = "/tmp"
MONGO_URI = os.getenv("MONGODB_FULL_URI")
MONGO_DB_NAME = os.getenv("DB_NAME")

async def detect_faces(frame_path):
    frame = cv2.imread(frame_path)
    if frame is None:
        return []
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier('data/haarcascade/haarcascade_frontalface_alt2.xml')
    faces = cascade.detectMultiScale(gray, scaleFactor=scale_factor, minNeighbors=min_neighbors, minSize=min_size)
    return faces

async def main(video_id):

    print("Clearing directory...")

    thumbs = os.listdir("/tmp")

    if len(thumbs):
        # clear thumbnails
        for thumb in thumbs:
            os.remove(PREFIX + '/' + thumb)

    print("Getting images...")
    urls = get_image_urls(video_id)

    # download using requests

    frame_paths = [os.path.join(PREFIX, f) for f in os.listdir(PREFIX)]

    print("Running tasks...")
    start = time.time()
    tasks = []

    for frame_path in frame_paths:
        tasks.append(detect_faces(frame_path))

    results = await asyncio.gather(*tasks)

    end = time.time()
    print(f"Finished OpenCV Tasks in {round(end - start, 2)} seconds")
    return results

def get_image_urls(video_id):
    # open a database connection
    client = MongoClient(MONGO_URI)
    
    # connect to the database
    db = client[MONGO_DB_NAME]

    # get the data from the clip_metadata collection
    clip_metadata = db.clip_metadata

    # get the clip metadata
    clip_data = clip_metadata.find_one({"videoId": video_id})

    clips = clip_data["clips"]

    urls = []

    for clip in clips:
        url = clip.get('thumbnail_url')
        if url:
            # makes sure its one of our
            # s3 URLS
            if 'amazon' in url:
                urls.append(url)
    
    return urls

def point_median(points):
    xs = [x for (x, _, _, _) in points]
    ys = [y for (_, y, _, _) in points]
    ws = [w for (_, _, w, _) in points]
    hs = [h for (_, _, _, h) in points]
    median_x = numpy.median(xs)
    median_y = numpy.median(ys)
    median_width = numpy.median(ws)
    median_height = numpy.median(hs)
    return (median_x, median_y, median_width, median_height)

def point_range(points):
    xs = [x for (x, _, _, _) in points]
    ys = [y for (_, y, _, _) in points]
    ws = [w for (_, _, w, _) in points]
    hs = [h for (_, _, _, h) in points]

    min_x = min(xs)
    min_y = min(ys)
    max_x = max(xs)
    max_y = max(ys)
    min_w = min(ws)
    min_h = min(hs)
    max_w = max(ws)
    max_h = max(hs)

    return (min_x, min_y, max_x, max_y, min_w, min_h, max_w, max_h)

def remove_outliers(points, iterations=1):
    xs = [x for (x, _, _, _) in points]
    ys = [y for (_, y, _, _) in points]
    median_x, median_y, _, _ = point_median(points)
    std_x = numpy.std(xs)
    std_y = numpy.std(ys)

    final = []

    for (x, y, w, h) in points:
        if abs(x - median_x) > std_x * iterations or abs(y - median_y) > std_y * iterations:
            continue
        final.append((x, y, w, h))

    if iterations <= 1:
        return final

    return remove_outliers(final, iterations - 1)

def async_handler(video_path):
    loop = asyncio.get_event_loop()
    results = loop.run_until_complete(main(video_path))
    
    points = [box for boxes in results for box in boxes]

    filtered_points = remove_outliers(points, iterations=3)

    min_x, min_y, max_x, _, _, _, max_w, max_h = point_range(filtered_points)

    cam_box_x = min_x - (max_w / 1.5)
    cam_box_y = min_y - (max_h / 4)
    cam_box_x2 = max_x + max_w + (max_w / 1.5)

    width = cam_box_x2 - cam_box_x
    height = width * 0.75

    cam_box_y2 = cam_box_y + height

    return (math.floor(cam_box_x), math.floor(cam_box_y), math.floor(cam_box_x2), math.floor(cam_box_y2))
