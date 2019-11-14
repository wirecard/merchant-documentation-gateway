#/bin/bash

set -e

git clone https://github.com/wirecard/merchant-documentation-gateway/

cd merchant-documentation-gateway

npm install
gem install bundler && bundle install
pip3 install -r requirements.txt
pip3 install requests

export PATH="node_modules/.bin:${PATH}"

bash buildscripts/main.sh --skip-nova