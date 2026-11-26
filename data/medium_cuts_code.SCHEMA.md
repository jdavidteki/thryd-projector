# medium_cuts_code schema (v1)

Sidecar for code on Medium-safe cut objects from the mass safe-image migration
(`data/medium_cuts.json`: 642 assets, labels `cut1`–`cut4`).

The projector **must not** fetch any of these files at page start. It fetches
the tiny manifest and **one shard** on the first tap of a Medium-safe cut,
then keeps them in memory. Cuts with no entry keep today's tap menu
(glow / grow / dim, plus any already-loaded `object_methods.json` rows).
No timers, polling, animations, or scene re-renders are used to load or
show this data.

Write code entries in batches. Do not put the catalog in the manifest.

## Layout

```
data/medium_cuts_code.json              tiny manifest only (this is what
                                        the projector asks for first)
data/medium_cuts_code/s00.json          … s07.json  (shards, 8 files)
data/medium_cuts_code.batches/*.json    #thryd batch inputs (NOT fetched
                                        by the page; pack them into shards)
```

## Manifest (`data/medium_cuts_code.json`)

A small JSON object. No `entries` array. Typical size is under 1 KB.

```json
{
  "v": 1,
  "note": "Tiny manifest. Shards live under data/medium_cuts_code/. Fetched only on first tap of a Medium-safe cut.",
  "hash": "fnv1a32",
  "mod": 8,
  "shard_dir": "data/medium_cuts_code/",
  "shard_pattern": "s{NN}.json"
}
```

Required keys: `v` (integer, currently 1), `hash` (exactly `"fnv1a32"`),
`mod` (integer, currently 8), `shard_dir` (string, relative to the site
root, trailing slash ok), `shard_pattern` (must contain `{NN}`).

Unknown keys are ignored. Do not add the catalog here — a validator
rejects a manifest that contains `entries`.

## Which shard an image belongs to

Shard index is `fnv1a32(medium_image_id) % mod`, then the file name is
`s` + two-digit index + `.json` (e.g. index 3 → `s03.json`).

`fnv1a32` is the same function the stage already uses for placeholder
times (offset 32, prime 16777619, UTF-8 bytes of the exact
`medium_image_id` string, including the `1*` and the extension):

```js
function fnv1a(t){
  let h = 0x811c9dc5;
  const b = new TextEncoder().encode(String(t));
  for (let i = 0; i < b.length; i++){ h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
```

Python:

```python
def fnv1a32(s: str) -> int:
    h = 0x811c9dc5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h
```

Worked example: `1*0HKzcRgix1a5OGd1A0a8wQ.gif` → put it in the shard
the packer/validator prints for that id (do not guess).

## Shard file (`data/medium_cuts_code/sNN.json`)

```json
{
  "v": 1,
  "shard": "s00",
  "entries": [ { "…": "see below" } ]
}
```

Required: `v` (1), `shard` (must match the file name without `.json`),
`entries` (array, may be empty). A missing shard file is valid — that
batch has not been written yet and those cuts fall back to today's menu.

Partial batches are the normal state. You may update a shard in place
by rewriting the whole shard file (keep every entry you still want;
the packer merges batches by `(medium_image_id, cut, title)`).

## One entry (one contained cut object)

Each contained object on a cut (each of `cut1`…`cut4` that exists on
that image) gets its own entry: a code title plus at least one method,
grounded in the image and its source safe, linked to code that already
exists. Never invent the names of real people.

