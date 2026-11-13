// stage decode worker: GIF/still decode, per-cut mask crop, downscale and the faded backdrop all happen here, off the main thread
'use strict';
const b64 = s => { const bin = atob(s), out = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
function lzw(minSize, data, npix, out){
  const MAX = 4096, prefix = new Int16Array(MAX), suffix = new Uint8Array(MAX), stack = new Uint8Array(MAX + 1);
  const clear = 1 << minSize, eoi = clear + 1;
  let size = minSize + 1, mask = (1 << size) - 1, avail = clear + 2, old = -1, first = 0, bits = 0, datum = 0, ip = 0, op = 0, top = 0;
  for(let i = 0; i < clear; i++){ prefix[i] = -1; suffix[i] = i; }
  while(op < npix){
    if(top === 0){
      while(bits < size){ if(ip >= data.length) return op; datum |= data[ip++] << bits; bits += 8; }
      let code = datum & mask; datum >>>= size; bits -= size;
      if(code === clear){ size = minSize + 1; mask = (1 << size) - 1; avail = clear + 2; old = -1; continue; }
      if(code === eoi) break;
      if(old === -1){ if(code >= clear) break; out[op++] = suffix[code]; old = code; first = code; continue; }
      if(code > avail) break;
      const inCode = code;
      if(code === avail){ stack[top++] = first; code = old; }
      while(code > clear){ stack[top++] = suffix[code]; code = prefix[code]; }
      first = suffix[code]; stack[top++] = first;
      if(avail < MAX){ prefix[avail] = old; suffix[avail] = first; avail++; if((avail & mask) === 0 && avail < MAX){ size++; mask += avail; } }
      old = inCode;
    }
    out[op++] = stack[--top];
  }
  return op;
}
function interlacedRows(h){ const rows = []; for(let y = 0; y < h; y += 8) rows.push(y); for(let y = 4; y < h; y += 8) rows.push(y); for(let y = 2; y < h; y += 4) rows.push(y); for(let y = 1; y < h; y += 2) rows.push(y); return rows; }
function* gifFrames(u){
  const sig = String.fromCharCode.apply(null, u.subarray(0, 6)); if(sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('not_gif');
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), width = dv.getUint16(6, true), height = dv.getUint16(8, true), packed = u[10];
  let p = 13, gct = null;
  if(packed & 0x80){ const n = 1 << ((packed & 7) + 1); gct = u.subarray(p, p + n * 3); p += n * 3; }
  const canvas = new Uint8ClampedArray(width * height * 4);
  let delayCs = 0, trans = -1, dispose = 0, seen = 0, pending = null, idx = null, comp = new Uint8Array(1 << 16);
  yield {width, height};
  while(p < u.length){
    const b = u[p++];
    if(b === 0x3b) break;
    if(b === 0x21){ const label = u[p++];
      if(label === 0xf9){ p++; const gp = u[p++]; delayCs = dv.getUint16(p, true); p += 2; const ti = u[p++]; dispose = (gp >> 2) & 7; trans = (gp & 1) ? ti : -1; p++; }
      else { let sz = u[p++]; while(sz){ p += sz; sz = u[p++]; } }
      continue; }
    if(b !== 0x2c) throw new Error('bad_block');
    if(pending){ pending(); pending = null; }
    const left = dv.getUint16(p, true), top = dv.getUint16(p + 2, true), fw = dv.getUint16(p + 4, true), fh = dv.getUint16(p + 6, true); p += 8;
    const ip = u[p++]; let ct = gct;
    if(ip & 0x80){ const n = 1 << ((ip & 7) + 1); ct = u.subarray(p, p + n * 3); p += n * 3; }
    const snap = dispose === 3 ? canvas.slice() : null, minSize = u[p++];
    let cl = 0, sz = u[p++];
    while(sz){ if(cl + sz > comp.length){ const c2 = new Uint8Array(comp.length * 2 + sz); c2.set(comp.subarray(0, cl)); comp = c2; } comp.set(u.subarray(p, p + sz), cl); cl += sz; p += sz; sz = u[p++]; }
    const npix = fw * fh; if(!idx || idx.length < npix) idx = new Uint8Array(npix);
    const got = lzw(minSize, comp.subarray(0, cl), npix, idx);
    const rows = (ip & 0x40) ? interlacedRows(fh) : null;
    if(ct) for(let ly = 0; ly < fh; ly++){
      const y = top + (rows ? rows[ly] : ly); if(y < 0 || y >= height) continue;
      for(let lx = 0, i = ly * fw; lx < fw; lx++, i++){
        if(i >= got) break; const ci = idx[i]; if(ci === trans) continue;
        const x = left + lx; if(x >= width) continue;
        const o = (y * width + x) * 4, c = ci * 3; canvas[o] = ct[c]; canvas[o + 1] = ct[c + 1]; canvas[o + 2] = ct[c + 2]; canvas[o + 3] = 255;
      }
    }
    const index = seen++, delay = delayCs, d2 = dispose;
    pending = ()=>{ if(d2 === 2){ for(let y = 0; y < fh; y++) for(let x = 0; x < fw; x++){ const yy = top + y, xx = left + x; if(yy >= height || xx >= width) continue; const o = (yy * width + xx) * 4; canvas[o] = canvas[o+1] = canvas[o+2] = canvas[o+3] = 0; } } else if(d2 === 3 && snap) canvas.set(snap); };
    delayCs = 0; trans = -1; dispose = 0;
    yield {rgba: canvas, delayCs: delay, index};
  }
}
const playMs = cs => (cs <= 1 ? 100 : cs * 10);
function maskRaw(spec){ return spec._raw || (spec._raw = (spec.raw || b64(spec.bits))); }
function crop(rgba, fw, spec, U){
  const out = new ImageData(U.w, U.h), d = out.data; if(!spec || !(spec.bits || spec.raw)) return out;
  const raw = maskRaw(spec), stride = (spec.w + 7) >> 3;
  for(let y = 0; y < spec.h; y++){ const sy = spec.y + y, oy = sy - U.y; if(oy < 0 || oy >= U.h) continue;
    for(let x = 0; x < spec.w; x++){ if(!(raw[y * stride + (x >> 3)] & (0x80 >> (x & 7)))) continue;
      const sx = spec.x + x, ox = sx - U.x; if(ox < 0 || ox >= U.w) continue;
      const p = (sy * fw + sx) * 4, o = (oy * U.w + ox) * 4; d[o] = rgba[p]; d[o+1] = rgba[p+1]; d[o+2] = rgba[p+2]; d[o+3] = rgba[p+3]; } }
  return out;
}
function backdrop(rgba, fw, fh, specs, plate, known){
  // the same frame with each staged cut's own pixels taken out: stored plate pixels where they are known, else transparent
  const out = new ImageData(new Uint8ClampedArray(rgba), fw, fh), d = out.data;
  specs.forEach(spec => { if(!spec || !(spec.bits || spec.raw)) return; const raw = maskRaw(spec), stride = (spec.w + 7) >> 3;
    for(let y = 0; y < spec.h; y++){ const sy = spec.y + y; if(sy < 0 || sy >= fh) continue;
      for(let x = 0; x < spec.w; x++){ if(!(raw[y * stride + (x >> 3)] & (0x80 >> (x & 7)))) continue; const sx = spec.x + x; if(sx < 0 || sx >= fw) continue;
        const i = sy * fw + sx, p = i * 4;
        if(plate && known && known[i] && plate[p + 3] === 255){ d[p] = plate[p]; d[p+1] = plate[p+1]; d[p+2] = plate[p+2]; d[p+3] = 255; } else d[p + 3] = 0; } } });
  // the soft oval fade and the faint level are baked into the pixels here: a CSS mask-image on ~30 big layers cost the page
  // more than half its frame rate (measured 18 -> 47 fps headless). Same shape as the old mask: solid to 45 %, gone at the rim.
  const A = 0.34, rx = fw / 2, ry = fh / 2;
  for(let y = 0; y < fh; y++){ const qy = (y + .5 - ry) / ry, qy2 = qy * qy;
    for(let x = 0, p = y * fw * 4; x < fw; x++, p += 4){ const qx = (x + .5 - rx) / rx, r = Math.sqrt(qx * qx + qy2);
      const f = r <= .45 ? 1 : r >= 1 ? 0 : 1 - (r - .45) / .55; d[p + 3] = d[p + 3] * f * A; } }
  return out;
}
const bm = (img, w, h) => createImageBitmap(img, {resizeWidth: Math.max(1, w), resizeHeight: Math.max(1, h), resizeQuality: 'medium'});
async function still(bytes, w, h){
  const b = await createImageBitmap(new Blob([bytes])); if(b.width !== w || b.height !== h){ b.close(); throw new Error('mask_size'); }
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d'); g.drawImage(b, 0, 0); b.close(); return g.getImageData(0, 0, w, h).data;
}
async function job(m){
  const {fw, fh, gif, frameCount, stillFrame, step, delays_cs, objs, bg} = m;
  const frames = objs.map(() => []), delays = []; let bgBm = null, firstMi = -1;
  const take = async (rgba, mi, ms)=>{
    for(let j = 0; j < objs.length; j++){ const o = objs[j]; frames[j].push(await bm(crop(rgba, fw, o.masks[mi] || o.masks[0], o.U), o.dw, o.dh)); }
    delays.push(ms);
    if(bg && !bgBm){ firstMi = mi; bgBm = await bm(backdrop(rgba, fw, fh, objs.map(o => o.masks[mi] || o.masks[0]), bg.plate, bg.known), bg.w, bg.h); }
  };
  let bytes = m.bytes;
  if(!bytes){ const r = await fetch(m.url, {cache: 'force-cache'}); if(!r.ok) throw new Error('fetch'); bytes = await r.arrayBuffer(); }
  const u = new Uint8Array(bytes), isGif = u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46;
  if(isGif){
    const it = gifFrames(u), hd = it.next().value; if(hd.width !== fw || hd.height !== fh) throw new Error('mask_size');
    const want = gif ? frameCount : (stillFrame | 0) + 1; let acc = 0;
    for(const fr of it){ const i = fr.index;
      if(gif){ if(fr.delayCs !== delays_cs[i]) throw new Error('delay_mismatch'); acc += playMs(fr.delayCs);
        if(i % step === 0) await take(fr.rgba, i, 0);
        if(i % step === step - 1 || i === frameCount - 1){ delays[delays.length - 1] = acc; acc = 0; } }
      else if(i === (stillFrame | 0)) await take(fr.rgba, 0, 0);
      if(i + 1 >= want) break; }
    if(!frames[0].length) throw new Error('decode');
  } else await take(await still(u, fw, fh), 0, 0);
  return {frames, delays, bg: bgBm};
}
self.onmessage = async e => {
  const m = e.data, t0 = performance.now();
  try{ const r = await job(m); const tr = []; r.frames.forEach(f => f.forEach(b => tr.push(b))); if(r.bg) tr.push(r.bg);
    self.postMessage({id: m.id, ok: true, frames: r.frames, delays: r.delays, bg: r.bg, ms: Math.round(performance.now() - t0)}, tr); }
  catch(err){ self.postMessage({id: m.id, ok: false, error: String(err && err.message || err)}); }
};
