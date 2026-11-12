const LIVE_STATE=async()=>{try{const r=await fetch('https://raw.githubusercontent.com/jdavidteki/thryd-projector/main/data/state.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;return await r.json();}catch(e){try{const r=await fetch('data/state.json?_='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;return await r.json();}catch(e2){throw e2;}}};
// #thryd projector: live (data/state.json) · timeline loop (data/timeline.json) · replay (data/replays.json + replay_<run>.json)
(()=>{
const Q=new URLSearchParams(location.search);
const SPEED=Math.max(1,parseFloat(Q.get('speed')||'8'))*1000, POLL=10000;
const QA_MODE=Q.get('qa')==='1';
const CUTS_WAIT_MS=4000;
let MODE=(()=>{const m=(Q.get('mode')||'live').toLowerCase();return (m==='replay'||m==='cerebro'||m==='lovemap')?m:'live';})();
const BAD=/sex|nasty|dirt|iud|adult|daddy|position|hookup|benefit|porn|nude|naked|horny|kiss|\bbed|breast|moan|lick|bang|thrust|sessy|\bhard\b|body|\bwet\b|strip|fuck|pussy|dick|cock|\bass\b|boob|bitch|nyash|prick|suck|condom|virgin|orgasm|<real/i;
const ok=s=>!!s&&!BAD.test(s);
const $=id=>document.getElementById(id);
const J=async u=>{const r=await fetch(u+(u.includes('?')?'&':'?')+'_='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(r.status);return r.json();};
let media={backdrops:{},sprites:{}}, runMedia={}, timers=[], gen=0;
const short=p=>(p||'elsewhere').replace(/,? (in )?Miami(, Florida)?/g,'').replace(/^(the|a) /i,'').replace(/ outside the apartment.*$/,'').replace(/^apartment Marisol and Calla share in /,'').slice(0,34);
// ---------- stage: current scene GIF, large & centered, crossfaded
let bgSet=null,bgI=0,bgFlip=0,bgTimer=null,stageN=0; window.THRYD_UG=window.THRYD_UG||[];
// keep the ticker 'loading' label up until the first scene is decoded and on stage
let viewUp=false, heldTicker=null, cutsHintOn=false, flipPending=false;
let queuedSet=null, outgoingSet=null, switchWait=null;
const FLIP_WAIT_MS=25000;
function clearSwitchWait(){ if(switchWait){ clearTimeout(switchWait); switchWait=null; } }
// At most 3 decoded view rasters (current + 2 recent). The catalog (POOL/LXTRA)
// is metadata only and can be 1000+; we never pre-decode it. Evicting a view
// drops img.src and any frame preloads so Chrome can release the GIF frames.
const VIEW_CACHE_MAX=3;
let viewCache=[];
const viewPre=new Map();
function viewKey(set){ return (set && (set.dir || set.url || set.medium_image_id || set.src || '')) || ''; }
function releaseImgSlot(img){
  if(!img) return;
  // Do not assign src='' — the browser resolves that to the page URL and keeps a slot "loaded".
  try{ img.removeAttribute('src'); img.removeAttribute('srcset'); img.style.opacity=''; img.style.transition=''; }catch(e){}
}
function releasePre(key){
  const pres=viewPre.get(key);
  if(!pres) return;
  pres.forEach(im=>{ try{ im.removeAttribute('src'); im.removeAttribute('srcset'); }catch(e){} });
  viewPre.delete(key);
}
function releaseView(key, keepImgs){
  if(!key) return;
  releasePre(key);
  const keep=new Set(keepImgs||[]);
  ['bgA','bgB'].forEach(id=>{
    const im=$(id);
    if(!im || keep.has(im) || im.classList.contains('on')) return;
    const cur=im.currentSrc||im.src||'';
    if(!cur) return;
    const tail=(key.split('/').pop()||'').toLowerCase();
    if((tail && cur.toLowerCase().indexOf(tail)>=0) || cur.indexOf(key)>=0) releaseImgSlot(im);
  });
}
function retainView(set, keepImg){
  const k=viewKey(set);
  if(!k) return;
  const i=viewCache.indexOf(k);
  if(i>=0) viewCache.splice(i,1);
  viewCache.push(k);
  const keep=[];
  if(keepImg) keep.push(keepImg);
  ['bgA','bgB'].forEach(id=>{ const im=$(id); if(im&&im.classList.contains('on')&&!keep.includes(im)) keep.push(im); });
  while(viewCache.length>VIEW_CACHE_MAX){
    const ev=viewCache.shift();
    if(ev!==k) releaseView(ev, keep);
  }
}
function finishSwitch(ok){
  clearSwitchWait();
  flipPending=false;
  if(!ok){
    // Drop a timed-out or failed incoming decode sitting in the hidden slot.
    ['bgA','bgB'].forEach(id=>{ const im=$(id); if(im&&!im.classList.contains('on')) releaseImgSlot(im); });
    if(outgoingSet && !sameView(bgSet, outgoingSet)) bgSet=outgoingSet;
  }
  outgoingSet=null;
  const q=queuedSet; queuedSet=null;
  if(q && !sameView(bgSet, q)) setTimeout(()=>{ try{ backdrop(q,true); }catch(e){} }, 0);
}
function setCutsHint(on){ cutsHintOn=!!on; const u=$('upd'); if(!u)return; if(on){ u.textContent='loading cuts'; u.style.opacity=1; } else if(u.textContent==='loading cuts') u.textContent=''; }
function revealStage(){ if(viewUp)return; viewUp=true; if(heldTicker){ const t=heldTicker; heldTicker=null; ticker(t[0],t[1],t[2]); } else { const u=$('upd'); if(u&&(u.textContent==='loading'||u.textContent==='loading cuts')&&!cutsHintOn) u.textContent=''; } }
function showUser(u){clearSwitchWait();queuedSet=null;outgoingSet=null;flipPending=false;clearInterval(bgTimer);bgSet={dir:'user:'+u.id};const w=$('ug');w.innerHTML='';w.appendChild(u.vis);
  w.classList.add('on');objsFor(null);$('bgA').classList.remove('on');$('bgB').classList.remove('on');$('cap').textContent=u.label;clearScene();revealStage();}
let HOLD=0; // in-scene drag pins the current scene (slideshow paused while dragging + 30s after a drop)
window.thrydHold=ms=>{HOLD=ms?Math.max(HOLD,Date.now()+ms):0;};
function remoteSet(set){return !!(set&&set.how==='medium'&&set.remote&&set.url);}
// same path+mtime (or same url/src when no mtime) is a no-op, even with force — prevents tearing
// on a true remount. A newer mtime (or a changed url) is a new live view at that path and must show.
function sameView(a,b){
  if(!a||!b) return false;
  if((a.dir||'')!==(b.dir||'')) return false;
  if(a.mtime!=null||b.mtime!=null) return String(a.mtime)===String(b.mtime);
  const au=a.url||a.src||'', bu=b.url||b.src||'';
  if(au||bu) return au===bu;
  return true;
}
const libPin=window.ThrydMlibPin.create();
function backdrop(set,force){ if(!libPin.allow(set))return; if(Date.now()<HOLD)return; if(sameView(bgSet,set))return;
  // Never start a second switch while the incoming file is still loading.
  // Stacked fetches + streamed GIF walks on Slow 4G blew the tab (thryd3 r10).
  if(flipPending){ queuedSet=set; return; }
  stageN++;
  const ug=window.THRYD_UG; if(ug.length&&stageN%3===0){return showUser(ug[Math.floor(stageN/3)%ug.length]);}
  if(!set)return; const isCold=!viewUp; outgoingSet=bgSet; bgSet=set;bgI=0; flipPending=true; setCutsHint(false); $('ug').classList.remove('on');
  clearSwitchWait();
  switchWait=setTimeout(()=>{ if(!flipPending||!(bgSet===set||sameView(bgSet,set))) return; finishSwitch(false); }, FLIP_WAIT_MS);
  // on a switch, keep the outgoing GIF (and #mcut) on stage until the incoming image is decoded.
  // detach immediately only on cold boot, when there is nothing to hold.
  if(isCold&&window.ThrydMediumCuts) try{ ThrydMediumCuts.detach(); }catch(e){}
  clearInterval(bgTimer); bgTimer=null; const imgs=[$('bgA'),$('bgB')];
  // load into the hidden image; the visible one stays up until the new view is decoded (no black/partial frame)
  const vis=imgs.findIndex(i=>i.classList.contains('on'));
  // After cuts attach, neither img has .on (the plate is what is showing). Keep the
  // last shown slot as outgoing and always load the incoming GIF into the other one.
  let next=(vis===0||vis===1)?vis^1:bgFlip^1;
  if(imgs[next]&&imgs[next].classList.contains('on')) next^=1;
  bgFlip=next; const on=imgs[bgFlip],off=imgs[bgFlip^1];
  const wantUrl=remoteSet(set)?(set.url||''):'';
  const srcIs=img=>{
    if(!img||!img.naturalWidth) return false;
    if(!wantUrl) return true;
    const cur=img.currentSrc||img.src||'';
    if(!cur) return false;
    const tail=u=>{try{return decodeURIComponent((String(u).split('?')[0].split('#')[0].split('/').pop()||'')).toLowerCase();}catch(e){return String(u).toLowerCase();}};
    return cur===wantUrl || (tail(cur)===tail(wantUrl) && tail(cur).length>0);
  };
  const capText=(remoteSet(set)?(set.medium_image_id||set.label||''):(set.label||''))+viewTag(set);
  let shown=false; const flip=()=>{
    if(shown)return; if(!(bgSet===set||sameView(bgSet,set)))return;
    // never flip to a slot without the incoming pixels (keeps the outgoing GIF up on a slow switch).
    // naturalWidth alone is not enough: a reused <img> can still report the previous file after src is changed.
    if(!srcIs(on)) return;
    shown=true;
    const hadCut=!!document.getElementById('mcut');
    on.classList.add('on');
    if(hadCut){ on.style.transition='none'; on.style.opacity='1'; }
    if(off) off.classList.remove('on');
    if(!isCold&&window.ThrydMediumCuts) try{ ThrydMediumCuts.detach(); }catch(e){}
    if(hadCut){ const el=on; requestAnimationFrame(()=>{ el.style.transition=''; el.style.opacity=''; }); }
    const c=$('cap'); if(c)c.textContent=capText;
    if(remoteSet(set)){ objsFor(null); clearScene(); } else objsFor(set);
    const outKey=viewKey(outgoingSet);
    finishSwitch(true);
    retainView(set, on);
    // Keep the incoming bitmap; drop the hidden outgoing GIF so a long session
    // cannot pile decoded frames. During the next switch the hidden slot reloads.
    if(outKey) releasePre(outKey);
    if(off && off!==on) releaseImgSlot(off);
    revealStage();
    if(heldTicker){ const t=heldTicker; heldTicker=null; ticker(t[0],t[1],t[2]); }
  };
  const whenReady=(img,go)=>{const ok=()=>{if(!(bgSet===set||sameView(bgSet,set))||!srcIs(img))return; go();}; img.addEventListener('load',ok,{once:true}); if(img.decode)img.decode().then(ok,()=>{}); if(img.complete&&srcIs(img)) ok();};
  on.onerror=null; off.onerror=null; on.onload=null;
  if(remoteSet(set)){
    // original Medium file, one request. The browser plays a GIF's own timing. No frame split, no retry loop.
    on.onload=function(){if(bgSet!==set)return; on.dataset.fail='';};
    on.onerror=function(){if(bgSet!==set)return; on.dataset.fail='1';
      // Incoming file failed: keep the outgoing view and its caption.
      finishSwitch(false);};
    // Re-setting the same URL can abort and blank the slot. Only assign when needed.
    if(!(srcIs(on)&&on.complete)) on.src=set.url;
    // caption waits for flip, so a slow switch doesn't label a still-outgoing (or black) stage as the next scene
    if(isCold){ objsFor(null); clearScene(); }
    // 4s cap is cold-boot only: flip the decoded first GIF rather than sit on black. On later
    // switches the outgoing view stays until the incoming one is decoded; never cap-flip an empty slot.
    let cutsDone=false;
    const finishCuts=ok=>{
      if(bgSet!==set) return;
      cutsDone=true;
      setCutsHint(false);
      if(ok){ if(!shown) revealStage(); whenReady(on,flip); }
      else whenReady(on,flip);
    };
    const startAttach=()=>{
      if(!window.ThrydMediumCuts){ whenReady(on,flip); return; }
      try{
        const ap=ThrydMediumCuts.attach(set,{image:on, stage:$('stage')});
        const done=r=>finishCuts(!!(r&&r.ok));
        if(ap&&ap.then) ap.then(done,()=>finishCuts(false));
        else done(ap);
      }catch(e){ finishCuts(false); }
    };
    let capArmed=false, capAt=0;
    const stillThis=()=>bgSet===set||sameView(bgSet,set);
    const decoded=()=>srcIs(on);
    const armCap=()=>{
      if(!isCold||capArmed||shown||cutsDone||!stillThis()||!decoded()) return;
      capArmed=true;
      capAt=Date.now()+CUTS_WAIT_MS;
    };
    if(isCold){
      whenReady(on, armCap);
      const capPoll=setInterval(()=>{
        if(!stillThis()||shown||cutsDone){clearInterval(capPoll);return;}
        if(!capArmed&&decoded()) armCap();
        if(capArmed&&Date.now()>=capAt){ clearInterval(capPoll); setCutsHint(true); flip(); }
      }, 100);
      startAttach();
    } else {
      // flip first, and only attach (which may hide the img / replace #mcut) after a real flip
      whenReady(on, ()=>{ flip(); if(shown) startAttach(); });
    }
    return;
  }
  // frame 0 first (it goes straight into the hidden image); the rest preload once it is up, so a slow link isn't split 40 ways
  const pre=[]; const preload=()=>{if(bgSet!==set||pre.length)return; for(let i=0;i<set.frames;i++){const im=new Image();im.src=`${set.dir}/f${String(i).padStart(3,'0')}.webp`;pre.push(im);} const k=viewKey(set); if(k) viewPre.set(k,pre); retainView(set,on);};
  // advance only to a frame that has fully arrived; otherwise hold the current frame (never a half-loaded black frame)
  const tick=()=>{if(bgI>0&&!shown)return; const im=pre[bgI%set.frames]; if(bgI>0&&!(im&&im.complete&&im.naturalWidth))return; on.src=im?im.src:`${set.dir}/f${String(bgI%set.frames).padStart(3,'0')}.webp`;bgI++;};
  tick(); whenReady(on,()=>{flip();preload();});
  bgTimer=setInterval(tick,Math.max(80,set.ms||120));
  bindScene(set);
}
let POOL=[],poolI=0,slideCursor='',LXTRA=[],CUR_RUN=null,coldBooting=false; const RUNX=()=>LXTRA.filter(x=>CUR_RUN&&x.run===CUR_RUN);
// slide speed: 8s default, 30s, 60s (?slide=30 or the bar select; remembered)
let kept=null; try{kept=window.ThrydKeep&&ThrydKeep.settings();}catch(e){kept=null;} if(kept&&(kept.mute===0||kept.mute===1)){try{localStorage.setItem('thryd_mute',kept.mute?'1':'0');}catch(e){}} let SLIDE=+(Q.get('slide')||(kept&&kept.slide)||localStorage.getItem('thryd_slide')||8); if(![8,30,60].includes(SLIDE))SLIDE=8; let slideT=null;
const NEWEST=()=>RUNX().length?RUNX().slice().sort((a,b)=>(b.mtime||0)-(a.mtime||0))[0]:null;
// after ten slideshow changes, return to whatever the newest live view is then
const slideCycle=window.ThrydLiveReturn.create(10);
function startSlide(){clearInterval(slideT);slideT=setInterval(()=>{
  if(coldBooting||flipPending)return;
  const moved=ThrydLiveReturn.step(slideCycle,{pool:POOL,poolI,cursor:slideCursor,hold:libPin.pinned(),newest:()=>MODE==='live'?NEWEST():null});
  if(moved.action==='idle'||moved.action==='hold')return;
  poolI=moved.poolI; if(moved.cursor)slideCursor=moved.cursor; backdrop(moved.set,true);
},SLIDE*1000);}
window.thrydLibrary={show(id){const q=String(id||'').trim(); const s=LXTRA.find(x=>x&&x.how==='medium'&&(x.medium_image_id===q||x.dir==='medium/'+q||x.url===q)); if(!s)return null; libPin.hold(s); if(window.ThrydKeep)try{ThrydKeep.rememberGif(s.medium_image_id||q);}catch(e){} backdrop(s,true); return s.dir;}, showSet(set){if(!remoteSet(set))return null; backdrop(set,true); return set.dir;}, counts(){const m=LXTRA.filter(x=>x&&x.how==='medium'); return {medium:m.length, gif:m.filter(x=>x.extension==='gif').length, still:m.filter(x=>x.extension!=='gif').length};}};
startSlide();

// ---------- per-GIF scene updates: loop data/timeline.json events for the GIF on stage
let TL={run:null,events:[]}, scKey='', scEv=[], scI=0, scPaused=false, scChars={}, scObjs={}, scNames=[], scHere='', scTimer=null;
const SCENE_MS=Math.min(Math.max(1200,SPEED),2500);
function altKeys(card){const c=String(card||'').toLowerCase(),out=new Set();if(!c)return out;out.add(c);const m=c.match(/^([wj])(\d+)$/);if(m){out.add('w'+m[2]);out.add('j'+m[2]);}return out;}
function cardOfSet(set){if(!set)return null;if(set.card)return String(set.card);const p=set.dir||set.gif||set.src||set.label||'';const m=String(p).match(/(?:^|[\/_\s·.-])([wj]\d+)(?:\b|[\/_.-]|$)/i);return m?m[1]:null;}
function eventsFor(card){const keys=altKeys(card);if(!keys.size)return [];return TL.events.filter(e=>keys.has(String(e.scene||'').toLowerCase())||keys.has(String(e.card||'').toLowerCase()));}
function rebuildNames(){scNames=[...new Set(TL.events.map(e=>short(e.place||'')).filter(Boolean))];}
function syncPauseBtn(){const btn=$('rpause');if(!btn)return;if(scEv.length||cmEv.length){btn.style.display='';btn.textContent=scPaused?'Play':'Pause';}else btn.style.display='none';}
function applySceneEvent(e,card){
  const here=short(e.place||scHere||'elsewhere');scHere=here;if(here&&!scNames.includes(here))scNames.push(here);
  if(e.cast&&e.cast.length)e.cast.forEach(n=>{scChars[n]=here;});
  if(e.object)scObjs[e.object]=here;
  const lab=String(e.label||'');
  const sm=lab.match(/move\s+(\S+)\.setlocation\((.+)\)/i);
  if(sm){const who=sm[1].replace(/^\[\[|\]\]$/g,''),pl=short(sm[2].replace(/^["']|["']$/g,''));if(pl&&!scNames.includes(pl))scNames.push(pl);if(scObjs[who]!==undefined||scChars[who]===undefined&&/^[a-z]/.test(who))scObjs[who]=pl;else scChars[who]=pl;}
  render({regions:scNames.length?scNames:[here],here,chars:Object.entries(scChars).map(([n,r])=>({name:n,region:r,off:r!==here})),objs:Object.entries(scObjs).map(([l,r])=>({label:l,region:r}))});
  if(e.object){pulse(e.object);cmEnqueue(async()=>{await sceneAnim(e.object,e.place||scHere,null);});}
  const n=scEv.length,idx=((scI-1)%n+n)%n;
  ticker(e.world||'',ok(lab)?lab:('update '+(idx+1)),`${card||''} · update ${idx+1}/${n}`);
  const sp=Object.entries(scChars).filter(([n,r])=>r===here).map(([n])=>n);
  maybeBubble(localPrec,sp.length?sp:Object.keys(scChars));
}
function sceneStep(){if(scPaused||!scEv.length)return;const n=scEv.length,idx=scI%n;if(idx===0){scChars={};scObjs={};}const e=scEv[idx];scI++;applySceneEvent(e,cardOfSet(bgSet)||(scKey.split('|')[0]||''));}
function bindScene(set){
  const card=cardOfSet(set);const keys=altKeys(card);const keyStr=[...keys].sort().join('|');
  if(keyStr===scKey){syncPauseBtn();return;}
  scKey=keyStr;scEv=(set&&set.run&&TL.run&&set.run!==TL.run)?[]:eventsFor(card); // another agenda's view never borrows this timeline's captions
  if(set&&set.run&&TL.run&&set.run!==TL.run)scKey=set.run+'|'+keyStr;scI=0;scChars={};scObjs={};scPaused=false;syncPauseBtn();
  if(!scEv.length)return;sceneStep();
}
function clearScene(){scKey='';scEv=[];scI=0;scChars={};scObjs={};scPaused=false;syncPauseBtn();}
async function loadTimeline(){try{const T=await J('data/timeline.json');TL={run:T.run||null,events:(T.events||[]).slice()};rebuildNames();
  if(scKey){const card=cardOfSet(bgSet)||scKey.split('|').find(Boolean)||'';const next=eventsFor(card);const prevLen=scEv.length;scEv=next;if(prevLen===0&&next.length){scI=0;sceneStep();}syncPauseBtn();}
  else if(bgSet){bindScene(bgSet);}
}catch(e){}}
function ensureSceneTimer(){if(scTimer)return;scTimer=setInterval(()=>{if(!scPaused)sceneStep();},SCENE_MS);}
// ---------- customer moves: loop data/drags.json (past projector-drags + live ntfy), forever; Pause stops this too
let cmEv=[], cmI=0, cmTimer=null, cmSeen=new Set(), cmLastNtfy=0, cmPos={}, DRAGS_RUN=null;
const CM_MS=Math.min(Math.max(1400,SPEED),2800);
function cmSig(e){return e.id||[e.at||'',e.object||'',e.place||'',e.x,e.y].join('|');}
function cmLabel(o){return String(o||'').replace(/_5a58c4$/i,'').trim();}
function cmFindId(label){const want=cmLabel(label).toLowerCase();if(!want)return null;
  const tryId=id=>{const nm=id.slice(2).toLowerCase();return nm===want||nm.replace(/_5a58c4$/,'')===want;};
  for(const id of Object.keys(ents)){if(tryId(id))return id;}
  if(lastM){for(const c of lastM.chars||[]){if(cmLabel(c.name).toLowerCase()===want)return 'c:'+c.name;}
    for(const o of lastM.objs||[]){if(cmLabel(o.label).toLowerCase()===want)return 'o:'+o.label;}}
  return null;}
function cmEnsure(label,region){let id=cmFindId(label);if(id)return id;
  // chip missing (other-run cut-out / not in state yet) — seed a soft entry into lastM so place() can show it
  if(!lastM){lastM={regions:[],here:region||'elsewhere',chars:[],objs:[]};}
  const here=lastM.here||region||'elsewhere';const r=region||here;
  if(r&&!lastM.regions.includes(r))lastM.regions.push(r);
  // prefer object chip for lowercase labels, character for Title Case
  if(/^[A-Z]/.test(label)&&!/\d/.test(label)){lastM.chars.push({name:label,region:r,off:r!==here});return 'c:'+label;}
  lastM.objs.push({label:label,region:r});return 'o:'+label;}
function cmFindBoxes(label){if(!objLayer)return [];const want=cmLabel(label).toLowerCase();if(!want)return [];
  return [...objLayer.querySelectorAll('.ob:not(.dpatch)')].filter(b=>{
    const lab=cmLabel(b.dataset.label||'').toLowerCase(), sid=cmLabel(b.dataset.sid||'').toLowerCase();
    return lab===want||sid===want||lab.replace(/_5a58c4$/,'')===want||sid.replace(/_5a58c4$/,'')===want;});}
function cmHome(b){if(b.dataset.homeL==null){b.dataset.homeL=String(parseFloat(b.style.left)||0);b.dataset.homeT=String(parseFloat(b.style.top)||0);}return [+b.dataset.homeL,+b.dataset.homeT];}
function cmTag(b){let t=b.querySelector('.cmto');if(!t){t=document.createElement('span');t.className='cmto';b.appendChild(t);}return t;}
function cmPatchAway(b,on){const q=objLayer&&objLayer.querySelector(`.dpatch[data-label="${CSS.escape(b.dataset.label||'')}"]`);if(q)q.classList.toggle('away',!!on);}
function cmAtHere(pl){const here=(lastM&&lastM.here)||scHere||'';if(!pl)return true;if(!here)return false;const a=pl.toLowerCase(),b=here.toLowerCase();return a===b||a.includes(b)||b.includes(a);}
const CM_REDUCED=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}})();
const CM_EASE=(t)=>t<=0?0:t>=1?1:(()=>{ /* cubic-bezier(0.45,0,0.2,1) approx via cubic unit bezier */ const cx=0.45,cy=0,x2=0.2,y2=1;
  // Newton solve for x(u)=t on x(u)=3(1-u)^2 u cx + 3(1-u)u^2 x2 + u^3
  let u=t;for(let i=0;i<6;i++){const u2=u*u,u3=u2*u,mu=1-u;const x=3*mu*mu*u*cx+3*mu*u2*x2+u3;const dx=3*mu*mu*cx+6*mu*u*(x2-cx)+3*u2*(1-x2);if(Math.abs(dx)<1e-6)break;u-=(x-t)/dx;u=Math.min(1,Math.max(0,u));}
  const u2=u*u,u3=u2*u,mu=1-u;return 3*mu*mu*u*cy+3*mu*u2*y2+u3;})();
let cmQ=[], cmBusy=false, cmRaf=0, cmRestT=null;
function cmIdle(b,on){if(CM_REDUCED){b.classList.remove('cm-idle');return;}b.classList.toggle('cm-idle',!!on&&!b.classList.contains('cm-fly'));}
function cmSetXform(b,tx,ty,sc,lift){b.style.transform=`translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${sc.toFixed(4)})`;b.style.filter=lift?`drop-shadow(0 ${6+lift*10}px ${10+lift*14}px rgba(0,0,0,${0.35+lift*0.25}))`:'';b.style.willChange='transform,opacity,filter';}
function cmClearXform(b){b.style.transform='';b.style.filter='';b.style.willChange='';b.style.opacity='';}
function cmFly(b, toL, toT, opts){
  return new Promise(resolve=>{
    if(scPaused){resolve();return;}
    const o=opts||{};
    const parent=b.parentNode; if(!parent){resolve();return;}
    const W=parent.clientWidth||1, H=parent.clientHeight||1;
    const fromL=parseFloat(b.style.left)||0, fromT=parseFloat(b.style.top)||0;
    const dx=(toL-fromL)/100*W, dy=(toT-fromT)/100*H;
    const dist=Math.hypot(dx,dy);
    if(CM_REDUCED || dist<0.5){
      b.style.left=toL+'%';b.style.top=toT+'%';cmClearXform(b);b.style.opacity=o.fadeTo!=null?String(o.fadeTo):'1';resolve();return;}
    const dur=Math.min(2200, Math.max(1400, 900+dist*1.15)); // 1.4–2.2s by distance
    const arc=(o.arc!=null?o.arc: Math.min(48, 12+dist*0.08)) * (o.arcSign|| (dx>=0?-1:1));
    const fadeFrom=o.fadeFrom!=null?o.fadeFrom: (parseFloat(b.style.opacity)||1);
    const fadeTo=o.fadeTo!=null?o.fadeTo:1;
    const tag=cmTag(b);
    if(o.label!=null){tag.classList.remove('on');void tag.offsetWidth;tag.textContent=o.label;requestAnimationFrame(()=>tag.classList.add('on'));}
    else{tag.classList.remove('on'); setTimeout(()=>{if(!tag.classList.contains('on'))tag.textContent='';},400);}
    b.classList.add('cm-fly','cm-live');b.classList.remove('cm-idle');
    cmSetXform(b,0,0,1,0);
    const t0=performance.now();
    const step=(now)=>{
      if(scPaused){cmRaf=requestAnimationFrame(step);return;} // freeze mid-flight visually by holding
      const raw=Math.min(1,(now-t0)/dur); const e=CM_EASE(raw);
      // lift envelope: up first third, settle with tiny overshoot past 1 then back
      let sc=1, lift=0;
      if(raw<0.22){const u=raw/0.22; sc=1+0.04*CM_EASE(u); lift=u;}
      else if(raw<0.78){sc=1.04; lift=1-(raw-0.22)/0.56*0.55;}
      else{const u=(raw-0.78)/0.22; // settle + overshoot
        const over=1.04 - 0.06*CM_EASE(u) + 0.015*Math.sin(u*Math.PI); // dips under then settles
        sc=1 + (over-1)*(1-u) + 0.0; sc=1+(0.04)*(1-CM_EASE(u))+0.012*Math.sin(Math.min(1,u*1.4)*Math.PI)*(1-u);
        lift=Math.max(0,0.45*(1-u));}
      const bx=dx*e, by=dy*e - Math.sin(Math.PI*e)*arc;
      cmSetXform(b,bx,by,sc,lift);
      b.style.opacity=String(fadeFrom+(fadeTo-fadeFrom)*e);
      if(raw<1){cmRaf=requestAnimationFrame(step);}
      else{
        // commit final layout, drop transform in same frame (no snap)
        b.style.left=toL+'%';b.style.top=toT+'%';
        cmClearXform(b);b.style.opacity=String(fadeTo);
        b.classList.remove('cm-fly','lifting');
        if(fadeTo>0.5)cmIdle(b,true); else b.classList.remove('cm-idle');
        resolve();
      }
    };
    cmRaf=requestAnimationFrame(step);
  });
}
async function sceneAnim(label,place,xy){const boxes=cmFindBoxes(label);if(!boxes.length)return false;const pl=short(place||'');
  const atHere=cmAtHere(pl);
  for(const b of boxes){
    const[hl,ht]=cmHome(b);const bw=parseFloat(b.style.width)||1;
    const leftSide=(hl+bw/2)<50;const edgeL=leftSide?(-(bw+10)):(100+6);
    b.classList.add('cm-live');
    if(xy&&xy.x!=null&&xy.y!=null&&objLayer){
      const[cl,ct]=visClamp(objLayer,+xy.x,+xy.y,bw,parseFloat(b.style.height)||1);
      b.classList.remove('cm-out','offscene');cmPatchAway(b,true);b.dataset.dp='1';b.classList.add('away','cm-move');
      const k=objLayer.dataset.key;if(k){DPOS[k+'|'+b.dataset.label]=[+cl.toFixed(3),+ct.toFixed(3)];try{localStorage.setItem('thryd_dpos',JSON.stringify(DPOS));}catch(e){}}
      await cmFly(b,cl,ct,{label:'',arcSign:cl>=hl?-1:1});
      b.classList.remove('pulse');void b.offsetWidth;b.classList.add('pulse');
    }else if(!atHere){
      b.classList.add('cm-out','lifting','away','offscene');cmPatchAway(b,true);
      await cmFly(b,edgeL,ht,{fadeTo:0,label:'→ '+pl,arc:Math.min(56,28),arcSign:leftSide?-1:1});
    }else{
      b.classList.remove('cm-out','offscene');cmPatchAway(b,false);
      // place off-edge without a flash, then glide home
      b.style.transition='none';b.style.left=edgeL+'%';b.style.top=ht+'%';b.style.opacity='0';cmClearXform(b);
      void b.offsetWidth;
      b.classList.add('away','cm-move');
      await cmFly(b,hl,ht,{fadeFrom:0,fadeTo:1,label:'',arcSign:leftSide?1:-1});
      b.classList.remove('pulse');void b.offsetWidth;b.classList.add('pulse');
    }
  }
  return true;}
function cmResetLayers(){if(!objLayer)return;objLayer.querySelectorAll('.ob.cm-out, .ob.cm-live').forEach(b=>{
  const[hl,ht]=cmHome(b);b.style.transition='none';b.classList.remove('cm-out','offscene','lifting','cm-fly');
  b.style.left=hl+'%';b.style.top=ht+'%';cmClearXform(b);b.style.opacity='1';
  const tag=b.querySelector('.cmto');if(tag){tag.classList.remove('on');tag.textContent='';}
  cmPatchAway(b, !!b.dataset.dp);cmIdle(b,true);});}
function cmTicker(e,idx,n){const lab=cmLabel(e.object),pl=short(e.place||'');
  const line=$('cmove');if(line){line.textContent=`${lab} → ${pl} · move ${idx+1} of ${n}`;line.style.display=n?'':'none';}
  const meta=$('meta');if(meta&&(!scEv.length||scPaused))meta.textContent=`customer · move ${idx+1}/${n}`;}
function applyCustMove(e){if(!e)return Promise.resolve();const lab=cmLabel(e.object),full=e.place||'elsewhere',pl=short(full);
  if(pl&&!scNames.includes(pl))scNames.push(pl); if(typeof PFULL!=='undefined')PFULL[pl]=PFULL[pl]||full;
  cmPos[lab]=pl;
  if(scChars[lab]!==undefined)scChars[lab]=pl; else scObjs[lab]=pl;
  const xy=(e.x!=null&&e.y!=null)?{x:+e.x,y:+e.y}:null;
  const id=cmEnsure(lab,pl);if(id&&lastM){setReg(id,pl);pulse(lab);}
  return sceneAnim(lab,full,xy).then(()=>{});}
function cmEnqueue(job){cmQ.push(job);cmPump();}
async function cmPump(){if(cmBusy||scPaused)return;const job=cmQ.shift();if(!job)return;cmBusy=true;
  try{await job();}finally{
    cmBusy=false;
    if(scPaused)return;
    cmRestT=setTimeout(()=>{cmRestT=null;cmPump();}, CM_REDUCED?80:600);
  }}
function cmStep(){if(scPaused||!cmEv.length)return;const n=cmEv.length,idx=cmI%n;
  if(idx===0)cmEnqueue(async()=>{cmResetLayers();});
  const e=cmEv[idx];cmI++;const i=idx;
  cmEnqueue(async()=>{await applyCustMove(e);cmTicker(e,i,n);});}
function ensureCmTimer(){if(cmTimer)return;
  // cadence: only enqueue when the queue is short, so moves never stutter on top of each other
  cmTimer=setInterval(()=>{if(scPaused)return;if(cmQ.length>1||cmBusy)return;cmStep();}, CM_REDUCED?900:Math.max(CM_MS,2200));}
function cmAppend(e){if(!e||!e.object||!e.place)return false;const s=cmSig(e);if(cmSeen.has(s))return false;cmSeen.add(s);cmEv.push(e);syncPauseBtn();return true;}
async function loadDrags(){try{const D=await J('data/drags.json');DRAGS_RUN=D.run||null;const list=(D.events||[]).slice();
  if(!cmEv.length){cmEv=list;cmI=0;list.forEach(e=>cmSeen.add(cmSig(e)));syncPauseBtn();if(cmEv.length)cmStep();}
  else{list.forEach(e=>cmAppend(e));}}catch(e){}}
async function pollNtfyDrags(){if(!DRAG||!DRAG.endpoint||DRAG.transport!=='ntfy')return;
  try{const since=cmLastNtfy||'all';const url=DRAG.endpoint.replace(/\/?$/,'')+'/json?poll=1&since='+encodeURIComponent(since);
    const tx=await(await fetch(url,{cache:'no-store'})).text();
    for(const l of tx.split('\n')){if(!l)continue;let m;try{m=JSON.parse(l);}catch(e){continue;}
      if(m.event!=='message')continue;if(m.id)cmLastNtfy=m.id;
      let body;try{body=JSON.parse(m.message||'{}');}catch(e){continue;}
      if(!DRAG.key||body.key!==DRAG.key)continue;
      if(body.source==='qa'||(body.target&&body.target.source==='qa'))continue;
      let obj=body.object,place=body.place,target=body.target,x=body.x,y=body.y;
      if(target&&typeof target==='object'){obj=obj||target.object;place=place||target.place;if(x==null&&target.x!=null)x=target.x;if(y==null&&target.y!=null)y=target.y;}
      const at=(target&&target.at)||(m.time?new Date(m.time*1000).toISOString():new Date().toISOString());
      const e={at,object:cmLabel(obj||''),place:place||'',src:'ntfy',id:m.id};
      if(target!=null)e.target=target;if(typeof x==='number')e.x=x;if(typeof y==='number')e.y=y;
      if(cmAppend(e)){/* newly stacked — visible on next loop pass */}}}catch(e){}}
function noteLocalDrag(label,place,xy){const e={at:new Date().toISOString(),object:cmLabel(label),place,src:qaOn()?'qa':'local',source:qaOn()?'qa':'local'};
  if(xy&&typeof xy.x==='number')e.x=xy.x;if(xy&&typeof xy.y==='number')e.y=xy.y;
  if(qaOn()){ qaLog(e); return; }
  cmAppend(e);}
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
  for(const t of [set&&set.dir,set&&set.gif,set&&set.src])if(t&&OMAP[t])return [t,OMAP[t]]; // the scene's own frames dir first
  const ownLive=!!(set&&set.dir&&/webp\/live\//.test(set.dir));
  let k=mapKey(p); if(k)tries.push(k);
  const run=runOf(p)||runOf(set&&set.dir||'')||(set&&/^run-/.test(set.run||'')?set.run:'')||(ownLive?'':($('run').textContent||'').trim()); const j=p.match(/(?:^|\/)(j\d+)(?:\/|$|_|\.)/), g=p.match(/(?:^|\/)(g(\d+))\/?$/);
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
  if(objLayer){const old=objLayer;const st=$('stage'); if(st)[...st.children].forEach(n=>{ if(n.id==='objs'&&n!==old) n.remove(); }); old.classList.remove('on');old.classList.add('gone');setTimeout(()=>{if(old.isConnected)old.remove();},2600);objLayer=null;}
  const e=e0; if(!e)return;
  const L=document.createElement('div');L.id='objs';L._fs=e.frame_size||[480,270];L.dataset.key=k;
  (e.objects||[]).forEach((o,i)=>{const[x,y,w,h]=o.bbox;const box=document.createElement('div');
    box.className='ob'+(o.sprite?'':' anchor');Object.assign(box.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});
    box.dataset.sid=o.state_id||'';box.dataset.label=o.label;if(o.name){box.dataset.name=o.name;box.title=o.name;}
    if(o.sprite){ if(o.patch){const pa=new Image();pa.className='patch';pa.alt='';pa.src=o.patch;box.appendChild(pa);}
      const sp=new Image();sp.className='sp m-'+(/sandal|shoe|slipper/i.test(o.label)?'hop':(o.motion||'sway'));sp.alt=o.label;sp.src=o.sprite;sp.style.animationDelay=(-i*1.7)+'s';
      if(/door|street|window/i.test(o.label))sp.classList.add('small');
      const wr=document.createElement('div');wr.className='spw';wr.appendChild(sp);box.appendChild(wr);}
    else{const t=document.createElement('span');t.className='olab';t.textContent=o.label;box.appendChild(t);}
    if(o.draggable&&o.sprite){const pa=box.querySelector('.patch');if(pa){const ph=document.createElement('div');ph.className='ob dpatch';ph.dataset.label=o.label;Object.assign(ph.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});ph.appendChild(pa);L.appendChild(ph);}box.classList.add('dob');box.style.zIndex=String(3+Math.round((1-w*h)*20));box.dataset.id=(o.kind==='obj'?'o:':'c:')+o.label;const sv=DPOS[k+'|'+o.label];
      if(sv){box.style.left=sv[0]+'%';box.style.top=sv[1]+'%';box.dataset.dp='1';box.classList.add('away');const q=L.querySelector(`.dpatch[data-label="${CSS.escape(o.label)}"]`);if(q)q.classList.add('away');}}
    L.appendChild(box);});
  $('stage').insertBefore(L,$('cap')); objLayer=L; fitLayer(); applyPlaces();
  // stamp home positions for in-scene replay; if a customer-move place is already known, leave/arrive once
  L.querySelectorAll('.ob:not(.dpatch)').forEach(b=>{cmHome(b);cmIdle(b,true);});
  requestAnimationFrame(()=>{L.classList.add('on');Object.entries(cmPos).forEach(([lab,pl])=>cmEnqueue(async()=>{await sceneAnim(lab,pl,null);}));});
  if(Math.random()<0.5)setTimeout(()=>{if(objLayer===L)addVisitor(L,k);},4000+Math.random()*8000);}
// visitors (Jesuye 2026-11-10, "objects from one frame show up in other frames, keeps the stories interesting"):
// now and then one draggable cut-out from ANOTHER scene walks in from the nearer edge and stays (draggable) until the scene changes
function addVisitor(L,k){const pool=[];const seen=new Set();Object.entries(OMAP).forEach(([kk,v])=>{if(!v||seen.has(v)||kk===k||v===(OMAP[k]))return;seen.add(v);
    (v.objects||[]).forEach(o=>{if(o.sprite&&o.bbox&&o.bbox[2]*o.bbox[3]<0.12)pool.push([kk,v,o]);});});
  if(!pool.length||L.querySelector('.visitor'))return 'pool '+pool.length; const [vk,v,o]=pool[Math.floor(Math.random()*pool.length)];
  const [,,w,h]=o.bbox, x=8+Math.random()*(84-w*100), y=Math.max(22,Math.min(66,80-h*100));
  const box=document.createElement('div');box.className='ob dob visitor';Object.assign(box.style,{left:x+'%',top:y+'%',width:w*100+'%',height:h*100+'%',zIndex:'6'});
  const lab='visitor:'+o.label;box.dataset.label=lab;box.dataset.id='v:'+o.label;box.dataset.from=v.run?(v.run+(v.jN?' · '+v.jN:'')):vk;box.title=o.label+' (from '+box.dataset.from+')';
  const sp=new Image();sp.className='sp m-'+(o.motion||'sway');sp.alt=o.label;sp.src=o.sprite;
  const wr=document.createElement('div');wr.className='spw';wr.style.setProperty('--vx',(x+w*50<50?-1:1)*(160+Math.random()*80)+'%');wr.appendChild(sp);box.appendChild(wr);
  const t=document.createElement('span');t.className='vfrom';t.textContent='from '+box.dataset.from;box.appendChild(t);
  L.appendChild(box);cmHome(box);
  // the scene notices: once it has walked in, the cut-outs already here hop and turn toward it
  setTimeout(()=>{if(objLayer!==L||!box.isConnected)return;const vx=box.getBoundingClientRect().left;
    L.querySelectorAll('.dob:not(.visitor)').forEach((o,i)=>{const sp=o.querySelector('.sp');if(!sp)return;o.classList.remove('notice');void o.offsetWidth;o.style.setProperty('--face',o.getBoundingClientRect().left>vx?'-1':'1');setTimeout(()=>{o.classList.add('notice');setTimeout(()=>o.classList.remove('notice'),1300);},i*180);});},3400); // no spoken line: a random line rarely fits the scene (Jesuye 11-10: only say it if it works with the context)
  return box.title;}
window.thrydVisitor=()=>objLayer?addVisitor(objLayer,objLayer.dataset.key):'no layer';
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
window.thrydApplyPlaces=applyPlaces; window.thrydDebug=()=>{const st=$('stage'); const objs=[...((st&&st.children)||[])].filter(n=>n.id==='objs').length; return {run:CUR_RUN,pool:POOL.length,views:LXTRA.length,bg:bgSet&&bgSet.dir,mtime:bgSet&&bgSet.mtime,stageN,url:bgSet&&(bgSet.url||bgSet.src||''),viewUp,flipPending,cap:($('cap')&&$('cap').textContent)||'',stageKids:st?st.childElementCount:0,imgs:document.images.length,canvases:document.querySelectorAll('canvas').length,mcut:!!document.getElementById('mcut'),objs,decoded:viewCache.length,decodedMax:VIEW_CACHE_MAX,preloads:[...viewPre.values()].reduce((n,a)=>n+a.length,0)};};
if(QA_MODE){ window.thrydBackdrop=(set,force)=>backdrop(set,force); window.thrydBgSet=()=>bgSet; }
setInterval(()=>{if(!objLayer)return;const bs=[...objLayer.querySelectorAll('.ob')];if(bs.length){const b=bs[Math.floor(Math.random()*bs.length)];objChanged(b.dataset.sid||b.dataset.label);}},3000);
// LXTRA (data/live_extra.json): original unblurred live views, play as-is
// live loop = clean stills only (no baked terminal panel); replay-mode GIF frames stay out of it
// every posted live view of every run (exact posted GIF frames from data/live_extra.json, no cap); current run first, newest first.
// weighting: startSlide() interrupts on the current newest, then resumes the next library item.
function livePool(){const seen=new Set(),cur=[],oth=[];LXTRA.slice().sort((a,b)=>(b.mtime||0)-(a.mtime||0)).forEach(x=>{if(!x||!x.dir||seen.has(x.dir))return;seen.add(x.dir);(CUR_RUN&&x.run===CUR_RUN?cur:oth).push(x);});const k=oth.map(x=>x.dir).join('|');if(k!==SHUF.k){const a=oth.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}SHUF={k,a};}return cur.concat(SHUF.a);}
let SHUF={k:null,a:[]};
// caption counter: which of the N posted views is on screen
function viewTag(set){const i=POOL.findIndex(x=>x&&set&&x.dir===set.dir);return i<0?'':'  · view '+(i+1)+'/'+POOL.length;}
// no live view for the current run yet -> plain neutral stage (never another run's view)
function liveBackdrop(place){const nw=NEWEST();if(nw)return nw;neutralStage(place);return null;}
function neutralStage(place){if(bgSet&&bgSet.neutral)return;clearSwitchWait();queuedSet=null;outgoingSet=null;flipPending=false;clearInterval(bgTimer);bgSet={dir:'neutral',neutral:1};
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
function ticker(world,upd,meta){
  if(!viewUp||flipPending){ heldTicker=[world,upd,meta]; if(!viewUp){ const u=$('upd'); if(u){u.textContent='loading';u.style.opacity=1;} $('world').textContent=world||'—'; $('meta').textContent=meta||''; } return; }
  $('world').textContent=world||'';const u=$('upd');
  if(cutsHintOn){ u.textContent='loading cuts'; u.style.opacity=1; $('meta').textContent=meta||''; return; }
  u.style.opacity=0;
  setTimeout(()=>{ if(cutsHintOn) return; u.textContent=upd||'';u.style.opacity=1;},400);$('meta').textContent=meta||'';}
function pulse(name){const e=ents['o:'+name]||ents['c:'+name];if(e){e.classList.remove('pulse');void e.offsetWidth;e.classList.add('pulse');}}
let sinceBubble=0, nextBubble=4; window.CUR={lines:[],speakers:[]};
function maybeBubble(lines,speakers){ CUR.lines=lines; CUR.speakers=speakers; sinceBubble++; if(sinceBubble<nextBubble)return; sinceBubble=0; nextBubble=3+Math.floor(Math.random()*3);
  const L=choose(lines); if(!L||!speakers.length)return; say(L,speakers[Math.floor(Math.random()*speakers.length)]);
}
function choose(lines){const pool=lines.filter(l=>ok(l.line)); if(!pool.length)return null;
  // only official post embeds are ever shown, so prefer deck rows that can embed (decimal id, not purged)
  if(TDECK.length){for(let i=0;i<TDECK.length;i++){const t=TDECK[TI++%TDECK.length];if(t.id&&!t.purged&&ok(t.line))return t;}}
  const mv=pool.filter(l=>l.move); const src=(mv.length&&Math.random()<.3)?mv:pool; return src[Math.floor(Math.random()*src.length)];}
let TDECK=[],TI=0;
function say(L,who){ const e=ents['c:'+who]; if(!e)return;
  const r=e.getBoundingClientRect(), b=$('bubble'), right=e.classList.contains('r');
  // never write the speaker label or archive line: the bubble only ever holds the official embed
  const BW=160,BH=132,M=12; b.querySelector('.who').textContent=''; b.querySelector('.txt').textContent='';
  b.classList.toggle('r',right); let x=right?r.left-6:r.right+6; x=right?Math.max(BW+M,innerWidth*.75+BW,Math.min(innerWidth-M,x)):Math.max(M,Math.min(innerWidth*.25-BW,innerWidth-BW-M,x)); b.style.left=x+'px'; /* x clamp keeps it out of the scene's center half */
  b.style.top=Math.min(innerHeight-BH/2-M,Math.max(BH/2+M,r.top+r.height/2))+'px';
  const base=Math.min(Math.max(SLIDE*900,4000),7000); if(window.ThrydTweet)ThrydTweet.mount(b,L,base); else b.classList.remove('on');
}
const everyS=f=>{const g=gen;const run=()=>{const t=setTimeout(()=>{if(g!==gen)return;f();run();},SLIDE*1000);timers.push(t);};run();};
const every=(f,ms)=>{const g=gen;const t=setInterval(()=>{if(g===gen)f();},ms);timers.push(t);};
function reset(){gen++;timers.forEach(t=>{clearInterval(t);clearTimeout(t);});timers=[];Object.keys(ents).forEach(k=>{ents[k].remove();delete ents[k];});regionsKey='';$('bubble').classList.remove('on'); if(window.ThrydTweet)ThrydTweet.dismiss($('bubble'));}
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
async function bootColdFirst(st){
  // cold load: prefer a smaller ready cut pack so the first scene can decode and attach quickly (no ?mlib= pin)
  coldBooting=true;
  let set=NEWEST()||(POOL&&POOL[0])||liveBackdrop(st&&st.current_place);
  try{
    const man=window.ThrydMediumCuts?await ThrydMediumCuts.loadManifest():await J('data/medium_cuts.json');
    const ready=new Map((man.assets||[]).filter(a=>a&&a.status==='ready').map(a=>[a.medium_image_id,a]));
    let cands=(POOL||[]).filter(s=>s&&s.how==='medium'&&ready.has(s.medium_image_id));
    if(!cands.length) cands=(LXTRA||[]).filter(s=>s&&s.how==='medium'&&ready.has(s.medium_image_id));
    if(cands.length){
      const score=s=>{const a=ready.get(s.medium_image_id)||{}; const fs=a.frame_size||[1024,1024]; return (fs[0]||1024)*(fs[1]||1024)*((a.delays_cs||[1]).length);};
      cands.sort((a,b)=>score(a)-score(b));
      set=cands[0];
    }
  }catch(e){}
  try{
    if(!set) return;
    if(!slideCursor){poolI=Math.max(0,POOL.indexOf(set));slideCursor=set.dir||'';}
    backdrop(set,true);
  }finally{coldBooting=false;}
}
async function live(){
  reset(); const g=gen; $('mode').textContent='live';
  let s=null; try{s=await LIVE_STATE();}catch(e){}
  if(!s||!(s.characters||[]).length){return loopTimeline();}
  let last='', step=0, cur=s;
  let first=true; const apply=st=>{CUR_RUN=st.run||CUR_RUN;cur=st;trackObjs(st);if(!scEv.length){const m=fromState(st);render(m);}
    POOL=livePool(); if(first){first=false; if(!Q.get('mlib')) void bootColdFirst(st);}
    $('run').textContent=st.run||'';};
  apply(s);
  const lines=()=>[...(cur.moves||[]).flatMap(m=>(m.precisions||[]).map(p=>({line:p.line,src:'seat '+p.seat,move:/\[\[/.test(p.line)}))),...localPrec];
  const upd=()=>{if(scEv.length)return;const mv=(cur.moves||[]).slice(-10), re=(cur.recent_events||[]).slice(-6);
    const items=[...mv.map(m=>m.move),...re.filter(e=>!/^(cardgen|live_view|tick|export)/.test(e.ev||'')&&e.status).map(e=>`${e.card||''} ${e.ev} · ${e.status}`)];
    const it=(items.length?String(items[step++%items.length]):'waiting').replace(/ ?\(undefined\)/g,'');
    const away=bgSet&&bgSet.run&&cur.run&&bgSet.run!==cur.run; // on stage: a view from another agenda, so say so instead of this agenda's clock
    if(away)ticker(`from ${String(bgSet.run).replace(/^run-/,'agenda ')} · ${bgSet.card||''}`,'now playing: '+(cur.current_place||'')+' · '+(cur.story_time_label||''),`${cur.current_card} · state ${String(cur.exported_at||'').slice(11,16)} ET`);
    else ticker(cur.story_time_label,ok(it)?it:'move (cut away)',`${cur.current_card} · ${cur.seats||''} · state ${String(cur.exported_at||'').slice(11,16)} ET`);
    const m=fromState(cur); maybeBubble(lines(),m.chars.filter(c=>!c.off).map(c=>c.name).concat(m.chars.length?[]:[]).slice(0,4).length?m.chars.filter(c=>!c.off).map(c=>c.name):m.chars.map(c=>c.name));};
  upd(); everyS(upd);
  every(async()=>{try{const n=await LIVE_STATE();if(g!==gen)return;const k=JSON.stringify([n.current_place,n.characters,n.objects,n.current_card,n.seated_count]);
      if(n.characters&&n.characters.length){if(k!==last&&last){(n.objects||[]).forEach(o=>pulse(o.label));} last=k; apply(n);}}catch(e){}},POLL);
}
// ---------- fallback: loop data/timeline.json
async function loopTimeline(){
  const g=gen; await loadTimeline(); if(!TL.events.length){ticker('','no state.json or timeline.json yet','');return;}
  $('mode').textContent='live · timeline'; $('run').textContent=TL.run||''; CUR_RUN=TL.run;
  POOL=livePool();
  if(POOL.length){poolI=0;backdrop(POOL[0],true);}
  else{const e0=TL.events[0];bindScene({card:e0.scene||e0.card,label:e0.label});}
  every(async()=>{if(g!==gen)return;await loadTimeline();},30000);
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
    if(rm.length){const mi=rm.find(x=>x.card===f.card)||rm[Math.floor(cards.indexOf(f.card)*rm.length/Math.max(1,cards.length))]||rm[0];backdrop(Object.assign({label:`${want} · ${mi.card||''}`,card:mi.card||f.card},mi));POOL=rm;}
    else if(f.card) bindScene({card:f.card,label:want+' · '+f.card});
    if(scEv.length){i++;return;}
    render({regions,here,chars:(cast.length?cast:[]).slice(0,6).map(n=>({name:n,region:here})),objs:[]});
    const ls=f.latest_seat; const lab=f.kind==='seat'&&ls?`seat ${ls.seat} seated on ${ls.card}`:`${f.card||''} ${f.event||''}${f.status?' · '+f.status:''}`;
    ticker(String(f.t||'').replace('T',' ').slice(0,16)+' ET',lab,`${want} · update ${i%fr.length+1}/${fr.length} · ${f.seated_count||0} seated`);
    maybeBubble(prec,cast.slice(0,6)); i++; };
  step(); everyS(step);
}
window.thrydSay=say; window.thrydChoose=choose;
// ---------- UI
function setMode(m){if(m!=='live'&&m!=='replay'&&m!=='cerebro'&&m!=='lovemap')m='live';
  MODE=m;Q.set('mode',m);history.replaceState(null,'','?'+Q.toString());
  document.querySelectorAll('#modes button[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('pick').style.display=m==='replay'?'':'none';
  document.body.classList.remove('cerebro','lovemap');stopCerebro();stopLovemap();
  if(m==='cerebro'){bgSet=null;clearScene();document.body.classList.add('cerebro');startCerebro();return;}
  if(m==='lovemap'){bgSet=null;clearScene();document.body.classList.add('lovemap');startLovemap();return;}
  // keep a first scene already started (mlib pin or cold-first pack); wiping bgSet kills the 4s cut-wait cap
  if(!(m==='live'&&bgSet&&(Q.get('mlib')||(typeof libPin!=='undefined'&&libPin.pinned&&libPin.pinned())||viewUp))){ bgSet=null;clearScene(); }
  (m==='replay'?replay:live)();}
document.querySelectorAll('#modes button[data-m]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();libPin.clear();slideCycle.reset();slideCursor='';setMode(b.dataset.m);});
// ---------- CEREBRO
let CERE={items:[],poll:null,ids:'',lit:null};
function stopCerebro(){if(CERE.poll){clearInterval(CERE.poll);CERE.poll=null;}
  const w=$('cwall');if(w)w.innerHTML='';closeCere();CERE.ids='';}
function startCerebro(){const md=$('mode'),rn=$('run');if(md)md.textContent='cerebro';if(rn)rn.textContent='all';
  loadCerebro(true);if(!CERE.poll)CERE.poll=setInterval(()=>loadCerebro(false),30000);}
async function loadCerebro(first){let data;try{data=await J('data/cerebro.json');}catch(e){return;}
  const items=data.items||[];const ids=items.map(x=>x.id).join('|');
  if(ids===CERE.ids&&!first)return;const prev=new Set((CERE.items||[]).map(x=>x.id));
  CERE.items=items;CERE.ids=ids;renderCerebro(first?new Set():prev);}
function renderCerebro(prevIds){const wall=$('cwall');if(!wall)return;wall.innerHTML='';
  const items=CERE.items||[];const fresh=new Set(items.slice(0,8).map(x=>x.id));
  items.forEach((it,i)=>{const t=document.createElement('button');t.type='button';
    t.className='ctile'+(fresh.has(it.id)&&!prevIds.has(it.id)?' fresh':'');
    t.style.setProperty('--d',((i*37)%11-5)+'px');t.style.setProperty('--e',((i*19)%9-4)+'px');
    t.style.setProperty('--t',(16+(i*5)%16)+'s');t.style.setProperty('--k',((i*13)%10)+'s');
    const img=document.createElement('img');img.loading='lazy';img.alt=it.label||it.kind||'';
    img.src=it.path;t.appendChild(img);
    t.onclick=ev=>{ev.stopPropagation();openCere(it);};wall.appendChild(t);});}
function openCere(it){const box=$('clight'),img=$('climg'),cap=$('clcap');if(!box||!img)return;
  if(box.classList.contains('on')&&CERE.lit&&CERE.lit.id===it.id){closeCere();return;}
  closeCere();CERE.lit={id:it.id,i:0,timer:null};
  const capText=(it.label||it.kind||'')+(it.room?' · '+it.room:'');if(cap)cap.textContent=capText;
  if(it.frame_dir&&(it.frames|0)>1){const n=it.frames|0,durs=it.durs||[];
    const tick=()=>{if(!CERE.lit||CERE.lit.id!==it.id)return;
      img.src=it.frame_dir+'/f'+String(CERE.lit.i).padStart(3,'0')+'.webp';
      const ms=Math.max(40,durs[CERE.lit.i]||100);CERE.lit.i=(CERE.lit.i+1)%n;
      CERE.lit.timer=setTimeout(tick,ms);};tick();}
  else img.src=it.path;
  box.classList.add('on');box.onclick=ev=>{ev.stopPropagation();closeCere();};}
function closeCere(){if(CERE.lit&&CERE.lit.timer)clearTimeout(CERE.lit.timer);CERE.lit=null;
  const box=$('clight');if(box)box.classList.remove('on');}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('cerebro')&&$('clight')&&$('clight').classList.contains('on')){e.preventDefault();closeCere();}});
// ---------- LOVEMAP
function stopLovemap(){const f=$('lmframe');if(f){f.src='about:blank';}const box=$('lovemap');if(box)box.setAttribute('aria-hidden','true');}
function startLovemap(){const md=$('mode'),rn=$('run');if(md)md.textContent='lovemap';if(rn)rn.textContent='map';
  const box=$('lovemap'),f=$('lmframe');if(box)box.setAttribute('aria-hidden','false');
  if(f)f.src='assets/lovemap.html?t='+Date.now();}

const _rp=$('rpause'); if(_rp)_rp.onclick=ev=>{ev.stopPropagation();if(!scEv.length&&!cmEv.length)return;scPaused=!scPaused;document.body.classList.toggle('cm-paused',scPaused);syncPauseBtn();if(!scPaused){if(scEv.length)sceneStep();cmPump();if(cmEv.length&&!cmBusy&&!cmQ.length)cmStep();}else{if(cmRestT){clearTimeout(cmRestT);cmRestT=null;}}};
$('pick').onclick=e=>e.stopPropagation();
$('pick').onchange=e=>{Q.set('run',e.target.value);history.replaceState(null,'','?'+Q.toString());reset();replay();};
const fs=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();};
document.addEventListener('click',fs); document.addEventListener('keydown',e=>{if(e.key==='f'||e.key==='F')fs();});
let idleT;const wake=()=>{document.body.classList.remove('idle');clearTimeout(idleT);idleT=setTimeout(()=>document.body.classList.add('idle'),3000);};addEventListener('mousemove',wake);addEventListener('keydown',wake);wake();
addEventListener('resize',()=>{regionsKey='';});
(async()=>{
  try{media=await J('data/media.json');}catch(e){}
  try{LXTRA=(await J('data/live_extra.json')).sets||[];}catch(e){}
  POOL=livePool();
  if(MODE==='live'&&!Q.get('mlib')&&!bgSet) void bootColdFirst(null);
  await loadOmap(); await loadRGifs(); setTimeout(()=>{if(MODE==='live'&&NEWEST()&&!Q.get('mlib')&&!coldBooting&&!viewUp&&!bgSet){const nw=NEWEST();POOL=livePool();if(!slideCursor){poolI=Math.max(0,POOL.indexOf(nw));slideCursor=nw.dir||'';}backdrop(nw,true);}},2500); setInterval(async()=>{if(MODE==='live'){loadOmap();loadRGifs();try{const n=(await J('data/live_extra.json?t='+Date.now())).sets||[];const o=NEWEST();LXTRA=n;const nw=NEWEST();POOL=livePool();if(nw&&(!o||o.dir!==nw.dir||o.mtime!==nw.mtime)){backdrop(nw,true);}}catch(e){}}},60000);
  const ss=$('slide');if(ss){ss.value=String(SLIDE);ss.onclick=e=>e.stopPropagation();ss.onchange=e=>{SLIDE=+e.target.value;if(window.ThrydKeep)try{ThrydKeep.saveSettings({slide:SLIDE});}catch(err){}else try{localStorage.setItem('thryd_slide',SLIDE);}catch(err){}Q.set('slide',SLIDE);history.replaceState(null,'','?'+Q.toString());startSlide();};}
  const ml=$('mlib'); if(ml){ml.onclick=e=>e.stopPropagation(); const go=e=>{if(e.type==='keydown'&&e.key!=='Enter')return; e.stopPropagation(); const q=ml.value.trim(); if(!q){libPin.clear();slideCycle.reset();return;} const hit=window.thrydLibrary&&thrydLibrary.show(q); if(!hit){$('cap').textContent='library · not in inventory';}}; ml.addEventListener('keydown',go); ml.addEventListener('change',go);}
  const choice=window.ThrydKeep?ThrydKeep.stageChoice(Q.get('mlib'),ThrydKeep.settings().lastGif,Q.get('resume')==='1'):{id:Q.get('mlib')||null,why:Q.get('mlib')?'query':'live'}; if(choice.id&&ml){ml.value=choice.id; const hit=window.thrydLibrary&&thrydLibrary.show(choice.id); if(!hit){$('cap').textContent='library · not in inventory';}}
  const kr=$('kresume'); if(kr){kr.onclick=e=>{e.stopPropagation(); const id=window.ThrydKeep&&ThrydKeep.settings().lastGif; if(!id){if($('cap'))$('cap').textContent='library · nothing remembered'; return;} if(ml)ml.value=id; const hit=window.thrydLibrary&&thrydLibrary.show(id); if(!hit&&$('cap'))$('cap').textContent='library · not in inventory';};}
  const kz=$('kreset'); if(kz){kz.onclick=async e=>{e.stopPropagation(); if(window.ThrydKeep)try{await ThrydKeep.resetLocal();}catch(err){} const layer=document.getElementById('mcut'); if(layer&&layer._off)layer._off=layer._off.map(()=>({x:0,y:0})); if(ml&&!Q.get('mlib'))ml.value=''; libPin.clear(); slideCycle.reset(); if($('cap'))$('cap').textContent='device cache cleared';};}
  const mu=$('mute'); if(mu){mu.addEventListener('click',()=>{if(!window.ThrydKeep)return; const off=String(mu.textContent||'').indexOf('off')>=0; try{ThrydKeep.saveSettings({mute:off?1:0});}catch(err){}});}
  try{(await J('assets/runs/media.json')).runs.forEach(r=>runMedia[r.run]=r.media);}catch(e){}
  try{localPrec=(await J('data/precisions.json')).map(p=>({line:p.line,src:p.src,move:p.move}));}catch(e){}
  try{const T=(await J('data/tweets_all.json')).map(p=>window.ThrydTweet?ThrydTweet.deckRow(p):{line:p.line,src:p.src,move:false});for(let i=T.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[T[i],T[j]]=[T[j],T[i]];}TDECK=T;TI=0;}catch(e){}
  await loadTimeline(); ensureSceneTimer(); setInterval(()=>{loadTimeline();},30000);
  await loadDrags(); ensureCmTimer(); setInterval(()=>{loadDrags();},60000);
  setInterval(()=>{pollNtfyDrags();},30000); setTimeout(()=>{pollNtfyDrags();},2500);
  setMode(MODE);
})();
// ---------- drag a chip onto a place heading -> <object>.setlocation(<place>) via data/drag.json endpoint
let DRAG=null; (async()=>{try{DRAG=await J('data/drag.json?t='+Date.now());}catch(e){}})();
function toast(msg,bad){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}
  t.textContent=msg;t.className=bad?'bad on':'on';clearTimeout(t._h);t._h=setTimeout(()=>t.className='',2600);}
window.thrydCtx=()=>({toast,DRAG,PFULL:typeof PFULL!=='undefined'?PFULL:{},lastM:typeof lastM!=='undefined'?lastM:null}); // prophecy module lives outside this scope
function setReg(id,r){if(!lastM)return;const nm=id.slice(2);(id[0]==='c'?lastM.chars:lastM.objs).forEach(x=>{if((x.name||x.label)===nm){x.region=r;if(x.off!==undefined)x.off=r!==lastM.here;}});
  if(!lastM.regions.includes(r))lastM.regions.push(r);place(lastM);}
function qaOn(){ return QA_MODE||!!(typeof window!=='undefined'&&window.__THRYD_QA); }
function qaLog(rec){
  const row=Object.assign({source:'qa', at:rec&&rec.at||new Date().toISOString()}, rec||{});
  row.source='qa';
  try{ const k='thryd_qa_log'; const a=JSON.parse(localStorage.getItem(k)||'[]'); a.push(row); localStorage.setItem(k, JSON.stringify(a.slice(-200))); }catch(e){}
  try{ window.__THRYD_QA_LOG=window.__THRYD_QA_LOG||[]; window.__THRYD_QA_LOG.push(row); }catch(e){}
  try{ console.info('[thryd-qa]', row); }catch(e){}
  try{ const u=window.__THRYD_QA_LOG_URL; if(u) fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)}).catch(()=>{}); }catch(e){}
  return row;
}
// prophecy / zoom IIFEs sit outside the main closure — they must use the window handle
window.thrydQA={on:qaOn, log:qaLog, file:'thryd_qa_log', field:'source'};
async function dragSend(body){
  if(qaOn()){ qaLog({kind:'dragSend', ...body, source:'qa'}); return {ok:true, qa:true, skipped:'customer-endpoint'}; }
  if(DRAG.transport!=='ntfy'){const r=await fetch(DRAG.endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));return {status:r.status,...j};}
  const rid=Math.random().toString(36).slice(2,12), t0=Math.floor(Date.now()/1000)-5;
  const r=await fetch(DRAG.endpoint,{method:'POST',body:JSON.stringify({...body,rid})});if(!r.ok)throw new Error('relay HTTP '+r.status);
  for(let i=0;i<20;i++){await new Promise(z=>setTimeout(z,1500));
    try{const tx=await (await fetch(DRAG.reply+'/json?poll=1&since='+t0,{cache:'no-store'})).text();
      for(const l of tx.split('\n')){if(!l)continue;let m;try{m=JSON.parse(l);m=JSON.parse(m.message||'{}');}catch(e){continue;}if(m.rid===rid)return m;}}catch(e){}}
  throw new Error('no reply from box (timeout)');}
