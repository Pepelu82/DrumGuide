const STATIC_HOSTED=true;
const APP_VERSION='10.33.0';
const NAV=[
  ['home','Inicio','⌂'],['songs','Canciones','♫'],['setlists','Setlists','≡'],['metro','Metrónomo','●'],['live','Directo','▶'],['pdf','PDF','▤']
];
let state={page:'home',db:null,activeSetlist:null,liveIndex:0,liveFull:false,liveLayout:Math.max(1,Math.min(8,Number(localStorage.getItem('drumguide_live_layout')||1))),mediaObjectUrl:null,activeMediaEl:null,mp3Player:null,songMetroId:null,rhythmVolume:Math.max(.15,Math.min(1,Number(localStorage.getItem('drumguide_rhythm_volume')||.9))),metro:{running:false,bpm:100,meter:4,denominator:4,subdivision:1,sound:'click',accent:true,volume:.7,timer:null,nextNoteTime:0,currentBeat:0,audio:null,tap:[]},deferredInstall:null,dirty:false};
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const uid=p=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const minsToText=s=>{s=Number(s)||0;const m=Math.floor(s/60),r=s%60;return `${m}:${String(r).padStart(2,'0')}`};
const totalDuration=ids=>ids.reduce((a,id)=>a+(state.db.songs.find(s=>s.id===id)?.duration||0),0);
const signature=s=>`${s.meter||4}/${s.denominator||4}`;
const DRUM_ROWS=[
  ['cr','Crash','CR'],['rd','Ride','RD'],['hh','Hi-hat','HH'],['ht','Tom alto','TA'],['mt','Tom medio','TM'],['ft','Tom base','TB'],['sd','Caja','CJ'],['bd','Bombo','BO']
];
const SECTION_NAME_OPTIONS=[
  'Entrada batería','Entrada banda','Entrada voz',
  'Intro banda','Intro solo','Intro voz','Intro instrumental','Intro batería','Intro guitarra','Intro bajo','Intro teclado',
  'Estrofa 1','Estrofa 2','Estrofa 3','Estrofa 4','Estrofa 5','Estrofa 6',
  'Verso 1','Verso 2','Verso 3','Verso 4','Verso 5','Verso 6',
  'Preestribillo 1','Preestribillo 2','Preestribillo 3','Preestribillo 4',
  'Estribillo 1','Estribillo 2','Estribillo 3','Estribillo 4','Estribillo 5','Estribillo 6',
  'Post-estribillo 1','Post-estribillo 2','Post-estribillo 3','Post-estribillo 4',
  'Puente','Puente 1','Puente 2','Interludio','Interludio instrumental','Instrumental','Break','Breakdown','Build-up','Parón','Silencio / corte',
  'Solo guitarra','Solo bajo','Solo batería','Solo teclado','Solo saxo','Solo voz','Solo instrumental',
  'Coda','Outro','Outro banda','Outro solo','Outro voz','Outro instrumental',
  'Final','Final banda','Final instrumental','Final seco','Final con corte','Final fade out'
];
const CUSTOM_SECTION_VALUE='__custom__';
const rhythmSteps=(song,resolution=16,bars=1)=>Math.max(1,Math.round((song.meter||4)*resolution/(song.denominator||4))*Math.max(1,Math.min(16,+bars||1)));
const rhythmStepsPerBar=(song,resolution=16)=>Math.max(1,Math.round((song.meter||4)*resolution/(song.denominator||4)));
function normalizeRhythm(rhythm,song){
 const resolution=[8,16].includes(+rhythm?.resolution)?+rhythm.resolution:16;
 const bars=Math.max(1,Math.min(16,+rhythm?.bars||1));
 const steps=rhythmSteps(song,resolution,bars),tracks={};
 DRUM_ROWS.forEach(([id])=>{const old=Array.isArray(rhythm?.tracks?.[id])?rhythm.tracks[id]:[];tracks[id]=Array.from({length:steps},(_,i)=>Math.max(0,Math.min(2,+old[i]||0)))});
 return {resolution,bars,steps,tracks};
}
function hasRhythm(r){return !!r&&Object.values(r.tracks||{}).some(a=>Array.isArray(a)&&a.some(Boolean))}
function rhythmText(r){if(!hasRhythm(r))return '';return DRUM_ROWS.map(([id,,abbr])=>{const a=r.tracks?.[id]||[];if(!a.some(Boolean))return '';return `${abbr} ${a.map(v=>v===2?'◆':v===1?'●':'·').join('')}`}).filter(Boolean).join(' / ')}
const toast=(msg)=>{const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(t._timer);t._timer=setTimeout(()=>t.hidden=true,2600)};

function defaultDB(){
 return {version:1,settings:{appName:'DrumGuide'},mediaItems:[],songs:[
  {id:'song_demo_1',title:'Ejemplo · Groove Rock',artist:'Demo',bpm:96,meter:4,denominator:4,subdivision:1,duration:225,key:'',status:'Lista',notes:'Entrada tras 4 tiempos. Vigilar el corte antes del último estribillo.',guide:[
    {name:'Intro',bars:'4',pattern:'Hi-hat 8ths · Caja 2/4 · Bombo 1/3',notes:'Fill corto en compás 4'},
    {name:'Verso 1',bars:'8',pattern:'Groove cerrado',notes:'Dinámica media'},
    {name:'Estribillo',bars:'8',pattern:'Crash + groove abierto',notes:'Crash en 1. Fill de 1 compás al final'},
    {name:'Puente',bars:'4',pattern:'Tom base + negras',notes:'Crecer progresivamente'}
  ]},
  {id:'song_demo_2',title:'Ejemplo · Pop 120',artist:'Demo',bpm:120,meter:4,denominator:4,subdivision:2,duration:198,key:'',status:'Ensayando',notes:'Click a corcheas en ensayo.',guide:[
    {name:'Intro',bars:'8',pattern:'Clap/caja en 2 y 4',notes:'Sin crash al inicio'},
    {name:'Verso',bars:'16',pattern:'Hi-hat 8ths, ghost notes suaves',notes:'Mantener tempo estable'},
    {name:'Estribillo',bars:'8',pattern:'Ride/Crash, bombo más activo',notes:'Abrir hi-hat último compás'}
  ]},
  {id:'song_demo_3',title:'Ejemplo · Balada',artist:'Demo',bpm:72,meter:6,denominator:8,subdivision:1,duration:255,key:'',status:'Pendiente',notes:'6/8. Prioridad a dinámica y respiración.',guide:[
    {name:'Intro',bars:'4',pattern:'Ride suave · 6/8',notes:'Entrada muy contenida'},
    {name:'Cuerpo',bars:'16',pattern:'Bombo 1/4 · Caja 4',notes:'Crescendo progresivo'}
  ]}
 ],setlists:[{id:'set_demo',name:'Setlist Demo',date:'',notes:'Ejemplo para probar el modo directo.',songIds:['song_demo_1','song_demo_2','song_demo_3']}],updatedAt:new Date().toISOString()};
}


function repairDB(db){
 const base=defaultDB();
 if(!db||typeof db!=='object')return base;
 if(!Array.isArray(db.songs))db.songs=[];
 if(!Array.isArray(db.setlists))db.setlists=[];
 if(!db.settings||typeof db.settings!=='object')db.settings={appName:'DrumGuide'};
 if(!Array.isArray(db.mediaItems))db.mediaItems=[];
 const seenMedia=new Set();
 db.mediaItems=db.mediaItems.filter(Boolean).map((m,i)=>{
   if(!m.id||seenMedia.has(m.id))m.id=uid('media');seenMedia.add(m.id);
   m.type=['local','youtube'].includes(m.type)?m.type:'local';
   m.name=String(m.name||`Multimedia ${i+1}`);m.mime=String(m.mime||'');m.youtubeId=String(m.youtubeId||'');m.source=String(m.source||'');
   return m;
 });
 const seenSongs=new Set();
 db.songs=db.songs.filter(Boolean).map((s,i)=>{
   if(!s.id||seenSongs.has(s.id))s.id=uid('song');seenSongs.add(s.id);
   s.title=String(s.title||`Canción ${i+1}`);s.artist=String(s.artist||'');
   s.bpm=Math.max(30,Math.min(300,+s.bpm||100));s.meter=Math.max(1,+s.meter||4);s.denominator=+s.denominator||4;
   s.subdivision=[1,2,4].includes(+s.subdivision)?+s.subdivision:1;s.duration=Math.max(0,+s.duration||0);
   s.status=['Pendiente','Ensayando','Lista'].includes(s.status)?s.status:'Pendiente';s.notes=String(s.notes||'');s.key=String(s.key||'');s.mediaId=String(s.mediaId||'');
   if(!Array.isArray(s.guide))s.guide=[];
   s.guide=s.guide.filter(Boolean).map(g=>({name:String(g.name||'Sección'),bars:String(g.bars||'4'),pattern:String(g.pattern||''),notes:String(g.notes||''),rhythm:g.rhythm||null}));
   return s;
 });
 const validSongIds=new Set(db.songs.map(s=>s.id)),seenSets=new Set();
 db.setlists=db.setlists.filter(Boolean).map((sl,i)=>{
   if(!sl.id||seenSets.has(sl.id))sl.id=uid('set');seenSets.add(sl.id);
   sl.name=String(sl.name||`Setlist ${i+1}`);sl.date=String(sl.date||'');sl.notes=String(sl.notes||'');
   if(!Array.isArray(sl.songIds))sl.songIds=[];
   sl.songIds=sl.songIds.filter(id=>validSongIds.has(id));
   return sl;
 });
 return db;
}

async function api(path,opts={}){
 if(location.protocol==='file:') throw new Error('LOCAL_FILE');
 const key=localStorage.getItem('drumguide_key')||'';
 const headers={'Content-Type':'application/json','X-App-Key':key,...(opts.headers||{})};
 const r=await fetch(path,{...opts,headers});
 if(r.status===401) throw new Error('AUTH');
 if(!r.ok) throw new Error(`HTTP ${r.status}`);
 const ct=r.headers.get('content-type')||''; return ct.includes('json')?r.json():r.text();
}
async function loadDB(){
 if(STATIC_HOSTED){
   const cached=localStorage.getItem('drumguide_cache');
   state.db=repairDB(cached?JSON.parse(cached):defaultDB());
   setSync(true,'Datos en este dispositivo');
   return;
 }
 const hash=new URLSearchParams(location.hash.slice(1));
 if(hash.get('key')){localStorage.setItem('drumguide_key',hash.get('key'));history.replaceState(null,'',location.pathname+location.search)}
 try{
   state.db=await api('/api/data');
   localStorage.setItem('drumguide_cache',JSON.stringify(state.db));
   setSync(true,'Datos sincronizados');
 }catch(e){
   if(e.message==='AUTH'){
     const k=prompt('Introduce el código de acceso de DrumGuide:');
     if(k){localStorage.setItem('drumguide_key',k);return loadDB()}
   }
   const cached=localStorage.getItem('drumguide_cache'); state.db=repairDB(cached?JSON.parse(cached):defaultDB());
   setSync(false,'Modo sin conexión');
 }
 state.db=repairDB(state.db);
}
async function saveDB(msg='Guardado'){
 state.db=repairDB(state.db);state.db.updatedAt=new Date().toISOString(); localStorage.setItem('drumguide_cache',JSON.stringify(state.db)); state.dirty=true;
 if(STATIC_HOSTED){state.dirty=false;setSync(true,'Datos en este dispositivo');toast(msg);return;}
 try{await api('/api/data',{method:'POST',body:JSON.stringify(state.db)});state.dirty=false;setSync(true,'Datos sincronizados');toast(msg)}
 catch(e){setSync(false,'Guardado en este dispositivo');toast('Guardado localmente. Se sincronizará al recuperar conexión.')}
}
function setSync(ok,text){const b=$('#syncBadge');if(!b)return;b.textContent=`● ${text}`;b.classList.toggle('online',ok);b.classList.toggle('offline',!ok)}
window.addEventListener('online',async()=>{if(STATIC_HOSTED)return;if(state.dirty&&state.db){try{await api('/api/data',{method:'POST',body:JSON.stringify(state.db)});state.dirty=false;setSync(true,'Datos sincronizados');toast('Cambios sincronizados')}catch{}}});

function renderNav(){
 const side=$('#sideNav'),bottom=$('#bottomNav');
 side.innerHTML=NAV.map(([id,label,ico])=>`<button data-page="${id}" class="${state.page===id?'active':''}">${ico} &nbsp;${label}</button>`).join('');
 bottom.innerHTML=NAV.map(([id,label,ico])=>`<button data-page="${id}" class="${state.page===id?'active':''}"><span class="ico">${ico}</span>${label}</button>`).join('');
 $$('[data-page]').forEach(b=>b.onclick=()=>go(b.dataset.page));
}
function go(page){if(page!=='live'){state.liveFull=false;document.body.classList.remove('live-full');if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{})}state.page=page;render()}
function titles(){return {home:['Inicio','Tu repertorio, guías y directo en un solo lugar.'],songs:['Canciones','Crea la ficha y la guía de batería de cada tema.'],setlists:['Setlists','Ordena repertorios para ensayo o concierto.'],metro:['Metrónomo','Tempo, compás, subdivisión y sonidos.'],live:['Modo directo','Setlist, guía y metrónomo preparados para tocar.'],pdf:['PDF','Genera setlists o guías completas listas para tablet e impresión.']}[state.page]}
function render(){document.body.classList.toggle('live-full',state.page==='live'&&state.liveFull);renderNav();const [t,s]=titles();$('#pageTitle').textContent=t;$('#pageSubtitle').textContent=s;const vb=$('#versionBadge');if(vb)vb.textContent=`v${APP_VERSION}`;const v=$('#view');v.innerHTML='';({home:renderHome,songs:renderSongs,setlists:renderSetlists,metro:renderMetro,live:renderLive,pdf:renderPDF}[state.page]||renderHome)(); bindGlobalActions();}
function bindGlobalActions(){
 $$('[data-action="new-song"]').forEach(b=>b.onclick=()=>songModal());
 $$('[data-action="backup"]').forEach(b=>b.onclick=manualBackup);
 $$('[data-action="restore"]').forEach(b=>b.onclick=()=>$('#restoreInput')?.click());
 const ri=$('#restoreInput');if(ri&&!ri.dataset.bound){ri.dataset.bound='1';ri.onchange=restoreBackup;}
 $$('[data-action="update"]').forEach(b=>b.onclick=forceUpdateApp);
}

function renderHome(){
 const ready=state.db.songs.filter(s=>s.status==='Lista').length;
 const sec=$('#view'); sec.innerHTML=`
 <div class="grid cols-4">
   <div class="card stat"><strong>${state.db.songs.length}</strong><span>Canciones</span></div>
   <div class="card stat"><strong>${state.db.setlists.length}</strong><span>Setlists</span></div>
   <div class="card stat"><strong>${ready}</strong><span>Listas para tocar</span></div>
   <div class="card stat"><strong>${state.db.songs.reduce((a,s)=>a+(s.guide?.length||0),0)}</strong><span>Bloques de guía</span></div>
 </div>
 <div class="section-head"><h2>Acciones rápidas</h2></div>
 <div class="grid cols-4">
   <button class="card" data-home="songs" style="text-align:left"><strong>♫ Crear guía</strong><p class="muted">Añade una canción y estructura su batería por secciones.</p></button>
   <button class="card" data-home="setlists" style="text-align:left"><strong>≡ Preparar setlist</strong><p class="muted">Ordena canciones y calcula la duración total.</p></button>
   <button class="card" data-home="live" style="text-align:left"><strong>▶ Abrir modo directo</strong><p class="muted">Guía grande, BPM y navegación canción a canción.</p></button>
   <a class="card update-card" href="https://neocities.org/dashboard" target="_blank" rel="noopener"><strong>⬆ Actualizar versión</strong><p class="muted">Abre el panel de Neocities para sustituir los archivos de DrumGuide. No subas el ZIP: descomprímelo y sube los archivos.</p></a>
 </div>
 <div class="section-head"><h2>Últimas canciones</h2><button class="btn ghost small" data-page2="songs">Ver todas</button></div>
 <div class="list">${state.db.songs.slice(-5).reverse().map(songRow).join('')||'<div class="empty">Todavía no hay canciones.</div>'}</div>`;
 $$('[data-home]').forEach(b=>b.onclick=()=>go(b.dataset.home)); $$('[data-page2]').forEach(b=>b.onclick=()=>go(b.dataset.page2)); bindSongRows();
}
function songRow(s){const media=state.db.mediaItems.find(m=>m.id===s.mediaId);return `<div class="row"><div class="row-main"><div class="row-title">${esc(s.title)}</div><div class="row-meta">${esc(s.artist||'Sin artista')} · ${s.bpm||'—'} BPM · ${signature(s)} · ${minsToText(s.duration)}${media?` · 🎧 ${esc(media.name)}`:''}</div></div><span class="pill ${s.status==='Lista'?'good':s.status==='Ensayando'?'warn':''}">${esc(s.status||'Pendiente')}</span><div class="row-actions"><button class="btn primary small" data-song-transcribe="${s.id}">▶ Transcribir</button><button class="btn ghost small" data-song-guide="${s.id}">Guía</button><button class="btn ghost small" data-song-edit="${s.id}">Editar</button><button class="btn danger small" data-song-delete="${s.id}">Eliminar</button></div></div>`}

