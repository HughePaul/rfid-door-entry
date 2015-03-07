#/bin/bash

cd "$(dirname "$0")"

(
echo STOPPING >> ~/log.log
killall node
) &
