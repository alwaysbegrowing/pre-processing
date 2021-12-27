import asyncio
import math
import os
import time

from pymongo import MongoClient
import cv2
import numpy
import httpx

from get_secret import get_secret

scale_factor = 1.2
min_neighbors = 3
min_size = (50, 50)

# async processing of images
async def detect_faces(frame_path):
    frame = cv2.imread(frame_path)
    if frame is None:
        return []
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_alt2.xml'))
    faces = cascade.detectMultiScale(gray, scaleFactor=scale_factor, minNeighbors=min_neighbors, minSize=min_size)
    return faces

# async file downloader
async def download_file(url, name):
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        with open(name, 'wb') as f:
            f.write(response.content)

async def detect_video_faces(video_id):

    PREFIX = "/tmp"

    if os.getenv("TESTING") == "true":
        if not os.path.isdir('./tmp'):
            os.mkdir("./tmp")
        PREFIX = "./tmp"
    
    print("Clearing directory...")

    thumbs = os.listdir(PREFIX)

    if len(thumbs):
        # clear thumbnails
        for thumb in thumbs:
            os.remove(PREFIX + '/' + thumb)

    print("Getting images...")
    urls = get_image_urls(video_id)

    print("Downloading images...")
    download_tasks = []
    for url in urls:
        download_tasks.append(download_file(url, PREFIX + '/' + url.split('/')[-1]))
    
    await asyncio.gather(*download_tasks)

    print("Detecting faces...")

    frame_paths = [os.path.join(PREFIX, f) for f in os.listdir(PREFIX)]

    print("Running tasks...")
    start = time.time()
    tasks = []

    for frame_path in frame_paths:
        tasks.append(detect_faces(frame_path))

    results = await asyncio.gather(*tasks)

    end = time.time()
    print(f"Finished OpenCV Tasks in {round(end - start, 2)} seconds")

    # make sure directory is empty before finish
    thumbs = os.listdir(PREFIX)
    if len(thumbs):
        # clear thumbnails
        for thumb in thumbs:
            os.remove(PREFIX + '/' + thumb)

    return results

def get_image_urls(video_id):
    # environment variables loaded here to make
    # debugging locally easier
    MONGO_URI = get_secret(os.getenv("MONGODB_FULL_URI_ARN"))
    MONGO_DB_NAME = os.getenv("DB_NAME")

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
    max_w = max(ws)
    max_h = max(hs)

    return (min_x, min_y, max_w, max_h)

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
