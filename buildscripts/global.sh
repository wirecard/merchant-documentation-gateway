#!/bin/bash

function debugMsg() {
  [[ ${DEBUG} ]] && echo "[$(date +'%T')] ${1}" >&2
}