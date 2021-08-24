import os

import pymongo

from get_secret import get_secret

cached_uri = None
cached_db = None

SECRET_NAME = 'MONGODB_FULL_URI'
DB_NAME = os.getenv('DB_NAME')
DEFAULT_CLIP_LENGTH = 120 # seconds

def connect_to_db():
    global cached_uri
    global cached_db
    if (cached_db):
        return cached_db

    if (not cached_uri):
        cached_uri = get_secret(SECRET_NAME)

    client = pymongo.MongoClient(cached_uri)
    db = client[DB_NAME]
    return db

# save clips to the database
def save_clips(key, clip_data):
    db = connect_to_db()
    query = {'videoId': key}
    timestamps = db.timestamps
    
    update = {
        '$set': {
            'videoId': key,
            'manual': clip_data
        },
    }
    result = timestamps.update_one(query, update, upsert=True)

    return result

# gets the clip length from the user
# in the database
def get_clip_length(key):
    db = connect_to_db()
    query = {'twitch_id': key}

    users = db.users

    user = users.find_one(query)
    
    if (user):
        return user.get('manual_clip_length', DEFAULT_CLIP_LENGTH)

    return None