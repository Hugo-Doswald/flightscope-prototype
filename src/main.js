import './style.css';
import './v022.css';
import { createIcons, Radar, Map as MapIcon, PanelsTopLeft, Bookmark, SlidersHorizontal, Search, X, ChevronLeft, Plane } from 'lucide';

const CENTER={lat:50.7344,lon:-3.4139,code:'EXT'}, REFRESH=15000, tracks=new globalThis.Map();
let aircraft=[], lastFetch=0, timer=null;
let state={view:'radar',selected:null,search:'',maxAlt:50000,minAlt:0,range:20,mapRange:80,showTrails:true,showLabels:true,onlySaved:false,detail:false,feed:'CONNECTING',message:''};
const app=document.querySelector('#app');
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const s=(v,d='')=>typeof v==='string'&&v.trim()?v.trim():d;
const label=a=>a.flightNumber||a.call||a.reg||a.id.toUpperCase();

function normalise(r){
 const alt=r.alt_baro==='ground'?0:(r.alt_baro??r.alt_geom);
 return {id:s(r.hex,'unknown'),call:s(r.flight),flightNumber:null,type:s(r.t,'----'),model:s(r.desc,s(r.t,'Unknown aircraft')),
  airline:s(r.ownOp,'Live ADS-B aircraft'),lat:n(r.lat,NaN),lon:n(r.lon,NaN),hdg:n(r.track),alt:n(alt),speed:n(r.gs),
  vr:n(r.baro_rate??r.geom_rate),from:'--',to:'--',reg:s(r.r,s(r.hex,'----').toUpperCase()),squawk:s(r.squawk,'----'),saved:false};
}
function updateTracks(rows){
 const active=new Set();
 rows.forEach(a=>{active.add(a.id);const h=tracks.get(a.id)||[],p=h[h.length-1];
  if(!p||Math.abs(p.lat-a.lat)>.00005||Math.abs(p.lon-a.lon)>.00005){h.push({lat:a.lat,lon:a.lon});while(h.length>12)h.shift();tracks.set(a.id,h);}
 });
 for(const k of tracks.keys())if(!active.has(k))tracks.delete(k);
}
async function refresh(force=false){
 const now=Date.now();if(!force&&now-lastFetch<1400)return;lastFetch=now;state.feed=aircraft.length?'LIVE ADS-B':'CONNECTING';render();
 try{
  const radius=Math.min(250,Math.max(state.range,state.mapRange));
  const tauri=await import('@tauri-apps/api/core'); if(!tauri||typeof tauri.invoke!=='function') throw new Error('Tauri IPC is unavailable'); const p=await tauri.invoke('fetch_live_aircraft',{lat:CENTER.lat,lon:CENTER.lon,radius});
  aircraft=(Array.isArray(p?.ac)?p.ac:[]).map(normalise).filter(a=>Number.isFinite(a.lat)&&Number.isFinite(a.lon));
  updateTracks(aircraft);
  if(!state.selected||!aircraft.some(a=>a.id===state.selected)){state.selected=aircraft[0]?.id||null;state.detail=false;}
  state.feed='LIVE ADS-B';state.message=aircraft.length?'':'No aircraft returned for this area';
 }catch(e){state.feed='FEED ERROR';state.message=String(e);}
 render();
}
function queueRefresh(){clearTimeout(timer);timer=setTimeout(()=>refresh(),1200);}
function point(a,range){const lat=(a.lat-CENTER.lat)*60,lon=(a.lon-CENTER.lon)*60*Math.cos(CENTER.lat*Math.PI/180);return{x:50+(lon/range)*43,y:50-(lat/range)*43,distance:Math.hypot(lat,lon)}}
function filtered(){const q=state.search.trim().toLowerCase();return aircraft.filter(a=>a.alt>=state.minAlt&&a.alt<=state.maxAlt&&(!state.onlySaved||a.saved)&&(!q||[label(a),a.call,a.reg,a.type,a.airline].join(' ').toLowerCase().includes(q)))}
function selected(){return aircraft.find(a=>a.id===state.selected)||null}
function trail(a){const h=tracks.get(a.id)||[];if(h.length<2)return'';const pts=h.map(p=>point(p,state.range)).filter(p=>p.distance<=state.range*1.1).map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`);return pts.length<2?'':`<svg class="trail" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts.join(' ')}"/></svg>`}
function fmtVr(v){return Math.abs(v)<100?'LEVEL':`${v>0?'UP':'DOWN'} ${Math.abs(Math.round(v)).toLocaleString()} fpm`}
function cls(v){return v>100?'climb':v<-100?'desc':'level'}