async function dropTo(id,from,to,xy){
  if(!DRAG||!DRAG.endpoint){toast('drag endpoint not available',1);return;}
  const label=id.slice(2); PEND[id]={region:to,until:Date.now()+8*60e3}; setReg(id,to); toast(`moving ${label} → ${to}…`);
  const tg=window.thrydTarget&&thrydTarget.make(label,PFULL[to]||to,{type:'chip',id,place:to,...(xy||{})});
  if(tg&&qaOn()) tg.source='qa';
  const body={key:DRAG.key,object:label,place:PFULL[to]||to,...(tg?{target:tg}:{}),...(qaOn()?{source:'qa'}:{})};
  if(xy&&typeof xy.x==='number'){body.x=xy.x;body.y=xy.y;}
  try{const j=await dragSend(body);if(!j.ok)throw new Error(j.error||('HTTP '+j.status));toast(`${label} → ${to} ✓`);pulse(label);noteLocalDrag(label,PFULL[to]||to,xy);}
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


// ---------- autonomous motion (Jesuye 11-10: "make the objects naturally move themselves ... if they've been dragged, they should move using the established trajectory")
// undragged people: small eased drifts around home with random pauses; static props only keep their sway. Dragged: replay the recorded drag path
// (back to its start, pause, forward to the drop) or, with only a drop point, an arc home -> drop. Paused while dragging / Pause / cerebro / hidden tab;
// off for prefers-reduced-motion. Customer moves (cm-live / cm-fly / cm-out) own their box and are skipped.
const DPATH=(()=>{try{return JSON.parse(localStorage.getItem('thryd_dpath')||'{}');}catch(e){return {};}})();
function saveDPath(k,lab,path){if(!k||!path||path.length<2)return;DPATH[k+'|'+lab]=path;const ks=Object.keys(DPATH);if(ks.length>80)delete DPATH[ks[0]];try{localStorage.setItem('thryd_dpath',JSON.stringify(DPATH));}catch(e){}}
function thinPath(p,n){n=n||24;if(p.length<=n)return p.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]);const o=[];for(let i=0;i<n;i++){const q=p[Math.round(i*(p.length-1)/(n-1))];o.push([+q[0].toFixed(2),+q[1].toFixed(2)]);}return o;}
const WS=new WeakMap();
const wPaused=()=>scPaused||document.hidden||document.body.classList.contains('dragmode')||document.body.classList.contains('cerebro')||document.body.classList.contains('lovemap');
const wOwned=b=>b.dataset.held==='1'||['lifting','cm-fly','cm-live','cm-out','visitor'].some(c=>b.classList.contains(c));
const wPerson=b=>(b.dataset.id||'').startsWith('c:')&&!/stall|sign|table|tray|cooler|stool|bench|shelter|door|street|window|lamp|board|umbrella|car|bus|danfo|wall|tree/i.test(b.dataset.label||'');
const wRoam=b=>!/stall|sign|table|shelter|door|street|window|board|wall|tree|gate|house|building|kiosk/i.test(b.dataset.label||'');
function wFace(b,dx){return; /* Jesuye 11-10: no sudden left/right flips; cut-outs keep the way they face */ const w=b.querySelector('.spw');if(!w||Math.abs(dx)<0.6||Math.random()>0.4)return;  // an occasional turn as it sets off
  const nf=b.dataset.flip==='1'?'':'1';b.dataset.flip=nf;w.style.scale=nf?'-1 1':'';}
