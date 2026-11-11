// Offline QA mount. The bytes and the pack are already in memory.
// This does not call fetch, and it does not write the pack.
(function(root){
  function b64ToBytes(s){
    if(typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for(var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function previewPack(pack){
    const row = JSON.parse(JSON.stringify(pack));
    row.status = 'ready';
    row.reviewed = false;
    row.preview_only = true;
    return row;
  }

  function inlineFetch(bytes){
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return function(){
      return Promise.resolve({
        ok: true,
        arrayBuffer: function(){ return Promise.resolve(body); }
      });
    };
  }

  function mount(opts){
    const Cuts = opts.cuts || root.ThrydMediumCuts;
    const pack = opts.pack;
    const row = previewPack(pack);
    const set = {
      how: 'medium',
      remote: true,
      extension: pack.kind === 'gif' ? 'gif' : 'jpeg',
      medium_image_id: pack.medium_image_id,
      url: 'inline://preview'
    };
    return Cuts.attach(set, {
      stage: opts.stage,
      image: opts.image,
      manifest: {assets: [row]},
      fetch: inlineFetch(opts.bytes)
    });
  }

  const api = {b64ToBytes, previewPack, inlineFetch, mount};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThrydMediumPreview = api;
})(typeof window !== 'undefined' ? window : globalThis);
