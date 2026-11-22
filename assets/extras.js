// sound (Jesuye 15 Nov 2026 1:55 AM ET "a sound drop-down with yoki or lofi"): a small select replaces the on/off button.
//   off   default; nothing plays
//   lofi  a short list of Creative Commons / free-to-stream stations, starting with ABM Lofi
//         (https://radio.audiobookmanager.com/), then Frekvenci Chill and freeCodeCamp Code Radio
//   yoki  africariyoki songs that follow the story's pulse (assets/yoki_dj.js reads story/yoki_pulse.json; shuffle only as fallback), from the africariyoki songs API (www.africariyoki.com/api/songs.json; until that PR is
//         merged, the PR branch's raw copy); a small credit shows song · artist · africariyoki, and the current LRC line faintly
// Audio starts only from a user gesture (autoplay rules). The choice is saved as thryd_sound (migrated from thryd_mute, '0' = lofi);
// a reload with a saved mode tries to resume, and if the browser refuses it waits for the next tap anywhere. One audio element,
// so the modes never overlap. Stream/song errors retry quietly with backoff (lofi: next mount of the current station; yoki: skip to the next song).
// A small ⏭ next to the dropdown (hidden in off/brown) does whatever next means: yoki calls nextSong(); lofi reconnects on the next station.
//   brown (Jesuye 15 Nov 2026 5:08 AM ET "find a good brown noise api and add it") brown noise generated live in the browser with
//         Web Audio: leaky-integrated white noise (AudioWorklet, ScriptProcessor fallback), a gentle low-pass and a slow soft swell,
//         1.5 s fade in / out, about Lofi's level, ducked like the music. No network, no external API.
// Spoken lines (speechSynthesis) are opt-in with ?audio=speech and duck the music; ?audio=clips still plays data/audio.json clips.
// Plus local "Add GIF" sprites (IndexedDB, this browser only)
(()=>{
const Q=new URLSearchParams(location.search), $=id=>document.getElementById(id);
const SPEECH=Q.get('audio')==='speech'||Q.get('audio')==='clips';
let muted=true, clips=null; // true until music really plays
const btn=$('mute');
const LOFI={stations:[
  {name:'ABM Lofi', credit:'https://radio.audiobookmanager.com/', text:'ABM Lofi · CC-licensed', title:'Music: ABM Lofi radio (Creative Commons). Credits at radio.audiobookmanager.com', urls:['https://stream.audiobookmanager.com/listen/lofi/radio.mp3','https://stream.audiobookmanager.com/listen/lofi/radio.aac']},
  {name:'Frekvenci Chill', credit:'https://frekvenci.com/station.html?id=st-chill', text:'Frekvenci Chill · CC-licensed', title:'Music: Frekvenci Chill (Creative Commons lo-fi / synthwave). Credits at frekvenci.com', urls:['https://stream.frekvenci.com/chill']},
  {name:'Code Radio', credit:'https://coderadio.freecodecamp.org/', text:'Code Radio · freeCodeCamp', title:'Music: freeCodeCamp Code Radio. coderadio.freecodecamp.org', urls:['https://coderadio-admin-v2.freecodecamp.org/listen/coderadio/radio.mp3']},
], vol:.35, duck:.12};
function lofiSt(){ return LOFI.stations[si%LOFI.stations.length]; }
const YOKI={apis:['https://www.africariyoki.com/api/songs.json','https://raw.githubusercontent.com/jdavidteki/africariyoki/api-songs-json-pages/api/songs.json'],
  site:'https://www.africariyoki.com/', vol:.3};
const BROWN={vol:.32, duck:.12, fade:1.5, lp:520, swellHz:.045, swellDepth:.16};
const MODES=['off','lofi','yoki','brown'], LABEL={off:'🔇 sound off', lofi:'🎧 lofi', yoki:'🎤 yoki', brown:'🟤 brown noise'};
let mode='off', au=null, want=false, waitTap=false, tries=0, si=0, retryT=0, credit=null, lyr=null;
let ylist=null, ybase='', ybag=[], ysong=null, yfail=0, ylrc=[], yreq=0;
function savedMode(){ try{ const m=localStorage.getItem('thryd_sound'); if(MODES.indexOf(m)>=0) return m;
  return localStorage.getItem('thryd_mute')==='0'?'lofi':'off'; }catch(e){ return 'off'; } }
function save(m){ try{ localStorage.setItem('thryd_sound',m); localStorage.setItem('thryd_mute',m==='off'?'1':'0'); }catch(e){}
  try{ if(window.ThrydKeep) ThrydKeep.saveSettings({mute: m==='off'?1:0}); }catch(e){} }
// the select sits where the old button was; the old button stays in the DOM (hidden) for code that looks it up
const sel=document.createElement('select'); sel.id='sound'; sel.title='Sound: off, lofi radio, africariyoki songs or brown noise';
MODES.forEach(m=>{const o=document.createElement('option'); o.value=m; o.textContent=LABEL[m]; sel.appendChild(o);});
sel.value='off'; sel.onclick=e=>e.stopPropagation(); sel.onpointerdown=e=>e.stopPropagation&&e.stopPropagation();
if(btn){ btn.style.display='none'; btn.textContent='🔇 audio off'; if(btn.parentNode&&btn.parentNode.insertBefore) btn.parentNode.insertBefore(sel,btn.nextSibling); }
const nxt=document.createElement('button'); nxt.id='soundnext'; nxt.type='button'; nxt.textContent='⏭'; nxt.title='Next'; nxt.style.display='none';
nxt.onclick=e=>{ e&&e.stopPropagation&&e.stopPropagation(); nextSound(); };
nxt.onpointerdown=e=>e.stopPropagation&&e.stopPropagation();
if(sel.parentNode&&sel.parentNode.insertBefore) sel.parentNode.insertBefore(nxt,sel.nextSibling);
const show=()=>{ sel.value=mode; if(nxt){ nxt.style.display=(mode==='lofi'||mode==='yoki')?'':'none'; nxt.title=mode==='yoki'?'Next song':'Next lofi station'; } if(btn) btn.textContent=muted?'🔇 audio off':'🔊 audio on'; };
function mkCredit(){ if(credit) return credit; credit=document.createElement('a'); credit.id='lofi_credit'; credit.target='_blank'; credit.rel='noopener';
  credit.onclick=e=>e.stopPropagation(); credit.className='off'; document.body.appendChild(credit);
  lyr=document.createElement('div'); lyr.id='yoki_line'; lyr.className='off'; document.body.appendChild(lyr); return credit; }
function setCredit(){ const c=mkCredit();
  if(mode==='lofi'){ const s=lofiSt(); c.href=s.credit; c.textContent=s.text; c.title=s.title; }
  else if(mode==='brown'){ if(c.removeAttribute) c.removeAttribute('href'); c.textContent='brown noise · generated live'; c.title='Brown noise generated in this browser (Web Audio); nothing is streamed'; }
  else if(mode==='yoki'&&ysong){ c.href=YOKI.site; c.textContent=(ysong.title||'song')+' · '+(ysong.artist||'')+' · africariyoki'; c.title='Song via africariyoki.com'; }
  c.className=(mode==='off'||muted)?'off':''; if(lyr&&(mode!=='yoki'||muted)){lyr.className='off'; lyr.textContent='';}
  try{ if(window.thrydYokiDJ&&window.thrydYokiDJ.setActive) window.thrydYokiDJ.setActive(mode==='yoki'&&!muted&&want); }catch(e){} }
function mkAudio(){ if(au) return au; au=new Audio(); au.id='lofi'; au.preload='none'; au.volume=LOFI.vol; try{au.setAttribute('data-src',lofiSt().urls[0]);}catch(e){}
  if(au.addEventListener){
    au.addEventListener('playing',()=>{tries=0; yfail=0; if(want){muted=false; show(); setCredit();}});
    au.addEventListener('ended',()=>{ if(!want||waitTap) return; if(mode==='yoki') nextSong(); else retry(); });
    au.addEventListener('error',()=>{ if(!want||waitTap||!au.getAttribute||!au.getAttribute('src')) return; if(mode==='yoki'){ yfail++; if(yfail<4) setTimeout(()=>{ if(want&&mode==='yoki') nextSong(); },800); else retry(); } else retry(); });
    au.addEventListener('timeupdate',()=>{ if(mode!=='yoki'||!ylrc.length||!lyr) return; const t=au.currentTime; let cur='';
      for(let i=0;i<ylrc.length&&ylrc[i][0]<=t+.2;i++) cur=ylrc[i][1]; if(lyr.textContent!==cur){ lyr.textContent=cur; lyr.className=cur?'':'off'; } });
  }
  if(document.body&&document.body.appendChild) document.body.appendChild(au); return au; }
function retry(){ if(!want||retryT) return; tries++;
  const ms=Math.min(60000,2000*Math.pow(2,Math.min(tries-1,5))); retryT=setTimeout(()=>{retryT=0; if(want) start(false);},ms); }
function nextSound(){ if(mode==='yoki'){ if(retryT){clearTimeout(retryT);retryT=0;} yfail=0; return nextSong(); }
  if(mode!=='lofi') return; if(retryT){clearTimeout(retryT);retryT=0;} si=(si+1)%LOFI.stations.length; tries=0; return start(true); }
// ---------- yoki: songs list + shuffle bag + LRC
function loadSongs(){ if(ylist) return Promise.resolve(ylist); let i=0;
  const tryOne=()=>{ if(i>=YOKI.apis.length) return Promise.reject(new Error('no songs api'));
    const u=YOKI.apis[i++]; return fetch(u,{cache:'no-cache'}).then(r=>r.ok?r.json():Promise.reject(new Error(r.status))).then(d=>{
      const s=(d&&d.songs||[]).filter(x=>x&&/^https:\/\//.test(String(x.audio||''))); if(!s.length) throw new Error('empty');
      ylist=s; ybase=u.replace(/[^/]*$/,''); return s; }).catch(tryOne); };
  return tryOne(); }
function pick(){ if(!ybag.length){ ybag=ylist.slice(); for(let i=ybag.length-1;i>0;i--){ let j; try{const u=new Uint32Array(1);crypto.getRandomValues(u);j=Math.floor(u[0]/4294967296*(i+1));}catch(e){j=Math.floor(Math.random()*(i+1));} const t=ybag[i]; ybag[i]=ybag[j]; ybag[j]=t;} }
  return ybag.pop(); }
function parseLrc(t){ const out=[]; String(t||'').split('\n').forEach(l=>{ const m=l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/); if(m){ const x=m[3].trim(); out.push([+m[1]*60+ +m[2], x.length>90?x.slice(0,88)+'…':x]); } });
  return out.sort((a,b)=>a[0]-b[0]); }
function loadLrc(s){ ylrc=[]; if(!s||!s.lrc) return; const id=++yreq; const u=/^https?:/.test(s.lrc)?s.lrc:ybase+s.lrc;
  fetch(u).then(r=>r.ok?r.text():'').then(t=>{ if(id===yreq) ylrc=parseLrc(t); }).catch(()=>{}); }
// yoki DJ (v606, Jesuye 22 Nov "the story should sing its own soundtrack"): assets/yoki_dj.js picks from story/yoki_pulse.json
// (the open card + newest seats ranked against the lyrics), skipping the last 40 played; full-catalog shuffle as fallback.
// If the DJ is missing, slow (6 s) or fails, extras.js's own shuffle bag picks instead.
let ytok=0;
const YDJ=()=>window.thrydYokiDJ&&window.thrydYokiDJ.next?window.thrydYokiDJ:null;
function nextSong(){ if(!ylist||!ylist.length) return start(false); const tok=++ytok, dj=YDJ();
  const go=r=>{ if(tok!==ytok||!want||mode!=='yoki') return; const s=r&&ylist.find(x=>x.id===r.id); return playSong(s||pick(), s?r.why:null); };
  if(!dj) return go(null);
  return Promise.race([dj.next(id=>ylist.some(x=>x.id===id)), new Promise(res=>setTimeout(()=>res(null),6000))]).catch(()=>null).then(go); }
function playSong(s, why){ ysong=s; loadLrc(ysong); if(lyr){lyr.textContent=''; lyr.className='off';}
  const a=mkAudio(); a.src=ysong.audio; a.volume=YOKI.vol; setCredit(); let p; try{p=a.play();}catch(e){p=Promise.reject(e);}
  return Promise.resolve(p).then(()=>{waitTap=false; muted=false; show(); setCredit(); const dj=YDJ(); if(why&&dj&&dj.showWhy) dj.showWhy(why);}).catch(e=>played(e,false)); }
if(window.thrydYokiDJ) window.thrydYokiDJ.onShift=()=>{ if(mode==='yoki'&&want&&!waitTap&&au&&au.currentTime>25) nextSong(); };
function played(e,fromTap){ if(e&&e.name==='NotAllowedError'){ waitTap=true; muted=true; show(); setCredit();
    gate.textContent=fromTap?'🔊 Tap again to start the music':'🔊 Tap anywhere to resume the music'; gate.classList.remove('off'); return; }
  if(mode==='yoki'&&ylist){ yfail++; if(yfail<4){ setTimeout(()=>{ if(want&&mode==='yoki') nextSong(); },800); return; } }
  retry(); }
// ---------- brown: generated noise (Web Audio). One context, reused; the graph is
//   source (worklet or script processor) -> low-pass -> swell gain (base + slow LFO) -> master gain (fades, ducking) -> speakers
const BN={ctx:null, src:null, lp:null, sw:null, lfo:null, master:null, worklet:false, on:false, offT:0};
const BROWN_WORKLET='class B extends AudioWorkletProcessor{constructor(){super();this.l=[0,0];}process(i,o){const out=o[0];'+
  'for(let c=0;c<out.length;c++){const ch=out[c];let l=this.l[c]||0;for(let n=0;n<ch.length;n++){l=(l+0.02*(Math.random()*2-1))/1.02;ch[n]=l*3.5;}this.l[c]=l;}return true;}}'+
  'registerProcessor("thryd-brown",B);';
function brownScript(ctx){ const sp=ctx.createScriptProcessor(4096,0,2), last=[0,0];
  sp.onaudioprocess=e=>{ for(let c=0;c<e.outputBuffer.numberOfChannels;c++){ const ch=e.outputBuffer.getChannelData(c); let l=last[c]||0;
    for(let n=0;n<ch.length;n++){ l=(l+0.02*(Math.random()*2-1))/1.02; ch[n]=l*3.5; } last[c]=l; } }; return sp; }
function brownGraph(){ if(BN.ctx) return Promise.resolve(BN.ctx);
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return Promise.reject(new Error('no Web Audio'));
  const ctx=BN.ctx=new AC();
  BN.lp=ctx.createBiquadFilter(); BN.lp.type='lowpass'; BN.lp.frequency.value=BROWN.lp; BN.lp.Q.value=.4;
  BN.sw=ctx.createGain(); BN.sw.gain.value=1-BROWN.swellDepth;
  BN.lfo=ctx.createOscillator(); BN.lfo.frequency.value=BROWN.swellHz; const depth=ctx.createGain(); depth.gain.value=BROWN.swellDepth;
  BN.lfo.connect(depth); depth.connect(BN.sw.gain); BN.lfo.start();
  BN.master=ctx.createGain(); BN.master.gain.value=0;
  BN.lp.connect(BN.sw); BN.sw.connect(BN.master); BN.master.connect(ctx.destination);
  const fallback=()=>{ BN.worklet=false; BN.src=brownScript(ctx); BN.src.connect(BN.lp); return ctx; };
  if(ctx.audioWorklet&&window.Blob&&window.URL&&URL.createObjectURL){
    const u=URL.createObjectURL(new Blob([BROWN_WORKLET],{type:'application/javascript'}));
    return ctx.audioWorklet.addModule(u).then(()=>{ BN.src=new AudioWorkletNode(ctx,'thryd-brown',{numberOfInputs:0,outputChannelCount:[2]}); BN.worklet=true; BN.src.connect(BN.lp); return ctx; })
      .catch(fallback).finally(()=>{ try{URL.revokeObjectURL(u);}catch(e){} }); }
  return Promise.resolve(fallback()); }
function brownTo(v, secs){ const g=BN.master&&BN.master.gain, t=BN.ctx&&BN.ctx.currentTime; if(!g) return;
  try{ g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); g.linearRampToValueAtTime(v,t+secs); }catch(e){ g.value=v; } }
const brownVol=()=>(window.speechSynthesis&&speechSynthesis.speaking&&SPEECH)?BROWN.duck:BROWN.vol;
function brownStart(fromTap){ if(BN.offT){clearTimeout(BN.offT); BN.offT=0;}
  return brownGraph().then(ctx=>{ if(!want||mode!=='brown') return;
    const r=ctx.state==='running'?Promise.resolve():ctx.resume();
    // a resume() the browser holds back (no gesture yet) stays pending or leaves the context suspended
    return Promise.race([Promise.resolve(r), new Promise(res=>setTimeout(res,600))]).then(()=>{
      if(!want||mode!=='brown') return;
      if(ctx.state!=='running'){ const e=new Error('suspended'); e.name='NotAllowedError'; throw e; }
      BN.on=true; brownTo(brownVol(), BROWN.fade); waitTap=false; muted=false; show(); setCredit(); }); })
  .catch(e=>{ if(e&&e.name==='NotAllowedError') return played(e,fromTap); if(e&&e.message==='no Web Audio') return; retry(); }); }
function brownStop(){ if(!BN.ctx||!BN.on&&!BN.offT) return; BN.on=false; brownTo(0, BROWN.fade); if(BN.offT) clearTimeout(BN.offT);
  BN.offT=setTimeout(()=>{ BN.offT=0; if(!BN.on&&BN.ctx&&BN.ctx.state==='running') BN.ctx.suspend().catch(()=>{}); }, BROWN.fade*1000+300); }
function start(fromTap){ want=true; if(mode==='brown'){ if(retryT){clearTimeout(retryT);retryT=0;} return brownStart(fromTap); } const a=mkAudio(); if(retryT){clearTimeout(retryT);retryT=0;}
  if(mode==='yoki'){
    if(!ylist){ return loadSongs().then(()=>{ if(want&&mode==='yoki') return nextSong(); }).catch(()=>retry()); }
    if(waitTap&&ysong&&a.getAttribute&&a.getAttribute('src')){ let p; try{p=a.play();}catch(e){p=Promise.reject(e);} return Promise.resolve(p).then(()=>{waitTap=false; muted=false; show(); setCredit();}).catch(e=>played(e,fromTap)); }
    return nextSong();
  }
  const st=lofiSt(); a.src=st.urls[tries%st.urls.length]+(tries?('?r='+Date.now()):''); a.volume=(window.speechSynthesis&&speechSynthesis.speaking)?LOFI.duck:LOFI.vol;
  let p; try{p=a.play();}catch(e){p=Promise.reject(e);}
  return Promise.resolve(p).then(()=>{waitTap=false; muted=false; show(); setCredit();}).catch(e=>played(e,fromTap)); }
function stop(){ want=false; waitTap=false; tries=0; yfail=0; if(retryT){clearTimeout(retryT);retryT=0;} brownStop(); if(au){ try{au.pause(); au.removeAttribute('src'); au.load();}catch(e){} }
  muted=true; ylrc=[]; yreq++; ytok++; try{ if(window.thrydYokiDJ&&window.thrydYokiDJ.setActive) window.thrydYokiDJ.setActive(false); }catch(e){} if(credit) credit.className='off'; if(lyr){lyr.className='off'; lyr.textContent='';} }
function setMode(m, fromTap){ if(MODES.indexOf(m)<0) m='off'; stop(); mode=m; save(m); show();
  if(m==='off'){ if(window.speechSynthesis) speechSynthesis.cancel(); gate.classList.add('off'); return Promise.resolve(); }
  unlocked=true; gate.classList.add('off'); si=0; return start(!!fromTap); }
sel.onchange=e=>{ e&&e.stopPropagation&&e.stopPropagation(); setMode(sel.value, true); };
if(btn) btn.onclick=e=>{ e&&e.stopPropagation&&e.stopPropagation(); setMode(mode==='off'?'lofi':'off', true); }; // old button, kept working

const loadClips=()=>fetch('data/audio.json?_='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(m=>{
  let a=Array.isArray(m)?m:m&&(m.clips||m.items||m.audio||m.files||m.lines); if(!Array.isArray(a)||!a.length)return;
  clips=a.map(c=>typeof c==='string'?{file:c}:c).map(c=>{let f=c.file||c.src||c.path||c.url||c.audio||'';
    if(f&&!/^(https?:|\/|assets\/|data\/)/.test(f))f='assets/audio/'+f; return {file:f,line:c.line||c.text||c.tweet||'',run:c.run||c.run_id||null};}).filter(c=>c.file);
}).catch(()=>{});
if(Q.get('audio')==='clips'){loadClips(); setInterval(()=>{if(!clips)loadClips();},300000);}
let unlocked=false, VOICE=null;
const pickVoice=()=>{const vs=speechSynthesis.getVoices()||[];VOICE=vs.find(v=>/^en(-|_)?(US|GB|NG)?/i.test(v.lang)&&v.localService)||vs.find(v=>/^en/i.test(v.lang))||vs[0]||null;};
if('speechSynthesis' in window){pickVoice();speechSynthesis.addEventListener?.('voiceschanged',pickVoice);setInterval(()=>{if(speechSynthesis.speaking)speechSynthesis.resume();},5000);}
const gate=document.createElement('div');gate.id='sndgate';gate.textContent='🔊 Tap anywhere to turn on sound';document.body.appendChild(gate);
gate.classList.add('off');
function speakText(t){if(!SPEECH||muted||!unlocked||!('speechSynthesis' in window))return;
  const parts=(t.replace(/\[\[|\]\]/g,'').match(/[^.!?;,]{1,140}[.!?;,]?/g)||[t]).map(x=>x.trim()).filter(Boolean).slice(0,4);
  speechSynthesis.cancel();speechSynthesis.resume();
  parts.forEach(x=>{const u=new SpeechSynthesisUtterance(x);if(VOICE){u.voice=VOICE;u.lang=VOICE.lang;}else u.lang='en-US';u.rate=.95;u.pitch=.9;speechSynthesis.speak(u);});}
const unlock=e=>{ if(waitTap&&want&&e&&e.target!==btn&&e.target!==sel&&e.target!==nxt){ gate.classList.add('off'); start(true); } // a saved "on" the browser held back
  if(muted||unlocked)return;unlocked=true;gate.classList.add('off');
  try{pickVoice();speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u);}catch(e){}
  if(SPEECH)setTimeout(()=>{try{speakOnce();}catch(e){}},2500);};
addEventListener('pointerdown',unlock,{capture:true});addEventListener('touchend',unlock,{capture:true});addEventListener('keydown',unlock,{capture:true});
window.thrydSpeak=speakText;
function speakOnce(){
  const C=window.CUR||{lines:[],speakers:[]}; const run=($('run')||{}).textContent;
  if(clips&&clips.length){const pool=clips.filter(c=>!c.run||c.run===run||('run-'+c.run)===run); const c=pool[Math.floor(Math.random()*pool.length)];
    if(c){ if(c.line&&C.speakers.length&&window.thrydSay)window.thrydSay({line:c.line,src:'audio'},C.speakers[Math.floor(Math.random()*C.speakers.length)]);
      if(!muted){const a=new Audio(c.file||c.src);if(au)au.volume=LOFI.duck;if(BN.on)brownTo(BROWN.duck,.4);a.onended=()=>{if(au)au.volume=mode==='yoki'?YOKI.vol:LOFI.vol;if(BN.on)brownTo(BROWN.vol,1);};a.play().catch(()=>{});} return;}}
  const L=window.thrydChoose&&window.thrydChoose(C.lines); if(!L)return;
  const who=C.speakers[Math.floor(Math.random()*C.speakers.length)]; if(who&&window.thrydSay)window.thrydSay(L,who);
  speakText(L.line);
}
const lo=+(Q.get('audiomin')||15), hi=+(Q.get('audiomax')||30);
if(SPEECH)(function loop(){setTimeout(()=>{try{speakOnce();}catch(e){} loop();},(lo+Math.random()*(hi-lo))*1000);})();
// duck the music while a line is spoken (only with ?audio=speech)
if(SPEECH&&'speechSynthesis' in window)setInterval(()=>{if(au&&want&&!au.paused)au.volume=speechSynthesis.speaking?LOFI.duck:(mode==='yoki'?YOKI.vol:LOFI.vol);
  if(BN.on&&BN.master){ const v=brownVol(); if(BN.duckV!==v){ BN.duckV=v; brownTo(v,.5); } }},500);
// a reload with a saved mode: try to resume; if the browser says no, wait for the next tap
{ const m0=savedMode(); if(m0!=='off'){ mode=m0; show(); want=true; waitTap=true; start(false); } }
// watchdog: playback that stops advancing for 20 s while it should play reconnects (lofi) or moves on (yoki), with the same backoff
let lastT=-1; setInterval(()=>{ if(mode==='brown'||!au||!want||waitTap||retryT||au.paused){lastT=-1;return;} if(au.currentTime===lastT){ if(mode==='yoki') nextSong(); else retry(); } lastT=au.currentTime; },20000);
// level(): RMS of the brown-noise output right now (for QA; creates one analyser on first use)
function brownLevel(){ if(!BN.ctx||!BN.master) return 0; if(!BN.an){ BN.an=BN.ctx.createAnalyser(); BN.an.fftSize=2048; BN.master.connect(BN.an); }
  const d=new Float32Array(BN.an.fftSize); BN.an.getFloatTimeDomainData(d); let s=0; for(let i=0;i<d.length;i++) s+=d[i]*d[i]; return Math.sqrt(s/d.length); }
window.thrydLofi=window.thrydSound={level:brownLevel,set:m=>setMode(m,true),start:()=>start(true),stop:()=>setMode('off'),state:()=>({mode,want,waitTap,muted,tries,src:au&&au.src,paused:au?au.paused:true,song:ysong&&{title:ysong.title,artist:ysong.artist},songs:ylist?ylist.length:0,lrc:ylrc.length,station:mode==='lofi'&&lofiSt().name,
  brown:BN.ctx?{ctx:BN.ctx.state,on:BN.on,worklet:BN.worklet,gain:BN.master?+BN.master.gain.value.toFixed(3):0}:null})};
// ---------- Add GIF
const DB=new Promise((res,rej)=>{const r=indexedDB.open('thryd-projector',1);r.onupgradeneeded=()=>r.result.createObjectStore('gifs',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const tx=async(mode,f)=>{const db=await DB;return new Promise((res,rej)=>{const t=db.transaction('gifs',mode);const r=f(t.objectStore('gifs'));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);});};
const put=g=>tx('readwrite',s=>s.put(g)), del=id=>tx('readwrite',s=>s.delete(id)), all=()=>tx('readonly',s=>s.getAll());
async function mount(g){
  const d=document.createElement('div'); d.className='uchip';
  let vis;
  if('ImageDecoder' in window){ try{
      const dec=new ImageDecoder({data:await g.blob.arrayBuffer(),type:g.blob.type||'image/gif'}); await dec.tracks.ready;
      const n=dec.tracks.selectedTrack.frameCount, fr=[];
      for(let i=0;i<Math.min(n,60);i++){const {image}=await dec.decode({frameIndex:i});const bm=await createImageBitmap(image);fr.push([bm,(image.duration||100000)/1000]);image.close();}
      vis=document.createElement('canvas'); vis.width=fr[0][0].width; vis.height=fr[0][0].height; const cx=vis.getContext('2d'); let k=0;
      const tick=()=>{cx.clearRect(0,0,vis.width,vis.height);cx.drawImage(fr[k][0],0,0);const ms=Math.max(40,fr[k][1]);k=(k+1)%fr.length;setTimeout(tick,ms);}; tick();
    }catch(e){vis=null;} }
  if(!vis){vis=document.createElement('img');vis.src=URL.createObjectURL(g.blob);}
  vis.className='uvis';
  const lab=document.createElement('span'); lab.className='lab'; lab.contentEditable='true'; lab.textContent=g.label; d.appendChild(lab);
  const x=document.createElement('button'); x.className='ux'; x.textContent='×'; d.appendChild(x);
  const U={id:g.id,label:g.label,vis}; (window.THRYD_UG=window.THRYD_UG||[]).push(U);
  lab.onclick=e=>e.stopPropagation(); lab.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();lab.blur();}};
  lab.onblur=()=>{g.label=U.label=lab.textContent.trim()||g.label;put(g);};
  x.onclick=e=>{e.stopPropagation();d.remove();del(g.id);const a=window.THRYD_UG,i=a.indexOf(U);if(i>=0)a.splice(i,1);vis.remove();};
  d.onclick=e=>e.stopPropagation(); $('user').appendChild(d);
}
async function addFiles(files){for(const f of files){if(!/^image\/(gif|webp|png)/.test(f.type))continue;
  const g={id:Date.now()+'-'+Math.random().toString(36).slice(2,6),label:f.name.replace(/\.\w+$/,''),blob:f};await put(g);mount(g);}}
/* 17 Nov 2026 1:15 PM ET (Jesuye "we also dont need the gif button"): the + GIF button and its file picker are gone; saved GIFs still mount and a dropped file still adds one */
addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drop');});
addEventListener('dragleave',()=>document.body.classList.remove('drop'));
addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drop');addFiles(e.dataTransfer.files);});
all().then(gs=>gs.forEach(mount)).catch(()=>{});
})();
