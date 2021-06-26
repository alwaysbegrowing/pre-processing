import os

import pymongo
import boto3

cached_uri = None
cached_db = None

# secret_name = 'MONGODB_FULL_URI'
secret_name = 'mongodb+srv://admin:ADTPNb1cIA2pltrr@c0.relki.mongodb.net/?authSource=admin&replicaSet=atlas-sgjzhe-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true'
db_name = os.getenv('DB_NAME') or 'pillar'

def connect_to_db():
    global cached_uri
    global cached_db
    if (cached_db):
        return cached_db

    # if (not cached_uri):
    #     session = boto3.session.Session()
    #     client = session.client(
    #         service_name='secretsmanager'
    #     )
    #     cached_uri = client.get_secret_value(
    #         SecretId=secret_name)['SecretString']
    cached_uri = secret_name
    client = pymongo.MongoClient(cached_uri)
    db = client[db_name]
    return db
