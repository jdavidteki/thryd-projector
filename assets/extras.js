// audio (Jesuye 14 Nov 2026 4:54 PM ET "update audio off and on to use your recommendation"): the sound button plays the ABM Lofi
// Creative Commons radio stream (https://radio.audiobookmanager.com/). Off by default; it only starts from a tap (autoplay rules).
// The on/off choice is saved (thryd_mute, '0' = on). A reload with sound saved on tries to resume; when the browser refuses, the button
// stays "audio off" and the next tap anywhere resumes it. Stream errors retry quietly with backoff (mp3, then the AAC mount).
// Spoken lines (speechSynthesis) are opt-in with ?audio=speech and duck the music; ?audio=clips still plays data/audio.json clips.
// Plus local "Add GIF" sprites (IndexedDB, this browser only)
(()=>{
const Q=new URLSearchParams(location.search), $=id=>document.getElementById(id);
const SPEECH=Q.get('audio')==='speech'||Q.get('audio')==='clips';
let muted=true, clips=null; // the button shows "off" until the stream really plays
const btn=$('mute'); const show=()=>btn.textContent=muted?'🔇 audio off':'🔊 audio on'; show();
const LOFI={urls:['https://stream.audiobookmanager.com/listen/lofi/radio.mp3','https://stream.audiobookmanager.com/listen/lofi/radio.aac'],
  credit:'https://radio.audiobookmanager.com/', vol:.35, duck:.12};
let au=null, want=false, waitTap=false, tries=0, si=0, retryT=0, credit=null;
const savedOn=()=>{try{return localStorage.getItem('thryd_mute')==='0';}catch(e){return false;}};
const save=on=>{try{localStorage.setItem('thryd_mute',on?'0':'1');}catch(e){}};
function mkCredit(){ if(credit) return credit; credit=document.createElement('a'); credit.id='lofi_credit'; credit.href=LOFI.credit; credit.target='_blank'; credit.rel='noopener';
  credit.textContent='ABM Lofi · CC-licensed'; credit.title='Music: ABM Lofi radio (Creative Commons). Credits at radio.audiobookmanager.com';
  credit.onclick=e=>e.stopPropagation(); credit.className='off'; document.body.appendChild(credit); return credit; }
function mkAudio(){ if(au) return au; au=new Audio(); au.id='lofi'; au.preload='none'; au.volume=LOFI.vol; try{au.setAttribute('data-src',LOFI.urls[0]);}catch(e){}
  if(au.addEventListener){
    au.addEventListener('playing',()=>{tries=0; if(want){muted=false; show(); mkCredit().className='';}});
    ['error','ended'].forEach(t=>au.addEventListener(t,()=>{ if(want&&!waitTap&&(t!=='emptied'||!au.paused)) retry(); }));
  }
  if(document.body&&document.body.appendChild) document.body.appendChild(au); return au; }
function retry(){ if(!want||retryT) return; tries++; if(tries%2===0) si=(si+1)%LOFI.urls.length;
  const ms=Math.min(60000,2000*Math.pow(2,Math.min(tries-1,5))); retryT=setTimeout(()=>{retryT=0; if(want) start(false);},ms); }
function start(fromTap){ want=true; const a=mkAudio(); if(retryT){clearTimeout(retryT);retryT=0;}
  a.src=LOFI.urls[si]+(tries?('?r='+Date.now()):''); a.volume=(window.speechSynthesis&&speechSynthesis.speaking)?LOFI.duck:LOFI.vol;
  let p; try{p=a.play();}catch(e){p=Promise.reject(e);}
  return Promise.resolve(p).then(()=>{waitTap=false; muted=false; show(); mkCredit().className='';}).catch(e=>{
    if(e&&e.name==='NotAllowedError'){ waitTap=true; muted=true; show(); gate.textContent=fromTap?'🔊 Tap again to start the music':'🔊 Tap anywhere to resume the music'; gate.classList.remove('off'); return; }
    retry(); }); }
function stop(){ want=false; waitTap=false; if(retryT){clearTimeout(retryT);retryT=0;} if(au){ try{au.pause(); au.removeAttribute('src'); au.load();}catch(e){} }
  if(credit) credit.className='off'; }
btn.onclick=e=>{e.stopPropagation(); const on=muted;
  if(on){ save(true); unlocked=true; gate.classList.add('off'); muted=false; show(); start(true); }
  else { save(false); muted=true; show(); stop(); if(window.speechSynthesis)speechSynthesis.cancel(); } };
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
const unlock=e=>{ if(waitTap&&want&&e&&e.target!==btn){ gate.classList.add('off'); start(true); } // a saved "on" the browser held back
  if(muted||unlocked)return;unlocked=true;gate.classList.add('off');
  try{pickVoice();speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u);}catch(e){}
  if(SPEECH)setTimeout(()=>{try{speakOnce();}catch(e){}},2500);};
addEventListener('pointerdown',unlock,{capture:true});addEventListener('touchend',unlock,{capture:true});addEventListener('keydown',unlock,{capture:true});
window.thrydSpeak=speakText;
function speakOnce(){
  const C=window.CUR||{lines:[],speakers:[]}; const run=($('run')||{}).textContent;
  if(clips&&clips.length){const pool=clips.filter(c=>!c.run||c.run===run||('run-'+c.run)===run); const c=pool[Math.floor(Math.random()*pool.length)];
    if(c){ if(c.line&&C.speakers.length&&window.thrydSay)window.thrydSay({line:c.line,src:'audio'},C.speakers[Math.floor(Math.random()*C.speakers.length)]);
      if(!muted){const a=new Audio(c.file||c.src);if(au)au.volume=LOFI.duck;a.onended=()=>{if(au)au.volume=LOFI.vol;};a.play().catch(()=>{});} return;}}
  const L=window.thrydChoose&&window.thrydChoose(C.lines); if(!L)return;
  const who=C.speakers[Math.floor(Math.random()*C.speakers.length)]; if(who&&window.thrydSay)window.thrydSay(L,who);
  speakText(L.line);
}
const lo=+(Q.get('audiomin')||15), hi=+(Q.get('audiomax')||30);
if(SPEECH)(function loop(){setTimeout(()=>{try{speakOnce();}catch(e){} loop();},(lo+Math.random()*(hi-lo))*1000);})();
// duck the music while a line is spoken (only with ?audio=speech)
if(SPEECH&&'speechSynthesis' in window)setInterval(()=>{if(au&&want&&!au.paused)au.volume=speechSynthesis.speaking?LOFI.duck:LOFI.vol;},500);
// a reload with sound saved on: try to resume; if the browser says no, wait for the next tap
if(savedOn()){want=true; waitTap=true; start(false);}
// watchdog: a live stream that stops advancing for 20 s while it should play reconnects (quietly, with the same backoff)
let lastT=-1; setInterval(()=>{ if(!au||!want||waitTap||retryT||au.paused){lastT=-1;return;} if(au.currentTime===lastT) retry(); lastT=au.currentTime; },20000);
window.thrydLofi={start:()=>start(true),stop,state:()=>({want,waitTap,muted,tries,src:au&&au.src,paused:au?au.paused:true})};
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
const inp=$('gifin'); $('addgif').onclick=e=>{e.stopPropagation();inp.click();}; inp.onclick=e=>e.stopPropagation();
inp.onchange=()=>{addFiles(inp.files);inp.value='';};
addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drop');});
addEventListener('dragleave',()=>document.body.classList.remove('drop'));
addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drop');addFiles(e.dataTransfer.files);});
all().then(gs=>gs.forEach(mount)).catch(()=>{});
})();
