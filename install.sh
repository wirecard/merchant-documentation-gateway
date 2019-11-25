#!/bin/bash

rm -rf node_modules/puppeteer
npm install

gem install bundler && bundle install
# Workaround for new asciidoctor-diagram version
gem install specific_install && \
    gem specific_install -l https://github.com/asciidoctor/asciidoctor-diagram \
                         -r 34a54807d287b8531ac8d4d33c2b5988788109fc
pip3 install -r requirements.txt