// glide along points [[l,t],...] in layer %, total eased, ~pace %/s; holds while paused, aborts if something else takes the box
function wGlide(b,pts,pace){return new Promise(res=>{const L=b.parentNode;if(!L||pts.length<2){res(false);return;}
  const seg=[];let tot=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(d);tot+=d;}
  if(tot<0.05){res(false);return;}const dur=Math.max(1600,tot/(pace||2.2)*1000);let el=0,last=performance.now();
  const step=now=>{if(!b.isConnected||b.parentNode!==objLayer||wOwned(b)){res(false);return;}
    const dt=now-last;last=now;if(!wPaused())el+=Math.min(dt,100);const u=CM_EASE(Math.min(1,el/dur));let want=u*tot,i=0;
    while(i<seg.length-1&&want>seg[i]){want-=seg[i];i++;}const f=seg[i]?Math.min(1,want/seg[i]):1;
    b.style.left=(pts[i][0]+(pts[i+1][0]-pts[i][0])*f).toFixed(3)+'%';b.style.top=(pts[i][1]+(pts[i+1][1]-pts[i][1])*f).toFixed(3)+'%';
    if(el>=dur){res(true);return;}requestAnimationFrame(step);};requestAnimationFrame(step);});}
function wArc(a,c,n){const o=[],dx=c[0]-a[0],dy=c[1]-a[1],len=Math.hypot(dx,dy)||1,bend=Math.min(6,len*.18)*(Math.random()<.5?-1:1);
  for(let i=0;i<=n;i++){const u=i/n,s=Math.sin(Math.PI*u)*bend;o.push([a[0]+dx*u-dy/len*s*.4,a[1]+dy*u+Math.abs(s)*-.35]);}return o;}