function normalizeImportHeader(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function importHeaderField(value){
 const h=normalizeImportHeader(value);
 if(!h)return '';
 if(/^(titulo|cancion|tema|nombre)( de la cancion)?$/.test(h))return 'title';
 if(/^(artista|artistas|interprete|interpretes|interprete es|grupo|autor)$/.test(h))return 'artist';
 if(/^(bpm|tempo)$/.test(h))return 'bpm';
 if(/^(compas|compases|numero compases|numero de compases|firma de compas|time signature|meter)$/.test(h))return 'signature';
 if(/^(duracion|duracion total|duracion mp3|tiempo|minutos|minutos totales|duracion segundos)$/.test(h))return 'duration';
 if(/^(estado|status)$/.test(h))return 'status';
 if(/^(subdivision|subdivision metronomo|metronomo)$/.test(h))return 'subdivision';
 if(/^(tono|referencia|tono referencia|key)$/.test(h))return 'key';
 if(/^(notas|notas generales|comentarios|observaciones)$/.test(h))return 'notes';
 return '';
}
function splitImportLine(line,delimiter){
 const out=[];let cur='',quote=false;
 for(let i=0;i<line.length;i++){
  const ch=line[i];
  if(ch==='"'){
   if(quote&&line[i+1]==='"'){cur+='"';i++;}
   else quote=!quote;
  }else if(ch===delimiter&&!quote){out.push(cur.trim());cur='';}
  else cur+=ch;
 }
 out.push(cur.trim());
 if(delimiter==='|')return out.filter((x,i,a)=>!(x===''&&(i===0||i===a.length-1)));
 return out;
}
function parseImportDuration(value){
 const raw=String(value||'').trim();if(!raw)return 0;
 const hms=raw.match(/^(\d+):([0-5]?\d):([0-5]?\d)$/);if(hms)return (+hms[1])*3600+(+hms[2])*60+(+hms[3]);
 const ms=raw.match(/^(\d+):([0-5]?\d)$/);if(ms)return (+ms[1])*60+(+ms[2]);
 const words=raw.match(/^(?:(\d+)\s*h(?:oras?)?\s*)?(?:(\d+)\s*m(?:in(?:utos?)?)?\s*)?(?:(\d+)\s*s(?:eg(?:undos?)?)?)?$/i);
 if(words&&(words[1]||words[2]||words[3]))return (+words[1]||0)*3600+(+words[2]||0)*60+(+words[3]||0);
 const n=Number(raw.replace(',','.'));return Number.isFinite(n)&&n>=0?Math.round(n):0;
}
function parseImportSignature(value){
 const m=String(value||'').trim().match(/^(\d{1,2})\s*[\/x]\s*(\d{1,2})$/i);return m?[Math.max(1,+m[1]||4),Math.max(1,+m[2]||4)]:[4,4];
}
function parseImportSubdivision(value){
 const v=normalizeImportHeader(value);
 if(v==='2'||v.includes('corchea'))return 2;
 if(v==='4'||v.includes('semicorchea'))return 4;
 return 1;
}
function parseImportStatus(value){
 const v=normalizeImportHeader(value);
 if(v.includes('lista'))return 'Lista';
 if(v.includes('ensay'))return 'Ensayando';
 return 'Pendiente';
}
function importRowToSong(row){
 const title=String(row.title||'').trim();if(!title)return null;
 const [meter,denominator]=parseImportSignature(row.signature);
 const bpm=Math.max(30,Math.min(300,+String(row.bpm||'').replace(',','.')||100));
 return {id:uid('song'),title,artist:String(row.artist||'').trim(),bpm,meter,denominator,subdivision:parseImportSubdivision(row.subdivision),duration:parseImportDuration(row.duration),key:String(row.key||'').trim(),status:parseImportStatus(row.status),notes:String(row.notes||'').trim(),guide:[]};
}
function parseBulkSongText(text){
 const raw=String(text||'').replace(/\r/g,'').trim();
 if(!raw)return {songs:[],errors:['El cuadro está vacío.']};
 const errors=[],rows=[];
 // Formato por bloques: Título: ... / Artista: ... / BPM: ...
 const blocks=raw.split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean);
 const looksLabelled=blocks.some(b=>b.split('\n').filter(l=>/^\s*[^:]{2,40}:\s*.+/.test(l)).length>=2);
 if(looksLabelled){
  blocks.forEach((block,bi)=>{
   const obj={};
   block.split('\n').forEach(line=>{
    const m=line.match(/^\s*[-•*]?\s*([^:]{2,50}):\s*(.*)$/);if(!m)return;
    const field=importHeaderField(m[1]);if(field)obj[field]=m[2].trim();
   });
   if(obj.title)rows.push(obj);else errors.push(`Bloque ${bi+1}: falta el título.`);
  });
 }else{
  const lines=raw.split('\n').map(x=>x.trim()).filter(Boolean);
  let delimiter='|';
  if(!lines.some(l=>l.includes('|'))){
   if(lines.some(l=>l.includes('\t')))delimiter='\t';
   else if(lines.some(l=>l.includes(';')))delimiter=';';
   else delimiter=',';
  }
  let parsed=lines.map(l=>splitImportLine(l,delimiter));
  // Quita la línea separadora típica de tablas Markdown.
  parsed=parsed.filter(c=>!c.length||!c.every(x=>/^:?-{2,}:?$/.test(x.replace(/\s/g,''))));
  if(!parsed.length)return {songs:[],errors:['No se han detectado filas.']};
  const header=parsed[0],mapped=header.map(importHeaderField),known=mapped.filter(Boolean).length;
  const hasHeader=known>=2&&mapped.includes('title');
  const fields=hasHeader?mapped:['title','artist','bpm','signature','duration','status','subdivision','key','notes'];
  const start=hasHeader?1:0;
  for(let i=start;i<parsed.length;i++){
   const cells=parsed[i];if(!cells.some(Boolean))continue;
   const obj={};fields.forEach((f,j)=>{if(f)obj[f]=cells[j]??''});
   if(!obj.title){errors.push(`Fila ${i+1}: falta el título.`);continue}
   rows.push(obj);
  }
 }
 const songs=rows.map(importRowToSong).filter(Boolean);
 return {songs,errors};
}
function bulkSongImportPanelHTML(){
 return `<details class="card bulk-song-import" id="bulkSongImport"><summary><strong>📋 Crear varias canciones pegando texto</strong><span class="muted">Pega una tabla o lista y DrumGuide crea las fichas automáticamente.</span></summary><div class="bulk-song-import-body"><div class="media-help"><strong>Orden recomendado:</strong> Título | Artista | BPM | Compás | Duración | Estado | Subdivisión | Tono | Notas<br><span class="muted">Duración admite 4:22 o segundos. También puedes pegar directamente una tabla con encabezados.</span></div><textarea id="bulkSongText" class="textarea bulk-song-text" rows="8" placeholder="Título | Artista | BPM | Compás | Duración | Estado | Subdivisión | Tono | Notas\nA contraluz | Fito y Fitipaldis | 155 | 4/4 | 4:22 | Pendiente | Negras | |"></textarea><div class="inline bulk-song-actions"><label class="inline"><input id="bulkSongSkipExisting" type="checkbox" checked> Omitir canciones que ya existan</label><button type="button" class="btn ghost" id="bulkSongCheck">Comprobar texto</button><button type="button" class="btn primary" id="bulkSongCreate">Crear canciones</button></div><div id="bulkSongPreview" class="bulk-song-preview muted">Todavía no se ha analizado el texto.</div></div></details>`;
}
function bindBulkSongImport(){
 const text=$('#bulkSongText'),preview=$('#bulkSongPreview');if(!text||!preview)return;
 const analyze=()=>{
  const result=parseBulkSongText(text.value),existing=new Set(state.db.songs.map(s=>`${normalizeImportHeader(s.title)}|${normalizeImportHeader(s.artist)}`));
  const dup=result.songs.filter(s=>existing.has(`${normalizeImportHeader(s.title)}|${normalizeImportHeader(s.artist)}`)).length;
  if(!result.songs.length){preview.innerHTML=`<strong>No se han detectado canciones.</strong>${result.errors.length?`<div>${result.errors.map(esc).join('<br>')}</div>`:''}`;return result}
  preview.innerHTML=`<strong>${result.songs.length} canción${result.songs.length===1?'':'es'} detectada${result.songs.length===1?'':'s'}.</strong>${dup?` <span class="pill warn">${dup} ya existe${dup===1?'':'n'}</span>`:''}<div class="bulk-song-preview-list">${result.songs.slice(0,8).map(s=>`<div><strong>${esc(s.title)}</strong> · ${esc(s.artist||'Sin artista')} · ${s.bpm} BPM · ${signature(s)} · ${minsToText(s.duration)}</div>`).join('')}${result.songs.length>8?`<div>… y ${result.songs.length-8} más</div>`:''}</div>${result.errors.length?`<div class="danger-text">${result.errors.map(esc).join('<br>')}</div>`:''}`;
  return result;
 };
 $('#bulkSongCheck').onclick=analyze;
 $('#bulkSongCreate').onclick=async()=>{
  const result=analyze();if(!result.songs.length)return;
  const skip=$('#bulkSongSkipExisting')?.checked;
  const existing=new Set(state.db.songs.map(s=>`${normalizeImportHeader(s.title)}|${normalizeImportHeader(s.artist)}`));
  const batchSeen=new Set(),toCreate=[];
  result.songs.forEach(s=>{const k=`${normalizeImportHeader(s.title)}|${normalizeImportHeader(s.artist)}`;if(batchSeen.has(k))return;batchSeen.add(k);if(skip&&existing.has(k))return;toCreate.push(s)});
  if(!toCreate.length){toast('No hay canciones nuevas que crear');return}
  if(!confirm(`Se crearán ${toCreate.length} canción${toCreate.length===1?'':'es'} con los datos del cuadro.\n\n¿Continuar?`))return;
  toCreate.forEach(autoLinkSongMedia);state.db.songs.push(...toCreate);const linked=toCreate.filter(x=>x.mediaId).length;await saveDB(`${toCreate.length} canción${toCreate.length===1?'':'es'} creada${toCreate.length===1?'':'s'}${linked?` · ${linked} audio/vídeo vinculado${linked===1?'':'s'} por título`:''}`);render();
 };
}

function renderSongs(){
 $('#view').innerHTML=`<div class="section-head" style="margin-top:0"><div class="filters" style="margin:0;flex:1"><input id="songSearch" class="input" placeholder="Buscar canción o artista…" style="max-width:420px"><select id="songStatus" class="select" style="max-width:190px"><option value="">Todos los estados</option><option>Pendiente</option><option>Ensayando</option><option>Lista</option></select></div><div class="inline"><button class="btn ghost" id="mediaLibraryBtn">🎵 Biblioteca multimedia</button><button class="btn primary" id="newSongPage">+ Nueva canción</button></div></div>${bulkSongImportPanelHTML()}<div class="media-help"><strong>Transcripción dentro de DrumGuide:</strong> carga MP3, audio, vídeo o enlaces de YouTube y controla la reproducción mientras completas las partes y patrones.</div><div id="songList" class="list"></div>`;
 const refresh=()=>{const q=$('#songSearch').value.toLowerCase(),st=$('#songStatus').value;const rows=state.db.songs.filter(s=>(!q||`${s.title} ${s.artist}`.toLowerCase().includes(q))&&(!st||s.status===st));$('#songList').innerHTML=rows.map(songRow).join('')||`<div class="empty"><strong>No hay canciones.</strong><div style="margin-top:12px"><button class="btn primary" id="emptyNewSong">+ Crear canción</button></div></div>`;bindSongRows();if($('#emptyNewSong'))$('#emptyNewSong').onclick=()=>songModal()};
 $('#songSearch').oninput=refresh;$('#songStatus').onchange=refresh;$('#newSongPage').onclick=()=>songModal();$('#mediaLibraryBtn').onclick=()=>mediaLibraryModal();bindBulkSongImport();refresh();
}
function bindSongRows(){
 $$('[data-song-transcribe]').forEach(b=>b.onclick=()=>transcribeModal(state.db.songs.find(s=>s.id===b.dataset.songTranscribe)));
 $$('[data-song-edit]').forEach(b=>b.onclick=()=>songModal(state.db.songs.find(s=>s.id===b.dataset.songEdit)));
 $$('[data-song-guide]').forEach(b=>b.onclick=()=>guideModal(state.db.songs.find(s=>s.id===b.dataset.songGuide)));
 $$('[data-song-delete]').forEach(b=>b.onclick=()=>deleteSong(b.dataset.songDelete));
}
async function deleteSong(id){
 const song=state.db.songs.find(s=>s.id===id);if(!song)return;
 const usedIn=state.db.setlists.filter(sl=>sl.songIds.includes(id));
 const extra=usedIn.length?`\n\nTambién se quitará de ${usedIn.length} setlist${usedIn.length===1?'':'s'}.`:'';
 if(!confirm(`¿Eliminar definitivamente “${song.title}”?${extra}\n\nEsta acción no se puede deshacer.`))return;
 state.db.songs=state.db.songs.filter(s=>s.id!==id);
 state.db.setlists.forEach(sl=>{sl.songIds=sl.songIds.filter(songId=>songId!==id)});
 if(!state.db.songs.length){state.liveIndex=0}
 await saveDB('Canción eliminada');render();
}
function sectionNameMode(value){return SECTION_NAME_OPTIONS.includes(String(value||''))?'preset':'custom'}
function sectionNameControlHTML(value,index,prefix=''){
 const val=String(value||'').trim();
 const mode=sectionNameMode(val);
 const selected=mode==='preset'?val:CUSTOM_SECTION_VALUE;
 return `<div class="section-name-field"><select class="select" name="gname_select" data-section-name-select="${prefix}${index}"><option value="">Selecciona una parte…</option>${SECTION_NAME_OPTIONS.map(x=>`<option value="${esc(x)}" ${selected===x?'selected':''}>${esc(x)}</option>`).join('')}<option value="${CUSTOM_SECTION_VALUE}" ${selected===CUSTOM_SECTION_VALUE?'selected':''}>Otra / personalizada</option></select><input class="input section-name-custom ${selected===CUSTOM_SECTION_VALUE?'':'hidden'}" name="gname_custom" data-section-name-custom="${prefix}${index}" value="${esc(mode==='preset'?'':val)}" placeholder="Escribe el nombre de la parte"></div>`
}
function readSectionName(block){
 const sel=block.querySelector('[name="gname_select"]');
 const custom=block.querySelector('[name="gname_custom"]');
 if(!sel)return '';
 const value=sel.value||'';
 if(value===CUSTOM_SECTION_VALUE)return String(custom?.value||'').trim();
 return String(value).trim();
}
function bindSectionNameControls(scope=document){
 scope.querySelectorAll('[data-section-name-select]').forEach(sel=>{
   sel.onchange=()=>{
     const custom=sel.parentElement.querySelector('[name="gname_custom"]');
     if(custom){
       const show=sel.value===CUSTOM_SECTION_VALUE;
       custom.classList.toggle('hidden',!show);
       if(show)setTimeout(()=>custom.focus(),10);
     }
   };
 });
}

