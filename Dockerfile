FROM ubuntu:latest

RUN apt update -y && apt install -y curl git
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt install -y ruby-full nodejs python3-pip

ADD . /mdg
WORKDIR /mdg

RUN gem install bundler
RUN bundle install
RUN npm install
RUN pip3 install -r requirements.txt