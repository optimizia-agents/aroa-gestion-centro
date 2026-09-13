const centerRows = [];
const pendingRows = [];
const directoryRows = [];
let directoryHeaders = [];
let directoryLoaded = false;
let directoryLoading = false;
let directoryError = "";
let directoryLoadInFlight = null;
let directoryPage = 1;
const DIRECTORY_PAGE_SIZE = 100;
const DIRECTORY_COLLECTION = 'customerDirectoryChunks';
const DIRECTORY_META_COLLECTION = 'customerDirectoryMeta';
const DIRECTORY_CHUNK_SIZE = 50;
const KURRO_CACHE_KEY='kurro-remote-cache-v2';
const KURRO_CACHE_BACKUP_KEY='kurro-remote-cache-backup-v1';
const FIREBASE_CONFIG={apiKey:'AIzaSyDnKzXeRJPb3NVr--DbG44t1YyRMZyncPM',authDomain:'aroa-gestion-centro.firebaseapp.com',projectId:'aroa-gestion-centro',storageBucket:'aroa-gestion-centro.firebasestorage.app',messagingSenderId:'499180389940',appId:'1:499180389940:web:68c89efd9890b7c1ceac61'};
const FIREBASE_ALLOWED_EMAIL='optimizia.agents@gmail.com';
let firebaseDb=null,firebaseAuth=null,firebaseUser=null,firebaseWriteQueue=Promise.resolve();
function hasFirebaseSessionHint(){return Boolean(sessionStorage.getItem('aroa_firebase_id_token'))}

