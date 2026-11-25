(()=>{const $=(t,id)=>{const e=document.createElement(t);e.id=id;document.body.appendChild(e);return e};
const code=$('div','code'),live=$('div','live'),crawl=$('div','crawl');$('div','grain');
const bad=/explicit|never explicit/i,clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const get=u=>fetch(u+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
const validTz=tz=>{if(!tz||typeof tz!=='string')return null;try{Intl.DateTimeFormat('en-US',{timeZone:tz}).format(new Date());return tz;}catch(e){return null;}};
let storyT=null,storyAt=0,storyLabel='',storyTz='Africa/Lagos',lastSeat=null,pulse=false;const flash=()=>{const d=live.querySelector('.dot');if(d){d.classList.remove('fl');void d.offsetWidth;d.classList.add('fl')}};let real=[],seat='',arch=[],seatN=0,runId='run';
const R=a=>a[Math.random()*a.length|0];
async function load(first){try{const [st,tl,cf,lt]=await Promise.all([get('data/state.json'),get('data/timeline.json'),get('data/code_feed.json'),get('data/live_time.json')]);
 const L=[];if(lt){if(lt.story_time)storyLabel=String(lt.story_time);const z=validTz(lt.tz);if(z)storyTz=z;}else if(!storyLabel&&st&&(st.story_time_label||st.story_time)){const raw=st.story_time_label||st.story_time;const parsed=new Date(raw);if(!isNaN(parsed)&&/T\d\d:/.test(String(raw))){storyT=parsed;storyAt=Date.now();}else storyLabel=String(raw);}if(st){runId=st.run||runId;seat=st.seats?st.seats.split(' ')[0]:(st.seated_count?st.seated_count+'/30':'');seatN=st.seated_count||0;
  if(st.current_card)L.push(`thryd.card = ${st.current_card}`);if(st.ticker&&st.ticker.line)L.push(clean(st.ticker.line).slice(0,140));}
 if(tl&&tl.events){for(const e of tl.events){const l=clean(e.label);if(!l||bad.test(l))continue;
  const k=e.kind;L.push(k==='move'?`>> ${l.replace(/^move /,'')}`:k==='theme'?`#thryd.importtheme("${l.replace(/^theme imported:? ?/,'')}")`:k==='scene'?`-- ${l}`:k==='miracle'?`!! miracle: ${l}`:`${k}: ${l}`);}}
 const F=cf?(Array.isArray(cf)?cf:(cf.items||cf.lines||cf.events||cf.feed||[])).map(x=>clean(typeof x==='string'?x:(x.line||x.text||x.cmd||x.label||''))).filter(l=>l&&!bad.test(l)):[];
 if(F.length){real=F;arch=F.slice(-25);if(cf.latest_news&&!bad.test(cf.latest_news))arch.unshift(clean(cf.latest_news));}else if(L.length){real=L;arch=L.slice(-25);}
 const seatChanged=seat!==lastSeat; if(seatChanged){pulse=lastSeat!==null;lastSeat=seat;}
 // Build the LIVE button once. Later refreshes only update seat/clock text so the panel does not restart from the button.
 if(first || !live.querySelector('.dot')){
  live.innerHTML=`<span class="live-main"><span class="dot"></span><b>LIVE</b> <span id="clk"></span><span class="live-extra"><span id="sclk"></span>${seat?`<span class="seat${pulse?' pulse':''}">seats ${seat}</span>`:''}</span></span>`;
  if(storyLabel){ live.title=storyLabel; const ck=live.querySelector('#clk'); if(ck) ck.title=storyLabel; }
  if(first) flash();
 } else {
  let seatEl=live.querySelector('.seat');
  const extra=live.querySelector('.live-extra');
  if(seat){ if(!seatEl){ seatEl=document.createElement('span'); seatEl.className='seat'; (extra||live).appendChild(seatEl); } seatEl.textContent='seats '+seat; if(pulse){ seatEl.classList.add('pulse'); } }
  else if(seatEl) seatEl.remove();
 }
 pulse=false; try{tick();}catch(e){}}catch(e){try{tick();}catch(e2){}}try{await loadIx();}catch(e){}}
const syn=()=>{const j='j'+(1+Math.random()*30|0);return R([`>> thryd.db.seat(${j}) ok`,`scanning archive... ${900+Math.random()*600|0} lines`,`cooldown(line) = ${2+Math.random()*6|0} agendas`,`fetch state.json 200 ${20+Math.random()*80|0}ms`,`dice.roll(d20) = ${1+Math.random()*20|0}`,`${runId}.heartbeat()`,`gc: freed ${Math.random()*9|0}.${Math.random()*9|0}MB`,`seated ${seatN||'?'}/30 · queue ${Math.random()*4|0}`])};
let ri=0,mvTurn=0;
let typing=false,lastTick=0;
let worldQ=[],worldSeen=new Set(),worldPrimed=false;
const ixLine=d=>{if(!d||typeof d!=='object')return null;if(d.a&&d.verb){const t=d.b?(String(d.a)+'.'+d.verb+'('+d.b+')'):(String(d.a)+'.'+d.verb+'()');return {t,a:true,note:d.place||d.idea||''};}const text=clean(d.idea||d.text||d.line||'');return text?{t:text,a:true}:null;};
async function loadIx(){try{const r=await fetch('data/interactions_feed.jsonl?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const evs=[];
  for(const line of (await r.text()).split('\n')){if(!line.trim())continue;let d;try{d=JSON.parse(line);}catch(e){continue;}const rec=ixLine(d);if(!rec||!rec.t)continue;evs.push({ts:d.ts||'',rec,key:(d.ts||'')+'|'+rec.t});}
  if(!evs.length)return;
  if(!worldPrimed){evs.forEach(e=>worldSeen.add(e.key));evs.slice(-24).forEach(e=>worldQ.push(e.rec));worldPrimed=true;}
  else evs.forEach(e=>{if(!worldSeen.has(e.key)){worldSeen.add(e.key);worldQ.push(e.rec);}});
  if(worldSeen.size>900) worldSeen=new Set(evs.slice(-400).map(e=>e.key));
  if(worldQ.length>40) worldQ.splice(0,worldQ.length-40);
  const recent=evs.slice(-80).map(e=>e.rec.t).filter(Boolean);
  if(recent.length) real=recent.concat(real.filter(x=>!recent.includes(x))).slice(0,120);
 }catch(e){}}

const next=()=>{try{const dl=window.__thrydDriftLines;if(dl&&dl.length&&!/phone\.html$/.test(location.pathname)){const x=dl.shift();if(x)return x;}
 if(worldQ.length)return worldQ.shift();
 const mv=(++mvTurn%2===0&&window.thrydMoveNext)?window.thrydMoveNext():null;if(mv)return mv;
 return Math.random()<.55&&real.length?{t:real[ri++%real.length],a:true}:{t:syn(),a:false};}catch(e){try{return {t:syn(),a:false};}catch(e2){return {t:'heartbeat()',a:false};}}};
function type(){if(typing)return;typing=true;lastTick=Date.now();
 try{
  const n=next()||{},s=String(n.t==null?'':n.t);
  if(!s){typing=false;setTimeout(type,400);return;}
  const d=document.createElement('div');d.className=(n.a?'a ':'')+'cur';code.appendChild(d);
  while(code.children.length>60){const el=code.firstElementChild;if(!el||el===d)break;el.remove();}
  let i=0;
  /* v612 heat: 3 letters per ~100 ms (was 1 per ~34 ms, ~30 text repaints a second of a masked panel); idle: the whole line at once, a new line every ~2-4 s */
  const step=()=>{lastTick=Date.now();try{const st=window.LH&&LH.state;if(st==='hidden'){setTimeout(step,1500);return;}
    i=st==='idle'?s.length:Math.min(s.length,i+3);d.textContent=s.slice(0,i);if(i<s.length)setTimeout(step,70+Math.random()*60);
    else{d.classList.remove('cur');if(n.note){const e=document.createElement('span');e.className='d';e.textContent='  // '+n.note;d.appendChild(e);}typing=false;setTimeout(type,st==='idle'?1800+Math.random()*1800:250+Math.random()*900);}}
    catch(err){try{d.classList.remove('cur');}catch(e2){}typing=false;setTimeout(type,400);}};
  step();
 }catch(err){typing=false;setTimeout(type,400);}}
setInterval(()=>{const idle=Date.now()-lastTick;if((!typing&&idle>5000)||idle>15000){typing=false;try{type();}catch(e){}}},1000);
function zoneAbbr(tz){try{const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,timeZoneName:'short'}).formatToParts(new Date());const n=(p.find(x=>x.type==='timeZoneName')||{}).value||'';if(/^GMT|^UTC/i.test(n)&&tz==='Africa/Lagos')return 'WAT';return n||'WAT';}catch(e){return tz==='Africa/Lagos'?'WAT':'';}}
function tick(){const tz=validTz(storyTz)||'Africa/Lagos';try{const c=document.getElementById('clk');if(c){c.textContent=new Date().toLocaleTimeString('en-US',{timeZone:tz,hour12:false})+' '+zoneAbbr(tz);if(storyLabel)c.title=storyLabel;}const k=document.getElementById('sclk');if(k){if(storyLabel){k.textContent='· '+storyLabel;k.title=storyLabel;}else if(storyT&&!isNaN(storyT))k.textContent='· story '+new Date(storyT.getTime()+Date.now()-storyAt).toLocaleString('en-US',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',second:'2-digit'});else k.textContent='';}}catch(e){}}
// bottom ticker: real station names reporting #thryd news (Jesuye 11-12 7:05/7:06 PM). Events are only real #thryd data
// (data/thryd_news.json from the state export: seats, typed jobs, major moves, drift; plus this page's own drift events). Names are text only.
const ST=['CHANNELS TV','ARISE NEWS','TVC NEWS','AIT','NTA','PUNCH','VANGUARD','PREMIUM TIMES','THE GUARDIAN NIGERIA','CHANNELS TV','ARISE NEWS','TVC NEWS','BBC','CNN'];
let NEWS=null,stI=0;const sceneT=s=>{try{return (window.thrydSceneTitle&&thrydSceneTitle(s))||null;}catch(e){return null;}};
const nm=s=>String(s||'').replace(/^(?:assets\/webp\/live\/|medium\/)/,'').slice(0,46);
function bulletin(i){const at=i.card?`${i.card}`:'the frame';
  switch(i.kind){
   // v2 (Jesuye 15 Nov 2026 12:04 PM ET "read like news"): template-built headlines from the world facts, the stage's meetings,
   // the story's moves and a general world desk (tools/export_thryd_news.py, no AI); shown as they are
   case 'headline':return i.text||null;
   case 'move':return R([`BREAKING: Reports reaching us from ${at} say ${i.code}`,`Live from ${at}: ${i.code}`,`JUST IN from ${at}: ${i.code}`])+(i.note?` — ${i.note}`:'');
   case 'typed':return R([`A customer has typed ${i.code} at ${at}, our correspondent confirms`,`Live from the frame: ${i.code} entered at ${at}`,`Sources at ${at} report the command ${i.code}`]);
   case 'mood':return `A new mood has been imported into ${at}; the room is shifting, more details soon`;
   case 'seat':return R([`Seat confirmed at ${at}: ${i.picks} picks locked in`,`Reports from ${at}: ${i.picks} lines seated as the agenda moves on`]);
   case 'drift':{const f=sceneT(i.from_scene)||nm(i.from_scene),t=i.to_scene==='(travelling)'?null:(sceneT(i.to_scene)||nm(i.to_scene));
     return i.to_scene==='(travelling)'?`JUST IN: ${i.what} has been sighted leaving “${f}”; sources say it is travelling`
       :(i.from_scene===i.to_scene?`Eyewitnesses report ${i.what} wandering across “${f}”`:`BREAKING: ${i.what} has turned up in “${t}”, all the way from “${f}”`);}
  }return null;}
async function loadNews(){const j=await get('data/thryd_news2.json')||await get('data/thryd_news.json');if(j&&Array.isArray(j.items)&&j.items.length)NEWS=j;}
function localDrifts(){try{return (window.thrydMoves?thrydMoves.list():[]).filter(e=>e.type==='drift'&&Date.now()-Date.parse(e.client_ts)<3600e3).slice(-6).map(e=>({kind:'drift',what:(e.source&&e.source.cut)||e.label||'an object',
  from_scene:e.drift&&e.drift.kind==='arrive'?e.drift.from_scene:(e.source&&e.source.scene),to_scene:e.drift&&e.drift.kind==='leave'?'(travelling)':(e.source&&e.source.scene)}));}catch(e){return [];}}
function lines(){try{if(/phone\.html$/.test(location.pathname))return null;const v2=NEWS&&NEWS.v>=2;
  // v2 feeds are already headlines; this page's raw drift rows (cut ids, scene file names) read like code, so they stay out
  const it=[...(NEWS?NEWS.items:[])].sort(()=>Math.random()-.5).slice(0,v2?12:10).concat(v2?[]:localDrifts());if(!it.length)return null;
  return it.map(i=>{try{return bulletin(i);}catch(e){return null;}}).filter(Boolean).slice(0,14).map(b=>({st:ST[stI++%ST.length],b}));}catch(e){return null;}}
let span,spanW=0,x=0,lastT=0;const SPEED=/phone\.html$/.test(location.pathname)?66:26; // px per second (was 1.1px per animation frame ≈ 66px/s at 60Hz)
function crawlNext(){if(!span){const t=document.createElement('i');t.textContent='#thryd news';crawl.appendChild(t);span=document.createElement('span');crawl.appendChild(span)}
  const L=lines();span.textContent='';
  if(L){L.forEach((l,k)=>{const e=document.createElement('b');e.className='nb';e.innerHTML='';const s1=document.createElement('strong');s1.textContent=l.st+' — ';e.append(s1,document.createTextNode(l.b));span.appendChild(e);});}
  else span.textContent=(arch.length?arch:['#thryd archive']).join('   ·   ');
  x=innerWidth;spanW=0;}
function anim(now){if(span){const dt=lastT?Math.min(250,now-lastT):16;x-=SPEED*dt/1000;span.style.transform=`translateX(${x.toFixed(1)}px)`;if(x<-(spanW||(spanW=span.offsetWidth)))crawlNext();}lastT=now;(window.LH?LH.deco:requestAnimationFrame)(anim)}
Promise.all([load(true),loadNews()]).then(()=>{crawlNext();(window.LH?LH.deco:requestAnimationFrame)(anim);type()});setInterval(loadNews,300000);setInterval(tick,1000);setInterval(()=>load(false),20000);})();
// 🧭 [[move]] major moves (data/moves.json, from RUN/run/major_moves.json via export_state) feed the #code column above as ordinary lines.
// Synced to the jN scene on stage when it belongs to the moves' run, else a fresh state.json card, else cycling j1..jN. Not on phone.html.
(()=>{if(/phone\.html$/.test(location.pathname))return;
const get=u=>fetch(u+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
let D=null,stCard=null,stRun=null,card=null,q=[],qi=0,restAt=0;
const jn=c=>{const m=/^[wj](\d+)$/.exec(c||'');return m?'j'+m[1]:null;};
async function load(){const [d,st]=await Promise.all([get('data/moves.json'),get('data/state.json')]);if(d&&Array.isArray(d.moves))D=d;
  if(st){const at=Date.parse(st.exported_at||'');stCard=(at&&Date.now()-at<3*3600e3)?jn(st.current_card):null;stRun=st.run||null;}}
function sceneCard(){const run=D.run;const o=document.querySelector('#stage #objs'),k=o&&o.dataset.key||'';
  const im=[...document.querySelectorAll('#stage img.on')].map(i=>i.getAttribute('src')||'').join(' ');
  for(const s of [k,im]){if(s.indexOf(run)>=0){const m=s.match(/(?:^|[^A-Za-z0-9])(j\d+)(?![0-9])/);if(m)return m[1];}}
  return (stRun===run&&stCard)?stCard:null;}
const lab=m=>m.label||jn(m.card)||'';
const cards=()=>[...new Set(D.moves.map(lab).filter(Boolean))];
const start=c=>{card=c;q=D.moves.filter(m=>lab(m)===c);qi=0;};
window.thrydMoveNext=()=>{if(!D||!D.moves.length||document.body.classList.contains('cerebro')||document.body.classList.contains('lovemap'))return null;
  const c=sceneCard(),cs=cards();
  if(c){if(c!==card)start(c);}else if(!card||!cs.includes(card))start(cs[0]);
  if(qi>=q.length){if(!restAt){restAt=Date.now()+8000;}if(Date.now()<restAt)return null;restAt=0;start(c||cs[(cs.indexOf(card)+1)%cs.length]);}
  const m=q[qi++];if(!m)return null;const note=m.typed?('⌨ typed'+(m.note&&m.note!=='typed'?' · '+m.note:'')):(m.note||'');
  return {t:`${lab(m)} ${m.code}`,a:true,note};};
load();setInterval(load,60000);})();
