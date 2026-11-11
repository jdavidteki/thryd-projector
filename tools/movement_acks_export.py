"""Copy movement acks into a state export only for the same run.

The live export_state.py is not in this repo (only historical .bak copies).
The persistent source pipeline should call movement_acks_for_state(RUN, doc)
and set state["movement_acks"] to the result. A file whose run differs from
the state run contributes no event ids.

  ack_path = f"{RUN}/run/movement_acks.json"   # {run, movement_acks:[event_id, ...]}
  state["movement_acks"] = movement_acks_for_state(RUN, json.load(open(ack_path)))
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