const $ = id => document.getElementById(id);
const MONTH_NAMES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function canonicalCategory(value){const key=String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');return key==='linea provisional hasta que se haga'||key==='línea provisional hasta que se haga'?'Línea provisional hasta que se haga':String(value||'').trim()}
function canonicalOwner(value){const raw=String(value||'').trim().replace(/\s+/g,' ');const key=raw.toLocaleLowerCase('es').replace(/\s*\/\s*/g,'/');if(key==='responsable centro'||key==='responsable del centro')return 'Responsable del centro';if(key==='sc/ehs')return 'SC / EHS';if(key==='sc/ehs (carla macedo)')return 'SC / EHS (Carla Macedo)';return raw}
function displayDate(value){const raw=String(value||'').trim().replace(/\s+VENCIDA$/i,'');if(!raw)return '';let m=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`;m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m)return`${m[3].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[1]}`;m=raw.match(/^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-záéíóú]*[-\s\/]?(\d{2}|\d{4})$/i);if(m){const month=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'].indexOf(m[1].slice(0,3).toLowerCase())+1;const year=m[2].length===2?'20'+m[2]:m[2];return`${MONTH_NAMES[month-1]} ${year}`}return raw}
document.body.classList.add('auth-locked');
function unlockPrivateApp(){document.body.classList.remove('auth-locked')}
function saveData(){try{const snapshot={center:centerRows.map(r=>({...r})),pending:pendingRows.map(r=>({...r})),updated:new Date().toISOString()};const current=localStorage.getItem(KURRO_CACHE_KEY);if(current)try{const parsed=JSON.parse(current);if((parsed.center?.length||parsed.pending?.length)&&JSON.stringify(parsed)!==JSON.stringify(snapshot))localStorage.setItem(KURRO_CACHE_BACKUP_KEY,current)}catch(e){}localStorage.setItem(KURRO_CACHE_KEY,JSON.stringify(snapshot))}catch(e){}}
function metric(label,value,note,alert=false){return `<div class="metric ${alert?'alert':''}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></div>`}
function statusTag(s){const label=s==='done'?'REALIZADO':s==='process'?'EN PROCESO':'PENDIENTE';return `<span class="status ${s==='done'?'done':s==='process'?'process':'open'}"><span class="status-dot"></span>${label}</span>`}
function addMonths(date, months){const d=new Date(date+'T12:00:00');const day=d.getDate();d.setMonth(d.getMonth()+months);if(d.getDate()!==day)d.setDate(0);return d}
function nextDate(date,frequency){const d=new Date(date+'T12:00:00');const f=(frequency||'').toLowerCase();if(f.includes('seman'))d.setDate(d.getDate()+7);else if(f.includes('bimes'))return addMonths(date,2);else if(f.includes('trimes'))return addMonths(date,3);else if(f.includes('semes'))return addMonths(date,6);else if(f.includes('mens'))return addMonths(date,1);else if(f.includes('5 años'))return addMonths(date,60);else if(f.includes('3 años'))return addMonths(date,36);else if(f.includes('año')||f.includes('anual'))return addMonths(date,12);else return null;return d}
function formatDate(d){return d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:''}
function normalizeSheetDate(value){const s=String(value||'').trim();let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`;m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);return m?`${m[3].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[1]}`:s}
function isOverdue(r){if(!r.next)return false;const p=r.next.split('/');const due=new Date(`${p[2]}-${p[1]}-${p[0]}T23:59:59`);return due<new Date()}
function dueTone(r){if(!r.next)return '';const p=r.next.split('/');const due=new Date(`${p[2]}-${p[1]}-${p[0]}T23:59:59`);const days=Math.ceil((due-new Date())/86400000);return days<0?'row-overdue':days<=30?'row-soon':'row-ok'}
function effectiveStatus(r){return isOverdue(r)&&r.status==='done'?'open':r.status}
function markCenterDone(index){const input=$(`done-date-${index}`);if(!input||!input.value){$('toast').textContent='Elige primero la fecha en la que se ha hecho';$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2800);return}const r=centerRows[index];if(isOverdue(r)){r.status='process';saveData();$('toast').textContent='Esta actividad está vencida y no puede marcarse como realizada. Déjala pendiente o en proceso.';$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),3600);renderCenter();return}r.last=formatDate(new Date(input.value+'T12:00:00'));const next=nextDate(input.value,r.frequency);r.next=formatDate(next);r.status='done';r.action='REALIZADO';saveData();renderCenter();$('toast').textContent=next?`Marcado como hecho. Próxima revisión: ${r.next}`:'Marcado como hecho. Esta actividad no tiene periodicidad calculable.';$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),3200)}
function updateCenterField(index,field,value){const r=centerRows[index];if(field==='status'&&value==='done'&&isOverdue(r)){r.status='process';$('toast').textContent='Una actividad vencida solo puede estar pendiente o en proceso';$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),3000);renderCenter();return}r[field]=value;saveData();}
function sortValue(r,key){if(key==='category')return r.category;if(key==='last')return r.last?new Date(r.last.split('/').reverse().join('-')):new Date(0);if(key==='next')return r.next?new Date(r.next.split('/').reverse().join('-')):new Date(8640000000000000);if(key==='frequency')return r.frequency||'zzzz';if(key==='status')return r.status;return r.activity}
function updatePendingField(index,field,value){pendingRows[index][field]=value;saveData()}
function markPendingDone(index){pendingRows[index].status='REALIZADO';pendingRows[index].updated=formatDate(new Date());saveData();renderPending()}
setTimeout(()=>renderPending(),0);

// Opciones ampliables para que los nuevos responsables y contactos sigan disponibles.
const KURRO_LISTS_KEY='kurro-lists-v1';
function savedKurroLists(){return structuredClone(remoteKurroLists)}
let remoteKurroLists={};
function mergedKurroLists(){const local={};const merged={};Object.keys({...local,...remoteKurroLists}).forEach(k=>{merged[k]=[...new Set([...(remoteKurroLists[k]||[]),...(local[k]||[])].map(v=>String(v||'').trim()).filter(Boolean))]});return merged}
function saveRemoteKurroLists(rows){const out={};(rows||[]).slice(1).forEach(row=>{const type=String(row[0]||'').trim().toLowerCase(),value=String(row[1]||'').trim(),active=String(row[2]||'TRUE').toUpperCase();if(type&&value&&active!=='FALSE') (out[type]||(out[type]=[])).push(value)});remoteKurroLists=out}
function saveKurroLists(lists){remoteKurroLists=structuredClone(lists)}
function kurroOptions(kind){const lists=mergedKurroLists(),source=kind==='owner'?centerRows.map(r=>r.owner):pendingRows.map(r=>r.person);return [...new Set([...(lists[kind]||[]),...source].map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function fillKurroSelect(id,values,current=''){const select=$(id);if(!select)return;const value=current||select.value;select.innerHTML=(id==='edit-owner'?'<option value="">Sin asignar</option>':'')+values.map(v=>`<option value="${String(v).replaceAll('&','&amp;').replaceAll('"','&quot;')}">${String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</option>`).join('');if(value&&values.includes(value))select.value=value}
function refreshKurroPeopleOptions(){fillKurroSelect('edit-owner',kurroOptions('owner'));fillKurroSelect('pending-edit-person',kurroOptions('person'))}
function addKurroOption(kind,selectId,label){const name=prompt(label);if(!name)return;const clean=name.trim();if(!clean)return;const lists=savedKurroLists();lists[kind]=[...(lists[kind]||[]),clean];saveKurroLists(lists);refreshKurroPeopleOptions();$(selectId).value=clean;showSyncToast(`${clean} añadido a la lista`)}
document.querySelector('#add-owner')?.addEventListener('click',()=>addKurroOption('owner','edit-owner','Escribe el nuevo responsable'));
document.querySelector('#add-pending-person')?.addEventListener('click',()=>addKurroOption('person','pending-edit-person','Escribe la nueva persona o empresa'));
const originalOpenCenterEditor=openCenterEditor;openCenterEditor=function(index){refreshKurroPeopleOptions();originalOpenCenterEditor(index)};
const originalOpenNewCenterEditor=openNewCenterEditor;openNewCenterEditor=function(){refreshKurroPeopleOptions();originalOpenNewCenterEditor()};
const originalOpenPendingEditor=openPendingEditor;openPendingEditor=function(index=-1){refreshKurroPeopleOptions();originalOpenPendingEditor(index)};
const originalSavePendingEditor=savePendingEditor;savePendingEditor=async function(){const person=$('pending-edit-person')?.value;const previous=window.person;const sourcePerson=previous==='Properval'?'Properval':'Miguel';window.kurroPendingSource=sourcePerson;await originalSavePendingEditor();window.person=previous;};
renderCenter();renderPending();

// La próxima revisión se calcula por defecto, pero admite una fecha manual.
const legacyOpenCenterEditor= openCenterEditor, legacyOpenNewCenterEditor=openNewCenterEditor;
openCenterEditor=function(index){legacyOpenCenterEditor(index);if($('edit-next'))$('edit-next').dataset.manual='true'};
openNewCenterEditor=function(){legacyOpenNewCenterEditor();if($('edit-next'))$('edit-next').dataset.manual='true'};
const legacyNextPreview=updateEditorNextPreview;
$('edit-next')?.addEventListener('input',()=>{$('edit-next').dataset.manual='true'});
function saveCenterEditorFlexible(){const index=centerEditorIndex,isNew=index===-1,r=isNew?{}:centerRows[index];if(!r)return;const frequency=$('edit-frequency').value==='custom'?$('edit-frequency-custom').value.trim():$('edit-frequency').value;const last=$('edit-last').value?dateFromEditor($('edit-last').value):'';const manualNext=$('edit-next').dataset.manual==='true';const calculated=last&&frequency?nextDate($('edit-last').value,frequency):null;const next=manualNext?($('edit-next').value?dateFromEditor($('edit-next').value):''):(calculated?formatDate(calculated):'');const changes={activity:$('edit-activity').value.trim(),category:$('edit-category').value.trim()||'Otros',frequency,last,next,owner:$('edit-owner').value.trim(),action:$('edit-action').value,status:$('edit-status').value};if(!changes.activity){showSyncToast('Escribe una actividad');return}if(changes.status==='done'&&!changes.last){showSyncToast('Para marcarla como realizada indica la fecha');return}const check={...r,next:changes.next,status:changes.status};if(changes.status==='done'&&isOverdue(check)){showSyncToast('Una actividad vencida solo puede estar pendiente o en proceso');return}const columns={activity:1,category:2,frequency:3,last:4,next:5,owner:7,action:10,status:12};if(isNew){r.serverRow=Math.max(1,...centerRows.map(row=>row.serverRow||1))+1;centerRows.push(r)}const requests=[];Object.entries(changes).forEach(([field,value])=>{if(!isNew&&r[field]===value)return;r[field]=value;if(r.serverRow)requests.push(kurroRequest({api:'updateCell',fileId:'1AiIsFZCyZVp4ERTi0ExreV10StjayEw9tLWv4W21foQ',sheetName:'Registro Maestro',row:r.serverRow,column:columns[field],value:field==='status'?(value==='done'?'REALIZADO':value==='process'?'EN PROCESO':'PENDIENTE'):value}))});saveData();renderCenter();closeCenterEditor();if(requests.length){showSyncToast(isNew?'Añadiendo acción…':'Guardando cambios…');remoteWrite(Promise.all(requests)).then(()=>loadRemoteData()).then(()=>showSyncToast(isNew?'Acción añadida':'Cambios guardados')).catch(()=>showSyncToast('No se pudo guardar el cambio'))}}
const saveButton=$('save-center-editor');if(saveButton){const replacement=saveButton.cloneNode(true);saveButton.replaceWith(replacement);replacement.addEventListener('click',saveCenterEditorFlexible)}
const frequencyField=$('edit-frequency');frequencyField?.addEventListener('change',()=>{$('edit-next').dataset.manual='false';legacyNextPreview()});$('edit-last')?.addEventListener('change',()=>{$('edit-next').dataset.manual='false';legacyNextPreview()});
function setCenterStatus(state){$('center-status').value=state;window.centerQuickFilter=null;renderCenter();if(typeof saveViewFilters==='function')saveViewFilters('center')}
function setCenterDateFilter(kind){window.centerQuickFilter=kind==='all'?null:kind;renderCenter();if(typeof saveViewFilters==='function')saveViewFilters('center')}

applyCenterQuickFilter=function(){const kind=window.centerQuickFilter;document.querySelectorAll('[data-center-state]').forEach(button=>{const active=button.dataset.centerState===($('center-status')?.value||'all');button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});const dateSelect=$('center-date-filter');if(dateSelect)dateSelect.value=kind||'all';if(!kind)return;const byActivity=new Map(centerRows.map(r=>[r.activity,r]));document.querySelectorAll('#center-table tr').forEach(row=>{const r=byActivity.get(row.children[0]?.textContent.trim());let show=true;if(r){if(kind==='overdue')show=isOverdue(r);else if(kind==='soon')show=!!r.next&&!isOverdue(r)&&((new Date(r.next.split('/').reverse().join('-')+'T23:59:59')-new Date())<=30*86400000);else if(kind==='nodate')show=!r.next;else if(kind==='dated')show=!!r.next}row.style.display=show?'':'none'});const visible=[...document.querySelectorAll('#center-table tr')].filter(r=>r.style.display!=='none').length;$('center-count').textContent=`${visible} registros`}
let pendingEditorIndex=-1;
function pendingDateForEditor(value){const p=String(value||'').split('/');return p.length===3?`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`:''}
function pendingDateFromEditor(value){const s=String(value||'').trim();if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s))return normalizeSheetDate(s);const p=s.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:''}
function localizeVisibleDateInputs(){document.querySelectorAll('input.pending-date[type="date"]').forEach(input=>{if(!input.value)return;const parts=input.value.split('-');if(parts.length!==3)return;input.type='text';input.value=`${parts[2]}/${parts[1]}/${parts[0]}`;input.placeholder='dd/mm/aaaa';input.inputMode='numeric';input.dataset.localized='true'})}
if(typeof MutationObserver!=='undefined'){new MutationObserver(localizeVisibleDateInputs).observe(document.body,{childList:true,subtree:true})}
function openPendingEditor(index=-1){pendingEditorIndex=index;$('pending-edit-text').value=index<0?'':pendingRows[index].text||'';$('pending-edit-person').value=index<0?(window.person==='Properval'?'Properval':'Miguel'):pendingRows[index].person;$('pending-edit-priority').value=index<0?'NORMAL':pendingRows[index].priority||'NORMAL';$('pending-edit-status').value=index<0?'PENDIENTE':pendingRows[index].status||'PENDIENTE';$('pending-edit-date').value=index<0?'':pendingDateForEditor(pendingRows[index].date);$('pending-edit-comments').value=index<0?'':pendingRows[index].comments||'';$('pending-editor-title').textContent=index<0?'Nuevo pendiente':'Editar pendiente';$('pending-editor').classList.add('open');$('pending-editor').setAttribute('aria-hidden','false')}
function closePendingEditor(){$('pending-editor').classList.remove('open');$('pending-editor').setAttribute('aria-hidden','true');pendingEditorIndex=-1}
async function savePendingEditor(){const text=$('pending-edit-text').value.trim();if(!text){showSyncToast('Escribe el pendiente');return}const person=$('pending-edit-person').value,priority=$('pending-edit-priority').value,status=$('pending-edit-status').value,date=$('pending-edit-date').value?pendingDateFromEditor($('pending-edit-date').value):'',comments=$('pending-edit-comments').value;const isNew=pendingEditorIndex<0;let r=isNew?{person,status,text,priority,date,updated:formatDate(new Date()),comments}:pendingRows[pendingEditorIndex];if(isNew){const fileId=KURRO_SOURCE_ID;r.fileId=fileId;r.serverRow=Math.max(1,...pendingRows.filter(x=>x.fileId===fileId).map(x=>x.serverRow||1))+1;pendingRows.push(r)}Object.assign(r,{person,status,text,priority,date,comments,updated:formatDate(new Date())});saveData();renderPending();closePendingEditor();showSyncToast(isNew?'Añadiendo pendiente…':'Guardando pendiente…');const fields={person,status,task:text,priority,target:date,updated:r.updated,comments};try{await remoteWrite(Promise.all(Object.entries(fields).map(([field,value])=>kurroRequest({api:'updatePending',fileId:r.fileId,row:r.serverRow,field,value}))));await loadRemoteData();showSyncToast(isNew?'Pendiente añadido':'Pendiente guardado')}catch(e){showSyncToast('No se pudo guardar el pendiente')}}
const basePendingFieldHandler=updatePendingField;updatePendingField=function(index,field,value){const r=pendingRows[index];if(!r)return;const serverField=field==='date'?'target':field;r[field]=value;if(field==='status'&&value==='REALIZADO')r.closed=formatDate(new Date());r.updated=formatDate(new Date());saveData();if(r.fileId&&r.serverRow){remoteWrite(Promise.all([kurroRequest({api:'updatePending',fileId:r.fileId,row:r.serverRow,field:serverField,value}),serverField!=='updated'?kurroRequest({api:'updatePending',fileId:r.fileId,row:r.serverRow,field:'updated',value:r.updated}):Promise.resolve()]).catch(()=>{}))}renderPending()};
function updateEditorNextPreview(){const date=$('edit-last')?.value,frequency=$('edit-frequency')?.value==='custom'?$('edit-frequency-custom')?.value:$('edit-frequency')?.value;const next=date&&frequency?nextDate(date,frequency):null;if($('edit-next'))$('edit-next').value=next?dateForEditor(formatDate(next)):''}
document.querySelector('[data-new-pending]')?.addEventListener('click',()=>openPendingEditor());document.querySelectorAll('[data-close-pending]').forEach(b=>b.addEventListener('click',closePendingEditor));$('save-pending-editor')?.addEventListener('click',savePendingEditor);$('edit-last')?.addEventListener('change',updateEditorNextPreview);$('edit-frequency')?.addEventListener('change',updateEditorNextPreview);$('edit-frequency-custom')?.addEventListener('input',updateEditorNextPreview);renderPending();
// Identificador conservado para los formularios de edición.
const KURRO_SOURCE_ID='firebase';
function setDataAlert(message){const alert=$('data-alert');if(!alert)return;alert.textContent=message;alert.hidden=!message}
function activateMetricCard(card,action){
  if(!card)return;
  card.classList.add('metric-action');
  card.setAttribute('role','button');
  card.setAttribute('tabindex','0');
  card.addEventListener('click',action);
  card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action()}});
}
function decorateActionableMetrics(){
  const pending=$('pending-metrics');
  if(pending&&!pending.dataset.decorated){
    pending.dataset.decorated='true';
    const cards=[...pending.children];
    activateMetricCard(cards[0],()=>{$('pending-status').value='PENDIENTE';renderPending()});
    activateMetricCard(cards[1],()=>{window.person='Miguel';document.querySelector('[data-person="Miguel"]')?.click()});
    activateMetricCard(cards[2],()=>{window.person='Properval';document.querySelector('[data-person="Properval"]')?.click()});
  }
  const clients=$('client-metrics');
  if(clients&&!clients.dataset.decorated){
    clients.dataset.decorated='true';
    const cards=[...clients.children];
  }
}
let kurroPendingWrites=0;
let kurroRefreshInFlight=false;
function remoteWrite(request){kurroPendingWrites++;return request.finally(()=>{kurroPendingWrites--})}
function reportRemoteWriteFailure(){if($('sync-label'))$('sync-label').textContent='Guardado local · pendiente de sincronizar';setDataAlert('El cambio está guardado en este dispositivo, pero todavía no se ha podido enviar a Firebase. Pulsa «Actualizar» cuando haya conexión.');showSyncToast('Guardado local; falta sincronizar con Firebase')}
function isEditingKURRO(){const active=document.activeElement;return active&&(['INPUT','TEXTAREA','SELECT'].includes(active.tagName)||active.isContentEditable)}
function showSyncToast(message){const toast=$('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');clearTimeout(window.kurroToastTimer);window.kurroToastTimer=setTimeout(()=>toast.classList.remove('show'),2200)}
// Mantiene abiertas las sesiones en otros equipos al día sin volver a depender de Google Sheets.
// El intervalo corto permite que un cambio guardado en Firebase aparezca normalmente en pocos segundos.
setInterval(()=>{if(document.visibilityState==='visible')refreshKURROFromFirebase(true)},5000);
window.addEventListener('focus',()=>refreshKURROFromFirebase(true));
document.querySelector('[data-refresh]')?.addEventListener('click',async()=>{const button=document.querySelector('[data-refresh]');button?.classList.add('busy');if($('sync-label'))$('sync-label').textContent='Actualizando…';const ok=await refreshKURROFromFirebase(false);button?.classList.remove('busy')});
const localUpdateCenterField=updateCenterField;updateCenterField=function(index,field,value){const r=centerRows[index];if(field==='status'&&value==='done'&&isOverdue(r)){r.status='process';renderCenter();return}r[field]=value;saveData();if(r.serverRow){const col=field==='owner'?7:field==='action'?10:field==='status'?12:null;if(col)remoteWrite(kurroRequest({api:'updateCell',fileId:'1AiIsFZCyZVp4ERTi0ExreV10StjayEw9tLWv4W21foQ',sheetName:'Registro Maestro',row:r.serverRow,column:col,value:field==='status'?(value==='done'?'REALIZADO':value==='process'?'EN PROCESO':'PENDIENTE'):value}).catch(reportRemoteWriteFailure))}renderCenter()};
let centerEditorIndex=null;
function dateForEditor(value){const p=String(value||'').split('/');return p.length===3?`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`:''}
function dateFromEditor(value){const p=String(value||'').split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:''}
function frequencyChoice(value){const f=String(value||'').toLowerCase();if(f.includes('seman'))return'Semanal';if(f.includes('bimes'))return'Bimestral';if(f.includes('trimes'))return'Trimestral';if(f.includes('semes'))return'Semestral';if(f.includes('mens'))return'Mensual';if(f.includes('5 años'))return'Cada 5 años';if(f.includes('3 años'))return'Cada 3 años';if(f.includes('anual')||f.includes('1 año'))return'Anual';if(f.includes('cuando aplique'))return'Cuando aplique';if(f.includes('cambio'))return'Según cambios';if(!f||f.includes('sin periodicidad')||f.includes('no periódica'))return'Sin periodicidad';return'custom'}
function openCenterEditor(index){const r=centerRows[index];if(!r)return;centerEditorIndex=index;[['activity',r.activity],['category',r.category],['owner',r.owner],['action',r.action]].forEach(([key,value])=>{const field=$(`edit-${key}`);if(field)field.value=value||''});const choice=frequencyChoice(r.frequency);$('edit-frequency').value=choice;$('edit-frequency-custom').value=choice==='custom'?(r.frequency||''):'';$('edit-frequency-custom').hidden=choice!=='custom';$('edit-last').value=dateForEditor(r.last);$('edit-next').value=dateForEditor(r.next);$('edit-status').value=effectiveStatus(r);$('delete-center-editor').hidden=false;$('editor-title').textContent=isOverdue(r)?'Registrar seguimiento':'Editar actividad';$('edit-last-label').textContent=isOverdue(r)?'Fecha de actuación':'Última revisión';$('save-center-editor').textContent=isOverdue(r)?'Guardar seguimiento':'Guardar cambios';$('center-editor').classList.add('open');$('center-editor').setAttribute('aria-hidden','false')}
function openNewCenterEditor(){centerEditorIndex=-1;[['activity',''],['category',''],['owner',''],['action','']].forEach(([key,value])=>{$(`edit-${key}`).value=value});$('edit-frequency').value='Sin periodicidad';$('edit-frequency-custom').value='';$('edit-frequency-custom').hidden=true;$('edit-last').value='';$('edit-next').value='';$('edit-status').value='open';$('delete-center-editor').hidden=true;$('editor-title').textContent='Nueva acción';$('edit-last-label').textContent='Última revisión';$('save-center-editor').textContent='Guardar cambios';$('center-editor').classList.add('open');$('center-editor').setAttribute('aria-hidden','false')}
function closeCenterEditor(){$('center-editor').classList.remove('open');$('center-editor').setAttribute('aria-hidden','true');centerEditorIndex=null}
document.querySelectorAll('[data-close-editor]').forEach(button=>button.addEventListener('click',closeCenterEditor));$('edit-frequency')?.addEventListener('change',()=>{$('edit-frequency-custom').hidden=$('edit-frequency').value!=='custom'});
async function deleteCenterEditor(){const index=centerEditorIndex,r=centerRows[index];if(!r||!r.serverRow||!confirm('¿Quieres eliminar esta actividad?'))return;const requests=[];for(let column=1;column<=12;column++)requests.push(kurroRequest({api:'updateCell',fileId:'1AiIsFZCyZVp4ERTi0ExreV10StjayEw9tLWv4W21foQ',sheetName:'Registro Maestro',row:r.serverRow,column,value:''}));try{await remoteWrite(Promise.all(requests));closeCenterEditor();await loadRemoteData();showSyncToast('Actividad eliminada')}catch(e){showSyncToast('No se pudo eliminar la actividad')}}
$('[data-new-center]')?.addEventListener('click',openNewCenterEditor);$('delete-center-editor')?.addEventListener('click',deleteCenterEditor);
const localMarkCenterDone=markCenterDone;markCenterDone=function(index){const r=centerRows[index],input=$(`done-date-${index}`);if(!input?.value||isOverdue(r)){localMarkCenterDone(index);return}if(r.serverRow)remoteWrite(kurroRequest({api:'markPlanningDone',row:r.serverRow,dateText:input.value})).then(()=>loadRemoteData()).catch(()=>{localMarkCenterDone(index);reportRemoteWriteFailure()});else localMarkCenterDone(index)};
const localUpdatePendingField=updatePendingField;updatePendingField=function(index,field,value){const r=pendingRows[index];r[field]=value;saveData();if(r.fileId&&r.serverRow){remoteWrite(kurroRequest({api:'updatePending',fileId:r.fileId,row:r.serverRow,field,value}).catch(reportRemoteWriteFailure))}renderPending()};
const localMarkPendingDone=markPendingDone;markPendingDone=function(index){const r=pendingRows[index];r.status='REALIZADO';r.updated=new Date().toLocaleDateString('es-ES');saveData();renderPending();if(r.fileId&&r.serverRow)remoteWrite(kurroRequest({api:'updatePending',fileId:r.fileId,row:r.serverRow,field:'status',value:'REALIZADO'})).then(()=>loadRemoteData()).catch(reportRemoteWriteFailure)};
const CLIENTS_FILE_ID=KURRO_SOURCE_ID;
let clientRows=[],clientEditorIndex=-1,clientsLoading=true;
function clientDateForEditor(v){const normalized=normalizeSheetDate(v),p=normalized.split('/');return p.length===3?p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0'):''}
function clientDateFromEditor(v){const s=String(v||'').trim();if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s))return normalizeSheetDate(s);const p=s.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:''}
function clientOptions(){const l=mergedKurroLists();return [...new Set([...(l.client||[]),...clientRows.map(r=>r.client)].map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function refreshClientOptions(){const s=$('client-edit-client');if(!s)return;const v=s.value;s.innerHTML='<option value="">Sin asignar</option>'+clientOptions().map(x=>'<option>'+x+'</option>').join('');if(v)s.value=v}
function saveClientData(){try{localStorage.setItem('kurro-clients-v1',JSON.stringify(clientRows))}catch(e){}}
function renderClientMetrics(){const open=clientRows.filter(r=>r.status!=='REALIZADO');$('client-metrics').innerHTML=metric('Pendientes activos',open.length,'Seguimiento con clientes',true)+metric('En proceso',open.filter(r=>r.status==='EN PROCESO').length,'Gestiones abiertas')+metric('Alta prioridad',open.filter(r=>r.priority==='ALTA').length,'Para atender')+metric('Con fecha objetivo',open.filter(r=>r.date).length,'Para organizar')}
function openClientEditor(i=-1){clientEditorIndex=i;const r=i<0?{}:clientRows[i];refreshClientOptions();$('client-edit-client').value=r.client||'';$('client-edit-contact').value=r.contact||'';$('client-edit-text').value=r.text||'';$('client-edit-priority').value=r.priority||'NORMAL';$('client-edit-status').value=r.status||'PENDIENTE';$('client-edit-date').value=clientDateForEditor(r.date);$('client-edit-comments').value=r.comments||'';$('client-editor-title').textContent=i<0?'Nuevo pendiente':'Editar pendiente';$('client-editor').classList.add('open');$('client-editor').setAttribute('aria-hidden','false')}
function closeClientEditor(){$('client-editor').classList.remove('open');$('client-editor').setAttribute('aria-hidden','true');clientEditorIndex=-1}
async function saveClientEditor(){const text=$('client-edit-text').value.trim();if(!text){showSyncToast('Escribe el pendiente');return}const n=clientEditorIndex<0,r=n?{}:clientRows[clientEditorIndex];Object.assign(r,{client:$('client-edit-client').value.trim(),contact:$('client-edit-contact').value.trim(),text,priority:$('client-edit-priority').value,status:$('client-edit-status').value,date:$('client-edit-date').value?clientDateFromEditor($('client-edit-date').value):'',updated:formatDate(new Date()),comments:$('client-edit-comments').value});if(n){r.serverRow=Math.max(1,...clientRows.map(x=>x.serverRow||1))+1;r.fileId=CLIENTS_FILE_ID;clientRows.push(r)}saveClientData();renderClients();closeClientEditor();showSyncToast(n?'Añadiendo pendiente…':'Guardando pendiente…');try{await remoteWrite(Promise.all(Object.entries({status:r.status,client:r.client,contact:r.contact,task:r.text,priority:r.priority,target:r.date,updated:r.updated,comments:r.comments}).map(([field,value])=>kurroRequest({api:'updateClient',fileId:CLIENTS_FILE_ID,row:r.serverRow,field,value}))));showSyncToast(n?'Pendiente añadido':'Pendiente guardado')}catch(e){showSyncToast('Guardado local; falta publicar la conexión de clientes')}}
document.querySelector('[data-new-client]')?.addEventListener('click',()=>openClientEditor());document.querySelectorAll('[data-close-client]').forEach(b=>b.addEventListener('click',closeClientEditor));$('save-client-editor')?.addEventListener('click',saveClientEditor);$('add-client-option')?.addEventListener('click',()=>{const v=prompt('Nombre del nuevo cliente');if(!v?.trim())return;const l=savedKurroLists();l.client=[...(l.client||[]),v.trim()];saveKurroLists(l);refreshClientOptions();$('client-edit-client').value=v.trim()});['client-search','client-priority','client-status'].forEach(id=>$(id)?.addEventListener('input',renderClients));refreshClientOptions();renderClients();

function htmlEscape(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
function directoryText(row){return row.map(v=>String(v??'').trim()).join(' ').toLocaleLowerCase('es')}
function directoryCanonicalRow(row){
  if(Array.isArray(row)&&row.length>=30)return row;
  // Compatibilidad segura con la primera carga antigua de 8 columnas.
  // Nunca reutilizamos su último campo como Riesgo visible.
  const legacy=Array.isArray(row)?row:[];const canonical=Array(30).fill('');
  canonical[0]=legacy[0]||'';canonical[4]=legacy[1]||'';canonical[27]=legacy[2]||'';
  canonical[10]=legacy[3]||'';canonical[9]=legacy[4]||'';canonical[6]=legacy[5]||'';
  canonical[17]=legacy[6]||'';return canonical;
}
function closeDirectoryDetail(){const modal=$('directory-detail-modal');if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}}
function openDirectoryDetail(index){const row=directoryCanonicalRow(directoryRows[Number(index)]);if(!row)return;const body=$('directory-detail-body');if(!body)return;body.innerHTML=directoryHeaders.map((header,i)=>`<div class="directory-detail-field"><span>${htmlEscape(header||`Campo ${i+1}`)}</span><strong>${htmlEscape(row[i]||'Sin dato')}</strong></div>`).join('');$('directory-detail-modal').classList.add('open');$('directory-detail-modal').setAttribute('aria-hidden','false')}
function renderDirectory(){
  const body=$('directory-body'); if(!body)return;
  const query=String($('directory-search')?.value||'').trim().toLocaleLowerCase('es');
  const rows=query?directoryRows.filter(row=>directoryText(row).includes(query)):directoryRows;
  if(!directoryLoaded&&!directoryRows.length){body.innerHTML='<tr><td colspan="10" class="empty">'+htmlEscape(directoryError||(directoryLoading?'Cargando directorio desde Firebase…':'El directorio se cargará al abrir esta vista.'))+'</td></tr>';$('directory-count').textContent=directoryLoading?'Cargando…':directoryError?'Error de carga':'Sin cargar';return}
  const pageCount=Math.max(1,Math.ceil(rows.length/DIRECTORY_PAGE_SIZE));
  directoryPage=Math.min(directoryPage,pageCount);
  const start=(directoryPage-1)*DIRECTORY_PAGE_SIZE;
  const visibleRows=rows.slice(start,start+DIRECTORY_PAGE_SIZE);
  body.innerHTML=visibleRows.length?visibleRows.map(row=>{const index=directoryRows.indexOf(row);const c=directoryCanonicalRow(row);return `<tr><td><strong>${htmlEscape(c[0])}</strong></td><td>${htmlEscape([c[4],c[5]].filter(Boolean).join(' '))}</td><td>${htmlEscape(c[27])}</td><td>${htmlEscape(c[10])}</td><td>${htmlEscape(c[9])}</td><td>${htmlEscape(c[8])}</td><td>${htmlEscape(c[3])}</td><td>${htmlEscape([c[6],c[7]].filter(Boolean).join(' '))}</td><td>${htmlEscape(c[17])}</td><td><button class="edit-btn directory-detail-button" data-directory-index="${index}">Ver ficha</button></td></tr>`}).join(''):`<tr><td colspan="10" class="empty">No hay clientes que coincidan con la búsqueda.</td></tr>`;
  $('directory-count').textContent=query?`${rows.length} resultados`:`${rows.length} clientes`;
  const pagination=$('directory-pagination');
  if(pagination){
    const first=rows.length?start+1:0,last=Math.min(start+DIRECTORY_PAGE_SIZE,rows.length);
    pagination.innerHTML=rows.length?`<span>Mostrando ${first}–${last} de ${rows.length}</span><div class="pagination-actions"><button class="secondary" data-directory-page="${directoryPage-1}" ${directoryPage<=1?'disabled':''}>Anterior</button><span class="pagination-page">Página ${directoryPage} de ${pageCount}</span><button class="secondary" data-directory-page="${directoryPage+1}" ${directoryPage>=pageCount?'disabled':''}>Siguiente</button></div>`:'';
    pagination.querySelectorAll('[data-directory-page]').forEach(button=>button.addEventListener('click',()=>{directoryPage=Number(button.dataset.directoryPage);renderDirectory()}));
  }
  if($('directory-source'))$('directory-source').textContent=directoryRows.length?`Directorio guardado en Firebase · ${directoryRows.length} clientes · solo lectura`:'Directorio guardado en Firebase · solo lectura';
  if($('directory-metrics'))$('directory-metrics').innerHTML=metric('Clientes cargados',directoryRows.length,'Directorio completo')+metric('Campos de búsqueda',directoryHeaders.length,'Se revisan todos')+metric('Resultados',rows.length,'Coincidencias actuales')+metric('Fuente','Firebase','Sin Google Sheets');
  document.querySelectorAll('.directory-detail-button').forEach(button=>button.addEventListener('click',()=>openDirectoryDetail(button.dataset.directoryIndex)));
}
async function restDirectoryGet(collection,docId){const r=await restFetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collection}/${docId}`);if(r.status===404)return null;if(!r.ok)throw new Error(`FIRESTORE_${collection}_${r.status}`);const doc=await r.json();return fsDecode({mapValue:{fields:doc.fields||{}}})}
async function restDirectoryWrite(collection,docId,value){const r=await restFetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collection}/${docId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,fsEncode(v)]))})});if(!r.ok)throw new Error(`FIRESTORE_WRITE_${collection}_${r.status}`)}
async function loadDirectoryFromFirebase(){
 if(!firebaseUser)return false;
 if(directoryLoaded)return true;
 if(directoryLoadInFlight)return directoryLoadInFlight;
 directoryLoading=true;directoryError='';renderDirectory();
 directoryLoadInFlight=(async()=>{
  try{
   const meta=await restDirectoryGet(DIRECTORY_META_COLLECTION,'main');
   if(!meta||!Number.isInteger(Number(meta.chunks))||Number(meta.chunks)<0)throw new Error('Directorio no disponible');
   const rows=[];
   for(let i=1;i<=Number(meta.chunks);i++){
    const value=await restDirectoryGet(DIRECTORY_COLLECTION,`chunk-${String(i).padStart(4,'0')}`);
    if(!value?.payload)throw new Error('Falta un bloque del directorio');
    const parsed=JSON.parse(value.payload);
    if(!Array.isArray(parsed))throw new Error('Bloque inválido');
    rows.push(...parsed);
   }
   directoryHeaders=Array.isArray(meta.headers)?meta.headers:[];
   directoryRows.splice(0,directoryRows.length,...rows);directoryLoaded=true;return true;
  }catch(error){directoryError='No se ha podido cargar el directorio completo. Pulsa Actualizar para reintentarlo.';return false}
  finally{directoryLoading=false;directoryLoadInFlight=null;renderDirectory()}
 })();return directoryLoadInFlight;
}
async function importDirectoryWorkbook(file){
  if(!firebaseUser){showSyncToast('Entra primero en el acceso privado');return}
  if(typeof XLSX==='undefined'){showSyncToast('No se puede leer el Excel en este momento');return}
  const buffer=await file.arrayBuffer();const workbook=XLSX.read(buffer,{type:'array',cellDates:false});const sheet=workbook.Sheets[workbook.SheetNames[0]];const values=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});const headers=(values.shift()||[]).map(v=>String(v??'').trim());const rows=values.filter(row=>row.some(v=>String(v??'').trim())).map(row=>headers.map((_,i)=>String(row[i]??'').trim()));
  if(headers.length!==30||rows.length<1){showSyncToast('El Excel no tiene la estructura esperada');return}
  const sameHeaders=directoryHeaders.length===headers.length&&headers.every((header,index)=>header===directoryHeaders[index]);
  const currentKeys=new Set(directoryRows.map(row=>String(row?.[0]??'').trim()).filter(Boolean));
  const importedKeys=new Set(rows.map(row=>String(row?.[0]??'').trim()).filter(Boolean));
  const nuevos=[...importedKeys].filter(key=>!currentKeys.has(key)).length;
  const ausentes=[...currentKeys].filter(key=>!importedKeys.has(key)).length;
  const resumen=`Archivo: ${file.name}\nClientes en el archivo: ${rows.length}\nClientes nuevos: ${nuevos}\nClientes que ya no aparecen: ${ausentes}\nEstructura de columnas: ${sameHeaders?'igual':'diferente'}\n\n¿Quieres importar este archivo y convertirlo en la nueva copia de Firebase?`;
  if(!window.confirm(resumen)){showSyncToast('Importación cancelada. Se mantienen los datos actuales.');return}
  const button=$('directory-import-button');button?.classList.add('busy');showSyncToast(`Cargando ${rows.length} clientes en Firebase…`);
  try{
    const chunks=[];for(let i=0;i<rows.length;i+=DIRECTORY_CHUNK_SIZE)chunks.push(rows.slice(i,i+DIRECTORY_CHUNK_SIZE));
    await Promise.all(chunks.map((chunk,index)=>{const value={payload:JSON.stringify(chunk)};return firebaseDb?firebaseDb.collection(DIRECTORY_COLLECTION).doc(`chunk-${String(index+1).padStart(4,'0')}`).set(value,{merge:false}):restDirectoryWrite(DIRECTORY_COLLECTION,`chunk-${String(index+1).padStart(4,'0')}`,value)}));
    await (firebaseDb?firebaseDb.collection(DIRECTORY_META_COLLECTION).doc('main').set({headers,count:rows.length,chunks:chunks.length,updated:new Date().toISOString()},{merge:false}):restDirectoryWrite(DIRECTORY_META_COLLECTION,'main',{headers,count:rows.length,chunks:chunks.length,updated:new Date().toISOString()}));
    directoryHeaders=headers;directoryRows.splice(0,directoryRows.length,...rows);directoryLoaded=true;renderDirectory();markSyncSuccess('Firebase');showSyncToast(`Directorio cargado: ${rows.length} clientes`);
  }catch(error){markSyncFailure();showSyncToast('No se pudo completar la carga. El directorio anterior se conserva.');console.warn('Error importando directorio',error)}finally{button?.classList.remove('busy')}
}
document.querySelector('#directory-import-button')?.addEventListener('click',()=>{if(!firebaseUser){openFirebaseAuth();return}$('directory-file')?.click()});$('directory-file')?.addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importDirectoryWorkbook(file);event.target.value=''});$('directory-search')?.addEventListener('input',()=>{directoryPage=1;renderDirectory()});$('directory-clear')?.addEventListener('click',()=>{$('directory-search').value='';directoryPage=1;renderDirectory()});$('directory-detail-close')?.addEventListener('click',closeDirectoryDetail);$('directory-detail-cancel')?.addEventListener('click',closeDirectoryDetail);
async function deleteClientEditor(){const i=clientEditorIndex,r=clientRows[i];if(!r||!confirm('¿Quieres eliminar este pendiente?'))return;clientRows.splice(i,1);saveClientData();closeClientEditor();renderClients();if(r.serverRow){try{await remoteWrite(Promise.all(['status','client','contact','task','priority','target','updated','comments','closed'].map(field=>kurroRequest({api:'updateClient',fileId:CLIENTS_FILE_ID,row:r.serverRow,field,value:''}))))}catch(e){showSyncToast('Eliminado en esta vista; falta publicar la conexión')}}showSyncToast('Pendiente eliminado')}
$('delete-client-editor')?.addEventListener('click',deleteClientEditor);

const openClientEditorWithConsistentCopy=openClientEditor;
openClientEditor=function(index=-1){openClientEditorWithConsistentCopy(index);$('client-editor-title').textContent=index<0?'Nueva gestión':'Editar gestión';$('save-client-editor').textContent='Guardar gestión'};
// Vista estable de Gestiones de clientes: filtros dinámicos y edición siempre visible.
var clientFilterValue='all';
function ensureClientControls(){
  const view=$('clients-view'),toolbar=view?.querySelector('.toolbar');
  if(!view||!toolbar)return;
  const metrics=$('client-metrics');
  if(metrics){metrics.hidden=true;metrics.innerHTML=''}
  view.querySelectorAll('.panel-heading p').forEach(node=>{if(/^Fuente:/i.test(node.textContent||''))node.remove()});
  let clientSelect=$('client-filter-client');
  if(!clientSelect){clientSelect=document.createElement('select');clientSelect.id='client-filter-client';clientSelect.setAttribute('aria-label','Cliente');toolbar.insertBefore(clientSelect,$('client-priority')||null)}
  const status=$('client-status');
  if(status){const value=status.value||'all';status.innerHTML='<option value="all">Todos los estados</option><option value="PENDIENTE">Pendientes</option><option value="EN PROCESO">En proceso</option><option value="REALIZADO">Realizadas</option>';status.value=['all','PENDIENTE','EN PROCESO','REALIZADO'].includes(value)?value:'all'}
  if(!toolbar.querySelector('[data-client-reset]')){const button=document.createElement('button');button.type='button';button.className='secondary filter-reset';button.dataset.clientReset='true';button.textContent='Limpiar filtros';button.addEventListener('click',resetClientFilters);toolbar.appendChild(button)}
}
function refreshClientFilterSelect(){
  const select=$('client-filter-client');if(!select)return;
  const values=[...new Set(clientRows.map(row=>String(row.client||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  select.innerHTML='<option value="all">Todos los clientes</option>'+values.map(value=>`<option value="${htmlEscape(value)}">${htmlEscape(value)}</option>`).join('');
  if(!values.includes(clientFilterValue))clientFilterValue='all';
  select.value=clientFilterValue;
}
function renderClients(){
  ensureClientControls();
  const selected=$('client-filter-client')?.value||'all';
  clientFilterValue=selected;refreshClientFilterSelect();
  const table=$('client-table');if(!table)return;
  const q=String($('client-search')?.value||'').trim().toLocaleLowerCase('es');
  const client=$('client-filter-client')?.value||clientFilterValue||'all';
  const priority=$('client-priority')?.value||'all';
  const status=$('client-status')?.value||'all';
  clientFilterValue=client;
  if(clientsLoading&&!clientRows.length){table.innerHTML='<tr><td colspan="9" class="empty">Cargando gestiones reales desde Firebase…</td></tr>';if($('client-count'))$('client-count').textContent='Cargando…';return}
  const rows=clientRows.filter(row=>(client==='all'||String(row.client||'')===client)&&(priority==='all'||row.priority===priority)&&(status==='all'||row.status===status)&&[row.client,row.contact,row.text,row.priority,row.status,row.comments].join(' ').toLocaleLowerCase('es').includes(q));
  table.innerHTML=rows.length?rows.map(row=>{
    const index=clientRows.indexOf(row);
    const statusHtml=row.status==='REALIZADO'?'<span class="status done">REALIZADO</span>':row.status==='EN PROCESO'?'<span class="status process">EN PROCESO</span>':'<span class="status open"><span class="status-dot"></span>PENDIENTE</span>';
    return `<tr><td>${statusHtml}</td><td><strong>${htmlEscape(row.client||'Sin asignar')}</strong></td><td>${htmlEscape(row.contact||'Sin contacto')}</td><td>${htmlEscape(row.text||'')}</td><td><span class="priority">${htmlEscape(row.priority||'NORMAL')}</span></td><td class="date">${htmlEscape(row.date||'Sin fecha')}</td><td class="date">${htmlEscape(row.updated||'Sin fecha')}</td><td>${htmlEscape(row.comments||'Sin comentarios')}</td><td><button type="button" class="edit-btn" onclick="openClientEditor(${index})">Editar</button></td></tr>`;
  }).join(''):'<tr><td colspan="9" class="empty">No hay gestiones con estos filtros. Pulsa «Nueva gestión» para añadir la primera.</td></tr>';
  if($('client-heading'))$('client-heading').textContent=client==='all'?'Todas las gestiones':`Gestiones con ${htmlEscape(client)}`;
  if($('client-count'))$('client-count').textContent=`${rows.length} registros`;
}
function resetClientFilters(){
  clientFilterValue='all';
  if($('client-search'))$('client-search').value='';
  if($('client-filter-client'))$('client-filter-client').value='all';
  if($('client-priority'))$('client-priority').value='all';
  if($('client-status'))$('client-status').value='all';
  renderClients();
  if(typeof saveViewFilters==='function')saveViewFilters('clients');
}

// Conserva la configuración de cada vista al navegar por la aplicación.
const VIEW_FILTERS_KEY='kurro-view-filters-v2';
const VIEW_FILTER_FIELDS={
  center:['center-search','center-category'],
  pending:['pending-search','pending-priority','pending-status'],
  clients:['client-search','client-priority','client-status']
};
function readViewFilters(){try{return JSON.parse(localStorage.getItem(VIEW_FILTERS_KEY)||'{}')}catch(e){return {}}}
function saveViewFilters(view){
  const fields=VIEW_FILTER_FIELDS[view]; if(!fields)return;
  const all=readViewFilters(); all[view]=Object.fromEntries(fields.map(id=>[id,$(id)?.value||'']));
  try{localStorage.setItem(VIEW_FILTERS_KEY,JSON.stringify(all))}catch(e){}
}
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>{
  const titles={center:'Control del centro',pending:'Seguimientos',clients:'Gestiones de clientes',directory:'Directorio'};
  if($('page-title'))$('page-title').textContent=titles[button.dataset.view]||'Centro';
}));

// Firebase es la única fuente de datos.
function firebaseAuthMessage(text){const node=$('firebase-auth-message');if(node)node.textContent=text||''}
function openFirebaseAuth(){const modal=$('firebase-auth');if(modal){modal.classList.add('open');$('firebase-password')?.focus()}}
function closeFirebaseAuth(force=false){if(document.body.classList.contains('auth-locked')&&!force)return;$('firebase-auth')?.classList.remove('open');firebaseAuthMessage('')}
function setFirebaseAuthBusy(busy,mode){const modal=$('firebase-auth');if(modal)modal.setAttribute('aria-busy',busy?'true':'false');['firebase-auth-login','firebase-auth-create'].forEach(id=>{const button=$(id);if(!button)return;if(!button.dataset.defaultText)button.dataset.defaultText=button.textContent;button.disabled=busy;if(busy&&((mode==='create'&&id==='firebase-auth-create')||(mode!=='create'&&id==='firebase-auth-login'))){button.classList.add('is-loading');button.innerHTML=`<span class="auth-spinner" aria-hidden="true"></span>${mode==='create'?'Creando…':'Entrando…'}`}else{button.classList.remove('is-loading');button.textContent=button.dataset.defaultText}});const password=$('firebase-password');if(password)password.disabled=busy}
// Firebase REST fallback: algunos navegadores bloquean las librerías CDN de Firebase.
// La aplicación puede autenticarse y leer/escribir Firestore sin depender de ellas.
// La sesión se mantiene solo en memoria: cada nueva entrada exige la contraseña.
let restIdToken='',restRefreshToken='';
function saveRestSession(){try{sessionStorage.setItem('aroa_firebase_id_token',restIdToken);sessionStorage.setItem('aroa_firebase_refresh_token',restRefreshToken)}catch(error){}}
function restoreRestSession(){try{restIdToken=sessionStorage.getItem('aroa_firebase_id_token')||'';restRefreshToken=sessionStorage.getItem('aroa_firebase_refresh_token')||''}catch(error){}}
function clearRestSession(){try{sessionStorage.removeItem('aroa_firebase_id_token');sessionStorage.removeItem('aroa_firebase_refresh_token')}catch(error){}restIdToken='';restRefreshToken=''}
restoreRestSession();
function fsEncode(value){if(value===null)return{nullValue:null};if(typeof value==='boolean')return{booleanValue:value};if(typeof value==='number')return{doubleValue:value};if(typeof value==='string')return{stringValue:value};if(Array.isArray(value))return{arrayValue:{values:value.map(fsEncode)}};if(typeof value==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,fsEncode(v)]))}};return{nullValue:null}}
function fsDecode(value){if(!value)return null;if('nullValue'in value)return null;if('booleanValue'in value)return value.booleanValue;if('integerValue'in value)return Number(value.integerValue);if('doubleValue'in value)return value.doubleValue;if('stringValue'in value)return value.stringValue;if('timestampValue'in value)return value.timestampValue;if('arrayValue'in value)return(value.arrayValue.values||[]).map(fsDecode);if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,fsDecode(v)]));return null}
async function restAuth(mode,password){const endpoint=mode==='create'?'accounts:signUp':'accounts:signInWithPassword';const response=await fetch('https://identitytoolkit.googleapis.com/v1/'+endpoint+'?key='+FIREBASE_CONFIG.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:FIREBASE_ALLOWED_EMAIL,password,returnSecureToken:true})});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error?.message||'AUTH_ERROR'),{code:data.error?.message});restIdToken=data.idToken;restRefreshToken=data.refreshToken;saveRestSession();return data}
let restRefreshInFlight=null;
async function refreshRestSession(){if(!restRefreshToken)throw new Error('FIREBASE_SESSION_EXPIRED');if(restRefreshInFlight)return restRefreshInFlight;restRefreshInFlight=(async()=>{const response=await fetch('https://securetoken.googleapis.com/v1/token?key='+FIREBASE_CONFIG.apiKey,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(restRefreshToken)});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error?.message||'TOKEN_REFRESH_ERROR'),{code:data.error?.message});restIdToken=data.id_token;restRefreshToken=data.refresh_token||restRefreshToken;saveRestSession();return data})().finally(()=>{restRefreshInFlight=null});return restRefreshInFlight}
async function restFetch(url,options={},retry=true){const headers={...(options.headers||{}),Authorization:'Bearer '+restIdToken};const response=await fetch(url,{...options,headers});if(response.status===401&&retry&&restRefreshToken){await refreshRestSession();return restFetch(url,options,false)}return response}
async function restDocGet(){return restRead()}
async function restRead(){let lastError=null;for(let attempt=0;attempt<3;attempt++){try{const r=await restFetch('https://firestore.googleapis.com/v1/projects/'+FIREBASE_CONFIG.projectId+'/databases/(default)/documents/appState/main');if(r.status===404)return null;if(!r.ok){const error=new Error(r.status===429?'FIREBASE_QUOTA_EXCEEDED':'FIRESTORE_GET_'+r.status);if(r.status===429||![408,500,502,503,504].includes(r.status))throw error;lastError=error}else{const doc=await r.json();return fsDecode({mapValue:{fields:doc.fields||{}}})}}catch(error){lastError=error;if(!String(error.message||'').startsWith('FIRESTORE_GET_'))throw error;if(attempt===2)throw error}if(attempt<2)await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)))}throw lastError||new Error('FIRESTORE_GET_ERROR')}
async function restWrite(value){const r=await restFetch('https://firestore.googleapis.com/v1/projects/'+FIREBASE_CONFIG.projectId+'/databases/(default)/documents/appState/main',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,fsEncode(v)]))})});if(!r.ok)throw new Error('FIRESTORE_WRITE_'+r.status)}
async function submitFirebaseRest(mode){const password=$('firebase-password')?.value||'';if(password.length<6){firebaseAuthMessage('La contraseña debe tener al menos 6 caracteres.');return}setFirebaseAuthBusy(true,mode);try{firebaseAuthMessage(mode==='create'?'Creando tu acceso…':'Entrando…');await restAuth(mode,password);closeFirebaseAuth(true);await finishFirebaseRest()}catch(error){const code=String(error.code||error.message||'');firebaseAuthMessage(code.includes('FIREBASE_QUOTA_EXCEEDED')?'Firebase ha alcanzado el límite diario. Los datos reales volverán a estar disponibles cuando se restablezca el servicio.':code.includes('EMAIL_EXISTS')?'Ese acceso ya existe. Pulsa Entrar.':code.includes('INVALID_PASSWORD')||code.includes('EMAIL_NOT_FOUND')||code.includes('INVALID_LOGIN_CREDENTIALS')?'La contraseña no es correcta o el acceso aún no existe.':code.includes('INVALID_API_KEY')?'La clave de Firebase no está autorizada para esta web.':code.includes('OPERATION_NOT_ALLOWED')?'El acceso por correo y contraseña no está habilitado.':'No se ha podido completar el acceso: '+(code||'error de conexión'))}finally{setFirebaseAuthBusy(false,mode)}}
function addFirebaseRestUI(){if($('firebase-auth'))return;document.body.insertAdjacentHTML('beforeend',`<div id="firebase-auth" class="modal" aria-hidden="true"><div class="modal-card pending-editor-card" role="dialog" aria-modal="true"><div class="modal-heading"><div><p class="eyebrow">ACCESO PRIVADO</p><h2>Entrar en Aroa Gestión</h2></div><button class="modal-close" type="button" aria-label="Cerrar" id="firebase-auth-close">×</button></div><p class="pending-editor-note">Usa el acceso de Optimizia para abrir y guardar tus datos en Firebase.</p><label class="editor-grid" style="display:grid;gap:6px;color:#557078;font-size:13px;font-weight:700">Correo electrónico<input value="${FIREBASE_ALLOWED_EMAIL}" disabled></label><label style="display:grid;gap:6px;margin-top:14px;color:#557078;font-size:13px;font-weight:700">Contraseña<input id="firebase-password" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres"></label><p id="firebase-auth-message" class="pending-editor-note" aria-live="polite"></p><div class="modal-actions"><button class="secondary" type="button" id="firebase-auth-cancel">Cancelar</button><button class="secondary" type="button" id="firebase-auth-create">Crear mi acceso</button><button class="primary" type="button" id="firebase-auth-login">Entrar</button></div></div></div>`);$('firebase-auth-close').addEventListener('click',closeFirebaseAuth);$('firebase-auth-cancel').addEventListener('click',closeFirebaseAuth);$('firebase-auth-login').addEventListener('click',()=>submitFirebaseRest('login'));$('firebase-auth-create').addEventListener('click',()=>submitFirebaseRest('create'));$('firebase-password').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('firebase-auth-login').click()}});const top=document.querySelector('.top-actions');if(top&&!$('firebase-auth-open')){const button=document.createElement('button');button.id='firebase-auth-open';button.className='refresh-button';button.textContent='Acceso privado';button.addEventListener('click',openFirebaseAuth);top.insertBefore(button,top.firstChild)}}
async function finishFirebaseRest(){
  firebaseUser={email:FIREBASE_ALLOWED_EMAIL};
  const ok=await loadRemoteData();
  if(ok){closeFirebaseAuth(true);unlockPrivateApp()}
  else{firebaseUser=null;document.body.classList.add('auth-locked');firebaseAuthMessage('No se han podido cargar los datos de Firebase. Pulsa Entrar para reintentarlo.');openFirebaseAuth()}
}
async function startFirebaseRest(){addFirebaseRestUI();if(restRefreshToken){try{await refreshRestSession();await finishFirebaseRest();return}catch(error){clearRestSession()}}openFirebaseAuth()}


// Descarga una copia de trabajo con los datos que están visibles tras la última sincronización.
// El botón exige sesión para evitar exportar una copia privada por accidente.
function exportCurrentWorkbook(){
  if(!firebaseUser){
    showSyncToast('Inicia sesión para descargar la copia actualizada');
    openFirebaseAuth();
    return;
  }
  if(kurroPendingWrites){
    showSyncToast('Espera a que termine el guardado');
    return;
  }
  if(typeof XLSX==='undefined'){
    showSyncToast('No se ha podido preparar el Excel. Comprueba la conexión y vuelve a intentarlo');
    return;
  }
  const statusLabel=value=>value==='done'?'REALIZADO':value==='process'?'EN PROCESO':'PENDIENTE';
  const center=[['Actividad','Categoría','Periodicidad','Última revisión','Próxima revisión','Responsable','Estado','Siguiente acción / comentarios'],...centerRows.map(r=>[r.activity||'',r.category||'',r.frequency||'',r.last||'',r.next||'',r.owner||'',statusLabel(effectiveStatus(r)),r.action||''])];
  const pending=[['Estado','Pendiente / decisión','Persona o empresa','Prioridad','Fecha objetivo','Actualización','Comentarios'],...pendingRows.map(r=>[r.status||'PENDIENTE',r.text||'',r.person||'',r.priority||'NORMAL',r.date||'',r.updated||'',r.comments||''])];
  const clients=[['Estado','Cliente','Contacto','Pendiente / decisión','Prioridad','Fecha objetivo','Actualización','Comentarios'],...clientRows.map(r=>[r.status||'PENDIENTE',r.client||'',r.contact||'',r.text||'',r.priority||'NORMAL',r.date||'',r.updated||'',r.comments||''])];
  const directory=[directoryHeaders.length?directoryHeaders:['Customer','Search term 1','Search term 2','Plnt','Name 1','Name 2','Street','Calle 4','Código postal','City','Teléfono','Sold-to','Ship-to','Payer','Bill-to','MSDS','ZP Primary Sales Person','Name of Primary Sales Person','Sec.Sales Person','ZS Name of Sec. Sales Person','Global Acc Manager','ZG Name of Global Acct Mgr','Accouts Receivable','ZR Name of Accounts Receivable','Cust.Service Rep','AGENTE/PLANTA Name of Customer Service Rep','Cust Risk','N.I.F. comunitario','Ord Block Description','Incoterms'],...directoryRows];
  const workbook=XLSX.utils.book_new();
  [
    ['Centro',center],
    ['Mis pendientes',pending],
    ['Pendientes clientes',clients],
    ['Directorio clientes',directory]
  ].forEach(([name,rows])=>{
    const sheet=XLSX.utils.aoa_to_sheet(rows);
    sheet['!freeze']={xSplit:0,ySplit:1};
    sheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(rows.length-1,0),c:rows[0].length-1}})};
    sheet['!cols']=rows[0].map((header,index)=>({wch:Math.min(Math.max(String(header).length+3,...rows.slice(1,Math.min(rows.length,20)).map(row=>String(row[index]||'').length+1)),42)}));
    XLSX.utils.book_append_sheet(workbook,sheet,name);
  });
  const stamp=new Date().toISOString().slice(0,10);
  XLSX.writeFile(workbook,`Aroa_Gestion_Fuenlabrada_${stamp}.xlsx`);
  showSyncToast('Copia Excel descargada');
}
document.querySelector('#download-workbook')?.addEventListener('click',exportCurrentWorkbook);

