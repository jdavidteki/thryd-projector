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
let HOLD=0; // in-scene drag pins the current scene (slideshow paused while dragging + 30s after a drop)
window.thrydHold=ms=>{HOLD=ms?Math.max(HOLD,Date.now()+ms):0;};
function backdrop(set,force){ if(Date.now()<HOLD)return; stageN++;
  const ug=window.THRYD_UG; if(ug.length&&stageN%3===0){return showUser(ug[Math.floor(stageN/3)%ug.length]);}
  if(!set||(!force&&bgSet&&bgSet.dir===set.dir))return; bgSet=set;bgI=0; $('ug').classList.remove('on');
  clearInterval(bgTimer); const imgs=[$('bgA'),$('bgB')];
  for(let i=0;i<set.frames;i++){const im=new Image();im.src=`${set.dir}/f${String(i).padStart(3,'0')}.webp`;}
  bgFlip^=1; const on=imgs[bgFlip],off=imgs[bgFlip^1];
  const tick=()=>{on.src=`${set.dir}/f${String(bgI%set.frames).padStart(3,'0')}.webp`;bgI++;};
  tick(); on.classList.add('on'); off.classList.remove('on'); $('cap').textContent=set.label||''; objsFor(set);
  bgTimer=setInterval(tick,Math.max(80,set.ms||120));
}
let POOL=[],poolI=0,LXTRA=[],CUR_RUN=null; const RUNX=()=>LXTRA.filter(x=>CUR_RUN&&x.run===CUR_RUN);
// slide speed: 8s default, 30s, 60s (?slide=30 or the bar select; remembered)
let SLIDE=+(Q.get('slide')||localStorage.getItem('thryd_slide')||8); if(![8,30,60].includes(SLIDE))SLIDE=8; let slideT=null;
const NEWEST=()=>RUNX().length?RUNX().slice().sort((a,b)=>(b.mtime||0)-(a.mtime||0))[0]:null; let slideN=0;
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
function fitLayer(){if(!objLayer||!objLayer._fs)return;const st=$('stage'),W=st.clientWidth,H=st.clientHeight,[fw,fh]=objLayer._fs;
  const k=Math.max(W/fw,H/fh),w=fw*k,h=fh*k;Object.assign(objLayer.style,{width:w+'px',height:h+'px',left:(W-w)/2+'px',top:(H-h)/2+'px'});} // cover
const DPOS=JSON.parse(localStorage.getItem('thryd_dpos')||'{}');
function objsFor(set){const [k,e0]=set?lookup(set):[null,null]; if(k===objKey&&objLayer)return; objKey=k;
  if(objLayer){const old=objLayer;old.classList.remove('on');old.classList.add('gone');setTimeout(()=>old.remove(),2600);objLayer=null;}
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
    if(o.draggable&&o.sprite){const pa=box.querySelector('.patch');if(pa){const ph=document.createElement('div');ph.className='ob dpatch';ph.dataset.label=o.label;Object.assign(ph.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});ph.appendChild(pa);L.appendChild(ph);}box.classList.add('dob');box.style.zIndex=String(3+Math.round((1-w*h)*20));box.dataset.id=(o.kind==='obj'?'o:':'c:')+o.label;const sv=DPOS[k+'|'+o.label];
      if(sv){box.style.left=sv[0]+'%';box.style.top=sv[1]+'%';box.dataset.dp='1';box.classList.add('away');const q=L.querySelector(`.dpatch[data-label="${CSS.escape(o.label)}"]`);if(q)q.classList.add('away');}}
    L.appendChild(box);});
  $('stage').insertBefore(L,$('cap')); objLayer=L; fitLayer(); applyPlaces(); requestAnimationFrame(()=>L.classList.add('on'));}
// cover math: the layer is the full frame scaled by k=max(W/fw,H/fh) and centred, so the visible window in layer % is
// x in [ox, 100-ox], y in [oy, 100-oy]; keep a dropped box (w%,h%) at least partly inside it
function visClamp(L,l,t,w,h){const st=$('stage'),W=st.clientWidth,H=st.clientHeight,[fw,fh]=L._fs||[480,270],k=Math.max(W/fw,H/fh);
  const ox=(1-W/(fw*k))/2*100,oy=(1-H/(fh*k))/2*100,m=.35;
  return [Math.min(Math.max(l,ox-w*m),100-ox-w*(1-m)),Math.min(Math.max(t,oy-h*m),100-oy-h*(1-m))];}
