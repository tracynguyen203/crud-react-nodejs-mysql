#!/bin/sh
set -eu
# Escape characters that could break out of the JS string
SAFE_URL=$(printf '%s' "${API_URL:-http://localhost:3001}" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf 'window._env_ = { API_URL: "%s" };\n' "$SAFE_URL" > /usr/share/nginx/html/config.js
echo "runtime config: API_URL=$SAFE_URL"
