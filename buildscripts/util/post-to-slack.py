#/bin/python3

import argparse
import sys
import os
import json
import requests


def post_to_slack(message):
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
    r = requests.post(URL + SLACK_TOKEN, data=message,
                      headers={'Content-Type': 'application/json'})

    if r.status_code == 200:
        sys.exit(0)
    else:
        print("* Error sending message (status_code: {})".format(r.status_code))
        print(r.text)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("message", type=str, nargs='?', help="Message to send to Slack channel")
    args = parser.parse_args()

    message = ""
    if args.message == None:
        message = "".join(sys.stdin.readlines())
    else:
        message = args.message

    post_to_slack(message)


if __name__ == "__main__":
    main()