// Estado de sincronización visible y verificable para evitar trabajar con una copia antigua.
let lastSuccessfulSyncAt=null;
function markSyncSuccess(source='Firebase'){
  lastSuccessfulSyncAt=new Date();
  const time=lastSuccessfulSyncAt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  if($('sync-label'))$('sync-label').textContent=`${source} · sincronizado`;
  if($('top-sync-time'))$('top-sync-time').textContent=`Última comprobación: ${time}`;
  if($('sync-time'))$('sync-time').textContent=`Última comprobación: ${time}`;
}
function markSyncFailure(){
  if($('sync-label'))$('sync-label').textContent='Firebase · revisar conexión';
  if($('top-sync-time'))$('top-sync-time').textContent='No se ha confirmado el último guardado';
  if($('sync-time'))$('sync-time').textContent='No se ha confirmado el último guardado';
}
function renderSimpleCenterSummary(){const panel=$('center-metrics');if(!panel)return;const overdue=centerRows.filter(isOverdue).length,soon=centerRows.filter(r=>dueTone(r)==='row-soon').length;panel.innerHTML=metric('Vencidas',overdue,'Revisiones fuera de plazo',true)+metric('Próximas',soon,'Dentro de 30 días')}
function setCenterView(value){if(['all','open','process','done'].includes(value)){$('center-status').value=value;window.centerQuickFilter=null}else{$('center-status').value='all';window.centerQuickFilter=value==='all'?null:value}renderCenter();if(typeof saveViewFilters==='function')saveViewFilters('center')}
function simplifyCenterLegacyDom(){const oldPanel=$('attention-panel');if(oldPanel)oldPanel.remove();const status=$('center-status');if(!status)return;status.classList.add('status-source');let mode=$('center-view-mode');if(!mode){mode=document.createElement('select');mode.id='center-view-mode';mode.setAttribute('aria-label','Qué quieres ver');mode.innerHTML='<option value="all">Qué quieres ver: Todas</option><option value="overdue">Vencidas</option><option value="soon">Próximas</option><option value="open">Pendientes</option><option value="process">En proceso</option><option value="done">Realizadas</option><option value="nodate">Sin fecha</option>';mode.addEventListener('change',()=>setCenterView(mode.value));status.parentNode.insertBefore(mode,status)}let dates=$('center-date-filter');if(!dates){dates=document.createElement('select');dates.id='center-date-filter';dates.className='status-source';dates.innerHTML='<option value="all">Todas las fechas</option><option value="overdue">Vencidas</option><option value="soon">Próximas</option><option value="dated">Con fecha</option><option value="nodate">Sin fecha</option>';status.parentNode.insertBefore(dates,status)}dates.classList.add('status-source');const style=document.createElement('style');style.textContent='.status-source{position:absolute!important;opacity:0!important;width:1px!important;height:1px!important;pointer-events:none!important}.metric-grid{grid-template-columns:repeat(2,1fr)!important}@media(max-width:620px){.metric-grid{grid-template-columns:1fr!important}}';document.head.appendChild(style);renderSimpleCenterSummary()}
simplifyCenterLegacyDom();
function separateCenterFilters(){const mode=$('center-view-mode');if(mode)mode.remove();const status=$('center-status');if(status){status.classList.remove('status-source');status.setAttribute('aria-label','Estado');status.innerHTML='<option value="all">Estado: Todos</option><option value="open">Estado: Pendientes</option><option value="process">Estado: En proceso</option><option value="done">Estado: Realizadas</option>';status.value='all'}let dates=$('center-date-filter');if(!dates){dates=document.createElement('select');dates.id='center-date-filter';dates.innerHTML='<option value="all">Fecha: Todas</option><option value="overdue">Fecha: Vencidas</option><option value="soon">Fecha: Próximas</option><option value="nodate">Fecha: Sin fecha</option>';status?.parentNode?.insertBefore(dates,status)}dates.classList.remove('status-source');dates.setAttribute('aria-label','Fecha');dates.onchange=()=>setCenterDateFilter(dates.value);if(status)status.onchange=()=>{window.centerQuickFilter=null;renderCenter();if(typeof saveViewFilters==='function')saveViewFilters('center')};const style=document.createElement('style');style.textContent='.status-source{position:absolute!important;opacity:0!important;width:1px!important;height:1px!important;pointer-events:none!important}.metric-grid{grid-template-columns:repeat(2,1fr)!important}@media(max-width:620px){.metric-grid{grid-template-columns:1fr!important}}';document.head.appendChild(style);renderSimpleCenterSummary()}
separateCenterFilters();
// Conserva la categoría elegida aunque la vista se redibuje al sincronizar o filtrar.

