// Medium original cutouts. The original file stays the pixel source.
// A cut is drawn only from a mask that belongs to that medium id.
// Agenda scenes, engine ids, and a still patch on an animated subject are refused.
(function(root){
  const CAP = 1073741824;
  const USED = 791846092;
  const RESERVE = 41943040;
  const WHOLE = 0.995;

  function roomBytes(){ return CAP - USED - RESERVE; }
  function admit(measuredBytes){
    const room = roomBytes();
    if(typeof measuredBytes !== 'number' || !Number.isFinite(measuredBytes) || measuredBytes < 0) return {ok:false, reason:'unmeasured', room};
    if(measuredBytes > room) return {ok:false, reason:'blocked_budget', room, bytes:measuredBytes};
    return {ok:true, room, bytes:measuredBytes};
  }

  function isMedium(set){
    return !!(set && set.how === 'medium' && set.remote && set.url && typeof set.medium_image_id === 'string' && set.medium_image_id);
  }

  function coverage(sets, manifest){
    const assets = (manifest && manifest.assets) || [];
    const byId = new Map();
    assets.forEach(a=>{ if(a && a.medium_image_id) byId.set(a.medium_image_id, a); });
    const counts = {medium:0, gif:0, still:0, ready:0, awaiting_manifest:0, no_object:0, unavailable:0, blocked_budget:0, budget_failed:0, unreviewed:0, unstable:0, unusable_near_full:0, missing:0, other:0};
    (sets || []).forEach(set=>{
      if(!isMedium(set)) return;
      counts.medium++;
      if(set.extension === 'gif' || set.animated) counts.gif++; else counts.still++;
      const row = byId.get(set.medium_image_id);
      const status = row ? (row.status || 'other') : 'missing';
      if(counts[status] == null) counts.other++; else counts[status]++;
    });
    return counts;
  }

  function inkBox(mask, w, h){
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      if(!mask[y * w + x]) continue;
      n++; if(x < x0) x0 = x; if(y < y0) y0 = y; if(x + 1 > x1) x1 = x + 1; if(y + 1 > y1) y1 = y + 1;
    }
    if(!n) return null;
    return {x:x0, y:y0, w:x1 - x0, h:y1 - y0, ink:n};
  }

  function b64bytes(s){
    if(typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function unpackMask(spec, w, h){
    if(!spec || typeof spec !== 'object' || spec.length != null || !spec.bits) return null;
    const bw = spec.w, bh = spec.h, x0 = spec.x, y0 = spec.y;
    if(!bw || !bh || x0 < 0 || y0 < 0 || x0 + bw > w || y0 + bh > h) return null;
    const raw = b64bytes(spec.bits);
    const stride = (bw + 7) >> 3;
    if(raw.length < bh * stride) return null;
    const mask = new Uint8Array(w * h);
    for(let y = 0; y < bh; y++) for(let x = 0; x < bw; x++){
      if(raw[y * stride + (x >> 3)] & (0x80 >> (x & 7))) mask[(y0 + y) * w + (x0 + x)] = 1;
    }
    return mask;
  }
  function asMask(mask, w, h){
    const packed = unpackMask(mask, w, h);
    if(packed) return packed;
    if(!mask || mask.length !== w * h) return null;
    const out = new Uint8Array(w * h);
    for(let i = 0; i < out.length; i++) out[i] = mask[i] ? 1 : 0;
    return out;
  }

  function reject(reason){ return {ok:false, reason, objects:[]}; }

  function checkObject(obj, kind, frameCount, w, h){
    if(!obj || typeof obj.label !== 'string' || !obj.label) return 'bad_label';
    if(obj.object_id || obj.state_id) return 'unproven_id';
    if(obj.bbox && !obj.masks && !obj.mask) return 'bbox_not_a_mask';
    const frames = obj.masks || (obj.mask ? [obj.mask] : null);
    if(!frames) return 'bbox_not_a_mask';
    if(kind === 'gif' && frameCount > 1 && (frames.length === 1 || obj.patch || obj.patch_url)) return 'static_patch_rejected';
    if(frames.length !== (kind === 'gif' ? frameCount : 1)) return 'mask_count';
    for(let i = 0; i < frames.length; i++){
      const mask = asMask(frames[i], w, h);
      if(!mask) return 'mask_size';
      const box = inkBox(mask, w, h);
      if(!box) return 'empty_mask';
      if(box.ink / (w * h) >= WHOLE) return 'whole_frame_mask';
    }
    if(obj.plate && (!obj.plate_known || obj.plate_known.length !== w * h || obj.plate.length !== w * h * 4)) return 'invented_plate';
    return null;
  }

  function forSet(set, manifest){
    if(!isMedium(set)) return reject('not_medium');
    const row = ((manifest && manifest.assets) || []).find(a=>a && a.medium_image_id === set.medium_image_id);
    if(!row) return reject('awaiting_manifest');
    if(row.jN || row.card || row.run) return reject('agenda_bind');
    if(row.object_id || row.state_id) return reject('unproven_id');
    if(row.status !== 'ready') return reject(row.status || 'awaiting_manifest');
    const kind = row.kind === 'gif' || row.kind === 'still' ? row.kind : (set.extension === 'gif' ? 'gif' : 'still');
    if(kind === 'gif' && set.extension && set.extension !== 'gif') return reject('kind_mismatch');
    if(kind === 'still' && set.extension === 'gif') return reject('kind_mismatch');
    const frameCount = kind === 'gif' ? (row.delays_cs || []).length : 1;
    if(kind === 'gif' && frameCount < 1) return reject('delay_mismatch');
    const w = row.frame_size && row.frame_size[0], h = row.frame_size && row.frame_size[1];
    if(!w || !h) return reject('mask_size');
    const objects = (row.objects || []).map(expandObject);
    if(!objects.length) return reject('no_object');
    for(let i = 0; i < objects.length; i++){
      const why = checkObject(objects[i], kind, frameCount, w, h);
      if(why) return reject(why);
    }
    return {ok:true, reason:null, kind, frameCount, width:w, height:h, delays_cs: kind === 'gif' ? row.delays_cs.slice() : [0], objects};
  }

  function delaysMatch(parsed, delays){
    if(!parsed || !parsed.frames || !delays || parsed.frames.length !== delays.length) return false;
    for(let i = 0; i < delays.length; i++) if(parsed.frames[i].delayCs !== delays[i]) return false;
    return true;
  }

  function playMs(delayCs){ return delayCs === 0 ? 100 : delayCs * 10; }

  function compose(rgba, w, h, masks, plate){
    const src = rgba instanceof Uint8ClampedArray ? rgba : Uint8ClampedArray.from(rgba);
    const plateOut = new Uint8ClampedArray(src);
    const known = plate && plate.known;
    const fill = plate && plate.rgba;
    const sprites = [];
    (masks || []).forEach(raw=>{
      const mask = asMask(raw, w, h);
      const box = inkBox(mask, w, h);
      const sprite = new Uint8ClampedArray(box.w * box.h * 4);
      for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
        const i = y * w + x;
        if(!mask[i]) continue;
        const s = ((y - box.y) * box.w + (x - box.x)) * 4;
        const p = i * 4;
        sprite[s] = src[p]; sprite[s+1] = src[p+1]; sprite[s+2] = src[p+2]; sprite[s+3] = src[p+3];
        if(known && known[i] && fill){
          plateOut[p] = fill[p]; plateOut[p+1] = fill[p+1]; plateOut[p+2] = fill[p+2]; plateOut[p+3] = fill[p+3];
        }else{
          plateOut[p+3] = 0;
        }
      }
      sprites.push({x:box.x, y:box.y, w:box.w, h:box.h, rgba:sprite});
    });
    return {plate:plateOut, sprites};
  }

  function planFrames(decoded, plan){
    if(!plan.ok) return plan;
    if(plan.kind === 'gif'){
      if(!delaysMatch(decoded, plan.delays_cs)) return reject('delay_mismatch');
      if(decoded.width !== plan.width || decoded.height !== plan.height) return reject('mask_size');
    }
    const frames = [];
    const count = plan.kind === 'gif' ? plan.frameCount : 1;
    const source = plan.kind === 'gif' ? decoded.frames : [{rgba:decoded.rgba, delayCs:0}];
    for(let f = 0; f < count; f++){
      const rgba = source[f] && source[f].rgba;
      if(!rgba || rgba.length < plan.width * plan.height * 4) return reject('mask_size');
      const masks = plan.objects.map(obj=> (obj.masks || [obj.mask])[plan.kind === 'gif' ? f : 0]);
      const plateSrc = plan.objects.find(o=>o.plate);
      const drawn = compose(source[f].rgba, plan.width, plan.height, masks, plateSrc ? {rgba:plateSrc.plate, known:plateSrc.plate_known} : null);
      frames.push({delayCs: plan.kind === 'gif' ? plan.delays_cs[f] : 0, playMs: playMs(plan.kind === 'gif' ? plan.delays_cs[f] : 0), plate:drawn.plate, sprites:drawn.sprites});
    }
    return {ok:true, reason:null, width:plan.width, height:plan.height, frames};
  }

  function lzwDecode(minCodeSize, data){
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;
    let dict = [];
    function reset(){
      codeSize = minCodeSize + 1; nextCode = eoiCode + 1; dict = [];
      for(let i = 0; i < clearCode; i++) dict[i] = [i];
    }
    reset();
    let bits = 0, nbits = 0, ip = 0;
    function read(){
      while(nbits < codeSize){
        if(ip >= data.length) return null;
        bits |= data[ip++] << nbits; nbits += 8;
      }
      const code = bits & ((1 << codeSize) - 1);
      bits >>= codeSize; nbits -= codeSize; return code;
    }
    const out = [];
    let prev = null;
    while(true){
      const code = read();
      if(code === null || code === eoiCode) break;
      if(code === clearCode){ reset(); prev = null; continue; }
      let entry;
      if(code < nextCode && dict[code]) entry = dict[code];
      else if(code === nextCode && prev) entry = prev.concat([prev[0]]);
      else break;
      for(let i = 0; i < entry.length; i++) out.push(entry[i]);
      if(prev){
        dict[nextCode++] = prev.concat([entry[0]]);
        if(nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
      }
      prev = entry;
    }
    return out;
  }

  function gunzip(u8){
    if(typeof require === 'function'){
      try{ return new Uint8Array(require('zlib').gunzipSync(u8)); }catch(e){ return null; }
    }
    return null;
  }
  function readMaskBlob(raw, count){
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const out = [];
    let p = 0;
    for(let i = 0; i < count; i++){
      const x = view.getUint16(p, true), y = view.getUint16(p + 2, true), w = view.getUint16(p + 4, true), h = view.getUint16(p + 6, true);
      const n = view.getUint32(p + 8, true);
      p += 12;
      out.push({x, y, w, h, bits: (typeof Buffer !== 'undefined' ? Buffer.from(raw.subarray(p, p + n)).toString('base64') : btoa(String.fromCharCode.apply(null, raw.subarray(p, p + n))))});
      p += n;
    }
    return out;
  }
  function expandObject(obj){
    if(!obj || obj.masks || !obj.masks_deflate) return obj;
    const raw = gunzip(b64bytes(obj.masks_deflate));
    if(!raw) return obj;
    obj.masks = readMaskBlob(raw, obj.mask_count || 0);
    return obj;
  }
  async function expandRow(row){
    const objects = (row && row.objects) || [];
    for(let i = 0; i < objects.length; i++){
      const obj = objects[i];
      if(!obj || obj.masks || !obj.masks_deflate) continue;
      let raw = gunzip(b64bytes(obj.masks_deflate));
      if(!raw && typeof DecompressionStream === 'function'){
        const ds = new DecompressionStream('gzip');
        const stream = new Blob([b64bytes(obj.masks_deflate)]).stream().pipeThrough(ds);
        raw = new Uint8Array(await new Response(stream).arrayBuffer());
      }
      if(raw) obj.masks = readMaskBlob(raw, obj.mask_count || 0);
    }
    return row;
  }
  function frameHoldBytes(w, h, n){ return w * h * 4 * n; }

  function decodeGif(bytes, opts){
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const sig = String.fromCharCode.apply(null, u.subarray(0, 6));
    if(sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('not_gif');
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const width = dv.getUint16(6, true), height = dv.getUint16(8, true);
    const packed = u[10];
    let p = 13;
    const gctFlag = packed & 0x80;
    let gct = null;
    if(gctFlag){
      const n = 1 << ((packed & 7) + 1);
      gct = u.subarray(p, p + n * 3); p += n * 3;
    }
    const canvas = new Uint8ClampedArray(width * height * 4);
    const frames = [];
    const only = opts && Number.isInteger(opts.only) ? opts.only : null;
    let delayCs = 0, trans = -1, dispose = 0, seen = 0;
    while(p < u.length){
      const b = u[p++];
      if(b === 0x3b) break;
      if(b === 0x21){
        const label = u[p++];
        if(label === 0xf9){
          p++; // block size
          const gp = u[p++];
          delayCs = dv.getUint16(p, true); p += 2;
          const ti = u[p++]; dispose = (gp >> 2) & 7; trans = (gp & 1) ? ti : -1;
          p++; // terminator
        }else{
          let sz = u[p++];
          while(sz){ p += sz; sz = u[p++]; }
        }
        continue;
      }
      if(b !== 0x2c) throw new Error('bad_block');
      const left = dv.getUint16(p, true); p += 2;
      const top = dv.getUint16(p, true); p += 2;
      const fw = dv.getUint16(p, true); p += 2;
      const fh = dv.getUint16(p, true); p += 2;
      const ipacked = u[p++];
      let ct = gct;
      if(ipacked & 0x80){
        const n = 1 << ((ipacked & 7) + 1);
        ct = u.subarray(p, p + n * 3); p += n * 3;
      }
      const snapshot = dispose === 3 ? canvas.slice() : null;
      const minSize = u[p++];
      const comp = [];
      let sz = u[p++];
      while(sz){ for(let i = 0; i < sz; i++) comp.push(u[p++]); sz = u[p++]; }
      const idx = lzwDecode(minSize, Uint8Array.from(comp));
      const interlace = ipacked & 0x40;
      const rows = interlace ? interlacedRows(fh) : null;
      for(let i = 0; i < fw * fh && i < idx.length; i++){
        const lx = i % fw, ly = rows ? rows[(i / fw) | 0] : (i / fw) | 0;
        const ci = idx[i];
        if(ci === trans) continue;
        const x = left + lx, y = top + ly;
        if(x < 0 || y < 0 || x >= width || y >= height || !ct) continue;
        const o = (y * width + x) * 4, c = ci * 3;
        canvas[o] = ct[c]; canvas[o+1] = ct[c+1]; canvas[o+2] = ct[c+2]; canvas[o+3] = 255;
      }
      if(only === null || seen === only) frames.push({rgba: canvas.slice(), delayCs, width, height});
      else frames.push({delayCs, width, height});
      seen++;
      if(only !== null && seen === only + 1) break;
      if(dispose === 2){
        for(let y = 0; y < fh; y++) for(let x = 0; x < fw; x++){
          const o = ((top + y) * width + (left + x)) * 4;
          canvas[o] = canvas[o+1] = canvas[o+2] = canvas[o+3] = 0;
        }
      }else if(dispose === 3 && snapshot) canvas.set(snapshot);
      delayCs = 0; trans = -1; dispose = 0;
    }
    return {width, height, frames};
  }

  function interlacedRows(h){
    const rows = [];
    for(let y = 0; y < h; y += 8) rows.push(y);
    for(let y = 4; y < h; y += 8) rows.push(y);
    for(let y = 2; y < h; y += 4) rows.push(y);
    for(let y = 1; y < h; y += 2) rows.push(y);
    return rows;
  }

  let token = 0;
  let manifestCache = null;
  function loadManifest(fetchFn){
    if(manifestCache) return manifestCache;
    const f = fetchFn || (typeof fetch === 'function' ? fetch : null);
    if(!f) return Promise.resolve({assets:[]});
    manifestCache = f('data/medium_cuts.json?t=' + Date.now(), {cache:'no-store'}).then(r=>r.ok ? r.json() : {assets:[]}).catch(()=>({assets:[]}));
    return manifestCache;
  }

  function detach(){
    token++;
    if(typeof document === 'undefined') return;
    const old = document.getElementById('mcut');
    if(old) old.remove();
  }

  function coverBox(stage, fw, fh){
    const W = stage.clientWidth || fw, H = stage.clientHeight || fh;
    const k = Math.max(W / fw, H / fh), w = fw * k, h = fh * k;
    return {width:w, height:h, left:(W - w) / 2, top:(H - h) / 2};
  }

  function paintFrame(layer, frame){
    const plate = layer.querySelector('canvas.plate');
    const ctx = plate.getContext('2d');
    ctx.putImageData(new ImageData(frame.plate, layer._w, layer._h), 0, 0);
    const box = layer._box;
    frame.sprites.forEach((sp, i)=>{
      let node = layer.querySelector('canvas.sprite[data-i="' + i + '"]');
      if(!node){
        node = document.createElement('canvas');
        node.className = 'sprite'; node.dataset.i = String(i);
        layer.appendChild(node);
      }
      node.width = sp.w; node.height = sp.h;
      node.getContext('2d').putImageData(new ImageData(sp.rgba, sp.w, sp.h), 0, 0);
      node.style.width = (sp.w / layer._w * box.width) + 'px';
      node.style.height = (sp.h / layer._h * box.height) + 'px';
      node.style.left = (box.left + (sp.x / layer._w) * box.width + layer._off[i].x) + 'px';
      node.style.top = (box.top + (sp.y / layer._h) * box.height + layer._off[i].y) + 'px';
    });
  }

  function stillRgba(buf, w, h){
    if(typeof document === 'undefined') return null;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const url = URL.createObjectURL(new Blob([buf]));
    img.src = url;
    return img.decode().then(()=>{
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      if(img.naturalWidth !== w || img.naturalHeight !== h) throw new Error('mask_size');
      return g.getImageData(0, 0, w, h).data;
    });
  }

  function attach(set, opts){
    opts = opts || {};
    const my = ++token;
    const stage = opts.stage || (typeof document !== 'undefined' && document.getElementById('stage'));
    const image = opts.image;
    const ready = opts.manifest ? Promise.resolve(opts.manifest) : loadManifest(opts.fetch);
    return ready.then(async manifest=>{
      if(manifest && manifest.assets) await Promise.all(manifest.assets.map(expandRow));
      const plan = forSet(set, manifest);
      if(!plan.ok || my !== token) return plan;
      const hold = frameHoldBytes(plan.width, plan.height, plan.frameCount);
      if(hold > 16 * 1024 * 1024) plan.stream = true;
      const fetchFn = opts.fetch || fetch;
      return fetchFn(set.url, {cache:'force-cache'}).then(r=>{
        if(!r.ok) throw new Error('fetch');
        return r.arrayBuffer();
      }).then(buf=>{
        if(my !== token) return {ok:false, reason:'stale'};
        const bytes = new Uint8Array(buf);
        if(plan.kind === 'gif' && plan.stream){
          const walked = decodeGif(bytes, {only: plan.frameCount - 1});
          if(!delaysMatch(walked, plan.delays_cs)) return {plan, mismatch:true};
          return {plan, bytes, stream:true};
        }
        if(plan.kind === 'gif') return {decoded: decodeGif(bytes), plan};
        if(opts.stillRgba) return {decoded:{rgba:opts.stillRgba, width:plan.width, height:plan.height}, plan};
        return stillRgba(bytes, plan.width, plan.height).then(rgba=>({decoded:{rgba, width:plan.width, height:plan.height}, plan}));
      }).then(got=>{
        if(!got || my !== token) return got || {ok:false, reason:'stale'};
        if(got.mismatch) return reject('delay_mismatch');
        const playback = got.stream ? {ok:true, width:got.plan.width, height:got.plan.height, frames: got.plan.delays_cs.map(d=>({playMs:playMs(d)})), stream:true, bytes:got.bytes, plan:got.plan} : planFrames(got.decoded, got.plan);
        if(!playback.ok || typeof document === 'undefined' || !stage) return playback;
        const old = document.getElementById('mcut');
        if(old){ clearTimeout(old._timer); old.remove(); }
        const layer = document.createElement('div');
        layer.id = 'mcut'; layer._w = playback.width; layer._h = playback.height; layer._token = my;
        layer._box = coverBox(stage, playback.width, playback.height);
        const nsprite = playback.stream ? playback.plan.objects.length : playback.frames[0].sprites.length;
        layer._off = Array.from({length:nsprite}, ()=>({x:0, y:0}));
        const plate = document.createElement('canvas');
        plate.className = 'plate'; plate.width = playback.width; plate.height = playback.height;
        Object.assign(plate.style, {width:layer._box.width + 'px', height:layer._box.height + 'px', left:layer._box.left + 'px', top:layer._box.top + 'px'});
        layer.appendChild(plate);
        stage.insertBefore(layer, stage.querySelector('#cap') || null);
        let shown = 0;
        const step = ()=>{
          if(my !== token) return;
          layer._shown = shown;
          let frame = playback.frames[shown];
          if(playback.stream){
            const one = decodeGif(playback.bytes, {only: shown});
            const rgba = one.frames[one.frames.length - 1].rgba;
            const masks = playback.plan.objects.map(obj=>obj.masks[shown]);
            const drawn = compose(rgba, playback.width, playback.height, masks, null);
            frame = {plate: drawn.plate, sprites: drawn.sprites, playMs: playback.frames[shown].playMs};
          }
          paintFrame(layer, frame);
          const wait = playback.frames[shown].playMs;
          shown = (shown + 1) % playback.frames.length;
          layer._timer = setTimeout(step, wait);
        };
        layer.addEventListener('pointerdown', ev=>{
          const node = ev.target.closest && ev.target.closest('canvas.sprite');
          if(!node) return;
          const i = +node.dataset.i;
          layer._drag = {i, sx:ev.clientX, sy:ev.clientY, ox:layer._off[i].x, oy:layer._off[i].y};
          ev.preventDefault();
        });
        layer.addEventListener('pointermove', ev=>{
          const d = layer._drag; if(!d) return;
          layer._off[d.i] = {x:d.ox + (ev.clientX - d.sx), y:d.oy + (ev.clientY - d.sy)};
          paintFrame(layer, playback.frames[layer._shown || 0]);
        });
        layer.addEventListener('pointerup', ()=>{ layer._drag = null; });
        layer.addEventListener('pointercancel', ()=>{ layer._drag = null; });
        if(image){ image.classList.remove('on'); image.style.transition = 'none'; image.style.opacity = '0'; }
        step();
        return {ok:true, reason:null, frames:playback.frames.length};
      });
    }).catch(()=>{
      if(my !== token) return {ok:false, reason:'stale'};
      if(image) image.classList.add('on');
      const old = typeof document !== 'undefined' && document.getElementById('mcut');
      if(old && old._token === my){ clearTimeout(old._timer); old.remove(); }
      return {ok:false, reason:'unavailable'};
    });
  }

  const api = {CAP, USED, RESERVE, roomBytes, admit, isMedium, coverage, forSet, compose, planFrames, decodeGif, delaysMatch, playMs, attach, detach, loadManifest, inkBox, unpackMask, frameHoldBytes, expandObject};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThrydMediumCuts = api;
})(typeof window !== 'undefined' ? window : globalThis);
