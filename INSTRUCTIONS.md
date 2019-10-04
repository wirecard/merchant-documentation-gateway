# Docker

## Build
```
docker build -t mdg .
```

## Run
First, create a environment file for docker. This file needs to include `WL_REPO_SSHKEY`, looks something like this:
```
WL_REPO_SSHKEY='<key>'
```
The correct name is `.env`. Make sure not to commit it.

```
docker run -v build:/tmp/build --env-file .env -it mdg /bin/bash
```
