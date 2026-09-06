#!/usr/bin/env bash
set -euo pipefail
node --check app/data.js
node --check app/app.js
node --check server/server.mjs
grep -q '<html lang="he" dir="rtl">' app/index.html
grep -q 'AutoDealNative' android/app/src/main/java/il/autodeal/app/MainActivity.java
echo 'AutoDeal smoke tests passed.'
