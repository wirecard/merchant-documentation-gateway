#!/bin/bash

CONFIG_FILE="config/mermaid-default-theme.json"
mkdir -p config

echo -n '{
    "theme": null,
    "themeCSS": "' > "${CONFIG_FILE}"
# cat css/wirecard-font-base64.css >> "${CONFIG_FILE}"
cat css/mermaid.css | sed 's/"/\\"/g' | tr -d '\n' | tr -s ' ' >> "${CONFIG_FILE}"
echo '"}' >> "${CONFIG_FILE}"