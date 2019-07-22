#!/bin/bash

CONFIG_FILE="config/mermaid-default-theme.json"
mkdir -p config

echo -n '{
    "theme": null,
    "themeCSS": "' > "${CONFIG_FILE}"
{ tr -d '\r\n' < css/wirecard-font-base64.css; sed 's/"/\\"/g' css/mermaid.css | tr -d '\r\n' | tr -s ' '; } >> "${CONFIG_FILE}"
echo '"}' >> "${CONFIG_FILE}"