```json
{
  "medium_image_id": "1*EGfa3VQWdL61AGY_DW56zA.gif",
  "cut": "cut1",
  "object": "cap",
  "title": "cap.fist()",
  "method": "fist",
  "args": [],
  "methods": [
    { "method": "fist", "args": [], "title": "cap.fist()" }
  ],
  "klass": "person",
  "safe": { "id": "f7e4071d1b3a", "title": "807. lady javascript is my boyfriend" },
  "links": [
    { "kind": "function", "id": "teo.fold", "title": "teo.fold(surgical)" },
    { "kind": "object", "name": "teo" },
    { "kind": "seated", "run": "run-5a58c4", "job": "j25", "title": "teo.fold(surgical)" },
    { "kind": "run", "id": "run-5a58c4" },
    { "kind": "safe", "id": "f7e4071d1b3a", "title": "807. lady javascript is my boyfriend" }
  ]
}
```

Required:

- `medium_image_id`: exact id from `data/medium_cuts.json` `assets[].medium_image_id`.
- `cut`: `cut1`, `cut2`, `cut3`, or `cut4` (the pack label for that contained object).
- `object`: lowercase code name, `^[a-z][a-z0-9_]*$`, not `cut1`…`cut4`, not a person's real name.
- A code title and at least one method, in either form:
  - `title` + `method` (and optional `args` array), or
  - `methods`: non-empty array of `{method, args?, title?}`.

`title` / `methods[].title` must match:

```
object.method(args)
```

for example `cap.fist()`, `cap.fist(tight)`, or `lady.javascript(boyfriend)`.
The `object.` prefix must equal the entry's `object`. Allowed characters
in object and method: `[A-Za-z_][A-Za-z0-9_]*`. Args are a single
un-nested parenthetical (may be empty).

Optional but expected, so the new code is not an island:

- `safe`: `{id, title}` of the Medium safe the image came from (`id` is
  the Medium post id; `title` like `807. lady javascript is my boyfriend`).
- `links`: array of connections to code that already exists. Prefer, in
  order, a seated agenda function (`kind: "function"` whose `id` is a
  key in `data/object_methods.json` `functions`, and/or `kind: "seated"`
  with `run` / `job` / `title`), a run object (`kind: "object"` or
  `kind: "run"`, including names from `object_map_v1.json`), and the
  source safe (`kind: "safe"`).
- `klass`: the pack's `model_class` when you have it (`person`, `laptop`, …).
- `methods`: extra methods on the same object. The first method / `title`
  is the one the menu leads with.

`links[].kind` is one of: `function`, `object`, `seated`, `run`, `safe`.
Unknown keys on an entry are ignored.

## Batch files (for #thryd)

Write one or more files under `data/medium_cuts_code.batches/`:

```json
{
  "v": 1,
  "note": "optional",
  "entries": [ { "…": "same entry schema as a shard" } ]
}
```

Then pack (merges into shards, does not fetch anything on the page):

```
python3 /workspace/thryd-projector/tools/pack_medium_cuts_code.py \
  --root /workspace/chief-x-ship
```

`--root` can also be `/workspace/stretchy/site`. The packer is idempotent.
It never deletes an entry that is only in a shard and not in a batch,
unless you pass `--replace-shard` for a specific shard.

Validate the same way, including a partial tree:

```
python3 /workspace/thryd-projector/tools/validate_medium_cuts_code.py \
  --root /workspace/chief-x-ship
```

Exit 0 if the manifest is valid and every present shard is valid.
Missing shards are ok. Exit 1 only on schema or placement errors.

## Projector hook

After a tap (or when a card asks), the stage exposes:

```js
window.thrydCutCode = {
  shardName(medium_image_id),     // 's03.json'
  forCut(medium_image_id, cut), // entries from memory, or [] if not cached
  load(medium_image_id),          // Promise of entries for that image; fetches at most manifest + one shard
  manifest()                      // cached manifest or null
};
```

Cards should call `load()` / `forCut()` only when they need the lines,
never on page start.

## Heat rules (do not regress)

- No `fetch` of these files except from `thrydCutCode.load` / a first
  Medium-cut tap.
- No `setInterval` / `requestAnimationFrame` / per-frame work for this data.
- Opening or filling the tap menu must not re-render the stage scene.
- A 404 on the manifest or a shard is a silent fallback, not an error banner.