addEventListener('resize',fitLayer);
// agenda state changed an object -> its sprite glides a bit and pulses
function objChanged(id){if(!objLayer||!id)return;objLayer.querySelectorAll('.ob:not(.dpatch):not([data-dp])').forEach(b=>{if(b.dataset.sid===id||b.dataset.label===id){
  const w=b.querySelector('.spw')||b;w.classList.remove('moved');void w.offsetWidth;w.style.setProperty('--gx',((Math.random()-.5)*6).toFixed(1)+'px');w.style.setProperty('--gy',((Math.random()-.5)*4).toFixed(1)+'px');w.classList.add('moved');}});}
function trackObjs(st){(st.objects||[]).forEach(o=>{const v=JSON.stringify([o.place,o.holder||o.held_by||null,o.state||o.status||null]);
  if(objState[o.label]!==undefined&&objState[o.label]!==v)objChanged(o.label);objState[o.label]=v;});
  (st.characters||[]).forEach(c=>{const id=c.id||c.name,v=JSON.stringify([c.place]);if(objState['c:'+id]!==undefined&&objState['c:'+id]!==v)objChanged(id);objState['c:'+id]=v;});}
window.thrydObjChanged=objChanged;
// object's place != scene's place -> its sprite slides off toward the nearer edge and fades; slides back in when it returns
function applyPlaces(){const m=lastM;if(!objLayer||!m)return;const reg={},cr={};(m.chars||[]).forEach(c=>{reg[c.name]=c.region;cr[c.name]=c.region;});
  (m.objs||[]).forEach(o=>reg[o.label]=(o.holder&&cr[o.holder])||o.region);
  objLayer.querySelectorAll('.ob:not(.dpatch)').forEach(b=>{const id=(b.dataset.sid&&reg[b.dataset.sid]!==undefined)?b.dataset.sid:b.dataset.label;const r=reg[id];
    const w=b.querySelector('.spw');const off=r!==undefined&&r!==m.here;b.classList.toggle('offscene',off);if(!w)return;
    if(off){const x=parseFloat(b.style.left)||0,bw=parseFloat(b.style.width)||1,left=x+bw/2<50;
      w.style.setProperty('--ox',((left?-(x+bw):(100-x))/bw*100+30)*(left?1:1)+'%');w.classList.add('offstage');}
    else w.classList.remove('offstage');});}
window.thrydApplyPlaces=applyPlaces; window.thrydDebug=()=>({run:CUR_RUN,pool:POOL.length,bg:bgSet&&bgSet.dir});
setInterval(()=>{if(!objLayer)return;const bs=[...objLayer.querySelectorAll('.ob')];if(bs.length){const b=bs[Math.floor(Math.random()*bs.length)];objChanged(b.dataset.sid||b.dataset.label);}},3000);
// LXTRA (data/live_extra.json): original unblurred live views, play as-is
// live loop = clean stills only (no baked terminal panel); replay-mode GIF frames stay out of it
function livePool(){return RUNX();} // current run's exact posted GIF frames only
// no live view for the current run yet -> plain neutral stage (never another run's view)
function liveBackdrop(place){const nw=NEWEST();if(nw)return nw;neutralStage(place);return null;}
function neutralStage(place){if(bgSet&&bgSet.neutral)return;clearInterval(bgTimer);bgSet={dir:'neutral',neutral:1};
  [$('bgA'),$('bgB')].forEach(i=>{i.classList.remove('on');i.removeAttribute('src');});$('ug').classList.remove('on');$('cap').textContent=place?short(place):'';objsFor(null);}
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
function render(m){ lastM=m; place(m); applyPlaces(); }
function sidSprite(id){if(!id)return null;const hit=L=>{for(const o of L||[])if(o&&o.sprite&&(o.state_id===id||(!o.state_id&&o.label===id)))return o.sprite;return null;};
  const cur=objLayer&&OMAP[objLayer.dataset.key];let r=hit(cur&&cur.objects);if(r)return r;
  for(const v of Object.values(OMAP)){if(v&&(r=hit((v.objects||[]).filter(o=>o.state_id===id))))return r;}return null;}
