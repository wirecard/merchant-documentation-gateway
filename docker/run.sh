#/bin/bash

set -e

MDG_DIR="merchant-documentation-gateway"
if [[ -d "$MDG_DIR" ]]; then
    git clone --branch=Dockerfile-tmp https://github.com/wirecard/merchant-documentation-gateway/
    cd "$MDG_DIR"
else
    cd "$MDG_DIR"
    git pull
fi

npm install
gem install bundler && bundle install
pip3 install -r requirements.txt
pip3 install requests

export PATH="node_modules/.bin:${PATH}"

echo "yes" | bash buildscripts/main.sh --skip-nova