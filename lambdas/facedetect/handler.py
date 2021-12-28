import asyncio
import math

from detect_faces import detect_video_faces, point_range, remove_outliers


def handler(event, context):

    video_id = event.get('videoId')
    
    if not video_id:
        raise Exception('video_id is required')

    # get the image data using asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    # this is a simple way to await outside of the asyncio loop
    results = loop.run_until_complete(detect_video_faces(video_id))
    asyncio.set_event_loop(None)
    
    points = [box for boxes in results for box in boxes]

    filtered_points = remove_outliers(points, iterations=3)

    min_x, min_y, max_w, max_h = point_range(filtered_points)

    x = min_x
    y = min_y
    width = max_w
    height = max_h

    x2 = x + width
    y2 = y + height

    center_x = (x + x2) / 2
    center_y = (y + y2) / 2

    box_width = width * 2
    box_height = math.floor(box_width * .75)

    start_x = math.floor(center_x - box_width / 2)
    start_y = math.floor(center_y - box_height / 2)

    if start_x + box_width > 1920:
        start_x = 1920 - box_width
    
    if start_y + box_height > 1080:
        start_y = 1080 - box_height

    return {
        'x': int(start_x),
        'y': int(start_y),
        'width': int(box_width),
        'height': int(box_height)
    }

if __name__=="__main__":
    import json
    import os

    # open the environment variables file
    with open(os.path.join('..', '..', 'env.json')) as f:
        data = json.load(f)
        env = data.get('MobileAutoExporter71AC9FF3')

    # load the environment variables
    for key, value in env.items():
        os.environ[key] = value

    with open(os.path.join('..', '..', 'test_events', 'mobileAutoExportEvent.json')) as f:
        event = json.load(f)
    
    context = None
    print(handler(event, context))
