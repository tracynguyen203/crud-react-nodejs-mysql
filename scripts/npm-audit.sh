#!/bin/sh
# Dependency vulnerability check for PRODUCTION dependencies (fails on HIGH+).
rc=0
: > /out/npm-audit.txt
for d in api web; do
  mkdir -p /tmp/$d && cp /src/$d/package.json /src/$d/package-lock.json /tmp/$d/
  echo "===== npm audit: $d (production dependencies) =====" >> /out/npm-audit.txt
  (cd /tmp/$d && npm audit --omit=dev --audit-level=high) >> /out/npm-audit.txt 2>&1 || rc=1
done
cat /out/npm-audit.txt
exit $rc