function songModal(song=null){
 const editing=!!song,s=song?structuredClone(song):{id:uid('song'),title:'',artist:'',bpm:100,meter:4,denominator:4,subdivision:1,duration:240,key:'',status:'Pendiente',notes:'',guide:[]};
 openModal(editing?'Editar canción':'Nueva canción',`<div class="form-grid">
 <div class="field"><label>Título</label><input name="title" class="input" required value="${esc(s.title)}"></div>
 <div class="field"><label>Artista</label><input name="artist" class="input" value="${esc(s.artist)}"></div>
 <div class="field"><label>BPM</label><input name="bpm" type="number" min="30" max="300" class="input" value="${s.bpm||100}"></div>
 <div class="field"><label>Compás</label><select name="signature" class="select">${['2/4','3/4','4/4','5/4','6/8','7/8','9/8','12/8'].map(x=>`<option ${x===signature(s)?'selected':''}>${x}</option>`).join('')}</select></div>
 <div class="field"><label>Duración (segundos)</label><input name="duration" type="number" min="0" class="input" value="${s.duration||0}"></div>
 <div class="field"><label>Estado</label><select name="status" class="select">${['Pendiente','Ensayando','Lista'].map(x=>`<option ${x===s.status?'selected':''}>${x}</option>`).join('')}</select></div>
 <div class="field"><label>Subdivisión metrónomo</label><select name="subdivision" class="select"><option value="1" ${s.subdivision==1?'selected':''}>Negras</option><option value="2" ${s.subdivision==2?'selected':''}>Corcheas</option><option value="4" ${s.subdivision==4?'selected':''}>Semicorcheas</option></select></div>
 <div class="field"><label>Tono / referencia (opcional)</label><input name="key" class="input" value="${esc(s.key)}"></div>
 <div class="field span-2"><label>Notas generales</label><textarea name="notes" class="textarea">${esc(s.notes)}</textarea></div>
 </div>`,async fd=>{Object.assign(s,{title:fd.get('title').trim(),artist:fd.get('artist').trim(),bpm:+fd.get('bpm')||100,meter:+String(fd.get('signature')).split('/')[0]||4,denominator:+String(fd.get('signature')).split('/')[1]||4,subdivision:+fd.get('subdivision')||1,duration:+fd.get('duration')||0,key:fd.get('key').trim(),status:fd.get('status'),notes:fd.get('notes').trim()});if(!s.title){toast('Escribe un título');return false} if(editing){const i=state.db.songs.findIndex(x=>x.id===s.id);state.db.songs[i]=s}else state.db.songs.push(s);await saveDB(editing?'Canción actualizada':'Canción creada');render();return true});
}
function guideModal(song){
 let guide=structuredClone(song.guide||[]);
 const html=()=>`<div class="inline" style="justify-content:space-between;margin-bottom:12px"><div><strong>${esc(song.title)}</strong><div class="muted">${song.bpm} BPM · ${signature(song)}</div></div><button type="button" class="btn ghost small" id="addGuideBlock">+ Sección</button></div><div id="guideBlocks">${guide.map((g,i)=>guideBlockHTML(g,i,song)).join('')||'<div class="empty" id="guideEmpty">Añade la primera sección de la canción.</div>'}</div>`;
 const collectGuide=()=>$$('.guide-block').map((el,i)=>({name:readSectionName(el),bars:el.querySelector('[name="gbars"]').value.trim(),pattern:el.querySelector('[name="gpattern"]').value.trim(),notes:el.querySelector('[name="gnotes"]').value.trim(),rhythm:guide[i]?.rhythm||null}));
 openModal('Guía de batería',html(),async()=>{song.guide=collectGuide();await saveDB('Guía guardada');render();return true},'Guardar guía');
 const rerender=()=>{$('#guideBlocks').innerHTML=guide.map((g,i)=>guideBlockHTML(g,i,song)).join('')||'<div class="empty">Añade la primera sección de la canción.</div>';bindGuide()};
 const bindGuide=()=>{
   $$('[data-guide-del]').forEach(b=>b.onclick=()=>{guide=collectGuide().filter((_,i)=>i!=+b.dataset.guideDel);rerender()});
   $$('[data-rhythm-edit]').forEach(b=>b.onclick=()=>{guide=collectGuide();const i=+b.dataset.rhythmEdit;openRhythmEditor(song,guide[i]?.rhythm,r=>{guide[i].rhythm=r;rerender()})});
   $$('[data-rhythm-clear]').forEach(b=>b.onclick=()=>{guide=collectGuide();const i=+b.dataset.rhythmClear;if(confirm('¿Eliminar el patrón de batería de esta sección?')){guide[i].rhythm=null;rerender()}});
 };
 $('#addGuideBlock').onclick=()=>{guide=collectGuide();guide.push({name:'',bars:'4',pattern:'',notes:'',rhythm:null});rerender()};bindGuide();bindSectionNameControls($('#modalBody'));
}
function guideBlockHTML(g,i,song){
 const rhythm=hasRhythm(g.rhythm);
 return `<div class="guide-block"><div class="guide-block-head"><strong>Sección ${i+1}</strong><button type="button" class="btn danger small" data-guide-del="${i}">Eliminar</button></div><div class="guide-grid"><div class="field"><label>Nombre</label>${sectionNameControlHTML(g.name,i,'guide-')}</div><div class="field"><label>Compases</label><input class="input" name="gbars" value="${esc(g.bars)}"></div><div class="field"><label>Patrón / groove</label><input class="input" name="gpattern" value="${esc(g.pattern)}"><div class="rhythm-actions"><button type="button" class="btn ${rhythm?'primary':'ghost'} small" data-rhythm-edit="${i}">🥁 ${rhythm?'Editar patrón':'Crear patrón'}</button>${rhythm?`<span class="rhythm-ok">● Patrón guardado</span><button type="button" class="btn ghost small" data-rhythm-clear="${i}">Quitar</button>`:''}</div>${rhythm?rhythmMiniHTML(g.rhythm,song):''}</div><div class="field"><label>Fill / indicaciones</label><input class="input" name="gnotes" value="${esc(g.notes)}"></div></div></div>`
}
function rhythmSubdivisionLabel(r){return (+r?.resolution===8)?'CORCHEAS':'SEMICORCHEAS'}
function rhythmDiagramHTML(r,song,opts={}){
 if(!hasRhythm(r))return '';
 const rr=normalizeRhythm(r,song||{meter:4,denominator:4}),perBar=rhythmStepsPerBar(song||{meter:4,denominator:4},rr.resolution);
 const active=DRUM_ROWS.filter(([id])=>(rr.tracks[id]||[]).some(Boolean));
 const dark=!!opts.dark,compact=!!opts.compact,print=!!opts.print;
 const bars=Array.from({length:rr.bars},(_,bar)=>{
   const start=bar*perBar,end=start+perBar;
   return `<div class="rhythm-bar ${compact?'compact':''}">
     <div class="rhythm-bar-title"><span>COMPÁS ${bar+1}</span><span>${rhythmSubdivisionLabel(rr)}</span></div>
     ${active.map(([id,,abbr])=>`<div class="rhythm-diagram-row"><b>${abbr}</b><div class="rhythm-diagram-cells" style="--rh-bar-steps:${perBar}">${rr.tracks[id].slice(start,end).map((v,i)=>`<span class="${v===2?'accent':v===1?'on':''} ${(i%(rr.resolution/4||1))===0?'beat':''}"></span>`).join('')}</div></div>`).join('')}
   </div>`;
 }).join('');
 return `<div class="rhythm-diagram ${dark?'dark':''} ${compact?'compact':''} ${print?'print':''}">
   <div class="rhythm-diagram-meta"><strong>${rhythmSubdivisionLabel(rr)}</strong><span>${rr.bars} ${rr.bars===1?'compás':'compases'} · ${signature(song||{})}</span></div>
   <div class="rhythm-bars">${bars}</div>
 </div>`;
}
function rhythmGridMiniHTML(r,song){return rhythmDiagramHTML(r,song,{compact:true})}
function rhythmMiniHTML(r,song){return rhythmDiagramHTML(r,song,{compact:true})}
function openRhythmEditor(song,existing,onSave){
 const draft=normalizeRhythm(existing,song);let playing=false,timer=null,current=0;
 const d=document.createElement('dialog');d.className='rhythm-modal';d.innerHTML=`<div class="rhythm-card">
   <div class="rhythm-head"><div><h2>🥁 Creador de patrón</h2><div class="muted">${esc(song.title)} · ${song.bpm} BPM · ${signature(song)}</div></div><button type="button" class="btn ghost" id="rhythmClose">✕</button></div>
   <div class="rhythm-toolbar">
     <div class="field"><label>Subdivisión</label><select id="rhythmResolution" class="select"><option value="8" ${draft.resolution===8?'selected':''}>Corcheas</option><option value="16" ${draft.resolution===16?'selected':''}>Semicorcheas</option></select></div>
     <div class="field"><label>Compases del patrón</label><div class="rhythm-bars-control"><button type="button" class="btn ghost" id="rhythmBarsMinus">−</button><input id="rhythmBars" class="input" type="number" min="1" max="16" step="1" value="${draft.bars}"><button type="button" class="btn ghost" id="rhythmBarsPlus">+</button></div></div>
     <div class="field rhythm-volume-field"><label>Volumen patrón <b id="rhythmVolumeValue">${Math.round(state.rhythmVolume*100)}%</b></label><input id="rhythmVolume" class="range" type="range" min="0.15" max="1" step="0.05" value="${state.rhythmVolume}"></div>
     <div class="rhythm-legend"><span><i class="rh-dot normal"></i> Golpe</span><span><i class="rh-dot accent"></i> Acento</span><span>Vacío → golpe → acento</span></div>
     <div class="rhythm-toolbar-actions"><button type="button" class="btn ghost" id="rhythmTest">🔊 Probar</button><button type="button" class="btn ghost" id="rhythmClear">Vaciar</button><button type="button" class="btn primary" id="rhythmPlay">▶ Escuchar</button></div>
   </div>
   <div class="rhythm-scroll"><div id="rhythmGrid"></div><div class="rhythm-preview"><div class="rhythm-preview-title">Dibujo del patrón</div><div id="rhythmDiagramPreview"></div></div></div>
   <div class="rhythm-foot"><span class="muted" id="rhythmAudioState">Pulsa Escuchar para activar el audio. El patrón tiene ${draft.bars} ${draft.bars===1?'compás':'compases'}.</span><div class="inline"><button type="button" class="btn ghost" id="rhythmCancel">Cancelar</button><button type="button" class="btn primary" id="rhythmSave">Guardar patrón</button></div></div>
 </div>`;
 document.body.appendChild(d);
 const stop=()=>{playing=false;clearInterval(timer);timer=null;current=0;d.querySelector('#rhythmPlay').textContent='▶ Escuchar';d.querySelectorAll('.rh-step-now').forEach(x=>x.classList.remove('rh-step-now'))};
 const grid=()=>{
   const steps=draft.steps,perBar=rhythmStepsPerBar(song,draft.resolution),beatEvery=Math.max(1,draft.resolution/4);
   d.querySelector('#rhythmGrid').innerHTML=`<div class="rhythm-grid" style="--rh-steps:${steps}">
     <div class="rh-label rh-head-label">Instrumento</div>
     ${Array.from({length:steps},(_,i)=>{const bar=Math.floor(i/perBar)+1,inBar=i%perBar,beat=Math.floor(inBar/beatEvery)+1,isBeat=inBar%beatEvery===0,isBar=inBar===0;return `<div class="rh-count ${isBeat?'beat':''} ${isBar?'bar-start':''}">${isBeat?`${bar}.${beat}`:''}</div>`}).join('')}
     ${DRUM_ROWS.map(([id,name,abbr])=>`<div class="rh-label" title="${name}"><b>${abbr}</b><span>${name}</span></div>${draft.tracks[id].map((v,i)=>{const inBar=i%perBar;return `<button type="button" class="rh-cell ${v===1?'on':v===2?'accent':''} ${(inBar%beatEvery)===0?'beat':''} ${inBar===0?'bar-start':''}" data-track="${id}" data-step="${i}" aria-label="${name} paso ${i+1}"></button>`}).join('')}`).join('')}
   </div>`;
   d.querySelectorAll('.rh-cell').forEach(c=>c.onclick=()=>{const id=c.dataset.track,i=+c.dataset.step;draft.tracks[id][i]=(draft.tracks[id][i]+1)%3;grid()});
   const prev=d.querySelector('#rhythmDiagramPreview');if(prev)prev.innerHTML=rhythmDiagramHTML(draft,song);
   const st=d.querySelector('#rhythmAudioState');if(st&&!playing)st.textContent=`Patrón: ${rhythmSubdivisionLabel(draft).toLowerCase()} · ${draft.bars} ${draft.bars===1?'compás':'compases'}. Pulsa Escuchar para reproducirlo.`;
 };
 const resizeResolution=res=>{
   stop();const old=structuredClone(draft),oldPerBar=rhythmStepsPerBar(song,old.resolution),newRes=+res,newPerBar=rhythmStepsPerBar(song,newRes);
   draft.resolution=newRes;draft.steps=rhythmSteps(song,draft.resolution,draft.bars);
   DRUM_ROWS.forEach(([id])=>{
     const src=old.tracks[id]||[],dst=Array(draft.steps).fill(0);
     for(let bar=0;bar<draft.bars;bar++){
       const srcStart=bar*oldPerBar,dstStart=bar*newPerBar;
       for(let i=0;i<oldPerBar;i++){const v=src[srcStart+i];if(v){const j=Math.min(newPerBar-1,Math.round(i*newPerBar/Math.max(1,oldPerBar)));dst[dstStart+j]=Math.max(dst[dstStart+j],v)}}
     }
     draft.tracks[id]=dst;
   });grid();
 };
 const resizeBars=value=>{
   stop();const bars=Math.max(1,Math.min(16,Math.round(+value||1)));draft.bars=bars;draft.steps=rhythmSteps(song,draft.resolution,bars);
   DRUM_ROWS.forEach(([id])=>{const old=draft.tracks[id]||[];draft.tracks[id]=Array.from({length:draft.steps},(_,i)=>old[i]||0)});
   d.querySelector('#rhythmBars').value=bars;grid();
 };
 const audioState=msg=>{const el=d.querySelector('#rhythmAudioState');if(el)el.textContent=msg};
 const playStep=()=>{const cells=d.querySelectorAll(`[data-step="${current}"]`);d.querySelectorAll('.rh-step-now').forEach(x=>x.classList.remove('rh-step-now'));cells.forEach(x=>x.classList.add('rh-step-now'));DRUM_ROWS.forEach(([id])=>{const v=draft.tracks[id][current];if(v)playDrum(id,v===2)});current=(current+1)%draft.steps};
 const startAudio=async()=>{try{const ctx=await ensureAudioReady();if(ctx.state!=='running')throw new Error('AudioContext no activo');audioState('🔊 Audio activo · '+Math.round(state.rhythmVolume*100)+'%');return true}catch(err){console.error(err);audioState('⚠️ No se pudo activar el audio. Revisa el volumen multimedia de la tablet.');toast('No se pudo activar el audio');return false}};
 const toggle=async()=>{if(playing){stop();audioState('Audio detenido. Pulsa Escuchar para reproducir de nuevo.');return}if(!hasRhythm(draft)){toast('Añade al menos un golpe al patrón');return}if(!await startAudio())return;playing=true;d.querySelector('#rhythmPlay').textContent='■ Parar';playStep();const ms=(60000/(song.bpm||100))*(4/draft.resolution);timer=setInterval(playStep,ms)};
 d.querySelector('#rhythmResolution').onchange=e=>resizeResolution(e.target.value);
 d.querySelector('#rhythmBars').onchange=e=>resizeBars(e.target.value);
 d.querySelector('#rhythmBarsMinus').onclick=()=>resizeBars(draft.bars-1);
 d.querySelector('#rhythmBarsPlus').onclick=()=>resizeBars(draft.bars+1);
 d.querySelector('#rhythmVolume').oninput=e=>{state.rhythmVolume=Math.max(.15,Math.min(1,+e.target.value||.9));localStorage.setItem('drumguide_rhythm_volume',state.rhythmVolume);d.querySelector('#rhythmVolumeValue').textContent=Math.round(state.rhythmVolume*100)+'%';audioState('Volumen del patrón: '+Math.round(state.rhythmVolume*100)+'%')};
 d.querySelector('#rhythmTest').onclick=async()=>{if(!await startAudio())return;playDrum('bd',true);setTimeout(()=>playDrum('sd',true),180)};
 d.querySelector('#rhythmClear').onclick=()=>{stop();DRUM_ROWS.forEach(([id])=>draft.tracks[id].fill(0));grid()};
 d.querySelector('#rhythmPlay').onclick=toggle;
 const close=()=>{stop();d.close();d.remove()};
 d.querySelector('#rhythmClose').onclick=close;d.querySelector('#rhythmCancel').onclick=close;
 d.querySelector('#rhythmSave').onclick=()=>{stop();onSave(hasRhythm(draft)?structuredClone(draft):null);close();toast('Patrón añadido a la sección')};
 d.addEventListener('cancel',e=>{e.preventDefault();close()});grid();d.showModal();
}
function playDrum(id,accent=false){
 const ctx=ensureAudio(),t=ctx.currentTime,level=(accent?1:.72)*state.rhythmVolume;
 if(ctx.state!=='running')return;
 const gain=(duration=.12,amount=.35)=>{const g=ctx.createGain();g.gain.setValueAtTime(Math.max(.0001,amount*level),t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);g.connect(ctx.destination);return g};
 const noise=(duration,filterType='highpass',freq=3500,amount=.18)=>{const len=Math.max(1,Math.floor(ctx.sampleRate*duration)),buf=ctx.createBuffer(1,len,ctx.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++)data[i]=Math.random()*2-1;const src=ctx.createBufferSource();src.buffer=buf;const f=ctx.createBiquadFilter();f.type=filterType;f.frequency.value=freq;src.connect(f).connect(gain(duration,amount));src.start(t);src.stop(t+duration)};
 if(id==='bd'){const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(accent?125:105,t);o.frequency.exponentialRampToValueAtTime(45,t+.13);o.connect(gain(.15,.62));o.start(t);o.stop(t+.16);return}
 if(id==='sd'){noise(.12,'bandpass',1800,.34);const o=ctx.createOscillator();o.type='triangle';o.frequency.value=185;o.connect(gain(.09,.18));o.start(t);o.stop(t+.1);return}
 if(id==='hh'){noise(.055,'highpass',6200,.22);return}
 if(id==='cr'){noise(.42,'highpass',4200,.28);return}
 if(id==='rd'){noise(.18,'bandpass',5200,.18);const o=ctx.createOscillator();o.type='square';o.frequency.value=760;o.connect(gain(.13,.07));o.start(t);o.stop(t+.14);return}
 const freqs={ht:190,mt:150,ft:115};const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(freqs[id]||140,t);o.frequency.exponentialRampToValueAtTime((freqs[id]||140)*.7,t+.16);o.connect(gain(.18,.34));o.start(t);o.stop(t+.19)
}
function rhythmLiveHTML(r,song){
 if(!hasRhythm(r))return '';
 return rhythmDiagramHTML(r,song,{dark:true});
}

