(()=>{const $=(t,id)=>{const e=document.createElement(t);e.id=id;document.body.appendChild(e);return e};
const code=$('div','code'),live=$('div','live'),crawl=$('div','crawl');$('div','grain');
const bad=/explicit|never explicit/i,clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const get=u=>fetch(u+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
let storyT=null,storyAt=0,lastSeat=null,pulse=false;const flash=()=>{const d=live.querySelector('.dot');if(d){d.classList.remove('fl');void d.offsetWidth;d.classList.add('fl')}};let real=[],seat='',arch=[],seatN=0,runId='run';
const R=a=>a[Math.random()*a.length|0];
async function load(first){const [st,tl,cf]=await Promise.all([get('data/state.json'),get('data/timeline.json'),get('data/code_feed.json')]);
 const L=[];if(st){if(st.story_time){storyT=new Date(st.story_time);storyAt=Date.now();}runId=st.run||runId;seat=st.seats?st.seats.split(' ')[0]:(st.seated_count?st.seated_count+'/30':'');seatN=st.seated_count||0;
  if(st.current_card)L.push(`thryd.card = ${st.current_card}`);if(st.ticker&&st.ticker.line)L.push(clean(st.ticker.line).slice(0,140));}
 if(tl&&tl.events){for(const e of tl.events){const l=clean(e.label);if(!l||bad.test(l))continue;
  const k=e.kind;L.push(k==='move'?`>> ${l.replace(/^move /,'')}`:k==='theme'?`#thryd.importtheme("${l.replace(/^theme imported:? ?/,'')}")`:k==='scene'?`-- ${l}`:k==='miracle'?`!! miracle: ${l}`:`${k}: ${l}`);}}
 const F=cf?(Array.isArray(cf)?cf:(cf.items||cf.lines||cf.events||cf.feed||[])).map(x=>clean(typeof x==='string'?x:(x.line||x.text||x.cmd||x.label||''))).filter(l=>l&&!bad.test(l)):[];
 if(F.length){real=F;arch=F.slice(-25);if(cf.latest_news&&!bad.test(cf.latest_news))arch.unshift(clean(cf.latest_news));}else if(L.length){real=L;arch=L.slice(-25);}
 const seatChanged=seat!==lastSeat; if(seatChanged){pulse=lastSeat!==null;lastSeat=seat;}
 // Build the LIVE button once. Later refreshes only update seat/clock text so the panel does not restart from the button.
 if(first || !live.querySelector('.dot')){
  live.innerHTML=`<span class="dot"></span><b>LIVE</b> <span id="clk"></span> <span id="sclk"></span>${seat?`<span class="seat${pulse?' pulse':''}">seats ${seat}</span>`:''}`;
  if(first) flash();
 } else {
  let seatEl=live.querySelector('.seat');
  if(seat){ if(!seatEl){ seatEl=document.createElement('span'); seatEl.className='seat'; live.appendChild(seatEl); } seatEl.textContent='seats '+seat; if(pulse){ seatEl.classList.add('pulse'); } }
  else if(seatEl) seatEl.remove();
 }
 pulse=false; tick();}
const syn=()=>{const j='j'+(1+Math.random()*30|0);return R([`>> thryd.db.seat(${j}) ok`,`scanning archive... ${900+Math.random()*600|0} lines`,`cooldown(line) = ${2+Math.random()*6|0} agendas`,`fetch state.json 200 ${20+Math.random()*80|0}ms`,`dice.roll(d20) = ${1+Math.random()*20|0}`,`${runId}.heartbeat()`,`gc: freed ${Math.random()*9|0}.${Math.random()*9|0}MB`,`seated ${seatN||'?'}/30 · queue ${Math.random()*4|0}`])};
let ri=0;const next=()=>Math.random()<.55&&real.length?{t:real[ri++%real.length],a:true}:{t:syn(),a:false};
function type(){const n=next(),d=document.createElement('div');d.className=(n.a?'a ':'')+'cur';code.appendChild(d);
 while(code.children.length>60)code.firstChild.remove();let i=0;const s=n.t;
 const step=()=>{d.textContent=s.slice(0,++i);if(i<s.length)setTimeout(step,14+Math.random()*40);else{d.classList.remove('cur');setTimeout(type,250+Math.random()*900)}};step();}
function tick(){const c=document.getElementById('clk');if(c)c.textContent=new Date().toLocaleTimeString('en-US',{timeZone:'America/New_York',hour12:false})+' ET';const k=document.getElementById('sclk');if(k&&storyT&&!isNaN(storyT))k.textContent='· story '+new Date(storyT.getTime()+Date.now()-storyAt).toLocaleString('en-US',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',second:'2-digit'})}
let span,x=0;function crawlNext(){if(!span){const t=document.createElement('i');t.textContent='[[the news]]';crawl.appendChild(t);span=document.createElement('span');crawl.appendChild(span)}span.textContent=(arch.length?arch:['#thryd archive']).join('   ·   ');x=innerWidth;}
function anim(){if(span){x-=1.1;span.style.transform=`translateX(${x}px)`;if(x<-span.offsetWidth)crawlNext();}requestAnimationFrame(anim)}
load(true).then(()=>{crawlNext();anim();type()});setInterval(tick,1000);setInterval(()=>load(false),120000);})();
// 🧭 [[move]] major moves as code running over the scene (data/moves.json, from RUN/run/major_moves.json via export_state). Not on phone.html.
(()=>{if(/phone\.html$/.test(location.pathname))return;
const css=document.createElement('style');css.textContent=`#mvrun{position:fixed;top:9.2vh;left:50%;transform:translateX(-50%);width:min(46vw,64ch);z-index:6;pointer-events:none;
font:1.5vh/1.5 ui-monospace,Menlo,Consolas,monospace;color:#5f5;background:linear-gradient(#000c,#0009);border-left:.25vw solid #fb4;padding:.7vh 1vw .8vh;opacity:0;transition:opacity 1.2s;text-shadow:0 0 .4vh #000}
#mvrun.on{opacity:.92}#mvrun .h{color:#fb4;font-size:1.2vh;letter-spacing:.12em;margin-bottom:.3vh}#mvrun .h b{color:#fff;font-weight:normal}
#mvrun .l{white-space:pre-wrap;word-break:break-word;transition:opacity 1s}#mvrun .l.old{opacity:.45}#mvrun .n{color:#5f58}
#mvrun .t{color:#f7a;border:1px solid #f7a8;border-radius:.4vh;padding:0 .4vw;margin-left:.5vw;font-size:1.15vh}#mvrun .l.ty .c{color:#fcd}
#mvrun .l.cur .c::after{content:'▋';animation:blink 1s steps(1) infinite}
body.cerebro #mvrun,body.lovemap #mvrun{display:none}body.idle #mvrun.on{opacity:.75}`;document.head.appendChild(css);
const box=document.createElement('div');box.id='mvrun';box.innerHTML='<div class="h"></div>';document.body.appendChild(box);const H=box.firstChild;
const get=u=>fetch(u+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
let D=null,stCard=null,stRun=null,card=null,q=[],qi=0,timer=null,allMode=false;
const jn=c=>{const m=/^[wj](\d+)$/.exec(c||'');return m?'j'+m[1]:null;};
async function load(){const [d,st]=await Promise.all([get('data/moves.json'),get('data/state.json')]);if(d&&Array.isArray(d.moves))D=d;if(st){const at=Date.parse(st.exported_at||'');stCard=(at&&Date.now()-at<3*3600e3)?jn(st.current_card):null;stRun=st.run||null;}}
function sceneCard(){if(!D)return null;const run=D.run;
  const o=document.querySelector('#stage #objs'),k=o&&o.dataset.key||'';
  const im=[...document.querySelectorAll('#stage img.on')].map(i=>i.getAttribute('src')||'').join(' ');
  for(const s of [k,im]){if(s.indexOf(run)>=0){const m=s.match(/(?:^|[^A-Za-z0-9])(j\d+)(?![0-9])/);if(m)return m[1];}}
  if(stRun===run&&stCard)return stCard;return null;}
const linesFor=c=>D.moves.filter(m=>(m.label||jn(m.card))===c);
const cards=()=>[...new Set(D.moves.map(m=>m.label||jn(m.card)).filter(Boolean))];
function head(c){H.innerHTML=`🧭 [[move]] · ${D.run} · <b>${c||''}</b>`+(allMode?' · ↻':'');}
function start(c){card=c;q=linesFor(c);qi=0;[...box.querySelectorAll('.l')].forEach(e=>e.remove());head(c);box.classList.toggle('on',q.length>0);}
function typeLine(m,done){const d=document.createElement('div');d.className='l cur'+(m.typed?' ty':'');
  const c=document.createElement('span');c.className='c';d.appendChild(c);box.appendChild(d);
  [...box.querySelectorAll('.l')].slice(0,-1).forEach(e=>e.classList.add('old'));while(box.querySelectorAll('.l').length>5)box.querySelector('.l').remove();
  const s=`${m.label||jn(m.card)||''} ${m.code}`;let i=0;
  const step=()=>{c.textContent=s.slice(0,++i);if(i<s.length){timer=setTimeout(step,22+Math.random()*30);return;}
    d.classList.remove('cur');if(m.note&&m.note!=='typed'){const n=document.createElement('span');n.className='n';n.textContent='  // '+m.note;d.appendChild(n);}
    if(m.typed){const t=document.createElement('span');t.className='t';t.textContent='⌨ typed';d.appendChild(t);}
    timer=setTimeout(done,2600);};step();}
function loop(){clearTimeout(timer);if(!D||!D.moves.length){box.classList.remove('on');timer=setTimeout(loop,5000);return;}
  const c=sceneCard();allMode=!c;const cs=cards();
  if(allMode){if(!card||!cs.includes(card))start(cs[0]);else if(qi>=q.length){const nx=cs[(cs.indexOf(card)+1)%cs.length];timer=setTimeout(()=>{start(nx);loop();},4000);return;}}
  else if(c!==card)start(c);
  else if(qi>=q.length){timer=setTimeout(()=>{start(c);loop();},6000);return;}
  if(!q.length){timer=setTimeout(loop,3000);return;}
  typeLine(q[qi++],loop);}
load().then(loop);setInterval(load,60000);
// a scene change cuts in at the next line boundary; poll lightly
setInterval(()=>{if(!D)return;const c=sceneCard();if(c&&c!==card&&!box.querySelector('.l.cur')){clearTimeout(timer);allMode=false;start(c);loop();}},1500);
})();
