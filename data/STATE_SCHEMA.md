# data/state.json (written by export_state.py, read-only on thryd.db and run-5a58c4)
- run, exported_at (ET ISO), story_time (ISO from thryd.db card_ts), story_time_label, current_card, current_place
- ticker {wall, line}: last ticker.log line; seated_count / seats; latest_seat {seat, card, pick, safe, at}
- characters[] {id (thryd.db), name, role, place, note, card}; objects[] {label, db_id|null, place, card, ...}
- locations[], scenes[] {card, place, world_time}
- moves[] {card, world_ts, move ("wN · command → result"), precisions[] {line (exact archive line), safe, seat}}
- recent_events[] {t, ev, card, status}: last 12 of events.jsonl
Positions are computed client-side in index.html: one stage column per place, slots inside it.

# data/replays.json (build_replays.py; rerun to refresh)
{built_at, runs[] {run, date (YYYY-MM-DD, earliest event/seat), cast[] (names from events.jsonl cardgen casts), gifs[] (abs paths under run/views), events_path, answers_path, replay ("data/replay_<run>.json"), frames (count), live (true for run-5a58c4)}}

# data/replay_<run>.json
{run, date, cast[], seated[] {seat, card, line (exact archive line), safe},
 frames[] (sorted by t, ET ISO) {t, kind "ev"|"seat", card, event, status, seated_count, latest_seat {seat,card,line,safe}, cast[]|null}}
Each frame is a cumulative snapshot: play frames in order (scale real time gaps) to replay an agenda.

## objects_map.json (object sprites over GIF backdrops)

Keyed by the GIF path exactly as listed in `data/replays.json` `runs[].gifs`.

```json
{"<gif path>": {"frame_size": [w, h], "bbox_units": "normalized 0-1 of frame",
  "objects": [{"label": "", "state_id": "", "bbox": [x, y, w, h],
    "sprite": "assets/sprites/<run>/<gif>/<object>.png",
    "patch": "assets/sprites/<run>/<gif>/<object>.patch.png",
    "motion": "sway|bob|slide|flicker", "sprite_source": "<still used>"}]}}
```

- `bbox` is normalized (x, y = top-left), so multiply by the rendered backdrop size.
- `state_id` is the matching `state.json` object label / character id, or null if the object isn't in state.
- `sprite` is an RGBA cutout (OpenCV GrabCut) taken from the `_blur` still at the same framing. `patch` is an opaque, inpainted and blurred plate the same size. Draw the patch at the bbox, then draw the sprite on top with its motion.
- Entries with `"anchor_only": true` (characters and the phone held at a face) have no sprite or patch. Use them only to place labels.
