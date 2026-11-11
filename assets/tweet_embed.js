// Official post embed for the speech bubble. Once an embed is loading or on
// screen, hide every non-embed node in the bubble (.who, .txt, and .twlink).
// Archive text and the speaker label are fallback only (no id, purged, or the
// widget failed or timed out) and never stack with the embed.
// Never invent author, avatar, or metrics.
// A status id is a decimal string from the archive, never parsed out of prose.
(function(root){
  var HANDLE = 'notnotnotnotyn';
  var WIDGETS = 'https://platform.twitter.com/widgets.js';
  var READ_MS = 20000;
  var EMBED_WIDTH = 340;

  function statusId(value){
    if(typeof value !== 'string') return '';
    var s = value.trim();
    if(!/^\d{1,22}$/.test(s)) return '';
    return s;
  }

  function postUrl(id){
    return 'https://x.com/' + HANDLE + '/status/' + id;
  }

  function deckRow(p){
    var row = {line: p && p.line, src: p && p.src, move: false};
    var id = statusId(p && p.id);
    if(id) row.id = id;
    if(p && p.purged === true) row.purged = true;
    return row;
  }

  function create(deps){
    deps = deps || {};
    var doc = deps.document || null;
    var twttr = deps.twttr || null;
    var timeoutMs = deps.timeoutMs == null ? 6000 : deps.timeoutMs;
    var readMs = deps.readMs == null ? READ_MS : deps.readMs;
    var loads = 0;
    var widgetsP = null;
    var seq = 0;

    function whenReady(tw){
      return new Promise(function(resolve){
        if(!tw){ resolve(null); return; }
        if(typeof tw.ready === 'function') tw.ready(function(api){ resolve(api || tw); });
        else resolve(tw);
      });
    }

    function loadWidgets(){
      if(widgetsP) return widgetsP;
      widgetsP = new Promise(function(resolve){
        var tw = twttr || root.twttr;
        if(tw && tw.widgets && tw.widgets.createTweet){ whenReady(tw).then(resolve); return; }
        if(!doc){ resolve(null); return; }
        var existing = doc.getElementById ? doc.getElementById('twitter-wjs') : null;
        if(existing){ existing.addEventListener('load', function(){ whenReady(twttr || root.twttr).then(resolve); }); existing.addEventListener('error', function(){ resolve(null); }); return; }
        loads += 1;
        var s = doc.createElement('script');
        s.id = 'twitter-wjs';
        s.src = WIDGETS;
        s.async = true;
        s.charset = 'utf-8';
        s.onload = function(){ whenReady(twttr || root.twttr).then(resolve); };
        s.onerror = function(){ resolve(null); };
        (doc.head || doc.body || doc.documentElement).appendChild(s);
      });
      return widgetsP;
    }

    function slotFor(host){
      var slot = host.querySelector('.twembed');
      if(!slot){
        slot = doc.createElement('div');
        slot.className = 'twembed';
        host.appendChild(slot);
      }
      return slot;
    }

    function clearSlot(host){
      var slot = host.querySelector && host.querySelector('.twembed');
      if(!slot) return;
      while(slot.firstChild) slot.removeChild(slot.firstChild);
    }

    function linkFor(host, id){
      var a = host.querySelector('.twlink');
      if(!id){
        if(a) a.remove();
        return;
      }
      if(!a){
        a = doc.createElement('a');
        a.className = 'twlink';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        host.appendChild(a);
      }
      var url = postUrl(id);
      a.href = url;
      a.textContent = url;
    }

    function chromeNodes(host){
      var out = [], sels = ['.who', '.txt', '.twlink'], i, el;
      if(!host || !host.querySelector) return out;
      for(i=0;i<sels.length;i++){
        el = host.querySelector(sels[i]);
        if(el) out.push(el);
      }
      return out;
    }

    function setChrome(host, show){
      var nodes = chromeNodes(host), i;
      for(i=0;i<nodes.length;i++) nodes[i].hidden = !show;
    }

    function showArchive(host){
      host.classList.remove('embed-wait');
      host.classList.remove('embed-on');
      setChrome(host, true);
    }

    function hideArchive(host){
      host.classList.add('embed-wait');
      host.classList.remove('embed-on');
      setChrome(host, false);
    }

    function arm(host, ms, my){
      clearTimeout(host._hide);
      host._hide = setTimeout(function(){
        if(host._tw !== my) return;
        host.classList.remove('on');
        showArchive(host);
        clearSlot(host);
      }, ms);
    }

    function mount(host, item, baseMs){
      var my = ++seq;
      host._tw = my;
      showArchive(host);
      clearSlot(host);
      var id = statusId(item && item.id);
      var purged = !!(item && item.purged);
      if(!host._twStop){
        host._twStop = true;
        host.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); });
        host.addEventListener('click', function(ev){ ev.stopPropagation(); });
      }
      if(!id || purged){
        linkFor(host, id);
        arm(host, baseMs, my);
        return Promise.resolve({ok: false, reason: id ? 'purged' : 'no_id'});
      }
      hideArchive(host);
      linkFor(host, '');
      arm(host, readMs, my);
      var started = Date.now();
      var slot = slotFor(host);
      var target = doc.createElement('div');
      slot.appendChild(target);
      var settled = false;
      function finish(res){
        if(settled || host._tw !== my) return {ok: false, reason: 'stale'};
        settled = true;
        if(!res || !res.ok){
          showArchive(host);
          if(target.parentNode === slot) slot.removeChild(target);
          linkFor(host, id);
          arm(host, Math.max(0, baseMs - (Date.now() - started)), my);
          return {ok: false, reason: (res && res.reason) || 'unavailable'};
        }
        host.classList.remove('embed-wait');
        host.classList.add('embed-on');
        setChrome(host, false);
        return {ok: true, reason: 'embed'};
      }
      var timed = new Promise(function(resolve){
        setTimeout(function(){ resolve(finish({ok: false, reason: 'timeout'})); }, timeoutMs);
      });
      var attempt = loadWidgets().then(function(tw){
        if(host._tw !== my) return finish({ok: false, reason: 'stale'});
        if(!tw || !tw.widgets || typeof tw.widgets.createTweet !== 'function') return finish({ok: false, reason: 'unavailable'});
        return Promise.resolve(tw.widgets.createTweet(id, target, {
          dnt: true,
          theme: 'light',
          conversation: 'none',
          cards: 'hidden',
          width: EMBED_WIDTH
        })).then(function(el){
          if(host._tw !== my) return finish({ok: false, reason: 'stale'});
          if(!el) return finish({ok: false, reason: 'unavailable'});
          return finish({ok: true, reason: 'embed'});
        }, function(){ return finish({ok: false, reason: 'unavailable'}); });
      }).catch(function(){ return finish({ok: false, reason: 'unavailable'}); });
      return Promise.race([attempt, timed]);
    }

    function dismiss(host){
      if(!host) return;
      host._tw = ++seq;
      showArchive(host);
      clearSlot(host);
      linkFor(host, '');
      clearTimeout(host._hide);
    }

    return {mount: mount, dismiss: dismiss, loadCount: function(){ return loads; }, loads: function(){ return loads; }};
  }

  var api = {create: create, statusId: statusId, postUrl: postUrl, deckRow: deckRow, HANDLE: HANDLE, WIDGETS: WIDGETS, EMBED_WIDTH: EMBED_WIDTH};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThrydTweet = api;
  if(typeof document !== 'undefined'){
    var live = create({document: document, twttr: root.twttr});
    root.ThrydTweet.mount = function(host, item, baseMs){ return live.mount(host, item, baseMs); };
    root.ThrydTweet.dismiss = function(host){ return live.dismiss(host); };
  }
})(typeof window !== 'undefined' ? window : globalThis);
