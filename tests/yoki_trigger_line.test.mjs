// yoki why-pill: song lyric on line 1, exact seated trigger (job + agenda title) under it
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'assets/yoki_dj.js'), 'utf8');

function load({pulse, songs} = {}){
  const store = {}, body = {children: [], appendChild(c){ this.children.push(c); return c; }};
  const catalog = songs || [{id: 'lGduJvOtuT8', t: 'Location', a: 'Dave, Burna Boy'}, {id: 'other', t: 'Other', a: 'A'}];
  const files = {
    'data/yoki_songs.json': () => ({songs: catalog}),
    'story/yoki_pulse.json': () => pulse,
  };
  const ctx = {URLSearchParams, Date, Math, JSON, Promise, Set, Map, Array, String, Number, Object, Error,
    Uint32Array, crypto,
    location: {search: ''}, setInterval(){ return 0; }, clearInterval(){}, setTimeout(){ return 0; }, clearTimeout(){},
    requestAnimationFrame(f){ f(); },
    localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, clear(){ for(const k of Object.keys(store)) delete store[k]; }},
    document: {body, hidden: false, createElement: () => ({style: {}, textContent: '', title: '', id: '', appendChild(){}})},
    fetch: async (u) => { const k = Object.keys(files).find(f => String(u).startsWith(f)); const v = k ? files[k]() : null;
      return {ok: !!v, json: async () => v}; }};
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  return {DJ: ctx.thrydYokiDJ, body};
}

const seatCand = {
  id: 'lGduJvOtuT8', title: 'Location', artist: 'Dave, Burna Boy', score: 1.2,
  why: '♪ run-888ea9 j9: “No map North Cap bend it up” ↔ run-888ea9 j8 seat “- which map? this wan dat weya inside nownow?”',
  line: 'No map North Cap bend it up',
  trigger: '- which map? this wan dat weya inside nownow?',
  trigger_job: 'j8',
  agenda_title: '1209. this ongoing revolution',
};
const problemCand = {
  id: 'other', title: 'Safe', artist: 'M.I', score: 1.1,
  why: '♪ run-888ea9 j9: “Am always inside your telly” ↔ run-888ea9 j9 📖 problem',
  line: 'Am always inside your telly',
  trigger: '', trigger_job: '', agenda_title: '',
};

const pulse = (cands) => ({v: 2, run: 'run-888ea9', job: 'j9', sig: 'test', candidates: cands});

test('shows the seated trigger under the song line, with job and agenda title', async () => {
  const {DJ, body} = load({pulse: pulse([seatCand])});
  const r = await DJ.next(() => true);
  assert.equal(r.id, 'lGduJvOtuT8');
  assert.equal(r.why.trigger, '- which map? this wan dat weya inside nownow?');
  assert.equal(r.why.trigger_job, 'j8');
  assert.equal(r.why.agenda, '1209. this ongoing revolution');
  assert.equal(r.why.line, 'No map North Cap bend it up');
  DJ.showWhy(r.why);
  const note = body.children.find(n => n.id === 'yoki_why');
  assert.equal(note.textContent,
    '♪ “No map North Cap bend it up”\nj8: - which map? this wan dat weya inside nownow?  ·  1209. this ongoing revolution');
  assert.match(note.style.cssText, /white-space:pre-line/);
});

test('a non-seat match keeps the song line and adds nothing extra', async () => {
  const {DJ, body} = load({pulse: pulse([problemCand])});
  const r = await DJ.next(() => true);
  assert.equal(r.id, 'other');
  assert.equal(r.why.trigger, '');
  DJ.showWhy(r.why);
  const note = body.children.find(n => n.id === 'yoki_why');
  assert.equal(note.textContent, '♪ “Am always inside your telly”');
  assert.ok(!note.textContent.includes('\n'));
  assert.ok(!/j9 📖|problem/.test(note.textContent));
});

test('showWhy invents nothing when trigger is missing even if why-text mentions a seat', () => {
  const {DJ, body} = load({pulse: pulse([seatCand])});
  DJ.showWhy({src: 'match', text: '♪ “x” ↔ j8 seat “invented?”', line: 'x', trigger: '', trigger_job: 'j8', agenda: '1209. this ongoing revolution'});
  const note = body.children.find(n => n.id === 'yoki_why');
  assert.equal(note.textContent, '♪ “x”');
});
