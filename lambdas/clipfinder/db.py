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
    print(cached_uri)
    client = pymongo.MongoClient(cached_uri)
    db = client['pillar']
    return db