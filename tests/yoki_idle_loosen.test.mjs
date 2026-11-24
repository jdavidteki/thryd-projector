import fs from 'fs'; import vm from 'vm'; import assert from 'assert';
const src = fs.readFileSync('assets/yoki_dj.js','utf8');
function run(ageMin, n=400){
  const now = Date.now(), gen = new Date(now - ageMin*60000).toISOString();
  const songs = Array.from({length:200},(_,i)=>({id:'s'+i,t:'T'+i,a:'A'}));
  const cands = songs.slice(0,60).map((s,i)=>({id:s.id,title:s.t,score:2-i/60,why:'w'}));
  const store = {};
  const ctx = {console, Date, Math, JSON, Promise, Set, Array, Uint32Array, crypto: globalThis.crypto,
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}},
    fetch: async (u)=>({ok:true,json:async()=> u.includes('yoki_songs') ? {songs} : {v:2,job:'j1',generated:gen,agendas:[{activity:gen}],candidates:cands}}),
    document:{createElement:()=>({style:{}}),body:{appendChild(){}}}, setTimeout, clearTimeout};
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src.replace('(function(root){','(function(root){root=root||this;'), ctx);
  return ctx;
}
const counts = async (age)=>{ const c = run(age); const DJ = c.thrydYokiDJ; let shuffle=0, deep=0;
  for(let i=0;i<120;i++){ const r = await DJ.next(); const L = DJ.log[DJ.log.length-1];
    if(L.mode==='shuffle') shuffle++; }
  return {shuffle, idle: DJ.idle}; };
const live = await counts(2), idle = await counts(60);
assert.equal(live.idle, false); assert.equal(idle.idle, true);
assert.ok(idle.shuffle > live.shuffle + 20, JSON.stringify({live, idle}));
console.log('ok', live, idle);
