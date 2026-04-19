const CACHE = 'lumia-v1';
const FILES = ['./index.html','./manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil((async()=>{ const k=await caches.keys(); await Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x))); self.clients.claim(); await checkAndNotify(); })()); });
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match('./index.html')))); });
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.openWindow('./')); });
self.addEventListener('message', e => { if(e.data&&e.data.type==='SCHEDULE_CHECK') saveToIDB(e.data.eventos,e.data.tareas,e.data.config).then(()=>checkAndNotify()); });
function openDB(){ return new Promise((res,rej)=>{ const r=indexedDB.open('lumia-sw',1); r.onupgradeneeded=ev=>ev.target.result.createObjectStore('data',{keyPath:'id'}); r.onsuccess=ev=>res(ev.target.result); r.onerror=rej; }); }
function idbGet(store,key){ return new Promise(r=>{ const req=store.get(key); req.onsuccess=()=>r(req.result); req.onerror=()=>r(null); }); }
async function saveToIDB(eventos,tareas,config){ const db=await openDB(); const tx=db.transaction('data','readwrite'); const st=tx.objectStore('data'); st.put({id:'eventos',value:eventos}); st.put({id:'tareas',value:tareas}); st.put({id:'config',value:config}); }
async function checkAndNotify(){
  try{
    const db=await openDB(); const tx=db.transaction('data','readonly'); const st=tx.objectStore('data');
    const evRec=await idbGet(st,'eventos'); const taRec=await idbGet(st,'tareas');
    if(!evRec)return;
    const hoy=new Date(); const hoyStr=hoy.toISOString().split('T')[0];
    const tx2=db.transaction('data','readonly'); const st2=tx2.objectStore('data');
    const yaNotif=await idbGet(st2,'notif-'+hoyStr); if(yaNotif)return;
    const notifs=[];
    (evRec.value||[]).forEach(ev=>{ const dias=Math.round((new Date(ev.fecha+'T00:00:00')-new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()))/86400000); if(dias===0) notifs.push({title:'📅 Evento HOY: '+ev.titulo,body:(ev.hora?'🕐 '+ev.hora+' ':'')+( ev.lugar?'📍 '+ev.lugar:''),tag:'ev-hoy-'+ev.id}); else if(dias===1) notifs.push({title:'⏰ Mañana: '+ev.titulo,body:ev.hora||'',tag:'ev-man-'+ev.id}); });
    (taRec.value||[]).filter(t=>!t.done&&t.fecha).forEach(ta=>{ const dias=Math.round((new Date(ta.fecha+'T00:00:00')-new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()))/86400000); if(dias===0) notifs.push({title:'✅ Tarea vence HOY',body:ta.titulo,tag:'ta-'+ta.id}); else if(dias===1) notifs.push({title:'📋 Tarea vence mañana',body:ta.titulo,tag:'ta-man-'+ta.id}); });
    for(const n of notifs) await self.registration.showNotification(n.title,{body:n.body,tag:n.tag,icon:'./icon-192.png',badge:'./icon-192.png',vibrate:[300,100,300,100,300],data:{url:'./'}});
    if(notifs.length>0){ const tx3=db.transaction('data','readwrite'); tx3.objectStore('data').put({id:'notif-'+hoyStr,value:true}); }
  }catch(e){}
}
