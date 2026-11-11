"""Copy movement acks into a state export only for the same run.

export_state.py is not published (the sync excludes *.py). The box patch
patches/export_state_acks.patch calls load_movement_acks(state_run, path)
with path f"{run_dir}/run/movement_acks.json" and stores the returned
envelope on state["movement_acks"]. A file whose run differs from the
state run contributes no event ids.

  {"run": "<same as state.run>", "movement_acks": ["<event_id>", ...]}
"""
import json
import os


def movement_acks_for_state(state_run, doc):
    empty = {"run": state_run, "movement_acks": []}
    if not state_run or not isinstance(doc, dict) or doc.get("run") != state_run:
        return empty
    ids = doc.get("movement_acks")
    if not isinstance(ids, list) or not all(isinstance(x, str) and x for x in ids):
        return empty
    return {"run": state_run, "movement_acks": list(ids)}


def load_movement_acks(state_run, path):
    if not path or not os.path.isfile(path):
        return {"run": state_run, "movement_acks": []}
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    return movement_acks_for_state(state_run, doc)
