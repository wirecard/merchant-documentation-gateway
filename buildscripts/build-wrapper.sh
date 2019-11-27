# Wrapper for CI Systems to avoid aborts

#### CONFIG #####

BUILDSCRIPT="./buildscripts/main.sh"
TIMEOUT_MINUTES=60

## END CONFIG ##

chmod +x ${BUILDSCRIPT}
${BUILDSCRIPT} &
MAIN_PID=$!

RED='\033[0;31m'
MINUTES_COUNTER=0

while kill -0 ${MAIN_PID} >&/dev/null; do
  echo -n -e " \b"
  if [[ ${MINUTES_COUNTER} == ${TIMEOUT_MINUTES} ]]; then
    echo -e "\n"
    echo -e "${RED}Wrapper script: timeout reached: ${TIMEOUT_MINUTES} minutes"
    exit 1
  fi
  MINUTES_COUNTER=$((MINUTES_COUNTER+1))
  sleep 1m
done

wait ${MAIN_PID}

EXIT_CODE=$?

if (( EXIT_CODE > 0 )); then
  echo "*Build failed*. Check the <${TRAVIS_JOB_WEB_URL}|Travis Log> for details! " | python3 buildscripts/util/post-to-slack.py -d -p
fi

exit ${EXIT_CODE}
