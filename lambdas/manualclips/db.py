import os

import pymongo

from get_secret import get_secret

cached_uri = None
cached_db = None

secret_name = 'MONGODB_FULL_URI'
db_name = os.getenv('DB_NAME')

def connect_to_db():
    global cached_uri
    global cached_db
    if (cached_db):
        return cached_db

    if (not cached_uri):
        cached_uri = get_secret(secret_name)

    client = pymongo.MongoClient(cached_uri)
    db = client[db_name]
    return db

def save_clips(key, clip_data):
    db = connect_to_db()
    query = {'videoId': key}
    timestamps = db.timestamps
    
    update = {
        '$set': {
            'manual': clip_data
        },
    }
    result = timestamps.update_one(query, update, upsert=True)

    if result is None:
        doc = {
            'videoId': key,
            'manual': clip_data
        }
        result = timestamps.insert(doc)

    return result
