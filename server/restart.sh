
cd "$(dirname "$0")"

killall node

node ./app.js >> ~/log.log &

tail -f ~/log.log
