#/bin/python3

import argparse
import sys
import os
import json
import requests
from pprint import pprint


def get_git_info_filename():
    content = ""
    with open('buildscripts/info-files.json', 'r') as info_file:
        content = json.loads(info_file.read())
    return content['git-info-file']


def parse_git_info(filename):
    content = ""
    with open(filename, 'r') as git_info_file:
        content = json.loads(git_info_file.read())
    git_info = {}
    git_info['author'] = content['commit_author']
    git_info['branch'] = content['branch']
    git_info['commit_hash'] = content['commit_hash']
    # pprint(git_info)
    return git_info


def git_info_to_str(git_info, json=True):
    message = """*Branch:* {branch} (<https://github.com/wirecard/merchant-documentation-gateway/tree/{branch}|On Github>)
*Commit:* `{hash}` (<https://github.com/wirecard/merchant-documentation-gateway/commit/{hash}|On Github>)
*Commit from:* {author}
*Partner:* {partner}""".format(branch=git_info['branch'], hash=git_info['commit_hash'],
                               author=git_info['author'], partner=os.environ.get('PARTNER'))
    if json:
        return {"type": "section", "text": {"type": "mrkdwn", "text": message}}
    else:
        return message


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
        print("##### Message:")
        print(message)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("message", type=str, nargs='?',
                        help="Message to send to Slack channel")
    parser.add_argument("-f", "--file", type=str,
                        help="Read from file instead of argument or stdin")
    parser.add_argument("-d", "--debug", action='store_true',
                        default=False, help="Print message to stdout as well")
    parser.add_argument("-p", "--parse-git-info", action='store_true',
                        default=False, help="Add a header containing git information")
    args = parser.parse_args()

    message = ""
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            message = f.read()
    elif args.message:
        message = args.message
    else:
        message = "".join(sys.stdin.readlines())

    header = None
    if args.parse_git_info:
        git_info = parse_git_info(get_git_info_filename())
        try:
            json_msg = json.loads(message)
            header = git_info_to_str(git_info)
            json_msg['blocks'].insert(0, {"type": "divider"})
            json_msg['blocks'].insert(0, header)
            final_msg = json.dumps(json_msg)
        except json.JSONDecodeError as e:
            if args.debug:
                print(e)
            header = git_info_to_str(git_info)
            blocks = {'blocks': [
                header,
                {'type': 'divider'},
                {'type': 'section', 'text': {'type': 'mrkdwn', 'text': message}}
            ]}
            final_msg = json.dumps(blocks)


    if args.debug:
        print(final_msg)
        print()

    post_to_slack(final_msg)


if __name__ == "__main__":
    main()