async function wMove(b){const st=WS.get(b)||{};st.busy=true;WS.set(b,st);const L=b.parentNode,k=L&&L.dataset.key,lab=b.dataset.label;
  const[hl,ht]=cmHome(b),bw=parseFloat(b.style.width)||1,bh=parseFloat(b.style.height)||1,cur=[parseFloat(b.style.left)||0,parseFloat(b.style.top)||0];
  const cl=(l,t)=>visClamp(L,l,Math.min(t,ht+0.5),bw,bh);let ok=false;
  try{if(b.dataset.dp){const drop=DPOS[k+'|'+lab]||cur,path=DPATH[k+'|'+lab];
      const vc=q=>visClamp(L,q[0],q[1],bw,bh),fwd=path&&path.length>=2?path.map(vc):wArc([hl,ht],drop,10).map(vc);fwd[fwd.length-1]=drop;
      const back=fwd.slice().reverse();back[0]=cur;wFace(b,back[back.length-1][0]-cur[0]);
      if(await wGlide(b,back,2.6)){await new Promise(z=>setTimeout(z,900+Math.random()*1800));if(!wOwned(b)){wFace(b,drop[0]-fwd[0][0]);ok=await wGlide(b,fwd,2.4);}}
    }else if(wRoam(b)){const away=Math.hypot(cur[0]-hl,cur[1]-ht),home=away>8&&Math.random()<0.25;
      // travel across the frame (Jesuye 11-10: move around the frame, not rock in place)
      const to=home?[hl,ht]:visClamp(L,4+Math.random()*(92-bw),ht+(Math.random()*5-3),bw,bh);
      wFace(b,to[0]-cur[0]);cmPatchAway(b,true);
      ok=await wGlide(b,[cur,[(cur[0]+to[0])/2,Math.min(cur[1],to[1])-0.6],to],(wPerson(b)?2.2:1.6)+Math.random()*1.2);
      if(home&&ok&&!wOwned(b)){b.style.left=hl+'%';b.style.top=ht+'%';cmPatchAway(b,false);}}
  }finally{st.busy=false;st.next=performance.now()+(b.dataset.dp?14000+Math.random()*16000:1500+Math.random()*4000);}return ok;}
