#/bin/bash

git clone https://github.com/wirecard/merchant-documentation-gateway/

cd merchant-documentation-gateway

npm install
bundle install
pip3 install -r requirements.txt

bash buildscripts/main.sh --skip-nova