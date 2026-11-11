"""Build the Medium cut coverage list. Every remote original is listed.

Nothing in this list is a cut. status is awaiting_manifest until a measured
mask pack for that exact medium_image_id is supplied. Agenda rows are omitted.
"""
import json


def cover(sets):
    assets = []
    for src in sets or []:
        if not isinstance(src, dict) or src.get("how") != "medium" or not src.get("remote"):
            continue
        mid = src.get("medium_image_id")
        if not isinstance(mid, str) or not mid:
            continue
        kind = "gif" if src.get("extension") == "gif" else "still"
        assets.append({"medium_image_id": mid, "kind": kind, "status": "awaiting_manifest"})
    gif = sum(1 for a in assets if a["kind"] == "gif")
    return {
        "version": 1,
        "note": "Coverage only. No masks, no engine ids, no agenda binding. A later measured pack may set status to ready, no_object, unavailable, or blocked_budget.",
        "counts": {
            "assets": len(assets),
            "gif": gif,
            "still": len(assets) - gif,
            "ready": 0,
            "awaiting_manifest": len(assets),
        },
        "assets": assets,
    }
