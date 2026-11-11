// Committed-drop outbox. Bridge stays off until a verified collector contract.
// Raw percent anchors stay in [-50, 150]. A clamped [0,1] copy is stored beside
// them and is not the on-screen position. This file has no ntfy topic and no key.
(function(root){
  const RUN_RE=/^run-[A-Za-z0-9]+$/;
  const FRAME_RE=/^j\d+$/;
  const RAW_MIN=-50, RAW_MAX=150;
  function uuid(){
    if(root.crypto&&root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'mv-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  }
  function finite(n){return typeof n==='number'&&Number.isFinite(n);}
  function inRaw(n){return finite(n)&&n>=RAW_MIN&&n<=RAW_MAX;}
  function clamp01(n){return Math.min(1, Math.max(0, n));}
  function anchors(percent){
    if(!percent||!finite(+percent.x)||!finite(+percent.y)) return null;
    const raw={x:+percent.x, y:+percent.y};
    const fraction={x:raw.x/100, y:raw.y/100};
    const normalized={x:clamp01(fraction.x), y:clamp01(fraction.y)};
    const clamped=normalized.x!==fraction.x||normalized.y!==fraction.y;
    return {raw, fraction, normalized, clamped, inWindow:inRaw(raw.x)&&inRaw(raw.y)};
  }
  function parseScene(sceneKey){
    const key=String(sceneKey||'');
    const frame=(key.match(/(?:^|[\/_])(j\d+)(?=$|[\/_.])/)||[])[1]||null;
    const run=(key.match(/(?:^|[\/_])(run-[A-Za-z0-9]+)/)||[])[1]||null;
    return {frame, run};
  }
  function frameOf(sceneCard, parsed){
    const card=typeof sceneCard==='string'?sceneCard:'';
    const cardFrame=FRAME_RE.test(card)?card:null;
    if(cardFrame&&parsed.frame&&cardFrame!==parsed.frame) return {frame:null, conflict:true};
    return {frame:parsed.frame||cardFrame||null, conflict:false};
  }
  // object_id only from an explicit {scene, cut, object_id} row. Names are ignored.
  function resolveCut(sceneKey, cut, cutMap, sceneRun){
    if(!Array.isArray(cutMap)||!sceneKey||cut==null||cut==='') return {id:null, stale:false};
    const hit=cutMap.find(r=>r&&r.scene===sceneKey&&r.cut===cut&&typeof r.object_id==='string'&&r.object_id);
    if(!hit) return {id:null, stale:false};
    if(hit.run&&sceneRun&&hit.run!==sceneRun) return {id:null, stale:true};
    return {id:hit.object_id, stale:false};
  }
  function resolvePlace(placeId, allow){
    if(placeId==null||placeId==='') return {id:null, reason:'place_id_missing'};
    if(!Array.isArray(allow)||!allow.includes(placeId)) return {id:null, reason:'place_id_unvalidated'};
    return {id:placeId, reason:null};
  }
  function empty(){return {events:{}, order:[]};}
  function fmtRaw(p){return p?(p.x+','+p.y):'';}
  function statusText(ev){
    const story=ev.story_status==='consumed'?' · story consumed':'';
    const tail=ev.stored===false?' · not stored':'';
    const aside=ev.body&&ev.body.normalized&&ev.body.normalized.clamped?' · raw kept · normalized is not the visual':'';
    switch(ev.hold){
      case 'unmapped': return 'unmapped · no engine id'+tail;
      case 'place_id_missing': return 'setlocation · place id missing · coordinates not sent'+tail;
      case 'place_id_unvalidated': return 'setlocation · place id not validated · coordinates not sent'+tail;
      case 'raw_window': return 'raw anchor outside [-50,150] · not sent · not clipped ('+fmtRaw(ev.captured&&ev.captured.raw&&ev.captured.raw.to)+')'+tail;
      case 'stale': return 'stale scene · not sent'+tail;
      case 'missing_frame': return 'missing frame · not sent'+tail;
      case 'missing_run': return 'missing run · not sent'+tail;
      case 'noop': return 'no move · not sent';
      case 'bad_coord': return 'bad coordinates · not sent';
      case 'id_collision': return 'failed · id collision';
      default: break;
    }
    if(ev.transport_status==='pending'&&ev.reason==='bridge_off') return 'pending · bridge off · not accepted'+aside+tail;
    if(ev.transport_status==='pending') return 'pending · not accepted'+aside+story+tail;
    if(ev.transport_status==='accepted') return 'db commit accepted'+aside+story+tail;
    if(ev.transport_status==='duplicate') return 'db commit duplicate'+aside+story+tail;
    if(ev.transport_status==='rejected') return 'rejected'+(ev.reason?' · '+ev.reason:'')+tail;
    if(ev.transport_status==='failed') return 'failed'+(ev.reason?' · '+ev.reason:'')+tail;
    return 'pending · not accepted'+tail;
  }
  function createMovement(opts){
    opts=opts||{};
    const storage=opts.storage||{load:()=>null, save:()=>{}};
    const transport=opts.transport||null;
    let bridge=!!(opts.bridge&&opts.bridge.enabled);
    const newId=opts.newId||uuid;
    const onChange=opts.onChange||function(){};
    let catalog=opts.catalog||null;
    let cutMap=opts.cutMap||[];
    let placeIds=opts.placeIds||null;
    let box=empty();
    try{const loaded=storage.load(); if(loaded&&loaded.events&&Array.isArray(loaded.order)) box=loaded;}catch(e){}
    function persist(){try{storage.save(box); return true;}catch(e){return false;}}
    function touch(ev){ev.stored=persist(); ev.text=statusText(ev); try{onChange(publicView(ev));}catch(e){}}
    function publicView(ev){
      return {event_id:ev.event_id, rid:ev.rid, hold:ev.hold, schema:ev.schema, transport_status:ev.transport_status, story_status:ev.story_status, reason:ev.reason, body:ev.body, captured:ev.captured, canonical:ev.canonical, canonical_outside:ev.canonical_outside, text:ev.text, attempts:ev.attempts, seq:ev.seq};
    }
    function canSend(ev){return bridge&&transport&&ev.body&&!ev.hold&&(ev.transport_status==='pending'||ev.transport_status==='failed'||ev.transport_status==='rejected');}
    async function send(ev){
      ev.attempts=(ev.attempts||0)+1; ev.transport_status='pending'; ev.reason=null; touch(ev);
      let reply; try{reply=await transport.send(ev.body);}catch(e){ev.transport_status='failed'; ev.reason=String((e&&e.message)||e||'failed'); touch(ev); return publicView(ev);}
      applyReply(ev, reply); return publicView(ev);
    }
    function applyReply(ev, reply){
      if(!reply||reply.event_id!==ev.event_id||reply.rid!==ev.rid){ev.transport_status='failed'; ev.reason='reply_event_mismatch'; touch(ev); return;}
      if(reply.committed===false){ev.transport_status='failed'; ev.reason='not_committed'; touch(ev); return;}
      const canonical=readCanonical(reply);
      if(canonical){ev.canonical=canonical.pair; ev.canonical_outside=canonical.outside;}
      if(reply.status==='accepted'||reply.status==='duplicate'){ev.transport_status=reply.status; ev.reason=null;}
      else if(reply.status==='rejected'){ev.transport_status='rejected'; ev.reason=reply.reason||'rejected';}
      else {ev.transport_status='failed'; ev.reason='bad_reply';}
      touch(ev);
    }
    async function commit(input){
      input=input||{};
      const event_id=newId();
      const rid=event_id+'-r';
      if(box.events[event_id]){
        const ev={event_id, rid, hold:'id_collision', schema:null, transport_status:'failed', story_status:'unread', reason:'id_collision', body:null, captured:null, canonical:null, attempts:0, seq:box.order.length+1, text:''};
        touch(ev); return publicView(ev);
      }
      const ev=build(event_id, rid, input);
      ev.seq=box.order.length+1;
      box.events[event_id]=ev; box.order.push(event_id);
      if(!canSend(ev)){
        if(!ev.hold){ev.transport_status='pending'; ev.reason=bridge?'pending':'bridge_off';}
        touch(ev); return publicView(ev);
      }
      return send(ev);
    }
    function build(event_id, rid, input){
      const base={event_id, rid, hold:null, schema:null, transport_status:'pending', story_status:'unread', reason:null, body:null, captured:null, canonical:null, canonical_outside:false, attempts:0, seq:0, text:'', stored:true};
      const parsed=parseScene(input.sceneKey);
      const fr=frameOf(input.sceneCard, parsed);
      if(input.kind==='place'){
        base.schema='setlocation';
        const place=resolvePlace(input.placeId, placeIds);
        const id=resolveCut(input.sceneKey, input.cut, cutMap, parsed.run);
        base.captured={place:input.place||null, placeId:input.placeId||null, cut:input.cut||null, name:input.name||null, scene:parsed};
        if(fr.conflict){base.hold='stale'; base.transport_status='held'; base.reason='stale_context'; return base;}
        if(!place.id){base.hold=place.reason; base.transport_status='held'; base.reason=place.reason; return base;}
        if(id.stale){base.hold='stale'; base.transport_status='held'; base.reason='stale_context'; return base;}
        if(!id.id){base.hold='unmapped'; base.transport_status='held'; return base;}
        if(!parsed.run||!fr.frame){base.hold=!parsed.run?'missing_run':'missing_frame'; base.transport_status='held'; return base;}
        base.body={event_id, rid, schema:'setlocation', run:parsed.run, frame:fr.frame, object_id:id.id, place_id:place.id};
        return base;
      }
      const fromA=anchors(input.fromPercent), toA=anchors(input.toPercent);
      base.schema='pose';
      base.captured={raw:{from:fromA&&fromA.raw, to:toA&&toA.raw}, fraction:{from:fromA&&fromA.fraction, to:toA&&toA.fraction}, normalized:{from:fromA&&fromA.normalized, to:toA&&toA.normalized, clamped:!!((fromA&&fromA.clamped)||(toA&&toA.clamped))}, scene:parsed, sceneCard:input.sceneCard||null, cut:input.cut||null, name:input.name||null};
      if(!fromA||!toA){base.hold='bad_coord'; base.transport_status='held'; return base;}
      if(fromA.raw.x===toA.raw.x&&fromA.raw.y===toA.raw.y){base.hold='noop'; base.transport_status='held'; return base;}
      if(!fromA.inWindow||!toA.inWindow){base.hold='raw_window'; base.transport_status='held'; base.reason='raw_window'; return base;}
      if(fr.conflict||(input.run&&parsed.run&&input.run!==parsed.run)){base.hold='stale'; base.transport_status='held'; base.reason='stale_context'; return base;}
      const run=parsed.run||(RUN_RE.test(input.run||'')?input.run:null);
      if(!run){base.hold='missing_run'; base.transport_status='held'; return base;}
      if(!fr.frame){base.hold='missing_frame'; base.transport_status='held'; return base;}
      const id=resolveCut(input.sceneKey, input.cut, cutMap, run);
      if(id.stale){base.hold='stale'; base.transport_status='held'; base.reason='stale_context'; return base;}
      if(!id.id){base.hold='unmapped'; base.transport_status='held'; return base;}
      const clamped=fromA.clamped||toA.clamped;
      base.body={event_id, rid, run, frame:fr.frame, object_id:id.id, raw:{unit:'percent', from:fromA.raw, to:toA.raw}, normalized:{unit:'frame', from:fromA.normalized, to:toA.normalized, clamped}};
      return base;
    }
    async function retry(event_id){
      const ev=box.events[event_id]; if(!ev) return null;
      if(!ev.body||ev.hold){touch(ev); return publicView(ev);}
      if(!bridge||!transport){ev.transport_status='pending'; ev.reason='bridge_off'; touch(ev); return publicView(ev);}
      return send(ev);
    }
    function readback(ids){
      const set=new Set(ids||[]);
      box.order.forEach(id=>{const ev=box.events[id]; if(ev&&set.has(ev.event_id)){ev.story_status='consumed'; ev.text=statusText(ev);}});
      persist(); try{onChange(null);}catch(e){}
    }
    function observeState(state){
      if(!state||typeof state!=='object') return;
      if(state.run) catalog=Object.assign({}, catalog, {run:state.run});
      const raw=(state.movement_acks)||(state.movements&&state.movements.acknowledged)||null;
      if(Array.isArray(raw)) readback(raw.map(x=>typeof x==='string'?x:(x&&x.event_id)).filter(Boolean));
    }
    function lines(){return box.order.map(id=>box.events[id]).filter(Boolean).map(publicView);}
    function summary(){const evs=lines(); return evs.length?evs.slice(-4).map(e=>e.text).join('\n'):'';}
    return {commit, retry, readback, observeState, setCutMap:(rows)=>{cutMap=Array.isArray(rows)?rows:[];}, setPlaceIds:(ids)=>{placeIds=Array.isArray(ids)?ids:null;}, get:(id)=>box.events[id]?publicView(box.events[id]):null, lines, summary, setBridge:(on)=>{bridge=!!on;}, bridgeEnabled:()=>bridge};
  }
  function readCanonical(reply){
    const c=reply&&reply.canonical; if(!c||!c.from||!c.to) return null;
    const nums=[c.from.x,c.from.y,c.to.x,c.to.y].map(Number);
    if(nums.some(n=>!Number.isFinite(n))) return null;
    const pair={from:{x:nums[0],y:nums[1]}, to:{x:nums[2],y:nums[3]}};
    const outside=pair.from.x<0||pair.from.x>1||pair.from.y<0||pair.from.y>1||pair.to.x<0||pair.to.x>1||pair.to.y<0||pair.to.y>1;
    return {pair, outside};
  }
  function attach(opts){
    opts=opts||{};
    const storage={
      load(){try{return JSON.parse(localStorage.getItem('thryd_movement_outbox')||'null');}catch(e){return null;}},
      save(box){localStorage.setItem('thryd_movement_outbox', JSON.stringify(box));}
    };
    let el=null;
    const mv=createMovement({storage, bridge:{enabled:!!(opts.bridge&&opts.bridge.enabled)}, transport:opts.transport||null, cutMap:opts.cutMap||[], placeIds:opts.placeIds||null, onChange:paint});
    function paint(){
      if(typeof document==='undefined') return;
      if(!el){el=document.getElementById('mvstatus'); if(!el&&document.body){el=document.createElement('div'); el.id='mvstatus'; document.body.appendChild(el);}}
      if(!el) return;
      const text=mv.summary(); el.textContent=text;
      el.className=/^(rejected|failed)/m.test(text)?'bad':/pending|unmapped|not sent|not accepted|not validated|outside/.test(text)?'pend':'';
    }
    paint();
    return mv;
  }
  const api={createMovement, attach, anchors, parseScene, resolveCut, resolvePlace, statusText, RAW_MIN, RAW_MAX};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.ThrydMovement=api;
})(typeof window!=='undefined'?window:globalThis);