setInterval(()=>{if(CM_REDUCED||!objLayer||wPaused())return;const now=performance.now();
  objLayer.querySelectorAll('.dob').forEach(b=>{if(wOwned(b))return;let st=WS.get(b);if(!st){st={next:now+1500+Math.random()*6000};WS.set(b,st);}
    if(st.busy||now<st.next)return;if(!b.dataset.dp&&!wRoam(b)){st.next=now+60000;return;}wMove(b);});},700);
window.thrydWander={paths:()=>DPATH,move:b=>wMove(b),state:b=>WS.get(b)};
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
    try{const px=c.getContext('2d').getImageData(Math.floor((b.dataset.flip==='1'?(r.right-x):(x-r.left))/r.width*c.width),Math.floor((y-r.top)/r.height*c.height),1,1).data;return px[3]>40;}catch(e){return true;}};
  const pickDob=(x,y)=>{const u=[...new Set(document.elementsFromPoint(x,y).map(e=>e.closest&&e.closest('#objs:not(.gone) .dob')).filter(Boolean))];return u.find(b=>opaque(b,x,y))||null;};
  document.addEventListener('pointerdown',ev=>{const b0=ev.target.closest&&ev.target.closest('#objs:not(.gone) .dob');const pk=b0?pickDob(ev.clientX,ev.clientY):null;if(b0&&!pk&&window.thrydZoom&&thrydZoom.get().z>1)return; /* zoomed: transparent bbox area pans */const b=b0?(pk||b0):null;if(!b||d)return;if(ev.pointerType==='mouse'&&ev.button!==0)return;
    ev.preventDefault();ev.stopPropagation();window.thrydHold(60000);const r=b.getBoundingClientRect();
    b.dataset.held='1';d={b,pid:ev.pointerId,x:ev.clientX,y:ev.clientY,l0:parseFloat(b.style.left),t0:parseFloat(b.style.top),on:false,path:[[parseFloat(b.style.left),parseFloat(b.style.top)]],pt:0};try{b.setPointerCapture(ev.pointerId);}catch(e){}},{passive:false,capture:true});
  document.addEventListener('pointermove',ev=>{if(!d||ev.pointerId!==d.pid)return;const dx=ev.clientX-d.x,dy=ev.clientY-d.y;
    if(!d.on){if(dx*dx+dy*dy<25)return;d.on=true;d.b.classList.add('lifting','away');{const q=d.b.parentNode.querySelector(`.dpatch[data-label="${CSS.escape(d.b.dataset.label)}"]`);if(q)q.classList.add('away');}document.body.classList.add('dragmode');d.b.parentNode.appendChild(d.b);}
    ev.preventDefault();const L=d.b.parentNode.getBoundingClientRect();d.b.style.left=(d.l0+dx/L.width*100)+'%';d.b.style.top=(d.t0+dy/L.height*100)+'%';{const n=performance.now();if(n-d.pt>45&&d.path.length<400){d.pt=n;d.path.push([parseFloat(d.b.style.left),parseFloat(d.b.style.top)]);}}
    clr();const h=hit(ev.clientX,ev.clientY);if(h)h.classList.add('drop');},{passive:false});
  const end=ev=>{if(!d||ev.pointerId!==d.pid)return;const dd=d;d=null;try{dd.b.releasePointerCapture(dd.pid);}catch(e){}delete dd.b.dataset.held;
    dd.b.classList.remove('lifting');document.body.classList.remove('dragmode');clr();if(!dd.on){window.thrydHold(0);return;}
    window.thrydHold(30000);const Lp=dd.b.parentNode,k=Lp&&Lp.dataset.key;const[cl,ct]=visClamp(Lp,parseFloat(dd.b.style.left),parseFloat(dd.b.style.top),parseFloat(dd.b.style.width),parseFloat(dd.b.style.height));
    dd.b.style.left=cl+'%';dd.b.style.top=ct+'%';dd.b.dataset.dp='1';DPOS[k+'|'+dd.b.dataset.label]=[+cl.toFixed(3),+ct.toFixed(3)];dd.path.push([cl,ct]);const dpath=thinPath(dd.path.map(q=>visClamp(Lp,q[0],q[1],parseFloat(dd.b.style.width),parseFloat(dd.b.style.height))),24);saveDPath(k,dd.b.dataset.label,dpath);{const w=WS.get(dd.b);if(w)w.next=performance.now()+9000;}
    try{localStorage.setItem('thryd_dpos',JSON.stringify(DPOS));}catch(e){}
    const h=hit(ev.clientX,ev.clientY),id=dd.b.dataset.id,from=regOf(id);if(!h){toast('dropped in the scene — drop on a place name to move them');if(window.thrydTarget)thrydTarget.scene(dd.b,k,cl,ct,dpath);noteLocalDrag(dd.b.dataset.label,(window.thrydCtx&&thrydCtx().lastM&&thrydCtx().PFULL[thrydCtx().lastM.here])||'',{x:+cl.toFixed(3),y:+ct.toFixed(3)});return;}
    if(h.dataset.name===from){toast(`${id.slice(2)} is already at ${from}`);return;}
    dropTo(id,from,h.dataset.name,{x:+cl.toFixed(3),y:+ct.toFixed(3)});};
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
  addEventListener('wheel',ev=>{const t=ev.target;if(t.closest&&t.closest('#bar,#zoomui,#user,select,#cerebro,#lovemap'))return;ev.preventDefault();zoomAt(z*Math.exp(-ev.deltaY*(ev.ctrlKey?0.01:0.0015)),ev.clientX,ev.clientY);},{passive:false});
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
  // iOS Safari: stop native page zoom, and pinch via touch events (pointer pinch gets cancelled when Safari claims the gesture)
  ['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
  let tp=null;const td=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY)||1;
  document.addEventListener('touchstart',e=>{if(e.touches.length===2&&!onItem(e.target)){tp={d:td(e.touches),z0:z};e.preventDefault();}},{passive:false});
  document.addEventListener('touchmove',e=>{if(tp&&e.touches.length===2){e.preventDefault();if(pinch)return;const t=e.touches;moved=1;st._nofs=Date.now();zoomAt(tp.z0*td(t)/tp.d,(t[0].clientX+t[1].clientX)/2,(t[0].clientY+t[1].clientY)/2);}},{passive:false});
  document.addEventListener('touchend',e=>{if(e.touches.length<2)tp=null;});
  document.addEventListener('dblclick',ev=>{if(onItem(ev.target))return;reset();st._nofs=Date.now();});
  // a pan/pinch/double-tap must not toggle fullscreen via the document click handler
  document.addEventListener('click',ev=>{if(st._nofs&&Date.now()-st._nofs<500)ev.stopImmediatePropagation();},true);
  const ui=document.createElement('div');ui.id='zoomui';ui.innerHTML='<button data-z="-" title="zoom out">−</button><span id="zlvl">1.0×</span><button data-z="+" title="zoom in">+</button><button data-z="0" title="reset zoom">⟲</button>';
  ui.addEventListener('click',ev=>{ev.stopPropagation();const b=ev.target.closest('button');if(!b)return;const cx=st.offsetLeft+st.clientWidth/2,cy=st.offsetTop+st.clientHeight/2;
    if(b.dataset.z==='0')reset();else zoomAt(z*(b.dataset.z==='+'?1.25:0.8),cx,cy);});
  ui.addEventListener('dblclick',ev=>ev.stopPropagation());
  document.body.appendChild(ui);addEventListener('resize',apply);apply();})();

