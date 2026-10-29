// audio: browser speechSynthesis (main); data/audio.json clips only with ?audio=clips (no fetch otherwise). Plus local "Add GIF" sprites (IndexedDB, this browser only)
(()=>{
const Q=new URLSearchParams(location.search), $=id=>document.getElementById(id);
let muted=Q.get('audio')==='0'||localStorage.getItem('thryd_mute')==='1', clips=null;
const btn=$('mute'); const show=()=>btn.textContent=muted?'🔇 audio off':'🔊 audio on'; show();
btn.onclick=e=>{e.stopPropagation();muted=!muted;localStorage.setItem('thryd_mute',muted?'1':'0');if(muted)speechSynthesis?.cancel();show();};
const loadClips=()=>fetch('data/audio.json?_='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(m=>{
  let a=Array.isArray(m)?m:m&&(m.clips||m.items||m.audio||m.files||m.lines); if(!Array.isArray(a)||!a.length)return;
  clips=a.map(c=>typeof c==='string'?{file:c}:c).map(c=>{let f=c.file||c.src||c.path||c.url||c.audio||'';
    if(f&&!/^(https?:|\/|assets\/|data\/)/.test(f))f='assets/audio/'+f; return {file:f,line:c.line||c.text||c.tweet||'',run:c.run||c.run_id||null};}).filter(c=>c.file);
}).catch(()=>{});
if(Q.get('audio')==='clips'){loadClips(); setInterval(()=>{if(!clips)loadClips();},300000);}
function speakOnce(){
  const C=window.CUR||{lines:[],speakers:[]}; const run=($('run')||{}).textContent;
  if(clips&&clips.length){const pool=clips.filter(c=>!c.run||c.run===run||('run-'+c.run)===run); const c=pool[Math.floor(Math.random()*pool.length)];
    if(c){ if(c.line&&C.speakers.length&&window.thrydSay)window.thrydSay({line:c.line,src:'audio'},C.speakers[Math.floor(Math.random()*C.speakers.length)]);
      if(!muted){const a=new Audio(c.file||c.src);a.play().catch(()=>{});} return;}}
  const L=window.thrydChoose&&window.thrydChoose(C.lines); if(!L)return;
  const who=C.speakers[Math.floor(Math.random()*C.speakers.length)]; if(who&&window.thrydSay)window.thrydSay(L,who);
  if(!muted&&'speechSynthesis' in window){const u=new SpeechSynthesisUtterance(L.line.replace(/\[\[|\]\]/g,''));u.rate=.92;u.pitch=.9;speechSynthesis.cancel();speechSynthesis.speak(u);}
}
const lo=+(Q.get('audiomin')||40), hi=+(Q.get('audiomax')||90);
(function loop(){setTimeout(()=>{try{speakOnce();}catch(e){} loop();},(lo+Math.random()*(hi-lo))*1000);})();
// ---------- Add GIF
const DB=new Promise((res,rej)=>{const r=indexedDB.open('thryd-projector',1);r.onupgradeneeded=()=>r.result.createObjectStore('gifs',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const tx=async(mode,f)=>{const db=await DB;return new Promise((res,rej)=>{const t=db.transaction('gifs',mode);const r=f(t.objectStore('gifs'));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);});};
const put=g=>tx('readwrite',s=>s.put(g)), del=id=>tx('readwrite',s=>s.delete(id)), all=()=>tx('readonly',s=>s.getAll());
async function mount(g){
  const d=document.createElement('div'); d.className='ent obj user'; d.style.left=(g.x||20)+'vw'; d.style.top=(g.y||80)+'vh';
  let vis;
  if('ImageDecoder' in window){ try{
      const dec=new ImageDecoder({data:await g.blob.arrayBuffer(),type:g.blob.type||'image/gif'}); await dec.tracks.ready;
      const n=dec.tracks.selectedTrack.frameCount, fr=[];
      for(let i=0;i<Math.min(n,60);i++){const {image}=await dec.decode({frameIndex:i});const bm=await createImageBitmap(image);fr.push([bm,(image.duration||100000)/1000]);image.close();}
      vis=document.createElement('canvas'); vis.width=fr[0][0].width; vis.height=fr[0][0].height; const cx=vis.getContext('2d'); let k=0;
      const tick=()=>{cx.clearRect(0,0,vis.width,vis.height);cx.drawImage(fr[k][0],0,0);const ms=Math.max(40,fr[k][1]);k=(k+1)%fr.length;setTimeout(tick,ms);}; tick();
      d.title=`${fr.length} frames`;
    }catch(e){vis=null;} }
  if(!vis){vis=document.createElement('img');vis.src=URL.createObjectURL(g.blob);}
  vis.className='uvis'; d.appendChild(vis);
  const lab=document.createElement('div'); lab.className='lab'; lab.contentEditable='true'; lab.textContent=g.label; d.appendChild(lab);
  const x=document.createElement('button'); x.className='ux'; x.textContent='×'; d.appendChild(x);
  lab.onclick=e=>e.stopPropagation(); lab.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();lab.blur();}};
  lab.onblur=()=>{g.label=lab.textContent.trim()||g.label;put(g);};
  x.onclick=e=>{e.stopPropagation();d.remove();del(g.id);};
  d.onpointerdown=e=>{if(e.target===lab||e.target===x)return;e.preventDefault();const mv=ev=>{g.x=ev.clientX/innerWidth*100;g.y=ev.clientY/innerHeight*100+6;d.style.left=g.x+'vw';d.style.top=g.y+'vh';};
    const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);put(g);};addEventListener('pointermove',mv);addEventListener('pointerup',up);};
  d.onclick=e=>e.stopPropagation(); $('user').appendChild(d);
}
async function addFiles(files){for(const f of files){if(!/^image\/(gif|webp|png)/.test(f.type))continue;
  const g={id:Date.now()+'-'+Math.random().toString(36).slice(2,6),label:f.name.replace(/\.\w+$/,''),blob:f,x:15+Math.random()*60,y:70};await put(g);mount(g);}}
const inp=$('gifin'); $('addgif').onclick=e=>{e.stopPropagation();inp.click();}; inp.onclick=e=>e.stopPropagation();
inp.onchange=()=>{addFiles(inp.files);inp.value='';};
addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drop');});
addEventListener('dragleave',()=>document.body.classList.remove('drop'));
addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drop');addFiles(e.dataTransfer.files);});
all().then(gs=>gs.forEach(mount)).catch(()=>{});
})();
