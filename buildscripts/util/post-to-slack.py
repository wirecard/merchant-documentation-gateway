#/bin/python3

import sys
import os
import json
import requests

if len(sys.argv) == 1:
    print("Usage: {} <message in JSON>".format(sys.argv[0]))
    sys.exit(1)

message = sys.argv[1]
URL = 'https://hooks.slack.com/services/'
SLACK_TOKEN = os.getenv('SLACK_TOKEN')
if SLACK_TOKEN is None:
    print("##########################")
    print("# No Slack Token in ENV! #")
    print("# printing to stdout     #")
    print("##########################")
    print(message)
    sys.exit(0)

print(URL + SLACK_TOKEN)
r = requests.post(URL + SLACK_TOKEN, data=message, headers={'Content-Type': 'application/json'})

if r.status_code == 200:
    sys.exit(0)
else:
    print("* Error sending message (status_code: {})".format(r.status_code))
    print(r.text)
    sys.exit(1)
