const LIVE_STATE=async()=>{try{const r=await fetch('https://raw.githubusercontent.com/jdavidteki/thryd-projector/main/data/state.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;return await r.json();}catch(e){return LIVE_STATE();}};
// #thryd projector: live (data/state.json) · timeline loop (data/timeline.json) · replay (data/replays.json + replay_<run>.json)
(()=>{
const Q=new URLSearchParams(location.search);
const SPEED=Math.max(1,parseFloat(Q.get('speed')||'8'))*1000, POLL=10000;
let MODE=(Q.get('mode')||'live').toLowerCase()==='replay'?'replay':'live';
const BAD=/sex|nasty|dirt|iud|adult|daddy|position|hookup|benefit|porn|nude|naked|horny|kiss|\bbed|breast|moan|lick|bang|thrust|sessy|\bhard\b|body|\bwet\b|strip|fuck|pussy|dick|cock|\bass\b|boob|bitch|nyash|prick|suck|condom|virgin|orgasm|<real/i;
const ok=s=>!!s&&!BAD.test(s);
const $=id=>document.getElementById(id);
const J=async u=>{const r=await fetch(u+(u.includes('?')?'&':'?')+'_='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(r.status);return r.json();};
let media={backdrops:{},sprites:{}}, runMedia={}, timers=[], gen=0;
const short=p=>(p||'elsewhere').replace(/,? (in )?Miami(, Florida)?/g,'').replace(/^(the|a) /i,'').replace(/ outside the apartment.*$/,'').replace(/^apartment Marisol and Calla share in /,'').slice(0,34);
// ---------- stage: current scene GIF, large & centered, crossfaded
let bgSet=null,bgI=0,bgFlip=0,bgTimer=null,stageN=0; window.THRYD_UG=window.THRYD_UG||[];
function showUser(u){clearInterval(bgTimer);bgSet={dir:'user:'+u.id};const w=$('ug');w.innerHTML='';w.appendChild(u.vis);
  w.classList.add('on');objsFor(null);$('bgA').classList.remove('on');$('bgB').classList.remove('on');$('cap').textContent=u.label;}
function backdrop(set,force){ stageN++;
  const ug=window.THRYD_UG; if(ug.length&&stageN%3===0){return showUser(ug[Math.floor(stageN/3)%ug.length]);}
  if(!set||(!force&&bgSet&&bgSet.dir===set.dir))return; bgSet=set;bgI=0; $('ug').classList.remove('on');
  clearInterval(bgTimer); const imgs=[$('bgA'),$('bgB')];
  for(let i=0;i<set.frames;i++){const im=new Image();im.src=`${set.dir}/f${String(i).padStart(3,'0')}.webp`;}
  bgFlip^=1; const on=imgs[bgFlip],off=imgs[bgFlip^1];
  const tick=()=>{on.src=`${set.dir}/f${String(bgI%set.frames).padStart(3,'0')}.webp`;bgI++;};
  tick(); on.classList.add('on'); off.classList.remove('on'); $('cap').textContent=set.label||''; objsFor(set);
  bgTimer=setInterval(tick,Math.max(80,set.ms||120));
}
let POOL=[],poolI=0,LXTRA=[];
// slide speed: 8s default, 30s, 60s (?slide=30 or the bar select; remembered)
let SLIDE=+(Q.get('slide')||localStorage.getItem('thryd_slide')||8); if(![8,30,60].includes(SLIDE))SLIDE=8; let slideT=null;
const NEWEST=()=>LXTRA.length?LXTRA.slice().sort((a,b)=>(b.mtime||0)-(a.mtime||0))[0]:null; let slideN=0;
// newest live view comes back every 3rd slide; others cycle in between
function startSlide(){clearInterval(slideT);slideT=setInterval(()=>{if(POOL.length>1){slideN++;const nw=MODE==='live'&&NEWEST();if(nw&&slideN%3===0&&bgSet&&bgSet.dir!==nw.dir){backdrop(nw,true);return;}poolI=(poolI+1)%POOL.length;if(nw&&POOL[poolI]===nw&&POOL.length>2)poolI=(poolI+1)%POOL.length;backdrop(POOL[poolI],true);}},SLIDE*1000);}
startSlide();
// ---------- in-place object sprites (data/objects_map.json): patch at bbox, sprite on top, gentle motion
let OMAP={}, objLayer=null, objKey=null, objState={};
const mapKey=p=>{const r=(p||'').match(/(run-[\w]+)/), j=(p||'').match(/\b(j\d+)(?:_blur)?\.(?:gif|jpe?g|webp)$|\/(j\d+)\/?$/);return r&&j?r[1]+'/'+(j[1]||j[2]):null;};
// lookup order: run+jN, run+gN, replays.json gifs[] (gN -> Nth source gif), card wN -> jN, GIF basename
let RGIFS={}; const runOf=p=>{const r=(p||'').match(/(run-[\w-]+?)(?=\/|$)/);return r?r[1]:null;};
const baseOf=p=>{const b=(p||'').split('/').pop().replace(/\.(gif|webp|jpe?g|png)$/i,'').replace(/_(blur|view)$/,'');return b;};
let OBASE={}; function addOmap(om){OMAP={};OBASE={};Object.entries(om||{}).forEach(([k,v])=>{const mk=mapKey(k);if(mk)OMAP[mk]=v;OMAP[k]=v;
  const r=runOf(k),b=baseOf(k);if(r&&b)OMAP[r+'/'+b]=OMAP[r+'/'+b]||v;if(b)(OBASE[b]=OBASE[b]||[]).push(v);
  if(v&&v.run&&(v.jN||v.j))OMAP[v.run+'/'+(v.jN||v.j)]=OMAP[v.run+'/'+(v.jN||v.j)]||v; if(v&&v.replays_path){OMAP[v.replays_path]=v;const m2=mapKey(v.replays_path);if(m2)OMAP[m2]=OMAP[m2]||v;}});}
function lookup(set){const p=set&&(set.gif||set.src||set.dir)||''; const tries=[];
  let k=mapKey(p); if(k)tries.push(k);
  const run=runOf(p)||($('run').textContent||'').trim(); const j=p.match(/(?:^|\/)(j\d+)(?:\/|$|_|\.)/), g=p.match(/(?:^|\/)(g(\d+))\/?$/);
  if(run&&j)tries.push(run+'/'+j[1]);
  if(run&&g){tries.push(run+'/'+g[1]); const src=(RGIFS[run]||[])[+g[2]]; if(src){tries.push(src);const mk=mapKey(src);if(mk)tries.push(mk);tries.push(run+'/'+baseOf(src));}}
  if(run&&set&&/^w\d+$/.test(set.card||''))tries.push(run+'/j'+set.card.slice(1));
  if(p.includes('assets/webp/')&&!runOf(p)){const jj=p.match(/(j\d+)/);if(jj)tries.push('run-5a58c4/'+jj[1]);} // live backdrops are run-5a58c4 views
  for(const t of tries)if(OMAP[t])return [t,OMAP[t]];
  const b=baseOf(p); if(b&&!/^(g\d+|f\d+)$/.test(b)&&OBASE[b]&&OBASE[b].length===1)return ['base:'+b,OBASE[b][0]];
  return [tries[0]||null,null];}
function setKey(set){return lookup(set)[0];}
async function loadOmap(){try{const om=await J('data/objects_map.json');const before=JSON.stringify(Object.keys(OMAP));addOmap(om);
  if(JSON.stringify(Object.keys(OMAP))!==before&&bgSet){objKey=null;objsFor(bgSet);}}catch(e){}}
async function loadRGifs(){try{(await J('data/replays.json')).runs.forEach(r=>RGIFS[r.run]=r.gifs||[]);}catch(e){}}
function fitLayer(){if(!objLayer||!objLayer._fs)return;const st=$('stage'),W=st.clientWidth,H=st.clientHeight,[fw,fh]=objLayer._fs,sc=Math.min(W/fw,H/fh);
  Object.assign(objLayer.style,{width:fw*sc+'px',height:fh*sc+'px',left:(W-fw*sc)/2+'px',top:(H-fh*sc)/2+'px'});}
function objsFor(set){const [k,e0]=set?lookup(set):[null,null]; if(k===objKey&&objLayer)return; objKey=k;
  if(objLayer){const old=objLayer;old.classList.remove('on');setTimeout(()=>old.remove(),2600);objLayer=null;}
  const e=e0; if(!e)return;
  const L=document.createElement('div');L.id='objs';L._fs=e.frame_size||[480,270];L.dataset.key=k;
  (e.objects||[]).forEach((o,i)=>{const[x,y,w,h]=o.bbox;const box=document.createElement('div');
    box.className='ob'+(o.sprite?'':' anchor');Object.assign(box.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});
    box.dataset.sid=o.state_id||'';box.dataset.label=o.label;
    if(o.sprite){ if(o.patch){const pa=new Image();pa.className='patch';pa.alt='';pa.src=o.patch;box.appendChild(pa);}
      const sp=new Image();sp.className='sp m-'+(/sandal|shoe|slipper/i.test(o.label)?'hop':(o.motion||'sway'));sp.alt=o.label;sp.src=o.sprite;sp.style.animationDelay=(-i*1.7)+'s';
      if(/door|street|window/i.test(o.label))sp.classList.add('small');
      const wr=document.createElement('div');wr.className='spw';wr.appendChild(sp);box.appendChild(wr);}
    else{const t=document.createElement('span');t.className='olab';t.textContent=o.label;box.appendChild(t);}
    L.appendChild(box);});
  $('stage').insertBefore(L,$('cap')); objLayer=L; fitLayer(); requestAnimationFrame(()=>L.classList.add('on'));}
addEventListener('resize',fitLayer);
// agenda state changed an object -> its sprite glides a bit and pulses
function objChanged(id){if(!objLayer||!id)return;objLayer.querySelectorAll('.ob').forEach(b=>{if(b.dataset.sid===id||b.dataset.label===id){
  const w=b.querySelector('.spw')||b;w.classList.remove('moved');void w.offsetWidth;w.style.setProperty('--gx',((Math.random()-.5)*6).toFixed(1)+'px');w.style.setProperty('--gy',((Math.random()-.5)*4).toFixed(1)+'px');w.classList.add('moved');}});}
function trackObjs(st){(st.objects||[]).forEach(o=>{const v=JSON.stringify([o.place,o.holder||o.held_by||null,o.state||o.status||null]);
  if(objState[o.label]!==undefined&&objState[o.label]!==v)objChanged(o.label);objState[o.label]=v;});
  (st.characters||[]).forEach(c=>{const id=c.id||c.name,v=JSON.stringify([c.place]);if(objState['c:'+id]!==undefined&&objState['c:'+id]!==v)objChanged(id);objState['c:'+id]=v;});}
window.thrydObjChanged=objChanged;
setInterval(()=>{if(!objLayer)return;const bs=[...objLayer.querySelectorAll('.ob')];if(bs.length){const b=bs[Math.floor(Math.random()*bs.length)];objChanged(b.dataset.sid||b.dataset.label);}},3000);
// LXTRA (data/live_extra.json): original unblurred live views, play as-is
// live loop = clean stills only (no baked terminal panel); replay-mode GIF frames stay out of it
function livePool(){return Object.values(media.backdrops).concat(LXTRA);}
function liveBackdrop(place){const p=(place||'').toLowerCase();const b=media.backdrops;
  const k=Q.get('scene')||(/marina|boat|bay|causeway|church|wheelhouse|deck/.test(p)?'j6':'j12');return b[k]&&Object.assign({label:short(place)},b[k]);}
// ---------- gutters: chips grouped by place, left & right of the stage, never over it
const ents={}; let lastM=null, prevReg={}, order={}, regionsKey='';
function ent(id,kind,label,sprite){
  let e=ents[id]; if(!e){e=document.createElement('div');e.className='chip '+kind;
    e.innerHTML=(sprite?`<img alt="" draggable="false" src="${sprite}">`:'<i class="dot"></i>')+'<span class="lab"></span><span class="note"></span>';
    e.querySelector('.lab').textContent=label; e.title=label; e.style.opacity=0;
    e.onclick=ev=>{ev.stopPropagation();Object.values(ents).forEach(x=>x!==e&&x.classList.remove('sel'));e.classList.toggle('sel');};
    $('ents').appendChild(e); ents[id]=e; requestAnimationFrame(()=>e.style.opacity='');}
  return e;}
function hdr(name){let h=$('map').querySelector(`[data-name="${CSS.escape(name)}"]`);
  if(!h){h=document.createElement('div');h.className='ph';h.dataset.name=name;h.textContent=name;h.title=name;$('map').appendChild(h);}return h;}
// model: {regions[],here,chars[{name,region,off,note}],objs[{label,region,holder}]}
function render(m){ lastM=m; place(m); }
function place(m){
  const groups={}; const charReg={}; m.chars.forEach(c=>charReg[c.name]=c.region);
  const add=(g,it)=>(groups[g]=groups[g]||[]).push(it);
  m.chars.forEach(c=>add(c.region,{id:'c:'+c.name,kind:'char',label:c.name,sp:media.sprites[c.name],c}));
  m.objs.forEach(o=>add((o.holder&&charReg[o.holder])||o.region,{id:'o:'+o.label,kind:'obj',label:o.label,sp:media.sprites[o.label],o}));
  // held items sit right after their holder
  Object.values(groups).forEach(l=>{l.sort((a,b)=>(order[a.id]??0)-(order[b.id]??0));
    l.filter(it=>it.o&&it.o.holder).forEach(it=>{const i=l.indexOf(it),h=l.findIndex(x=>x.label===it.o.holder);if(h>=0){l.splice(i,1);l.splice(l.findIndex(x=>x.label===it.o.holder)+1,0,it);}});});
  const names=[m.here,...m.regions.filter(r=>r!==m.here)].filter(n=>groups[n]);
  const side=[[],[]],cnt=[0,0]; names.forEach(n=>{const k=cnt[0]<=cnt[1]?0:1;side[k].push(n);cnt[k]+=groups[n].length+1.3;});
  const vh=innerHeight/100,vw=innerWidth/100, top=7*vh, bot=86*vh, seen=new Set(), hs=new Set();
  side.forEach((ns,k)=>{ const units=cnt[k]||1, u=Math.min(5.4*vh,(bot-top)/units), sc=u/(5.4*vh); let y=top;
    const x=k?88*vw:1*vw, w=11*vw;
    ns.forEach(n=>{const h=hdr(n);hs.add(n);Object.assign(h.style,{left:x+'px',top:y+'px',width:w+'px',fontSize:Math.max(1.2,1.6*sc)+'vh'});h.classList.toggle('here',n===m.here);h.classList.toggle('r',!!k);y+=1.3*u;
      groups[n].forEach(it=>{const e=ent(it.id,it.kind,it.label,it.sp);seen.add(it.id);e.dataset.id=it.id;e.dataset.reg=n;
        const held=it.o&&it.o.holder; e.classList.toggle('held',!!held);e.classList.toggle('r',!!k);
        Object.assign(e.style,{left:(x+(held?(k?0:1.2*vw):0))+'px',top:y+'px',width:(w-(held?1.2*vw:0))+'px',height:(u*.86)+'px',fontSize:(1.75*sc)+'vh'});
        const r=it.c?it.c.region:(held?'held':it.o.region); if(prevReg[it.id]!==undefined&&prevReg[it.id]!==r)pulse(it.label); prevReg[it.id]=r;
        if(it.c){e.classList.toggle('off',!!it.c.off);e.querySelector('.note').textContent=it.c.note||'';}
        else{e.querySelector('.note').textContent=held?'held by '+held:'';e.classList.toggle('off',it.o.region!==m.here&&!held);}
        y+=u;});
      y+=.3*u;});});
  [...$('map').children].forEach(h=>{if(!hs.has(h.dataset.name))h.remove();});
  Object.keys(ents).forEach(k=>{if(!seen.has(k)){ents[k].remove();delete ents[k];}});
}
// something moves every 4-6s: swap two chips inside a group, pulse one
(function drift(){setTimeout(()=>{try{if(lastM){const ids=Object.keys(ents);if(ids.length>1){
  const a=ids[Math.floor(Math.random()*ids.length)],b=ids[Math.floor(Math.random()*ids.length)];
  order[a]=Math.random()*10;order[b]=Math.random()*10; place(lastM); Object.values(ents).forEach(x=>x.style.setProperty('--j',((Math.random()-.5)*1.2).toFixed(2)+'vw')); const e=ents[a]; if(e)pulse(e.title);}}}catch(e){} drift();},4000+Math.random()*2000);})();
function ticker(world,upd,meta){$('world').textContent=world||'';const u=$('upd');u.style.opacity=0;
  setTimeout(()=>{u.textContent=upd||'';u.style.opacity=1;},400);$('meta').textContent=meta||'';}
function pulse(name){const e=ents['o:'+name]||ents['c:'+name];if(e){e.classList.remove('pulse');void e.offsetWidth;e.classList.add('pulse');}}
let sinceBubble=0, nextBubble=4; window.CUR={lines:[],speakers:[]};
function maybeBubble(lines,speakers){ CUR.lines=lines; CUR.speakers=speakers; sinceBubble++; if(sinceBubble<nextBubble)return; sinceBubble=0; nextBubble=3+Math.floor(Math.random()*3);
  const L=choose(lines); if(!L||!speakers.length)return; say(L,speakers[Math.floor(Math.random()*speakers.length)]);
}
function choose(lines){const pool=lines.filter(l=>ok(l.line)); if(!pool.length)return null;
  const mv=pool.filter(l=>l.move); const src=(mv.length&&Math.random()<.7)?mv:pool; return src[Math.floor(Math.random()*src.length)];}
function say(L,who){ const e=ents['c:'+who]; if(!e)return;
  const r=e.getBoundingClientRect(), b=$('bubble'), right=e.classList.contains('r');
  b.querySelector('.who').textContent=who+(L.src?' · '+L.src:''); b.querySelector('.txt').textContent=L.line;
  b.classList.toggle('r',right); b.style.left=(right?r.left-innerWidth*.006:r.right+innerWidth*.006)+'px';
  b.style.top=Math.min(innerHeight*.8,Math.max(innerHeight*.08,r.top+r.height/2))+'px';
  b.classList.add('on'); setTimeout(()=>b.classList.remove('on'),Math.min(Math.max(SLIDE*900,4000),7000));
}
const everyS=f=>{const g=gen;const run=()=>{const t=setTimeout(()=>{if(g!==gen)return;f();run();},SLIDE*1000);timers.push(t);};run();};
const every=(f,ms)=>{const g=gen;const t=setInterval(()=>{if(g===gen)f();},ms);timers.push(t);};
function reset(){gen++;timers.forEach(t=>{clearInterval(t);clearTimeout(t);});timers=[];Object.keys(ents).forEach(k=>{ents[k].remove();delete ents[k];});regionsKey='';$('bubble').classList.remove('on');}
// ---------- LIVE from state.json
let localPrec=[];
const PFULL={}, PEND={};  // short heading -> full place; pending drags {id:{region,until}}
function fromState(s){
  const names=[],add=p=>{const n=short(p);PFULL[n]=PFULL[n]||p;if(!names.includes(n))names.push(n);return n;};
  (s.locations||[]).forEach(p=>{const n=short(p);PFULL[n]=PFULL[n]||p;});
  const pend=(id,r)=>{const q=PEND[id];if(!q)return r;if(q.region===r||Date.now()>q.until){delete PEND[id];return r;}if(!names.includes(q.region))names.push(q.region);return q.region;};
  const here=add(s.current_place);
  const chars=(s.characters||[]).map(c=>({name:c.name,region:pend('c:'+c.name,add(c.place)),note:c.note||'',off:short(c.place)!==here}));
  const objs=(s.objects||[]).map(o=>({label:o.label,region:pend('o:'+o.label,add(o.place)),holder:o.holder||o.held_by||null}));
  return {regions:names,here,chars,objs};
}
async function live(){
  reset(); const g=gen; $('mode').textContent='live';
  let s=null; try{s=await LIVE_STATE();}catch(e){}
  if(!s||!(s.characters||[]).length){return loopTimeline();}
  let last='', step=0, cur=s;
  let first=true; const apply=st=>{const m=fromState(st);render(m);cur=st;trackObjs(st);
    POOL=livePool(); if(first){first=false;const nw=NEWEST();if(nw){poolI=Math.max(0,POOL.indexOf(nw));backdrop(nw,true);}else backdrop(liveBackdrop(st.current_place));}
    $('run').textContent=st.run||'';};
  apply(s);
  const lines=()=>[...(cur.moves||[]).flatMap(m=>(m.precisions||[]).map(p=>({line:p.line,src:'seat '+p.seat,move:/\[\[/.test(p.line)}))),...localPrec];
  const upd=()=>{const mv=(cur.moves||[]).slice(-10), re=(cur.recent_events||[]).slice(-6);
    const items=[...mv.map(m=>m.move),...re.map(e=>`${e.card||''} ${e.ev}${e.status?' · '+e.status:''}`)];
    const it=(items.length?String(items[step++%items.length]):'waiting').replace(/ ?\(undefined\)/g,'');
    ticker(cur.story_time_label,ok(it)?it:'move (cut away)',`${cur.current_card} · ${cur.seats||''} · state ${String(cur.exported_at||'').slice(11,16)} ET`);
    const m=fromState(cur); maybeBubble(lines(),m.chars.filter(c=>!c.off).map(c=>c.name).concat(m.chars.length?[]:[]).slice(0,4).length?m.chars.filter(c=>!c.off).map(c=>c.name):m.chars.map(c=>c.name));};
  upd(); everyS(upd);
  every(async()=>{try{const n=await LIVE_STATE();if(g!==gen)return;const k=JSON.stringify([n.current_place,n.characters,n.objects,n.current_card,n.seated_count]);
      if(n.characters&&n.characters.length){if(k!==last&&last){(n.objects||[]).forEach(o=>pulse(o.label));} last=k; apply(n);}}catch(e){}},POLL);
}
// ---------- fallback: loop data/timeline.json
async function loopTimeline(){
  const g=gen; let T; try{T=await J('data/timeline.json');}catch(e){ticker('','no state.json or timeline.json yet','');return;}
  $('mode').textContent='live · timeline loop'; $('run').textContent=T.run;
  const ev=T.events, names=[...new Set(ev.map(e=>short(e.place)))];
  let i=0, chars={}, objs={};
  const step=()=>{ if(g!==gen)return; const e=ev[i%ev.length]; if(i%ev.length===0){chars={};objs={};}
    const here=short(e.place);
    if(e.kind==='scene'){(e.cast||[]).forEach(n=>chars[n]=here);}
    if(e.object){objs[e.object]=here;}
    render({regions:names,here,chars:Object.entries(chars).map(([n,r])=>({name:n,region:r,off:r!==here})),objs:Object.entries(objs).map(([l,r])=>({label:l,region:r}))});
    if(e.object)pulse(e.object);
    backdrop(liveBackdrop(e.place)); POOL=livePool();
    ticker(e.world,e.label,`${e.scene} · update ${i%ev.length+1}/${ev.length}`);
    const sp=Object.entries(chars).filter(([n,r])=>r===here).map(([n])=>n);
    maybeBubble(localPrec,sp.length?sp:Object.keys(chars)); i++; };
  step(); everyS(step);
}
// ---------- REPLAY
async function replay(){
  reset(); const g=gen; $('mode').textContent='replay';
  const pick=$('pick'); pick.style.display='';
  let R; try{R=await J('data/replays.json');}catch(e){R=null;}
  const runs=(R&&R.runs||[]).filter(r=>!r.live);
  if(!runs.length){ticker('','no replays yet','');return;}
  if(!pick.options.length) runs.forEach(r=>{const o=document.createElement('option');o.value=r.run;o.textContent=`${r.date||''} · ${r.run} (${r.frames||0})`;pick.appendChild(o);});
  const want=Q.get('run')&&runs.find(r=>r.run===Q.get('run'))?Q.get('run'):(pick.value||runs[runs.length-1].run); pick.value=want;
  const meta=runs.find(r=>r.run===want); let D;
  try{D=await J(meta.replay||`data/replay_${want}.json`);}catch(e){ticker('',`replay for ${want} not built yet`,'');return;}
  if(g!==gen)return;
  $('run').textContent=want;
  const fr=(D.frames||[]).filter(f=>f.card||f.kind==='seat'); if(!fr.length){ticker('','this agenda has no frames','');return;}
  const prec=(D.seated||[]).map(s=>({line:s.line,src:'seat '+s.seat,move:/\[\[/.test(s.line)}));
  const cards=[...new Set(fr.map(f=>f.card).filter(c=>c&&/^w\d+$/.test(c)))]; const regions=(cards.length?cards:['agenda']).map(c=>'card '+c);
  const rm=(runMedia[want]||[]); let i=0, cast=D.cast||[];
  const step=()=>{ if(g!==gen)return; const f=fr[i%fr.length]; if(f.cast&&f.cast.length)cast=f.cast;
    const here=f.card&&/^w\d+$/.test(f.card)?'card '+f.card:regions[0];
    render({regions,here,chars:(cast.length?cast:[]).slice(0,6).map(n=>({name:n,region:here})),objs:[]});
    if(rm.length){const mi=rm.find(x=>x.card===f.card)||rm[Math.floor(cards.indexOf(f.card)*rm.length/Math.max(1,cards.length))]||rm[0];backdrop(Object.assign({label:`${want} · ${mi.card||''}`},mi));POOL=rm;} 
    const ls=f.latest_seat; const lab=f.kind==='seat'&&ls?`seat ${ls.seat} seated on ${ls.card}`:`${f.card||''} ${f.event||''}${f.status?' · '+f.status:''}`;
    ticker(String(f.t||'').replace('T',' ').slice(0,16)+' ET',lab,`${want} · update ${i%fr.length+1}/${fr.length} · ${f.seated_count||0} seated`);
    maybeBubble(prec,cast.slice(0,6)); i++; };
  step(); everyS(step);
}
window.thrydSay=say; window.thrydChoose=choose;
// ---------- UI
function setMode(m){MODE=m;Q.set('mode',m);history.replaceState(null,'','?'+Q.toString());
  document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('pick').style.display=m==='replay'?'':'none'; bgSet=null; (m==='replay'?replay:live)();}
document.querySelectorAll('#modes button').forEach(b=>b.onclick=ev=>{ev.stopPropagation();setMode(b.dataset.m);});
$('pick').onclick=e=>e.stopPropagation();
$('pick').onchange=e=>{Q.set('run',e.target.value);history.replaceState(null,'','?'+Q.toString());reset();replay();};
const fs=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();};
document.addEventListener('click',fs); document.addEventListener('keydown',e=>{if(e.key==='f'||e.key==='F')fs();});
let idleT;const wake=()=>{document.body.classList.remove('idle');clearTimeout(idleT);idleT=setTimeout(()=>document.body.classList.add('idle'),3000);};addEventListener('mousemove',wake);addEventListener('keydown',wake);wake();
addEventListener('resize',()=>{regionsKey='';});
(async()=>{
  try{media=await J('data/media.json');}catch(e){}
  try{LXTRA=(await J('data/live_extra.json')).sets||[];}catch(e){}
  await loadOmap(); await loadRGifs(); setTimeout(()=>{if(MODE==='live'&&LXTRA.length){const nw=LXTRA.slice().sort((a,b)=>(b.mtime||0)-(a.mtime||0))[0];POOL=livePool();poolI=Math.max(0,POOL.indexOf(nw));backdrop(nw,true);}},2500); setInterval(async()=>{if(MODE==='live'){loadOmap();loadRGifs();try{const n=(await J('data/live_extra.json?t='+Date.now())).sets||[];const o=NEWEST();LXTRA=n;const nw=NEWEST();POOL=livePool();if(nw&&(!o||o.dir!==nw.dir||o.mtime!==nw.mtime)){poolI=Math.max(0,POOL.indexOf(nw));backdrop(nw,true);}}catch(e){}}},60000);
  const ss=$('slide');if(ss){ss.value=String(SLIDE);ss.onclick=e=>e.stopPropagation();ss.onchange=e=>{SLIDE=+e.target.value;localStorage.setItem('thryd_slide',SLIDE);Q.set('slide',SLIDE);history.replaceState(null,'','?'+Q.toString());startSlide();};}
  try{(await J('assets/runs/media.json')).runs.forEach(r=>runMedia[r.run]=r.media);}catch(e){}
  try{localPrec=(await J('data/precisions.json')).map(p=>({line:p.line,src:p.src,move:p.move}));}catch(e){}
  setMode(MODE);
})();
// ---------- drag a chip onto a place heading -> <object>.setlocation(<place>) via data/drag.json endpoint
let DRAG=null; (async()=>{try{DRAG=await J('data/drag.json?t='+Date.now());}catch(e){}})();
function toast(msg,bad){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}
  t.textContent=msg;t.className=bad?'bad on':'on';clearTimeout(t._h);t._h=setTimeout(()=>t.className='',2600);}
function setReg(id,r){if(!lastM)return;const nm=id.slice(2);(id[0]==='c'?lastM.chars:lastM.objs).forEach(x=>{if((x.name||x.label)===nm){x.region=r;if(x.off!==undefined)x.off=r!==lastM.here;}});
  if(!lastM.regions.includes(r))lastM.regions.push(r);place(lastM);}
async function dragSend(body){
  if(DRAG.transport!=='ntfy'){const r=await fetch(DRAG.endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));return {status:r.status,...j};}
  const rid=Math.random().toString(36).slice(2,12), t0=Math.floor(Date.now()/1000)-5;
  const r=await fetch(DRAG.endpoint,{method:'POST',body:JSON.stringify({...body,rid})});if(!r.ok)throw new Error('relay HTTP '+r.status);
  for(let i=0;i<20;i++){await new Promise(z=>setTimeout(z,1500));
    try{const tx=await (await fetch(DRAG.reply+'/json?poll=1&since='+t0,{cache:'no-store'})).text();
      for(const l of tx.split('\n')){if(!l)continue;let m;try{m=JSON.parse(l);m=JSON.parse(m.message||'{}');}catch(e){continue;}if(m.rid===rid)return m;}}catch(e){}}
  throw new Error('no reply from box (timeout)');}
async function dropTo(id,from,to){
  if(!DRAG||!DRAG.endpoint){toast('drag endpoint not available',1);return;}
  const label=id.slice(2); PEND[id]={region:to,until:Date.now()+8*60e3}; setReg(id,to); toast(`moving ${label} → ${to}…`);
  try{const j=await dragSend({key:DRAG.key,object:label,place:PFULL[to]||to});if(!j.ok)throw new Error(j.error||('HTTP '+j.status));toast(`${label} → ${to} ✓`);pulse(label);}
  catch(e){delete PEND[id];setReg(id,from);toast(`couldn't move ${label}: ${e.message}`,1);}}
(function(){let d=null;
  const hit=(x,y)=>{document.body.classList.add('dragging');let el=null;try{el=document.elementFromPoint(x,y);}finally{document.body.classList.remove('dragging');}
    let h=el&&el.closest&&el.closest('.ph');if(h)return h;
    const c=el&&el.closest&&el.closest('.chip:not(.ghost)');if(c&&c.dataset.reg)return $('map').querySelector(`[data-name="${CSS.escape(c.dataset.reg)}"]`);
    for(const q of $('map').querySelectorAll('.ph')){const r=q.getBoundingClientRect();if(x>=r.left-10&&x<=r.right+10&&y>=r.top-12&&y<=r.bottom+12)return q;}return null;};
  const clr=()=>document.querySelectorAll('.ph.drop').forEach(h=>h.classList.remove('drop'));
  const start=dd=>{dd.on=true;const r=dd.c.getBoundingClientRect();dd.g=dd.c.cloneNode(true);dd.g.className=dd.c.className+' ghost lift';dd.g.classList.remove('pulse','sel');
    Object.assign(dd.g.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',opacity:''});document.body.appendChild(dd.g);
    dd.c.classList.add('grabbed');document.body.classList.add('dragmode');if(navigator.vibrate)try{navigator.vibrate(15);}catch(e){}};
  const mv=(dd,x,y)=>{dd.g.style.transform=`translate(${x-dd.x}px,${y-dd.y}px) scale(1.12)`;clr();const h=hit(x,y);if(h)h.classList.add('drop');};
  const stop=dd=>{clearTimeout(dd.t);if(dd.g)dd.g.remove();dd.c.classList.remove('grabbed','lift');document.body.classList.remove('dragmode');clr();
    try{dd.c.releasePointerCapture(dd.pid);}catch(e){}};
  document.addEventListener('pointerdown',ev=>{const c=ev.target.closest&&ev.target.closest('.chip:not(.ghost)');if(!c||!c.dataset.id||d)return;
    if(ev.pointerType==='mouse'&&ev.button!==0)return;
    ev.preventDefault();
    d={c,x:ev.clientX,y:ev.clientY,lx:ev.clientX,ly:ev.clientY,on:false,id:c.dataset.id,from:c.dataset.reg,pid:ev.pointerId};
    try{c.setPointerCapture(ev.pointerId);}catch(e){}
    c.classList.add('lift');const dd=d;
    d.t=setTimeout(()=>{if(d===dd&&!dd.on){start(dd);mv(dd,dd.lx,dd.ly);}},ev.pointerType==='mouse'?9e9:280);},{passive:false});
  document.addEventListener('pointermove',ev=>{if(!d||ev.pointerId!==d.pid)return;d.lx=ev.clientX;d.ly=ev.clientY;
    const dx=ev.clientX-d.x,dy=ev.clientY-d.y;if(!d.on){if(dx*dx+dy*dy<36)return;start(d);}
    ev.preventDefault();mv(d,ev.clientX,ev.clientY);},{passive:false});
  const end=ev=>{if(!d||ev.pointerId!==d.pid)return;const dd=d;d=null;const was=dd.on;
    const x=ev.type==='pointercancel'?dd.lx:ev.clientX,y=ev.type==='pointercancel'?dd.ly:ev.clientY;
    const h=was&&hit(x,y);stop(dd);if(!was)return;dd.c._nodrag=Date.now();
    if(!h){toast('drop it on a place name',1);return;}
    if(h.dataset.name===dd.from){toast(`${dd.id.slice(2)} is already at ${h.dataset.name}`);return;}
    dropTo(dd.id,dd.from,h.dataset.name);};
  document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
  document.addEventListener('click',ev=>{const c=ev.target.closest&&ev.target.closest('.chip');if(c&&c._nodrag&&Date.now()-c._nodrag<600){ev.stopPropagation();ev.preventDefault();}},true);
  document.addEventListener('contextmenu',ev=>{if(ev.target.closest&&ev.target.closest('.chip'))ev.preventDefault();});
  document.addEventListener('selectstart',ev=>{if(ev.target.closest&&ev.target.closest('.chip'))ev.preventDefault();});
  document.addEventListener('dragstart',ev=>{if(ev.target.closest&&ev.target.closest('.chip'))ev.preventDefault();});})();

})();
