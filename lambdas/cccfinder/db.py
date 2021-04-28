import pymongo
import boto3

cached_uri = None
cached_db = None

secret_name = 'MONGODB_FULL_URI'


def connect_to_db():
    global cached_uri
    global cached_db
    if (cached_db):
        return cached_db

    if (not cached_uri):
        session = boto3.session.Session()
        client = session.client(
            service_name='secretsmanager'
        )
        cached_uri = client.get_secret_value(
            SecretId=secret_name)['SecretString']
    client = pymongo.MongoClient(cached_uri)
    db = client.pillar
    return db

def input_ccc(key, ccc_data):
    db = connect_to_db()
    query = {'videoId': key}
    timestamps = db.timestamps
    db_obj = timestamps.find_one(query)

    result = None

    if db_obj is None:
        print('Not found in database, adding....')
        clips = {
            'videoId': key,
            'clips': {
                'ccc': ccc_data
            }
        }
        result = timestamps.insert_one(clips)
    else:
        print('Updating existing record...')
        clips = db_obj['clips']
        clips['ccc'] = ccc_data
        update = {
            '$set': {
                'clips': clips
            },
        }
        result = timestamps.update_one(query, update, upsert=True)
    return result