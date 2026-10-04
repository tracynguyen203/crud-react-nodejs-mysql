#!/bin/sh
# Runs inside node:20-alpine.  /src = repo (read-only)   /out = reports/web on the Jenkins workspace
mkdir -p /app /out/coverage
cp -r /src/web/. /app/ && cd /app || exit 1
npm ci --no-audit --no-fund || exit 1
CI=true npm test; rc=$?
cp reports/junit.xml /out/ 2>/dev/null
[ -f coverage/lcov.info ] && sed 's#^SF:#SF:web/#' coverage/lcov.info > /out/coverage/lcov.info
exit $rc
