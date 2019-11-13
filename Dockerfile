# Build command: docker build --build-arg GITHUB_SSH_KEY -t mdg-php .
FROM php:7.2-zts-stretch

ARG GITHUB_SSH_KEY
ENV GITHUB_SSH_KEY=$GITHUB_SSH_KEY
ENV WL_REPO_SSHKEY=$GITHUB_SSH_KEY

RUN apt-get update && apt-get install curl
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get update && apt-get install -y curl libyaml-dev git nodejs ruby python3 python3-pip

# PHP
RUN cp /usr/local/etc/php/php.ini-development /usr/local/etc/php/php.ini
RUN pecl channel-update pecl.php.net
RUN echo | pecl install channel://pecl.php.net/yaml-2.0.2
RUN git clone https://github.com/krakjoe/pthreads.git
RUN cd pthreads \
    && git checkout 6c6b15138c923b69cfa46ee05fc2dd45da587287 \
    && phpize && ./configure && make && make install \
    && cd .. && echo "extension=pthreads.so" >> \
        /usr/local/etc/php/php.ini
        # ~/.phpenv/versions/$(phpenv version-name)/etc/php.ini

WORKDIR /home

# Ruby
RUN gem install bundler

# Python
RUN ln -s /usr/bin/pip3 /usr/bin/pip
RUN pip install requests

# NodeJS
# RUN npm install -g mermaid.cli

# run.sh
ADD docker/run.sh /home/run.sh
RUN chmod +x /home/run.sh