const chipSp=n=>media.sprites[n]||sidSprite(n);
function place(m){
  const groups={}; const charReg={}; m.chars.forEach(c=>charReg[c.name]=c.region);
  const add=(g,it)=>(groups[g]=groups[g]||[]).push(it);
  m.chars.forEach(c=>add(c.region,{id:'c:'+c.name,kind:'char',label:c.name,sp:chipSp(c.name),c}));
  m.objs.forEach(o=>add((o.holder&&charReg[o.holder])||o.region,{id:'o:'+o.label,kind:'obj',label:o.label,sp:chipSp(o.label),o}));
  // held items sit right after their holder
  Object.values(groups).forEach(l=>{l.sort((a,b)=>(order[a.id]??0)-(order[b.id]??0));
    l.filter(it=>it.o&&it.o.holder).forEach(it=>{const i=l.indexOf(it),h=l.findIndex(x=>x.label===it.o.holder);if(h>=0){l.splice(i,1);l.splice(l.findIndex(x=>x.label===it.o.holder)+1,0,it);}});});
  const names=[m.here,...m.regions.filter(r=>r!==m.here)].filter(n=>groups[n]);
  const side=[[],[]],cnt=[0,0]; names.forEach(n=>{const k=cnt[0]<=cnt[1]?0:1;side[k].push(n);cnt[k]+=groups[n].length+1.3;});
  const vh=innerHeight/100,vw=innerWidth/100, top=7*vh, bot=86*vh, seen=new Set(), hs=new Set();
  side.forEach((ns,k)=>{ const units=cnt[k]||1, u=Math.min(5.4*vh,(bot-top)/units), sc=u/(5.4*vh); let y=top;
    const x=k?88*vw:1*vw, w=11*vw;
    ns.forEach(n=>{const h=hdr(n);hs.add(n);Object.assign(h.style,{left:x+'px',top:y+'px',width:w+'px',fontSize:Math.max(1.2,1.6*sc)+'vh'});h.classList.toggle('here',n===m.here);h.classList.toggle('r',!!k);y+=1.3*u;
      groups[n].forEach(it=>{const e=ent(it.id,it.kind,it.label,it.sp);if(it.sp&&!e.querySelector('img')){const d0=e.querySelector('.dot');const im=new Image();im.alt='';im.draggable=false;im.src=it.sp;d0?d0.replaceWith(im):e.prepend(im);}seen.add(it.id);e.dataset.id=it.id;e.dataset.reg=n;
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
  if(TDECK.length&&Math.random()<.75){for(let i=0;i<TDECK.length;i++){const t=TDECK[TI++%TDECK.length];if(ok(t.line))return t;}}
  const mv=pool.filter(l=>l.move); const src=(mv.length&&Math.random()<.3)?mv:pool; return src[Math.floor(Math.random()*src.length)];}
let TDECK=[],TI=0;
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
  let first=true; const apply=st=>{CUR_RUN=st.run||CUR_RUN;const m=fromState(st);render(m);cur=st;trackObjs(st);
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
  $('mode').textContent='live · timeline loop'; $('run').textContent=T.run; CUR_RUN=T.run;
  const ev=T.events, names=[...new Set(ev.map(e=>short(e.place)))];
  let i=0, chars={}, objs={};
  const step=()=>{ if(g!==gen)return; const e=ev[i%ev.length]; if(i%ev.length===0){chars={};objs={};}
    const here=short(e.place);
    if(e.kind==='scene'){(e.cast||[]).forEach(n=>chars[n]=here);}
    if(e.object){objs[e.object]=here;}
    render({regions:names,here,chars:Object.entries(chars).map(([n,r])=>({name:n,region:r,off:r!==here})),objs:Object.entries(objs).map(([l,r])=>({label:l,region:r}))});
    if(e.object)pulse(e.object);
    POOL=livePool(); if(i===0||!NEWEST()||(bgSet&&!RUNX().includes(bgSet)))backdrop(NEWEST()||liveBackdrop(e.place)); // keep newest view up; slide timer still cycles
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
  const want=Q.get('run')&&runs.find(r=>r.run===Q.get('run'))?Q.get('run'):(pick.value||([...runs].reverse().find(r=>(r.frames||0)>0)||runs[runs.length-1]).run); pick.value=want;
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
  await loadOmap(); await loadRGifs(); setTimeout(()=>{if(MODE==='live'&&NEWEST()){const nw=NEWEST();POOL=livePool();poolI=Math.max(0,POOL.indexOf(nw));backdrop(nw,true);}},2500); setInterval(async()=>{if(MODE==='live'){loadOmap();loadRGifs();try{const n=(await J('data/live_extra.json?t='+Date.now())).sets||[];const o=NEWEST();LXTRA=n;const nw=NEWEST();POOL=livePool();if(nw&&(!o||o.dir!==nw.dir||o.mtime!==nw.mtime)){poolI=Math.max(0,POOL.indexOf(nw));backdrop(nw,true);}}catch(e){}}},60000);
  const ss=$('slide');if(ss){ss.value=String(SLIDE);ss.onclick=e=>e.stopPropagation();ss.onchange=e=>{SLIDE=+e.target.value;localStorage.setItem('thryd_slide',SLIDE);Q.set('slide',SLIDE);history.replaceState(null,'','?'+Q.toString());startSlide();};}
  try{(await J('assets/runs/media.json')).runs.forEach(r=>runMedia[r.run]=r.media);}catch(e){}
  try{localPrec=(await J('data/precisions.json')).map(p=>({line:p.line,src:p.src,move:p.move}));}catch(e){}
  try{const T=(await J('data/tweets_all.json')).map(p=>({line:p.line,src:p.src,move:false}));for(let i=T.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[T[i],T[j]]=[T[j],T[i]];}TDECK=T;TI=0;}catch(e){}
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
  const tg=window.thrydTarget&&thrydTarget.make(label,`${label}.place == "${PFULL[to]||to}"`,{type:'chip',id,place:to});
  try{const j=await dragSend({key:DRAG.key,object:label,place:PFULL[to]||to,...(tg?{target:tg}:{})});if(!j.ok)throw new Error(j.error||('HTTP '+j.status));toast(`${label} → ${to} ✓`);pulse(label);}
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


// ---------- drag a person/object INSIDE the scene (cut-out layers from objects_map 'draggable') -> same setlocation path as chips
(function(){let d=null;
  const regOf=id=>{if(!lastM)return null;const nm=id.slice(2);const x=(id[0]==='c'?lastM.chars:lastM.objs).find(z=>(z.name||z.label)===nm);return x?x.region:null;};
  const hit=(x,y)=>{for(const q of $('map').querySelectorAll('.ph')){const r=q.getBoundingClientRect();if(x>=r.left-10&&x<=r.right+10&&y>=r.top-12&&y<=r.bottom+12)return q;}
    const el=document.elementsFromPoint(x,y).find(e=>e.closest&&e.closest('.chip:not(.ghost)')&&!e.closest('.dob'));const c=el&&el.closest('.chip');
    return c&&c.dataset.reg?$('map').querySelector(`[data-name="${CSS.escape(c.dataset.reg)}"]`):null;};
  const clr=()=>document.querySelectorAll('.ph.drop').forEach(h=>h.classList.remove('drop'));
  const AC=new WeakMap();
  const opaque=(b,x,y)=>{const im=b.querySelector('img');if(!im||!im.naturalWidth)return true;const r=im.getBoundingClientRect();if(x<r.left||x>r.right||y<r.top||y>r.bottom)return false;
    let c=AC.get(im);if(!c){c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;try{c.getContext('2d',{willReadFrequently:true}).drawImage(im,0,0);}catch(e){return true;}AC.set(im,c);}
    try{const px=c.getContext('2d').getImageData(Math.floor((x-r.left)/r.width*c.width),Math.floor((y-r.top)/r.height*c.height),1,1).data;return px[3]>40;}catch(e){return true;}};
  const pickDob=(x,y)=>{const u=[...new Set(document.elementsFromPoint(x,y).map(e=>e.closest&&e.closest('#objs:not(.gone) .dob')).filter(Boolean))];return u.find(b=>opaque(b,x,y))||null;};
  document.addEventListener('pointerdown',ev=>{const b0=ev.target.closest&&ev.target.closest('#objs:not(.gone) .dob');const pk=b0?pickDob(ev.clientX,ev.clientY):null;if(b0&&!pk&&window.thrydZoom&&thrydZoom.get().z>1)return; /* zoomed: transparent bbox area pans */const b=b0?(pk||b0):null;if(!b||d)return;if(ev.pointerType==='mouse'&&ev.button!==0)return;
    ev.preventDefault();ev.stopPropagation();window.thrydHold(60000);const r=b.getBoundingClientRect();
    d={b,pid:ev.pointerId,x:ev.clientX,y:ev.clientY,l0:parseFloat(b.style.left),t0:parseFloat(b.style.top),on:false};try{b.setPointerCapture(ev.pointerId);}catch(e){}},{passive:false,capture:true});
  document.addEventListener('pointermove',ev=>{if(!d||ev.pointerId!==d.pid)return;const dx=ev.clientX-d.x,dy=ev.clientY-d.y;
    if(!d.on){if(dx*dx+dy*dy<25)return;d.on=true;d.b.classList.add('lifting','away');{const q=d.b.parentNode.querySelector(`.dpatch[data-label="${CSS.escape(d.b.dataset.label)}"]`);if(q)q.classList.add('away');}document.body.classList.add('dragmode');d.b.parentNode.appendChild(d.b);}
    ev.preventDefault();const L=d.b.parentNode.getBoundingClientRect();d.b.style.left=(d.l0+dx/L.width*100)+'%';d.b.style.top=(d.t0+dy/L.height*100)+'%';
    clr();const h=hit(ev.clientX,ev.clientY);if(h)h.classList.add('drop');},{passive:false});
  const end=ev=>{if(!d||ev.pointerId!==d.pid)return;const dd=d;d=null;try{dd.b.releasePointerCapture(dd.pid);}catch(e){}
    dd.b.classList.remove('lifting');document.body.classList.remove('dragmode');clr();if(!dd.on){window.thrydHold(0);return;}
    window.thrydHold(30000);const Lp=dd.b.parentNode,k=Lp&&Lp.dataset.key;const[cl,ct]=visClamp(Lp,parseFloat(dd.b.style.left),parseFloat(dd.b.style.top),parseFloat(dd.b.style.width),parseFloat(dd.b.style.height));
    dd.b.style.left=cl+'%';dd.b.style.top=ct+'%';dd.b.dataset.dp='1';DPOS[k+'|'+dd.b.dataset.label]=[+cl.toFixed(3),+ct.toFixed(3)];
    try{localStorage.setItem('thryd_dpos',JSON.stringify(DPOS));}catch(e){}
    const h=hit(ev.clientX,ev.clientY),id=dd.b.dataset.id,from=regOf(id);if(!h){toast('dropped in the scene — drop on a place name to move them');if(window.thrydTarget)thrydTarget.scene(dd.b,k,cl,ct);return;}
    if(h.dataset.name===from){toast(`${id.slice(2)} is already at ${from}`);return;}
    dropTo(id,from,h.dataset.name);};
  document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);})();
})();

// ---------- zoom/pan the scene (#stage: backdrop + #objs + in-scene people scale together). 1x-4x.
// Existing drags keep working: the .dob drag converts pointer deltas with the layer's transformed rect, chips live outside #stage.
(function(){const st=document.getElementById('stage');if(!st)return;let z=1,tx=0,ty=0;const MIN=1,MAX=4;
  st.style.transformOrigin='0 0';
  const clamp=()=>{const W=st.clientWidth,H=st.clientHeight;tx=Math.min(0,Math.max(W-W*z,tx));ty=Math.min(0,Math.max(H-H*z,ty));};
  const apply=()=>{clamp();st.style.transform=z===1?'':`translate(${tx}px,${ty}px) scale(${z})`;document.body.classList.toggle('zoomed',z>1);const l=document.getElementById('zlvl');if(l)l.textContent=z.toFixed(1)+'×';};
  const sr=()=>({l:st.offsetLeft,t:st.offsetTop});
  const zoomAt=(nz,cx,cy)=>{nz=Math.min(MAX,Math.max(MIN,nz));const o=sr(),px=cx-o.l,py=cy-o.t;const sx=(px-tx)/z,sy=(py-ty)/z;z=nz;tx=px-sx*z;ty=py-sy*z;if(z===1){tx=ty=0;}apply();};
  const reset=()=>{z=1;tx=ty=0;apply();};
  // client px -> untransformed stage px (scene space) for drop math
  window.thrydZoom={get:()=>({z,tx,ty}),reset,zoomAt,toScene:(x,y)=>{const o=sr();return [(x-o.l-tx)/z,(y-o.t-ty)/z];}};
  const onItem=t=>t&&t.closest&&t.closest('.chip,#bar,#zoomui,#user,.ph,#sndgate,#toast');
  addEventListener('wheel',ev=>{const t=ev.target;if(t.closest&&t.closest('#bar,#zoomui,#user,select'))return;ev.preventDefault();zoomAt(z*Math.exp(-ev.deltaY*(ev.ctrlKey?0.01:0.0015)),ev.clientX,ev.clientY);},{passive:false});
  const P=new Map();let pan=null,pinch=null,moved=0,lastTap=0,lastXY=[0,0];
  document.addEventListener('pointerdown',ev=>{if(onItem(ev.target))return;if(ev.pointerType==='mouse'&&ev.button!==0)return;
    P.set(ev.pointerId,[ev.clientX,ev.clientY]);if(P.size===1)moved=0;
    if(P.size===2){const[a,b]=[...P.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1])||1,z0:z};pan=null;}
    else if(P.size===1&&z>1){pan={x:ev.clientX,y:ev.clientY,tx,ty};}});
  document.addEventListener('pointermove',ev=>{if(!P.has(ev.pointerId))return;P.set(ev.pointerId,[ev.clientX,ev.clientY]);
    if(pinch&&P.size>=2){ev.preventDefault();const[a,b]=[...P.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);moved=1;zoomAt(pinch.z0*d/pinch.d,(a[0]+b[0])/2,(a[1]+b[1])/2);return;}
    if(pan){const dx=ev.clientX-pan.x,dy=ev.clientY-pan.y;if(dx*dx+dy*dy>16){moved=1;document.body.classList.add('panning');}tx=pan.tx+dx;ty=pan.ty+dy;apply();}},{passive:false});
  const up=ev=>{if(!P.has(ev.pointerId))return;P.delete(ev.pointerId);
    if(P.size<2)pinch=null;if(P.size===1&&z>1){const[a]=[...P.values()];pan={x:a[0],y:a[1],tx,ty};}else if(!P.size){pan=null;document.body.classList.remove('panning');}
    if(moved){st._nofs=Date.now();return;}
    if(ev.type==='pointerup'&&ev.pointerType!=='mouse'){const n=Date.now();if(n-lastTap<320&&Math.hypot(ev.clientX-lastXY[0],ev.clientY-lastXY[1])<40){reset();lastTap=0;st._nofs=n;}else{lastTap=n;lastXY=[ev.clientX,ev.clientY];}}};
  document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
  document.addEventListener('dblclick',ev=>{if(onItem(ev.target))return;reset();st._nofs=Date.now();});
  // a pan/pinch/double-tap must not toggle fullscreen via the document click handler
  document.addEventListener('click',ev=>{if(st._nofs&&Date.now()-st._nofs<500)ev.stopImmediatePropagation();},true);
  const ui=document.createElement('div');ui.id='zoomui';ui.innerHTML='<button data-z="-" title="zoom out">−</button><span id="zlvl">1.0×</span><button data-z="+" title="zoom in">+</button><button data-z="0" title="reset zoom">⟲</button>';
  ui.addEventListener('click',ev=>{ev.stopPropagation();const b=ev.target.closest('button');if(!b)return;const cx=st.offsetLeft+st.clientWidth/2,cy=st.offsetTop+st.clientHeight/2;
    if(b.dataset.z==='0')reset();else zoomAt(z*(b.dataset.z==='+'?1.25:0.8),cx,cy);});
  ui.addEventListener('dblclick',ev=>ev.stopPropagation());
  document.body.appendChild(ui);addEventListener('resize',apply);apply();})();

// ---------- prophecies: every drag is an open-ended #thryd.miracle.target. Page records + shows a ghost; ONLY state.json marks fulfilled.
(function(){const LS='thryd_targets';const T=()=>{try{return JSON.parse(localStorage.getItem(LS)||'[]');}catch(e){return [];}};
  const save=a=>{try{localStorage.setItem(LS,JSON.stringify(a.slice(-60)));}catch(e){}};
  let st=null; const norm=a=>String(a||'').replace(/\s+/g,' ').trim().toLowerCase();
  const curJ=()=>{const s=st||{};return s.current_card||'';};
  function make(label,assert,ghost){const t={kind:'miracle.target',assert,run:(st&&st.run)||CUR_RUN||'',j:curJ(),at:new Date().toISOString()};
    const a=T().filter(x=>!(x.ghost&&ghost&&x.ghost.label===label&&x.status==='open'));  // a new drag of the same thing supersedes its open ghost
    a.push({...t,status:'open',ghost:{...ghost,label}});save(a);draw();setTimeout(()=>pchip(t,ghost),60);return t;}
  const MT=t=>`#thryd.miracle.target(assert(${t.assert}))`;
  async function copy(x){try{await navigator.clipboard.writeText(x);return true;}catch(e){const ta=document.createElement('textarea');ta.value=x;ta.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(e2){}ta.remove();return ok;}}
  function pchip(t,g){document.querySelectorAll('.prophchip').forEach(x=>x.remove());const c=document.createElement('button');c.className='prophchip';c.textContent='🔮 prophesy';c.title=MT(t);c.dataset.text=MT(t);
    let r=null;if(g.type==='sprite'){const L=document.getElementById('objs');const b=L&&L.querySelector(`.dob[data-label="${CSS.escape(g.label)}"]`);r=b&&b.getBoundingClientRect();}else{const h=document.querySelector(`#map .ph[data-name="${CSS.escape(g.place||'')}"]`);r=h&&h.getBoundingClientRect();}
    r=r||{left:innerWidth/2,bottom:innerHeight/2};c.style.left=Math.min(innerWidth-130,Math.max(4,r.left))+'px';c.style.top=Math.min(innerHeight-40,r.bottom+28)+'px';
    ['pointerdown','pointerup','click','dblclick'].forEach(ev=>c.addEventListener(ev,e=>e.stopPropagation()));
    c.addEventListener('click',async()=>{const ok=await copy(MT(t));c.textContent=ok?'copied — paste in [[nh]]':'copy failed — '+MT(t);c.classList.add('ok');clearTimeout(c._h);c._h=setTimeout(()=>c.remove(),2500);});
    document.body.appendChild(c);setTimeout(()=>{if(!c.classList.contains('ok'))c.remove();},45000);}
  async function scene(b,k,cl,ct){const label=b.dataset.label,L=b.parentNode,R=b.getBoundingClientRect();let other=null,best=0;
    L.querySelectorAll('.ob:not(.dpatch)').forEach(o=>{if(o===b)return;const r=o.getBoundingClientRect();const ix=Math.max(0,Math.min(R.right,r.right)-Math.max(R.left,r.left)),iy=Math.max(0,Math.min(R.bottom,r.bottom)-Math.max(R.top,r.top));const v=ix*iy;if(v>best){best=v;other=o.dataset.label;}});
    const place=(st&&st.current_place)||(lastM&&PFULL[lastM.here])||'';
    const assert=other?`${label}.position == "on top of ${other}"`:`${label}.place == "${place}"`;
    const t=make(label,assert,{type:'sprite',key:k,left:cl,top:ct,w:b.style.width,h:b.style.height,src:(b.querySelector('.sp')||{}).src||''});
    try{if(DRAG&&DRAG.endpoint)fetch(DRAG.endpoint,{method:'POST',body:JSON.stringify({key:DRAG.key,target:t,rid:Math.random().toString(36).slice(2,12)})}).catch(()=>{});}catch(e){}
    toast('✨ prophecy: '+assert);}
  const lay=()=>{let g=document.getElementById('prophs');if(!g){g=document.createElement('div');g.id='prophs';document.body.appendChild(g);}return g;};
  function ghostEl(t){const g=t.ghost||{};let e=document.querySelector(`[data-proph="${CSS.escape(t.at)}"]`);
    if(g.type==='sprite'){const L=document.getElementById('objs');if(!L||L.dataset.key!==g.key){if(e)e.remove();return null;}
      if(!e||e.parentNode!==L){if(e)e.remove();e=document.createElement('div');e.className='proph sprite';e.dataset.proph=t.at;if(g.src){const im=new Image();im.src=g.src;im.alt='';e.appendChild(im);}L.appendChild(e);}
      Object.assign(e.style,{left:g.left+'%',top:g.top+'%',width:g.w,height:g.h});return e;}
    const h=document.querySelector(`#map .ph[data-name="${CSS.escape(g.place||'')}"]`);if(!h){if(e)e.remove();return null;}
    if(!e){e=document.createElement('div');e.className='proph chip';e.dataset.proph=t.at;e.textContent=g.label;lay().appendChild(e);}
    const r=h.getBoundingClientRect();Object.assign(e.style,{left:r.left+'px',top:(r.bottom+4)+'px'});return e;}
  function draw(){const a=T();document.querySelectorAll('[data-proph]').forEach(e=>{if(!a.some(t=>t.at===e.dataset.proph&&t.status!=='gone'))e.remove();});
    a.forEach(t=>{if(t.status==='open')ghostEl(t);});}
  function fulfil(t){const e=ghostEl(t)||(()=>{const x=document.createElement('div');x.className='proph chip';x.textContent=t.ghost&&t.ghost.label||'';x.style.cssText='left:50%;top:40%';lay().appendChild(x);return x;})();
    e.classList.add('done');const c=document.createElement('div');c.className='prophcap';c.textContent='✨ prophecy fulfilled: '+t.assert;lay().appendChild(c);
    setTimeout(()=>{e.classList.add('fade');c.classList.add('fade');},4200);setTimeout(()=>{e.remove();c.remove();},5600);}
  function fromState(s){st=s||st;if(!s)return;const A=x=>Array.isArray(x)?x:(x&&typeof x==='object'?(Array.isArray(x.targets)?x.targets:Array.isArray(x.items)?x.items:Object.values(x).filter(v=>v&&typeof v==='object')):[]);const MF=(s.miracles&&Array.isArray(s.miracles.fulfilled)?s.miracles.fulfilled:[]).map(m=>typeof m==='string'?{assert:m,fulfilled:true}:{...m,fulfilled:true});const list=[...MF,...A(s.targets),...A(s.miracles),...A(s.miracle)].filter(m=>m&&typeof m==='object');
    const ful=list.filter(m=>/fulfil|true|done|met/i.test(String(m.status||''))||m.fulfilled===true);if(!ful.length)return;
    const a=T();let ch=0;a.forEach(t=>{if(t.status!=='open')return;if(ful.some(m=>norm(m.assert||(m.target&&m.target.assert)||(typeof m.target==='string'?m.target:''))===norm(t.assert))){t.status='fulfilled';ch=1;fulfil(t);}});if(ch)save(a);}
  window.thrydTarget={make,scene,fromState,list:T,text:MT};
  const poll=async()=>{try{fromState(await LIVE_STATE());}catch(e){}draw();};
  poll();setInterval(poll,20000);setInterval(draw,1200);addEventListener('resize',draw);})();
