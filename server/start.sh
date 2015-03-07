#/bin/bash

cd "$(dirname "$0")"

(
echo STARTING >> ~/log.log
node ./ >> ~/log.log 2>&1
) &