document.querySelector('#pending-metrics')?.remove();
function ensurePendingControls(){const view=$('pending-view'),toolbar=view?.querySelector('.toolbar');if(!view||!toolbar)return;const peopleTabs=$('people-tabs');if(peopleTabs){peopleTabs.hidden=true;peopleTabs.setAttribute('aria-hidden','true');peopleTabs.innerHTML=''}let person=$('pending-person');if(!person){person=document.createElement('select');person.id='pending-person';person.setAttribute('aria-label','Persona o empresa');toolbar.insertBefore(person,toolbar.querySelector('#pending-priority')||null);person.addEventListener('change',event=>{window.person=event.target.value;renderPending()})}const status=$('pending-status');if(status){const selectedStatus=status.value||'PENDIENTE';status.innerHTML='<option value="PENDIENTE">Pendientes</option><option value="REALIZADO">Realizadas</option>';status.value=selectedStatus;status.setAttribute('aria-label','Estado')}view.querySelectorAll('.panel-heading p').forEach(node=>{if(/^Fuentes:/i.test(node.textContent||''))node.remove()});if(!toolbar.querySelector('[data-pending-reset]')){const button=document.createElement('button');button.type='button';button.className='secondary filter-reset';button.dataset.pendingReset='true';button.textContent='Limpiar filtros';button.addEventListener('click',resetPendingFilters);toolbar.appendChild(button)}}



