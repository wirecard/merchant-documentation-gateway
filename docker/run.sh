#/bin/bash

set -e

MDG_DIR="merchant-documentation-gateway"
if [[ ! -d "$MDG_DIR" ]]; then
    git clone --branch=Dockerfile https://github.com/wirecard/merchant-documentation-gateway/
    cd "$MDG_DIR"
else
    cd "$MDG_DIR"
    git pull
fi

npm install
gem install bundler && bundle install
# Workaround for new asciidoctor-diagram version
gem install specific_install && \
    gem specific_install -l https://github.com/asciidoctor/asciidoctor-diagram \
                         -r 34a54807d287b8531ac8d4d33c2b5988788109fc
pip3 install -r requirements.txt
pip3 install requests

export PATH="node_modules/.bin:${PATH}"

echo "yes" | bash buildscripts/main.sh --skip-nova