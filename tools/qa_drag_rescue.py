"""Headless check: a cut whose story is leaving can still be grabbed and dragged (pre-walk stagger and mid-walk),
including after >60 s low-heat idle. Usage: python3 rescue_qa.py URL [phone|desktop] [idle_ms]"""
import sys, json, asyncio
from playwright.async_api import async_playwright
BASE=sys.argv[1]; MODE=sys.argv[2] if len(sys.argv)>2 else 'phone'; IDLE=int(sys.argv[3]) if len(sys.argv)>3 else 0
PICK="""(phase)=>{const S=window.__thrydStage;const v=c=>{const r=c.el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return r.width>12&&x>10&&y>10&&x<innerWidth-10&&y<innerHeight-10&&document.elementFromPoint(x,y)===c.el?{x,y}:null};
 const groups=S.groups.filter(g=>!g.map&&!g.gone&&g.cuts.length>=2&&g.cuts.every(c=>!c.dragging));
 for(const g of groups){const vis=g.cuts.map(c=>[c,v(c)]).filter(a=>a[1]);if(vis.length<1)continue;
   S.exitGroup(g,false,'qa');
   // phase 'wait': last visible cut is still in its pre-walk stagger; 'walk': first cut, already walking
   const [c,p]=phase==='walk'?vis[0]:vis[vis.length-1];c.el.dataset.qa='rq';return {x:p.x,y:p.y,label:c.label,leaving:c.leaving,n:g.cuts.length};}
 return null}"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    if MODE=='phone': ctx=await b.new_context(viewport={'width':412,'height':860},is_mobile=True,has_touch=True,device_scale_factor=2)
    else: ctx=await b.new_context(viewport={'width':1280,'height':800})
    pg=await ctx.new_page(); cdp=await ctx.new_cdp_session(pg) if MODE=='phone' else None
    await pg.goto(BASE,wait_until='load'); await pg.wait_for_timeout(22000)
    out=[]
    for phase in ['wait','walk','wait','walk']:
      if IDLE: await pg.wait_for_timeout(IDLE)
      lh=await pg.evaluate("()=>window.LH?LH.state:'-'")
      it=await pg.evaluate(PICK,phase)
      if not it: out.append({'phase':phase,'res':'no candidate'}); continue
      if phase=='walk':
        await pg.wait_for_timeout(1500)  # let the walk-off transition start
        ok2=await pg.evaluate("()=>{const S=window.__thrydStage;const o=document.querySelector('[data-qa=rq]');if(o)delete o.dataset.qa;for(const c of S.cuts){if(!c.leaving||!c.el.style.translate)continue;const r=c.el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;if(r.width>12&&x>10&&y>10&&x<innerWidth-10&&y<innerHeight-10&&document.elementFromPoint(x,y)===c.el){c.el.dataset.qa='rq';return true;}}return false}")
        if not ok2: out.append({'phase':phase,'res':'no walking candidate in view'}); continue
      pos=await pg.evaluate("()=>{const e=document.querySelector('[data-qa=rq]');const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,l:r.left,t:r.top,pe:getComputedStyle(e).pointerEvents,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===e}}")
      x,y=pos['x'],pos['y']
      if cdp:
        await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        for i in range(1,13): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+i*5,'y':y+i*4}]}); await pg.wait_for_timeout(25)
      else:
        await pg.mouse.move(x,y); await pg.mouse.down()
        for i in range(1,13): await pg.mouse.move(x+i*5,y+i*4); await pg.wait_for_timeout(25)
      mid=await pg.evaluate("()=>{const e=document.querySelector('[data-qa=rq]');const r=e.getBoundingClientRect();return {l:r.left,t:r.top,drag:e.dataset.dragging||''}}")
      if cdp: await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
      else: await pg.mouse.up()
      await pg.wait_for_timeout(3000)
      aft=await pg.evaluate("()=>{const e=document.querySelector('[data-qa=rq]');if(!e||!e.isConnected)return {gone:true};const r=e.getBoundingClientRect();return {l:r.left,t:r.top,op:getComputedStyle(e).opacity,leaving:e.classList.contains('leaving')}}")
      d=[round(mid['l']-pos['l']),round(mid['t']-pos['t'])]
      ok=abs(d[0])+abs(d[1])>40 and not aft.get('gone') and not aft.get('leaving')
      out.append({'phase':phase,'lh_before':lh,'hit':pos['hit'],'pe':pos['pe'],'moved':d,'dragging':mid['drag'],'after3s':aft,'res':'OK' if ok else 'FAIL'})
      await pg.evaluate("()=>{const e=document.querySelector('[data-qa=rq]');if(e)delete e.dataset.qa}")
    print(json.dumps({'url':BASE,'mode':MODE,'idle':IDLE,'rescues':await pg.evaluate("()=>window.__thrydStage.rescues||0"),'out':out},indent=0))
    await b.close()
asyncio.run(main())