// ---------- prophecies (contract: Chief of Staff cd521af). Every drag = open-ended #thryd.miracle.target(assert(<object>.place == "<place>")).
// Page records drags + draws ghosts; ONLY state.miracles {open:[],fulfilled:[],error?} decides open/fulfilled. miracles.error -> show nothing.
(function(){const LS='thryd_targets',SEEN='thryd_targets_seen';
  const qaOn=()=>window.thrydQA&&window.thrydQA.on();
  const qaLog=rec=>window.thrydQA&&window.thrydQA.log(rec);
  const T=()=>{try{return JSON.parse(localStorage.getItem(LS)||'[]');}catch(e){return [];}};const save=a=>{try{localStorage.setItem(LS,JSON.stringify(a.slice(-60)));}catch(e){}};
  const seen=new Set((()=>{try{return JSON.parse(localStorage.getItem(SEEN)||'[]');}catch(e){return [];}})());
  const mark=k=>{seen.add(k);try{localStorage.setItem(SEEN,JSON.stringify([...seen].slice(-200)));}catch(e){}};
  let st=null,M={open:[],fulfilled:[],error:null};
  const n=x=>String(x||'').toLowerCase().replace(/^the\s+/,'').replace(/\s+/g,' ').trim();
  const toks=x=>n(x).split(/[\/,]| ~ /).map(s=>s.trim()).filter(Boolean);
  const objEq=(a,b)=>{a=n(a);b=n(b);if(!a||!b)return false;if(a===b)return true;const A=toks(a),B=toks(b);return A.some(x=>B.includes(x))||A.some(x=>b.startsWith(x+'/'))||B.some(x=>a.startsWith(x+'/'));};
  const plEq=(a,b)=>{a=n(a);b=n(b);return !!a&&!!b&&(a===b||a.includes(b)||b.includes(a));};
  const asrt=(o,p)=>`${o}.place == "${p}"`; const MT=(o,p)=>`#thryd.miracle.target(assert(${asrt(o,p)}))`;
  const labelOf=o=>{const L=(st&&st.objects||[]).map(x=>x.label).concat((st&&st.characters||[]).map(c=>c.name));return L.find(l=>objEq(l,o))||o;};
  const headFor=p=>[...document.querySelectorAll('#map .ph')].find(h=>plEq(h.dataset.name,p)||(window.thrydCtx&&plEq(thrydCtx().PFULL[h.dataset.name],p)));
  function make(label,place,ghost,near){const t={kind:'miracle.target',object:label,place,...(near?{near}:{}),assert:asrt(label,place),run:(st&&st.run)||(typeof CUR_RUN!=='undefined'?CUR_RUN:'')||'',j:(st&&st.current_card)||'',at:new Date().toISOString(),...(qaOn()?{source:'qa'}:{})};
    if(qaOn()){ qaLog({kind:'miracle.target', target:t, ghost, source:'qa'}); return t; }
    const a=T().filter(x=>!(objEq(x.object,label)&&x.status==='open'));a.push({...t,status:'open',ghost:{...ghost,label}});save(a);draw();setTimeout(()=>pchip(t,ghost),60);return t;}
  // contact on drop (Jesuye 11-10: drags are tracked foreshadows; the server adds them to <run>/foreshadows.json, foreshadow.py checks the story)
  // kiss = top 30% (heads) of both boxes overlap; touch = boxes overlap; next to = no overlap, gap < 6% of the scene width
  function contact(b,L){const R=b.getBoundingClientRect(),LR=L.getBoundingClientRect(),hd=r=>({l:r.left,r:r.right,t:r.top,b:r.top+(r.bottom-r.top)*.3});
    const ov=(a,c)=>Math.max(0,Math.min(a.r,c.r)-Math.max(a.l,c.l))*Math.max(0,Math.min(a.b,c.b)-Math.max(a.t,c.t));const box=r=>({l:r.left,r:r.right,t:r.top,b:r.bottom});
    const A=(R.right-R.left)*(R.bottom-R.top)||1;let best=null;
    L.querySelectorAll('.ob:not(.dpatch)').forEach(o=>{if(o===b||o.classList.contains('visitor'))return;const r=o.getBoundingClientRect(),B=(r.right-r.left)*(r.bottom-r.top)||1;
      const v=ov(box(R),box(r)),h=ov(hd(R),hd(r)),hmin=Math.min(A,B)*.3,gap=Math.max(0,Math.max(R.left,r.left)-Math.min(R.right,r.right),Math.max(R.top,r.top)-Math.min(R.bottom,r.bottom))/(LR.width||1);
      const c={with:o.dataset.name||o.dataset.label,with_cut:o.dataset.label,overlap:+(v/Math.min(A,B)).toFixed(3),head_overlap:+(h/hmin).toFixed(3),gap:+gap.toFixed(3)};
      c.kind=c.head_overlap>=.05?'kiss':v>0?'touch':gap<.06?'next to':null;const sc=(c.kind==='kiss'?3:c.kind==='touch'?2:c.kind?1:0)+c.overlap+c.head_overlap-c.gap;
      if(c.kind&&(!best||sc>best._s))best={...c,_s:sc};});if(best)delete best._s;return best;}
  async function scene(b,k,cl,ct,path){const label=b.dataset.label,name=b.dataset.name||label,L=b.parentNode;const ct0=contact(b,L);
    const C=window.thrydCtx?thrydCtx():{};const place=(st&&st.current_place)||(C.lastM&&C.PFULL[C.lastM.here])||'';
    const near=ct0?(ct0.kind==='next to'?'next to ':ct0.kind==='kiss'?'lips to ':'on top of ')+ct0.with:null;
    const t=make(name,place,{type:'sprite',key:k,left:cl,top:ct,w:b.style.width,h:b.style.height,src:(b.querySelector('.sp')||{}).src||''},near);
    const scard=(/_(j\d+)$/.exec(k||'')||[])[1]||'';
    try{const rec={key:(C.DRAG&&C.DRAG.key)||'',object:name,cut:label,place,x:+(+cl).toFixed(3),y:+(+ct).toFixed(3),
      w:parseFloat(b.style.width)||0,h:parseFloat(b.style.height)||0,scene:String(k||'').slice(0,160),scene_card:scard,contact:ct0,path:Array.isArray(path)?path.slice(0,24):undefined,target:t,rid:Math.random().toString(36).slice(2,12)};
      if(qaOn()){ rec.source='qa'; if(t) t.source='qa'; qaLog({kind:'projector-drag', ...rec}); }
      else { const DG=C.DRAG; if(DG&&DG.endpoint) fetch(DG.endpoint,{method:'POST',body:JSON.stringify(rec)}).catch(()=>{}); }
    }catch(e){}
    if(C.toast)C.toast(ct0&&b.dataset.name&&ct0.with!==ct0.with_cut?`👁 tracking: ${name} ↔ ${ct0.with} · ${ct0.kind} (logged only if the story does it)`:'drag saved: '+name+(near?' · '+near:''));}
  async function copy(x){try{await navigator.clipboard.writeText(x);return true;}catch(e){const ta=document.createElement('textarea');ta.value=x;ta.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(e2){}ta.remove();return ok;}}
  function pchip(t,g){document.querySelectorAll('.prophchip').forEach(x=>x.remove());const txt=MT(t.object,t.place);const c=document.createElement('button');c.className='prophchip';c.textContent='🔮 prophesy';c.title=txt;c.dataset.text=txt;
    let r=null;if(g.type==='sprite'){const L=document.getElementById('objs');const b=L&&L.querySelector(`.dob[data-label="${CSS.escape(g.label||t.object)}"]`);r=b&&b.getBoundingClientRect();}else{const h=headFor(t.place);r=h&&h.getBoundingClientRect();}
    r=r||{left:innerWidth/2,bottom:innerHeight/2};c.style.left=Math.min(innerWidth-130,Math.max(4,r.left))+'px';c.style.top=Math.min(innerHeight-40,r.bottom+28)+'px';
    ['pointerdown','pointerup','click','dblclick'].forEach(ev=>c.addEventListener(ev,e=>e.stopPropagation()));
    c.addEventListener('click',async()=>{const ok=await copy(txt);c.textContent=ok?'copied — paste in [[nh]]':'copy failed — '+txt;c.classList.add('ok');clearTimeout(c._h);c._h=setTimeout(()=>c.remove(),2500);});
    document.body.appendChild(c);setTimeout(()=>{if(!c.classList.contains('ok'))c.remove();},45000);}
  const lay=()=>{let g=document.getElementById('prophs');if(!g){g=document.createElement('div');g.id='prophs';document.body.appendChild(g);}return g;};
  // ghost spec: {gid, object, place, ghost?}; sprite ghosts sit where dropped (same scene key), others sit under the place heading
  function ghostEl(s){const g=s.ghost||{};let e=document.querySelector(`[data-proph="${CSS.escape(s.gid)}"]`);
    if(g.type==='sprite'){const L=document.getElementById('objs');if(L&&L.dataset.key===g.key){
      if(!e||e.parentNode!==L){if(e)e.remove();e=document.createElement('div');e.className='proph sprite';e.dataset.proph=s.gid;if(g.src){const im=new Image();im.src=g.src;im.alt='';e.appendChild(im);}L.appendChild(e);}
      Object.assign(e.style,{left:g.left+'%',top:g.top+'%',width:g.w,height:g.h});return e;}if(e&&e.classList.contains('sprite')){e.remove();e=null;}}
    const h=headFor(s.place);if(!h){if(e)e.remove();return null;}
    if(!e){e=document.createElement('div');e.className='proph chip';e.dataset.proph=s.gid;e.textContent=labelOf(s.object);lay().appendChild(e);}
    const r=h.getBoundingClientRect();Object.assign(e.style,{left:r.left+'px',top:(r.bottom+4)+'px'});return e;}
  const localFor=(o,p)=>T().find(t=>t.status==='open'&&objEq(t.object,o)&&plEq(t.place,p));
  function specs(){if(M.error)return [];const out=[];
    (M.open||[]).forEach(m=>{const l=localFor(m.object,m.place);out.push({gid:'m:'+(m.id||m.object+'|'+m.place),object:m.object,place:m.place,ghost:l&&l.ghost});});
    T().forEach(t=>{if(t.status!=='open')return;if((M.open||[]).some(m=>objEq(m.object,t.object)&&plEq(m.place,t.place)))return;
      if((M.fulfilled||[]).some(m=>objEq(m.object,t.object)&&plEq(m.place,t.place)))return;out.push({gid:'l:'+t.at,object:t.object,place:t.place,ghost:t.ghost});});return out;}
  function draw(){const S=specs(),ids=new Set(S.map(s=>s.gid));document.querySelectorAll('[data-proph]').forEach(e=>{if(!ids.has(e.dataset.proph)&&!e.classList.contains('done'))e.remove();});S.forEach(ghostEl);}
  function fulfil(m){const l=T().find(t=>objEq(t.object,m.object)&&plEq(t.place,m.place));const gid=[...document.querySelectorAll('[data-proph]')].map(e=>e.dataset.proph).find(g=>g==='m:'+(m.id||m.object+'|'+m.place)||(l&&g==='l:'+l.at));
    const s={gid:gid||'f:'+(m.id||m.object),object:m.object,place:m.place,ghost:l&&l.ghost};let e=ghostEl(s);
    if(!e){e=document.createElement('div');e.className='proph chip';e.dataset.proph=s.gid;e.textContent=labelOf(m.object);e.style.cssText='left:46%;top:40%';lay().appendChild(e);}
    e.classList.add('done');const c=document.createElement('div');c.className='prophcap';c.textContent='✨ prophecy fulfilled: '+asrt(labelOf(m.object),m.place);lay().appendChild(c);
    setTimeout(()=>{e.classList.add('fade');c.classList.add('fade');},4200);setTimeout(()=>{e.remove();c.remove();},5600);
    if(l){const a=T();a.forEach(t=>{if(t.at===l.at)t.status='fulfilled';});save(a);}}
  function fromState(s){if(!s)return;st=s;try{window.thrydFS&&thrydFS(s);}catch(e){}const mi=s.miracles;
    M=mi&&typeof mi==='object'&&!Array.isArray(mi)?{open:Array.isArray(mi.open)?mi.open:[],fulfilled:Array.isArray(mi.fulfilled)?mi.fulfilled:[],error:mi.error||null}:{open:[],fulfilled:[],error:null};
    if(M.error){document.querySelectorAll('[data-proph],.prophcap').forEach(e=>e.remove());return;}
    M.fulfilled.forEach(m=>{const k=m.id||(m.object+'|'+m.place+'|'+(m.fulfilled_card||''));if(seen.has(k))return;mark(k);fulfil(m);});draw();}
  window.thrydTarget={make,scene,fromState,list:T,text:MT,state:()=>M};
  const poll=async()=>{try{fromState(await LIVE_STATE());}catch(e){}draw();};
  poll();setInterval(poll,20000);setInterval(draw,1200);addEventListener('resize',draw);})();