function renderPending(){
  ensurePendingControls();refreshPendingPersonSelect();
  const table=$('pending-table');
  if(!table)return;
  const peopleTabs=$('people-tabs');
  if(peopleTabs){peopleTabs.hidden=true;peopleTabs.setAttribute('aria-hidden','true');peopleTabs.innerHTML=''}
  const statusSelect=$('pending-status');
  if(statusSelect){const selectedStatus=statusSelect.value||'PENDIENTE';statusSelect.innerHTML='<option value="PENDIENTE">Pendientes</option><option value="REALIZADO">Realizadas</option>';statusSelect.value=selectedStatus}
  const q=String($('pending-search')?.value||'').trim().toLocaleLowerCase('es');
  const person=$('pending-person')?.value||window.person||'all';
  const priority=$('pending-priority')?.value||'all';
  const state=$('pending-status')?.value||'all';
  window.person=person;
  const rows=pendingRows.filter(r=>(person==='all'||String(r.person||'')===person)&&(priority==='all'||r.priority===priority)&&(state==='all'||r.status===state)&&[r.person,r.text,r.priority,r.comments].join(' ').toLocaleLowerCase('es').includes(q));
  table.innerHTML=rows.length?rows.map(r=>{
    const i=pendingRows.indexOf(r);
    const status=r.status==='REALIZADO'?'<span class="status done">REALIZADO</span>':'<span class="status open"><span class="status-dot"></span>PENDIENTE</span>';
    return `<tr><td>${status}</td><td>${htmlEscape(r.text||'')}</td><td><strong>${htmlEscape(r.person||'Sin asignar')}</strong></td><td><span class="priority">${htmlEscape(r.priority||'NORMAL')}</span></td><td class="date">${htmlEscape(r.date||'Sin fecha')}</td><td class="date">${htmlEscape(r.updated||'Sin fecha')}</td><td>${htmlEscape(r.comments||'Sin comentarios')}</td><td><button type="button" class="edit-btn" onclick="openPendingEditor(${i})">Editar</button></td></tr>`;
  }).join(''):'<tr><td colspan="8" class="empty">No hay resultados con estos filtros.</td></tr>';
  if($('pending-heading'))$('pending-heading').textContent=person==='all'?'Todos mis pendientes':`Pendientes con ${person}`;
  if($('pending-count'))$('pending-count').textContent=`${rows.length} registros`;
}

