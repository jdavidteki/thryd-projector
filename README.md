# #thryd projector — run-5a58c4 (Miami)

Ambient wall projection. Static files with no build step.

## Run locally
    cd thryd-projector && python -m http.server 8000
    open http://localhost:8000/

Click the page or press **F** to go fullscreen.

## Modes
- `?mode=live` (the default): polls `data/state.json` every 10s and tweens the changes. If that file is missing or empty, it loops `data/timeline.json` (92 events) at about 8s per update. Change the pace with `?speed=ms`.
- `?mode=replay`: pick one of the past agendas from `data/replays.json` / `data/replay_<run>.json`. If there are none, it shows "no replays yet".

## Audio
Every 40–90s it speaks one exact archive line with speechSynthesis and shows that line as a bubble. Turn it off with the mute button or `?audio=0`. If `data/audio.json` is ever added, its clips are used as an override. Until then the browser shows one harmless 404 when it checks for that file.

## Add GIF
Use the button or drag and drop a GIF to add a labeled sprite. Sprites are stored in **IndexedDB in this browser only**. They are never uploaded and won't appear on other devices or on the Pages site for anyone else.

## GitHub Pages
Serve the repo root (a `.nojekyll` file is included). All paths are relative. `export_state.py` / `data/state.json` and the replay files belong to the Chief of Staff pipeline. Rebuild the assets with `tools/build_projector.py` and `tools/build_runs.py`.

## Wall layout (v5)
The current scene's GIF plays large in the centre (object-fit: contain) and crossfades whenever the scene changes. It also rotates about every 60s, and GIFs you add join the rotation. Characters and objects appear as small chips grouped by place in the left and right gutters, so they never cover the GIF. Chips drift and swap every 4–6s, held items sit under whoever holds them, and the most recently changed item pulses. Clicking a chip only highlights it. Speech bubbles grow out of a chip toward the GIF's edge. The top bar hides after 3s of no mouse movement.
