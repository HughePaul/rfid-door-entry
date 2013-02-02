#/bin/bash

cd "$(dirname "$0")"

(
echo STOPPING >> ~/log.log
killall node
echo STARTING >> ~/log.log
node ./app.js >> ~/log.log 2>&1
echo STOPPED >> ~/log.log
) &
