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
