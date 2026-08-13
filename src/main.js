import './style.css';
import { createIcons, Radar, Map, PanelsTopLeft, Bookmark, SlidersHorizontal, Plane, Search, X, ChevronLeft, Settings, Star, Route, Gauge, Navigation, Clock3 } from 'lucide';

const aircraft = [
  { id:'G-EUOE', call:'BAW2DP', flight:'BA272', type:'A388', model:'Airbus A380-841', airline:'British Airways', lat:50.78, lon:-2.10, hdg:74, alt:35100, speed:493, vr:0, from:'LHR', to:'LAX', reg:'G-XLEH', squawk:'5271', dist:42, trail:[[12,78],[18,74],[24,70],[30,65],[37,61]], saved:true },
  { id:'G-TTNA', call:'BAW7LC', flight:'BA783', type:'A20N', model:'Airbus A320neo', airline:'British Airways', lat:50.67, lon:-3.03, hdg:251, alt:11400, speed:319, vr:-1450, from:'LHR', to:'EXT', reg:'G-TTNA', squawk:'7732', dist:18, trail:[[79,24],[76,30],[72,37],[68,44],[63,51]], saved:false },
  { id:'EI-DCL', call:'RYR6AM', flight:'FR4702', type:'B738', model:'Boeing 737-800', airline:'Ryanair', lat:50.47, lon:-3.46, hdg:185, alt:6200, speed:244, vr:-900, from:'DUB', to:'EXT', reg:'EI-DCL', squawk:'6124', dist:11, trail:[[50,15],[50,23],[49,31],[48,40],[47,50]], saved:true },
  { id:'N785AN', call:'AAL87', flight:'AA87', type:'B77W', model:'Boeing 777-323ER', airline:'American Airlines', lat:51.04, lon:-2.42, hdg:276, alt:36000, speed:507, vr:0, from:'LHR', to:'ORD', reg:'N785AN', squawk:'2145', dist:55, trail:[[84,69],[78,66],[71,63],[64,61],[58,58]], saved:false },
  { id:'G-JZHG', call:'EXS41K', flight:'LS1205', type:'B738', model:'Boeing 737-8MG', airline:'Jet2', lat:50.92, lon:-3.36, hdg:161, alt:18900, speed:374, vr:1100, from:'BRS', to:'TFS', reg:'G-JZHG', squawk:'3620', dist:31, trail:[[33,21],[36,28],[39,35],[41,42],[44,48]], saved:false },
  { id:'PH-BHL', call:'KLM1050', flight:'KL1050', type:'B789', model:'Boeing 787-9', airline:'KLM', lat:50.88, lon:-2.74, hdg:92, alt:27800, speed:441, vr:600, from:'AMS', to:'SFO', reg:'PH-BHL', squawk:'4212', dist:37, trail:[[25,58],[32,57],[39,56],[47,56],[54,55]], saved:false },
  { id:'D-AIXJ', call:'DLH4C', flight:'LH421', type:'A359', model:'Airbus A350-941', airline:'Lufthansa', lat:50.57, lon:-2.66, hdg:58, alt:39000, speed:512, vr:0, from:'FRA', to:'BOS', reg:'D-AIXJ', squawk:'1107', dist:49, trail:[[20,80],[27,74],[34,69],[41,64],[48,59]], saved:true },
  { id:'G-LSAK', call:'EXS9NU', flight:'LS515', type:'B752', model:'Boeing 757-21B', airline:'Jet2', lat:50.39, lon:-3.02, hdg:312, alt:9400, speed:301, vr:1800, from:'EXT', to:'PMI', reg:'G-LSAK', squawk:'5066', dist:15, trail:[[62,84],[59,77],[57,70],[55,64],[53,59]], saved:false }
];

let state = {
  view:'radar',
  selected: aircraft[1].id,
  search:'',
  maxAlt:45000,
  minAlt:0,
  range:80,
  showTrails:true,
  showLabels:true,
  onlySaved:false,
  detail:false
};

const app = document.querySelector('#app');

function fmtVr(v){ return v===0 ? 'LEVEL' : `${v>0?'↑':'↓'} ${Math.abs(v).toLocaleString()} fpm`; }
function statusClass(v){ return v>100 ? 'climb' : v<-100 ? 'desc' : 'level'; }

function filtered(){
  const q=state.search.trim().toLowerCase();
  return aircraft.filter(a =>
    a.alt>=state.minAlt && a.alt<=state.maxAlt &&
    (!state.onlySaved || a.saved) &&
    (!q || [a.call,a.flight,a.reg,a.type,a.airline,a.from,a.to].join(' ').toLowerCase().includes(q))
  );
}
function selected(){ return aircraft.find(a=>a.id===state.selected) || aircraft[0]; }