function refreshPendingPersonSelect(){
 const select=$('pending-person');if(!select)return;
 const selected=window.person||'all';
 const people=[...new Set(pendingRows.map(r=>r.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 select.innerHTML='<option value="all">Todas las personas</option>'+people.map(p=>`<option value="${htmlEscape(p)}">${htmlEscape(p)}</option>`).join('');
 select.value=people.includes(selected)?selected:'all';window.person=select.value;
}
function resetPendingFilters(){window.person='all';$('pending-search').value='';$('pending-priority').value='all';$('pending-status').value='PENDIENTE';renderPending()}
function resetCenterFilters(){
 $('center-search').value='';$('center-category').value='all';$('center-status').value='all';
 if($('center-date-filter'))$('center-date-filter').value='all';window.centerQuickFilter=null;renderCenter();
}
function renderCenter(){
 const category=canonicalCategory($('center-category')?.value)||'all';
 const cats=[...new Set(centerRows.map(r=>canonicalCategory(r.category)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 const select=$('center-category');
 select.innerHTML='<option value="all">Todas las categorías</option>'+cats.map(c=>`<option value="${htmlEscape(c)}">${htmlEscape(c)}</option>`).join('');
 select.value=cats.includes(category)?category:'all';
 const q=($('center-search')?.value||'').trim().toLocaleLowerCase('es');
 const state=$('center-status')?.value||'all',date=$('center-date-filter')?.value||'all';
 const rows=centerRows.filter(r=>(select.value==='all'||canonicalCategory(r.category)===select.value)&&(state==='all'||effectiveStatus(r)===state)&&[r.activity,r.category,r.frequency,r.last,r.next,r.owner,r.action].join(' ').toLocaleLowerCase('es').includes(q)&&
 (date==='all'||date==='overdue'&&isOverdue(r)||date==='soon'&&dueTone(r)==='row-soon'||date==='nodate'&&!r.next||date==='dated'&&!!r.next)).sort((a,b)=>{const av=sortValue(a,'next'),bv=sortValue(b,'next');return av>bv?1:av<bv?-1:0});
 $('center-table').innerHTML=rows.length?rows.map(r=>`<tr class="${dueTone(r)}"><td>${htmlEscape(r.activity)}</td><td>${htmlEscape(canonicalCategory(r.category))}</td><td>${htmlEscape(r.frequency||'Sin periodicidad')}</td><td class="date">${htmlEscape(displayDate(r.last)||'Sin fecha')}</td><td class="date">${htmlEscape(displayDate(r.next)||'Sin fecha')}${isOverdue(r)?' <span class="overdue-label">VENCIDA</span>':''}</td><td>${htmlEscape(canonicalOwner(r.owner)||'Sin asignar')}</td><td>${statusTag(effectiveStatus(r))}</td><td>${htmlEscape(r.action||'Sin comentarios')}</td><td><button class="edit-btn" onclick="openCenterEditor(${centerRows.indexOf(r)})">Editar</button></td></tr>`).join(''):'<tr><td colspan="9" class="empty">No hay resultados con estos filtros.</td></tr>';
 $('center-count').textContent=`${rows.length} registros`;
}
function refreshKURROMetrics(){renderSimpleCenterSummary()}
function firebaseSnapshot(){return {center:centerRows.map(r=>({...r})),pending:pendingRows.map(r=>({...r})),clients:clientRows.map(r=>({...r})),lists:mergedKurroLists(),updated:new Date().toISOString()}}
async function firebasePersistSnapshot(){
 if(!firebaseUser)throw new Error('No hay sesión Firebase');
 const payload=firebaseSnapshot();
 firebaseWriteQueue=firebaseWriteQueue.catch(()=>{}).then(()=>restWrite(payload));
 try{await firebaseWriteQueue;markSyncSuccess()}catch(error){markSyncFailure();throw error}
}
async function kurroRequest(params){
 if(!firebaseUser)throw new Error('No hay sesión Firebase');
 if(params.api==='data')return restRead();
 if(params.api==='config')return {values:[]};
 // Legacy form calls are coalesced after the synchronous form update finishes.
 await Promise.resolve();await firebasePersistSnapshot();return {ok:true};
}
let dataLoadInFlight=null;
async function loadRemoteData(){
 if(!firebaseUser)return false;
 if(dataLoadInFlight)return dataLoadInFlight;
 dataLoadInFlight=(async()=>{
  try{
   clientsLoading=true;
   const value=await restRead();
   if(!value)throw new Error('Firebase no contiene el documento de datos');
   if(!['center','pending','clients'].every(k=>Array.isArray(value[k])))throw new Error('Formato de Firebase incompleto');
   // Preserve every row, custom person, identifier, and field exactly as received.
   centerRows.splice(0,centerRows.length,...value.center);
   pendingRows.splice(0,pendingRows.length,...value.pending);
   clientRows.splice(0,clientRows.length,...value.clients);
   remoteKurroLists=value.lists||{};clientsLoading=false;
   refreshKurroPeopleOptions();refreshClientOptions();refreshKURROMetrics();
   renderCenter();renderPending();renderClients();setDataAlert('');markSyncSuccess();return true;
  }catch(error){
   clientsLoading=false;renderClients();markSyncFailure();
   setDataAlert('No se han podido actualizar los datos de Firebase. '+(centerRows.length||pendingRows.length||clientRows.length?'Se conserva la última lectura de esta sesión. ':'')+'Pulsa Actualizar para reintentarlo.');
   return false;
  }finally{dataLoadInFlight=null}
 })();return dataLoadInFlight;
}
async function refreshKURROFromFirebase(silent=false){
 if(!firebaseUser||kurroRefreshInFlight||kurroPendingWrites||document.querySelector('.modal.open'))return false;
 kurroRefreshInFlight=true;
 try{let ok=await loadRemoteData();if($('directory-view')?.classList.contains('active-view')){if(!silent)directoryLoaded=false;ok=await loadDirectoryFromFirebase()&&ok}if(!silent&&ok)showSyncToast('Datos actualizados desde Firebase');return ok}finally{kurroRefreshInFlight=false}
}
init();ensureClientControls();ensurePendingControls();
$('pending-person').addEventListener('change',event=>{window.person=event.target.value;renderPending()});
$('client-filter-client').addEventListener('change',renderClients);
$('center-date-filter').addEventListener('change',renderCenter);
$('center-sort')?.remove();
renderCenter();renderPending();renderClients();
startFirebaseRest();
function init(){
 window.person='all';
 document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.nav-item').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-current',b===button?'page':'false')});
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active-view',v.id===button.dataset.view+'-view'));
  $('page-title').textContent={center:'Control del centro',pending:'Seguimientos',clients:'Gestiones de clientes',directory:'Directorio'}[button.dataset.view];
  if(button.dataset.view==='directory')loadDirectoryFromFirebase();
 }));
 ['center-search','center-category','center-status'].forEach(id=>$(id)?.addEventListener('input',renderCenter));
 ['pending-search','pending-priority','pending-status'].forEach(id=>$(id)?.addEventListener('input',renderPending));
 renderCenter();renderPending();renderDirectory();
}
