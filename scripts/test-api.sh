#!/bin/sh
# Runs inside node:20-alpine.  /src = repo (read-only)   /out = reports/api on the Jenkins workspace
mkdir -p /app /out/coverage
cp -r /src/api/. /app/ && cd /app || exit 1
npm ci --no-audit --no-fund || exit 1
npm test; rc=$?
cp reports/junit.xml /out/ 2>/dev/null
# make lcov paths relative to the repo root so SonarQube can match them
[ -f coverage/lcov.info ] && sed 's#^SF:#SF:api/#' coverage/lcov.info > /out/coverage/lcov.info
exit $rc
