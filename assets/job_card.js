/* Command-panel job card + menu buttons (on by default, 2026-11-26).
   When the customer opens ›_ / the typed-command box, the open job card sits
   above the existing input and the menu options sit below it as plain buttons.
   Loaded on the bare URL, ?mode=live and any ?v=. Hide with ?cards=0 (no fetch, no timer, no DOM).
   One slow poll (>=30s) only while the panel is open; paused when the tab is hidden.
   Posts go through window.thrydNtfyPost (existing intake). Never seats or runs a menu action. */
(function(root){
  'use strict';
  if(/(?:^|[?&])cards=0(?:&|$)/.test(String(location.search||''))) return;

  // v621 look (Jesuye 26 Nov 12:13 PM "make it look nice"): dark glass panel, compact drag header,
  // Literata (self-hosted 18 KB Latin subset) for the story text, full archive safe under each option,
  // capped height with the card body scrolling inside so the [[god]] header always stays grabbable.
  const CSS = [
    "@font-face{font-family:'ThrydRead';src:url('assets/fonts/literata-420.woff2') format('woff2');font-weight:300 700;font-style:normal;font-display:swap}",
    '#aibox.cards-on{width:min(94vw,660px);max-height:min(74vh,700px);max-height:min(74dvh,700px);overflow:hidden;bottom:9vh;padding:0;gap:0;border-radius:14px;background:rgba(16,15,13,.86);-webkit-backdrop-filter:blur(10px) saturate(1.1);backdrop-filter:blur(10px) saturate(1.1);border:1px solid rgba(255,215,106,.22);box-shadow:0 10px 34px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)}',
    '#aibox.cards-on #aihead{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:5px 10px 4px;font:700 12px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;color:#ffd76a;background:rgba(255,215,106,.06);border-bottom:1px solid rgba(255,255,255,.07)}',
    "#aibox.cards-on #aihead::after{content:'';flex:1 1 auto;height:4px;margin-left:6px;background:radial-gradient(circle,rgba(255,255,255,.28) 1.2px,transparent 1.6px) 0 0/7px 4px repeat-x;opacity:.8}",
    '#aibox.cards-on > form.airow{flex:0 0 auto;padding:5px 10px 0}',
    '#aibox.cards-on > .aim{flex:0 0 auto;padding:3px 12px 0;font:400 11px/1.3 ui-sans-serif,system-ui,sans-serif;color:#8f897c}',
    '#aibox.cards-on > .aic{flex:0 0 auto;padding:0 12px}',
    '#aibox.cards-on textarea{font:400 15px/1.3 "JetBrains Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.03em;min-height:40px;padding:8px 10px}#aibox.cards-on #aisend{min-height:40px;min-width:44px}',
    '#aibox.cards-on textarea::placeholder{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#7d786c}',
    '#aibox.cards-on > .aic:empty{display:none}',
    '#aicard{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:6px;padding:7px 10px 6px;border-bottom:1px solid rgba(255,255,255,.07)}',
    /* v656: only the options list scrolls; typeline + #thryd stay docked above the menu */
    '#aicard .aicbody{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:6px;padding-bottom:8px}',
    '#aicard .aicbody::-webkit-scrollbar{width:6px}#aicard .aicbody::-webkit-scrollbar-thumb{background:rgba(255,215,106,.45);border-radius:3px}',
    '#aicard .aicdock{flex:0 0 auto;display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:8px;padding:4px 0 0;background:rgba(16,15,13,.97);border-top:1px solid rgba(255,255,255,.1);position:relative;z-index:2}',
    '#aicard .aictitle{font:700 13px/1.35 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#ffe3a0;letter-spacing:.01em}',
    '#aicard .aicprompt{display:flex;flex-direction:column;gap:7px;color:#ece6d8;font:400 15px/1.6 ThrydRead,Georgia,"Times New Roman",serif;font-weight:420;letter-spacing:.003em}',
    '#aicard .aicprompt p{margin:0}',
    '#aicard .aicprompt .lead{font:600 10.5px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#c9a95a;margin-right:6px;vertical-align:1px}',
    '#aicard .aicprompt p.now{padding:8px 10px;border-left:2px solid #ffd76a;background:rgba(255,215,106,.07);border-radius:0 8px 8px 0;color:#fff6df}',
    '#aicard .aicprompt p.tap{font:italic 400 12.5px/1.45 ThrydRead,Georgia,serif;color:#a59f91}',
    '#aicard .aichelt{color:#8a8476;font:400 11px/1.45 ui-sans-serif,system-ui,sans-serif;padding-top:2px;border-top:1px dashed rgba(255,255,255,.08)}',
    '#aicard .aicopts{display:flex;flex-direction:column;gap:6px}',
    '#aicard .aicopt{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;box-sizing:border-box;text-align:left;color:#fff;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:8px 11px 8px 34px;cursor:pointer;min-height:40px;position:relative;transition:background .12s,border-color .12s;-webkit-tap-highlight-color:transparent}',
    "#aicard .aicopt::before{content:'';position:absolute;left:11px;top:11px;width:13px;height:13px;border-radius:4px;border:1.5px solid rgba(255,255,255,.35);box-sizing:border-box}",
    '#aicard .aicopt .ol{font:600 13px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#f3efe6}',
    // v633: title on its own line; numbered tweet lines flow as one wrapped paragraph
    // (verbatim, middot between them, «picked» gold); ~68% type, tight leading, so most of a safe
    // shows without scrolling; the box still scrolls a very long safe, picked line only inside it
    '#aicard .aicopt .ot{font:400 8.5px/1.25 ui-monospace,Menlo,Consolas,monospace;font-style:normal;color:#e8e0d0;display:block;width:100%;box-sizing:border-box;max-height:15em;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;cursor:text;padding:4px 6px;margin-top:2px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:8px;white-space:normal;word-break:break-word;scrollbar-width:thin;scrollbar-color:rgba(255,215,106,.45) transparent}',
    '#aicard .aicopt .ot::-webkit-scrollbar{width:4px}#aicard .aicopt .ot::-webkit-scrollbar-thumb{background:rgba(255,215,106,.45);border-radius:2px}',
    '#aicard .aicopt .ot .ott{color:#c9a95a;font:600 8.5px/1.3 ui-monospace,Menlo,Consolas,monospace;margin:0 0 2px;display:block}',
    '#aicard .aicopt .ot .otb{display:block}',
    '#aicard .aicopt .ot .otl{display:inline;white-space:pre-wrap}',
    '#aicard .aicopt .ot .ots{color:rgba(232,224,208,.4);font-weight:400}',
    '#aicard .aicopt .ot .otl.pick{color:#ffd76a;font-weight:600;background:rgba(255,215,106,.16);border-radius:2px}',
    '#aicard .aicopt.on{border-color:#ffd76a;background:rgba(255,215,106,.13)}',
    /* v647 (Jesuye 5:09 PM "it should have its own color"): the returning (hook) line, colour from data/role_colors.json via o.color */
    '#aicard .aicopt.hook{border-left:3px solid var(--hook,#ff2bd6)}#aicard .aicopt.hook .ol{color:var(--hook,#ff2bd6)}',
    '#aicard .aicopt.hook .ot .otl.pick{color:var(--hook,#ff2bd6);background:rgba(255,43,214,.14)}',
    '#aicard .aicseat .sl .hook{color:var(--hook,#ff2bd6);font-weight:600}',
    "#aicard .aicopt.on::before{background:#ffd76a;border-color:#ffd76a;box-shadow:inset 0 0 0 2.5px #2a2416}",
    '#aicard .aicopt:disabled,#aicard .aicopt[aria-disabled="true"],#aimenu button:disabled{opacity:.5;cursor:default}',
    '#aicard .aicfree{flex:1 1 auto;width:auto;min-width:0;box-sizing:border-box;font:400 15px/1.2 "JetBrains Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.03em;color:#fff;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:0 11px;height:40px;min-height:40px;max-height:40px;outline:none}',
    '#aicard .aicfree::placeholder{font:inherit;letter-spacing:.03em;color:#7d786c}',
    '#aicard .aicfree:focus{border-color:#ffd76a}',
    '#aicard .aicsend{display:flex;align-items:center;gap:10px;justify-content:flex-end}',
    '#aicard .aicnote:not(.busy):not(.ok):not(.err){display:none}#aicard .aicnote{flex:0 0 auto;min-height:0;max-width:28vw;font:500 11px/1.2 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#aicard .aicnote.busy{color:#ffd76a}#aicard .aicnote.ok{color:#7fe0a0}#aicard .aicnote.err{color:#ff8f86;font-weight:600}',
    '#aicard .aicgo{flex:0 0 auto;min-width:72px;white-space:nowrap;height:40px;min-height:40px;padding:0 12px;font:700 13px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em;color:#1a1608;background:linear-gradient(#ffe08a,#f5c84c);border:1px solid #c9a227;border-radius:10px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}',
    '#aicard .aicgo.sent{background:#1f5a34;border-color:#2f8a50;color:#e6ffee}',
    '#aicard .aicgo.err{background:#5a1f1f;border-color:#a04040;color:#ffe3e0}',
    '#aicard .aicgo.busy{opacity:.75}',
    '#aicard .aicempty{font:italic 400 14px/1.5 ThrydRead,Georgia,serif;color:#a59f91}',
    '#aimenu{flex:0 0 auto;display:flex;flex-direction:column;gap:4px;padding:5px 8px 6px;margin:0}',
    '#aimenu .aimrow{display:flex;flex-wrap:nowrap;align-items:flex-start;gap:6px;min-width:0}',
    /* v653: wrap, at most 2 rows. v654 (Jesuye 9:00 PM): the row slider auto-hides after 3s. */
    '#aimenu .aimscroll{flex:1 1 auto;min-width:0;display:flex;flex-wrap:nowrap;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;max-height:44px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(255,215,106,.45) transparent}',
    '#aimenu .aimscroll::-webkit-scrollbar{height:3px}#aimenu .aimscroll::-webkit-scrollbar-thumb{background:rgba(255,215,106,.45);border-radius:2px}',
    '#aimenu .aimscroll.aimhidebar{scrollbar-width:none;scrollbar-color:transparent transparent}',
    '#aimenu .aimscroll.aimhidebar::-webkit-scrollbar{height:0}',
    '#aimenu button{font:600 11px/1.2 ui-sans-serif,system-ui,sans-serif;color:#efe9dc;background:rgba(255,255,255,.06);border:1px solid rgba(201,169,90,.45);border-radius:999px;padding:8px 10px;cursor:pointer;min-height:40px;min-width:40px;flex:0 0 auto;white-space:nowrap;box-sizing:border-box}',
    '#aimenu button.live{border-color:rgba(255,150,140,.85);background:rgba(90,18,18,.88);color:#ffe8e6}',
    '#aimenu button.sent{border-color:#2f8a50;background:rgba(47,138,80,.22);color:#d8ffe5}',
    '#aimenu button:active,#aisheet button:active,#aicard .aicgo:active,#aicard .aicopt:active,#aibox.cards-on #aisend:active{filter:brightness(1.2)}',
    '#aimenu button.err{border-color:#a04040;background:rgba(160,64,64,.25)}',
    '#aimenu .aimlab{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
    '#aimenu .aimnote{font:500 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4;min-height:1.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#aimenu .aimnote.ok{color:#7fe0a0}#aimenu .aimnote.err{color:#ff8f86}#aimenu .aimnote.busy{color:#ffd76a}',
    // v629 seat line + lock progress + waiting state + lock banner (Jesuye 2:05 PM "make it happen")
    '#aicard .aicseat{display:flex;flex-direction:column;gap:5px;padding:7px 9px 8px;border-radius:10px;background:rgba(127,224,160,.06);border:1px solid rgba(127,224,160,.18)}',
    '#aicard .aicseat .sh{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font:600 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#a8e8bf;letter-spacing:.02em}',
    '#aicard .aicseat .sh b{color:#d8ffe5;font-weight:700}',
    '#aicard .aicseat .sl{font:400 12px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#e8e0d0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:3px 7px;background:rgba(0,0,0,.28);border-radius:6px;max-height:1.5em}',
    '#aicard .aicseat .sl div{display:block}',
    '#aicard .aicprog{display:flex;align-items:center;gap:8px;font:600 11px/1.2 ui-monospace,Menlo,Consolas,monospace;color:#d9cfb6}',
    '#aicard .aicprog .bar{flex:1 1 auto;min-width:60px;height:5px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden}',
    '#aicard .aicprog .bar i{display:block;height:100%;background:linear-gradient(90deg,#c9a95a,#ffd76a);border-radius:3px}',
    '#aicard .aicprog .nx{color:#8f897c;font-weight:500}',
    '#aicard .aicwait{display:flex;align-items:center;gap:6px;font:600 11px/1.25 ui-sans-serif,system-ui,sans-serif;color:#ffd76a;padding:8px 10px;border-radius:999px;background:rgba(255,215,106,.08);border:1px dashed rgba(255,215,106,.4);align-self:flex-start;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}',
    /* v656: next job-card alert — same pill as waiting/update-ready, not tappable, stays until the next jN replaces it */
    '#aicard .aicwait.aicalert{cursor:default;max-width:100%;pointer-events:none;box-sizing:border-box;height:24px;min-height:24px;max-height:24px;padding:0 8px;gap:6px;font:600 10.5px/24px ui-sans-serif,system-ui,sans-serif}',
    '#aicmd,#menutog{position:relative}',
    '#aicmd .aicmdalert,#menutog .aicmdalert{position:absolute;top:-7px;right:-8px;min-width:16px;height:16px;padding:0 5px;border-radius:999px;background:#ffd76a;color:#1a1608;font:700 9px/16px ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.45);white-space:nowrap}',
    '#aicard > #aicalert,#aicard > .aicwait.aicalert{flex:0 0 auto;max-width:100%;margin:0 0 2px}#aicard .aicwait.aicalert .dot{width:6px;height:6px}',
    '#aicard .aicwait .dot{width:7px;height:7px;border-radius:50%;background:#ffd76a;opacity:.85}',
    '#aicard .aicwait.aicsent.done{color:#8fe3a1;background:rgba(143,227,161,.08);border:1px solid rgba(143,227,161,.45)}',
    '#aicard .aicwait.aicsent.done .dot{background:#8fe3a1}',
    '#aicard .aicwait.aicasync{cursor:pointer;flex-wrap:wrap;max-width:100%;white-space:normal;border-radius:12px}',
    '#aicard .aicwait.aicasync .ax{display:none;width:100%;font:400 11.5px/1.4 ui-sans-serif,system-ui,sans-serif;color:#e8e0d0;padding:4px 0 1px 0;font-weight:500}',
    '#aicard .aicwait.aicasync.open .ax{display:block}',
    '#aicard .aiclock{padding:6px 9px;border-radius:8px;border:1px solid #ffd76a;background:rgba(255,215,106,.12);color:#fff3cf;font:400 12px/1.35 ui-sans-serif,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#aicard .aiclock b{display:inline;font:700 12px/1.3 ui-sans-serif,system-ui,sans-serif;color:#ffd76a;letter-spacing:.03em;margin-right:8px}',
    '#aimenu .aimrow.hot{padding:5px 6px;margin:0 -6px;border-radius:10px;background:rgba(255,215,106,.1);box-shadow:inset 0 0 0 1px rgba(255,215,106,.55)}',
    '#aimenu .aimrow.hot .aimlab{color:#ffd76a}',
    '#aimenu .aimrow.hot button{border-color:#ffd76a;color:#fff3cf}',
    '#aicfb{display:flex;flex-direction:column;gap:4px}',
    '#aicfb .aicpills{display:flex;flex-wrap:wrap;align-items:center;gap:4px}',
    /* v654 (Jesuye 8:58 PM "pills on the same level"): sheet choices are inline pills, not full-width rows. */
    '#aisheet{position:relative;margin:4px 0 0;padding:5px 8px;border:1px solid rgba(201,169,90,.35);border-radius:10px;background:rgba(0,0,0,.28);flex:0 0 auto;min-height:0;display:flex;flex-direction:column}',
    '#aisheet:has(.pcards){flex:1 1 auto}',
    '#aisheet .shrow{display:flex;align-items:center;gap:8px;margin:0 0 4px}',
    '#aisheet .sh{font:650 13px/1.3 ui-sans-serif,system-ui,sans-serif;color:#efe9dc;margin:0;flex:1;min-width:0;padding-top:0}',
    '#aisheet .shx{flex:0 0 auto;box-sizing:border-box;width:40px;height:40px;min-width:40px;min-height:40px;padding:0;border-radius:999px;font:700 20px/1 ui-sans-serif,system-ui,sans-serif;text-align:center;color:#efe9dc;background:rgba(255,255,255,.1);border:1px solid rgba(201,169,90,.55);cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '#aisheet .ht{font:500 11px/1.3 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4;margin:0 0 4px;white-space:pre-wrap}',
    '#aisheet .bd{font:500 12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#efe9dc;white-space:pre-wrap;max-height:12em;overflow:auto;margin:0 0 4px}',
    '#aisheet .opts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-height:min(36vh,220px);overflow-y:auto;overscroll-behavior:contain}',
    '#aisheet button{font:600 12px/1.2 ui-sans-serif,system-ui,sans-serif;text-align:center;color:#efe9dc;background:rgba(255,255,255,.06);border:1px solid rgba(201,169,90,.4);border-radius:999px;padding:8px 12px;cursor:pointer;min-height:40px;min-width:40px;flex:0 0 auto;white-space:nowrap;box-sizing:border-box}',
    '#aisheet button.sent{border-color:#2f8a50;background:rgba(47,138,80,.22)}',
    '#aibox.cards-on:has(#aisheet){max-height:min(74vh,700px);max-height:min(74dvh,700px);bottom:7vh}',
    '#aibox.cards-on:has(#aisheet .pcards){max-height:min(88vh,820px);max-height:min(88dvh,820px);bottom:3vh}',
    '#aicard:has(#aisheet) .aicseat .sl{display:none}',
    '#aicard:has(#aisheet) .aicseat{padding:5px 8px 6px;gap:4px}',
    '#aisheet .pcards{display:flex;flex-direction:column;gap:7px;flex:1 1 auto;min-height:10em;overflow:auto;-webkit-overflow-scrolling:touch}',
    '#aisheet .pcard{border:1px solid rgba(201,169,90,.4);border-radius:12px;padding:7px 8px;background:rgba(255,255,255,.04)}',
    '#aisheet .pcard .ppr{font:650 13px/1.35 ui-sans-serif,system-ui,sans-serif;color:#efe9dc;margin:0 0 3px}',
    '#aisheet .pcard .pfrom{font:500 10.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4;margin:0 0 3px}',
    '#aisheet .pcard .pht{font:500 11px/1.3 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4;margin:0 0 5px}',
    '#aisheet .pcard .popts{display:flex;flex-wrap:wrap;gap:5px}',
    '#aisheet .pcard .popts button{flex:0 0 auto;min-height:40px;min-width:40px;padding:8px 12px;border-radius:999px;text-align:center}',
    '#aisheet .pnav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 7px;flex:0 0 auto}',
    '#aisheet .pnav .ppos{font:500 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4}',
    '#aisheet .pnav button{min-height:40px;min-width:64px;text-align:center;border-radius:999px}',
    '#aisheet .pnav button:disabled{opacity:.4;cursor:default}',
    '#aicard .aicsent.err{color:#f2b8a8}#aicard .aicwait .aicx{margin-left:auto;flex:0 0 auto;font:700 12px/1 ui-sans-serif,system-ui,sans-serif;color:#efe9dc;background:rgba(255,255,255,.08);border:1px solid rgba(201,169,90,.45);border-radius:999px;width:22px;height:22px;padding:0;cursor:pointer}',
    '#aisheet input.aishf{width:100%;box-sizing:border-box;margin:0 0 6px;padding:8px 10px;border-radius:9px;border:1px solid rgba(201,169,90,.4);background:rgba(0,0,0,.3);color:#efe9dc;font:500 12.5px/1.3 ui-sans-serif,system-ui,sans-serif;min-height:40px}',
    '@media (max-width:520px){#aibox.cards-on{width:96vw;bottom:6vh}#aicard .aicprompt{font-size:14.5px}#aimenu{padding:4px 6px 5px}#aimenu .aimscroll{max-height:44px;gap:5px}}',
    '@media (max-height:600px){#aibox.cards-on{max-height:62vh;max-height:62dvh;bottom:5vh}#aibox.cards-on:has(#aisheet),#aibox.cards-on:has(.aicopts),#aibox.cards-on:has(.aicseed),#aibox.cards-on:has(.aiclock){max-height:84vh;max-height:84dvh;bottom:2vh}#aibox.cards-on > .aim{display:none}#aibox.cards-on:has(#aisheet) > form.airow,#aibox.cards-on:has(.aicopts) > form.airow,#aibox.cards-on:has(.aiclock) > form.airow{display:none}#aibox.cards-on > form.airow{padding-top:4px}#aibox.cards-on textarea{min-height:40px;padding:8px 10px}#aicard{gap:4px;padding:5px 8px 4px}#aicard .aicprompt{font-size:14px;line-height:1.55}#aicard .aicseat .sl{display:none}#aicard:has(#aisheet) .aicseat{display:none}#aicard:has(#aisheet) .aiclock{display:none}#aicard .aiclock{padding:4px 8px;font-size:12px}#aisheet .ht,#aisheet .pfrom{display:none}#aisheet .opts{max-height:min(28vh,132px);overflow-y:auto;-webkit-overflow-scrolling:touch}#aisheet .pcards{min-height:6em;gap:5px}#aisheet .pcard{padding:5px 7px}}',
    /* v657 (Jesuye 10:40–10:41 PM "too tight!" / "increase the length of the box"): on a short
       landscape screen the [[god]] panel uses nearly the full viewport, sitting just above the
       ticker; typeline + #thryd share one 40px row; the alert is a 24px line; both menu rows
       share one sideways-scrolling strip so the options list can show several tweet cards. */
    '@media (max-height:600px){#aibox.cards-on,#aibox.cards-on:has(#aisheet),#aibox.cards-on:has(.aicopts),#aibox.cards-on:has(.aicseed),#aibox.cards-on:has(.aiclock){height:calc(100vh - 52px);height:calc(100dvh - 52px);max-height:calc(100vh - 52px);max-height:calc(100dvh - 52px);bottom:44px}#aicard{gap:4px;padding:4px 8px 2px;border-bottom:0}#aicard .aicbody{padding-bottom:4px;min-height:45%}#aicard .aicdock{padding:2px 0 0;gap:8px}#aicard .aicopt{padding:6px 10px 6px 32px}#aicard .aicopt .ot{max-height:5.5em;padding:3px 5px}#aimenu{flex-direction:row;flex-wrap:nowrap;align-items:center;gap:8px;padding:2px 8px 4px;overflow-x:auto;overflow-y:hidden;max-height:44px;-webkit-overflow-scrolling:touch}#aimenu .aimrow{flex:0 0 auto;min-width:0}#aimenu .aimscroll{overflow:visible;max-height:none}#aimenu .aimnote{display:none}#aimenu .aimnote:not(:empty){display:none}}',
    /* v657: the dock typeline is the card typeline on every viewport; hide the command-row
       typeline while options are open so portrait does not show two inputs and two #thryd buttons. */
    '#aibox.cards-on:has(.aicopts) > form.airow,#aibox.cards-on:has(.aicdock) > form.airow{display:none}',
    /* v655: typeline stays up while a seed waits for the Medium link, on every viewport */
    '#aibox.cards-on:has(.aicseed) > form.airow,#aibox.cards-on.seed-wait > form.airow{display:flex!important}'
  ].join('\n');
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const STORE = 'thryd_card_sent';
  const POLL_MS = 30000;
  let card = null, cardSig = '', pollId = 0, userClose = false, sending = false;
  let meta = null; // v629: newest fetched payload (seat line / pending / lock), even while a sent card is kept
  // Selection lives in JS, not only in the DOM, so a poll / re-render never wipes a pick (v621).
  let sel = {job: null, values: new Set(), text: ''};
  let status = {job: null, text: '', kind: ''};
  let asyncOpen = new Set(); // v634: which async-job pills are expanded
  // v644 send_receipt (Jesuye "yes" 11/27 1:27 PM ET; j64/j66 sends that looked sent but had not reached the box):
  // a Send shows a tick only once the box answers for that exact event_id (relay reply, or open_card resolved[]).
  // No answer in RECEIPT_MS: say so plainly and offer Resend, which re-posts the SAME body / event_id, so the box
  // dedupes it (relay event_id + card_pick find_event) and it can never become a second pick.
  const RECEIPT_MS = 20000;
  let pendingSend = null;            // {job, sig, body, r, t0, state: 'waiting'|'not_received'}
  const pendingMenu = {};            // action -> {body, r, t0} awaiting a receipt / resend
  function resendFor(c){ return (pendingSend && c && pendingSend.state === 'not_received' && pendingSend.job === c.job && pendingSend.sig === optSig(c)) ? pendingSend : null; }
  function seenResolved(eid){ const j = meta || card; return !!(j && (j.resolved || []).some(x => x && x.event_id === eid)); }

  const box = () => document.getElementById('aibox');
  const AI = () => root.thrydIntentAI;
  const log = info => { try{ root.thrydLogSend && root.thrydLogSend(Object.assign({branch: 'card'}, info)); }catch(e){} };
  function sentMap(){ try{ return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }catch(e){ return {}; } }
  // v642: a send locks only the card version it was sent on. If the same jN is rebuilt with
  // new lines (or the send was consumed without a seat), the fresh card opens for a pick again.
  function optSig(c){ try{ return String((c && c.job) || '') + '|' + ((c && c.options) || []).map(o => o && o.value).join('\u241e'); }catch(e){ return ''; } }
  function markSent(job, c){ const m = sentMap(); m[job] = optSig(c && c.job === job ? c : card); try{ localStorage.setItem(STORE, JSON.stringify(m)); }catch(e){} }
  function unmarkSent(job){ const m = sentMap(); delete m[job]; try{ localStorage.setItem(STORE, JSON.stringify(m)); }catch(e){} }
  function wasSent(job, c){
    if(!job) return false; const v = sentMap()[job]; if(!v) return false;
    const ref = (c && c.job === job) ? c : ((card && card.job === job) ? card : null);
    if(!ref || !ref.options) return true;
    return v === optSig(ref);
  }
  const MENU_STORE = 'thryd_menu_sent';
  const MENU_DEDUPE_MS = 120000;
  function menuKey(run, action){ return String(run || '') + '::' + String(action || ''); }
  function menuRecent(run, action){
    try{
      const m = JSON.parse(localStorage.getItem(MENU_STORE) || '{}') || {};
      const t = +m[menuKey(run, action)] || 0;
      return t && (Date.now() - t) < MENU_DEDUPE_MS;
    }catch(e){ return false; }
  }
  function markMenu(run, action){
    try{
      const m = JSON.parse(localStorage.getItem(MENU_STORE) || '{}') || {};
      m[menuKey(run, action)] = Date.now();
      localStorage.setItem(MENU_STORE, JSON.stringify(m));
    }catch(e){}
  }
  function uid(prefix){
    try{ if(root.crypto && crypto.randomUUID) return prefix + crypto.randomUUID(); }catch(e){}
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  const sleep = ms => new Promise(z => setTimeout(z, ms));
  // v630 (Jesuye 2:39 PM "on page refresh, i should still know jump ahead has been sent"): every Send (card pick,
  // menu or lock tap) is kept in localStorage {run, job|action, label, event_id, sent_at} and shown as a
  // 'sent · time · waiting' pill until open_card.json shows that event as seated/done (resolved[] / no longer
  // pending) or the job has moved on; then '✓ done' for a few seconds and the entry is cleared.
  const SENT_LOG = 'thryd_sent_log_v630';
  const SENT_TTL = 6 * 3600 * 1000, DONE_MS = 5000;
  function sentLog(){ try{ const a = JSON.parse(localStorage.getItem(SENT_LOG) || '[]'); return Array.isArray(a) ? a.filter(e => e && e.event_id && Date.now() - (+e.sent_at || 0) < SENT_TTL) : []; }catch(e){ return []; } }
  function saveSentLog(a){
    const typed = a.filter(e => e.kind === 'typed').slice(-20), rest = a.filter(e => e.kind !== 'typed').slice(-12);   // v645: typed bursts never evict a pick / tap
    try{ localStorage.setItem(SENT_LOG, JSON.stringify(rest.concat(typed).sort((x, y) => (+x.sent_at || 0) - (+y.sent_at || 0)))); }catch(e){}
  }
  function logSent(e){ const a = sentLog().filter(x => x.event_id !== e.event_id); a.push(Object.assign({sent_at: Date.now()}, e)); saveSentLog(a); if(e.kind !== 'typed') kickLane(); pillTick(); }
  // v645 (Jesuye 11/27 1:59 PM pills hung on 'waiting'; 2:00 PM "add an x next to a waiting status in case we want to
  // cancel the request"): each pill reads the box's plain answer (open_card note / relay reply), says so when the box
  // has not confirmed, and a \u2715 cancels the request by event_id: the card unlocks at once, the box drops the event if
  // it has not acted on it yet, and says plainly when it already has. A cancel never unseats anything.
  const NOTE_MS = 15000, QUIET_MS = 180000, TYPED_SHOW_MS = 3000, TYPED_TTL = 600000;
  function patchSent(eid, patch){ const a = sentLog(); const e = a.find(x => x.event_id === eid); if(!e) return null; Object.assign(e, patch); saveSentLog(a); return e; }
  function dropSent(eids){ const set = new Set(eids); saveSentLog(sentLog().filter(e => !set.has(e.event_id))); }
  function pillWhat(e){ return e.kind === 'pick' ? (e.job + ' pick') : (e.kind === 'typed' ? (e.label || 'typed line') : (e.label || e.action || 'tap')); }
  function pillState(e, j, now){
    now = now || Date.now();
    const what = pillWhat(e);
    const res = j && (j.resolved || []).find(x => x && x.event_id === e.event_id);
    const p = (j && j.pending) || {};
    const pend = (p.pick && p.pick.event_id === e.event_id) ? p.pick : (p.menu || []).find(x => x && x.event_id === e.event_id);
    const note = (res && res.note) || (pend && pend.note) || e.note || '';
    if(e.cancel === 'cancelled' || (res && res.status === 'cancelled')) return {text: '\u2715 ' + what + ' cancelled', cls: 'done', x: false};
    if(e.cancel === 'too_late') return {text: what + ' \u00b7 ' + (e.note || 'already done \u2014 can\u2019t cancel'), cls: 'done', x: false};
    if(e.done_at) return {text: note ? (what + ' \u00b7 ' + note) : ('\u2713 ' + what + ' done'), cls: 'done', x: false};
    if(e.cancel === 'sending' && now - (+e.cancel_at || 0) < 45000) return {text: what + ' \u00b7 cancelling\u2026', cls: 'busy', x: false};
    if(e.cancel === 'sending' || e.cancel === 'unconfirmed') return {text: what + ' \u00b7 cancel not confirmed \u00b7 tap \u2715 to retry', cls: 'err', x: true};
    const tm = e.sent_at ? hhmm(new Date(+e.sent_at).toISOString()) : '';
    const head = what + ' sent' + (tm ? ' \u00b7 ' + tm : '');
    if(note) return {text: head + ' \u00b7 ' + note, cls: '', x: true};
    const age = now - (+e.sent_at || 0);
    if(e.receipt_at || pend) return {text: head + (age > QUIET_MS ? ' \u00b7 received, no answer yet' : ' \u00b7 received \u00b7 waiting'), cls: '', x: true};
    if(e.unconfirmed || age > RECEIPT_MS + 2000) return {text: head + ' \u00b7 box hasn\u2019t confirmed', cls: 'err', x: true};
    return {text: head + ' \u00b7 waiting', cls: '', x: true};
  }
  let pillT = 0;
  function pillTick(){
    if(pillT) return;
    pillT = setInterval(() => {
      const live = sentLog().filter(e => !e.done_at);
      if(!live.length){ clearInterval(pillT); pillT = 0; }
      try{ settleSent(meta || card); updateStrip(); }catch(err){}
    }, 5000);
  }
  // the card / tap can be sent again at once after a cancel
  function liftLock(e){
    if(e.kind === 'pick'){
      unmarkSent(e.job);
      if(pendingSend && pendingSend.body && pendingSend.body.event_id === e.event_id) pendingSend = null;
      if(card && card.job === e.job) status = {job: e.job, text: 'Cancelled \u2014 pick again when you\u2019re ready.', kind: ''};
    } else if(e.kind === 'menu'){
      Object.keys(pendingMenu).forEach(k => { if(pendingMenu[k] && pendingMenu[k].body && pendingMenu[k].body.event_id === e.event_id) delete pendingMenu[k]; });
      try{ const mm = JSON.parse(localStorage.getItem(MENU_STORE) || '{}') || {}; delete mm[menuKey(e.run, e.action)]; localStorage.setItem(MENU_STORE, JSON.stringify(mm)); }catch(err){}
    }
  }
  function relock(e){ if(e.kind === 'pick' && card && card.job === e.job) markSent(e.job, card); else if(e.kind === 'menu') markMenu(e.run, e.action); }
  function cancelBody(e, cid){
    return {v:1, type:'cancel', event_id:cid, rid:cid + '-r', target:e.event_id,
      target_type: e.kind === 'pick' ? 'card_pick' : (e.kind === 'typed' ? 'call' : 'menu_action'),
      run: e.run || (card && card.run) || undefined, source:'projector', client_ts:new Date().toISOString()};
  }
  async function cancelSent(eid){
    const e = sentLog().find(x => x.event_id === eid);
    if(!e || e.done_at || (e.cancel === 'sending' && Date.now() - (+e.cancel_at || 0) < 45000)) return;
    const cid = e.cancel_id || uid('cancel-');                 // a retry re-sends the SAME cancel (the box dedupes it)
    patchSent(eid, {cancel: 'sending', cancel_id: cid, cancel_at: Date.now()});
    liftLock(e);
    try{ render(); }catch(err){}
    log({event: 'cancel', target: eid, kind: e.kind});
    const body = cancelBody(e, cid);
    let m = null;
    try{ const r = await post(body); if(r && r.ok) m = await awaitReply(body, Math.floor(Date.now() / 1000) - 5, r, RECEIPT_MS); }catch(err){}
    applyCancel(eid, m);
  }
  function applyCancel(eid, m){
    const e = sentLog().find(x => x.event_id === eid); if(!e) return null;
    let out;
    if(m && m.status === 'too_late'){ out = patchSent(eid, {cancel: 'too_late', note: m.note || 'already done \u2014 can\u2019t cancel', done_at: Date.now()}); relock(e); }
    else if(m && (m.status === 'cancelled' || m.ok)) out = patchSent(eid, {cancel: 'cancelled', done_at: Date.now()});
    else out = patchSent(eid, {cancel: 'unconfirmed'});
    try{ updateStrip(); }catch(err){}
    setTimeout(() => { try{ settleSent(meta || card); updateStrip(); }catch(err){} }, NOTE_MS + 300);
    return out;
  }
  // a \u2715 for a waiting entry this browser did not send (open_card pending): adopt it into the log, then cancel
  function adoptX(e){
    const x = document.createElement('button'); x.type = 'button'; x.className = 'aicx'; x.textContent = '\u2715';
    x.title = 'cancel this request'; x.setAttribute('aria-label', 'cancel ' + pillWhat(e));
    tapOnce(x, () => { if(!sentLog().some(y => y.event_id === e.event_id)) logSent(Object.assign({sent_at: Date.now()}, e)); cancelSent(e.event_id); });
    return x;
  }
  function cancelTyped(){ sentLog().filter(e => e.kind === 'typed' && !e.done_at && e.cancel !== 'sending').forEach(e => cancelSent(e.event_id)); }
  // typed lines (the typeline's own 'call' posts) get one shared pill while the box has not answered them
  let typedT = 0;
  function watchTyped(){
    if(typedT) return;
    typedT = setInterval(typedPoll, 3000);
  }
  async function typedPoll(){
    {
      const ws = sentLog().filter(e => e.kind === 'typed' && !e.done_at && !e.cancel);
      const old = sentLog().filter(e => e.kind === 'typed' && Date.now() - (+e.sent_at || 0) > TYPED_TTL).map(e => e.event_id);
      if(old.length) dropSent(old);
      if(!ws.length){ clearInterval(typedT); typedT = 0; try{ updateStrip(); }catch(err){} return; }
      const bases = {};
      ws.forEach(e => { if(e.reply) (bases[e.reply] = bases[e.reply] || []).push(e); });
      const got = [];
      for(const base of Object.keys(bases)){
        const t0 = Math.min.apply(null, bases[base].map(e => Math.floor((+e.sent_at || 0) / 1000) - 5));
        try{
          const getter = root.thrydNtfyGet || ((u, ms) => fetch(u, {cache: 'no-store'}));
          const tx = await (await getter(base + '/json?poll=1&since=' + t0, 8000)).text();
          const ids = new Set();
          for(const l of String(tx).split('\n')){ if(!l) continue; try{ const m = JSON.parse(JSON.parse(l).message || '{}'); if(m.event_id) ids.add(m.event_id); if(m.rid) ids.add(m.rid); }catch(err){} }
          bases[base].forEach(e => { if(ids.has(e.event_id) || ids.has(e.event_id + '-r') || (e.rid && ids.has(e.rid))) got.push(e.event_id); });
        }catch(err){}
      }
      if(got.length) dropSent(got);
      try{ updateStrip(); }catch(err){}
    }
  }
  function hookTyped(){
    const tl = root.thrydTypelinePost;
    if(!tl || tl._v645) return !!tl;
    const w = async function(body, kind){
      const r = await tl.apply(this, arguments);
      try{
        if(body && body.type === 'call' && body.source === 'cli' && body.event_id && r && r.ok){
          const reply = r.reply || (r.endpoint ? String(r.endpoint).replace(/\/?$/, '') + '-r' : null);
          logSent({kind: 'typed', run: card && card.run, label: String(body.raw || body.text || 'typed line').slice(0, 40), event_id: body.event_id, rid: body.rid, reply});
          watchTyped();
        }
      }catch(err){}
      return r;
    };
    w._v645 = true; root.thrydTypelinePost = w; return true;
  }
  function jn(j){ const m = /^j(\d+)$/i.exec(String(j || '')); return m ? +m[1] : 0; }
  function atMs(iso){ const t = Date.parse(iso || ''); return isNaN(t) ? 0 : t; }
  // is a sent entry finished, judged from an open_card payload?
  function sentResolved(e, j){
    if(!e || !j) return false;
    if((j.resolved || []).some(x => x && x.event_id === e.event_id)) return true;
    const p = j.pending || {};
    const stillPending = (p.pick && p.pick.event_id === e.event_id) || (p.menu || []).some(x => x && x.event_id === e.event_id);
    if(stillPending) return false;
    if(j.run && e.run && j.run !== e.run) return true;
    if(e.kind === 'pick'){
      if(j.last_seat && j.last_seat.job === e.job) return true;
      if(j.open && jn(j.job) > jn(e.job)) return true;
      return false;
    }
    // menu / lock tap: the job moved on since it was sent
    if(e.job && j.job && jn(j.job) > jn(e.job)) return true;
    if(!e.job && j.open && j.job && atMs(j.at) > (+e.sent_at || 0) + 15000) return true;
    return false;
  }
  function settleSent(j){
    const a = sentLog(); let changed = false;
    a.forEach(e => {
      if(e.kind === 'typed') return;
      const res = j && (j.resolved || []).find(x => x && x.event_id === e.event_id);
      if(res && res.note && e.note !== res.note){ e.note = res.note; changed = true; }
      if(res && res.status === 'cancelled' && !e.cancel){ e.cancel = 'cancelled'; changed = true; }
      if(!e.done_at && sentResolved(e, j)){ e.done_at = Date.now(); changed = true; }
    });
    const keep = a.filter(e => !(e.done_at && Date.now() - e.done_at > ((e.note || e.cancel) ? NOTE_MS : DONE_MS)));
    if(changed || keep.length !== a.length) saveSentLog(keep);
    if(changed) setTimeout(() => { try{ settleSent(meta || card); updateStrip(); }catch(e){} }, NOTE_MS + 200);
    return changed;
  }
  function sentPills(run){
    const j = meta || card, now = Date.now();
    const all = sentLog().filter(e => !run || !e.run || e.run === run);
    const pill = (text, cls, onX, xLabel, eid) => {
      const w = document.createElement('div'); w.className = 'aicwait aicsent' + (cls ? ' ' + cls : ''); w.setAttribute('role', 'status');
      if(eid) w.dataset.eid = eid;
      const d = document.createElement('span'); d.className = 'dot'; w.appendChild(d);
      const t = document.createElement('span'); t.textContent = text; w.appendChild(t);
      if(onX){ const x = document.createElement('button'); x.type = 'button'; x.className = 'aicx'; x.textContent = '\u2715'; x.title = 'cancel this request'; x.setAttribute('aria-label', 'cancel ' + xLabel); tapOnce(x, onX); w.appendChild(x); }
      return w;
    };
    const out = all.filter(e => e.kind !== 'typed').map(e => { const s = pillState(e, j, now); return pill(s.text, s.cls, s.x ? () => cancelSent(e.event_id) : null, pillWhat(e), e.event_id); });
    const typed = all.filter(e => e.kind === 'typed' && (e.cancel || e.done_at || now - (+e.sent_at || 0) > TYPED_SHOW_MS));
    const tw = typed.filter(e => !e.cancel && !e.done_at);
    if(tw.length){
      const n = tw.length, tm = hhmm(new Date(+tw[0].sent_at).toISOString());
      const late = now - (+tw[0].sent_at || 0) > RECEIPT_MS + 2000;
      out.push(pill((n === 1 ? ('\u201c' + tw[0].label + '\u201d') : (n + ' typed lines')) + ' sent' + (tm ? ' \u00b7 ' + tm : '') + (late ? ' \u00b7 box hasn\u2019t answered' : ' \u00b7 waiting'), late ? 'err' : '', cancelTyped, 'typed lines'));
    }
    typed.filter(e => e.cancel || e.done_at).forEach(e => { const s = pillState(e, j, now); out.push(pill(s.text, s.cls, s.x ? () => cancelSent(e.event_id) : null, pillWhat(e), e.event_id)); });
    return out;
  }
  // v630 card lane: the box publishes each changed open card to ntfy <drag topic>-c (chunked) the moment it is
  // seated, so the panel need not wait for a Pages build. Polled every 5 s only while a Send is waiting (max 6 min).
  let laneTimer = 0;
  function laneBase(){
    const DG = (root.thrydDrag && root.thrydDrag()) || root.DRAG || {};
    return DG.endpoint ? String(DG.endpoint).replace(/\/?$/, '') + '-c' : null;
  }
  async function laneFetch(){
    const base = laneBase(); if(!base) return null;
    const getter = root.thrydNtfyGet || ((u, ms) => fetch(u, {cache: 'no-store'}));
    const tx = await (await getter(base + '/json?poll=1&since=15m', 8000)).text();
    const by = {};
    for(const l of String(tx).split('\n')){
      if(!l) continue; let m, x;
      try{ m = JSON.parse(l); x = JSON.parse(m.message || '{}'); }catch(e){ continue; }
      if(!x || x.k !== 'open_card' || !x.id) continue;
      const g = by[x.id] = by[x.id] || {n: x.n, parts: {}, t: 0};
      g.parts[x.i] = x.part; g.t = Math.max(g.t, +m.time || 0);
    }
    let best = null;
    Object.keys(by).forEach(id => { const g = by[id]; if(Object.keys(g.parts).length === g.n && (!best || g.t > best.t)) best = g; });
    if(!best) return null;
    try{ let raw = ''; for(let i = 0; i < best.n; i++) raw += best.parts[i]; return JSON.parse(raw); }catch(e){ return null; }
  }
  // v632 (Jesuye 3:00 PM "pls implement!"): the lane is read ALWAYS, not only while a Send waits: one ntfy SSE
  // stream (EventSource, idle = no CPU, no polling) with since=10m, reopened when the tab comes back; if the stream
  // cannot open, a 10 s JSON poll. Whichever of lane or Pages has the newest `at` wins; chunks dedupe by card id.
  let es = null, esFails = 0, laneBuf = {}, laneSeen = '';
  function laneTake(x, t){
    if(!x || x.k !== 'open_card' || !x.id || x.id === laneSeen) return;
    const g = laneBuf[x.id] = laneBuf[x.id] || {n: x.n, parts: {}, t: 0};
    g.parts[x.i] = x.part; g.t = Math.max(g.t, +t || 0);
    if(Object.keys(g.parts).length !== g.n) return;
    let j = null; try{ let raw = ''; for(let i = 0; i < g.n; i++) raw += g.parts[i]; j = JSON.parse(raw); }catch(e){ return; }
    delete laneBuf[x.id];
    laneOffer(j, x.id);
  }
  function laneOffer(j, id){
    if(!j || typeof j !== 'object') return;
    if(id) laneSeen = id;
    if(meta && atMs(j.at) <= atMs(meta.at)) return;           // not newer than what we show
    applyCard(j, 'lane');
  }
  function laneTick(){
    laneTimer = 0;
    if(document.hidden || (es && es.readyState !== 2)) return;
    laneFetch().then(j => laneOffer(j)).catch(() => {})
      .finally(() => { if(!laneTimer && !(es && es.readyState !== 2)) laneTimer = setTimeout(laneTick, 10000); });
  }
  let laneBaseP = null;
  function laneBaseAsync(){
    const b = laneBase(); if(b) return Promise.resolve(b);
    if(!laneBaseP) laneBaseP = fetch('data/drag.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null)
      .then(d => (d && d.endpoint) ? String(d.endpoint).replace(/\/?$/, '') + '-c' : null).catch(() => null)
      .finally(() => { setTimeout(() => { laneBaseP = null; }, 30000); });
    return laneBaseP;
  }
  function laneOpen(){
    if(document.hidden || (es && es.readyState !== 2)) return;
    laneBaseAsync().then(base => {
      if(!base || document.hidden || (es && es.readyState !== 2)) return;
      if(typeof root.EventSource !== 'function' || esFails >= 3){ if(!laneTimer) laneTimer = setTimeout(laneTick, 500); return; }
      try{
        es = new EventSource(base + '/sse?since=10m');
        es.onopen = () => { esFails = 0; };
        es.onmessage = ev => { try{ const m = JSON.parse(ev.data); if(m && m.message) laneTake(JSON.parse(m.message), m.time); }catch(e){} };
        es.onerror = () => { if(es && es.readyState === 2){ esFails++; es = null; setTimeout(laneOpen, 5000 * esFails); } };
      }catch(e){ esFails++; es = null; if(!laneTimer) laneTimer = setTimeout(laneTick, 500); }
    });
  }
  function laneClose(){ try{ es && es.close(); }catch(e){} es = null; if(laneTimer){ clearTimeout(laneTimer); laneTimer = 0; } }
  document.addEventListener('visibilitychange', () => { if(document.hidden) laneClose(); else laneOpen(); });
  function kickLane(){ laneOpen(); if(!laneTimer) laneTimer = setTimeout(laneTick, 1500); }
  // v622 (Jesuye 12:39 PM "there is a http error", HTTP 429): card picks and menu taps no longer share the
  // busy drag/drift lane. They go through the typeline lane (own ntfy.sh topic, plus the independent backup
  // host ntfy.envs.net in parallel after 8 s), and a 429 / network failure backs off (Retry-After) and retries
  // on its own, up to 3 tries, before anything is shown as an error.
  function friendly(x){
    const t = String((x && (x.message || x.status)) || x || '');
    if(/429/.test(t)) return 'the network is busy right now';
    if(/timed? ?out|timeout/i.test(t)) return 'the network timed out';
    if(/no_endpoint|intake not loaded/i.test(t)) return 'the page is still loading \u00b7 reload it';
    if(/failed to fetch|network/i.test(t)) return 'no connection';
    return t || 'no response';
  }
  async function post(body, onRetry){
    const tl = root.thrydTypelinePost, np = root.thrydNtfyPost;
    if(!tl && !np) throw new Error('intake not loaded \u00b7 reload the page');
    let lastR = null, lastE = null;
    for(let i = 0; i < 3; i++){
      lastR = null; lastE = null;
      try{
        const r = tl ? await tl(body, 'card') : await np(body, 'call');
        if(r && r.ok) return r;
        lastR = r;
      }catch(e){ lastE = e; }
      if(i === 2) break;
      let wait = i ? 8000 : 3000;
      const ra = lastR && lastR.retryAfter; const n = parseInt(ra, 10);
      if(isFinite(n)) wait = Math.min(30000, Math.max(1000, n * 1000));
      log({event: 'post_retry', type: body.type, try: i + 1, wait, why: lastR ? ('HTTP ' + lastR.status) : String(lastE && lastE.message || lastE)});
      try{ onRetry && onRetry(i + 1, wait, lastR ? ('HTTP ' + lastR.status) : lastE); }catch(e){}
      await sleep(wait);
    }
    if(lastR) return lastR;
    throw lastE || new Error('no response');
  }
  // Wait for the validator's answer on the reply topic (same pattern as stage.js taps).
  async function awaitReply(body, t0, r, limitMs, waits){
    const DG = (root.thrydDrag && root.thrydDrag()) || root.DRAG || {};
    // the reply comes back on <the topic it was posted to>-r (relay.py); backup posts carry r.reply
    const base = (r && r.reply) || (r && r.endpoint ? String(r.endpoint).replace(/\/?$/, '') + '-r' : null) || DG.reply || (DG.endpoint ? String(DG.endpoint).replace(/\/?$/, '') + '-r' : null);
    const plan = waits || (limitMs ? [1000, 1500, 2000, 2500, 3000, 4000, 6000] : [1500, 2500, 4000, 6000, 8000, 12000]);
    let spent = 0;
    for(const w of plan){
      if(limitMs && spent >= limitMs) break;
      await sleep(w); spent += w;
      if(seenResolved(body.event_id)) return {ok: true, status: 'seated', event_id: body.event_id, via: 'open_card'};   // v644: the seat itself is a receipt
      if(!base) continue;
      try{
        const getter = root.thrydNtfyGet || ((u, ms) => fetch(u, {cache: 'no-store'}));
        const tx = await (await getter(base + '/json?poll=1&since=' + t0, 8000)).text();
        for(const l of String(tx).split('\n')){ if(!l) continue; let m; try{ m = JSON.parse(l); m = JSON.parse(m.message || '{}'); }catch(e){ continue; }
          if(m.rid === body.rid || m.event_id === body.event_id) return m; }
      }catch(e){}
    }
    return null;
  }
  function isLiveOpt(o){ return /^\s*\ud83c\udfa5\s*$/.test(String((o && o.label) || '')) || (/^j\d+:\s*\ud83c\udfa5\s*$/i.test(String((o && o.value) || ''))); }
  // Pull the tweet line out of an option: explicit `line`, else the value without its "jN: " prefix.
  function tweetLine(o){
    if(o && typeof o.line === 'string') return o.line;
    const v = String((o && o.value) || '').replace(/^j\d+:\s*/i, '');
    return /^\s*\ud83c\udfa5\s*$/.test(v) ? '' : v;
  }

  // Keep the dragged box (and its [[god]] header) on screen after it grows or the window resizes.
  function reclamp(){
    // v623: same rule as the drag (intent_ai.js clampPos): the box may hang off an edge, the [[god]] header strip may not
    const ai = AI(); if(ai && typeof ai.clampBox === 'function'){ try{ ai.clampBox(); }catch(e){} }
  }
  addEventListener('resize', () => { try{ reclamp(); liftForKeyboard(); }catch(e){} }, {passive: true});

  // v656: keep the docked typeline above the on-screen keyboard (visualViewport on iOS/Android).
  function keyboardGap(){
    const vv = window.visualViewport;
    if(!vv) return 0;
    return Math.max(0, (window.innerHeight || 0) - (vv.height + vv.offsetTop));
  }
  function liftForKeyboard(){
    const b = document.getElementById('aibox');
    if(!b || !b.classList.contains('on')) return;
    const vv = window.visualViewport;
    const gap = keyboardGap();
    if(gap > 40 && vv){
      b.dataset.kbLift = '1';
      b.style.maxHeight = Math.max(160, Math.floor(vv.height - 12)) + 'px';
      const dragged = !!(b.style.top && b.style.top !== 'auto');
      if(dragged){
        if(b.dataset.kbTop == null) b.dataset.kbTop = b.style.top;
        const r = b.getBoundingClientRect();
        const vvBottom = vv.offsetTop + vv.height;
        if(r.bottom > vvBottom - 8){
          b.style.top = Math.max(0, r.top - (r.bottom - (vvBottom - 8))) + 'px';
        }
      } else {
        b.style.bottom = (gap + 8) + 'px';
      }
    } else if(b.dataset.kbLift){
      delete b.dataset.kbLift;
      b.style.maxHeight = '';
      if(b.dataset.kbTop != null){ b.style.top = b.dataset.kbTop; delete b.dataset.kbTop; }
      else if(!(b.style.top && b.style.top !== 'auto')) b.style.bottom = '';
      try{ reclamp(); }catch(e){}
    }
  }
  function armKeyboardLift(){
    if(armKeyboardLift.done) return;
    armKeyboardLift.done = true;
    const vv = window.visualViewport;
    if(vv){
      const go = () => { try{ liftForKeyboard(); }catch(e){} };
      vv.addEventListener('resize', go, {passive: true});
      vv.addEventListener('scroll', go, {passive: true});
    }
    addEventListener('focusin', ev => {
      const t = ev.target;
      if(t && t.closest && t.closest('#aicard .aicdock, #aicard .aicfree, form.airow')) setTimeout(() => { try{ liftForKeyboard(); }catch(e){} }, 50);
    }, true);
    addEventListener('focusout', () => setTimeout(() => { try{ liftForKeyboard(); }catch(e){} }, 80), true);
  }

  function mount(){
    const b = box(); if(!b) return;
    b.classList.add('cards-on');
    try{ const ta = b.querySelector('form.airow textarea'); if(ta && innerWidth < 560) ta.placeholder = 'type a call \u00b7 or say it'; }catch(e){}
    let jobEl = document.getElementById('aicard');
    if(!jobEl){
      jobEl = document.createElement('div'); jobEl.id = 'aicard';
      const form = b.querySelector('form.airow') || b.firstChild;
      b.insertBefore(jobEl, form);
    }
    let menuEl = document.getElementById('aimenu');
    if(!menuEl){
      menuEl = document.createElement('div'); menuEl.id = 'aimenu';
      b.appendChild(menuEl);
    }
    armKeyboardLift();
    return {jobEl, menuEl};
  }

  const LEADS = [/^(Where things stand:)\s*/i, /^(What just happened:)\s*/i, /^(\ud83d\udcd6 Now:)\s*/];
  function promptEl(text){
    const lines = stripTownhallEcho(String(text || '')).split('\n').map(x => x.trim()).filter(Boolean);
    const frag = document.createDocumentFragment();
    if(!lines.length) return frag;
    const t = document.createElement('div'); t.className = 'aictitle'; t.textContent = lines[0]; frag.appendChild(t);
    const body = document.createElement('div'); body.className = 'aicprompt';
    lines.slice(1).forEach(line => {
      const p = document.createElement('p');
      let lead = null;
      for(const re of LEADS){ const m = line.match(re); if(m){ lead = m[1]; line = line.slice(m[0].length); break; } }
      if(lead){ const s = document.createElement('span'); s.className = 'lead'; s.textContent = lead.replace(/:$/, ''); p.appendChild(s); }
      else if(/tapped .* times/i.test(line)) p.className = 'tap';
      if(lead && /Now/.test(lead)) p.className = 'now';
      p.appendChild(document.createTextNode(line));
      body.appendChild(p);
    });
    frag.appendChild(body);
    return frag;
  }

  function setStatus(text, kind){
    status = {job: card && card.job, text: text || '', kind: kind || ''};
    const n = document.getElementById('aicnote');
    if(n){ n.textContent = status.text; n.className = 'aicnote' + (status.kind ? ' ' + status.kind : ''); }
  }
  const note = setStatus;

  // v627 (Jesuye 1:26 PM "add publish to the lock menu and remove hold and tweets from the menu")
  // v637: Hold and Tweets are back on the main row (full [[god]] navigator). Jump ahead stays lock-only.
  const PUBLISH = {label: '\ud83d\udce3 Publish', value: 'publish!'};
  function withPublish(lock){
    const out = (lock || []).slice();
    if(!out.length || out.some(o => /^(lock:\s*)?publish!?$/i.test(String(o.value || '').trim()))) return out;
    const i = out.findIndex(o => /jump ahead/i.test(String(o.value || '')));
    if(i < 0) out.push(PUBLISH); else out.splice(i, 0, PUBLISH);
    return out;
  }

  // v628: full archive safe (chat option description) under each option.
  // v659: never render an X/Twitter status URL or the old 'tweet, date, x.com/i/status/…' header.
  // Status ids may exist on the option as `_source` but are not shown. 🎥 keeps its live-view text.
    function stripTownhallEcho(s){
    return String(s || '').replace(/(?:^|\n)[ \t]*townhall\.night\s*\{[\s\S]*?\}/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  }
function stripTweetUrls(s){
    if(s == null) return '';
    s = String(s);
    if(/^\s*a live view of the scene so far\s*$/i.test(s)) return s.trim();
    s = s.replace(/tweet(?:,\s*(?:19|20)\d\d-\d\d-\d\d)?,?\s*(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/i\/status\/\d+\s*:?\s*/gi, '');
    s = s.replace(/(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/(?:[A-Za-z0-9_]+\/)?status\/\d+\S*/gi, '');
    s = s.replace(/(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com(?:\/\S*)?/gi, '');
    s = s.replace(/\s*\+\s*/g, ' / ');
    s = s.replace(/\s*:\s+(?=\d+\.\s)/g, ' / ');
    s = s.replace(/(?:^|\s)\/\s*\/\s*/g, ' / ').replace(/^\s*\/\s*/, '').replace(/\s*\/\s*$/, '');
    return s.replace(/[ \t]{2,}/g, ' ').trim();
  }
  function safeText(o){
    let raw = '';
    if(o && typeof o.safe === 'string' && o.safe.trim()) raw = o.safe;
    else if(o && typeof o.description === 'string' && o.description.trim()) raw = o.description;
    if(!raw) return '';
    if(typeof isLiveOpt === 'function' && isLiveOpt(o)) return raw;
    return stripTweetUrls(raw);
  }
  function safeRows(text){
    let s = String(text || '').replace(/\s+$/, '');
    let year = '';
    const ym = s.match(/\s+(\d{4})$/);
    if(ym){ year = ym[1]; s = s.slice(0, ym.index); }
    const m = s.match(/:\s+(?=\d+\.\s)/);
    let title = '', rows = [];
    if(m){
      title = s.slice(0, m.index).trim();
      rows = s.slice(m.index + m[0].length).split(' / ').map(x => x.trim()).filter(Boolean);
    } else if(s){
      rows = [s];
    }
    if(year) title = title ? (title + ' \u00b7 ' + year) : year;
    return {title, rows};
  }
  function fillSafe(el, text){
    const {title, rows} = safeRows(text);
    el.textContent = '';
    if(title){ const h = document.createElement('div'); h.className = 'ott'; h.textContent = title; el.appendChild(h); }
    let pick = null;
    if(rows.length){
      const body = document.createElement('div'); body.className = 'otb';
      rows.forEach((line, i) => {
        if(i){ const sep = document.createElement('span'); sep.className = 'ots'; sep.textContent = ' \u00b7 '; body.appendChild(sep); }
        const r = document.createElement('span'); r.className = 'otl';
        if(/\u00ab[\s\S]*\u00bb/.test(line)){ r.classList.add('pick'); pick = r; }
        r.textContent = line;
        body.appendChild(r);
      });
      el.appendChild(body);
    }
    return pick;
  }

  // v629: seat line, lock progress, waiting-to-be-seated, lock state. Data: open_card.json last_seat / pending / lines.
  function hhmm(iso){
    try{ const d = new Date(iso); if(isNaN(d)) return ''; return d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); }catch(e){ return ''; }
  }
  function isLocked(m){ return !!(m && (m.lock_open || (m.next_lock_at_lines && m.lines >= m.next_lock_at_lines))); }
  function progressEl(m){
    if(!m || !m.next_lock_at_lines) return null;
    const at = +m.next_lock_at_lines, n = Math.max(0, +m.lines || 0);
    const p = document.createElement('div'); p.className = 'aicprog';
    const t = document.createElement('span'); t.className = 'n'; t.textContent = Math.min(n, 99999) + '/' + at; p.appendChild(t);
    const bar = document.createElement('span'); bar.className = 'bar'; const fill = document.createElement('i');
    fill.style.width = Math.max(2, Math.min(100, Math.round(100 * n / at))) + '%'; bar.appendChild(fill); p.appendChild(bar);
    const nx = document.createElement('span'); nx.className = 'nx';
    nx.textContent = isLocked(m) ? 'locked' : ('next lock at ' + at + (at - n > 0 ? ' \u00b7 ' + (at - n) + ' to go' : ''));
    p.appendChild(nx);
    return p;
  }
  function pendingFor(m, c){
    const pk = m && m.pending && m.pending.pick;
    if(pk && pk.job && (!c || !c.job || pk.job === c.job || !c.open)) return pk;
    // just sent from this screen, export not caught up yet
    if(c && c.open && wasSent(c.job) && !(m && m.last_seat && m.last_seat.job === c.job)) return {job: c.job, local: true};
    return null;
  }
  // v634: open async jobs from open_card.json (no new timers; age is computed on each render/SSE update).
  function prettyKind(kind){
    const k = String(kind || '').split('.')[0];
    const s = k.replace(/(ps5|ps4|fifa|nba|nfl|ufc|xbox)/ig, ' $1').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
    return s.split(/\s+/).filter(Boolean).map(w => {
      const l = w.toLowerCase();
      if(l === 'ps5' || l === 'ps4' || l === 'fifa' || l === 'nba' || l === 'nfl' || l === 'ufc' || l === 'ea') return l.toUpperCase();
      return l;
    }).join(' ');
  }
  function jobText(j){
    if(j && typeof j.text === 'string' && j.text.trim()) return j.text.trim();
    const who = String((j && j.characters) || '').split(',').map(s => s.trim()).filter(Boolean).join(' vs ');
    const game = prettyKind(j && j.kind);
    return (who && game) ? (who + ' ' + game) : (who || game || ((j && j.id) || ''));
  }
  function ago(iso, now){
    const t = Date.parse(iso || '');
    if(isNaN(t)) return '';
    const s = Math.max(0, Math.floor(((now != null ? now : Date.now()) - t) / 1000));
    if(s < 60) return 'just opened';
    if(s < 3600){ const n = Math.floor(s / 60); return n === 1 ? 'open 1 minute' : ('open ' + n + ' minutes'); }
    if(s < 86400){ const n = Math.floor(s / 3600); return n === 1 ? 'open 1 hour' : ('open ' + n + ' hours'); }
    const n = Math.floor(s / 86400); return n === 1 ? 'open 1 day' : ('open ' + n + ' days');
  }
  function asyncPills(m){
    const jobs = (m && Array.isArray(m.async_jobs)) ? m.async_jobs : [];
    return jobs.filter(j => j && (j.text || j.kind || j.characters || j.id)).map(j => {
      const open = !!(j.id && asyncOpen.has(j.id));
      const w = document.createElement('div');
      w.className = 'aicwait aicasync' + (open ? ' open' : '');
      w.setAttribute('role', 'button');
      w.setAttribute('aria-expanded', open ? 'true' : 'false');
      w.setAttribute('tabindex', '0');
      if(j.id) w.dataset.jid = j.id;
      const age = ago(j.opened_at);
      w.appendChild(document.createTextNode('\u23f3 ' + jobText(j) + ' \u00b7 waiting on real life' + (age ? ' \u00b7 ' + age : '')));
      const ax = document.createElement('div'); ax.className = 'ax';
      const bits = [];
      if(j.id) bits.push(j.id);
      if(j.run) bits.push(j.run + (j.card ? ' ' + j.card : ''));
      if(j.stake) bits.push(j.stake);
      if(j.world_time) bits.push(j.world_time);
      ax.textContent = bits.join(' \u00b7 ');
      w.appendChild(ax);
      const tog = ev => {
        ev.preventDefault(); ev.stopPropagation();
        if(!j.id) return;
        if(asyncOpen.has(j.id)) asyncOpen.delete(j.id); else asyncOpen.add(j.id);
        const on = asyncOpen.has(j.id);
        w.classList.toggle('open', on);
        w.setAttribute('aria-expanded', on ? 'true' : 'false');
      };
      w.addEventListener('click', tog);
      w.addEventListener('keydown', ev => { if(ev.key === 'Enter' || ev.key === ' ') tog(ev); });
      return w;
    });
  }
  function armSeedTypeline(m){
    const box = document.getElementById('aibox');
    if(!box) return;
    const ta = box.querySelector('form.airow textarea, form.airow input:not([type=hidden])');
    const pending = !!(m && m.seed_pending && (m.seed_pending.status === 'waiting_for_medium_link' || !m.seed_pending.status));
    box.classList.toggle('seed-wait', pending);
    if(!ta) return;
    if(pending){
      ta.placeholder = 'paste the Medium link';
      ta.setAttribute('aria-label', 'paste the Medium link');
      if(ta.dataset.seedPh !== '1'){
        ta.dataset.seedPh = '1';
        try{ ta.focus(); }catch(e){}
      }
    } else if(ta.dataset.seedPh){
      delete ta.dataset.seedPh;
      ta.removeAttribute('aria-label');
      try{ ta.placeholder = (innerWidth < 560) ? 'type a call \u00b7 or say it' : 'type a call \u00b7 teo.fold() \u00b7 or say what you want'; }catch(e){}
    }
  }
  // v656 (Jesuye 10:23–10:25 PM): when the next JOB card (jN+1) is ready, show its title
  // in the existing [[god]] alert strip (.aicwait). Not tappable; it just stays there until
  // the next job card replaces it. Skip seed / menu / lock / prayer cards. Same job number
  // on a later poll or rebuild does not re-fire. If the panel is closed, a badge sits on [[god]].
  let jobAlert = null;
  function isJobCard(j){
    if(!j || !j.open || !j.job) return false;
    if(j.kind && j.kind !== 'job') return false;
    if(!/^j\d+$/i.test(String(j.job))) return false;
    return !!((j.options || []).length);
  }
  function jobAlertTitle(j){
    const line = String((j && j.prompt) || '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
    const title = line.replace(/\s*\u00b7\s*\d+\s+lines?\s+in\s*$/i, '').trim();
    return title || String(j.job || '');
  }
  function paintJobBadge(){
    const panelOn = !!(box() && box().classList.contains('on'));
    const hosts = [document.getElementById('aicmd'), document.getElementById('menutog')].filter(Boolean);
    hosts.forEach((host, i) => {
      let badge = host.querySelector('.aicmdalert');
      if(!jobAlert || panelOn){ if(badge) badge.remove(); return; }
      if(!badge){
        badge = document.createElement('span'); badge.className = 'aicmdalert';
        badge.id = host.id === 'aicmd' ? 'aicmdalert' : 'amenualert';
        badge.setAttribute('aria-hidden', 'true');
        host.appendChild(badge);
      }
      badge.textContent = jobAlert.job || '';
    });
  }
  function noteJobAlert(j){
    if(!isJobCard(j)) return;
    const title = jobAlertTitle(j);
    if(jobAlert && jobAlert.job === j.job){
      if(jobAlert.title !== title){ jobAlert.title = title; }
      paintJobBadge();
      return;
    }
    jobAlert = {job: j.job, title: title, run: j.run || ''};
    paintJobBadge();
  }
  function jobAlertEl(){
    if(!jobAlert || !jobAlert.title) return null;
    const w = document.createElement('div'); w.className = 'aicwait aicalert'; w.id = 'aicalert';
    w.setAttribute('role', 'status'); w.setAttribute('aria-live', 'polite');
    const d = document.createElement('span'); d.className = 'dot'; w.appendChild(d);
    w.appendChild(document.createTextNode(jobAlert.title));
    return w;
  }
  function seatStrip(){

    const m = meta || card, c = card;
    const wrap = document.createElement('div'); wrap.id = 'aicfb';
    const jobs = (m && Array.isArray(m.async_jobs)) ? m.async_jobs : [];
    if((!m || !m.run) && !jobs.length) return wrap;
    if(m && m.run && isLocked(m)){
      const lk = document.createElement('div'); lk.className = 'aiclock'; lk.setAttribute('role', 'status');
      const b = document.createElement('b'); b.textContent = '\ud83d\udd12 Locked \u00b7 ' + (m.lines || 0) + '/' + (m.next_lock_at_lines || m.lines || 0); lk.appendChild(b);
      wrap.appendChild(lk);
    }
    const ls = m && m.last_seat;
    if(m && m.run && ls && ls.job && (ls.lines || []).length){
      const box = document.createElement('div'); box.className = 'aicseat';
      const h = document.createElement('div'); h.className = 'sh';
      const t = document.createElement('span'); t.textContent = '\u2713 '; const b = document.createElement('b'); b.textContent = ls.job + ' seated'; t.appendChild(b);
      t.appendChild(document.createTextNode(' \u00b7 ' + ls.lines.length + ' line' + (ls.lines.length === 1 ? '' : 's') + (hhmm(ls.at) ? ' \u00b7 ' + hhmm(ls.at) : '')));
      h.appendChild(t); box.appendChild(h);
      const sl = document.createElement('div'); sl.className = 'sl';
      const hk = new Set(Array.isArray(ls.hook_lines) ? ls.hook_lines : []);
      ls.lines.forEach(x => { const r = document.createElement('div'); r.textContent = x;
        if(hk.has(x)){ r.className = 'hook'; if(/^#[0-9a-f]{6}$/i.test(ls.hook_color || '')) r.style.setProperty('--hook', ls.hook_color); }
        sl.appendChild(r); });
      box.appendChild(sl);
      const pr = progressEl(m); if(pr) box.appendChild(pr);
      wrap.appendChild(box);
    } else if(m && m.run) {
      const pr = progressEl(m); if(pr) wrap.appendChild(pr);
    }
    const pills = sentPills(m && m.run);
    const pillJobs = new Set(sentLog().filter(e => e.kind === 'pick').map(e => e.job));
    const pillLabels = new Set(sentLog().filter(e => e.kind !== 'pick').map(e => e.label));
    const pk = pendingFor(m, c);
    if(pk && !isLocked(m) && !pillJobs.has(pk.job)){
      const w = document.createElement('div'); w.className = 'aicwait'; w.setAttribute('role', 'status');
      const d = document.createElement('span'); d.className = 'dot'; w.appendChild(d);
      w.appendChild(document.createTextNode(pk.job + ' pick waiting to be seated' + (hhmm(pk.at) ? ' \u00b7 sent ' + hhmm(pk.at) : '') + (pk.note ? ' \u00b7 ' + pk.note : '')));
      if(pk.event_id) w.appendChild(adoptX({kind: 'pick', run: m.run, job: pk.job, event_id: pk.event_id}));
      wrap.appendChild(w);
    }
    const menus = ((m && m.pending && m.pending.menu) || []).filter(x => !pillLabels.has(x.label));
    const prow = document.createElement('div'); prow.className = 'aicpills';
    const seed = m && m.seed_pending;
    if(seed && seed.label){
      const w = document.createElement('div'); w.className = 'aicwait aicsent aicseed'; w.setAttribute('role','status');
      const d = document.createElement('span'); d.className = 'dot'; w.appendChild(d);
      w.appendChild(document.createTextNode(seed.label));
      prow.appendChild(w);
    }
    pills.forEach(x => prow.appendChild(x));
    // v645: taps sent from another tab / device: one pill each, with the box's note and a \u2715
    (menus || []).forEach(x => {
      const w = document.createElement('div'); w.className = 'aicwait';
      const d = document.createElement('span'); d.className = 'dot'; w.appendChild(d);
      w.appendChild(document.createTextNode((x.label || x.action || 'tap') + (x.note ? ' \u00b7 ' + x.note : ' waiting')));
      if(x.event_id) w.appendChild(adoptX({kind: 'menu', run: m.run, job: x.job || null, action: x.action, label: x.label, event_id: x.event_id}));
      prow.appendChild(w);
    });
    asyncPills(m).forEach(x => prow.appendChild(x));
    if(prow.childNodes.length) wrap.appendChild(prow);
    // v645: Jesuye's tab sat on v643 because auto-reload waits for an idle / hidden tab; offer the reload instead
    if(root.__thrydUpdateReady && root.__thrydUpdateReady > (+root.__thrydVer || 0) && root.thrydReloadNow){
      const u = document.createElement('button'); u.type = 'button'; u.className = 'aicwait aicupd';
      u.textContent = '\u21bb update ready (v' + root.__thrydUpdateReady + ') \u00b7 tap to reload';
      tapOnce(u, () => { try{ root.thrydReloadNow(); }catch(e){} });
      wrap.appendChild(u);
    }
    wrap.style.display = wrap.childNodes.length ? 'flex' : 'none';
    armSeedTypeline(m);
    return wrap;
  }
  function updateStrip(){
    const old = document.getElementById('aicfb'); if(!old) return;
    old.replaceWith(seatStrip());
    const lr = document.querySelector('#aimenu .aimrow[data-row="lock"]'); if(lr) lr.classList.toggle('hot', isLocked(meta || card));
    armSeedTypeline(meta || card);
    paintJobBadge();
  }


  function sheetKey(t){ return String(t || '').toLowerCase().replace(/\s*(?:->|=>|\u2192|\bto\b)\s*/g, '\u2192').replace(/[^\p{L}\p{N}\u2192]+/gu, ' ').replace(/\s*\u2192\s*/g, '\u2192').replace(/\s+/g, ' ').trim(); }
  // v652: Show all agendas (and every panel sheet) gets a phone-friendly ×; Escape closes the box first.
  const SHEET_CLOSED_STORE = 'thryd_sheet_closed';
  const PRAYER_PAGE = 5;
  let sheetPage = 0, sheetPageFor = '';
  let closedSheet = (function(){ try{ return String(localStorage.getItem(SHEET_CLOSED_STORE) || ''); }catch(e){ return ''; } })();
  function sheetId(s){ return String((s && s.kind) || '') + '|' + String((s && s.at) || ''); }
  function isSheetClosed(s){ return !!(s && sheetId(s) && sheetId(s) === closedSheet); }
  function closeSheet(){
    const s = (meta && meta.sheet) || (card && card.sheet);
    if(s){ closedSheet = sheetId(s); try{ localStorage.setItem(SHEET_CLOSED_STORE, closedSheet); }catch(e){} }
    const el = document.getElementById('aisheet'); if(el) el.remove();
    try{ render(); }catch(e){}
  }
  function sheetCloseBtn(){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'shx';
    b.setAttribute('aria-label', 'Close'); b.title = 'Close'; b.textContent = '\u00d7';
    tapOnce(b, () => closeSheet());
    return b;
  }
  function fillPrayerCards(box, s){
    const cards = s.cards || [];
    const id = sheetId(s);
    if(sheetPageFor !== id){ sheetPage = 0; sheetPageFor = id; }
    const pages = Math.max(1, Math.ceil(cards.length / PRAYER_PAGE) || 1);
    if(sheetPage >= pages) sheetPage = pages - 1;
    if(sheetPage < 0) sheetPage = 0;
    const lo = sheetPage * PRAYER_PAGE;
    const slice = cards.slice(lo, lo + PRAYER_PAGE);
    if(cards.length > PRAYER_PAGE){
      const nav = document.createElement('div'); nav.className = 'pnav';
      const prev = document.createElement('button'); prev.type = 'button'; prev.textContent = 'Previous'; prev.disabled = sheetPage <= 0;
      const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Next'; next.disabled = sheetPage >= pages - 1;
      const pos = document.createElement('div'); pos.className = 'ppos';
      const hi = Math.min(lo + slice.length, cards.length);
      pos.textContent = (lo + 1) + '\u2013' + hi + ' of ' + cards.length;
      if(!prev.disabled) tapOnce(prev, () => { sheetPage -= 1; render(); });
      if(!next.disabled) tapOnce(next, () => { sheetPage += 1; render(); });
      nav.appendChild(prev); nav.appendChild(pos); nav.appendChild(next);
      box.appendChild(nav);
    }
    const wrap = document.createElement('div'); wrap.className = 'pcards';
    slice.forEach(c => {
      const el = document.createElement('div'); el.className = 'pcard';
      if(c.id) el.dataset.id = c.id;
      if(c.prompt){ const h = document.createElement('div'); h.className = 'ppr'; h.textContent = c.prompt; el.appendChild(h); }
      if(c.from){ const f = document.createElement('div'); f.className = 'pfrom'; f.textContent = c.from; el.appendChild(f); }
      const opts = document.createElement('div'); opts.className = 'popts';
      (c.options || []).forEach(o => {
        const b = menuBtn(o);
        if(/:\s*menu$/i.test(String(o && o.value || ''))){
          tapOnce(b, () => closeSheet());
        }
        opts.appendChild(b);
      });
      el.appendChild(opts);
      wrap.appendChild(el);
    });
    box.appendChild(wrap);
  }

  function sheetEl(s){
    const box = document.createElement('div'); box.id = 'aisheet';
    const head = document.createElement('div'); head.className = 'shrow';
    const h = document.createElement('div'); h.className = 'sh'; h.textContent = s.prompt || '';
    head.appendChild(h); head.appendChild(sheetCloseBtn());
    box.appendChild(head);
    if(s.helpText){ const t = document.createElement('div'); t.className = 'ht'; t.textContent = s.helpText; box.appendChild(t); }
    if(s.body){ const b = document.createElement('div'); b.className = 'bd'; b.textContent = s.body; box.appendChild(b); }
    const cards = s.cards || [];
    if(cards.length || s.kind === 'prayers'){
      if(cards.length) fillPrayerCards(box, s);
      return box;
    }
    const opts = s.options || [];
    if(opts.length){
      const wrap = document.createElement('div'); wrap.className = 'opts';
      const btns = opts.map(o => { const b = menuBtn(o); b.dataset.k = sheetKey(o.label); wrap.appendChild(b); return {b, o}; });
      // v645: agenda lists (and any long sheet) take a typed name: "cheat to mean" filters to cheat \u2192 mean; Enter opens it
      if(s.kind === 'agendas' || opts.length > 8){
        const f = document.createElement('input'); f.type = 'text'; f.className = 'aishf'; f.autocomplete = 'off';
        f.placeholder = s.kind === 'agendas' ? 'type a name \u00b7 e.g. cheat \u2192 mean' : 'type to find';
        const shown = () => btns.filter(x => x.b.style.display !== 'none');
        f.addEventListener('input', () => { const q = sheetKey(f.value); btns.forEach(x => { x.b.style.display = (!q || x.b.dataset.k.indexOf(q) >= 0) ? '' : 'none'; }); });
        f.addEventListener('keydown', ev => { ev.stopPropagation(); if(ev.key !== 'Enter') return; ev.preventDefault(); const v = shown(); if(v.length === 1) sendMenu(v[0].b, v[0].o); else menuNote(v.length ? (v.length + ' match \u2014 type a little more') : 'no agenda by that name', v.length ? '' : 'err'); });
        box.appendChild(f);
      }
      box.appendChild(wrap);
    }
    return box;
  }

  function render(){
    const els = mount(); if(!els) return;
    const {jobEl, menuEl} = els;
    const c = card;
    if(c && sel.job !== c.job){ sel = {job: c.job, values: new Set(), text: ''}; }
    const keepScroll = (jobEl.querySelector('.aicbody') || jobEl).scrollTop;
    // --- job card (options scroll; typeline docked above the menu) ---
    jobEl.textContent = '';
    const alert = jobAlertEl(); if(alert) jobEl.appendChild(alert);
    const body = document.createElement('div'); body.className = 'aicbody';
    body.appendChild(seatStrip());
    const sheet = (meta && meta.sheet) || (c && c.sheet);
    // v645 (Jesuye 2:12 PM): no "How many minutes?" seed card over an open job card
    const seedBlocked = !!(sheet && sheet.kind === 'minutes' && seedGate(c));
    const sheetGone = isSheetClosed(sheet);
    const showSheet = !!(sheet && !seedBlocked && !sheetGone && (sheet.prompt || (sheet.options || []).length || sheet.body || (sheet.cards || []).length));
    if(showSheet){
      body.appendChild(sheetEl(sheet));
    }
    if(showSheet){
      // v652: Prayer jobs / Show all agendas take the card area so ~5 cards (or the agenda list) stay on screen
    } else if(!c || !c.open || !(c.options || []).length){
      if(c && isLocked(meta || c)){ /* the lock banner above says it */ }
      else {
      const empty = document.createElement('div'); empty.className = 'aicempty';
      // v627: a pinned [[god]] run between a seat and its next card says so instead of showing another agenda
      empty.textContent = c && !c.open ? (c.waiting && c.seated_job ? c.seated_job + ' is seated \u2014 the next job appears here when it is posted.' : 'No open job card right now. The next one appears here when it is posted.') : 'loading card\u2026';
      body.appendChild(empty);
      }
    } else {
      const locked = wasSent(c.job);
      if(c.prompt) body.appendChild(promptEl(c.prompt));
      if(c.helpText){ const h = document.createElement('div'); h.className = 'aichelt'; h.textContent = stripTweetUrls(stripTownhallEcho(c.helpText)); body.appendChild(h); }
      const opts = document.createElement('div'); opts.className = 'aicopts';
      // v659: 🎥 Live stays on the menu pill only; job cards list the 4 line options.
      (c.options || []).filter(o => !isLiveOpt(o)).forEach(o => {
        const b = document.createElement('div'); b.className = 'aicopt' + (sel.values.has(o.value) ? ' on' : '') + (o.role === 'hook' ? ' hook' : '');
        if(o.role === 'hook' && /^#[0-9a-f]{6}$/i.test(o.color || '')){ b.style.setProperty('--hook', o.color); b.dataset.role = 'hook'; }
        b.dataset.value = o.value; b.setAttribute('role', 'button'); b.tabIndex = locked ? -1 : 0;
        b.setAttribute('aria-pressed', sel.values.has(o.value) ? 'true' : 'false');
        if(locked) b.setAttribute('aria-disabled', 'true');
        const l = document.createElement('span'); l.className = 'ol'; l.textContent = o.label; b.appendChild(l);
        const raw = safeText(o) || tweetLine(o);
        if(raw){
          const t = document.createElement('div'); t.className = 'ot';
          const pick = fillSafe(t, raw);
          // taps in the scroll area must not toggle the option (tap guard still covers the label)
          ;['pointerdown','pointerup','click'].forEach(k => t.addEventListener(k, ev => { ev.stopPropagation(); }, true));
          b.appendChild(t);
          // v629: centre the picked row inside its own code block only (scrollIntoView also scrolled the
          // whole card to the bottom, hiding the prompt and the seat line on open)
          if(pick) setTimeout(() => { try{ t.scrollTop = Math.max(0, pick.offsetTop - t.offsetTop - (t.clientHeight - pick.offsetHeight) / 2); }catch(e){} }, 0);
        }
        if(!locked){
          const toggle = () => {
            if(sel.values.has(o.value)) sel.values.delete(o.value); else sel.values.add(o.value);
            const on = sel.values.has(o.value);
            b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
            if(status.kind === 'err') setStatus('', '');
          };
          tapOnce(b, toggle);
          b.addEventListener('keydown', ev => { if(ev.key !== 'Enter' && ev.key !== ' ') return; ev.preventDefault(); ev.stopPropagation(); toggle(); });
        }
        opts.appendChild(b);
      });
      body.appendChild(opts);
      const dock = document.createElement('div'); dock.className = 'aicdock';
      if(c.allowCustom && !locked){
        const t = document.createElement('input'); t.type = 'text'; t.className = 'aicfree'; t.placeholder = 'or type your own line'; t.autocomplete = 'off';
        t.value = sel.text || '';
        t.addEventListener('keydown', e => { e.stopPropagation(); if(e.key === 'Enter'){ e.preventDefault(); sendCard(document.querySelector('#aicard .aicgo')); } });
        t.addEventListener('input', () => { sel.text = t.value; });
        dock.appendChild(t);
      }
      const row = document.createElement('div'); row.className = 'aicsend';
      const n = document.createElement('div'); n.className = 'aicnote'; n.id = 'aicnote'; n.setAttribute('role', 'status'); n.setAttribute('aria-live', 'polite');
      if(status.job === c.job && status.text){ n.textContent = status.text; if(status.kind) n.classList.add(status.kind); }
      else if(locked){ n.textContent = 'sent \u2014 next job coming'; n.classList.add('ok'); }
      const waitingReceipt = !!(locked && pendingSend && pendingSend.state === 'waiting' && pendingSend.job === c.job);   // v644: no tick before the receipt
      const go = document.createElement('button'); go.type = 'button'; go.className = 'aicgo' + (waitingReceipt ? ' busy' : (locked ? ' sent' : ''));
      go.textContent = waitingReceipt ? 'sending\u2026' : (locked ? 'sent \u2713' : (resendFor(c) ? '#thryd again' : '#thryd')); go.disabled = locked;
      // v649 (Jesuye 5:28 PM "instead of 'send', that button on god should be '#thryd'"): same send, new name
      go.setAttribute('aria-label', '#thryd \u2014 send your pick'); go.title = '#thryd \u2014 send your pick (Enter)';
      tapOnce(go, () => sendCard(go));
      row.append(n, go);
      dock.appendChild(row);
      jobEl.appendChild(body);
      jobEl.appendChild(dock);
    }
    if(!body.parentNode) jobEl.appendChild(body);
    const scEl = jobEl.querySelector('.aicbody');
    if(scEl) scEl.scrollTop = keepScroll;
    try{ liftForKeyboard(); }catch(e){}
    // --- menu buttons (below the typeline): always visible, no list / dropdown / collapse ---
    menuEl.textContent = '';
    const main = (c && c.menus && c.menus.main) || [];
    if(main.length){
      const row = document.createElement('div'); row.className = 'aimrow'; row.dataset.row = 'main'; row.setAttribute('aria-label','menu');
      const lab = document.createElement('span'); lab.className = 'aimlab'; lab.textContent = 'menu'; row.appendChild(lab);
      const sc = document.createElement('div'); sc.className = 'aimscroll';
      // one Jump ahead only (Jesuye 12:39 PM): the LOCK row keeps it
      const lockHasJump = ((c && c.menus && c.menus.lock) || []).some(x => /jump ahead/i.test(String(x.value || x.label || '')));
      // v637: full [[god]] navigator on the menu row; Jump ahead stays on LOCK only; Live view shows while waiting too
      // v638: buttons live in a sideways-sliding strip so the story above keeps the height
      main.filter(o => !(lockHasJump && /jump ahead/i.test(String(o.value || o.label || '')))).forEach(o => sc.appendChild(menuBtn(o)));
      ((c && c.menus && c.menus.live) || []).forEach(o => { const lb = menuBtn(o); lb.classList.add('live'); sc.appendChild(lb); });
      row.appendChild(sc);
      menuEl.appendChild(row);
      armScrollHide(sc);
    }
    const lock = (c && c.menus && c.menus.lock) || [];
    if(lock.length){
      const row = document.createElement('div'); row.className = 'aimrow' + (isLocked(meta || c) ? ' hot' : ''); row.dataset.row = 'lock'; row.setAttribute('aria-label','lock');
      const lab = document.createElement('span'); lab.className = 'aimlab'; lab.textContent = 'lock'; row.appendChild(lab);
      const sc = document.createElement('div'); sc.className = 'aimscroll';
      withPublish(lock).forEach(o => sc.appendChild(menuBtn(o)));
      row.appendChild(sc);
      menuEl.appendChild(row);
      armScrollHide(sc);
    }
    const mn = document.createElement('div'); mn.className = 'aimnote'; mn.id = 'aimnote'; mn.setAttribute('role', 'status'); menuEl.appendChild(mn);
    setTimeout(reclamp, 0);
  }

  // One activation per physical tap: pointerup and click both route here, deduped (Android tablets
  // sometimes drop or double the synthetic click inside the panel).
  // v624: one activation per tap across the WHOLE panel, so the trailing click of a tap can never land on a
  // neighbouring button if the layout shifts (QA 12:54 PM: a Seed tap also fired Souvenir).
  // A real new tap (pointerup) is always honored; only a trailing synthetic click on a DIFFERENT button
  // within 600 ms of a pointerup activation is ignored.
  let lastUp = {el: null, at: 0};
  function tapOnce(el, fn){
    let last = 0, sx = 0, sy = 0;
    el.addEventListener('pointerdown', ev => { sx = ev.clientX || 0; sy = ev.clientY || 0; }, {passive: true});
    const run = ev => { ev.preventDefault(); ev.stopPropagation(); if(el.disabled) return; const now = Date.now();
      if(Math.abs((ev.clientX || sx) - sx) > 14 || Math.abs((ev.clientY || sy) - sy) > 14) return;
      if(ev.type === 'click' && lastUp.el && lastUp.el !== el && now - lastUp.at < 600) return;
      if(now - last < 450) return; last = now; if(ev.type === 'pointerup') lastUp = {el, at: now}; fn(ev); };
    el.addEventListener('pointerup', ev => { if(ev.pointerType === 'mouse' && ev.button !== 0) return; run(ev); });
    el.addEventListener('click', run);
  }

  // v654 (Jesuye 9:00 PM "slider under the menu option disappear after a few seconds"):
  // the MENU / LOCK row slider is visible on load or while scrolling, then hides after 3s.
  const hideBarTimers = new WeakMap();
  function armScrollHide(el){
    if(!el) return;
    const show = () => {
      el.classList.remove('aimhidebar');
      const prev = hideBarTimers.get(el); if(prev) clearTimeout(prev);
      hideBarTimers.set(el, setTimeout(() => el.classList.add('aimhidebar'), 3000));
    };
    if(!el.dataset.hidebar){
      el.dataset.hidebar = '1';
      el.addEventListener('scroll', show, {passive: true});
      el.addEventListener('pointerdown', show);
      el.addEventListener('wheel', show, {passive: true});
      el.addEventListener('pointerenter', show);
    }
    show();
  }
  function menuBtn(o){
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = o.label; b.dataset.value = o.value;
    if(menuRecent(card && card.run, o.value)){ b.classList.add('sent'); b.title = 'sent'; }
    tapOnce(b, () => sendMenu(b, o));
    return b;
  }
  function menuNote(text, kind){ const n = document.getElementById('aimnote'); if(n){ n.textContent = text || ''; n.className = 'aimnote' + (kind ? ' ' + kind : ''); } }

  function fetchOpen(ms){
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => { try{ ac && ac.abort(); }catch(e){} }, ms || 8000);
    return fetch('data/open_card.json?t=' + Date.now(), {cache: 'no-store', signal: ac ? ac.signal : undefined})
      .then(r => r.ok ? r.json() : null).catch(() => null).finally(() => clearTimeout(t));
  }

  async function sendCard(btn){
    if(sending){ setStatus('still sending\u2026', 'busy'); return; }
    if(!card || !card.open){ setStatus('This card is closed \u2014 there is no open job right now.', 'err'); return; }
    if(wasSent(card.job)){ setStatus('Already sent for ' + card.job + ' \u2014 next job coming.', 'ok'); return; }
    const again = resendFor(card);   // v644: Resend re-posts the same event_id (no double pick)
    const chosen = (card.options || []).map(o => o.value).filter(v => sel.values.has(v));
    const labels = again ? (again.body.labels || []) : (card.options || []).filter(o => sel.values.has(o.value)).map(o => o.label);
    const free = (document.querySelector('#aicard .aicfree') || {}).value;
    const text = (free && String(free).trim()) || undefined;
    if(!again && !chosen.length && !text){
      setStatus('Pick a line (or type one) first.', 'err');
      if(btn){ btn.classList.add('err'); setTimeout(() => btn.classList.remove('err'), 1400); }
      log({event: 'send_empty', job: card.job});
      return;
    }
    sending = true;
    if(btn){ btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'sending\u2026'; }
    setStatus('Checking the card is still open\u2026', 'busy');
    const job = card.job;
    const fresh = await fetchOpen(6000);
    if(fresh && typeof fresh === 'object' && (!fresh.open || fresh.job !== job)){
      sending = false;
      const was = job; card = fresh; meta = fresh; cardSig = JSON.stringify(fresh);
      if(again && seenResolved(again.body.event_id)){ pendingSend = null; status = {job: fresh.job, text: '\u2713 your ' + was + ' pick was seated \u2014 ' + (fresh.open ? fresh.job + ' is open now.' : 'next card coming.'), kind: 'ok'}; render(); return; }
      log({event: 'send_stale', job: was, open: fresh.open ? fresh.job : null});
      status = {job: fresh.job, text: fresh.open ? (was + ' is closed \u2014 ' + fresh.job + ' is open now. Pick again.') : (was + ' is closed \u2014 no open job right now.'), kind: 'err'};
      render(); return;
    }
    const eid = again ? again.body.event_id : uid('pick-');
    const body = again ? again.body : {v:1, type:'card_pick', event_id:eid, rid:eid+'-r', run:card.run, job:card.job, card:card.card,
      options:chosen, labels:labels, source:'projector', client_ts:new Date().toISOString()};
    if(!again && text) body.text = text.slice(0, 500);
    const t0 = again ? again.t0 : Math.floor(Date.now() / 1000) - 5;
    const ps = pendingSend = {job, sig: optSig(card), body, t0, r: null, state: 'waiting'};
    setStatus(again ? '\u2026 resending the same pick to the box' : '\u2026 sending to the box', 'busy');
    let r = null;
    const onRetry = (n, wait) => setStatus('The network is busy \u2014 retrying in ' + Math.round(wait / 1000) + ' s (' + (n + 1) + '/3)\u2026', 'busy');
    try{ r = await post(body, onRetry); }
    catch(e){
      sending = false; ps.state = 'not_received'; log({event: 'send_throw', job, error: String(e && e.message || e), event_id: eid});
      if(btn){ btn.disabled = false; btn.classList.remove('busy'); btn.textContent = '#thryd again'; }
      setStatus('Not sent \u2014 ' + friendly(e) + '. Your pick is kept; tap #thryd again in a moment (same send, no double pick).', 'err'); return;
    }
    if(!(r && r.ok)){
      sending = false; ps.state = 'not_received'; log({event: 'send_http', job, status: r && r.status, event_id: eid});
      if(btn){ btn.disabled = false; btn.classList.remove('busy'); btn.textContent = '#thryd again'; }
      setStatus('Not sent \u2014 ' + friendly(r ? 'HTTP ' + r.status : '') + '. Your pick is kept; tap #thryd again in a moment (same send, no double pick).', 'err'); return;
    }
    ps.r = r;
    markSent(job, card);   // holds the card while the receipt is pending (no second pick)
    logSent({kind: 'pick', run: body.run, job, label: labels.join(', ').slice(0, 80), event_id: eid});
    if(btn){ btn.classList.add('busy'); btn.textContent = 'sending\u2026'; }
    try{ updateStrip(); }catch(e){}
    setStatus('\u2026 waiting for the box to confirm ' + job, 'busy');
    log({event: 'send_ok', job, id: r.ntfyId, event_id: eid, resend: !!again});
    const m = await awaitReply(body, t0, r, RECEIPT_MS);
    sending = false;
    if(!m){
      if(pendingSend !== ps) return;
      ps.state = 'not_received'; unmarkSent(job);
      patchSent(eid, {unconfirmed: true});
      log({event: 'receipt_timeout', job, event_id: eid});
      status = {job, text: '\u2717 the box hasn\u2019t confirmed this send after 20 s. Tap #thryd again \u2014 it\u2019s the same send, so it can\u2019t pick twice.', kind: 'err'};
      render();
      lateReceipt(ps);
      return;
    }
    patchSent(eid, {receipt_at: Date.now(), note: m.note || undefined});
    takeReceipt(ps, m);
  }
  // after a 20 s timeout keep listening a little longer; a late receipt still flips the card to ✓
  async function lateReceipt(ps){
    const m = await awaitReply(ps.body, ps.t0, ps.r, 0, [5000, 10000, 15000, 15000, 15000]);
    if(m && pendingSend === ps && ps.state === 'not_received' && !sending){ patchSent(ps.body.event_id, {receipt_at: Date.now(), note: m.note || undefined}); takeReceipt(ps, m); }
  }
  function takeReceipt(ps, m){
    const job = ps.job;
    if(pendingSend === ps) pendingSend = null;
    if(card && card.job !== job){ if(m.ok) status = {job: card.job, text: '\u2713 your ' + job + ' pick reached the box.', kind: 'ok'}; return; }
    const btn = document.querySelector('#aicard .aicgo');
    if(m.ok){
      markSent(job, card);
      if(btn){ btn.disabled = true; btn.classList.remove('busy'); btn.classList.add('sent'); btn.textContent = 'sent \u2713'; }
      status = {job, text: (m.status === 'seated' ? '\u2713 seated on ' + job : '\u2713 the box has your ' + job + ' pick') + ' \u2014 next card coming.', kind: 'ok'};
      setStatus(status.text, 'ok'); return;
    }
    // v643: 'already_sent' means this Send was NOT stored, so never show it as a success or keep the lock.
    if(m.code === 'already_sent'){ unmarkSent(job); status = {job, text: 'Not stored \u2014 the box already had a send for ' + job + '. Tap #thryd again.', kind: 'err'}; render(); return; }
    // v628: a seat can make the open job disappear before the receipt. v644: only call it in when the seat shows this event.
    if(m.code === 'job_mismatch' || m.code === 'no_open_job'){
      if(seenResolved(ps.body.event_id)){ setStatus('Sent \u2713 your ' + job + ' pick is in \u2014 next job coming.', 'ok'); return; }
      unmarkSent(job);
      status = {job, text: '\u2717 ' + job + ' closed before this send reached the box, so it was not stored. Pick on the open card.', kind: 'err'};
      render(); return;
    }
    unmarkSent(job);
    status = {job, text: '\u2717 Not accepted \u00b7 ' + (m.detail || m.code || 'rejected') + ' \u00b7 tap #thryd to try again.', kind: 'err'};
    render();
  }

  // v645 (Jesuye 2:12 PM "it shouldn't be asking for a new agenda while still responding to the old one"):
  // Seed / Draw a story / their minutes step wait until the open agenda job is finished or locked.
  const SEED_RE = /^(?:menu:\s*)?(?:seed an agenda|draw a story|draw an agenda)$|^minutes:\s*\d+/i;
  function seedGate(c){ return !!(c && c.open && c.job && (c.options || []).length && !isLocked(meta || c)); }
  function seedNote(c){ return c.job + ' is open \u2014 finish or lock this agenda first'; }
  function sendMenu(btn, o){
    if(!o || !o.value || btn.disabled) return;
    if(SEED_RE.test(String(o.value).trim()) && seedGate(card)){ menuNote(seedNote(card), 'err'); log({event: 'seed_blocked', job: card.job, action: o.value}); return; }
    const run = card && card.run;
    const again = pendingMenu[o.value] && pendingMenu[o.value].state === 'not_received' ? pendingMenu[o.value] : null;
    if(!again && menuRecent(run, o.value)){ btn.classList.add('sent'); btn.title = 'sent'; menuNote(o.label + ' already sent \u2713', 'ok'); return; } // drop before POST
    if(o.href && !again){ try{ window.open(o.href, '_blank', 'noopener'); }catch(e){} }
    btn.disabled = true; menuNote((again ? 'resending ' : 'sending ') + o.label + '\u2026', '');
    const eid = again ? again.body.event_id : uid('menu-');
    const body = again ? again.body : {v:1, type:'menu_action', event_id:eid, rid:eid+'-r', run:card && card.run, job:card && card.job, card:card && card.card,
      action:o.value, label:o.label, source:'projector', client_ts:new Date().toISOString()};
    const t0 = again ? again.t0 : Math.floor(Date.now() / 1000) - 5;
    const pm = pendingMenu[o.value] = {body, t0, r: null, state: 'waiting'};
    const onRetry = (n, wait) => menuNote(o.label + ': the network is busy \u2014 retrying in ' + Math.round(wait / 1000) + ' s (' + (n + 1) + '/3)\u2026', 'busy');
    const fail = why => { pm.state = 'not_received'; btn.disabled = false; btn.classList.add('err'); setTimeout(() => btn.classList.remove('err'), 1400); menuNote(o.label + ' not sent \u2014 ' + friendly(why) + '. Tap it again in a moment (same send, no double).', 'err'); };
    const done = m => {
      if(pendingMenu[o.value] === pm) delete pendingMenu[o.value];
      patchSent(eid, m.ok ? {receipt_at: Date.now(), note: m.note || undefined, unconfirmed: false} : {done_at: Date.now(), note: m.detail || m.code || 'not accepted'});
      try{ updateStrip(); }catch(err){}
      if(m.ok) return menuNote(o.label + ' received \u2713', 'ok');
      if(m.code === 'duplicate' || m.status === 'duplicate') return menuNote(o.label + ' already received \u2713', 'ok');
      btn.classList.remove('sent'); menuNote('\u2717 ' + o.label + ' not accepted \u2014 ' + (m.detail || m.code || 'rejected'), 'err');
    };
    post(body, onRetry).then(async r => {
      if(!(r && r.ok)) return fail(r ? 'HTTP ' + r.status : '');
      pm.r = r;
      btn.disabled = false; markMenu(run, o.value); logSent({kind: 'menu', run, job: body.job || null, action: o.value, label: o.label, event_id: eid}); try{ updateStrip(); }catch(e){}
      btn.title = 'sending'; menuNote('\u2026 ' + o.label + ' sent, waiting for the box to confirm', 'busy');
      const m = await awaitReply(body, t0, r, RECEIPT_MS);
      if(m) return done(m);
      // v644: no receipt in 20 s: say so; a second tap resends the same event_id (the box dedupes it)
      pm.state = 'not_received'; btn.classList.remove('sent'); btn.title = 'resend'; patchSent(eid, {unconfirmed: true});
      try{ const mm = JSON.parse(localStorage.getItem(MENU_STORE) || '{}') || {}; delete mm[menuKey(run, o.value)]; localStorage.setItem(MENU_STORE, JSON.stringify(mm)); }catch(e){}
      menuNote('\u2717 the box hasn\u2019t confirmed ' + o.label + ' after 20 s. Tap it again to resend (same send, no double).', 'err');
      const late = await awaitReply(body, t0, r, 0, [5000, 10000, 15000, 15000, 15000]);
      if(late && pendingMenu[o.value] === pm && pm.state === 'not_received'){ btn.classList.add('sent'); btn.title = 'sent'; markMenu(run, o.value); done(late); }
    }).catch(fail);
  }

  function fetchCard(){
    if(document.hidden) return Promise.resolve();
    // v656: still fetch when the panel is closed so the job alert / [[god]] badge can update
    return fetchOpen(10000).then(j => {
      if(!j || typeof j !== 'object') return;
      if(meta && atMs(j.at) && atMs(meta.at) > atMs(j.at)) return;   // v630: the lane already brought a newer card
      applyCard(j, 'pages');
    }).catch(()=>{});
  }
  function applyCard(j, src){
    {
      const settled = settleSent(j);
      const sig = JSON.stringify(Object.assign({}, j, {at: null}));
      // After Send we wait on this job ('sent — next job coming'). When the
      // published card moves to the next jN, swap it in automatically.
      const metaChanged = JSON.stringify(Object.assign({}, meta || {}, {at: null})) !== sig;
      meta = j;
      if(card && sig === cardSig){ if(settled) updateStrip(); return; } // unchanged: keep the DOM (and the pick) as is
      // v628: a waiting / closed refresh must not collapse the sent card (confirmation
      // and size stay until the next job is actually open, or the user closes the panel).
      if(card && card.open && wasSent(card.job, j) && !(j.open && j.job && j.job !== card.job) && !isLocked(j)){
        cardSig = sig;
        if(metaChanged) updateStrip(); // v629: seat line / waiting / lock update in place, the sent card stays
        return;
      }
      // v643: same jN rebuilt with new lines: drop the old card's note, ticks and send lock so it reads fresh.
      if(card && j && card.job === j.job && optSig(card) !== optSig(j)){
        if(status.job === j.job) status = {job: null, text: '', kind: ''};
        if(sel.job === j.job){ const keep = new Set((j.options || []).map(o => o.value)); sel.values = new Set([...sel.values].filter(v => keep.has(v))); }
        if(sentMap()[j.job] && sentMap()[j.job] !== optSig(j)) unmarkSent(j.job);
      }
      card = j; cardSig = sig;
      noteJobAlert(j);
      if(box() && box().classList.contains('on')) render();   // v632: a lane card before the panel opens is kept for open()
      else paintJobBadge();
    }
  }

  function startPoll(){
    stopPoll();
    const tick = () => { if(document.hidden) return; fetchCard(); };
    if(root.LH && typeof LH.poll === 'function'){
      pollId = LH.poll(tick, POLL_MS);
    } else {
      pollId = setInterval(tick, POLL_MS);
    }
  }
  function stopPoll(){
    if(!pollId) return;
    if(root.LH && typeof LH.clear === 'function'){ try{ LH.clear(pollId); }catch(e){} }
    else { clearInterval(pollId); }
    pollId = 0;
  }

  function hookClose(){
    const ai = AI(); if(!ai || ai._cardsHook) return !!ai;
    ai._cardsHook = true;
    const _open = ai.open, _close = ai.close;
    ai.open = function(){ const r = _open.apply(this, arguments); mount(); if(card) render(); fetchCard(); startPoll(); laneOpen(); paintJobBadge(); return r; };
    ai.close = function(){
      if(!userClose) return; // typeline auto-close must not dismiss the card panel
      const r = _close.apply(this, arguments);
      paintJobBadge();
      return r;
    };
    const b = document.getElementById('aicmd');
    if(b && !b._cardsHook){
      b._cardsHook = true;
      b.addEventListener('click', ev => {
        ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
        const on = box() && box().classList.contains('on');
        if(on){ userClose = true; try{ _close.call(ai); } finally { userClose = false; paintJobBadge(); } }
        else { ai.open(); }
      }, true);
    }
    addEventListener('keydown', ev => {
      if(ev.key !== 'Escape') return;
      if(!(box() && box().classList.contains('on'))) return;
      // v652: Escape closes the Show all agendas / Prayer jobs box first, then the panel
      if(document.getElementById('aisheet')){ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); closeSheet(); return; }
      const t = ev.target;
      if(t && t.classList && t.classList.contains('aicfree')) return;
      userClose = true; try{ _close.call(ai); } finally { userClose = false; paintJobBadge(); }
    }, true);
    return true;
  }

  addEventListener('thryd-update-ready', () => { try{ updateStrip(); }catch(e){} });
  function ready(){
    laneOpen();                                   // v632: lane from load, panel open or not
    if(!hookTyped()) setTimeout(hookTyped, 1500); // v645: typed lines get a pill with a \u2715 while unanswered
    if(sentLog().some(e => !e.done_at)){ pillTick(); watchTyped(); }
    if(hookClose()){ startPoll(); fetchCard(); return; }
    setTimeout(ready, 100);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})(window);
