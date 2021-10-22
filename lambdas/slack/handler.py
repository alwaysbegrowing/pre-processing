import urllib3
import json

http = urllib3.PoolManager()
def handler(event, context):
    print(json.dumps(event))
    url = os.getenv('SLACK_WEBHOOK_URL')
    msg = {
        "channel": "#pillar-robots",
        "username": "AWS Errors",
        "text": json.dumps(event, indent=4),
        "icon_emoji": ""
    }
    encoded_msg = json.dumps(msg).encode('utf-8')
    resp = http.request('POST',url, body=encoded_msg)
    print({
        "message": event, 
        "status_code": resp.status, 
        "response": resp.data
    })