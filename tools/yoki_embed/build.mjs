// offline: africariyoki lyrics -> MiniLM (same Xenova/all-MiniLM-L6-v2 q8 as the browser) -> data/yoki_songs.json
import {pipeline, env} from '@huggingface/transformers';
import fs from 'fs';
const OUT = process.argv[2] || 'yoki_songs.json';
const songs = JSON.parse(fs.readFileSync('songs.json')).songs;
const STOP = new Set(('a an the and or but if of to in on at for with from by is are was were be been am i you he she it we they me my your our their his her its this that these those so do does did no not yes oh ooh ohh yeah yeh eh ehn ehen ah na o e dey go come make say said una una wey for im dont don\'t can cant just like get got all up down out now then when what who how why there here one two baby'.split(' ')).values());
const KW_STOP = new Set([...STOP, ...'oya ye la lo ni ko mi wa sa ti ka ba se fi je ma ki ke yeah yea hey uh huh ayy aye yo ya woah whoa ooo oooh na nah mo'.split(' ')]);
const clean = s => s.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
const toks = s => (s.toLowerCase().match(/[a-z']{3,}/g) || []).map(w => w.replace(/'/g, '')).filter(w => w.length > 2 && !KW_STOP.has(w));
const recs = [];
for(const s of songs){
  let raw = ''; try{ raw = fs.readFileSync('lrc/' + s.id + '.lrc', 'utf8'); }catch(e){ continue; }
  const seen = new Set(), lines = [];
  raw.split('\n').forEach(l => { const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/); if(!m) return; const x = clean(m[3]); const k = x.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    if(x.length < 10 || x.split(' ').length < 3 || seen.has(k) || /lyric|transcrib|copyright|www\.|http/i.test(x)) return; seen.add(k); lines.push(x.length > 110 ? x.slice(0, 108) + '…' : x); });
  if(lines.length < 3) continue;
  recs.push({s, lines});
}
console.error('songs with lyrics', recs.length, 'lines', recs.reduce((a, r) => a + r.lines.length, 0));
const ext = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {dtype: 'q8'});
const D = 384;
async function emb(texts){ const out = []; for(let i = 0; i < texts.length; i += 64){ const r = await ext(texts.slice(i, i + 64).map(t => t.toLowerCase()), {pooling: 'mean', normalize: true});
  for(let j = 0; j < r.dims[0]; j++) out.push(Float32Array.from(r.data.slice(j * D, (j + 1) * D))); } return out; }
const norm = v => { let n = 0; for(const x of v) n += x * x; n = Math.sqrt(n) || 1; return v.map(x => x / n); };
const dot = (a, b) => { let s = 0; for(let i = 0; i < D; i++) s += a[i] * b[i]; return s; };
// idf over songs
const df = new Map(); recs.forEach(r => new Set(r.lines.flatMap(toks)).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
const N = recs.length, K = 6, out = [];
let done = 0; const t0 = Date.now();
for(const r of recs){
  const vs = await emb([r.s.title + ' ' + (r.s.artist || ''), ...r.lines]); const tv = vs[0], lv = vs.slice(1);
  const mean = new Float32Array(D); lv.forEach(v => { for(let i = 0; i < D; i++) mean[i] += v[i]; }); for(let i = 0; i < D; i++) mean[i] += tv[i] * 2;
  const sv = norm(mean);
  // representative lines: farthest-point sampling seeded by the line nearest the song centroid
  const pick = []; let best = -1, bi = 0; lv.forEach((v, i) => { const d = dot(v, sv); if(d > best){ best = d; bi = i; } }); pick.push(bi);
  while(pick.length < Math.min(K, lv.length)){ let mx = -1, mi = -1; lv.forEach((v, i) => { if(pick.includes(i)) return; const m = Math.max(...pick.map(p => dot(v, lv[p]))); const sc = (1 - m) + .25 * dot(v, sv); if(sc > mx){ mx = sc; mi = i; } }); pick.push(mi); }
  const tf = new Map(); r.lines.flatMap(toks).forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
  const kw = [...tf].map(([w, c]) => [w, (1 + Math.log(c)) * Math.log(N / (df.get(w) || 1))]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 40);
  const mx = kw.length ? kw[0][1] : 1;
  const q = new Int8Array(D * (1 + pick.length)); [sv, ...pick.map(p => lv[p])].forEach((v, j) => { for(let i = 0; i < D; i++) q[j * D + i] = Math.max(-127, Math.min(127, Math.round(v[i] * 127 / 0.35))); });
  out.push({id: r.s.id, t: r.s.title, a: r.s.artist || '', l: pick.map(p => r.lines[p]), all: r.lines.slice(0, 80), k: Object.fromEntries(kw.map(([w, s]) => [w, +(s / mx).toFixed(2)])), v: Buffer.from(q.buffer).toString('base64')});
  if(++done % 50 === 0) console.error(done, Math.round((Date.now() - t0) / 1000) + 's');
}
fs.writeFileSync(OUT, JSON.stringify({v: 1, note: 'africariyoki song lyrics scored for the projector yoki station. tools/yoki_embed/build.mjs on the box: Xenova/all-MiniLM-L6-v2 (q8, same as assets/intent_ai_worker.js), normalized, int8 = round(x*127/0.35) clipped. Per song: v = [song centroid, then one vector per line in l]; k = top TF-IDF lyric terms (0..1) for the keyword fallback; all = up to 80 distinct lyric lines for keyword why-notes.', model: 'Xenova/all-MiniLM-L6-v2 q8', dim: D, scale: 0.35 / 127, generated: new Date().toISOString(), count: out.length, songs: out}));
console.error('wrote', OUT, out.length, fs.statSync(OUT).size);
