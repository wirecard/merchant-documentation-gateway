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

    response = requests.post(URL + SLACK_TOKEN, data=message.encode(),
                      headers={'Content-Type': 'application/json'})

    if response.status_code == 200:
        print("Message sent!")
        sys.exit(0)
    else:
        print("* Error sending message (status_code: {})".format(response.status_code))
        print(response.text)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("message", type=str, nargs='?', help="Message to send to Slack channel")
    parser.add_argument("-f", "--file", type=str, help="Read from file instead of argument or stdin")
    parser.add_argument("-d", "--debug", action='store_true', default=False, help="Print message to stdout as well")
    args = parser.parse_args()

    message = ""
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            message = f.read()
    elif args.message:
        message = args.message
    else:
        message = "".join(sys.stdin.readlines())

    if args.debug:
        print(message)
        print()

    post_to_slack(message)


if __name__ == "__main__":
    main()
