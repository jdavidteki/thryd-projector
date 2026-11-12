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
let ri=0,mvTurn=0;const next=()=>{const mv=(++mvTurn%2===0&&window.thrydMoveNext)?window.thrydMoveNext():null;if(mv)return mv;return Math.random()<.55&&real.length?{t:real[ri++%real.length],a:true}:{t:syn(),a:false};};
function type(){const n=next(),d=document.createElement('div');d.className=(n.a?'a ':'')+'cur';code.appendChild(d);
 while(code.children.length>60)code.firstChild.remove();let i=0;const s=n.t;
 const step=()=>{d.textContent=s.slice(0,++i);if(i<s.length)setTimeout(step,14+Math.random()*40);else{d.classList.remove('cur');if(n.note){const e=document.createElement('span');e.className='d';e.textContent='  // '+n.note;d.appendChild(e);}setTimeout(type,250+Math.random()*900)}};step();}
function tick(){const c=document.getElementById('clk');if(c)c.textContent=new Date().toLocaleTimeString('en-US',{timeZone:'America/New_York',hour12:false})+' ET';const k=document.getElementById('sclk');if(k&&storyT&&!isNaN(storyT))k.textContent='· story '+new Date(storyT.getTime()+Date.now()-storyAt).toLocaleString('en-US',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',second:'2-digit'})}
let span,x=0;function crawlNext(){if(!span){const t=document.createElement('i');t.textContent='[[the news]]';crawl.appendChild(t);span=document.createElement('span');crawl.appendChild(span)}span.textContent=(arch.length?arch:['#thryd archive']).join('   ·   ');x=innerWidth;}
function anim(){if(span){x-=1.1;span.style.transform=`translateX(${x}px)`;if(x<-span.offsetWidth)crawlNext();}requestAnimationFrame(anim)}
load(true).then(()=>{crawlNext();anim();type()});setInterval(tick,1000);setInterval(()=>load(false),120000);})();
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
