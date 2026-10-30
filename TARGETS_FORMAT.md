# #thryd prophecy targets — page side (matches Chief of Staff contract, commit cd521af)

Drags are open-ended `#thryd.miracle.target`. The page records and draws them; **only `state.miracles` decides open/fulfilled.**

## Bridge chip (the static page can't reach files)
After any drop a `🔮 prophesy` chip appears near the item. Tap = copies exactly
`#thryd.miracle.target(assert(<object>.place == "<place>"))`
e.g. `#thryd.miracle.target(assert(Sefa Lorn.place == "the old lighthouse on Saltmere point"))`
(navigator.clipboard, textarea+execCommand fallback) and shows `copied — paste in [[nh]]`.
`<place>` = full place name from state (heading drops) or `state.current_place` (free in-scene sprite drops).

## Record the page makes on each drop
```json
{"kind":"miracle.target","object":"<label>","place":"<full place>",
 "assert":"<label>.place == \"<place>\"","run":"<state.run>","j":"<state.current_card>",
 "at":"<ISO UTC>", "near":"on top of <other>"   // near only for in-scene drops overlapping another object
}
```
- Sent best-effort on the existing data/drag.json ntfy relay: heading drops add `target` to the usual `{key,object,place,rid}`; in-scene drops send `{key,rid,target}` fire-and-forget.
- Kept in localStorage `thryd_targets` (last 60) with page-only `status` + `ghost` drawing info. Captions already shown: `thryd_targets_seen`.

## What the page reads: state.json `miracles`
```json
"miracles": {"open":[...], "fulfilled":[...], "error": "optional"}
entry: {id, object, place, status, window:{raw}, set_on_card, fulfilled_card, fulfilled_world_time, evidence:{actual}, raw}
```
- `error` present (truthy) → page shows NO ghosts/captions.
- `open[]` → dashed ghost (faint, slow pulse) under the matching place heading, or at the dropped spot if this browser made that drag.
- Local drags not yet in open[]/fulfilled[] → ghost too ("unsent").
- `fulfilled[]` → ghost brightens + glow, caption `✨ prophecy fulfilled: <object label>.place == "<place>"` ~4s, then removed. Shown once per entry (key `id`, else object|place|fulfilled_card).
- Matching: `object` loose vs objects[]/characters labels and local drags — case-insensitive, leading "the" dropped, split on `/` (`phone` ~ `phone/footage`); `place` equal or substring either way.
