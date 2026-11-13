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
    const kind = row.kind === 'gif' || row.kind === 'still' ? row.kind : (row.still ? 'still' : (set.extension === 'gif' ? 'gif' : 'still'));
    if(kind === 'gif' && set.extension && set.extension !== 'gif') return reject('kind_mismatch');
    // A still pack may be one exact frame cut from a GIF; the live set can still be that GIF.
    const frameCount = kind === 'gif' ? (row.delays_cs || []).length : 1;
    const stillFrame = kind === 'still' ? Math.max(0, row.still_frame|0) : 0;
    if(kind === 'gif' && frameCount < 1) return reject('delay_mismatch');
    const w = row.frame_size && row.frame_size[0], h = row.frame_size && row.frame_size[1];
    if(!w || !h) return reject('mask_size');
    const objects = (row.objects || []).map(expandObject);
    if(!objects.length) return reject('no_object');
    for(let i = 0; i < objects.length; i++){
      const why = checkObject(objects[i], kind, frameCount, w, h);
      if(why) return reject(why);
    }
    let plate = null, plateKnown = null;
    const plateB64 = row.plate_gzip_b64 || row.plate_deflate_b64;
    if(plateB64 && row.plate_error) return reject(row.plate_error);
    const rawPlate = row.plate_rgba || (plateB64 ? inflateAny(b64bytes(plateB64)) : null);
    if(plateB64 && !rawPlate) return reject('plate_decode_failed');
    if(rawPlate && row.plate_known_bits){
      const known = unpackMask(row.plate_known_bits, w, h);
      if(rawPlate.length === w * h * 4 && known){ plate = rawPlate; plateKnown = known; }
    }
    return {ok:true, reason:null, kind, frameCount, width:w, height:h, delays_cs: kind === 'gif' ? row.delays_cs.slice() : [0], still: kind === 'still', still_frame: stillFrame, objects, plate, plateKnown};
  }

  function delaysMatch(parsed, delays){
    if(!parsed || !parsed.frames || !delays || parsed.frames.length !== delays.length) return false;
    for(let i = 0; i < delays.length; i++) if(parsed.frames[i].delayCs !== delays[i]) return false;
    return true;
  }

  function playMs(delayCs){ return delayCs === 0 ? 100 : delayCs * 10; }

  // moved[k] false: object k sits at its own spot, so the original frame pixels stay under it
  // (no hole, the setting is drawn). moved[k] true or no moved list: its former spot takes the
  // stored plate fill where known, else a darkened, blurred copy of this same frame (a soft
  // shadow, not a black void and not a full-opacity duplicate of the subject).
  const SHADOW_BRIGHT = 0.45;
  const SHADOW_BLUR = 10;
  function boxBlur(src, w, h, r){
    const tmp = new Uint8ClampedArray(src.length);
    const out = new Uint8ClampedArray(src.length);
    function pass(inp, dst, horiz){
      const len = horiz ? w : h, lines = horiz ? h : w;
      const pref = new Uint32Array((len + 1) * 4);
      const diam = r * 2 + 1;
      for(let line = 0; line < lines; line++){
        for(let i = 0; i < len; i++){
          const x = horiz ? i : line, y = horiz ? line : i, p = (y * w + x) * 4, o = (i + 1) * 4;
          pref[o] = pref[o - 4] + inp[p];
          pref[o + 1] = pref[o - 3] + inp[p + 1];
          pref[o + 2] = pref[o - 2] + inp[p + 2];
          pref[o + 3] = pref[o - 1] + inp[p + 3];
        }
        for(let i = 0; i < len; i++){
          const lo = i - r, hi = i + r;
          let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
          if(lo < 0){
            const n = -lo, e = 4;
            s0 = pref[e] * n; s1 = pref[e + 1] * n; s2 = pref[e + 2] * n; s3 = pref[e + 3] * n;
          }
          if(hi >= len){
            const n = hi - len + 1, e = len * 4;
            s0 += (pref[e] - pref[e - 4]) * n;
            s1 += (pref[e + 1] - pref[e - 3]) * n;
            s2 += (pref[e + 2] - pref[e - 2]) * n;
            s3 += (pref[e + 3] - pref[e - 1]) * n;
          }
          const a = lo < 0 ? 0 : lo, b = hi >= len ? len - 1 : hi;
          if(a <= b){
            const hb = (b + 1) * 4, ha = a * 4;
            s0 += pref[hb] - pref[ha]; s1 += pref[hb + 1] - pref[ha + 1];
            s2 += pref[hb + 2] - pref[ha + 2]; s3 += pref[hb + 3] - pref[ha + 3];
          }
          const x = horiz ? i : line, y = horiz ? line : i, p = (y * w + x) * 4;
          dst[p] = (s0 + diam / 2) / diam;
          dst[p + 1] = (s1 + diam / 2) / diam;
          dst[p + 2] = (s2 + diam / 2) / diam;
          dst[p + 3] = (s3 + diam / 2) / diam;
        }
      }
    }
    pass(src, tmp, true);
    pass(tmp, out, false);
    return out;
  }
  function cpuShadow(src, w, h){
    let cur = src instanceof Uint8ClampedArray ? src : Uint8ClampedArray.from(src);
    for(let n = 0; n < 3; n++) cur = boxBlur(cur, w, h, SHADOW_BLUR);
    const out = new Uint8ClampedArray(cur.length);
    for(let i = 0; i < cur.length; i += 4){
      out[i] = Math.round(cur[i] * SHADOW_BRIGHT);
      out[i + 1] = Math.round(cur[i + 1] * SHADOW_BRIGHT);
      out[i + 2] = Math.round(cur[i + 2] * SHADOW_BRIGHT);
      out[i + 3] = cur[i + 3];
    }
    return out;
  }
  function canvasShadow(src, w, h){
    const pad = SHADOW_BLUR * 3;
    const make = (cw, ch)=>{
      if(typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(cw, ch);
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c;
    };
    const px = src instanceof Uint8ClampedArray ? src : Uint8ClampedArray.from(src);
    const pw = w + pad * 2, ph = h + pad * 2;
    const padded = new Uint8ClampedArray(pw * ph * 4);
    for(let y = 0; y < ph; y++){
      const sy = y < pad ? 0 : (y >= pad + h ? h - 1 : y - pad);
      for(let x = 0; x < pw; x++){
        const sx = x < pad ? 0 : (x >= pad + w ? w - 1 : x - pad);
        const d = (y * pw + x) * 4, s = (sy * w + sx) * 4;
        padded[d] = px[s]; padded[d + 1] = px[s + 1]; padded[d + 2] = px[s + 2]; padded[d + 3] = px[s + 3];
      }
    }
    const padC = make(pw, ph);
    padC.getContext('2d').putImageData(new ImageData(padded, pw, ph), 0, 0);
    const outC = make(pw, ph);
    const octx = outC.getContext('2d');
    octx.filter = 'blur(' + SHADOW_BLUR + 'px) brightness(' + SHADOW_BRIGHT + ')';
    octx.drawImage(padC, 0, 0);
    return octx.getImageData(pad, pad, w, h).data;
  }
  function shadowFill(src, w, h){
    try{
      if(typeof ImageData !== 'undefined' && (typeof OffscreenCanvas !== 'undefined' || (typeof document !== 'undefined' && document.createElement))){
        const got = canvasShadow(src, w, h);
        if(got && got.length === w * h * 4) return got;
      }
    }catch(e){}
    return cpuShadow(src, w, h);
  }
  function compose(rgba, w, h, masks, plate, moved){
    const src = rgba instanceof Uint8ClampedArray ? rgba : Uint8ClampedArray.from(rgba);
    const plateOut = new Uint8ClampedArray(src);
    const known = plate && plate.known;
    const fill = plate && plate.rgba;
    const sprites = [];
    const holeNeed = new Uint8Array(w * h);
    const holeKnown = new Uint8Array(w * h);
    (masks || []).forEach((raw, k)=>{
      const mask = asMask(raw, w, h);
      const box = inkBox(mask, w, h);
      const hole = !moved || !!moved[k];
      const sprite = new Uint8ClampedArray(box.w * box.h * 4);
      for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
        const i = y * w + x;
        if(!mask[i]) continue;
        const s = ((y - box.y) * box.w + (x - box.x)) * 4;
        const p = i * 4;
        sprite[s] = src[p]; sprite[s+1] = src[p+1]; sprite[s+2] = src[p+2]; sprite[s+3] = src[p+3];
        if(!hole) continue;
        // remember known plate samples; apply them only if they cover the hole cleanly
        if(known && known[i] && fill && fill[p+3] === 255) holeKnown[i] = 1;
        holeNeed[i] = 1;
      }
      sprites.push({x:box.x, y:box.y, w:box.w, h:box.h, rgba:sprite});
    });
    let needN = 0, knownN = 0;
    for(let i = 0; i < holeNeed.length; i++) if(holeNeed[i]){ needN++; if(holeKnown[i]) knownN++; }
    // Sparse plate in a hole shows as ragged white or subject islands beside the shadow.
    // Use plate (or a clean other-frame fill already baked into it) only when it covers the hole;
    // otherwise the whole hole gets the darkened blurred fill.
    const usePlate = needN && knownN * 10 >= needN * 9;
    if(usePlate){
      for(let i = 0; i < holeNeed.length; i++){
        if(!holeNeed[i] || !holeKnown[i]) continue;
        const p = i * 4;
        plateOut[p] = fill[p]; plateOut[p+1] = fill[p+1]; plateOut[p+2] = fill[p+2]; plateOut[p+3] = fill[p+3];
        holeNeed[i] = 0;
      }
    }
    let any = 0;
    for(let i = 0; i < holeNeed.length; i++) if(holeNeed[i]){ any = 1; break; }
    if(any){
      const shade = shadowFill(src, w, h);
      for(let i = 0; i < holeNeed.length; i++){
        if(!holeNeed[i]) continue;
        const p = i * 4;
        plateOut[p] = shade[p]; plateOut[p+1] = shade[p+1]; plateOut[p+2] = shade[p+2]; plateOut[p+3] = 255;
      }
    }
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
      const objPlate = plan.objects.find(o=>o.plate && o.plate_known);
      const plateSrc = plan.plate ? {rgba:plan.plate, known:plan.plateKnown} : (objPlate ? {rgba:objPlate.plate, known:objPlate.plate_known} : null);
      const drawn = compose(source[f].rgba, plan.width, plan.height, masks, plateSrc);
      frames.push({delayCs: plan.kind === 'gif' ? plan.delays_cs[f] : 0, playMs: playMs(plan.kind === 'gif' ? plan.delays_cs[f] : 0), plate:drawn.plate, sprites:drawn.sprites, src:source[f].rgba, masks, plateSrc});
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
  function inflateAny(u8){
    if(!u8 || !u8.length) return null;
    if(u8[0] === 0x1f && u8[1] === 0x8b) return gunzip(u8);
    if(u8[0] === 0x78 && typeof require === 'function'){
      try{ return new Uint8Array(require('zlib').inflateSync(u8)); }catch(e){ return null; }
    }
    return null;
  }
  function bytesToB64(u8){
    if(typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
    let s = '';
    const step = 0x8000;
    for(let i = 0; i < u8.length; i += step){
      s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(u8.length, i + step)));
    }
    return btoa(s);
  }
  function readMaskBlob(raw, count){
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const out = [];
    let p = 0;
    for(let i = 0; i < count; i++){
      const x = view.getUint16(p, true), y = view.getUint16(p + 2, true), w = view.getUint16(p + 4, true), h = view.getUint16(p + 6, true);
      const n = view.getUint32(p + 8, true);
      p += 12;
      out.push({x, y, w, h, bits: bytesToB64(raw.subarray(p, p + n))});
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
  async function absorbPack(row){
    if(!row || !row.pack || (row.objects && row.objects.length)) return row;
    if(typeof fetch !== 'function') return row;
    let pack;
    try{
      const ver = row.pack_version || '1';
      const key = row.source_sha256 ? ('pack:' + row.source_sha256 + ':' + ver) : '';
      const keep = root.ThrydKeep;
      const res = (keep && key && keep.mayCache(row.pack)) ? await keep.fetchCached(row.pack, {cache:'no-store'}, key) : await fetch(row.pack, {cache:'no-store'});
      if(!res.ok){ row.plate_error = 'pack_missing'; return row; }
      pack = await res.json();
    }catch(e){ row.plate_error = 'pack_missing'; return row; }
    const keep = {status: row.status, reviewed: row.reviewed, review: row.review, mlib: row.mlib, select: row.select, pack: row.pack};
    Object.keys(pack).forEach(function(k){
      if(k === 'object_id' || k === 'state_id' || k === 'run' || k === 'card' || k === 'jN') return;
      row[k] = pack[k];
    });
    row.status = keep.status;
    row.reviewed = keep.reviewed;
    if(keep.review) row.review = keep.review;
    if(keep.mlib) row.mlib = keep.mlib;
    if(keep.select) row.select = keep.select;
    row.pack = keep.pack;
    (row.objects || []).forEach(function(o){ if(!o) return; delete o.object_id; delete o.state_id; });
    return row;
  }
  async function expandRow(row){
    await absorbPack(row);
    const objects = (row && row.objects) || [];
    for(let i = 0; i < objects.length; i++){
      const obj = objects[i];
      if(!obj || obj.masks || !obj.masks_deflate) continue;
      let raw = inflateAny(b64bytes(obj.masks_deflate));
      if(!raw && typeof DecompressionStream === 'function'){
        const bytes = b64bytes(obj.masks_deflate);
        const format = bytes[0] === 0x78 ? 'deflate' : 'gzip';
        const ds = new DecompressionStream(format);
        const stream = new Blob([bytes]).stream().pipeThrough(ds);
        raw = new Uint8Array(await new Response(stream).arrayBuffer());
      }
      if(raw) obj.masks = readMaskBlob(raw, obj.mask_count || 0);
    }
    const plateB64 = row && (row.plate_gzip_b64 || row.plate_deflate_b64);
    if(plateB64 && !row.plate_rgba){
      let raw = inflateAny(b64bytes(plateB64));
      if(!raw && typeof DecompressionStream === 'function'){
        const bytes = b64bytes(plateB64);
        const format = bytes[0] === 0x78 ? 'deflate' : 'gzip';
        try{
          const ds = new DecompressionStream(format);
          const stream = new Blob([bytes]).stream().pipeThrough(ds);
          raw = new Uint8Array(await new Response(stream).arrayBuffer());
        }catch(e){ raw = null; }
      }
      if(raw) row.plate_rgba = raw;
      else row.plate_error = 'plate_decode_failed';
    }
    return row;
  }
  function frameHoldBytes(w, h, n){ return w * h * 4 * n; }

  // Hole fill for a moved object, from exact posted pixels only. Per pixel: the stored plate pixel
  // if known, else the pixel from the first frame of the same GIF where that spot is outside every
  // object's mask (grown by FILL_GUARD px so rough mask edges don't carry the subject along), else
  // nothing (transparent). One static fill per cut, built in a single pass over the frames.
  const FILL_GUARD = 2;
  function grow(mask, w, h, r){
    if(!r) return mask;
    const a = new Uint8Array(w * h), b = new Uint8Array(w * h);
    for(let y = 0; y < h; y++){
      const row = y * w; let last = -1e9;
      for(let x = 0; x < w; x++){ if(mask[row + x]) last = x; if(x - last <= r) a[row + x] = 1; }
      last = 1e9;
      for(let x = w - 1; x >= 0; x--){ if(mask[row + x]) last = x; if(last - x <= r) a[row + x] = 1; }
    }
    for(let x = 0; x < w; x++){
      let last = -1e9;
      for(let y = 0; y < h; y++){ if(a[y * w + x]) last = y; if(y - last <= r) b[y * w + x] = 1; }
      last = 1e9;
      for(let y = h - 1; y >= 0; y--){ if(a[y * w + x]) last = y; if(last - y <= r) b[y * w + x] = 1; }
    }
    return b;
  }
  function fillBuilder(w, h, plate, plateKnown, guard){
    const n = w * h;
    const rgba = new Uint8ClampedArray(n * 4);
    const known = new Uint8Array(n);
    const from = new Int32Array(n).fill(-1); // frame each temporal pixel came from (-2 = stored plate)
    let left = n;
    if(plate && plateKnown){
      for(let i = 0; i < n; i++) if(plateKnown[i]){
        const p = i * 4; rgba[p] = plate[p]; rgba[p+1] = plate[p+1]; rgba[p+2] = plate[p+2]; rgba[p+3] = plate[p+3];
        known[i] = 1; from[i] = -2; left--;
      }
    }
    return {
      add(f, src, masks){
        if(!left) return;
        const cover = new Uint8Array(n);
        (masks || []).forEach(raw=>{ const m = asMask(raw, w, h); if(m) for(let i = 0; i < n; i++) if(m[i]) cover[i] = 1; });
        const block = grow(cover, w, h, guard == null ? FILL_GUARD : guard);
        for(let i = 0; i < n; i++){
          if(known[i] || block[i]) continue;
          const p = i * 4;
          if(src[p+3] < 255) continue;
          rgba[p] = src[p]; rgba[p+1] = src[p+1]; rgba[p+2] = src[p+2]; rgba[p+3] = 255;
          known[i] = 1; from[i] = f; left--;
        }
      },
      done(){ return {rgba, known, from}; }
    };
  }
  function framesFill(plan, frameRgba){
    const fb = fillBuilder(plan.width, plan.height, plan.plate, plan.plateKnown);
    for(let f = 0; f < plan.frameCount; f++) fb.add(f, frameRgba[f], plan.objects.map(o=>(o.masks || [o.mask])[plan.kind === 'gif' ? f : 0]));
    return fb.done();
  }

  function createGifDecoder(bytes){
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
    const headerP = p;
    const canvas = new Uint8ClampedArray(width * height * 4);
    let delayCs = 0, trans = -1, dispose = 0, seen = 0, ended = false, pendingDispose = null;
    function reset(){
      p = headerP;
      canvas.fill(0);
      delayCs = 0; trans = -1; dispose = 0; seen = 0; ended = false; pendingDispose = null;
    }
    function next(){
      if(ended) return null;
      if(pendingDispose){ pendingDispose(); pendingDispose = null; }
      while(p < u.length){
        const b = u[p++];
        if(b === 0x3b) break;
        if(b === 0x21){
          const label = u[p++];
          if(label === 0xf9){
            p++;
            const gp = u[p++];
            delayCs = dv.getUint16(p, true); p += 2;
            const ti = u[p++]; dispose = (gp >> 2) & 7; trans = (gp & 1) ? ti : -1;
            p++;
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
        const rgba = canvas.slice();
        const index = seen;
        const delay = delayCs;
        seen++;
        const d2 = dispose, sl = snapshot, t = top, l = left, fww = fw, fhh = fh;
        pendingDispose = ()=>{
          if(d2 === 2){
            for(let y = 0; y < fhh; y++) for(let x = 0; x < fww; x++){
              const o = ((t + y) * width + (l + x)) * 4;
              canvas[o] = canvas[o+1] = canvas[o+2] = canvas[o+3] = 0;
            }
          }else if(d2 === 3 && sl) canvas.set(sl);
        };
        delayCs = 0; trans = -1; dispose = 0;
        return {rgba, delayCs: delay, width, height, index, canvas};
      }
      ended = true;
      return null;
    }
    function until(n){
      let last = null;
      while(seen <= n){
        const fr = next();
        if(!fr) break;
        last = fr;
      }
      return last;
    }
    return {width, height, next, until, reset, get seen(){ return seen; }};
  }

  function decodeGif(bytes, opts){
    const dec = createGifDecoder(bytes);
    const frames = [];
    const only = opts && Number.isInteger(opts.only) ? opts.only : null;
    let fr;
    while((fr = dec.next())){
      if(opts && opts.visit) opts.visit(fr.index, fr.canvas);
      if(only === null || fr.index === only) frames.push({rgba: fr.rgba, delayCs: fr.delayCs, width: fr.width, height: fr.height});
      else frames.push({delayCs: fr.delayCs, width: fr.width, height: fr.height});
      if(only !== null && fr.index === only) break;
    }
    return {width: dec.width, height: dec.height, frames};
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
    if(old){
      clearTimeout(old._timer);
      if(old._playback){ old._playback.decoder=null; old._playback.bytes=null; old._playback.frames=null; old._playback=null; }
      old._frame=null;
      old.querySelectorAll('canvas').forEach(c=>{ try{ c.width=0; c.height=0; }catch(e){} });
      old.remove();
    }
  }

  function coverBox(stage, fw, fh){
    const W = stage.clientWidth || fw, H = stage.clientHeight || fh;
    const k = Math.max(W / fw, H / fh), w = fw * k, h = fh * k;
    return {width:w, height:h, left:(W - w) / 2, top:(H - h) / 2};
  }

  function movedFlags(layer, n){
    const out = [];
    for(let i = 0; i < n; i++){ const o = layer._off && layer._off[i]; out.push(!!((o && (o.x || o.y)) || (layer._wan && layer._wan[i]) || (layer._gone && layer._gone[i]))); }
    return out;
  }
  // background under the cuts: the original frame where nothing moved; a hole (plate fill or
  // a soft shadow from this same frame) only at the former spot of an object that was dragged or restored to a new place
  function plateFor(layer, frame){
    if(!frame.src || !frame.masks) return frame.plate;
    const moved = movedFlags(layer, frame.masks.length);
    if(!moved.some(Boolean)) return frame.src;
    if(frame.plate && moved.every(Boolean)) return frame.plate;
    const key = moved.map(m=>m ? 1 : 0).join('');
    if(frame._key !== key){ frame._mixed = compose(frame.src, layer._w, layer._h, frame.masks, frame.plateSrc, moved).plate; frame._key = key; }
    return frame._mixed;
  }
  function paintFrame(layer, frame){
    const plate = layer.querySelector('canvas.plate');
    const ctx = plate.getContext('2d');
    const px = plateFor(layer, frame);
    ctx.putImageData(new ImageData(px instanceof Uint8ClampedArray ? px : new Uint8ClampedArray(px.buffer, px.byteOffset, px.length), layer._w, layer._h), 0, 0);
    const box = layer._box;
    frame.sprites.forEach((sp, i)=>{
      let node = layer.querySelector('canvas.sprite[data-i="' + i + '"]');
      if(!node){
        node = document.createElement('canvas');
        node.className = 'sprite'; node.dataset.i = String(i);
        // idle float like the run-view objects (CSS .fl in projector.css); phone.html keeps its still cuts
        if(!(root.location && /phone\.html$/.test(root.location.pathname))){
          node.classList.add('fl');
          node.style.setProperty('--fd', (5.5 + ((i * 1.7 + (layer._w % 7)) % 3.5)).toFixed(2) + 's');
          node.style.setProperty('--fdl', (-((i * 2.3) % 6)).toFixed(2) + 's');
        }
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

  // ---------- cut life (Jesuye 11-12 5:07 PM: "behave like the other objects"): the run-scene objects' wander / drift-off / visitor
  // behaviours for Medium/X cuts. Moves are CSS `translate` (so the idle float on `transform` keeps running); while a cut is away its
  // home spot gets the same hole fill a dragged cut gets (plateFor), so the photo underneath never shows a double. Automatic trips are
  // reported through window.thrydDrift (kind "drift", never a customer move). Off on phone.html and for prefers-reduced-motion.
  const LIFE_OFF = ()=> typeof window === 'undefined' || (root.location && /phone\.html$/.test(root.location.pathname)) ||
    (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const STILL_RX = /stall|sign|table|shelter|door|street|window|board|wall|tree|gate|house|building|kiosk|road|sky|floor|bed|couch|sofa|counter|shelf/i;
  const TRAVEL_KEY = 'thryd_travel_v1';
  const lifePaused = ()=> (typeof document !== 'undefined') && (document.hidden || document.body.classList.contains('dragmode') || document.body.classList.contains('cm-paused') || document.body.classList.contains('cerebro') || document.body.classList.contains('lovemap'));
  function drift(info){ try{ if(root.thrydDrift) root.thrydDrift(info); }catch(e){} }
  function spriteInfo(layer, i){
    const f = layer._frame, sp = f && f.sprites && f.sprites[i], bx = layer._box;
    if(!sp || !bx) return null;
    const area = (sp.w * sp.h) / (layer._w * layer._h);
    return {sp, area, label: (layer._labels && layer._labels[i]) || ('cut' + (i + 1)), klass: (layer._klass && layer._klass[i]) || null,
      cx: (sp.x + sp.w / 2) / layer._w * 100, cy: (sp.y + sp.h / 2) / layer._h * 100};
  }
  function foldWander(layer, i, node){
    if(!layer._wan || !layer._wan[i]) return;
    const t = (getComputedStyle(node).translate || '').split(/\s+/).map(parseFloat);
    const tx = isFinite(t[0]) ? t[0] : 0, ty = isFinite(t[1]) ? t[1] : 0;
    layer._off[i] = {x: layer._off[i].x + tx, y: layer._off[i].y + ty};
    node.style.transition = 'none'; node.style.translate = ''; layer._wan[i] = false;
    if(layer._frame) paintFrame(layer, layer._frame);
  }
  function nodeOf(layer, i){ return layer.querySelector('canvas.sprite[data-i="' + i + '"]'); }
  function roams(layer, i, maxArea){
    const inf = spriteInfo(layer, i); const n = nodeOf(layer, i);
    if(!inf || !n || n.dataset.dragging === '1' || (layer._gone && layer._gone[i]) || (layer._wan && layer._wan[i])) return null;
    if(inf.area > (maxArea || 0.3) || STILL_RX.test(inf.label + ' ' + (inf.klass || ''))) return null;
    return Object.assign(inf, {node: n});
  }
  // wander: travel to another spot in the frame and back after a pause (run objects: wMove "move around the frame, not rock in place")
  function wander(layer){
    const n = (layer._labels || []).length; if(!n) return;
    const order = Array.from({length:n}, (_, k)=>k).sort(()=>Math.random() - 0.5);
    for(const i of order){
      const r = roams(layer, i, 0.3); if(!r) continue;
      const bx = layer._box, W = bx.width, H = bx.height;
      const nw = parseFloat(r.node.style.width) || 0, nh = parseFloat(r.node.style.height) || 0;
      const L0 = parseFloat(r.node.style.left) || 0, T0 = parseFloat(r.node.style.top) || 0;
      const stage = layer.parentNode, SW = (stage && stage.clientWidth) || W, SH = (stage && stage.clientHeight) || H;
      let dx = (Math.random() < 0.5 ? -1 : 1) * (0.04 + Math.random() * 0.12) * SW, dy = (Math.random() * 2 - 1) * 0.03 * SH;
      dx = Math.max(-L0 + 0.02 * SW, Math.min(SW * 0.98 - nw - L0, dx)); dy = Math.max(-T0 + 0.05 * SH, Math.min(SH * 0.92 - nh - T0, dy));
      if(Math.abs(dx) < 0.02 * SW) continue;
      layer._wan = layer._wan || []; layer._wan[i] = true;
      if(layer._frame) paintFrame(layer, layer._frame);
      const node = r.node, dur = 3.2 + Math.abs(dx) / SW * 14;
      node.style.transition = 'translate ' + dur.toFixed(2) + 's cubic-bezier(.45,.05,.35,1)';
      requestAnimationFrame(()=>{ node.style.translate = dx.toFixed(1) + 'px ' + dy.toFixed(1) + 'px'; });
      drift({kind:'wander', scene: layer._mid, scene_kind:'medium_cut', cut: r.label, cut_index: i, klass: r.klass,
        from: {x: +r.cx.toFixed(2), y: +r.cy.toFixed(2)}, to: {x: +(r.cx + dx / W * 100).toFixed(2), y: +(r.cy + dy / H * 100).toFixed(2)}});
      const back = ()=>{
        if(!node.isConnected || !layer._wan || !layer._wan[i]) return;
        if(lifePaused() || layer._drag){ setTimeout(back, 1500); return; }
        node.style.translate = '0px 0px';
        setTimeout(()=>{ if(node.isConnected && layer._wan && layer._wan[i]){ layer._wan[i] = false; node.style.transition = ''; node.style.translate = ''; if(layer._frame) paintFrame(layer, layer._frame); } }, dur * 1000 + 80);
      };
      setTimeout(back, dur * 1000 + 2500 + Math.random() * 6000);
      return;
    }
  }
  // drift off: one small cut leaves through the nearer edge, its snapshot joins the traveller pool and turns up in a later scene
  function travelPool(){ try{ return JSON.parse(sessionStorage.getItem(TRAVEL_KEY) || '[]') || []; }catch(e){ return []; } }
  function savePool(a){ try{ sessionStorage.setItem(TRAVEL_KEY, JSON.stringify(a.slice(-8))); }catch(e){ try{ sessionStorage.setItem(TRAVEL_KEY, JSON.stringify(a.slice(-3))); }catch(e2){} } }
  function snapshot(node){
    const k = Math.min(1, 220 / Math.max(node.width, node.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(node.width * k)); c.height = Math.max(1, Math.round(node.height * k));
    c.getContext('2d').drawImage(node, 0, 0, c.width, c.height); return c.toDataURL('image/png');
  }
  function driftOff(layer, title){
    const n = (layer._labels || []).length; let best = null;
    for(let i = 0; i < n; i++){ const r = roams(layer, i, 0.12); if(r && (!best || r.area < best.area)) best = Object.assign(r, {i}); }
    if(!best) return;
    const i = best.i, node = best.node, stage = layer.parentNode, SW = (stage && stage.clientWidth) || 1000;
    const L0 = parseFloat(node.style.left) || 0, nw = parseFloat(node.style.width) || 0, left = (L0 + nw / 2) < SW / 2;
    let img = null; try{ img = snapshot(node); }catch(e){ return; }
    const pool = travelPool().filter(t => !(t.from === layer._mid && t.label === best.label));
    pool.push({img, label: best.label, klass: best.klass, from: layer._mid, title: title || null, wf: nw / SW, at: Date.now()}); savePool(pool);
    layer._gone = layer._gone || []; layer._gone[i] = true;
    if(layer._frame) paintFrame(layer, layer._frame);
    const dx = left ? -(L0 + nw + 40) : (SW - L0 + 40);
    node.style.transition = 'translate 5.5s cubic-bezier(.5,0,.3,1), opacity 2.2s ease-in 3.4s';
    requestAnimationFrame(()=>{ node.style.translate = dx.toFixed(0) + 'px ' + (-0.02 * SW).toFixed(0) + 'px'; node.style.opacity = '0'; node.style.pointerEvents = 'none'; });
    drift({kind:'leave', scene: layer._mid, scene_kind:'medium_cut', cut: best.label, cut_index: i, klass: best.klass,
      from: {x: +best.cx.toFixed(2), y: +best.cy.toFixed(2)}, to: {x: left ? -10 : 110, y: +best.cy.toFixed(2)}, edge: left ? 'left' : 'right'});
  }
  // visitor: a traveller from another scene walks in from the nearer edge, stays (draggable) until the scene changes; the cuts here notice
  function visit(layer){
    if(layer.querySelector('.mcvisit')) return;
    const pool = travelPool().filter(t => t.from !== layer._mid && t.img); if(!pool.length) return;
    const t = pool.sort((p, q)=> q.at - p.at)[0];
    savePool(travelPool().filter(p => !(p.from === t.from && p.label === t.label)));
    const stage = layer.parentNode, SW = (stage && stage.clientWidth) || 1000, SH = (stage && stage.clientHeight) || 600;
    const w = Math.max(60, Math.min(0.16 * SW, (t.wf || 0.08) * SW));
    const im = new Image(); im.className = 'mcvisit'; im.alt = t.label; im.draggable = false; im.src = t.img;
    const x = (0.12 + Math.random() * 0.62) * SW, fromLeft = x < SW / 2;
    Object.assign(im.style, {position:'absolute', width: w + 'px', left: x + 'px', bottom: (8 + Math.random() * 14) + '%', zIndex: 3});
    im.style.setProperty('--vx', (fromLeft ? -1 : 1) * (x + w + 40) + 'px');
    im.style.setProperty('--fd', (6 + Math.random() * 3).toFixed(2) + 's');
    const from = t.title || t.from;
    const tag = document.createElement('span'); tag.className = 'mcvfrom'; tag.textContent = 'from ' + String(from).slice(0, 48);
    layer.appendChild(im); layer.appendChild(tag);
    const place = ()=>{ tag.style.left = (parseFloat(im.style.left) + w / 2) + 'px'; tag.style.top = (im.offsetTop + im.offsetHeight + 6) + 'px'; };
    im.onload = place; setTimeout(place, 50);
    drift({kind:'arrive', scene: layer._mid, scene_kind:'medium_cut', cut: t.label, klass: t.klass, from_scene: t.from, from_title: t.title || null,
      to: {x: +((x + w / 2) / SW * 100).toFixed(2), y: null}});
    setTimeout(()=>{ if(!im.isConnected) return; const vx = im.getBoundingClientRect().left;
      layer.querySelectorAll('canvas.sprite').forEach((c, k)=>{ if(c.dataset.dragging === '1' || (layer._wan && layer._wan[+c.dataset.i])) return;
        setTimeout(()=>{ c.classList.remove('mcnotice'); void c.offsetWidth; c.classList.add('mcnotice'); setTimeout(()=>c.classList.remove('mcnotice'), 1300); }, k * 180); }); }, 3400);
    // customer drag of a visitor stays a customer move, bound to where it came from
    let d = null;
    im.addEventListener('pointerdown', ev=>{ ev.preventDefault(); ev.stopPropagation(); d = {sx: ev.clientX, sy: ev.clientY, l: parseFloat(im.style.left), b: im.getBoundingClientRect()}; im.style.animation = 'none'; im.classList.add('mcvdrag'); try{ im.setPointerCapture(ev.pointerId); document.body.classList.add('dragmode'); }catch(e){} });
    im.addEventListener('pointermove', ev=>{ if(!d) return; im.style.transform = 'translate(' + (ev.clientX - d.sx) + 'px,' + (ev.clientY - d.sy) + 'px)'; });
    const end = ev=>{ if(!d) return; const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy, sb = stage.getBoundingClientRect();
      im.style.transform = ''; im.style.left = (d.l + dx) + 'px'; im.style.bottom = ''; im.style.top = (d.b.top - sb.top + dy) + 'px'; im.classList.remove('mcvdrag'); im.style.animation = '';
      try{ document.body.classList.remove('dragmode'); }catch(e){} place();
      if(dx || dy) try{ window.dispatchEvent(new CustomEvent('thryd:cutmove', {detail: {scene: t.from, cut: t.label, cut_index: null, klass: t.klass || null, visitor_in: layer._mid,
        source_frame_index: 0, frame_count: 1, from: {x: +((d.b.left - sb.left + d.b.width / 2) / SW * 100).toFixed(3), y: +((d.b.top - sb.top + d.b.height / 2) / SH * 100).toFixed(3)},
        to: {x: +((d.b.left - sb.left + d.b.width / 2 + dx) / SW * 100).toFixed(3), y: +((d.b.top - sb.top + d.b.height / 2 + dy) / SH * 100).toFixed(3)}, place_key: null}})); }catch(e){}
      d = null; };
    im.addEventListener('pointerup', end); im.addEventListener('pointercancel', end);
  }
  function cutLife(layer, my, set){
    if(LIFE_OFF()) return;
    const title = (root.thrydSceneTitle && root.thrydSceneTitle(set && set.medium_image_id)) || (set && (set.title || set.label)) || null;
    const alive = ()=> layer.isConnected && layer._token === my && document.getElementById('mcut') === layer;
    const tick = ()=>{ if(!alive()) return; if(!lifePaused() && !layer._drag) wander(layer); setTimeout(tick, 5000 + Math.random() * 9000); };
    setTimeout(tick, 2500 + Math.random() * 5000);
    // trips fit normal scene lengths (Jesuye 11-12 7:02 PM): a waiting traveller walks in 1.5-4 s after the scene starts,
    // and in most scenes one small cut leaves 3-8 s in, so it can turn up in the next scene or two
    if(travelPool().some(t => t.from !== layer._mid)) setTimeout(()=>{ if(alive()) visit(layer); }, 1500 + Math.random() * 2500);
    if(Math.random() < 0.7) setTimeout(function off(){ if(!alive()) return; if(lifePaused() || layer._drag){ setTimeout(off, 1500); return; } driftOff(layer, title); }, 3000 + Math.random() * 5000);
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
      if(manifest && manifest.assets){
        const need=manifest.assets.find(a=>a && a.medium_image_id===set.medium_image_id);
        if(need) await expandRow(need);
      }
      const plan = forSet(set, manifest);
      if(!plan.ok || my !== token) return plan;
      const hold = frameHoldBytes(plan.width, plan.height, plan.frameCount);
      if(hold > 16 * 1024 * 1024) plan.stream = true;
      const srcRow = ((manifest && manifest.assets) || []).find(a => a && a.medium_image_id === set.medium_image_id) || {};
      const sha = srcRow.source_sha256 || '';
      const ver = srcRow.pack_version || '1';
      const keep = root.ThrydKeep;
      const fetchFn = opts.fetch || function(url, init){
        if(keep && sha && keep.mayCache(url)) return keep.fetchCached(url, init, 'gif:' + sha + ':' + ver);
        return fetch(url, init);
      };
      return fetchFn(set.url, {cache:'force-cache'}).then(r=>{
        if(!r.ok) throw new Error('fetch');
        return r.arrayBuffer();
      }).then(buf=>{
        if(my !== token) return {ok:false, reason:'stale'};
        const bytes = new Uint8Array(buf);
        if(plan.kind === 'gif' && plan.stream){
          const fb = fillBuilder(plan.width, plan.height, plan.plate, plan.plateKnown);
          const walked = decodeGif(bytes, {only: plan.frameCount - 1, visit:(f, canvas)=>{
            if(f < plan.frameCount) fb.add(f, canvas, plan.objects.map(o=>o.masks[f]));
          }});
          if(!delaysMatch(walked, plan.delays_cs)) return {plan, mismatch:true};
          const fill = fb.done(); plan.plate = fill.rgba; plan.plateKnown = fill.known;
          return {plan, bytes, stream:true};
        }
        if(plan.kind === 'gif'){
          const decoded = decodeGif(bytes);
          if(delaysMatch(decoded, plan.delays_cs) && decoded.width === plan.width && decoded.height === plan.height){
            const fill = framesFill(plan, decoded.frames.map(fr=>fr.rgba)); plan.plate = fill.rgba; plan.plateKnown = fill.known;
          }
          return {decoded, plan};
        }
        if(plan.kind === 'still'){
          // One exact packed frame: if the source is a GIF, pick still_frame; otherwise decode the still.
          try{
            const g = decodeGif(bytes);
            if(g && g.frames && g.frames.length && g.width === plan.width && g.height === plan.height){
              const fi = Math.max(0, Math.min(g.frames.length - 1, plan.still_frame|0));
              const fr = g.frames[fi];
              if(fr && fr.rgba){
                const decoded = {rgba:fr.rgba, width:g.width, height:g.height};
                const fill = framesFill(Object.assign({}, plan, {kind:'still', frameCount:1}), [decoded.rgba]);
                plan.plate = fill.rgba; plan.plateKnown = fill.known;
                return {decoded, plan};
              }
            }
          }catch(e){}
        }
        if(opts.stillRgba) return {decoded:{rgba:opts.stillRgba, width:plan.width, height:plan.height}, plan};
        return stillRgba(bytes, plan.width, plan.height).then(rgba=>({decoded:{rgba, width:plan.width, height:plan.height}, plan}));
      }).then(got=>{
        if(!got || my !== token) return got || {ok:false, reason:'stale'};
        if(got.mismatch) return reject('delay_mismatch');
        const playback = got.stream ? {ok:true, width:got.plan.width, height:got.plan.height, frames: got.plan.delays_cs.map(d=>({playMs:playMs(d)})), stream:true, bytes:got.bytes, plan:got.plan} : planFrames(got.decoded, got.plan);
        if(!playback.ok || typeof document === 'undefined' || !stage) return playback;
        const layer = document.createElement('div');
        layer.id = 'mcut'; layer._mid = set.medium_image_id; layer._w = playback.width; layer._h = playback.height; layer._token = my;
        layer._playback = playback;
        layer._box = coverBox(stage, playback.width, playback.height);
        const nsprite = playback.stream ? playback.plan.objects.length : playback.frames[0].sprites.length;
        const labels = (playback.stream ? playback.plan.objects : (plan.objects || [])).map(o => o && o.label);
        const keep = root.ThrydKeep;
        layer._placeKey = [];
        layer._off = [];
        layer._labels = labels; layer._klass = (playback.stream ? playback.plan.objects : (plan.objects || [])).map(o => o && (o.model_class || o.label));
        for(let i = 0; i < nsprite; i++){
          const k = keep ? keep.placeKey(sha, labels[i] || ('cut' + (i + 1)), ver) : '';
          layer._placeKey.push(k);
          layer._off.push((keep && k && keep.loadPlace(k)) || {x:0, y:0});
        }
        const plate = document.createElement('canvas');
        plate.className = 'plate'; plate.width = playback.width; plate.height = playback.height;
        Object.assign(plate.style, {width:layer._box.width + 'px', height:layer._box.height + 'px', left:layer._box.left + 'px', top:layer._box.top + 'px'});
        layer.appendChild(plate);
        let shown = 0;
        const step = ()=>{
          if(my !== token) return;
          if(layer._drag || layer._dragPaused){ layer._timer = setTimeout(step, 120); return; }
          layer._shown = shown;
          let frame = playback.frames[shown];
          if(playback.stream){
            // Walk forward from the previous frame. Re-decoding 0..N on every
            // tick was O(n^2) and allocated a full canvas each time — that
            // crashed the tab after a handful of large streamed GIFs.
            if(!playback.decoder) playback.decoder = createGifDecoder(playback.bytes);
            if(playback.decoder.seen > shown) playback.decoder.reset();
            const one = playback.decoder.until(shown);
            const rgba = one && one.rgba;
            if(!rgba) return;
            const masks = playback.plan.objects.map(obj=>obj.masks[shown]);
            const plateSrc = playback.plan.plate ? {rgba:playback.plan.plate, known:playback.plan.plateKnown} : null;
            const drawn = compose(rgba, playback.width, playback.height, masks, plateSrc);
            frame = {plate: drawn.plate, sprites: drawn.sprites, playMs: playback.frames[shown].playMs, src: rgba, masks, plateSrc};
          }
          layer._frame = frame;
          paintFrame(layer, frame);
          const wait = playback.frames[shown].playMs;
          shown = (shown + 1) % playback.frames.length;
          layer._timer = setTimeout(step, wait);
        };
        layer.addEventListener('pointerdown', ev=>{
          const node = ev.target.closest && ev.target.closest('canvas.sprite');
          if(!node) return;
          const i = +node.dataset.i;
          if(layer._gone && layer._gone[i]) return;
          foldWander(layer, i, node);
          if(layer._timer){ clearTimeout(layer._timer); layer._timer = null; }
          layer._dragPaused = true;
          layer._drag = {i, sx:ev.clientX, sy:ev.clientY, ox:layer._off[i].x, oy:layer._off[i].y, node, dx:0, dy:0, raf:0};
          layer.classList.add('dragging');
          try{ document.body.classList.add('dragmode'); }catch(e){}
          node.dataset.dragging = '1';
          node.style.willChange = 'transform';
          ev.preventDefault();
          try{ node.setPointerCapture(ev.pointerId); }catch(e){}
        });
        layer.addEventListener('pointermove', ev=>{
          const d = layer._drag; if(!d) return;
          d.dx = ev.clientX - d.sx; d.dy = ev.clientY - d.sy;
          if(d.raf) return;
          d.raf = requestAnimationFrame(()=>{
            d.raf = 0;
            if(layer._drag !== d) return;
            d.node.style.transform = 'translate(' + d.dx + 'px,' + d.dy + 'px)';
          });
        });
        const endDrag = ()=>{
          const d = layer._drag;
          if(!d) return;
          if(d.raf) cancelAnimationFrame(d.raf);
          layer._drag = null;
          layer._off[d.i] = {x:d.ox + (d.dx||0), y:d.oy + (d.dy||0)};
          if(d.node){ d.node.style.transform = ''; d.node.style.willChange = ''; delete d.node.dataset.dragging; }
          layer.classList.remove('dragging');
          try{ document.body.classList.remove('dragmode'); }catch(e){}
          if(layer._frame) paintFrame(layer, layer._frame);
          if(root.ThrydKeep){
            const k = layer._placeKey && layer._placeKey[d.i];
            if(k) root.ThrydKeep.savePlace(k, layer._off[d.i]);
          }
          // movement link (Jesuye 11-12 2:33 PM): announce the committed drop with the exact cut identity; projector.js records it
          try{
            const W = layer._w, H = layer._h, bx = layer._box || {}, bw = bx.width || W, bh = bx.height || H;
            const sp = layer._frame && layer._frame.masks && layer._frame.masks[d.i];
            const cx = sp && typeof sp.x === 'number' ? sp.x + sp.w / 2 : W / 2, cy = sp && typeof sp.y === 'number' ? sp.y + sp.h / 2 : H / 2;
            const P = (ox, oy) => ({x: +((cx + ox * W / bw) / W * 100).toFixed(3), y: +((cy + oy * H / bh) / H * 100).toFixed(3)});
            if((d.dx || d.dy) && typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('thryd:cutmove', {detail: {
              scene: layer._mid, cut: (layer._labels && layer._labels[d.i]) || ('cut' + (d.i + 1)), cut_index: d.i, klass: (layer._klass && layer._klass[d.i]) || null,
              source_frame_index: layer._shown | 0, frame_count: (playback.frames || []).length, from: P(d.ox, d.oy), to: P(d.ox + (d.dx || 0), d.oy + (d.dy || 0)),
              place_key: (layer._placeKey && layer._placeKey[d.i]) || null}}));
          }catch(e){}
          layer._dragPaused = false;
          if(my === token && !layer._timer) layer._timer = setTimeout(step, 0);
        };
        layer.addEventListener('pointerup', endDrag);
        layer.addEventListener('pointercancel', endDrag);
        // Paint the first frame while #mcut is still off-document, then swap it in
        // and only then hide the GIF. An empty #mcut in the DOM triggers
        // #stage:has(#mcut)>img{opacity:0} and leaves a black stage.
        step();
        const prev = typeof document !== 'undefined' && document.getElementById('mcut');
        if(prev && prev !== layer){
          clearTimeout(prev._timer);
          if(prev._playback){ prev._playback.decoder=null; prev._playback.bytes=null; prev._playback.frames=null; prev._playback=null; }
          prev._frame=null;
          prev.querySelectorAll('canvas').forEach(c=>{ try{ c.width=0; c.height=0; }catch(e){} });
          prev.remove();
        }
        stage.insertBefore(layer, stage.querySelector('#cap') || null);
        try{ cutLife(layer, my, set); }catch(e){}
        if(image){
          requestAnimationFrame(()=>{
            if(document.getElementById('mcut') !== layer) return;
            image.classList.remove('on');
            image.style.transition = 'none';
            image.style.opacity = '0';
            // Once the plate is on stage, replace the animated GIF in <img>
            // with a single still. Chrome otherwise keeps every decoded GIF
            // frame (hundreds of MB) in the hidden slot and the tab OOMs
            // after a handful of switches (Aw, Snap! code 9).
            try{
              const plate = layer.querySelector('canvas.plate');
              if(plate && plate.width>0){
                const url = plate.toDataURL('image/jpeg', 0.72);
                image.src = url;
              }
            }catch(e){}
          });
        }
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

  const life = {wander, driftOff, visit, pool: travelPool};
  const api = {life, CAP, USED, RESERVE, roomBytes, admit, isMedium, coverage, forSet, compose, planFrames, decodeGif, createGifDecoder, delaysMatch, playMs, attach, detach, loadManifest, inkBox, unpackMask, frameHoldBytes, expandObject, expandRow, plateFor, movedFlags, fillBuilder, framesFill, grow, shadowFill, SHADOW_BRIGHT, SHADOW_BLUR};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThrydMediumCuts = api;
})(typeof window !== 'undefined' ? window : globalThis);
