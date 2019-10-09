# Wrapper for CI Systems to avoid aborts

#### CONFIG #####

BUILDSCRIPT="./buildscripts/main.sh"
TIMEOUT_MINUTES=30

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

exit 0