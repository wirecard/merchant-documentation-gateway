# Build command: docker build --build-arg GITHUB_SSH_KEY -t mdg-php .
FROM php:7.2-zts-stretch

ARG GITHUB_SSH_KEY
ENV GITHUB_SSH_KEY=${GITHUB_SSH_KEY}
ENV WL_REPO_SSHKEY=${GITHUB_SSH_KEY}

ARG SLACK_TOKEN
ENV SLACK_TOKEN=${SLACK_TOKEN}

RUN apt-get update && apt-get install -y curl vim git
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get update && apt-get install -y libyaml-dev nodejs ruby python3 python3-pip

# PHP
RUN cp /usr/local/etc/php/php.ini-development /usr/local/etc/php/php.ini
RUN pecl channel-update pecl.php.net
RUN echo | pecl install channel://pecl.php.net/yaml-2.0.2
RUN git clone https://github.com/krakjoe/pthreads.git
RUN cd pthreads && git checkout 6c6b15138c923b69cfa46ee05fc2dd45da587287 \
    && phpize && ./configure && make && make install && cd .. \
    && echo "extension=pthreads.so" >> /usr/local/etc/php/php.ini

# X server stuff
RUN apt-get install -y \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libnspr4 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget \
    xvfb x11vnc x11-xkb-utils xfonts-100dpi xfonts-75dpi xfonts-scalable xfonts-cyrillic x11-apps


# non-root user
RUN useradd --create-home --shell /bin/bash tecdoc

# run.sh
ADD docker/run.sh /home/tecdoc/run.sh
RUN chmod +x /home/tecdoc/run.sh

# switch user and workdir
USER tecdoc
ENV HOME="/home/tecdoc"
ENV GEM_HOME="$HOME/.gem"
ENV PATH="$HOME/mdg/node_modules/.bin:$HOME/merchant-documentation-gateway/node_modules/.bin:$HOME/.gem/bin:${PATH}"
WORKDIR $HOME