function radarView(){
  const rows = filtered();
  return `
  <section class="radar-stage">
    <div class="range-badge">${state.range} NM</div>
    <div class="radar-grid">
      <div class="scope-ring r1"></div><div class="scope-ring r2"></div><div class="scope-ring r3"></div><div class="scope-ring r4"></div>
      <div class="axis h"></div><div class="axis v"></div>
      <div class="sweep"></div>
      <div class="airport-marker" style="left:50%;top:50%"><span>+</span><b>EXT</b></div>
      ${rows.map((a,i)=>{
        const x = 12 + ((i*17+11)%76);
        const y = 16 + ((i*23+9)%67);
        const trail = state.showTrails ? `<svg class="trail" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${a.trail.map(p=>p.join(',')).join(' ')}"/></svg>`:'';
        return `${trail}<button class="target ${a.id===state.selected?'selected':''}" data-id="${a.id}" style="left:${x}%;top:${y}%">
          <span class="plane-glyph" style="transform:rotate(${a.hdg}deg)">▲</span>
          ${state.showLabels?`<span class="target-label"><strong>${a.call}</strong><small>${Math.round(a.alt/100)} ${a.type}</small><small>${a.speed}kt ${a.hdg}°</small></span>`:''}
        </button>`;
      }).join('')}
      <div class="scope-meta left">50°43'N<br/>003°28'W</div>
      <div class="scope-meta right">QNH 1016<br/>UTC 08:18</div>
    </div>
  </section>`;
}

function mapView(){
  return `<section class="map-stage">
    <div class="map-ocean"></div>
    <div class="land land-a"></div><div class="land land-b"></div>
    <div class="map-road road1"></div><div class="map-road road2"></div><div class="map-road road3"></div>
    <div class="map-label exeter">EXETER</div><div class="map-label teignmouth">TEIGNMOUTH</div><div class="map-label torquay">TORQUAY</div>
    ${filtered().map((a,i)=>`<button class="map-plane ${a.id===state.selected?'selected':''}" data-id="${a.id}" style="left:${15+(i*11)%72}%;top:${20+(i*19)%64}%"><span style="transform:rotate(${a.hdg}deg)">✈</span><b>${a.call}</b></button>`).join('')}
  </section>`;
}

function cardsView(){
  return `<section class="cards-grid">${filtered().map(a=>`
    <article class="trump ${a.id===state.selected?'selected':''}" data-id="${a.id}">
      <div class="trump-head"><div><span>${a.airline}</span><h3>${a.call}</h3></div><button class="star ${a.saved?'on':''}" data-save="${a.id}">★</button></div>
      <div class="route"><b>${a.from}</b><span>→</span><b>${a.to}</b></div>
      <div class="silhouette">✈</div>
      <div class="stats"><span><small>ALT</small>${a.alt.toLocaleString()} ft</span><span><small>SPD</small>${a.speed} kt</span><span><small>HDG</small>${a.hdg}°</span></div>
      <div class="trump-foot"><span>${a.type}</span><span>${a.reg}</span><span class="${statusClass(a.vr)}">${fmtVr(a.vr)}</span></div>
    </article>`).join('')}</section>`;
}

function details(a){
  return `<aside class="detail ${state.detail?'open':''}">
    <div class="detail-top"><button id="closeDetail"><i data-lucide="chevron-left"></i></button><span>AIRCRAFT DETAIL</span><button class="star big ${a.saved?'on':''}" data-save="${a.id}">★</button></div>
    <div class="hero-plane"><div class="airline">${a.airline}</div><div class="hero-icon">✈</div><h2>${a.call}</h2><p>${a.flight} · ${a.model}</p></div>
    <div class="detail-route"><div><small>FROM</small><b>${a.from}</b></div><span>━━━━ ✈ ━━━━</span><div><small>TO</small><b>${a.to}</b></div></div>
    <div class="metric-grid">
      <div><small>ALTITUDE</small><b>${a.alt.toLocaleString()}</b><em>ft</em></div>
      <div><small>GROUND SPEED</small><b>${a.speed}</b><em>kt</em></div>
      <div><small>HEADING</small><b>${a.hdg}°</b><em>magnetic</em></div>
      <div><small>VERTICAL RATE</small><b>${a.vr===0?'0':a.vr.toLocaleString()}</b><em>ft/min</em></div>
      <div><small>REGISTRATION</small><b>${a.reg}</b><em>${a.type}</em></div>
      <div><small>SQUAWK</small><b>${a.squawk}</b><em>Mode A</em></div>
    </div>
    <div class="history"><h3>Recent trail</h3><div class="history-line"></div><p>Demo telemetry · ${a.dist} NM from scope centre</p></div>
  </aside>`;
}

function filtersPanel(){
 return `<div class="drawer" id="drawer">
   <div class="drawer-head"><b>Scope controls</b><button id="closeDrawer"><i data-lucide="x"></i></button></div>
   <label>Radar range <span>${state.range} NM</span><input id="range" type="range" min="20" max="160" step="20" value="${state.range}"></label>
   <label>Minimum altitude <span>${state.minAlt.toLocaleString()} ft</span><input id="minAlt" type="range" min="0" max="40000" step="1000" value="${state.minAlt}"></label>
   <label>Maximum altitude <span>${state.maxAlt.toLocaleString()} ft</span><input id="maxAlt" type="range" min="5000" max="50000" step="1000" value="${state.maxAlt}"></label>
   <label class="toggle"><input id="trails" type="checkbox" ${state.showTrails?'checked':''}><span></span> Trails</label>
   <label class="toggle"><input id="labels" type="checkbox" ${state.showLabels?'checked':''}><span></span> Data labels</label>
   <label class="toggle"><input id="onlySaved" type="checkbox" ${state.onlySaved?'checked':''}><span></span> Saved aircraft only</label>
   <button class="reset" id="resetFilters">RESET FILTERS</button>
 </div>`;
}

function render(){
 const a=selected();
 app.innerHTML = `
 <main class="shell">
   <header>
     <div class="brand"><div class="brand-mark"><i data-lucide="radar"></i></div><div><h1>FLIGHTSCOPE</h1><span>V0.2 · LIVE PROTOTYPE</span></div></div>
     <div class="live"><i></i> DEMO FEED <b>${filtered().length}</b></div>
   </header>
   <div class="toolbar">
     <div class="search"><i data-lucide="search"></i><input id="search" value="${state.search}" placeholder="Flight, callsign, registration…"></div>
     <button id="filters"><i data-lucide="sliders-horizontal"></i><span>FILTERS</span></button>
   </div>
   <div class="content">
     ${state.view==='radar'?radarView():state.view==='map'?mapView():cardsView()}
     ${details(a)}
   </div>
   <nav>
     <button data-view="radar" class="${state.view==='radar'?'active':''}"><i data-lucide="radar"></i><span>RADAR</span></button>
     <button data-view="map" class="${state.view==='map'?'active':''}"><i data-lucide="map"></i><span>MAP</span></button>
     <button data-view="cards" class="${state.view==='cards'?'active':''}"><i data-lucide="panels-top-left"></i><span>CARDS</span></button>
     <button id="saved"><i data-lucide="bookmark"></i><span>SAVED</span></button>
   </nav>
   ${filtersPanel()}
 </main>`;
 createIcons({icons:{Radar,Map,PanelsTopLeft,Bookmark,SlidersHorizontal,Plane,Search,X,ChevronLeft,Settings,Star,Route,Gauge,Navigation,Clock3}});
 bind();
}

function bind(){
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.detail=false;render();});
 document.querySelectorAll('[data-id]').forEach(el=>el.onclick=(e)=>{ if(e.target.closest('[data-save]')) return; state.selected=el.dataset.id; state.detail=true; render(); });
 document.querySelectorAll('[data-save]').forEach(b=>b.onclick=(e)=>{e.stopPropagation(); const a=aircraft.find(x=>x.id===b.dataset.save); a.saved=!a.saved; render();});
 document.querySelector('#search').oninput=e=>{state.search=e.target.value; state.detail=false; render(); setTimeout(()=>{const x=document.querySelector('#search'); if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},0)};
 document.querySelector('#filters').onclick=()=>document.querySelector('#drawer').classList.add('open');
 document.querySelector('#closeDrawer').onclick=()=>document.querySelector('#drawer').classList.remove('open');
 document.querySelector('#closeDetail').onclick=()=>{state.detail=false;render();};
 document.querySelector('#saved').onclick=()=>{state.onlySaved=!state.onlySaved;state.view='cards';state.detail=false;render();};
 const re=()=>{render();setTimeout(()=>document.querySelector('#drawer')?.classList.add('open'),0)};
 document.querySelector('#range').onchange=e=>{state.range=+e.target.value;re()};
 document.querySelector('#minAlt').onchange=e=>{state.minAlt=Math.min(+e.target.value,state.maxAlt-1000);re()};
 document.querySelector('#maxAlt').onchange=e=>{state.maxAlt=Math.max(+e.target.value,state.minAlt+1000);re()};
 document.querySelector('#trails').onchange=e=>{state.showTrails=e.target.checked;re()};
 document.querySelector('#labels').onchange=e=>{state.showLabels=e.target.checked;re()};
 document.querySelector('#onlySaved').onchange=e=>{state.onlySaved=e.target.checked;re()};
 document.querySelector('#resetFilters').onclick=()=>{state.range=80;state.minAlt=0;state.maxAlt=45000;state.showTrails=true;state.showLabels=true;state.onlySaved=false;re()};
}
render();
