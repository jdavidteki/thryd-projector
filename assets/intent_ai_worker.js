/* in-browser sentence embeddings for the projector's intent layer (Jesuye 17 Nov 2026, 👍 "in-browser AI on top of intent").
   Module worker: Transformers.js from jsDelivr + Xenova/all-MiniLM-L6-v2 (q8 ONNX, ~23 MB, kept in the browser's Cache Storage after the
   first load). No server, no keys. The page thread only posts strings and receives normalized 384-d vectors. */
const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
const MODEL = 'Xenova/all-MiniLM-L6-v2';
// the plain SIMD wasm build (14 MB) instead of the default asyncify/WebGPU build (27 MB): this layer only needs the CPU backend
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/';
let ext = null, loading = null;
async function load(){
  if(ext) return ext; if(loading) return loading;
  loading = (async ()=>{
    const T = await import(TJS);
    T.env.allowLocalModels = false; T.env.useBrowserCache = true;
    try{ T.env.backends.onnx.wasm.numThreads = 1; }catch(e){}
    try{ T.env.backends.onnx.wasm.wasmPaths = {mjs: ORT + 'ort-wasm-simd-threaded.mjs', wasm: ORT + 'ort-wasm-simd-threaded.wasm'}; }catch(e){} // GitHub Pages is not cross-origin isolated: one thread, no SharedArrayBuffer
    ext = await T.pipeline('feature-extraction', MODEL, {dtype: 'q8', device: 'wasm'});
    return ext; })();
  try{ return await loading; }catch(e){ loading = null; throw e; }
}
self.onmessage = async ev => {
  const m = ev.data || {};
  try{
    if(m.type === 'init'){ const t0 = Date.now(); await load(); self.postMessage({type: 'ready', ms: Date.now() - t0, model: MODEL}); return; }
    if(m.type === 'embed'){ const e = await load(), texts = (m.texts || []).map(t => String(t || '').slice(0, 256));
      if(!texts.length){ self.postMessage({type: 'vecs', id: m.id, dim: 384, buf: new Float32Array(0)}); return; }
      const out = await e(texts, {pooling: 'mean', normalize: true}); const dim = out.dims[out.dims.length - 1];
      const buf = new Float32Array(out.data); self.postMessage({type: 'vecs', id: m.id, dim, buf}, [buf.buffer]); return; }
  }catch(err){ self.postMessage({type: 'error', id: m.id, error: String(err && err.message || err)}); }
};
