import boto3


def get_secret(arn):
    client = boto3.client('secretsmanager')
    resp = client.get_secret_value(SecretId=arn)
    return resp.get('SecretString')
