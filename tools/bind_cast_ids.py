"""Bind an authored spec tag to a cast object id. Nothing is registered.

A tag binds only when tags[i][4] equals exactly one cast_objects cast_name.
personN labels, hint labels, mask-key spellings, and display-name guesses do not bind.
This module does not read images and does not rewrite a posted GIF.
"""
import json
import re

PERSON = re.compile(r"^person\d+$")


def _cast_entries(doc):
    if not isinstance(doc, dict):
        return []
    cast = doc.get("cast")
    return cast if isinstance(cast, list) else []


def bind_authored_tags(spec, cast_doc):
    """Return bindings for unique authored spec tags. Does not use boxes or names by similarity."""
    tags = spec.get("tags") if isinstance(spec, dict) else None
    if not isinstance(tags, list):
        tags = []
    counts = {}
    authored = []
    for i, tag in enumerate(tags):
        if not isinstance(tag, (list, tuple)) or len(tag) < 5 or not isinstance(tag[4], str):
            continue
        name = tag[4]
        counts[name] = counts.get(name, 0) + 1
        authored.append((i, name))
    by_name = {}
    for entry in _cast_entries(cast_doc):
        if not isinstance(entry, dict):
            continue
        cname = entry.get("cast_name")
        oid = entry.get("object_id")
        prov = entry.get("provenance") if isinstance(entry.get("provenance"), dict) else {}
        if not isinstance(cname, str) or not cname or not isinstance(oid, str) or not oid:
            continue
        if prov.get("field") != "cast_names" or prov.get("name") != cname:
            continue
        by_name.setdefault(cname, []).append(entry)
    bindings, unmapped = [], []
    for index, name in authored:
        if PERSON.match(name):
            unmapped.append({"tag": name, "tag_index": index, "reason": "detector_label"})
            continue
        if counts[name] != 1:
            unmapped.append({"tag": name, "tag_index": index, "reason": "tag_not_unique"})
            continue
        hits = by_name.get(name) or []
        if len(hits) != 1:
            unmapped.append({"tag": name, "tag_index": index, "reason": "no_unique_cast_entry"})
            continue
        entry = hits[0]
        bindings.append({
            "tag": name,
            "tag_index": index,
            "object_id": entry["object_id"],
            "provenance": {
                "source": "authored_spec_tag",
                "spec_field": "tags",
                "tag_index": index,
                "cast_index": entry.get("index"),
                "cast_field": "cast_names",
                "setup_sha256": cast_doc.get("setup_sha256"),
                "generator": cast_doc.get("generator"),
            },
        })
    return {
        "run": cast_doc.get("run") if isinstance(cast_doc, dict) else None,
        "card": spec.get("card") if isinstance(spec, dict) else None,
        "source": "authored_spec_tag",
        "bindings": bindings,
        "unmapped_tags": unmapped,
    }


def state_id_for_cut(label, bindings):
    """Engine id for a new cut, or None. personN and unbound labels stay unmapped."""
    if not isinstance(label, str) or not label or PERSON.match(label):
        return None
    if not isinstance(bindings, dict):
        return None
    hits = [b for b in bindings.get("bindings") or [] if b.get("tag") == label and b.get("object_id") and (b.get("provenance") or {}).get("source") == "authored_spec_tag"]
    if len(hits) != 1:
        return None
    return hits[0]["object_id"]
