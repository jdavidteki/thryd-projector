/* fetch_dedupe.js v1 (24 Nov 2026, Jesuye 8:05 PM ET "this is too heavy" / 8:55 PM "stop overheating"): at load, several scripts each
   fetched the same big data files (tweets_all.json x3, medium_cuts, live_extra, objects_map x2), each with its own ?t= cache-buster.
   Same-file GETs that start within 20 s of each other now share one network request; every caller gets its own clone of the
   response, so nothing downstream changes. After 20 s the next request goes to the network again, so polls still see fresh data. */
(function(){
'use strict';
var W=window;if(W.__thrydFetchDedupe||typeof W.fetch!=='function')return;W.__thrydFetchDedupe=1;
var RX=/\/data\/(tweets_all|medium_cuts|live_extra|objects_map|medium_library|object_methods|world_facts|world_log)\.json$/,TTL=20000;
var nf=W.fetch.bind(W),hold=new Map(),stats={shared:0,net:0};
W.__thrydFetchDedupe={stats:stats};
W.fetch=function(input,init){
  try{
    var m=(init&&init.method)||(input&&typeof input==='object'&&input.method)||'GET';
    if(String(m).toUpperCase()==='GET'&&!(init&&init.signal)){
      var u=new URL(typeof input==='string'?input:(input&&input.url)||String(input),location.href);
      if(u.origin===location.origin&&RX.test(u.pathname)){
        var k=u.pathname,h=hold.get(k),t=Date.now();
        if(h&&t-h.at<TTL){stats.shared++;return h.p.then(function(r){return r.clone();});}
        stats.net++;
        var p=nf(input,init);h={at:t,p:p};hold.set(k,h);
        p.then(function(r){if(!r.ok&&hold.get(k)===h)hold.delete(k);},function(){if(hold.get(k)===h)hold.delete(k);});
        setTimeout(function(){if(hold.get(k)===h)hold.delete(k);},TTL);
        return p.then(function(r){return r.clone();});
      }
    }
  }catch(e){}
  return nf(input,init);
};
})();
