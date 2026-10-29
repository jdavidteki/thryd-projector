const LIVE_STATE=async()=>{try{const r=await fetch('https://raw.githubusercontent.com/jdavidteki/thryd-projector/main/data/state.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;return await r.json();}catch(e){return J('data/state.json');}};
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
// ---------- backdrop (GIF frames as webp)
let bgSet=null,bgI=0,bgFlip=0,bgTimer=null;
function backdrop(set){ if(!set||(bgSet&&bgSet.dir===set.dir))return; bgSet=set;bgI=0;
  clearInterval(bgTimer); const imgs=[$('bgA'),$('bgB')];
  for(let i=0;i<set.frames;i++){const im=new Image();im.src=`${set.dir}/f${String(i).padStart(3,'0')}.webp`;}
  bgFlip^=1; const on=imgs[bgFlip],off=imgs[bgFlip^1];
  const tick=()=>{on.src=`${set.dir}/f${String(bgI%set.frames).padStart(3,'0')}.webp`;bgI++;};
  tick(); on.classList.add('on'); off.classList.remove('on');
  bgTimer=setInterval(tick,Math.max(80,set.ms||120));
}
function liveBackdrop(place){const p=(place||'').toLowerCase();const b=media.backdrops;
  return /marina|boat|bay|causeway|church|wheelhouse|deck/.test(p)?b.j6:b.j12;}
// ---------- stage
const ents={}; let regionsKey='';
function layout(names,here){
  const key=names.join('|'); const map=$('map');
  if(key!==regionsKey){ regionsKey=key; map.innerHTML='';
    const n=names.length, cols=Math.ceil(Math.sqrt(n*1.8)), rows=Math.ceil(n/cols);
    names.forEach((nm,i)=>{const d=document.createElement('div');d.className='reg';d.dataset.name=nm;
      const c=i%cols,r=Math.floor(i/cols);
      Object.assign(d.style,{left:`calc(${c/cols*100}% + .5vw)`,top:`calc(${r/rows*100}% + .5vh)`,width:`calc(${100/cols}% - 1vw)`,height:`calc(${100/rows}% - 1vh)`});
      d.innerHTML=`<h3></h3>`;d.querySelector('h3').textContent=nm;map.appendChild(d);});
  }
  [...map.children].forEach(d=>d.classList.toggle('here',d.dataset.name===here));
}
function regionRect(name){const d=[...$('map').children].find(x=>x.dataset.name===name)||$('map').children[0];return d?d.getBoundingClientRect():{left:0,top:0,width:200,height:200};}
function ent(id,kind,label,sprite){
  let e=ents[id]; if(!e){e=document.createElement('div');e.className='ent '+kind;
    e.innerHTML=(sprite?`<img alt="" src="${sprite}">`:(kind==='char'?'<div class="sil"></div>':''))+'<div class="lab"></div><div class="note"></div>';
    e.querySelector('.lab').textContent=label; e.style.opacity=0; $('ents').appendChild(e); ents[id]=e;
    requestAnimationFrame(()=>e.style.opacity='');}
  return e;}
// model: {regions[],here,chars[{name,region,off,note}],objs[{label,region,holder}],world,upd,meta,lines[],speakers}
function render(m){
  layout(m.regions,m.here);
  const seen=new Set(), pos={}, items={};
  const push=(reg,it)=>(items[reg]=items[reg]||[]).push(it);
  m.chars.forEach(c=>push(c.region,{id:'c:'+c.name,kind:'char',label:c.name,sp:media.sprites[c.name],c}));
  const charReg={};m.chars.forEach(c=>charReg[c.name]=c.region);
  m.objs.forEach(o=>push((o.holder&&charReg[o.holder])||o.region,{id:'o:'+o.label,kind:'obj',label:o.label,sp:media.sprites[o.label],o}));
  const BW=innerWidth*.13, BH=innerHeight*.2; // natural entity box
  Object.entries(items).forEach(([reg,list])=>{
    const r=regionRect(reg), top=r.top+innerHeight*.055, W=r.width*.96, H=r.bottom-top-innerHeight*.01, n=list.length;
    let best=null;for(let cols=1;cols<=n;cols++){const rows=Math.ceil(n/cols),cw=W/cols,ch=H/rows,sc=Math.min(1,cw/BW,ch/BH);if(!best||sc>=best.sc-1e-6)best={cols,rows,cw,ch,sc};}
    const {cols,cw,ch,sc}=best;
    list.forEach((it,k)=>{const e=ent(it.id,it.kind,it.label,it.sp);seen.add(it.id);
      const x=r.left+r.width*.02+cw*(k%cols+.5), y=top+ch*(Math.floor(k/cols)+1)-innerHeight*.005;
      e.style.setProperty('--s',sc.toFixed(3)); e.style.width=(cw*.88/sc)+'px';
      e.style.left=x+'px';e.style.top=y+'px';e.title=it.label;
      if(it.c){pos[it.label]=[x,y];e.classList.toggle('off',!!it.c.off);e.querySelector('.note').textContent=it.c.note||'';}
      else{const o=it.o;e.querySelector('.note').textContent=o.holder?'held by '+o.holder:'';e.classList.toggle('off',o.region!==m.here&&!o.holder);}
    });});
  Object.keys(ents).forEach(k=>{if(!seen.has(k)){ents[k].remove();delete ents[k];}});
  m._pos=pos;
}
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
  const r=e.getBoundingClientRect(), b=$('bubble');
  b.querySelector('.who').textContent=who+(L.src?' · '+L.src:''); b.querySelector('.txt').textContent=L.line;
  b.style.left=Math.min(innerWidth*.78,Math.max(innerWidth*.22,r.left+r.width/2))+'px'; b.style.top=(r.top-innerHeight*.01)+'px';
  b.classList.add('on'); setTimeout(()=>b.classList.remove('on'),Math.min(SPEED*.9,7000));
}
const every=(f,ms)=>{const g=gen;const t=setInterval(()=>{if(g===gen)f();},ms);timers.push(t);};
function reset(){gen++;timers.forEach(clearInterval);timers=[];Object.keys(ents).forEach(k=>{ents[k].remove();delete ents[k];});regionsKey='';$('bubble').classList.remove('on');}
// ---------- LIVE from state.json
let localPrec=[];
function fromState(s){
  const names=[],add=p=>{const n=short(p);if(!names.includes(n))names.push(n);return n;};
  const here=add(s.current_place);
  const chars=(s.characters||[]).map(c=>({name:c.name,region:add(c.place),note:c.note||'',off:short(c.place)!==here}));
  const objs=(s.objects||[]).map(o=>({label:o.label,region:add(o.place),holder:o.holder||o.held_by||null}));
  return {regions:names,here,chars,objs};
}
async function live(){
  reset(); const g=gen; $('mode').textContent='live';
  let s=null; try{s=await LIVE_STATE();}catch(e){}
  if(!s||!(s.characters||[]).length){return loopTimeline();}
  let last='', step=0, cur=s;
  const apply=st=>{const m=fromState(st);render(m);cur=st;
    backdrop(liveBackdrop(st.current_place));
    $('run').textContent=st.run||'';};
  apply(s);
  const lines=()=>[...(cur.moves||[]).flatMap(m=>(m.precisions||[]).map(p=>({line:p.line,src:'seat '+p.seat,move:/\[\[/.test(p.line)}))),...localPrec];
  const upd=()=>{const mv=(cur.moves||[]).slice(-10), re=(cur.recent_events||[]).slice(-6);
    const items=[...mv.map(m=>m.move),...re.map(e=>`${e.card||''} ${e.ev}${e.status?' · '+e.status:''}`)];
    const it=items.length?items[step++%items.length]:'waiting';
    ticker(cur.story_time_label,ok(it)?it:'move (cut away)',`${cur.current_card} · ${cur.seats||''} · state ${String(cur.exported_at||'').slice(11,16)} ET`);
    const m=fromState(cur); maybeBubble(lines(),m.chars.filter(c=>!c.off).map(c=>c.name).concat(m.chars.length?[]:[]).slice(0,4).length?m.chars.filter(c=>!c.off).map(c=>c.name):m.chars.map(c=>c.name));};
  upd(); every(upd,SPEED);
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
    backdrop(liveBackdrop(e.place));
    ticker(e.world,e.label,`${e.scene} · update ${i%ev.length+1}/${ev.length}`);
    const sp=Object.entries(chars).filter(([n,r])=>r===here).map(([n])=>n);
    maybeBubble(localPrec,sp.length?sp:Object.keys(chars)); i++; };
  step(); every(step,SPEED);
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
    if(rm.length){const mi=rm.find(x=>x.card===f.card)||rm[Math.floor(cards.indexOf(f.card)*rm.length/Math.max(1,cards.length))]||rm[0];backdrop(mi);} 
    const ls=f.latest_seat; const lab=f.kind==='seat'&&ls?`seat ${ls.seat} seated on ${ls.card}`:`${f.card||''} ${f.event||''}${f.status?' · '+f.status:''}`;
    ticker(String(f.t||'').replace('T',' ').slice(0,16)+' ET',lab,`${want} · update ${i%fr.length+1}/${fr.length} · ${f.seated_count||0} seated`);
    maybeBubble(prec,cast.slice(0,6)); i++; };
  step(); every(step,SPEED);
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
setTimeout(()=>$('hint').style.opacity=0,8000);
addEventListener('resize',()=>{regionsKey='';});
(async()=>{
  try{media=await J('data/media.json');}catch(e){}
  try{(await J('assets/runs/media.json')).runs.forEach(r=>runMedia[r.run]=r.media);}catch(e){}
  try{localPrec=(await J('data/precisions.json')).map(p=>({line:p.line,src:p.src,move:p.move}));}catch(e){}
  setMode(MODE);
})();
})();
