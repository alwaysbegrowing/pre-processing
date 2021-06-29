import os

import pymongo
import boto3

cached_uri = None
cached_db = None

secret_name = 'MONGODB_FULL_URI'
db_name = os.getenv('DB_NAME') or 'pillar'

def connect_to_db():
    global cached_uri
    global cached_db
    if (cached_db):
        return cached_db

    if (not cached_uri):
        session = boto3.session.Session(region_name='us-east-1')
        client = session.client(
            service_name='secretsmanager'
        )
        cached_uri = client.get_secret_value(
            SecretId=secret_name)['SecretString']
    # cached_uri = secret_name

    client = pymongo.MongoClient(cached_uri)
    db = client[db_name]
    return db

def input_thumbnail_urls(key, thumbnail_data):
    db = connect_to_db()
    query = {'videoId': key}
    timestamps = db.timestamps

    update = {
        '$set': {
            'thumbnails': thumbnail_data
        },
    }
    result = timestamps.update_one(query, update, upsert=True)

    return result