function radarView(){
 const rows=filtered().map(a=>({a,p:point(a,state.range)})).filter(x=>x.p.distance<=state.range*1.05).sort((x,y)=>x.a.id===state.selected?-1:y.a.id===state.selected?1:x.p.distance-y.p.distance);
 const limit=state.range<=20?28:state.range<=40?22:state.range<=80?14:10,compact=state.range>40;
 return `<section class="radar-stage"><div class="range-badge">${state.range} NM</div><div class="radar-grid">
 <div class="scope-ring r1"></div><div class="scope-ring r2"></div><div class="scope-ring r3"></div><div class="scope-ring r4"></div><div class="sweep"></div>
 <div class="airport-marker" style="left:50%;top:50%"><span>+</span><b>${CENTER.code}</b></div>
 ${rows.map((x,i)=>{const a=x.a,p=x.p,show=state.showLabels&&(i<limit||a.id===state.selected),detail=!compact||a.id===state.selected;
 return `${state.showTrails?trail(a):''}<button class="target ${a.id===state.selected?'selected':''}" data-id="${a.id}" style="left:${p.x}%;top:${p.y}%"><span class="plane-glyph" style="transform:rotate(${a.hdg}deg)">&#9650;</span>${show?`<span class="target-label"><strong>${label(a)}</strong>${detail&&a.call&&a.call!==label(a)?`<small>${a.call}</small>`:''}<small>${Math.round(a.alt/100)} ${a.type}</small>${detail?`<small>${Math.round(a.speed)}kt ${Math.round(a.hdg)}&deg;</small>`:''}</span>`:''}</button>`}).join('')}
 <div class="scope-meta left">50&deg;43'N<br>003&deg;25'W</div><div class="scope-meta right">LIVE ADS-B<br>${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>
 ${state.message?`<div class="feed-message">${state.message}</div>`:''}</section>`;
}
function mapView(){
 const rows=filtered().map(a=>({a,p:point(a,state.mapRange)})).filter(x=>x.p.distance<=state.mapRange*1.15);
 return `<section class="map-stage"><div class="map-range">${state.mapRange} NM</div><div class="map-controls"><button id="mapIn">+</button><button id="mapOut">-</button></div>
 <div class="map-scene"><div class="map-ocean"></div><div class="land land-a"></div><div class="land land-b"></div><div class="map-road road1"></div><div class="map-road road2"></div><div class="map-road road3"></div>
 <div class="map-label exeter">EXETER</div><div class="map-label teignmouth">TEIGNMOUTH</div><div class="map-label torquay">TORQUAY</div>
 ${rows.map(x=>`<button class="map-plane ${x.a.id===state.selected?'selected':''}" data-id="${x.a.id}" style="left:${x.p.x}%;top:${x.p.y}%"><span style="transform:rotate(${x.a.hdg}deg)">&#9992;</span><b>${label(x.a)}</b><small>${Math.round(x.a.alt).toLocaleString()} ft</small></button>`).join('')}</div></section>`;
}
function cardsView(){const r=filtered();return `<section class="cards-grid">${r.length?r.map(a=>`<article class="trump ${a.id===state.selected?'selected':''}" data-id="${a.id}">
 <div class="trump-head"><div><span>${a.airline}</span><h3>${label(a)}</h3>${a.call&&a.call!==label(a)?`<small>${a.call}</small>`:''}</div><button class="star ${a.saved?'on':''}" data-save="${a.id}">&#9733;</button></div>
 <div class="route"><b>${a.from}</b><span>&rarr;</span><b>${a.to}</b></div><div class="silhouette">&#9992;</div>
 <div class="stats"><span><small>ALT</small>${Math.round(a.alt).toLocaleString()} ft</span><span><small>SPD</small>${Math.round(a.speed)} kt</span><span><small>HDG</small>${Math.round(a.hdg)}&deg;</span></div>
 <div class="trump-foot"><span>${a.type}</span><span>${a.reg}</span><span class="${cls(a.vr)}">${fmtVr(a.vr)}</span></div></article>`).join(''):'<div class="empty-state">No aircraft match the current filters.</div>'}</section>`}
function details(a){if(!a)return'';return `<aside class="detail ${state.detail?'open':''}"><div class="detail-top"><button id="closeDetail"><i data-lucide="chevron-left"></i></button><span>AIRCRAFT DETAIL</span><button class="star big ${a.saved?'on':''}" data-save="${a.id}">&#9733;</button></div>
 <div class="hero-plane"><div class="airline">${a.airline}</div><div class="hero-icon">&#9992;</div><h2>${label(a)}</h2><p>${a.call||'No callsign'} &middot; ${a.model}</p></div>
 <div class="detail-route"><div><small>FROM</small><b>${a.from}</b></div><span>--- &gt; ---</span><div><small>TO</small><b>${a.to}</b></div></div>
 <div class="metric-grid"><div><small>ALTITUDE</small><b>${Math.round(a.alt).toLocaleString()}</b><em>ft</em></div><div><small>GROUND SPEED</small><b>${Math.round(a.speed)}</b><em>kt</em></div><div><small>HEADING</small><b>${Math.round(a.hdg)}&deg;</b><em>track</em></div><div><small>VERTICAL RATE</small><b>${Math.round(a.vr).toLocaleString()}</b><em>ft/min</em></div><div><small>REGISTRATION</small><b>${a.reg}</b><em>${a.type}</em></div><div><small>SQUAWK</small><b>${a.squawk}</b><em>Mode A</em></div></div>
 <div class="history"><h3>Observed trail</h3><p>${(tracks.get(a.id)||[]).length} live position samples stored this session.</p></div></aside>`}
function filtersPanel(){return `<div class="drawer" id="drawer"><div class="drawer-head"><b>Scope controls</b><button id="closeDrawer"><i data-lucide="x"></i></button></div>
 <label>Radar range <span>${state.range} NM</span><input id="range" type="range" min="20" max="160" step="20" value="${state.range}"></label>
 <label>Minimum altitude <span>${state.minAlt.toLocaleString()} ft</span><input id="minAlt" type="range" min="0" max="40000" step="1000" value="${state.minAlt}"></label>
 <label>Maximum altitude <span>${state.maxAlt.toLocaleString()} ft</span><input id="maxAlt" type="range" min="5000" max="50000" step="1000" value="${state.maxAlt}"></label>
 <label class="toggle"><input id="trails" type="checkbox" ${state.showTrails?'checked':''}> Trails</label><label class="toggle"><input id="labels" type="checkbox" ${state.showLabels?'checked':''}> Data labels</label><label class="toggle"><input id="onlySaved" type="checkbox" ${state.onlySaved?'checked':''}> Saved aircraft only</label><button class="reset" id="resetFilters">RESET FILTERS</button></div>`}
function render(){const a=selected();app.innerHTML=`<main class="shell"><header><div class="brand"><div class="brand-mark"><i data-lucide="radar"></i></div><div><h1>FLIGHTSCOPE</h1><span>V0.2.4 &middot; LIVE PROTOTYPE</span></div></div><div class="live ${state.feed==='FEED ERROR'?'error':''}"><i></i> ${state.feed} <b>${filtered().length}</b></div></header>
 <div class="toolbar"><div class="search"><i data-lucide="search"></i><input id="search" value="${state.search}" placeholder="Flight, callsign, registration..."></div><button id="filters"><i data-lucide="sliders-horizontal"></i><span>FILTERS</span></button></div>
 <div class="content view-${state.view}">${state.view==='radar'?radarView():state.view==='map'?mapView():cardsView()}${details(a)}</div>
 <nav><button data-view="radar" class="${state.view==='radar'?'active':''}"><i data-lucide="radar"></i><span>RADAR</span></button><button data-view="map" class="${state.view==='map'?'active':''}"><i data-lucide="map"></i><span>MAP</span></button><button data-view="cards" class="${state.view==='cards'?'active':''}"><i data-lucide="panels-top-left"></i><span>CARDS</span></button><button id="saved"><i data-lucide="bookmark"></i><span>SAVED</span></button></nav>${filtersPanel()}</main>`;
 createIcons({icons:{Radar,Map:MapIcon,PanelsTopLeft,Bookmark,SlidersHorizontal,Search,X,ChevronLeft,Plane}});bind();}
function bind(){
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.detail=false;render()});
 document.querySelectorAll('[data-id]').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-save]'))return;state.selected=el.dataset.id;state.detail=true;render()});
 document.querySelectorAll('[data-save]').forEach(b=>b.onclick=e=>{e.stopPropagation();const a=aircraft.find(x=>x.id===b.dataset.save);if(a)a.saved=!a.saved;render()});
 const q=document.querySelector('#search');if(q)q.oninput=e=>{state.search=e.target.value;state.detail=false;render();setTimeout(()=>{const x=document.querySelector('#search');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},0)};
 document.querySelector('#filters').onclick=()=>document.querySelector('#drawer').classList.add('open');document.querySelector('#closeDrawer').onclick=()=>document.querySelector('#drawer').classList.remove('open');
 const cd=document.querySelector('#closeDetail');if(cd)cd.onclick=()=>{state.detail=false;render()};document.querySelector('#saved').onclick=()=>{state.onlySaved=!state.onlySaved;state.view='cards';state.detail=false;render()};
 const re=()=>{render();setTimeout(()=>document.querySelector('#drawer')?.classList.add('open'),0)};
 document.querySelector('#range').onchange=e=>{state.range=Number(e.target.value);re();queueRefresh()};document.querySelector('#minAlt').onchange=e=>{state.minAlt=Math.min(Number(e.target.value),state.maxAlt-1000);re()};document.querySelector('#maxAlt').onchange=e=>{state.maxAlt=Math.max(Number(e.target.value),state.minAlt+1000);re()};
 document.querySelector('#trails').onchange=e=>{state.showTrails=e.target.checked;re()};document.querySelector('#labels').onchange=e=>{state.showLabels=e.target.checked;re()};document.querySelector('#onlySaved').onchange=e=>{state.onlySaved=e.target.checked;re()};
 document.querySelector('#resetFilters').onclick=()=>{state.range=20;state.minAlt=0;state.maxAlt=50000;state.showTrails=true;state.showLabels=true;state.onlySaved=false;re();queueRefresh()};
 const mi=document.querySelector('#mapIn'),mo=document.querySelector('#mapOut');if(mi)mi.onclick=()=>{state.mapRange=Math.max(20,state.mapRange/2);render();queueRefresh()};if(mo)mo.onclick=()=>{state.mapRange=Math.min(250,state.mapRange*2);render();queueRefresh()};
}
try{render();setTimeout(()=>refresh(true),250);setInterval(()=>refresh(),REFRESH)}catch(e){console.error(e);document.body.innerHTML='<div style="padding:24px;background:#050906;color:#d7fbe4;font-family:system-ui"><h2>FlightScope V0.2.3 startup error</h2><pre style="white-space:pre-wrap;color:#ffb28e">'+String(e)+'</pre></div>'}
