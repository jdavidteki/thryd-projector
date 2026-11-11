#!/bin/bash
# restart the thryd drag validator (127.0.0.1:8787) + HTTPS relay via ntfy.sh; publishes endpoint info to the projector's data/drag.json
D=/workspace/thryd-drag; cd $D
pkill -f "$D/server.py"; pkill -f "$D/relay.py"; pkill -f "cloudflared tunnel"; sleep 1
nohup python3 $D/server.py >>$D/server.log 2>&1 &
nohup python3 $D/relay.py >>$D/relay.log 2>&1 &
T=$(cat $D/topic); echo "https://ntfy.sh/$T" > $D/url.txt
python3 -c "import json,time;json.dump({'transport':'ntfy','endpoint':'https://ntfy.sh/$T','reply':'https://ntfy.sh/$T-r','key':open('$D/key').read().strip(),'updated':time.strftime('%Y-%m-%dT%H:%M:%S%z')},open('/workspace/thryd-projector/data/drag.json','w'))"
echo "endpoint: https://ntfy.sh/$T"