function renderSetlists(){
 $('#view').innerHTML=`<div class="section-head" style="margin-top:0"><div><span class="muted">${state.db.setlists.length} setlist${state.db.setlists.length===1?'':'s'}</span></div><button class="btn primary" id="newSetlist">+ Nueva setlist</button></div><div class="list">${state.db.setlists.map(sl=>setlistRow(sl)).join('')||'<div class="empty"><strong>No hay setlists.</strong><div style="margin-top:12px"><button class="btn primary" id="emptyNewSetlist">+ Crear setlist</button></div></div>'}</div>`;
 $('#newSetlist').onclick=()=>setlistModal();if($('#emptyNewSetlist'))$('#emptyNewSetlist').onclick=()=>setlistModal();
 $$('[data-set-edit]').forEach(b=>b.onclick=()=>setlistModal(state.db.setlists.find(x=>x.id===b.dataset.setEdit)));
 $$('[data-set-live]').forEach(b=>b.onclick=()=>{state.activeSetlist=b.dataset.setLive;state.liveIndex=0;go('live')});
 $$('[data-set-delete]').forEach(b=>b.onclick=()=>deleteSetlist(b.dataset.setDelete));
}
function setlistRow(sl){return `<div class="row"><div class="row-main"><div class="row-title">${esc(sl.name)}</div><div class="row-meta">${sl.songIds.length} canciones · ${minsToText(totalDuration(sl.songIds))}${sl.date?' · '+esc(sl.date):''}</div></div><div class="row-actions"><button class="btn primary small" data-set-live="${sl.id}">Directo</button><button class="btn ghost small" data-set-edit="${sl.id}">Editar</button><button class="btn danger small" data-set-delete="${sl.id}">Eliminar</button></div></div>`}
async function deleteSetlist(id){
 const sl=state.db.setlists.find(x=>x.id===id);if(!sl)return;
 if(!confirm(`¿Eliminar definitivamente la setlist “${sl.name}”?\n\nLas canciones no se eliminarán. Esta acción no se puede deshacer.`))return;
 state.db.setlists=state.db.setlists.filter(x=>x.id!==id);
 if(state.activeSetlist===id){state.activeSetlist=state.db.setlists[0]?.id||null;state.liveIndex=0}
 await saveDB('Setlist eliminada');render();
}
function setlistModal(sl=null){
 const editing=!!sl,s=sl?structuredClone(sl):{id:uid('set'),name:'Nueva setlist',date:'',notes:'',songIds:[]};
 const songsOptions=()=>state.db.songs.map(x=>`<option value="${x.id}">${esc(x.title)} — ${esc(x.artist||'Sin artista')}</option>`).join('');
 const bulkSongsHTML=()=>state.db.songs.map(x=>`<label class="set-bulk-song"><input type="checkbox" value="${x.id}" data-set-bulk-song><span><strong>${esc(x.title)}</strong><small>${esc(x.artist||'Sin artista')} · ${x.bpm} BPM</small></span></label>`).join('');
 const body=()=>`<div class="form-grid"><div class="field"><label>Nombre</label><input name="name" class="input" required value="${esc(s.name)}"></div><div class="field"><label>Fecha / referencia</label><input name="date" type="date" class="input" value="${esc(s.date)}"></div><div class="field span-2"><label>Notas</label><textarea name="notes" class="textarea">${esc(s.notes)}</textarea></div></div><div class="section-head"><h2>Canciones</h2></div>${state.db.songs.length?`<div class="set-add-modes"><div class="set-add-one"><div class="set-add-mode-title"><strong>Añadir una canción</strong><span class="muted">Método rápido, una a una.</span></div><div class="set-add-row"><select id="addSongToSet" class="select"><option value="">Selecciona una canción…</option>${songsOptions()}</select><button type="button" class="btn primary" id="addSongToSetBtn">+ Añadir</button></div></div><details class="set-bulk-add"><summary><strong>Añadir varias canciones a la vez</strong><span class="muted">Selecciona todas las que quieras y añádelas juntas.</span></summary><div class="set-bulk-tools"><button type="button" class="btn ghost small" id="setBulkAll">Seleccionar todas</button><button type="button" class="btn ghost small" id="setBulkNone">Limpiar selección</button><span id="setBulkCount" class="pill">0 seleccionadas</span><button type="button" class="btn primary" id="setBulkAdd">+ Añadir seleccionadas</button></div><div class="set-bulk-list">${bulkSongsHTML()}</div></details></div>`:`<div class="empty compact">Primero crea al menos una canción. Puedes guardar esta setlist vacía y añadirla después.</div>`}<div id="setSongs">${setSongsHTML(s)}</div>`;
 openModal(editing?'Editar setlist':'Nueva setlist',body(),async fd=>{s.name=String(fd.get('name')||'').trim()||'Setlist';s.date=String(fd.get('date')||'');s.notes=String(fd.get('notes')||'').trim();if(editing){const idx=state.db.setlists.findIndex(x=>x.id===s.id);if(idx>=0)state.db.setlists[idx]=s;else state.db.setlists.push(s)}else state.db.setlists.push(s);state.activeSetlist=s.id;state.liveIndex=0;await saveDB(editing?'Setlist actualizada':'Setlist creada');render();return true},'Guardar setlist');
 const refresh=()=>{$('#setSongs').innerHTML=setSongsHTML(s);bind()};
 const bind=()=>{$$('[data-set-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.setUp;if(i>0)[s.songIds[i-1],s.songIds[i]]=[s.songIds[i],s.songIds[i-1]];refresh()});$$('[data-set-down]').forEach(b=>b.onclick=()=>{const i=+b.dataset.setDown;if(i<s.songIds.length-1)[s.songIds[i+1],s.songIds[i]]=[s.songIds[i],s.songIds[i+1]];refresh()});$$('[data-set-del]').forEach(b=>b.onclick=()=>{s.songIds.splice(+b.dataset.setDel,1);refresh()})};
 if($('#addSongToSetBtn'))$('#addSongToSetBtn').onclick=()=>{const sel=$('#addSongToSet'),id=sel.value;if(!id){toast('Selecciona una canción');return}if(!state.db.songs.some(x=>x.id===id)){toast('La canción ya no existe');return}s.songIds.push(id);sel.value='';refresh();toast('Canción añadida a la setlist')};
 const bulkChecks=()=>$$('[data-set-bulk-song]');
 const updateBulkCount=()=>{const n=bulkChecks().filter(c=>c.checked).length,el=$('#setBulkCount');if(el)el.textContent=`${n} seleccionada${n===1?'':'s'}`};
 bulkChecks().forEach(c=>c.onchange=updateBulkCount);
 if($('#setBulkAll'))$('#setBulkAll').onclick=()=>{bulkChecks().forEach(c=>c.checked=true);updateBulkCount()};
 if($('#setBulkNone'))$('#setBulkNone').onclick=()=>{bulkChecks().forEach(c=>c.checked=false);updateBulkCount()};
 if($('#setBulkAdd'))$('#setBulkAdd').onclick=()=>{const ids=bulkChecks().filter(c=>c.checked).map(c=>c.value).filter(id=>state.db.songs.some(x=>x.id===id));if(!ids.length){toast('Selecciona al menos una canción');return}s.songIds.push(...ids);bulkChecks().forEach(c=>c.checked=false);updateBulkCount();refresh();toast(`${ids.length} canción${ids.length===1?'':'es'} añadida${ids.length===1?'':'s'} a la setlist`)};
 bind();
}
function setSongsHTML(s){if(!s.songIds.length)return '<div class="empty">Añade canciones y ordénalas.</div>';return `<div class="list">${s.songIds.map((id,i)=>{const x=state.db.songs.find(a=>a.id===id);return x?`<div class="setlist-song"><div class="drag">${i+1}</div><div><strong>${esc(x.title)}</strong><div class="row-meta">${x.bpm} BPM · ${signature(x)} · ${minsToText(x.duration)}</div></div><div class="row-actions"><button type="button" class="btn ghost small" data-set-up="${i}">↑</button><button type="button" class="btn ghost small" data-set-down="${i}">↓</button><button type="button" class="btn danger small" data-set-del="${i}">×</button></div></div>`:''}).join('')}</div><div class="setlist-totals" style="margin-top:12px"><span class="pill">${s.songIds.length} canciones</span><span class="pill">Duración ${minsToText(totalDuration(s.songIds))}</span></div>`}

function renderMetro(){
 const m=state.metro;$('#view').innerHTML=`<div class="metro-wrap"><div class="card metro-display"><div><div class="bpm-number" id="bpmNumber">${m.bpm}</div><div class="bpm-label">BPM</div><div class="pulse" id="pulse"></div></div></div><div class="card metro-controls"><div class="bpm-controls"><button class="btn ghost" id="bpmMinus">−</button><input id="bpmRange" class="range" type="range" min="30" max="260" value="${m.bpm}"><button class="btn ghost" id="bpmPlus">+</button></div><div class="field"><label>BPM exactos</label><input id="bpmInput" class="input" type="number" min="30" max="300" value="${m.bpm}"></div><button id="tapTempo" class="btn ghost tap-btn">TAP TEMPO</button><div class="form-grid"><div class="field"><label>Compás</label><select id="meterSel" class="select">${['2/4','3/4','4/4','5/4','6/8','7/8','9/8','12/8'].map(x=>`<option ${x===signature(m)?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Subdivisión</label><select id="subSel" class="select"><option value="1" ${m.subdivision===1?'selected':''}>Negras</option><option value="2" ${m.subdivision===2?'selected':''}>Corcheas</option><option value="4" ${m.subdivision===4?'selected':''}>Semicorcheas</option></select></div><div class="field"><label>Sonido</label><select id="soundSel" class="select"><option value="click">Click clásico</option><option value="wood">Woodblock</option><option value="cowbell">Cowbell</option><option value="rim">Rimshot</option></select></div><div class="field"><label>Volumen</label><input id="volRange" class="range" type="range" min="0" max="1" step=".05" value="${m.volume}"></div></div><label class="inline"><input id="accentChk" type="checkbox" ${m.accent?'checked':''}> Acentuar el primer tiempo</label><button id="metroPlay" class="btn primary big-play">${m.running?'■ PARAR':'▶ INICIAR'}</button></div></div>`;
 $('#soundSel').value=m.sound;const setBpm=v=>{m.bpm=Math.max(30,Math.min(300,+v||100));$('#bpmNumber').textContent=m.bpm;$('#bpmInput').value=m.bpm;$('#bpmRange').value=Math.min(260,m.bpm)};$('#bpmMinus').onclick=()=>setBpm(m.bpm-1);$('#bpmPlus').onclick=()=>setBpm(m.bpm+1);$('#bpmInput').onchange=e=>setBpm(e.target.value);$('#bpmRange').oninput=e=>setBpm(e.target.value);$('#meterSel').onchange=e=>{const [a,b]=e.target.value.split('/').map(Number);m.meter=a;m.denominator=b};$('#subSel').onchange=e=>m.subdivision=+e.target.value;$('#soundSel').onchange=e=>m.sound=e.target.value;$('#volRange').oninput=e=>m.volume=+e.target.value;$('#accentChk').onchange=e=>m.accent=e.target.checked;$('#metroPlay').onclick=()=>toggleMetronome();$('#tapTempo').onclick=()=>tapTempo();
}
function ensureAudio(){
 const AudioCtx=window.AudioContext||window.webkitAudioContext;
 if(!AudioCtx)throw new Error('Web Audio no disponible');
 if(!state.metro.audio||state.metro.audio.state==='closed')state.metro.audio=new AudioCtx({latencyHint:'interactive'});
 return state.metro.audio;
}
async function ensureAudioReady(){
 const ctx=ensureAudio();
 if(ctx.state==='suspended')await ctx.resume();
 // En algunos Android/Samsung la primera reproducción necesita una activación explícita dentro del gesto del usuario.
 if(ctx.state==='running'){
   const g=ctx.createGain();g.gain.value=.00001;const o=ctx.createOscillator();o.frequency.value=80;o.connect(g).connect(ctx.destination);o.start();o.stop(ctx.currentTime+.01);
 }
 return ctx;
}
function playTick(accent=false,when=null){
 const m=state.metro,ctx=ensureAudio(),t=when??ctx.currentTime,g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0001,m.volume*(accent?1:.72)),t+.002);g.gain.exponentialRampToValueAtTime(.0001,t+.09);g.connect(ctx.destination);
 if(m.sound==='rim'){const len=Math.floor(ctx.sampleRate*.045),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(len*.16));const src=ctx.createBufferSource();src.buffer=buf;const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=accent?2600:2100;f.Q.value=2.2;src.connect(f).connect(g);src.start(t);src.stop(t+.05)}
 else if(m.sound==='cowbell'){[accent?820:710,accent?1220:1080].forEach((f0,j)=>{const o=ctx.createOscillator();o.type='square';o.frequency.setValueAtTime(f0,t);const gg=ctx.createGain();gg.gain.setValueAtTime(.28/(j+1),t);gg.gain.exponentialRampToValueAtTime(.001,t+.08);o.connect(gg).connect(g);o.start(t);o.stop(t+.09)})}
 else {const o=ctx.createOscillator();o.type=m.sound==='wood'?'sine':'square';o.frequency.setValueAtTime(m.sound==='wood'?(accent?1050:820):(accent?1550:1150),t);o.connect(g);o.start(t);o.stop(t+.08)}
 const delay=Math.max(0,(t-ctx.currentTime)*1000);setTimeout(()=>{const p=$('#pulse');if(p){p.classList.add('hit');setTimeout(()=>p.classList.remove('hit'),55)}},delay);
}
function clampMetroBpm(v){const n=Math.round(Number(v)||100);return Math.max(30,Math.min(300,n))}
function liveBarsCount(value){
 const nums=String(value??'').match(/\d+(?:[.,]\d+)?/g)||[];
 if(!nums.length)return 0;
 return Math.max(0,Math.round(nums.reduce((a,n)=>a+(Number(String(n).replace(',','.'))||0),0)));
}
function liveSongTotalBars(song){return (song?.guide||[]).reduce((n,g)=>n+liveBarsCount(g.bars),0)}
function ensureLiveTransport(song){
 const id=song?.id||null,t=state.liveTransport;
 if(!t||t.songId!==id){state.liveTransport={songId:id,countInBars:4,phase:'idle',songBar:0,totalBars:liveSongTotalBars(song),scheduledDownbeats:0,paused:false};}
 else t.totalBars=liveSongTotalBars(song);
 return state.liveTransport;
}
function liveSectionForBar(song,bar){
 let start=1;const guide=song?.guide||[];
 for(let i=0;i<guide.length;i++){const bars=liveBarsCount(guide[i].bars);const end=start+Math.max(0,bars)-1;if(bars>0&&bar>=start&&bar<=end)return {index:i,start,end,bars,local:bar-start+1};start=end+1;}
 return guide.length?{index:Math.max(0,guide.length-1),start,end:start,bars:0,local:0}:null;
}
function updateLiveTransportUI(song,scroll=true){
 if(state.page!=='live')return;const t=ensureLiveTransport(song),total=t.totalBars||0;
 const cur=$('#liveBarCurrent'),remain=$('#liveBarRemain'),section=$('#liveSectionCounter'),status=$('#liveTransportStatus'),overlay=$('#liveCountInOverlay');
 if(cur)cur.textContent=t.phase==='countin'?'—':`${Math.min(t.songBar||0,total)} / ${total||'—'}`;
 if(remain)remain.textContent=t.phase==='countin'?`${total}`:`${Math.max(0,total-(t.songBar||0))}`;
 const sec=liveSectionForBar(song,t.songBar||1);
 if(section)section.textContent=t.phase==='countin'?'Preparado':sec?`${song.guide[sec.index]?.name||'Sección'} · ${Math.max(1,sec.local)} / ${Math.max(1,sec.bars)}`:'Sin secciones';
 if(status)status.textContent=t.phase==='countin'?`ENTRADA · ${Math.max(1,t.countInBars-t.scheduledDownbeats+1)}`:t.paused?'PAUSA':t.phase==='done'?'FIN':t.songBar>0?'EN CURSO':'LISTO';
 if(overlay){if(t.phase==='countin'){overlay.classList.add('show');overlay.innerHTML=`<strong>ENTRADA</strong><span>${Math.max(1,t.countInBars-t.scheduledDownbeats+1)}</span>`}else overlay.classList.remove('show')}
 $$('.live-block').forEach((el,i)=>el.classList.toggle('is-current',!!sec&&t.phase==='song'&&i===sec.index));
 if(scroll&&state.liveLayout===7&&sec&&t.phase==='song'){
   const el=document.querySelector(`.live-block[data-guide-index="${sec.index}"]`),scroller=document.querySelector('.live-layout-7 .live-guide');
   if(el&&scroller){const target=Math.max(0,el.offsetTop-scroller.clientHeight*.26);scroller.scrollTo({top:target,behavior:'smooth'});}
 }
 const b=$('#liveMetro');if(b)b.textContent=state.metro.running?'■ Pausar click':(t.paused&&t.songBar>0?'▶ Continuar click':'▶ Iniciar click');
}
function scheduleLiveDownbeat(song,when){
 const t=ensureLiveTransport(song),ctx=state.metro.audio;if(!ctx)return;
 if(t.phase==='idle'){t.phase=(t.songBar>0)?'song':(t.countInBars>0?'countin':'song');t.scheduledDownbeats=0;}
 if(t.phase==='countin'){
   t.scheduledDownbeats++;
   const shown=t.scheduledDownbeats;
   setTimeout(()=>{if(state.page==='live'){const o=$('#liveCountInOverlay');if(o){o.classList.add('show');o.innerHTML=`<strong>ENTRADA</strong><span>${Math.max(1,t.countInBars-shown+1)}</span>`}const st=$('#liveTransportStatus');if(st)st.textContent=`ENTRADA · ${Math.max(1,t.countInBars-shown+1)}`;}},Math.max(0,(when-ctx.currentTime)*1000));
   if(t.scheduledDownbeats>=t.countInBars){t.phase='song';t.scheduledDownbeats=0;}
   return;
 }
 if(t.phase==='song'){
   if(t.songBar>=t.totalBars){t.phase='done';state.metro.running=false;clearTimeout(state.metro.timer);state.metro.timer=null;setTimeout(()=>updateLiveTransportUI(song,true),Math.max(0,(when-ctx.currentTime)*1000));return;}
   t.songBar++;
   setTimeout(()=>updateLiveTransportUI(song,true),Math.max(0,(when-ctx.currentTime)*1000));
 }
}
function scheduler(){const m=state.metro,ctx=m.audio;if(!m.running||!ctx)return;while(m.nextNoteTime<ctx.currentTime+.1&&m.running){const subIndex=m.currentBeat%(m.meter*m.subdivision);if(subIndex===0&&state.page==='live'&&state.liveSongId){const song=state.db.songs.find(s=>s.id===state.liveSongId);if(song)scheduleLiveDownbeat(song,m.nextNoteTime)}playTick(m.accent&&subIndex===0,m.nextNoteTime);m.currentBeat++;m.nextNoteTime+=60/m.bpm/m.subdivision}if(m.running)m.timer=setTimeout(scheduler,25)}
function updateSongMetroButtons(){
 $$('[data-song-metro]').forEach(b=>{const song=state.db?.songs?.find(s=>s.id===b.dataset.songMetro);if(!song)return;const on=state.metro.running&&state.songMetroId===song.id;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');b.textContent=on?'■ Parar click':`● ${song.metroBpm||song.bpm||100} BPM`;});
 $$('[data-transcribe-metro]').forEach(b=>{const song=state.db?.songs?.find(s=>s.id===b.dataset.transcribeMetro);if(!song)return;const on=state.metro.running&&state.songMetroId===song.id;b.classList.toggle('active',on);b.classList.toggle('danger',on);b.classList.toggle('ghost',!on);b.setAttribute('aria-pressed',on?'true':'false');b.textContent=on?'■ Parar metrónomo':`● Metrónomo · ${song.metroBpm||song.bpm||100} BPM`;});
}
async function toggleSongMetronome(song){
 if(!song)return;const m=state.metro;
 if(m.running&&state.songMetroId===song.id){m.running=false;clearTimeout(m.timer);m.timer=null;state.songMetroId=null;updateSongMetroButtons();return;}
 loadSongTempo(song);state.metro.bpm=clampMetroBpm(song.metroBpm||song.bpm||100);state.songMetroId=song.id;
 try{const ctx=await ensureAudioReady();if(m.timer)clearTimeout(m.timer);m.running=true;m.currentBeat=0;m.nextNoteTime=ctx.currentTime+.06;scheduler();updateSongMetroButtons();}
 catch(e){console.error(e);m.running=false;state.songMetroId=null;toast('No se pudo activar el metrónomo');updateSongMetroButtons();}
}
async function toggleMetronome(){const m=state.metro;if(m.running){m.running=false;clearTimeout(m.timer);m.timer=null;state.songMetroId=null}else{try{const ctx=await ensureAudioReady();state.songMetroId=null;m.running=true;m.currentBeat=0;m.nextNoteTime=ctx.currentTime+.06;scheduler()}catch(e){console.error(e);toast('No se pudo activar el audio')}}if(state.page==='metro')renderMetro();else if(state.page==='songs')updateSongMetroButtons();}
function tapTempo(){const now=performance.now(),a=state.metro.tap;a.push(now);while(a.length>6)a.shift();if(a.length>=2){const ints=a.slice(1).map((x,i)=>x-a[i]);const avg=ints.reduce((x,y)=>x+y,0)/ints.length;state.metro.bpm=Math.round(60000/avg);if(state.page==='metro')renderMetro()}}
function loadSongTempo(song){const m=state.metro;m.bpm=song.bpm||100;m.meter=song.meter||4;m.denominator=song.denominator||4;m.subdivision=song.subdivision||1;}

function liveGuideColumns(count){
 const portrait=window.matchMedia&&window.matchMedia('(orientation: portrait)').matches;
 if(count<=1)return 1;
 if(portrait){if(count<=2)return 1;if(count<=6)return 2;return 3}
 if(count<=3)return count;
 if(count<=4)return 2;
 if(count<=6)return 3;
 if(count<=8)return 4;
 return 5;
}

function liveTextToHTML(value){
 const text=String(value||'').trim();
 if(!text)return '';
 return esc(text)
   .replace(/\s[·•]\s/g,'<br>')
   .replace(/\s[|]\s/g,'<br>')
   .replace(/\s\/\s/g,'<br>')
   .replace(/\.\s+/g,'.<br>');
}
function sectionTypeKey(name){
 const raw=String(name||'').trim().toLowerCase();
 const n=raw.normalize?raw.normalize('NFD').replace(/[\u0300-\u036f]/g,''):raw;
 if(/\b(post[- ]?estribillo|post chorus)\b/.test(n))return 'postchorus';
 if(/\b(pre[- ]?estribillo|pre chorus)\b/.test(n))return 'prechorus';
 if(/\b(estribillo|chorus)\b/.test(n))return 'chorus';
 if(/\b(estrofa|verso|verse)\b/.test(n))return 'verse';
 if(/\b(intro|entrada)\b/.test(n))return 'intro';
 if(/\b(solo)\b/.test(n))return 'solo';
 if(/\b(puente|interludio|instrumental|breakdown|break|build[- ]?up|paron|silencio|corte)\b/.test(n))return 'bridge';
 if(/\b(coda|outro|final|fade)\b/.test(n))return 'outro';
 return 'other';
}
function sectionTypeClass(name){return `section-type-${sectionTypeKey(name)}`}
function liveTitleToHTML(value){
 const text=String(value||'').trim();
 return esc(text||'Sección');
}
function liveBarsToHTML(value){
 const text=String(value||'').trim();
 if(!text)return '<span class="live-bars-capsule is-empty">—</span>';
 let parts=text.split(/\s*\+\s*/).map(x=>x.trim()).filter(Boolean);
 if(parts.length===1){
   const nums=text.match(/\d+(?:[.,]\d+)?/g);
   if(nums&&nums.length>1&&/[\/|·•]/.test(text))parts=nums;
 }
 return parts.map(part=>`<span class="live-bars-capsule">${esc(part)}</span>`).join('');
}
function liveBlockVars(block,count){
 const titleLen=String(block?.name||'').trim().length;
 const notesLen=String(block?.notes||'').trim().length;
 const patternLen=String(block?.pattern||'').trim().length;
 const hasPattern=!!(patternLen||block?.rhythm);
 const hasNotes=!!notesLen;
 let title=count<=2?46:count<=4?39:count<=6?34:29;
 let meta=count<=2?34:count<=4?30:count<=6?27:24;
 let body=count<=2?31:count<=4?27:count<=6?24:21;
 let cue=count<=2?31:count<=4?27:count<=6?24:21;
 if(!hasPattern){title+=6;cue+=6;meta+=3}
 if(!hasPattern&&!hasNotes){title+=8;meta+=5}
 if(titleLen>14)title-=3;
 if(titleLen>20)title-=4;
 if(titleLen>28)title-=4;
 if(notesLen>85)cue-=3;
 if(notesLen>140)cue-=3;
 if(patternLen>70)body-=3;
 if(patternLen>120)body-=3;
 title=Math.max(20,title);meta=Math.max(18,meta);body=Math.max(17,body);cue=Math.max(17,cue);
 return `--section-title-size:${title}px;--section-meta-size:${meta}px;--section-body-size:${body}px;--section-cue-size:${cue}px;`;
}
function fitLiveBlocks(){
 if(state.page!=='live')return;
 const blocks=[...document.querySelectorAll('.live-block')],count=blocks.length||1;
 blocks.forEach(block=>{
   const hasPattern=block.dataset.hasPattern==='1';
   const hasNotes=block.dataset.hasNotes==='1';
   const h=Math.max(120,block.clientHeight||240),w=Math.max(180,block.clientWidth||320);
   const baseTitle=parseFloat(block.style.getPropertyValue('--section-title-size'))||32;
   const baseMeta=parseFloat(block.style.getPropertyValue('--section-meta-size'))||24;
   const baseBody=parseFloat(block.style.getPropertyValue('--section-body-size'))||22;
   const baseCue=parseFloat(block.style.getPropertyValue('--section-cue-size'))||22;
   const roomBoost=Math.max(.92,Math.min(1.34,Math.min(h/285,w/360)));
   const sparseBoost=!hasPattern?(hasNotes?1.16:1.28):1;
   const title=baseTitle*roomBoost*sparseBoost;
   const meta=baseMeta*roomBoost*Math.min(1.18,sparseBoost);
   const body=baseBody*roomBoost;
   const cue=baseCue*roomBoost*(!hasPattern?1.12:1);
   let scale=1;
   const apply=()=>{
     block.style.setProperty('--section-title-size',`${Math.max(18,title*scale)}px`);
     block.style.setProperty('--section-meta-size',`${Math.max(16,meta*scale)}px`);
     block.style.setProperty('--section-body-size',`${Math.max(15,body*scale)}px`);
     block.style.setProperty('--section-cue-size',`${Math.max(15,cue*scale)}px`);
     block.style.setProperty('--block-rhythm-label-size',`${Math.max(10,16*roomBoost*scale)}px`);
     block.style.setProperty('--block-rhythm-cell-height',`${Math.max(10,20*roomBoost*scale)}px`);
     block.style.setProperty('--block-rhythm-gap',`${Math.max(2,3*scale)}px`);
   };
   apply();
   const titleEl=block.querySelector('.live-title-text');
   const overflows=()=>block.scrollHeight>block.clientHeight+2||block.scrollWidth>block.clientWidth+2||(titleEl&&titleEl.scrollWidth>titleEl.clientWidth+1);
   let guard=0;
   while(guard<18&&overflows()&&scale>.46){scale*=.92;apply();guard++}
 });
}
async function setLiveFull(on){
 state.liveFull=!!on;document.body.classList.toggle('live-full',state.liveFull);
 try{if(state.liveFull&&!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else if(!state.liveFull&&document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen()}catch{}
 renderLive();
}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&state.liveFull){state.liveFull=false;document.body.classList.remove('live-full');if(state.page==='live')renderLive()}});

function renderLive(){
 const sets=state.db.setlists;if(!sets.length){$('#view').innerHTML=`<div class="empty"><strong>Necesitas una setlist para utilizar el modo directo.</strong><div class="empty-actions"><button class="btn primary" id="liveCreateSet">+ Crear setlist</button><button class="btn ghost" id="liveCreateSong">+ Crear canción</button></div></div>`;$('#liveCreateSet').onclick=()=>setlistModal();$('#liveCreateSong').onclick=()=>songModal();return}
 if(!state.activeSetlist||!sets.find(x=>x.id===state.activeSetlist))state.activeSetlist=sets[0].id;
 const sl=sets.find(x=>x.id===state.activeSetlist);
 const validIds=sl.songIds.filter(id=>state.db.songs.some(s=>s.id===id));
 if(validIds.length!==sl.songIds.length){sl.songIds=validIds;saveDB('Setlist reparada').catch(()=>{})}
 if(state.liveIndex>=sl.songIds.length)state.liveIndex=0;
 const song=state.db.songs.find(s=>s.id===sl.songIds[state.liveIndex]);
 if(!song){$('#view').innerHTML=`<div class="live-setlist-launcher"><div class="live-setlist-launcher-head"><strong>Setlists disponibles</strong><span class="muted">Elige otra setlist para lanzarla.</span></div><div class="live-setlist-buttons">${sets.map(x=>`<button type="button" class="btn ${x.id===sl.id?'primary':'ghost'}" data-live-empty-open="${x.id}">▶ ${esc(x.name)} <span>${x.songIds.length}</span></button>`).join('')}</div></div><div class="empty"><strong>Esta setlist todavía no contiene canciones.</strong><p>Añade una canción existente o elige otra setlist arriba.</p><div class="empty-actions"><button class="btn primary" id="liveEditSet">Editar setlist</button><button class="btn ghost" id="liveNewSong">+ Crear canción</button></div></div>`;$$('[data-live-empty-open]').forEach(b=>b.onclick=()=>{state.activeSetlist=b.dataset.liveEmptyOpen;state.liveIndex=0;renderLive()});$('#liveEditSet').onclick=()=>setlistModal(sl);$('#liveNewSong').onclick=()=>songModal();return}
 const guide=song.guide||[],partCount=Math.max(1,guide.length),cols=liveGuideColumns(partCount);
 const liveLauncher=!state.liveFull?`<div class="live-setlist-launcher"><div class="live-setlist-launcher-head"><strong>Setlists disponibles</strong><span class="muted">Toca una setlist para lanzarla en Directo.</span></div><div class="live-setlist-buttons">${sets.map(x=>`<button type="button" class="btn ${x.id===sl.id?'primary':'ghost'}" data-live-open-set="${x.id}">▶ ${esc(x.name)} <span>${x.songIds.length}</span></button>`).join('')}</div></div>`:'';
 $('#view').innerHTML=`${liveLauncher}<div class="filters live-filters">
   <select id="liveSetSel" class="select" style="max-width:300px">${sets.map(x=>`<option value="${x.id}" ${x.id===sl.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
   <select id="liveSongSel" class="select" style="max-width:360px">${sl.songIds.map((id,i)=>{const x=state.db.songs.find(s=>s.id===id);return x?`<option value="${i}" ${i===state.liveIndex?'selected':''}>${i+1}. ${esc(x.title)}</option>`:''}).join('')}</select>
   <button id="wakeBtn" class="btn ghost">Mantener pantalla activa</button>
   <button id="fullLiveBtn" class="btn primary">⛶ Vista completa</button>
 </div>
 <div class="live ${state.liveFull?'full':''} live-layout-${state.liveLayout}" style="--live-cols:${cols};--part-count:${partCount};--live-two-cols:${Math.max(1,Math.ceil(partCount/2))}">
   <div class="live-top">
     <div class="live-title-wrap"><div class="live-position">${state.liveIndex+1} / ${sl.songIds.length} · ${esc(sl.name)}</div><h2>${esc(song.title)}</h2><div class="artist">${esc(song.artist||'')}</div></div>
     <div class="live-actions">
       <div class="live-quick"><strong>${song.bpm}</strong><span>BPM</span></div>
       <div class="live-quick"><strong>${signature(song)}</strong><span>COMPÁS</span></div>
       <div class="live-quick"><strong>${minsToText(song.duration)}</strong><span>DURACIÓN</span></div>
       <label class="live-layout-control"><span>VISTA</span><select id="liveLayoutSel" class="select"><option value="1" ${state.liveLayout===1?'selected':''}>1 · Actual</option><option value="2" ${state.liveLayout===2?'selected':''}>2 · 2 filas</option><option value="3" ${state.liveLayout===3?'selected':''}>3 · Filas anchas</option><option value="4" ${state.liveLayout===4?'selected':''}>4 · Tarjetas 2×N</option><option value="5" ${state.liveLayout===5?'selected':''}>5 · Línea de tiempo</option><option value="6" ${state.liveLayout===6?'selected':''}>6 · Parte protagonista</option><option value="7" ${state.liveLayout===7?'selected':''}>7 · Guion vertical</option><option value="8" ${state.liveLayout===8?'selected':''}>8 · Mosaico inteligente</option></select></label>
       <label class="live-countin-control"><span>ENTRADA</span><select id="liveCountInSel" class="select">${[0,1,2,4,8].map(n=>`<option value="${n}" ${ensureLiveTransport(song).countInBars===n?'selected':''}>${n===0?'Sin entrada':n+' comp.'}</option>`).join('')}</select></label>
       <button id="liveMetro" class="btn ${state.metro.running?'danger':'primary'}">${state.metro.running?'■ Pausar click':(ensureLiveTransport(song).paused&&ensureLiveTransport(song).songBar>0?'▶ Continuar click':'▶ Iniciar click')}</button>
       <button id="liveResetTransport" class="btn ghost" title="Volver al inicio de la canción">↺ Inicio</button>
       ${state.liveFull?'<button id="exitFull" class="btn ghost">✕ Salir</button>':''}
     </div>
   </div>
   <div class="live-transport" id="liveTransportPanel">
     <div class="live-transport-stat"><span>COMPÁS</span><strong id="liveBarCurrent">—</strong></div>
     <div class="live-transport-stat"><span>QUEDAN</span><strong id="liveBarRemain">${ensureLiveTransport(song).totalBars}</strong></div>
     <div class="live-transport-section"><span>SECCIÓN</span><strong id="liveSectionCounter">Preparado</strong></div>
     <div class="live-transport-status" id="liveTransportStatus">LISTO</div>
   </div>
   <div class="live-countin-overlay" id="liveCountInOverlay"></div>
   <div class="live-player-shell"><div id="livePlayer" class="transcribe-player live-player"></div></div>
   ${song.notes?`<div class="live-notes"><strong>NOTAS</strong><span>${esc(song.notes)}</span></div>`:''}
   <div class="live-guide parts-${Math.min(partCount,9)}">${guide.map((g,i)=>{const hasPattern=!!(String(g.pattern||'').trim()||g.rhythm),hasNotes=!!String(g.notes||'').trim();return `<div class="live-block ${sectionTypeClass(g.name)}" data-guide-index="${i}" data-has-pattern="${hasPattern?'1':'0'}" data-has-notes="${hasNotes?'1':'0'}" style="${liveBlockVars(g,partCount)}"><div class="live-part-topline"><div class="live-title-line"><strong class="live-title-text">${liveTitleToHTML(g.name)}</strong></div><div class="live-bars-line">${liveBarsToHTML(g.bars)}</div></div>${g.notes?`<div class="live-cue live-text-row">${liveTextToHTML(g.notes)}</div>`:''}${g.pattern?`<div class="live-pattern live-text-row">${liveTextToHTML(g.pattern)}</div>`:''}${rhythmLiveHTML(g.rhythm,song)}</div>`}).join('')||'<div class="muted">Esta canción todavía no tiene bloques de guía.</div>'}</div>
   <div class="live-nav"><button id="prevSong" class="btn ghost" ${state.liveIndex===0?'disabled':''}>← Anterior</button><div class="live-nav-title">${state.liveIndex+1} · ${esc(song.title)}</div><button id="nextSong" class="btn primary" ${state.liveIndex===sl.songIds.length-1?'disabled':''}>Siguiente →</button></div>
 </div>`;
 $$('[data-live-open-set]').forEach(b=>b.onclick=()=>{stopTranscriptionMedia();state.metro.running=false;clearTimeout(state.metro.timer);state.liveSongId=null;state.activeSetlist=b.dataset.liveOpenSet;state.liveIndex=0;const x=state.db.songs.find(s=>s.id===state.db.setlists.find(a=>a.id===state.activeSetlist)?.songIds[0]);if(x)loadSongTempo(x);renderLive()});
 $('#liveSetSel').onchange=e=>{stopTranscriptionMedia();state.metro.running=false;clearTimeout(state.metro.timer);state.liveSongId=null;state.activeSetlist=e.target.value;state.liveIndex=0;const x=state.db.songs.find(s=>s.id===state.db.setlists.find(a=>a.id===state.activeSetlist)?.songIds[0]);if(x)loadSongTempo(x);renderLive()};
 $('#liveSongSel').onchange=e=>{stopTranscriptionMedia();state.metro.running=false;clearTimeout(state.metro.timer);state.liveSongId=null;state.liveIndex=+e.target.value;const x=state.db.songs.find(s=>s.id===sl.songIds[state.liveIndex]);if(x)loadSongTempo(x);renderLive()};
 $('#prevSong').onclick=()=>{stopTranscriptionMedia();state.metro.running=false;clearTimeout(state.metro.timer);state.liveSongId=null;state.liveIndex--;const x=state.db.songs.find(s=>s.id===sl.songIds[state.liveIndex]);if(x)loadSongTempo(x);renderLive()};
 $('#nextSong').onclick=()=>{stopTranscriptionMedia();state.metro.running=false;clearTimeout(state.metro.timer);state.liveSongId=null;state.liveIndex++;const x=state.db.songs.find(s=>s.id===sl.songIds[state.liveIndex]);if(x)loadSongTempo(x);renderLive()};
 $('#liveLayoutSel').onchange=e=>{const next=Math.max(1,Math.min(8,Number(e.target.value)||1));state.liveLayout=next;localStorage.setItem('drumguide_live_layout',String(next));const live=document.querySelector('.live');if(live){live.classList.remove('live-layout-1','live-layout-2','live-layout-3','live-layout-4','live-layout-5','live-layout-6','live-layout-7','live-layout-8');live.classList.add(`live-layout-${next}`);requestAnimationFrame(()=>requestAnimationFrame(fitLiveBlocks))}};
 state.liveSongId=song.id;const lt=ensureLiveTransport(song);updateLiveTransportUI(song,false);
 $('#liveCountInSel').onchange=e=>{lt.countInBars=Math.max(0,Number(e.target.value)||0);if(!state.metro.running&&lt.songBar===0){lt.phase='idle';lt.scheduledDownbeats=0;updateLiveTransportUI(song,false)}};
 $('#liveResetTransport').onclick=()=>{state.metro.running=false;clearTimeout(state.metro.timer);state.metro.timer=null;lt.phase='idle';lt.songBar=0;lt.scheduledDownbeats=0;lt.paused=false;state.metro.currentBeat=0;document.querySelector('.live-guide')?.scrollTo({top:0,behavior:'smooth'});updateLiveTransportUI(song,false)};
 $('#liveMetro').onclick=async()=>{loadSongTempo(song);state.liveSongId=song.id;
   if(state.metro.running){state.metro.running=false;clearTimeout(state.metro.timer);state.metro.timer=null;lt.paused=true;updateLiveTransportUI(song,false);return;}
   if(lt.phase==='done'){lt.phase='idle';lt.songBar=0;lt.scheduledDownbeats=0;lt.paused=false;}
   try{const ctx=await ensureAudioReady();state.metro.running=true;state.metro.currentBeat=0;state.metro.nextNoteTime=ctx.currentTime+.08;lt.paused=false;if(lt.songBar===0)lt.phase='idle';else lt.phase='song';scheduler();updateLiveTransportUI(song,false)}catch(e){console.error(e);toast('No se pudo activar el click')}
 };
 $('#wakeBtn').onclick=async()=>{try{if('wakeLock'in navigator){await navigator.wakeLock.request('screen');toast('Pantalla mantenida activa')}else toast('Este navegador no permite bloquear el apagado de pantalla')}catch{toast('No se pudo mantener la pantalla activa')}};
 $('#fullLiveBtn').onclick=()=>setLiveFull(true);
 if($('#exitFull'))$('#exitFull').onclick=()=>setLiveFull(false);
 renderTranscriptionPlayer(song,song.mediaId,'livePlayer');
 requestAnimationFrame(()=>requestAnimationFrame(fitLiveBlocks));
}

function renderPDF(){
 $('#view').innerHTML=`<div class="grid cols-2"><div class="card"><h2 style="margin-top:0">PDF de una canción</h2><p class="muted">Ficha y guía completa, pensada para leer desde tablet.</p><div class="field"><label>Canción</label><select id="pdfSong" class="select">${state.db.songs.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></div><div class="inline" style="margin-top:14px"><button class="btn primary" id="printSongPortrait">Vertical</button><button class="btn ghost" id="printSongLandscape">Horizontal</button></div></div><div class="card"><h2 style="margin-top:0">PDF de setlist + guías</h2><p class="muted">Genera un documento único siguiendo el orden exacto del repertorio.</p><div class="field"><label>Setlist</label><select id="pdfSet" class="select">${state.db.setlists.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="inline" style="margin-top:14px"><button class="btn primary" id="printSetPortrait">Vertical</button><button class="btn ghost" id="printSetLandscape">Horizontal</button></div></div></div><div class="card" style="margin-top:18px"><strong>Cómo se genera</strong><p class="muted">Al pulsar, se abre el diálogo de impresión del navegador. Selecciona <span class="code">Guardar como PDF</span>. El diseño elimina menús y botones automáticamente.</p></div>`;
 $('#printSongPortrait').onclick=()=>printSong($('#pdfSong').value,'portrait');$('#printSongLandscape').onclick=()=>printSong($('#pdfSong').value,'landscape');$('#printSetPortrait').onclick=()=>printSet($('#pdfSet').value,'portrait');$('#printSetLandscape').onclick=()=>printSet($('#pdfSet').value,'landscape');
}
function injectPrint(content,orientation){let p=$('#printRoot');if(p)p.remove();p=document.createElement('div');p.id='printRoot';p.className='print-only';p.innerHTML=content;document.body.appendChild(p);let st=$('#printOrientation');if(st)st.remove();st=document.createElement('style');st.id='printOrientation';st.textContent=`@page{size:A4 ${orientation};margin:10mm}`;document.head.appendChild(st);setTimeout(()=>window.print(),100)}
function printSong(id,orientation){const s=state.db.songs.find(x=>x.id===id);if(!s)return;injectPrint(`<div class="print-sheet">${printSongHTML(s)}</div>`,orientation)}
function printSet(id,orientation){const sl=state.db.setlists.find(x=>x.id===id);if(!sl)return;const songs=sl.songIds.map(id=>state.db.songs.find(s=>s.id===id)).filter(Boolean);injectPrint(`<div class="print-sheet"><div class="print-head"><div><h1>${esc(sl.name)}</h1><div>${esc(sl.date||'')} · ${songs.length} canciones · ${minsToText(totalDuration(sl.songIds))}</div></div><div>DrumGuide</div></div><table class="print-setlist"><thead><tr><th>#</th><th>Canción</th><th>BPM</th><th>Compás</th><th>Duración</th></tr></thead><tbody>${songs.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.title)}${s.artist?` · ${esc(s.artist)}`:''}</td><td>${s.bpm}</td><td>${signature(s)}</td><td>${minsToText(s.duration)}</td></tr>`).join('')}</tbody></table><div style="page-break-after:always"></div>${songs.map(printSongHTML).join('')}</div>`,orientation)}
function printSongHTML(s){return `<section class="print-song"><div class="print-head"><div><h1>${esc(s.title)}</h1><div>${esc(s.artist||'')}</div></div><div><strong>${s.bpm} BPM</strong><br>${signature(s)} · ${minsToText(s.duration)}</div></div>${s.notes?`<div class="print-meta"><strong>Notas:</strong> ${esc(s.notes)}</div>`:''}<table class="print-table"><thead><tr><th>Sección</th><th>Compases</th><th>Patrón / groove</th><th>Fill / indicaciones</th></tr></thead><tbody>${(s.guide||[]).map(g=>`<tr><td><strong>${esc(g.name)}</strong></td><td>${esc(g.bars)}</td><td>${esc(g.pattern)}${hasRhythm(g.rhythm)?`<div class="print-rhythm-diagram">${rhythmDiagramHTML(g.rhythm,s,{print:true})}</div>`:''}</td><td>${esc(g.notes)}</td></tr>`).join('')||'<tr><td colspan="4">Sin guía</td></tr>'}</tbody></table></section>`}


const MEDIA_DB_NAME='drumguide-media-v1',MEDIA_DB_LEGACY='drumguide-media-v2',MEDIA_STORE='files';
function openNamedMediaDB(name){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(MEDIA_STORE))db.createObjectStore(MEDIA_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function openMediaDB(){return openNamedMediaDB(MEDIA_DB_NAME)}
async function mediaRawGet(dbName,id){const db=await openNamedMediaDB(dbName);return new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readonly'),r=tx.objectStore(MEDIA_STORE).get(id);r.onsuccess=()=>{db.close();resolve(r.result??null)};r.onerror=()=>{db.close();reject(r.error)}})}
function normalizeMediaBlob(v,mime=''){if(!v)return null;if(v instanceof Blob)return v;if(v.buffer){try{return new Blob([v.buffer],{type:v.type||mime||''})}catch{return null}}if(v.data){try{return new Blob([v.data],{type:v.type||mime||''})}catch{return null}}return null}
async function mediaBlobPut(id,blob){const db=await openMediaDB();return new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readwrite');tx.objectStore(MEDIA_STORE).put(blob,id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function mediaBlobGet(id,mime=''){let raw=null;try{raw=await mediaRawGet(MEDIA_DB_NAME,id)}catch(e){console.warn('Media DB v1 read',e)}let blob=normalizeMediaBlob(raw,mime);if(blob)return blob;try{raw=await mediaRawGet(MEDIA_DB_LEGACY,id);blob=normalizeMediaBlob(raw,mime);if(blob){try{await mediaBlobPut(id,blob)}catch{}return blob}}catch(e){console.warn('Media DB legacy read',e)}return null}
async function mediaBlobDelete(id){for(const name of [MEDIA_DB_NAME,MEDIA_DB_LEGACY]){try{const db=await openNamedMediaDB(name);await new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_STORE,'readwrite');tx.objectStore(MEDIA_STORE).delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}catch{}}}
function youtubeIdFromUrl(value){const v=String(value||'').trim();if(/^[A-Za-z0-9_-]{11}$/.test(v))return v;try{const u=new URL(v);if(u.hostname.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';if(u.hostname.includes('youtube.com')){if(u.pathname.startsWith('/shorts/'))return u.pathname.split('/')[2]||'';if(u.pathname.startsWith('/embed/'))return u.pathname.split('/')[2]||'';return u.searchParams.get('v')||''}}catch{}return ''}
function mediaTypeLabel(m){return m.type==='youtube'?'YouTube':(m.mime||'').startsWith('video/')?'Vídeo':'Audio'}
function mediaOptions(selected=''){return `<option value="">Selecciona audio, vídeo o YouTube…</option>${state.db.mediaItems.map(m=>`<option value="${m.id}" ${m.id===selected?'selected':''}>${esc(m.name)} · ${mediaTypeLabel(m)}</option>`).join('')}`}

function mediaMatchKey(value=''){
 return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/\.(mp3|wav|m4a|aac|ogg|flac|mp4|webm|mov|m4v)$/i,'')
  .replace(/^\s*\d+[\s._-]*/,'').replace(/\([^)]*\)|\[[^\]]*\]/g,' ')
  .replace(/\b(official|oficial|audio|video|lyric|lyrics|remaster(?:ed)?|hd|hq)\b/g,' ')
  .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function mediaMatchScore(song,media){
 const t=mediaMatchKey(song?.title),a=mediaMatchKey(song?.artist),m=mediaMatchKey(media?.name);
 if(!t||!m)return 0;if(m===t)return 100;if(a&&m===`${t} ${a}`)return 98;if(a&&m===`${a} ${t}`)return 98;
 if(m.startsWith(t+' ')||m.endsWith(' '+t))return 90;
 if(t.length>=5&&m.includes(t))return 82;
 const words=t.split(' ').filter(x=>x.length>2);if(words.length){const hits=words.filter(w=>m.includes(w)).length;const ratio=hits/words.length;if(ratio>=.8)return 70+Math.round(ratio*10)}
 return 0;
}
function bestMediaForSong(song){
 const candidates=state.db.mediaItems.map(m=>({m,score:mediaMatchScore(song,m)})).filter(x=>x.score>=80).sort((x,y)=>y.score-x.score);
 if(!candidates.length)return null;if(candidates.length>1&&candidates[0].score===candidates[1].score)return null;return candidates[0].m;
}
function autoLinkSongMedia(song){if(song?.mediaId&&state.db.mediaItems.some(m=>m.id===song.mediaId))return song.mediaId;const m=bestMediaForSong(song);if(m){song.mediaId=m.id;return m.id}return ''}
function autoLinkAllSongs(){let n=0;state.db.songs.forEach(song=>{if(!song.mediaId&&autoLinkSongMedia(song))n++});return n}
async function addLocalMediaFiles(files){const arr=[...files].filter(f=>(f.type||'').startsWith('audio/')||(f.type||'').startsWith('video/')||/\.(mp3|wav|m4a|aac|ogg|flac|mp4|webm|mov|m4v)$/i.test(f.name));if(!arr.length){toast('Selecciona archivos de audio o vídeo');return []}state.mediaSessionFiles=state.mediaSessionFiles||{};const added=[];for(const f of arr){const id=uid('media');try{let blob=f;if(!(f.type||'')){blob=new Blob([await f.arrayBuffer()],{type:mediaMimeFromName(f.name)||'application/octet-stream'})}await mediaBlobPut(id,blob);state.mediaSessionFiles[id]=blob;state.db.mediaItems.push({id,type:'local',name:f.name,mime:blob.type||mediaMimeFromName(f.name)||'',size:f.size,createdAt:new Date().toISOString()});added.push(id)}catch(e){console.error(e);toast('No se pudo guardar '+f.name)}}if(added.length){try{if(navigator.storage?.persist)await navigator.storage.persist()}catch{}const linked=autoLinkAllSongs();await saveDB(`${added.length} archivo${added.length===1?'':'s'} multimedia añadido${added.length===1?'':'s'}${linked?` · ${linked} canción${linked===1?'':'es'} vinculada${linked===1?'':'s'} automáticamente`:''}`)}return added}
async function addYoutubeMedia(url,name=''){const idVideo=youtubeIdFromUrl(url);if(!idVideo){toast('Enlace de YouTube no válido');return null}const id=uid('media');state.db.mediaItems.push({id,type:'youtube',name:String(name||'').trim()||`YouTube · ${idVideo}`,youtubeId:idVideo,source:String(url||''),createdAt:new Date().toISOString()});await saveDB('YouTube añadido a la biblioteca');return id}
async function deleteMediaItem(id){const m=state.db.mediaItems.find(x=>x.id===id);if(!m)return;const linked=state.db.songs.filter(s=>s.mediaId===id);if(!confirm(`¿Eliminar “${m.name}” de la biblioteca?${linked.length?`\n\nEstá asociado a ${linked.length} canción${linked.length===1?'':'es'} y se desvinculará.`:''}`))return;if(m.type==='local')try{await mediaBlobDelete(id)}catch{}state.db.mediaItems=state.db.mediaItems.filter(x=>x.id!==id);state.db.songs.forEach(s=>{if(s.mediaId===id)s.mediaId='' });await saveDB('Multimedia eliminado')}
function mediaLibraryRows(){return state.db.mediaItems.length?state.db.mediaItems.map(m=>`<div class="media-library-row"><div class="media-type">${m.type==='youtube'?'▶':(m.mime||'').startsWith('video/')?'▣':'♫'}</div><div class="row-main"><strong>${esc(m.name)}</strong><div class="row-meta">${mediaTypeLabel(m)}${m.type==='local'&&m.size?` · ${(m.size/1024/1024).toFixed(1)} MB`:''}</div></div><button type="button" class="btn danger small" data-media-delete="${m.id}">Eliminar</button></div>`).join(''):'<div class="empty compact">Todavía no has cargado audio, vídeo ni YouTube.</div>'}
function mediaLibraryModal(){openModal('Biblioteca multimedia',`<div class="media-library-actions"><label class="btn primary" for="mediaFilesInput">+ Cargar MP3 / audio / vídeo</label><input id="mediaFilesInput" type="file" multiple accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.webm,.mov,.m4v" hidden><div class="youtube-add"><input id="youtubeUrl" class="input" placeholder="Pega enlace de YouTube"><input id="youtubeName" class="input" placeholder="Nombre (opcional)"><button type="button" class="btn ghost" id="youtubeAddBtn">+ YouTube</button></div></div><div class="divider"></div><div id="mediaLibraryRows">${mediaLibraryRows()}</div><p class="muted media-storage-note">Los MP3 y vídeos se guardan en el almacenamiento local de este dispositivo para poder reutilizarlos en DrumGuide. Los enlaces de YouTube requieren conexión.</p>`,async()=>{render();return true},'Cerrar');$('#modal').classList.add('media-library-mode');const refresh=()=>{$('#mediaLibraryRows').innerHTML=mediaLibraryRows();$$('[data-media-delete]').forEach(b=>b.onclick=async()=>{await deleteMediaItem(b.dataset.mediaDelete);refresh()})};$('#mediaFilesInput').onchange=async e=>{await addLocalMediaFiles(e.target.files||[]);e.target.value='';refresh()};$('#youtubeAddBtn').onclick=async()=>{const id=await addYoutubeMedia($('#youtubeUrl').value,$('#youtubeName').value);if(id){$('#youtubeUrl').value='';$('#youtubeName').value='';refresh()}};refresh()}
function stopMp3Player(){const p=state.mp3Player;if(!p)return;try{if(p.timer)clearInterval(p.timer)}catch{}try{if(p.source){p.ignoreEnded=true;p.source.stop()}}catch{}try{p.source?.disconnect()}catch{}try{p.gain?.disconnect()}catch{}/* El AudioContext es compartido con el metrónomo: no se cierra aquí. */state.mp3Player=null}
function stopTranscriptionMedia(){stopMp3Player();if(state.activeMediaEl){try{state.activeMediaEl.pause()}catch{}state.activeMediaEl=null}if(state.mediaObjectUrl){URL.revokeObjectURL(state.mediaObjectUrl);state.mediaObjectUrl=null}}
function youtubeCommand(func,args=[]){const f=$('#transcribeYoutube');if(f?.contentWindow)f.contentWindow.postMessage(JSON.stringify({event:'command',func,args}),'*')}
function localMediaSeek(delta){const el=state.activeMediaEl;if(el&&Number.isFinite(el.duration)){el.currentTime=Math.max(0,Math.min(el.duration,el.currentTime+delta))}}
function localMediaRestart(){const el=state.activeMediaEl;if(el){el.pause();el.currentTime=0}}
function mediaMimeFromName(name=''){const n=String(name||'').toLowerCase();if(n.endsWith('.mp3'))return'audio/mpeg';if(n.endsWith('.m4a'))return'audio/mp4';if(n.endsWith('.aac'))return'audio/aac';if(n.endsWith('.wav'))return'audio/wav';if(n.endsWith('.ogg'))return'audio/ogg';if(n.endsWith('.flac'))return'audio/flac';if(n.endsWith('.mp4')||n.endsWith('.m4v'))return'video/mp4';if(n.endsWith('.webm'))return'video/webm';if(n.endsWith('.mov'))return'video/quicktime';return''}
async function replaceMediaFile(media,file){if(!media||!file)return false;const ok=(file.type||'').startsWith('audio/')||(file.type||'').startsWith('video/')||/\.(mp3|wav|m4a|aac|ogg|flac|mp4|webm|mov|m4v)$/i.test(file.name||'');if(!ok){toast('Selecciona un archivo de audio o vídeo válido');return false}try{const blob=new Blob([await file.arrayBuffer()],{type:file.type||mediaMimeFromName(file.name)||'application/octet-stream'});await mediaBlobPut(media.id,blob,file.name||media.name);media.name=file.name||media.name;media.mime=blob.type||media.mime||'';media.size=file.size||0;media.updatedAt=new Date().toISOString();await saveDB('Archivo multimedia recargado');try{if(navigator.storage?.persist)await navigator.storage.persist()}catch{}return true}catch(e){console.error(e);toast('No se pudo guardar el archivo');return false}}
function mediaRecoveryHTML(media,msg='No se puede leer el archivo guardado.'){return `<div class="media-player-empty media-repair"><strong>${esc(msg)}</strong><div class="muted">La ficha de la canción se conserva. Solo necesitas volver a seleccionar el MP3/vídeo una vez en este dispositivo.</div><label class="btn primary" for="repairMediaFile">↻ Recargar ${mediaTypeLabel(media)}</label><input id="repairMediaFile" type="file" accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.webm,.mov,.m4v" hidden></div>`}
async function bindMediaRecovery(song,media){const input=$('#repairMediaFile');if(!input)return;input.onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(await replaceMediaFile(media,f))await renderTranscriptionPlayer(song,media.id)}}
async function renderTranscriptionPlayer(song,mediaId,hostId='transcribePlayer'){
 stopTranscriptionMedia();
 const host=document.getElementById(hostId);if(!host)return;
 const m=state.db.mediaItems.find(x=>x.id===mediaId);
 if(!m){host.innerHTML='<div class="media-player-empty">Selecciona o carga una canción para empezar a transcribir.</div>';return}
 if(m.type==='youtube'){
  const origin=location.origin&&location.origin!=='null'?`&origin=${encodeURIComponent(location.origin)}`:'';
  host.innerHTML=`<div class="youtube-wrap"><iframe id="transcribeYoutube" title="${esc(m.name)}" src="https://www.youtube.com/embed/${encodeURIComponent(m.youtubeId)}?enablejsapi=1&playsinline=1${origin}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><div class="transport"><button type="button" class="btn ghost" data-yt="restart">⏮ Reiniciar</button><button type="button" class="btn primary" data-yt="playVideo">▶ Reproducir</button><button type="button" class="btn ghost" data-yt="pauseVideo">⏸ Pausa</button><span class="muted youtube-seek-note">Para avanzar o retroceder usa la barra del propio vídeo.</span></div>`;
  const frame=$('#transcribeYoutube');const cmd=(func,args=[])=>{try{frame.contentWindow.postMessage(JSON.stringify({event:'command',func,args}),'*')}catch{}};
  $$('[data-yt]').forEach(b=>b.onclick=()=>{const c=b.dataset.yt;if(c==='restart'){cmd('seekTo',[0,true]);cmd('playVideo')}else cmd(c)});return;
 }
 try{
  const sessionBlob=state.mediaSessionFiles?.[m.id]||null;
  let blob=sessionBlob||await mediaBlobGet(m.id,m.mime||mediaMimeFromName(m.name)||'');
  if(!blob)throw new Error('missing-media');
  if(!blob.type){blob=new Blob([await blob.arrayBuffer()],{type:m.mime||mediaMimeFromName(m.name)||'audio/mpeg'})}
  if(!blob.size)throw new Error('empty-media');
  const isVideo=(m.mime||blob.type||'').startsWith('video/')||/\.(mp4|webm|mov|m4v)$/i.test(m.name||'');
  if(isVideo){
   state.mediaObjectUrl=URL.createObjectURL(blob);
   host.innerHTML=`<video id="transcribeLocalMedia" class="transcribe-video" controls playsinline preload="metadata"></video><div class="transport"><button type="button" class="btn ghost" id="mediaRestart">⏮ Inicio</button><button type="button" class="btn ghost" id="mediaBack">−5 s</button><button type="button" class="btn primary" id="mediaPlayPause">▶ Play / ⏸ Pausa</button><button type="button" class="btn ghost" id="mediaForward">+5 s</button><label class="speed-control">Velocidad <select id="mediaSpeed" class="select"><option value="0.5">0,5×</option><option value="0.75">0,75×</option><option value="1" selected>1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option></select></label></div>`;
   const el=$('#transcribeLocalMedia');state.activeMediaEl=el;el.src=state.mediaObjectUrl;el.load();
   $('#mediaRestart').onclick=localMediaRestart;$('#mediaBack').onclick=()=>localMediaSeek(-5);$('#mediaForward').onclick=()=>localMediaSeek(5);
   $('#mediaPlayPause').onclick=async()=>{try{if(el.paused)await el.play();else el.pause()}catch(err){console.error(err);toast('El navegador no ha podido iniciar el vídeo')}};
   $('#mediaSpeed').onchange=e=>el.playbackRate=+e.target.value||1;return;
  }

  // MP3 / audio: motor Web Audio independiente del elemento <audio> de Android.
  host.innerHTML=`<div class="dg-audio-player"><div class="dg-audio-title">♫ ${esc(m.name)}</div><div class="dg-audio-row"><span id="dgAudioCurrent" class="dg-audio-clock">0:00</span><input id="dgAudioSeek" class="dg-audio-seek" type="range" min="0" max="1" step="0.05" value="0" aria-label="Posición de reproducción"><span id="dgAudioDuration" class="dg-audio-clock">Cargando…</span><button type="button" class="btn primary dg-transport-btn" id="mediaPlay">▶ Play</button><button type="button" class="btn ghost dg-transport-btn" id="mediaPause">⏸ Pausa</button><button type="button" class="btn ghost dg-transport-btn" id="mediaStop">■ Stop</button><button type="button" class="btn ghost dg-transport-btn" id="mediaBack">−5 s</button><button type="button" class="btn ghost dg-transport-btn" id="mediaForward">+5 s</button><label class="speed-control dg-inline-speed">Velocidad <select id="mediaSpeed" class="select"><option value="0.5">0,5×</option><option value="0.75">0,75×</option><option value="1" selected>1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option></select></label></div><div id="dgAudioState" class="muted dg-audio-state">Preparando MP3…</div></div>`;
  const currentEl=$('#dgAudioCurrent'),durationEl=$('#dgAudioDuration'),seekEl=$('#dgAudioSeek'),stateEl=$('#dgAudioState');
  const fmt=t=>{t=Math.max(0,Number(t)||0);const mm=Math.floor(t/60),ss=Math.floor(t%60);return `${mm}:${String(ss).padStart(2,'0')}`};
  // MP3 y metrónomo usan un único AudioContext para evitar audio mudo al reanudar en Android/Samsung.
  const ctx=await ensureAudioReady();
  const arrayBuffer=await blob.arrayBuffer();
  const audioBuffer=await ctx.decodeAudioData(arrayBuffer.slice(0));
  if(!audioBuffer||!Number.isFinite(audioBuffer.duration)||audioBuffer.duration<=0)throw new Error('decode-failed');
  const p=state.mp3Player={ctx,buffer:audioBuffer,source:null,playing:false,offset:0,startOffset:0,contextStart:0,rate:1,timer:null,ignoreEnded:false};
  seekEl.max=String(audioBuffer.duration);durationEl.textContent=fmt(audioBuffer.duration);stateEl.textContent=`MP3 preparado · ${fmt(audioBuffer.duration)} · ${(blob.size/1024/1024).toFixed(1)} MB`;
  song.duration=Math.round(audioBuffer.duration);
  const position=()=>p.playing?Math.min(p.buffer.duration,p.startOffset+(p.ctx.currentTime-p.contextStart)*p.rate):p.offset;
  const draw=()=>{const pos=position();currentEl.textContent=fmt(pos);if(document.activeElement!==seekEl)seekEl.value=String(pos)};
  const stopSource=()=>{if(p.source){try{p.ignoreEnded=true;p.source.stop()}catch{}try{p.source.disconnect()}catch{}try{p.gain?.disconnect()}catch{}p.source=null;p.gain=null;p.ignoreEnded=false}};
  const startAt=async off=>{off=Math.max(0,Math.min(p.buffer.duration-.001,off||0));await ensureAudioReady();if(p.ctx.state!=='running')await p.ctx.resume();stopSource();const src=p.ctx.createBufferSource();src.buffer=p.buffer;src.playbackRate.value=p.rate;const gain=p.ctx.createGain();gain.gain.value=1;src.connect(gain).connect(p.ctx.destination);p.source=src;p.gain=gain;p.startOffset=off;p.offset=off;p.contextStart=p.ctx.currentTime;p.playing=true;src.onended=()=>{if(p.source!==src)return;if(position()>=p.buffer.duration-.08){p.playing=false;p.offset=0;p.source=null;p.gain=null;draw();stateEl.textContent='Reproducción finalizada'} };src.start(0,off);stateEl.textContent='▶ Reproduciendo';draw()};
  const pause=()=>{if(!p.playing)return;p.offset=position();p.playing=false;stopSource();stateEl.textContent='⏸ En pausa';draw()};
  const seekTo=async value=>{const was=p.playing;if(was)pause();p.offset=Math.max(0,Math.min(p.buffer.duration,Number(value)||0));draw();if(was&&p.offset<p.buffer.duration)await startAt(p.offset)};
  $('#mediaPlay').onclick=async()=>{try{if(!p.playing)await startAt(p.offset>=p.buffer.duration?0:p.offset)}catch(err){console.error('MP3 PLAY',err);stateEl.textContent='No se pudo iniciar el audio';toast('No se pudo iniciar el MP3')}};
  $('#mediaPause').onclick=pause;
  $('#mediaStop').onclick=()=>{pause();p.offset=0;draw();stateEl.textContent='■ Detenido'};
  $('#mediaBack').onclick=()=>seekTo(position()-5);$('#mediaForward').onclick=()=>seekTo(position()+5);
  seekEl.onchange=e=>seekTo(e.target.value);
  $('#mediaSpeed').onchange=async e=>{const was=p.playing,at=position();if(was)pause();p.rate=+e.target.value||1;p.offset=at;if(was)await startAt(at)};
  p.timer=setInterval(draw,200);draw();
 }catch(e){console.error('LOCAL MEDIA ERROR',e);host.innerHTML=`<div class="media-player-empty danger-text"><strong>No se ha podido decodificar el MP3.</strong><div class="muted">${esc(String(e?.message||e))}</div></div>`}
}


function transcribeMetroHTML(song){
 const m=state.metro;
 const saved=clampMetroBpm(song.metroBpm||song.bpm||100);
 return `<div class="transcribe-generic-metro" id="transcribeGenericMetro"><div class="transcribe-metro-label"><strong>● Metrónomo</strong><span>BPM propio guardado para esta canción</span></div><button type="button" class="btn ghost metro-step" id="transcribeBpmMinus" aria-label="Bajar BPM">−</button><label class="transcribe-bpm-control"><input id="transcribeBpmInput" class="input" type="number" min="30" max="300" value="${saved}"><span>BPM</span></label><button type="button" class="btn ghost metro-step" id="transcribeBpmPlus" aria-label="Subir BPM">+</button><button type="button" class="btn ghost" id="transcribeBpmSong" title="Volver al BPM original de la ficha">↺ ${song.bpm||100}</button><button type="button" class="btn ${m.running?'danger':'primary'}" id="transcribeMetroToggle">${m.running?'■ Apagar':'▶ Encender'}</button></div>`;
}

function updateTranscribeMetroUI(){
 const input=$('#transcribeBpmInput'),btn=$('#transcribeMetroToggle');
 if(input)input.value=state.metro.bpm;
 if(btn){btn.textContent=state.metro.running?'■ Apagar':'▶ Encender';btn.classList.toggle('danger',state.metro.running);btn.classList.toggle('primary',!state.metro.running)}
}

function bindTranscribeMetro(song){
 const input=$('#transcribeBpmInput');if(!input)return;
 state.metro.bpm=clampMetroBpm(song.metroBpm||song.bpm||100);
 const setBpm=async(v,persist=true)=>{state.metro.bpm=clampMetroBpm(v);input.value=state.metro.bpm;if(persist){song.metroBpm=state.metro.bpm;await saveDB(`Metrónomo guardado a ${state.metro.bpm} BPM`)}};
 input.onchange=e=>setBpm(e.target.value,true);
 input.oninput=e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=30&&n<=300)state.metro.bpm=Math.round(n)};
 $('#transcribeBpmMinus').onclick=()=>setBpm(state.metro.bpm-1,true);
 $('#transcribeBpmPlus').onclick=()=>setBpm(state.metro.bpm+1,true);
 $('#transcribeBpmSong').onclick=()=>{state.metro.meter=song.meter||4;state.metro.denominator=song.denominator||4;state.metro.subdivision=song.subdivision||1;setBpm(song.bpm||100,true)};
 $('#transcribeMetroToggle').onclick=async()=>{await toggleMetronome();updateTranscribeMetroUI()};
 updateTranscribeMetroUI();
}

function transcribeGuideBlockHTML(g,i,song){
 const rhythm=hasRhythm(g.rhythm),collapsed=!!g._collapsed;
 const label=String(g.name||'').trim()||`Sección ${i+1}`;
 return `<div class="guide-block transcription-guide-block ${sectionTypeClass(g.name)} ${collapsed?'is-collapsed':''}" data-guide-index="${i}"><div class="guide-block-head transcription-guide-block-head"><button type="button" class="guide-move-select-btn" data-guide-move-select="${i}" aria-label="Seleccionar sección ${i+1} para moverla" title="Seleccionar esta sección y después tocar el lugar de destino">Mover</button><button type="button" class="guide-collapse-btn" data-guide-toggle="${i}" aria-expanded="${collapsed?'false':'true'}" title="${collapsed?'Desplegar':'Plegar'} sección"><span class="guide-collapse-arrow">${collapsed?'▸':'▾'}</span><span class="guide-collapse-label">${collapsed?'Desplegar':'Plegar'}</span></button><div class="guide-block-title"><strong>Sección ${i+1}</strong><span class="guide-block-summary">${esc(label)} · ${esc(g.bars||'—')} compases${rhythm?' · patrón':''}</span></div><div class="guide-block-actions"><button type="button" class="btn ghost small" data-guide-dup="${i}">Duplicar</button><button type="button" class="btn danger small" data-guide-del="${i}">Eliminar</button></div></div><div class="guide-collapsible-body"><div class="guide-grid transcription-guide-grid"><div class="field"><label>Nombre</label>${sectionNameControlHTML(g.name,i,'transcribe-')}</div><div class="field"><label>Compases</label><input class="input" name="gbars" value="${esc(g.bars)}"></div><div class="field"><label>Patrón / groove</label><input class="input" name="gpattern" value="${esc(g.pattern)}"><div class="rhythm-actions"><button type="button" class="btn ${rhythm?'primary':'ghost'} small" data-rhythm-edit="${i}">🥁 ${rhythm?'Editar patrón':'Crear patrón'}</button>${rhythm?`<span class="rhythm-ok">● Patrón guardado</span><button type="button" class="btn ghost small" data-rhythm-clear="${i}">Quitar</button>`:''}</div>${rhythm?rhythmMiniHTML(g.rhythm,song):''}</div><div class="field"><label>Fill / indicaciones</label><input class="input" name="gnotes" value="${esc(g.notes)}"></div></div></div></div>`
}
function transcribeModal(song){
 if(!song)return;
 if(!song.mediaId&&autoLinkSongMedia(song))saveDB('Multimedia asociado automáticamente por título').catch(()=>{});
 loadSongTempo(song);state.metro.bpm=clampMetroBpm(song.metroBpm||song.bpm||100);state.songMetroId=null;
 let guide=structuredClone(song.guide||[]).map(g=>({...g,_collapsed:true}));
 let undoStack=[],redoStack=[],moveSelectedIndex=null;
 const HISTORY_LIMIT=80;
 const cloneGuide=value=>structuredClone(value||[]);
 const guideKey=value=>JSON.stringify(value||[]);
 const body=()=>`<div class="transcription-layout"><section class="transcription-player-panel"><div class="transcription-media-head"><div><strong>${esc(song.title)}</strong><div class="muted">${esc(song.artist||'')} · ${song.bpm} BPM · ${signature(song)}</div></div></div><div class="transcription-source-row"><select id="transcribeMediaSelect" class="select">${mediaOptions(song.mediaId)}</select><label class="btn ghost" for="transcribeQuickFiles">+ MP3 / vídeo</label><input id="transcribeQuickFiles" type="file" multiple accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.webm,.mov,.m4v" hidden><button type="button" class="btn ghost" id="transcribeYoutubeAdd">+ YouTube</button></div><div id="transcribeYoutubeForm" class="youtube-inline-add hidden"><input id="transcribeYoutubeUrl" class="input" inputmode="url" placeholder="Pega aquí el enlace de YouTube"><button type="button" class="btn primary" id="transcribeYoutubeConfirm">Cargar YouTube</button><button type="button" class="btn ghost" id="transcribeYoutubeCancel">Cancelar</button></div><div id="transcribePlayer" class="transcribe-player"></div>${transcribeMetroHTML(song)}</section><section class="transcription-guide-panel"><div class="inline transcription-guide-head"><div><strong>Partes y patrones</strong><div class="muted">Pausa cuando necesites y continúa apuntando sin salir de esta pantalla.</div></div><div class="inline transcription-history-actions"><button type="button" class="btn ghost small" id="undoTranscribe" disabled title="Deshacer último cambio (Ctrl+Z)">↶ Deshacer</button><button type="button" class="btn ghost small" id="redoTranscribe" disabled title="Rehacer último cambio (Ctrl+Y)">↷ Rehacer</button><button type="button" class="btn ghost small" id="saveTranscribeStay" title="Guardar sin salir (Ctrl+S)">💾 Guardar</button><button type="button" class="btn primary small" id="addTranscribeBlock">+ Sección</button></div></div><div id="guideBlocks" class="transcription-guide-scroll">${guide.map((g,i)=>transcribeGuideBlockHTML(g,i,song)).join('')||'<div class="empty compact">Añade la primera sección de la canción.</div>'}</div></section></div>`;
 const collect=()=>$$('#guideBlocks .guide-block').map((el,i)=>({name:readSectionName(el),bars:el.querySelector('[name="gbars"]').value.trim(),pattern:el.querySelector('[name="gpattern"]').value.trim(),notes:el.querySelector('[name="gnotes"]').value.trim(),rhythm:guide[i]?.rhythm||null,_collapsed:el.classList.contains('is-collapsed')}));
 const persistCurrentTranscription=async(message='Transcripción guardada')=>{const current=collect();song.guide=current.map(({_collapsed,...g})=>g);guide=cloneGuide(current);await saveDB(message)};
 const currentSnapshot=()=>cloneGuide($('#guideBlocks')?collect():guide);
 const updateHistoryButtons=()=>{const u=$('#undoTranscribe'),r=$('#redoTranscribe');if(u)u.disabled=!undoStack.length;if(r)r.disabled=!redoStack.length};
 const pushUndoSnapshot=snapshot=>{const snap=cloneGuide(snapshot);const last=undoStack[undoStack.length-1];if(!last||guideKey(last)!==guideKey(snap)){undoStack.push(snap);if(undoStack.length>HISTORY_LIMIT)undoStack.shift()}redoStack=[];updateHistoryButtons()};
 const applyMoveSelectionUI=()=>{
   const host=$('#guideBlocks');if(!host)return;
   host.classList.toggle('move-mode-active',moveSelectedIndex!==null);
   host.querySelectorAll('.transcription-guide-block').forEach(block=>{
     const i=+block.dataset.guideIndex,selected=i===moveSelectedIndex;
     block.classList.toggle('move-selected',selected);
     block.classList.toggle('move-target',moveSelectedIndex!==null&&!selected);
     const btn=block.querySelector('[data-guide-move-select]');
     if(btn){
       btn.classList.toggle('is-selected',selected);
       btn.textContent=selected?'✓ Seleccionada':(moveSelectedIndex!==null?'Colocar aquí':'Mover');
       btn.title=selected?'Toca de nuevo para cancelar':(moveSelectedIndex!==null?'Mover la sección seleccionada hasta esta posición':'Seleccionar esta sección y después tocar el lugar de destino');
     }
   });
 };
 openModal(`Transcribir canción · v${APP_VERSION}`,body(),async()=>{song.guide=collect().map(({_collapsed,...g})=>g);await saveDB('Transcripción guardada');render();return true},'Guardar y salir');
 $('#modal').classList.add('transcription-mode');
 updateSongMetroButtons();
 const bindHistoryFields=host=>{
   host.querySelectorAll('input[name="gbars"],input[name="gpattern"],input[name="gnotes"],input[name="gname_custom"],select[name="gname_select"]').forEach(el=>{
     el.addEventListener('focus',()=>{el._historyStart=currentSnapshot();el._historyRecorded=false});
     const record=()=>{if(el._historyRecorded)return;const before=el._historyStart||currentSnapshot();pushUndoSnapshot(before);el._historyRecorded=true};
     if(el.tagName==='SELECT')el.addEventListener('change',record);else el.addEventListener('beforeinput',record);
     el.addEventListener('blur',()=>{el._historyStart=null;el._historyRecorded=false});
   });
 };
 const rerenderGuide=(scrollMode='keep',targetIndex=null)=>{const host=$('#guideBlocks'),oldTop=host?.scrollTop||0;host.innerHTML=guide.map((g,i)=>transcribeGuideBlockHTML(g,i,song)).join('')||'<div class="empty compact">Añade la primera sección de la canción.</div>';bindGuide();bindSectionNameControls(host);bindHistoryFields(host);applyMoveSelectionUI();requestAnimationFrame(()=>{if(scrollMode==='bottom')host.scrollTop=host.scrollHeight;else if(scrollMode==='index'&&targetIndex!==null){host.querySelector(`[data-guide-index="${targetIndex}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'})}else host.scrollTop=oldTop});updateHistoryButtons()};
 const undo=()=>{if(!undoStack.length)return;const current=currentSnapshot(),previous=undoStack.pop();redoStack.push(current);guide=cloneGuide(previous);moveSelectedIndex=null;rerenderGuide();toast('Cambio deshecho')};
 const redo=()=>{if(!redoStack.length)return;const current=currentSnapshot(),next=redoStack.pop();undoStack.push(current);guide=cloneGuide(next);moveSelectedIndex=null;rerenderGuide();toast('Cambio rehecho')};
 const bindGuide=()=>{
   $$('[data-guide-toggle]').forEach(b=>b.onclick=()=>{const block=b.closest('.guide-block');if(!block)return;const collapsed=block.classList.toggle('is-collapsed');b.setAttribute('aria-expanded',String(!collapsed));b.title=collapsed?'Desplegar sección':'Plegar sección';const arrow=b.querySelector('.guide-collapse-arrow');if(arrow)arrow.textContent=collapsed?'▸':'▾';const label=b.querySelector('.guide-collapse-label');if(label)label.textContent=collapsed?'Desplegar':'Plegar';const i=+b.dataset.guideToggle;if(guide[i])guide[i]._collapsed=collapsed});
   $$('[data-guide-dup]').forEach(b=>b.onclick=()=>{moveSelectedIndex=null;const before=currentSnapshot(),i=+b.dataset.guideDup;pushUndoSnapshot(before);guide=cloneGuide(before);const copy=structuredClone(guide[i]||{name:'',bars:'4',pattern:'',notes:'',rhythm:null});copy._collapsed=false;guide.push(copy);rerenderGuide('bottom');toast('Sección duplicada al final')});
   $$('[data-guide-del]').forEach(b=>b.onclick=()=>{moveSelectedIndex=null;const before=currentSnapshot();pushUndoSnapshot(before);guide=before.filter((_,i)=>i!=+b.dataset.guideDel);rerenderGuide()});
   $$('[data-rhythm-edit]').forEach(b=>b.onclick=()=>{const before=currentSnapshot(),i=+b.dataset.rhythmEdit;guide=cloneGuide(before);openRhythmEditor(song,guide[i]?.rhythm,r=>{pushUndoSnapshot(before);guide=cloneGuide(before);if(guide[i])guide[i].rhythm=r;rerenderGuide()})});
   $$('[data-rhythm-clear]').forEach(b=>b.onclick=()=>{const before=currentSnapshot(),i=+b.dataset.rhythmClear;if(confirm('¿Eliminar el patrón de batería de esta sección?')){pushUndoSnapshot(before);guide=cloneGuide(before);if(guide[i])guide[i].rhythm=null;rerenderGuide()}});
   const moveSection=(from,to)=>{
     const before=currentSnapshot();
     if(from<0||from>=before.length||to<0||to>=before.length||from===to){moveSelectedIndex=null;applyMoveSelectionUI();return}
     pushUndoSnapshot(before);
     guide=cloneGuide(before);
     const [item]=guide.splice(from,1);
     guide.splice(to,0,item);
     moveSelectedIndex=null;
     rerenderGuide('index',to);
     toast(`Sección colocada en la posición ${to+1}`);
   };
   const chooseMovePosition=i=>{
     if(moveSelectedIndex===null){moveSelectedIndex=i;applyMoveSelectionUI();toast('Sección seleccionada. Toca el lugar donde quieres colocarla.');return}
     if(moveSelectedIndex===i){moveSelectedIndex=null;applyMoveSelectionUI();toast('Movimiento cancelado');return}
     moveSection(moveSelectedIndex,i);
   };
   $$('[data-guide-move-select]').forEach(b=>b.onclick=e=>{e.stopPropagation();chooseMovePosition(+b.dataset.guideMoveSelect)});
   $$('.transcription-guide-block').forEach(block=>block.onclick=e=>{
     if(moveSelectedIndex===null)return;
     if(e.target.closest('button,input,select,textarea,label,a'))return;
     const i=+block.dataset.guideIndex;
     if(i!==moveSelectedIndex)moveSection(moveSelectedIndex,i);
   });
   applyMoveSelectionUI();
 };
 $('#addTranscribeBlock').onclick=()=>{moveSelectedIndex=null;const before=currentSnapshot();pushUndoSnapshot(before);guide=cloneGuide(before);guide.push({name:'',bars:'4',pattern:'',notes:'',rhythm:null,_collapsed:false});rerenderGuide('bottom')};
 $('#undoTranscribe').onclick=undo;
 $('#redoTranscribe').onclick=redo;
 $('#saveTranscribeStay').onclick=()=>persistCurrentTranscription();
 const keyHandler=e=>{if(!$('#modal')?.classList.contains('transcription-mode'))return;const mod=e.ctrlKey||e.metaKey;if(!mod)return;if(e.key.toLowerCase()==='s'){e.preventDefault();persistCurrentTranscription()}else if(e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undo()}else if(e.key.toLowerCase()==='y'||(e.key.toLowerCase()==='z'&&e.shiftKey)){e.preventDefault();redo()}};
 document.addEventListener('keydown',keyHandler);
 $('#modal').addEventListener('close',()=>document.removeEventListener('keydown',keyHandler),{once:true});
 const select=$('#transcribeMediaSelect');
 const choose=async id=>{song.mediaId=id||'';await saveDB(id?'Multimedia asociado a la canción':'Multimedia desvinculado');await renderTranscriptionPlayer(song,id)};
 select.onchange=e=>choose(e.target.value);
 $('#transcribeQuickFiles').onchange=async e=>{const ids=await addLocalMediaFiles(e.target.files||[]);e.target.value='';select.innerHTML=mediaOptions(ids[0]||song.mediaId);if(ids[0]){select.value=ids[0];await choose(ids[0])}};
 const ytForm=$('#transcribeYoutubeForm'),ytUrl=$('#transcribeYoutubeUrl');$('#transcribeYoutubeAdd').onclick=()=>{ytForm.classList.remove('hidden');setTimeout(()=>ytUrl.focus(),20)};$('#transcribeYoutubeCancel').onclick=()=>{ytUrl.value='';ytForm.classList.add('hidden')};$('#transcribeYoutubeConfirm').onclick=async()=>{const url=ytUrl.value.trim();if(!url){toast('Pega un enlace de YouTube');ytUrl.focus();return}const id=await addYoutubeMedia(url,song.title);if(id){select.innerHTML=mediaOptions(id);select.value=id;await choose(id);ytUrl.value='';ytForm.classList.add('hidden')}};ytUrl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#transcribeYoutubeConfirm').click()}});
 bindGuide();bindSectionNameControls($('#modalBody'));bindHistoryFields($('#guideBlocks'));applyMoveSelectionUI();updateHistoryButtons();bindTranscribeMetro(song);renderTranscriptionPlayer(song,song.mediaId)
}

function openModal(title,body,onSave,saveLabel='Guardar'){
 const modal=$('#modal'),form=$('#modalForm');$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modalSave').textContent=saveLabel;
 form.onsubmit=async e=>{e.preventDefault();const save=$('#modalSave');if(save.disabled)return;try{save.disabled=true;save.textContent='Guardando…';const ok=await onSave(new FormData(form));if(ok!==false)closeModal()}catch(err){console.error(err);toast('No se pudo guardar. Inténtalo de nuevo.')}finally{save.disabled=false;save.textContent=saveLabel}};
 $$('[data-modal-cancel]').forEach(b=>b.onclick=()=>closeModal());
 if(!modal.open)modal.showModal();
}
function closeModal(){stopTranscriptionMedia();const m=$('#modal');m.classList.remove('transcription-mode','media-library-mode');if(m.open)m.close();$('#modalForm').onsubmit=null}

async function restoreBackup(e){
 const file=e.target.files?.[0];if(!file)return;
 try{
  const data=JSON.parse(await file.text());
  if(!data||!Array.isArray(data.songs)||!Array.isArray(data.setlists))throw new Error('Formato no válido');
  if(!confirm(`¿Restaurar esta copia?\n\nCanciones: ${data.songs.length}\nSetlists: ${data.setlists.length}\n\nSustituirá los datos actuales de este dispositivo.`)){e.target.value='';return}
  state.db=repairDB(data);await saveDB('Copia restaurada');render();toast('Copia restaurada correctamente');
 }catch(err){alert('No se pudo restaurar la copia: '+err.message)}finally{e.target.value=''}
}

async function manualBackup(){
 if(STATIC_HOSTED||location.protocol==='file:'){downloadBackup();return}
 try{await api('/api/backup',{method:'POST',body:'{}'});toast('Copia de seguridad creada')}catch{downloadBackup()}
}
function downloadBackup(){
 const blob=new Blob([JSON.stringify(state.db,null,2)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='DrumGuide_backup_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast('Copia descargada en este dispositivo')
}


async function forceUpdateApp(){
 try{
  toast('Buscando actualización…');
  if('serviceWorker' in navigator){
   const regs=await navigator.serviceWorker.getRegistrations();
   await Promise.all(regs.map(r=>r.update().catch(()=>{})));
  }
  if('caches' in window){
   const keys=await caches.keys();
   await Promise.all(keys.filter(k=>k.startsWith('drumguide-')).map(k=>caches.delete(k)));
  }
  const u=new URL(location.href);u.searchParams.set('appv',APP_VERSION);u.searchParams.set('_',Date.now());
  location.replace(u.toString());
 }catch(e){location.reload()}
}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredInstall=e;$('#installBtn').hidden=false});$('#installBtn').onclick=async()=>{if(state.deferredInstall){state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$('#installBtn').hidden=true}};
if('serviceWorker'in navigator && location.protocol!=='file:'){navigator.serviceWorker.register('./sw.js?v='+APP_VERSION,{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!sessionStorage.getItem('dg_reloaded_'+APP_VERSION)){sessionStorage.setItem('dg_reloaded_'+APP_VERSION,'1');location.reload()}})}
(async()=>{await loadDB();render()})();