// ---------- foreshadows (read-only view of <run>/foreshadows.json; foreshadow.py alone decides paid_off). Open = faint pin where it was dragged
// (or a faint 'watching' line when no drop spot is known); paid_off = one gold highlight + the posted line that matched, once per entry.
(function(){const SEEN='thryd_fs_seen';let F={open:[],paid_off:[]};
  const seen=new Set((()=>{try{return JSON.parse(localStorage.getItem(SEEN)||'[]');}catch(e){return [];}})());
  const mark=k=>{seen.add(k);try{localStorage.setItem(SEEN,JSON.stringify([...seen].slice(-200)));}catch(e){}};
  const kind=f=>(f.drop&&f.drop.contact&&f.drop.contact.kind)||((f.words||[]).some(w=>/^kiss/.test(w))?'kiss':(f.words||[]).some(w=>/hug|embrac/.test(w))?'touch':'next to');
  const txt=f=>`${(f.actors||[]).join(' ↔ ')} · ${kind(f)}`;
  const lay=()=>{let g=document.getElementById('prophs');if(!g){g=document.createElement('div');g.id='prophs';document.body.appendChild(g);}return g;};
  function pin(f){const d=f.drop,L=document.getElementById('objs');let e=document.querySelector(`[data-fs="${CSS.escape(f.id)}"]`);
    if(!d||!L||L.dataset.key!==d.scene){if(e&&!e.classList.contains('done'))e.remove();return null;}
    if(!e||e.parentNode!==L){if(e)e.remove();e=document.createElement('div');e.className='fspin';e.dataset.fs=f.id;const t=document.createElement('span');t.textContent='👁 '+txt(f);e.appendChild(t);L.appendChild(e);}
    Object.assign(e.style,{left:((+d.x||0)+(+d.w||0)/2)+'%',top:((+d.y||0)+(+d.h||0)*.12)+'%'});return e;}
  function line(){let w=document.getElementById('fswatch');const o=(F.open||[]).filter(f=>!(f.drop&&document.querySelector(`[data-fs="${CSS.escape(f.id)}"]`)));
    if(!o.length){if(w)w.remove();return;}if(!w){w=document.createElement('div');w.id='fswatch';lay().appendChild(w);}
    const t='👁 watching: '+o.map(txt).join(' · ');if(w.textContent!==t)w.textContent=t;w.title='tracked from projector drags; logged only if the agenda writes it';}
  function paid(f){let e=pin(f);if(e)e.classList.add('done');const c=document.createElement('div');c.className='prophcap';
    c.textContent=`✨ came true${f.card?' · '+f.card:''}: `+(f.evidence?`“${f.evidence}”`:txt(f));lay().appendChild(c);
    setTimeout(()=>{c.classList.add('fade');if(e)e.classList.add('fade');},6000);setTimeout(()=>{c.remove();if(e)e.remove();},7400);}
  function draw(){(F.open||[]).forEach(pin);const ids=new Set((F.open||[]).map(f=>f.id));document.querySelectorAll('[data-fs]').forEach(e=>{if(!ids.has(e.dataset.fs)&&!e.classList.contains('done'))e.remove();});line();}
  window.thrydFS=s=>{const x=s&&s.foreshadows;F=x&&!x.error?{open:Array.isArray(x.open)?x.open:[],paid_off:Array.isArray(x.paid_off)?x.paid_off:[]}:{open:[],paid_off:[]};
    F.paid_off.forEach(f=>{const k=s.run+'|'+f.id;if(seen.has(k))return;mark(k);paid(f);});draw();};
  window.thrydFSstate=()=>F;setInterval(draw,1500);})();
