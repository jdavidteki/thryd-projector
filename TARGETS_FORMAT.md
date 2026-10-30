# #thryd prophecy targets (drags = open-ended #thryd.miracle.target)

## Record the page creates on every drop
```json
{"kind":"miracle.target",
 "assert":"<label>.place == \"<full place>\"",
 "run":"<state.run>",
 "j":"<state.current_card>",
 "at":"<ISO-8601 UTC, e.g. 2026-10-30T14:59:24.148Z>"}
```
`assert` forms:
- chip dropped on a place heading, or sprite dropped on a heading: `Sefa Lorn.place == "the old lighthouse on Saltmere point"` (full place from state, PFULL)
- sprite dropped free in the scene overlapping another object's box (largest overlap): `<label>.position == "on top of <other label>"`
- sprite dropped free, no overlap: `<label>.place == "<state.current_place>"`

## Transport (existing data/drag.json ntfy relay, no new backend)
- Heading drops: the normal setlocation body gains a field: `{key, object, place, rid, target:{...record}}`
- Free scene drops: fire-and-forget `{key, rid, target:{...record}}` (no object/place, so the validator may reply with an error; the page ignores it).
- Always kept in browser localStorage `thryd_targets` (array, last 60) = record + `status:'open'|'fulfilled'` + `ghost` (page-only drawing info).

## The bridge chip (static page can't reach files)
After a drop a `🔮 prophesy` chip appears near the item. Tapping it copies exactly:
`#thryd.miracle.target(assert(<assert>))`
e.g. `#thryd.miracle.target(assert(Sefa Lorn.place == "the old lighthouse on Saltmere point"))`
(navigator.clipboard, textarea+execCommand fallback) and shows `copied — paste in [[nh]]`.

## Fulfilment (written ONLY by Chief of Staff in data/state.json; page never self-fulfils)
Primary key `miracles`. Page accepts any of:
- `miracles: [ {assert, status:'open'|'fulfilled', at}, ... ]`
- `miracles: {open:[...], fulfilled:[...], targets:[...]}` — every entry in `fulfilled` counts as fulfilled (entries may be objects with `assert` or plain assert strings); entries in other arrays count when `status` is 'fulfilled' (or `fulfilled:true`).
- fallback `targets: [ {assert, status, at} ]`
Match = assert text, whitespace-collapsed, case-insensitive. On match: ghost brightens + glow, caption `✨ prophecy fulfilled: <assert>` ~4s, then ghost removed. State polled every 20s.
