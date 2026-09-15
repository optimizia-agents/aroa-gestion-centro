const centerRows = [];
const pendingRows = [];
const directoryRows = [];
let directoryHeaders = [];
let directoryLoaded = false;
let directoryLoading = false;
let directoryError = "";
let directoryLoadInFlight = null;
let directoryEpoch = 0;
let directoryPage = 1;
const DIRECTORY_PAGE_SIZE = 100;
const DIRECTORY_COLLECTION = 'customerDirectoryChunks';
const DIRECTORY_META_COLLECTION = 'customerDirectoryMeta';
const DIRECTORY_CHUNK_SIZE = 50;
const FIREBASE_CONFIG={apiKey:'AIzaSyDnKzXeRJPb3NVr--DbG44t1YyRMZyncPM',authDomain:'aroa-gestion-centro.firebaseapp.com',projectId:'aroa-gestion-centro',storageBucket:'aroa-gestion-centro.firebasestorage.app',messagingSenderId:'499180389940',appId:'1:499180389940:web:68c89efd9890b7c1ceac61'};
const FIREBASE_ALLOWED_EMAIL='optimizia.agents@gmail.com';
const ORIGINAL_MAINTENANCE_META={
'Revisión lavaojos de emergencia':['INTERNO',''],'Limpieza Nave y cristales':['EXTERNO','ISS FACILITY'],'Exámenes de salud de los empleados':['EXTERNO','VITALY'],'CARTEL SEÑALIZACION PLAN DE CIRCULACION Y FIRMAR RECIBIDO PLAN DE CIRCULACION':['',''],'Mantenimiento Preventivo del Portón':['EXTERNO','PROPERVALL'],'Limpieza oficinas y baños registro':['EXTERNO','ISS FACILITY'],'Escalera - inspección visual':['INTERNO',''],'Control de Plagas':['EXTERNO','Anticymex'],'PCI - Extintores portátiles, BIE (3 uds), Sistema detección/alarma (central, pulsadores, sirenas), Sectorización y evacuación':[['INTERNO',''],['EXTERNO','CYRASA']],'Estanterías trastienda (archivo/oficina) - inspección visual':['INTERNO',''],'Botiquín':['INTERNO',''],'Formación Emergency Preparedness-Annual (LearnEx 50009058)':['INTERNO',''],'Plan de Circulación (límite 8 km/h) - revisión':['INTERNO',''],'Formación Primeros Auxilios (50689913)':['EXTERNO','VITALY'],'Formación uso de extintores (hands on) (50954288)':['EXTERNO','VITALY'],'MAUs -Plan de Autoprotección Revisión/actualización del documento':['EXTERNO','RISCAT'],'PRL / Evaluación de Riesgos':['INTERNO','CM'],'Inspección Portón RD 1215 OCA':['EXTERNO','EUROCONTROL'],'Inspección APQ (Almacenamiento de Productos Químicos)':['EXTERNO','APAVE'],'Revision Carretilla elevadora LINDE E25':['EXTERNO','LINDE'],'Licencia de apertura y funcionamiento':['EXTERNO','Ayto de Fuenlabrada'],'Certificado de Instalación Eléctrica de Baja Tensión (CIE)':['EXTERNO',''],'Carretilla elevadora - checklist diario':['INTERNO',''],'MAUs - Revisión por cambios (personal/horario/instalación)':['EXTERNO','RISCAT'],'Simulacro de emergencia (documentado)':['INTERNO','CM'],'CARA Evaluación de Riesgos por Agentes Químicos':['INTERNO',''],'Informes higiénicos y ergonómicos, psicosociales':['EXTERNO','VITALY'],'Formación CVA en carga/descarga de vehículos':['EXTERNO','CVA'],'Formación CVA en carretillas elevadoras/traspaletas':['EXTERNO','CVA'],'Formación CVA en manipulación de botellas':['EXTERNO','CVA'],'Formacion Mylearning':['INTERNO',''],'Apertura del centro de trabajo':['EXTERNO','Comunidad de Madrid'],'ATEX - Zona de carga de carretilla':['INTERNO','RISCAT'],'CAE - divulgación MAUs a contratas y visitas':['INTERNO',''],'Licencia de actividad (cambio de titularidad)':['EXTERNO',''],'Registro Establecimientos Industriales (REIC)':['EXTERNO',''],'Registro Sanitario':['EXTERNO',''],'RITE - Instalaciones térmicas (climatización)':['EXTERNO',''],'Tasa de recogida de residuos/basura':['EXTERNO',''],'Instrucciones de Trabajo (IT) (Nuevos procedimientos) (Incluído ventanilla si procede)':['INTERNO',''],'Organigrama del centro':['INTERNO',''],'Programa Comunicación de Riesgos (productos químicos)':['INTERNO',''],'Programa de Conservación Auditiva':['INTERNO',''],'Programa de Protección Respiratoria':['INTERNO','']};
function maintenanceMetaFor(row,seen){const raw=String(row.activity||'').trim(), entry=ORIGINAL_MAINTENANCE_META[raw];if(!entry)return null;if(Array.isArray(entry[0])){const i=seen[raw]||0;seen[raw]=i+1;return entry[Math.min(i,entry.length-1)]}return entry}

let firebaseDb=null,firebaseAuth=null,firebaseUser=null,firebaseWriteQueue=Promise.resolve();

const $ = id => document.getElementById(id);
const MONTH_NAMES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function canonicalCategory(value){const key=String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');return key==='linea provisional hasta que se haga'||key==='línea provisional hasta que se haga'?'Línea provisional hasta que se haga':String(value||'').trim()}
function canonicalOwner(value){const raw=String(value||'').trim().replace(/\s+/g,' ');const key=raw.toLocaleLowerCase('es').replace(/\s*\/\s*/g,'/');if(key==='responsable centro'||key==='responsable del centro')return 'Responsable del centro';if(key==='sc/ehs')return 'SC / EHS';if(key==='sc/ehs (carla macedo)')return 'SC / EHS (Carla Macedo)';return raw}
function displayDate(value){const raw=String(value||'').trim().replace(/\s+VENCIDA$/i,'');if(!raw)return '';let m=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`;m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m)return`${m[3].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[1]}`;m=raw.match(/^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-záéíóú]*[-\s\/]?(\d{2}|\d{4})$/i);if(m){const month=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'].indexOf(m[1].slice(0,3).toLowerCase())+1;const year=m[2].length===2?'20'+m[2]:m[2];return`${MONTH_NAMES[month-1]} ${year}`}return raw}
document.body.classList.add('auth-locked');
function unlockPrivateApp(){document.body.classList.remove('auth-locked')}
function metric(label,value,note,alert=false){return `<div class="metric ${alert?'alert':''}"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></div>`}
function statusTag(s){const label=s==='done'?'REALIZADO':s==='process'?'EN PROCESO':'PENDIENTE';return `<span class="status ${s==='done'?'done':s==='process'?'process':'open'}"><span class="status-dot"></span>${label}</span>`}
function addMonths(date, months){const d=new Date(date+'T12:00:00');const day=d.getDate();d.setMonth(d.getMonth()+months);if(d.getDate()!==day)d.setDate(0);return d}
function nextDate(date,frequency){const d=new Date(date+'T12:00:00');const f=(frequency||'').toLowerCase();if(f.includes('seman'))d.setDate(d.getDate()+7);else if(f.includes('bimes'))return addMonths(date,2);else if(f.includes('trimes'))return addMonths(date,3);else if(f.includes('semes'))return addMonths(date,6);else if(f.includes('mens'))return addMonths(date,1);else if(f.includes('5 años'))return addMonths(date,60);else if(f.includes('3 años'))return addMonths(date,36);else if(f.includes('año')||f.includes('anual'))return addMonths(date,12);else return null;return d}
function formatDate(d){return d?`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`:''}
function normalizeSheetDate(value){const s=String(value||'').trim();let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)return`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`;m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);return m?`${m[3].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[1]}`:s}
function isOverdue(r){if(!r.next)return false;const p=r.next.split('/');const due=new Date(`${p[2]}-${p[1]}-${p[0]}T23:59:59`);return due<new Date()}
function dueTone(r){if(!r.next)return '';const p=r.next.split('/');const due=new Date(`${p[2]}-${p[1]}-${p[0]}T23:59:59`);const days=Math.ceil((due-new Date())/86400000);return days<0?'row-overdue':days<=30?'row-soon':'row-ok'}
function effectiveStatus(r){return isOverdue(r)&&r.status==='done'?'open':r.status}
function sortValue(r,key){if(key==='category')return r.category;if(key==='last')return r.last?new Date(r.last.split('/').reverse().join('-')):new Date(0);if(key==='next')return r.next?new Date(r.next.split('/').reverse().join('-')):new Date(8640000000000000);if(key==='frequency')return r.frequency||'zzzz';if(key==='status')return r.status;return r.activity}
setTimeout(()=>renderPending(),0);

// Opciones ampliables para que los nuevos responsables y contactos sigan disponibles.
function savedKurroLists(){return structuredClone(remoteKurroLists)}
let remoteKurroLists={};
function mergedKurroLists(){const local={};const merged={};Object.keys({...local,...remoteKurroLists}).forEach(k=>{merged[k]=[...new Set([...(remoteKurroLists[k]||[]),...(local[k]||[])].map(v=>String(v||'').trim()).filter(Boolean))]});return merged}
function saveKurroLists(lists){remoteKurroLists=structuredClone(lists)}
function kurroOptions(kind){const lists=mergedKurroLists(),source=kind==='owner'?centerRows.map(r=>r.owner):kind==='provider'?centerRows.map(r=>r.provider):pendingRows.map(r=>r.person);return [...new Set([...(lists[kind]||[]),...source].map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function fillKurroSelect(id,values,current=''){const select=$(id);if(!select)return;const value=current||select.value;const prefix=id==='edit-owner'?'<option value="">Sin asignar</option>':id==='edit-provider'?'<option value="Ninguno">Ninguno</option>':'';select.innerHTML=prefix+values.filter(v=>v!=='Ninguno').map(v=>`<option value="${String(v).replaceAll('&','&amp;').replaceAll('"','&quot;')}">${String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</option>`).join('');if(value&&values.includes(value))select.value=value;else if(id==='edit-provider'&&!value)select.value='Ninguno'}
function refreshKurroPeopleOptions(){fillKurroSelect('edit-owner',kurroOptions('owner'));fillKurroSelect('pending-edit-person',kurroOptions('person'));fillKurroSelect('edit-provider',kurroOptions('provider'))}
function addKurroOption(kind,selectId,label){const name=prompt(label);if(!name)return;const clean=name.trim();if(!clean)return;const lists=savedKurroLists();lists[kind]=[...(lists[kind]||[]),clean];saveKurroLists(lists);refreshKurroPeopleOptions();$(selectId).value=clean;showSyncToast(`${clean} añadido a la lista`)}
document.querySelector('#add-owner')?.addEventListener('click',()=>addKurroOption('owner','edit-owner','Escribe el nuevo responsable'));
document.querySelector('#add-provider')?.addEventListener('click',()=>addKurroOption('provider','edit-provider','Escribe el nuevo proveedor'));
document.querySelector('#add-pending-person')?.addEventListener('click',()=>addKurroOption('person','pending-edit-person','Escribe la nueva persona o empresa'));
renderCenter();renderPending();

// La próxima revisión se calcula por defecto, pero admite una fecha manual.
$('edit-next')?.addEventListener('input',()=>{$('edit-next').dataset.manual='true'});
const saveButton=$('save-center-editor');if(saveButton){const replacement=saveButton.cloneNode(true);saveButton.replaceWith(replacement);replacement.addEventListener('click',()=>saveCenterEditorFlexible())}
function setCenterStatus(state){$('center-status').value=state;window.centerQuickFilter=null;renderCenter();if(typeof saveViewFilters==='function')saveViewFilters('center')}
function setCenterDateFilter(kind){window.centerQuickFilter=kind==='all'?null:kind;renderCenter();if(typeof saveViewFilters==='function')saveViewFilters('center')}

let pendingEditorIndex=-1;
function pendingDateForEditor(value){const p=String(value||'').split('/');return p.length===3?`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`:''}
function pendingDateFromEditor(value){const s=String(value||'').trim();if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s))return normalizeSheetDate(s);const p=s.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:''}
function localizeVisibleDateInputs(){document.querySelectorAll('input.pending-date[type="date"]').forEach(input=>{if(!input.value)return;const parts=input.value.split('-');if(parts.length!==3)return;input.type='text';input.value=`${parts[2]}/${parts[1]}/${parts[0]}`;input.placeholder='dd/mm/aaaa';input.inputMode='numeric';input.dataset.localized='true'})}
if(typeof MutationObserver!=='undefined'){new MutationObserver(localizeVisibleDateInputs).observe(document.body,{childList:true,subtree:true})}
function openPendingEditor(index=-1){$('delete-pending-editor').hidden=index<0;refreshKurroPeopleOptions();editorMessage($('pending-editor'),'');pendingEditorIndex=index;$('pending-edit-text').value=index<0?'':pendingRows[index].text||'';$('pending-edit-person').value=index<0?(window.person!=='all'?window.person:kurroOptions('person')[0]||''):pendingRows[index].person;$('pending-edit-priority').value=index<0?'NORMAL':pendingRows[index].priority||'NORMAL';$('pending-edit-status').value=index<0?'PENDIENTE':pendingRows[index].status||'PENDIENTE';$('pending-edit-date').value=index<0?'':pendingDateForEditor(pendingRows[index].date);$('pending-edit-comments').value=index<0?'':pendingRows[index].comments||'';$('pending-editor-title').textContent=index<0?'Nuevo seguimiento':'Editar seguimiento';$('pending-editor').classList.add('open');$('pending-editor').setAttribute('aria-hidden','false')}
function closePendingEditor(){if(!allowEditorClose('pending-editor'))return;$('pending-editor').classList.remove('open');$('pending-editor').setAttribute('aria-hidden','true');pendingEditorIndex=-1}
function updateEditorNextPreview(){const date=$('edit-last')?.value,frequency=$('edit-frequency')?.value==='custom'?$('edit-frequency-custom')?.value:$('edit-frequency')?.value;const next=date&&frequency?nextDate(date,frequency):null;if($('edit-next'))$('edit-next').value=next?dateForEditor(formatDate(next)):''}
document.querySelector('[data-new-pending]')?.addEventListener('click',()=>openPendingEditor());document.querySelectorAll('[data-close-pending]').forEach(b=>b.addEventListener('click',closePendingEditor));$('save-pending-editor')?.addEventListener('click',savePendingEditor);$('edit-last')?.addEventListener('change',updateEditorNextPreview);$('edit-frequency')?.addEventListener('change',updateEditorNextPreview);$('edit-frequency-custom')?.addEventListener('input',updateEditorNextPreview);$('pending-clear-search')?.addEventListener('click',()=>{$('pending-search').value='';renderPending()});$('client-clear-search')?.addEventListener('click',()=>{$('client-search').value='';renderClients()});renderPending();
// Identificador conservado para los formularios de edición.
function setDataAlert(message){const alert=$('data-alert');if(!alert)return;alert.textContent=message;alert.hidden=!message}

let kurroRefreshInFlight=false;
function showSyncToast(message){const toast=$('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');clearTimeout(window.kurroToastTimer);window.kurroToastTimer=setTimeout(()=>toast.classList.remove('show'),2200)}
// Mantiene abiertas las sesiones en otros equipos al día sin volver a depender de Google Sheets.
// El intervalo corto permite que un cambio guardado en Firebase aparezca normalmente en pocos segundos.
setInterval(()=>{if(document.visibilityState==='visible')refreshKURROFromFirebase(true)},60000);
window.addEventListener('focus',()=>refreshKURROFromFirebase(true));
document.querySelector('[data-refresh]')?.addEventListener('click',async()=>{const button=document.querySelector('[data-refresh]');button?.classList.add('busy');if($('sync-label'))$('sync-label').textContent='Actualizando…';const ok=await refreshKURROFromFirebase(false);button?.classList.remove('busy')});
let centerEditorIndex=null;
const EVIDENCE_ENABLED=false;let pendingEvidenceFile=null;
function ensureSharePointField(){const grid=$('center-editor')?.querySelector('.editor-grid');if(!grid||$('edit-sharepoint-url'))return;const label=document.createElement('label');label.className='editor-wide';label.innerHTML='Enlace al archivo de SharePoint<textarea id="edit-sharepoint-url" rows="2" inputmode="url" placeholder="Pega aquí el enlace de SharePoint" autocomplete="off" autocapitalize="none" spellcheck="false"></textarea><small class="field-help">Pega aquí el enlace. El archivo seguirá alojado en SharePoint.</small><a id="edit-sharepoint-open" class="sharepoint-link" href="#" target="_blank" rel="noopener" hidden>Abrir archivo en SharePoint</a>';grid.appendChild(label);const field=$('edit-sharepoint-url');field.addEventListener('input',()=>{const value=field.value.trim();const link=$('edit-sharepoint-open');if(link){link.href=value||'#';link.hidden=!/^https:\/\//i.test(value)}})}
function ensureEvidenceControls(){const grid=$('center-editor')?.querySelector('.editor-grid');if(!grid||$('edit-evidence-file'))return;const box=document.createElement('div');box.className='editor-wide evidence-box';box.innerHTML='<strong>Evidencia</strong><p id="edit-evidence-status" class="pending-editor-note">No hay ningún documento asociado.</p><div class="evidence-actions"><a id="edit-evidence-view" class="secondary" href="#" target="_blank" rel="noopener" hidden>Ver evidencia</a><label class="secondary evidence-upload">Subir o sustituir<input id="edit-evidence-file" type="file" accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" hidden></label></div>';grid.appendChild(box);$('edit-evidence-file').addEventListener('change',event=>{pendingEvidenceFile=event.target.files?.[0]||null;const link=$('edit-evidence-view');if(link)link.hidden=true;if(pendingEvidenceFile)$('edit-evidence-status').textContent=`Nuevo archivo: ${pendingEvidenceFile.name}`})}
function showEvidence(evidence){ensureEvidenceControls();const status=$('edit-evidence-status'),link=$('edit-evidence-view');if(!status||!link)return;pendingEvidenceFile=null;if($('edit-evidence-file'))$('edit-evidence-file').value='';if(evidence?.url){status.textContent=`${evidence.name||'Documento'} · actualizado ${evidence.updated||''}`;link.href=evidence.url;link.hidden=false}else{status.textContent='No hay ningún documento asociado.';link.hidden=true}}
async function uploadEvidence(file,activityId){if(!file)return null;if(file.size>10*1024*1024)throw new Error('La evidencia no puede superar 10 MB.');const name=`evidence/${activityId}/${Date.now()}-${file.name.replace(/[^\w.\- áéíóúÁÉÍÓÚ]/g,'_')}`;const endpoint=`https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}/o?uploadType=media&name=${encodeURIComponent(name)}`;const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+restIdToken,'Content-Type':file.type||'application/octet-stream'},body:file});if(!response.ok)throw new Error('No se ha podido subir la evidencia.');const data=await response.json();const token=data.downloadTokens||'';return{name:file.name,path:name,url:`https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}/o/${encodeURIComponent(name)}?alt=media${token?'&token='+encodeURIComponent(token):''}`,updated:formatDate(new Date())}}
async function deleteEvidence(evidence){if(!evidence?.path)return;const endpoint=`https://firebasestorage.googleapis.com/v0/b/${FIREBASE_CONFIG.storageBucket}/o/${encodeURIComponent(evidence.path)}`;await fetch(endpoint,{method:'DELETE',headers:{Authorization:'Bearer '+restIdToken}})}
async function ensureEvidenceTestLine(){
 if(!firebaseUser||!appRevision||centerRows.some(row=>row.id==='test-evidence-line'))return;
 try{const file=new Blob(['Evidencia de prueba de Aroa Gestión. Puedes sustituir este archivo o eliminar la actividad cuando termines.'],{type:'text/plain'});const evidence=await uploadEvidence(file,'test-evidence-line');evidence.name='evidencia-prueba.txt';const payload=structuredClone(appDocument);payload.center=[...centerRows,{id:'test-evidence-line',activity:'PRUEBA EVIDENCIA',category:'Prueba',frequency:'Sin periodicidad',last:'',next:'',owner:'',status:'open',action:'Eliminar esta actividad cuando termines la comprobación.',evidence}];payload.lists=mergedKurroLists();payload.updated=new Date().toISOString();payload.lastMutation=crypto.randomUUID();const confirmed=await writeDocument('appState','main',payload,appRevision);applyConfirmedDocument(confirmed);showSyncToast('Línea de prueba preparada')}catch(error){console.warn('No se pudo preparar la línea de prueba',error)}}
function dateForEditor(value){const p=String(value||'').split('/');return p.length===3?`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`:''}
function dateFromEditor(value){const p=String(value||'').split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:''}
function frequencyChoice(value){const f=String(value||'').toLowerCase();if(f.includes('seman'))return'Semanal';if(f.includes('bimes'))return'Bimestral';if(f.includes('trimes'))return'Trimestral';if(f.includes('semes'))return'Semestral';if(f.includes('mens'))return'Mensual';if(f.includes('5 años'))return'Cada 5 años';if(f.includes('3 años'))return'Cada 3 años';if(f.includes('anual')||f.includes('1 año'))return'Anual';if(f.includes('cuando aplique'))return'Cuando aplique';if(f.includes('cambio'))return'Según cambios';if(!f||f.includes('sin periodicidad')||f.includes('no periódica'))return'Sin periodicidad';return'custom'}
function openCenterEditor(index){refreshKurroPeopleOptions();editorMessage($('center-editor'),'');const r=centerRows[index];if(!r)return;centerEditorIndex=index;[['activity',r.activity],['category',r.category],['owner',r.owner],['provider',r.provider],['action',r.action]].forEach(([key,value])=>{const field=$(`edit-${key}`);if(field)field.value=value||''});const choice=frequencyChoice(r.frequency);$('edit-frequency').value=choice;$('edit-frequency-custom').value=choice==='custom'?(r.frequency||''):'';$('edit-frequency-custom').hidden=choice!=='custom';$('edit-last').value=dateForEditor(r.last);$('edit-next').value=dateForEditor(r.next);$('edit-status').value=effectiveStatus(r);if($('edit-type'))$('edit-type').value=r.type||'INTERNO';syncProviderField();$('delete-center-editor').hidden=false;$('editor-title').textContent=isOverdue(r)?'Registrar seguimiento':'Editar actividad';$('edit-last-label').textContent=isOverdue(r)?'Fecha de actuación':'Última revisión';$('save-center-editor').textContent=isOverdue(r)?'Guardar seguimiento':'Guardar cambios';$('center-editor').classList.add('open');$('center-editor').setAttribute('aria-hidden','false')}
function openNewCenterEditor(){refreshKurroPeopleOptions();editorMessage($('center-editor'),'');centerEditorIndex=-1;[['activity',''],['category',''],['owner',''],['provider',''],['action','']].forEach(([key,value])=>{$(`edit-${key}`).value=value});$('edit-frequency').value='Sin periodicidad';$('edit-frequency-custom').value='';$('edit-frequency-custom').hidden=true;$('edit-last').value='';$('edit-next').value='';$('edit-status').value='open';if($('edit-type'))$('edit-type').value='INTERNO';syncProviderField();$('delete-center-editor').hidden=true;$('editor-title').textContent='Nueva acción';$('edit-last-label').textContent='Última revisión';$('save-center-editor').textContent='Guardar cambios';$('center-editor').classList.add('open');$('center-editor').setAttribute('aria-hidden','false')}
function closeCenterEditor(){if(!allowEditorClose('center-editor'))return;$('center-editor').classList.remove('open');$('center-editor').setAttribute('aria-hidden','true');centerEditorIndex=null}
function syncProviderField(){const field=$('edit-provider-field'),type=$('edit-type'),input=$('edit-provider');if(!field||!type)return;const external=type.value==='EXTERNO';field.hidden=!external;if(input){input.disabled=!external;if(!external)input.value='Ninguno'}}
document.querySelectorAll('[data-close-editor]').forEach(button=>button.addEventListener('click',closeCenterEditor));$('edit-frequency')?.addEventListener('change',()=>{$('edit-frequency-custom').hidden=$('edit-frequency').value!=='custom'});$('edit-type')?.addEventListener('change',syncProviderField);
document.querySelector('[data-new-center]')?.addEventListener('click',openNewCenterEditor);$('delete-center-editor')?.addEventListener('click',deleteCenterEditor);
let clientRows=[],clientEditorIndex=-1,clientsLoading=true;
function clientDateForEditor(v){const normalized=normalizeSheetDate(v),p=normalized.split('/');return p.length===3?p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0'):''}
function clientDateFromEditor(v){const s=String(v||'').trim();if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s))return normalizeSheetDate(s);const p=s.split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:''}
function clientOptions(){const l=mergedKurroLists();return [...new Set([...(l.client||[]),...clientRows.map(r=>r.client)].map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function refreshClientOptions(){const s=$('client-edit-client');if(!s)return;const v=s.value;s.innerHTML='<option value="">Sin asignar</option>'+clientOptions().map(x=>'<option>'+htmlEscape(x)+'</option>').join('');if(v)s.value=v}
function renderClientMetrics(){const open=clientRows.filter(r=>r.status!=='REALIZADO');$('client-metrics').innerHTML=metric('Pendientes activos',open.length,'Seguimiento con clientes',true)+metric('En proceso',open.filter(r=>r.status==='EN PROCESO').length,'Gestiones abiertas')+metric('Alta prioridad',open.filter(r=>r.priority==='ALTA').length,'Para atender')+metric('Con fecha objetivo',open.filter(r=>r.date).length,'Para organizar')}
function openClientEditor(i=-1){editorMessage($('client-editor'),'');$('delete-client-editor').hidden=i<0;clientEditorIndex=i;const r=i<0?{}:clientRows[i];refreshClientOptions();$('client-edit-client').value=r.client||'';$('client-edit-contact').value=r.contact||'';$('client-edit-text').value=r.text||'';$('client-edit-priority').value=r.priority||'NORMAL';$('client-edit-status').value=r.status||'PENDIENTE';$('client-edit-date').value=clientDateForEditor(r.date);$('client-edit-comments').value=r.comments||'';$('client-editor-title').textContent=i<0?'Nuevo pendiente':'Editar pendiente';$('client-editor').classList.add('open');$('client-editor').setAttribute('aria-hidden','false')}
function closeClientEditor(){if(!allowEditorClose('client-editor'))return;$('client-editor').classList.remove('open');$('client-editor').setAttribute('aria-hidden','true');clientEditorIndex=-1}
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
// Enlace opcional a un archivo alojado en SharePoint (sin subir archivos a Firebase).
const _openCenterEditor=openCenterEditor,_openNewCenterEditor=openNewCenterEditor,_saveCenterEditorFlexible=saveCenterEditorFlexible;
openCenterEditor=function(index){ensureSharePointField();_openCenterEditor(index);const field=$('edit-sharepoint-url'),link=$('edit-sharepoint-open'),value=centerRows[index]?.sharepointUrl||'';if(field)field.value=value;if(link){link.href=value||'#';link.hidden=!/^https:\/\//i.test(value)}};
openNewCenterEditor=function(){ensureSharePointField();_openNewCenterEditor();const field=$('edit-sharepoint-url'),link=$('edit-sharepoint-open');if(field)field.value='';if(link){link.href='#';link.hidden=true}};
saveCenterEditorFlexible=async function(){ensureSharePointField();const field=$('edit-sharepoint-url');const value=field?.value.trim()||'';if(value&&!/^https:\/\//i.test(value)){editorMessage($('center-editor'),'Escribe un enlace web válido de SharePoint.');return}window._sharepointUrlToSave=value;return _saveCenterEditorFlexible()};
document.addEventListener('click',event=>{if(!EVIDENCE_ENABLED&&event.target?.closest?.('.edit-btn,[data-new-center]')){setTimeout(()=>{ensureSharePointField();const field=$('edit-sharepoint-url'),link=$('edit-sharepoint-open'),value=centerEditorIndex>=0?centerRows[centerEditorIndex]?.sharepointUrl||'':'';if(field)field.value=value;if(link){link.href=value||'#';link.hidden=!/^https:\/\//i.test(value)}},0)}});
ensureEvidenceTestLine=async function(){
 if(!EVIDENCE_ENABLED)return;
 if(!firebaseUser||!appRevision)return;
 const existing=centerRows.find(row=>row.id==='test-evidence-line');
 if(existing?.evidence)return;
 const row=existing||{id:'test-evidence-line',activity:'PRUEBA EVIDENCIA',category:'Prueba',frequency:'Sin periodicidad',last:'',next:'',owner:'',status:'open',action:'Eliminar esta actividad cuando termines la comprobación.'};
 try{let payload=structuredClone(appDocument);if(!existing){payload.center=[...centerRows,row];payload.lists=mergedKurroLists();payload.updated=new Date().toISOString();payload.lastMutation=crypto.randomUUID();let confirmed=await writeDocument('appState','main',payload,appRevision);applyConfirmedDocument(confirmed)}const file=new Blob(['Evidencia de prueba de Aroa Gestión.'],{type:'text/plain'});const evidence=await uploadEvidence(file,'test-evidence-line');payload=structuredClone(appDocument);payload.center=payload.center.map(item=>item.id==='test-evidence-line'?{...item,evidence:{...evidence,name:'evidencia-prueba.txt'}}:item);payload.updated=new Date().toISOString();payload.lastMutation=crypto.randomUUID();let confirmed=await writeDocument('appState','main',payload,appRevision);applyConfirmedDocument(confirmed);showSyncToast('Línea de prueba preparada')}catch(error){console.warn('No se pudo asociar la evidencia de prueba',error);showSyncToast('Línea de prueba creada; selecciona después un archivo para asociarlo')}};
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
  body.innerHTML=visibleRows.length?visibleRows.map(row=>{const index=directoryRows.indexOf(row);const c=directoryCanonicalRow(row);const clientNumber=String(c[0]||'').trim();return `<tr><td><div class="client-number-cell"><strong>${htmlEscape(clientNumber)}</strong>${clientNumber?`<button type="button" class="copy-client-button" data-copy-client="${htmlEscape(clientNumber)}" aria-label="Copiar número de cliente" title="Copiar número">⧉</button>`:''}</div></td><td>${htmlEscape([c[4],c[5]].filter(Boolean).join(' '))}</td><td>${htmlEscape(c[27])}</td><td>${htmlEscape(c[10])}</td><td>${htmlEscape(c[9])}</td><td>${htmlEscape(c[8])}</td><td>${htmlEscape(c[3])}</td><td>${htmlEscape([c[6],c[7]].filter(Boolean).join(' '))}</td><td>${htmlEscape(c[17])}</td><td><button class="edit-btn directory-detail-button" data-directory-index="${index}">Ver ficha</button></td></tr>`}).join(''):`<tr><td colspan="10" class="empty">No hay clientes que coincidan con la búsqueda.</td></tr>`;
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
  document.querySelectorAll('.copy-client-button').forEach(button=>button.addEventListener('click',()=>copyClientNumber(button.dataset.copyClient)));
}
async function copyClientNumber(value){try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);else{const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove()}showSyncToast('Número de cliente copiado')}catch(error){showSyncToast('No se ha podido copiar el número')}}
async function loadDirectoryFromFirebase(){
 if(directoryImportBusy)return false;
 if(!firebaseUser)return false;
 if(directoryLoaded)return true;
 if(directoryLoadInFlight)return directoryLoadInFlight;
 directoryLoading=true;directoryError='';renderDirectory();
 const epoch=directoryEpoch;
 directoryLoadInFlight=(async()=>{
  try{
   const meta=(await readDocument(DIRECTORY_META_COLLECTION,'main'))?.value;
   if(!meta||!Number.isInteger(Number(meta.chunks))||Number(meta.chunks)<0)throw new Error('Directorio no disponible');
   const rows=[];
   for(let i=1;i<=Number(meta.chunks);i++){
    const value=(await readDocument(DIRECTORY_COLLECTION,meta.chunkIds?.[i-1]||`chunk-${String(i).padStart(4,'0')}`))?.value;
    if(!value?.payload)throw new Error('Falta un bloque del directorio');
    const parsed=JSON.parse(value.payload);
    if(!Array.isArray(parsed))throw new Error('Bloque inválido');
    rows.push(...parsed);
   }
   if(epoch!==directoryEpoch)return false;
   if(Number.isFinite(meta.count)&&rows.length!==meta.count)throw new Error('Directorio incompleto');
   directoryHeaders=Array.isArray(meta.headers)?meta.headers:[];
   directoryRows.splice(0,directoryRows.length,...rows);directoryLoaded=true;return true;
  }catch(error){directoryError='No se ha podido cargar el directorio completo. Pulsa Actualizar para reintentarlo.';return false}
  finally{directoryLoading=false;directoryLoadInFlight=null;renderDirectory()}
 })();return directoryLoadInFlight;
}
document.querySelector('#directory-import-button')?.addEventListener('click',()=>{if(!firebaseUser){openFirebaseAuth();return}$('directory-file')?.click()});$('directory-file')?.addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importDirectoryWorkbook(file);event.target.value=''});$('directory-search')?.addEventListener('input',()=>{directoryPage=1;renderDirectory()});$('directory-clear')?.addEventListener('click',()=>{$('directory-search').value='';directoryPage=1;renderDirectory()});$('directory-detail-close')?.addEventListener('click',closeDirectoryDetail);$('directory-detail-cancel')?.addEventListener('click',closeDirectoryDetail);
$('delete-client-editor')?.addEventListener('click',deleteClientEditor);
$('delete-pending-editor')?.addEventListener('click',deletePendingEditor);

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
  if(clientsLoading&&!clientRows.length){table.innerHTML='<tr><td colspan="10" class="empty">Cargando gestiones reales desde Firebase…</td></tr>';if($('client-count'))$('client-count').textContent='Cargando…';return}
  const rows=clientRows.filter(row=>(client==='all'||String(row.client||'')===client)&&(priority==='all'||row.priority===priority)&&(status==='all'||row.status===status)&&[row.client,row.contact,row.text,row.priority,row.status,row.comments].join(' ').toLocaleLowerCase('es').includes(q));
  table.innerHTML=rows.length?rows.map(row=>{
    const index=clientRows.indexOf(row);
    const statusHtml=row.status==='REALIZADO'?'<span class="status done">REALIZADO</span>':row.status==='EN PROCESO'?'<span class="status process">EN PROCESO</span>':'<span class="status open"><span class="status-dot"></span>PENDIENTE</span>';
    return `<tr class="group-colored" style="${groupColorStyle(row.client)}"><td>${statusHtml}</td><td><strong class="group-label">${htmlEscape(row.client||'Sin asignar')}</strong></td><td>${htmlEscape(row.contact||'Sin contacto')}</td><td>${htmlEscape(row.text||'')}</td><td><span class="priority ${row.priority==='ALTA'?'priority-high':''}">${htmlEscape(row.priority||'NORMAL')}</span></td><td class="date">${htmlEscape(row.date||'Sin fecha')}</td><td class="date">${htmlEscape(row.updated||'Sin fecha')}</td><td>${htmlEscape(row.comments||'Sin comentarios')}</td><td><button type="button" class="edit-btn" onclick="openClientEditor(${index})">Editar</button></td></tr>`;
  }).join(''):'<tr><td colspan="10" class="empty">No hay resultados con estos filtros.</td></tr>';
  if($('client-heading'))$('client-heading').textContent=client==='all'?'Todas las gestiones':`Gestiones con ${client}`;
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
  pending:['pending-search','pending-person','pending-priority','pending-status','pending-sort'],
  clients:['client-search','client-filter-client','client-priority','client-status']
};
function readViewFilters(){try{return JSON.parse(localStorage.getItem(VIEW_FILTERS_KEY)||'{}')}catch(e){return {}}}
function saveViewFilters(view){
  const fields=VIEW_FILTER_FIELDS[view]; if(!fields)return;
  const all=readViewFilters(); all[view]=Object.fromEntries(fields.map(id=>[id,$(id)?.value||'']));
  try{localStorage.setItem(VIEW_FILTERS_KEY,JSON.stringify(all))}catch(e){}
}
function restoreViewFilters(view){
  const saved=readViewFilters()[view]||{};
  (VIEW_FILTER_FIELDS[view]||[]).forEach(id=>{const node=$(id);if(node&&saved[id]!==undefined)node.value=saved[id]});
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
function saveRestSession(){try{localStorage.setItem('aroa_firebase_id_token',restIdToken);localStorage.setItem('aroa_firebase_refresh_token',restRefreshToken)}catch(error){}}
function restoreRestSession(){try{restIdToken=localStorage.getItem('aroa_firebase_id_token')||sessionStorage.getItem('aroa_firebase_id_token')||'';restRefreshToken=localStorage.getItem('aroa_firebase_refresh_token')||sessionStorage.getItem('aroa_firebase_refresh_token')||''}catch(error){}}
function clearRestSession(){try{localStorage.removeItem('aroa_firebase_id_token');localStorage.removeItem('aroa_firebase_refresh_token');sessionStorage.removeItem('aroa_firebase_id_token');sessionStorage.removeItem('aroa_firebase_refresh_token')}catch(error){}restIdToken='';restRefreshToken=''}
restoreRestSession();
function fsEncode(value){if(value===null)return{nullValue:null};if(typeof value==='boolean')return{booleanValue:value};if(typeof value==='number')return{doubleValue:value};if(typeof value==='string')return{stringValue:value};if(Array.isArray(value))return{arrayValue:{values:value.map(fsEncode)}};if(typeof value==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,fsEncode(v)]))}};return{nullValue:null}}
function fsDecode(value){if(!value)return null;if('nullValue'in value)return null;if('booleanValue'in value)return value.booleanValue;if('integerValue'in value)return Number(value.integerValue);if('doubleValue'in value)return value.doubleValue;if('stringValue'in value)return value.stringValue;if('timestampValue'in value)return value.timestampValue;if('arrayValue'in value)return(value.arrayValue.values||[]).map(fsDecode);if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,fsDecode(v)]));return null}
async function restAuth(mode,password){const endpoint=mode==='create'?'accounts:signUp':'accounts:signInWithPassword';const response=await fetchWithTimeout('https://identitytoolkit.googleapis.com/v1/'+endpoint+'?key='+FIREBASE_CONFIG.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:FIREBASE_ALLOWED_EMAIL,password,returnSecureToken:true})});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error?.message||'AUTH_ERROR'),{code:data.error?.message});restIdToken=data.idToken;restRefreshToken=data.refreshToken;saveRestSession();return data}
let restRefreshInFlight=null;
async function refreshRestSession(){if(!restRefreshToken)throw new Error('FIREBASE_SESSION_EXPIRED');if(restRefreshInFlight)return restRefreshInFlight;restRefreshInFlight=(async()=>{const response=await fetchWithTimeout('https://securetoken.googleapis.com/v1/token?key='+FIREBASE_CONFIG.apiKey,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(restRefreshToken)});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error?.message||'TOKEN_REFRESH_ERROR'),{code:data.error?.message});restIdToken=data.id_token;restRefreshToken=data.refresh_token||restRefreshToken;saveRestSession();return data})().finally(()=>{restRefreshInFlight=null});return restRefreshInFlight}
async function restFetch(url,options={},retry=true){const headers={...(options.headers||{}),Authorization:'Bearer '+restIdToken};const response=await fetchWithTimeout(url,{...options,headers});if(response.status===401&&retry&&restRefreshToken){await refreshRestSession();return restFetch(url,options,false)}return response}
async function submitFirebaseRest(mode){const password=$('firebase-password')?.value||'';if(password.length<6){firebaseAuthMessage('La contraseña debe tener al menos 6 caracteres.');return}setFirebaseAuthBusy(true,mode);try{firebaseAuthMessage(mode==='create'?'Creando tu acceso…':'Entrando…');await restAuth(mode,password);closeFirebaseAuth(true);await finishFirebaseRest()}catch(error){const code=String(error.code||error.message||'');firebaseAuthMessage(code.includes('FIREBASE_QUOTA_EXCEEDED')?'Firebase ha alcanzado el límite diario. Los datos reales volverán a estar disponibles cuando se restablezca el servicio.':code.includes('EMAIL_EXISTS')?'Ese acceso ya existe. Pulsa Entrar.':code.includes('INVALID_PASSWORD')||code.includes('EMAIL_NOT_FOUND')||code.includes('INVALID_LOGIN_CREDENTIALS')?'La contraseña no es correcta o el acceso aún no existe.':code.includes('INVALID_API_KEY')?'La clave de Firebase no está autorizada para esta web.':code.includes('OPERATION_NOT_ALLOWED')?'El acceso por correo y contraseña no está habilitado.':'No se ha podido completar el acceso: '+(code||'error de conexión'))}finally{setFirebaseAuthBusy(false,mode)}}
function addFirebaseRestUI(){if($('firebase-auth'))return;document.body.insertAdjacentHTML('beforeend',`<div id="firebase-auth" class="modal" aria-hidden="true"><div class="modal-card pending-editor-card" role="dialog" aria-modal="true"><div class="modal-heading"><div><p class="eyebrow">ACCESO PRIVADO</p><h2>Entrar en Aroa Gestión</h2></div><button class="modal-close" type="button" aria-label="Cerrar" id="firebase-auth-close">×</button></div><p class="pending-editor-note">Usa el acceso de Optimizia para abrir y guardar tus datos en Firebase.</p><label class="editor-grid" style="display:grid;gap:6px;color:#557078;font-size:13px;font-weight:700">Correo electrónico<input value="${FIREBASE_ALLOWED_EMAIL}" disabled></label><label style="display:grid;gap:6px;margin-top:14px;color:#557078;font-size:13px;font-weight:700">Contraseña<input id="firebase-password" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres"></label><p id="firebase-auth-message" class="pending-editor-note" aria-live="polite"></p><div class="modal-actions"><button class="secondary" type="button" id="firebase-auth-cancel">Cancelar</button><button class="secondary" type="button" id="firebase-auth-create">Crear mi acceso</button><button class="primary" type="button" id="firebase-auth-login">Entrar</button></div></div></div>`);$('firebase-auth-close').addEventListener('click',closeFirebaseAuth);$('firebase-auth-cancel').addEventListener('click',closeFirebaseAuth);$('firebase-auth-login').addEventListener('click',()=>submitFirebaseRest('login'));$('firebase-auth-create').addEventListener('click',()=>submitFirebaseRest('create'));$('firebase-password').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('firebase-auth-login').click()}});const top=document.querySelector('.top-actions');if(top&&!$('firebase-auth-open')){const button=document.createElement('button');button.id='firebase-auth-open';button.className='refresh-button';button.textContent='Acceso privado';button.addEventListener('click',openFirebaseAuth);top.insertBefore(button,top.firstChild)}}
async function finishFirebaseRest(){
  firebaseUser={email:FIREBASE_ALLOWED_EMAIL};
  const ok=await loadRemoteData();
  if(ok){closeFirebaseAuth(true);unlockPrivateApp();await ensureEvidenceTestLine()}
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
  const center=[['Actividad','Categoría','Periodicidad','Última revisión','Próxima revisión','Responsable','Estado','Comentarios'],...centerRows.map(r=>[r.activity||'',r.category||'',r.frequency||'',r.last||'',r.next||'',r.owner||'',statusLabel(effectiveStatus(r)),r.action||''])];
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
  document.body.dataset.sync='ok';
  lastSuccessfulSyncAt=new Date();
  const time=lastSuccessfulSyncAt.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
  if($('sync-label'))$('sync-label').textContent=`${source} · sincronizado`;
  if($('top-sync-time'))$('top-sync-time').textContent=`Última comprobación: ${time}`;
  if($('sync-time'))$('sync-time').textContent=`Última comprobación: ${time}`;
}
function markSyncFailure(){
  document.body.dataset.sync='error';
  if($('sync-label'))$('sync-label').textContent='Firebase · revisar conexión';
  if($('top-sync-time'))$('top-sync-time').textContent='No se ha confirmado el último guardado';
  if($('sync-time'))$('sync-time').textContent='No se ha confirmado el último guardado';
}
function renderSimpleCenterSummary(){const panel=$('center-metrics');if(!panel)return;const overdue=centerRows.filter(isOverdue).length,soon=centerRows.filter(r=>dueTone(r)==='row-soon').length;panel.innerHTML=metric('Vencidas',overdue,'Revisiones fuera de plazo',true)+metric('Próximas',soon,'Dentro de 30 días')}
function separateCenterFilters(){const mode=$('center-view-mode');if(mode)mode.remove();const status=$('center-status');if(status){status.classList.remove('status-source');status.setAttribute('aria-label','Estado');status.innerHTML='<option value="all">Estado: Todos</option><option value="open">Estado: Pendientes</option><option value="process">Estado: En proceso</option><option value="done">Estado: Realizadas</option>';status.value='all'}let dates=$('center-date-filter');if(!dates){dates=document.createElement('select');dates.id='center-date-filter';dates.innerHTML='<option value="all">Fecha: Todas</option><option value="overdue">Fecha: Vencidas</option><option value="soon">Fecha: Próximas</option><option value="nodate">Fecha: Sin fecha</option>';status?.parentNode?.insertBefore(dates,status)}dates.classList.remove('status-source');dates.setAttribute('aria-label','Fecha');dates.onchange=()=>setCenterDateFilter(dates.value);if(status)status.onchange=()=>{window.centerQuickFilter=null;renderCenter();if(typeof saveViewFilters==='function')saveViewFilters('center')};const style=document.createElement('style');style.textContent='.status-source{position:absolute!important;opacity:0!important;width:1px!important;height:1px!important;pointer-events:none!important}.metric-grid{grid-template-columns:repeat(2,1fr)!important}@media(max-width:620px){.metric-grid{grid-template-columns:1fr!important}}';document.head.appendChild(style);renderSimpleCenterSummary()}
separateCenterFilters();
// Conserva la categoría elegida aunque la vista se redibuje al sincronizar o filtrar.

document.querySelector('#pending-metrics')?.remove();
function ensurePendingControls(){const view=$('pending-view'),toolbar=view?.querySelector('.toolbar');if(!view||!toolbar)return;const peopleTabs=$('people-tabs');if(peopleTabs){peopleTabs.hidden=true;peopleTabs.setAttribute('aria-hidden','true');peopleTabs.innerHTML=''}let person=$('pending-person');if(!person){person=document.createElement('select');person.id='pending-person';person.setAttribute('aria-label','Persona o empresa');toolbar.insertBefore(person,toolbar.querySelector('#pending-priority')||null);person.addEventListener('change',event=>{window.person=event.target.value;renderPending()})}let sort=$('pending-sort');if(!sort){sort=document.createElement('select');sort.id='pending-sort';sort.setAttribute('aria-label','Ordenar seguimientos');sort.innerHTML='<option value="person">Ordenar: Persona</option><option value="priority">Ordenar: Prioridad</option><option value="date">Ordenar: Fecha objetivo</option>';toolbar.insertBefore(sort,toolbar.querySelector('[data-pending-reset]')||null);sort.addEventListener('change',renderPending)}const status=$('pending-status');if(status){const selectedStatus=status.value||'PENDIENTE';status.innerHTML='<option value="all">Todos los estados</option><option value="PENDIENTE">Pendientes</option><option value="EN PROCESO">En proceso</option><option value="REALIZADO">Realizadas</option>';status.value=selectedStatus;status.setAttribute('aria-label','Estado')}view.querySelectorAll('.panel-heading p').forEach(node=>{if(/^Fuentes:/i.test(node.textContent||''))node.remove()});if(!toolbar.querySelector('[data-pending-reset]')){const button=document.createElement('button');button.type='button';button.className='secondary filter-reset';button.dataset.pendingReset='true';button.textContent='Limpiar filtros';button.addEventListener('click',resetPendingFilters);toolbar.appendChild(button)}}



function renderPending(){
  ensurePendingControls();refreshPendingPersonSelect();
  const table=$('pending-table');
  if(!table)return;
  const peopleTabs=$('people-tabs');
  if(peopleTabs){peopleTabs.hidden=true;peopleTabs.setAttribute('aria-hidden','true');peopleTabs.innerHTML=''}
  const statusSelect=$('pending-status');
  if(statusSelect){const selectedStatus=statusSelect.value||'PENDIENTE';statusSelect.innerHTML='<option value="all">Todos los estados</option><option value="PENDIENTE">Pendientes</option><option value="EN PROCESO">En proceso</option><option value="REALIZADO">Realizadas</option>';statusSelect.value=selectedStatus}
  const q=String($('pending-search')?.value||'').trim().toLocaleLowerCase('es');
  const person=$('pending-person')?.value||window.person||'all';
  const priority=$('pending-priority')?.value||'all';
  const state=$('pending-status')?.value||'all';
  window.person=person;
  const rows=pendingRows.filter(r=>(person==='all'||String(r.person||'')===person)&&(priority==='all'||r.priority===priority)&&(state==='all'||r.status===state)&&[r.person,r.text,r.priority,r.date,r.comments].join(' ').toLocaleLowerCase('es').includes(q));
  const sortMode=$('pending-sort')?.value||'person';
  const priorityRank={ALTA:0,NORMAL:1};
  rows.sort((a,b)=>{if(sortMode==='priority')return (priorityRank[a.priority]??9)-(priorityRank[b.priority]??9)||String(a.person||'').localeCompare(String(b.person||''),'es');if(sortMode==='date'){const parse=v=>{const m=String(v||'').match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?new Date(`${m[3]}-${m[2]}-${m[1]}`).getTime():Number.MAX_SAFE_INTEGER};return parse(a.date)-parse(b.date)||String(a.person||'').localeCompare(String(b.person||''),'es')}return String(a.person||'').localeCompare(String(b.person||''),'es')||String(a.date||'').localeCompare(String(b.date||''),'es')});
  table.innerHTML=rows.length?rows.map(r=>{
    const i=pendingRows.indexOf(r);
    const status=r.status==='REALIZADO'?'<span class="status done">REALIZADO</span>':r.status==='EN PROCESO'?'<span class="status process">EN PROCESO</span>':'<span class="status open"><span class="status-dot"></span>PENDIENTE</span>';
    return `<tr class="group-colored" style="${groupColorStyle(r.person)}"><td>${status}</td><td>${htmlEscape(r.text||'')}</td><td><strong class="group-label">${htmlEscape(r.person||'Sin asignar')}</strong></td><td><span class="priority ${r.priority==='ALTA'?'priority-high':''}">${htmlEscape(r.priority||'NORMAL')}</span></td><td class="date">${htmlEscape(r.date||'Sin fecha')}</td><td class="date">${htmlEscape(r.updated||'Sin fecha')}</td><td>${htmlEscape(r.comments||'Sin comentarios')}</td><td><button type="button" class="edit-btn" onclick="openPendingEditor(${i})">Editar</button></td></tr>`;
  }).join(''):'<tr><td colspan="8" class="empty">No hay resultados con estos filtros.</td></tr>';
  if($('pending-heading'))$('pending-heading').textContent=person==='all'?'Todos los seguimientos':`Seguimientos con ${person}`;
  let summary=$('pending-filter-summary');if(!summary){summary=document.createElement('span');summary.id='pending-filter-summary';summary.className='filter-summary';$('pending-heading')?.parentElement?.appendChild(summary)}
  const active=[];if(person!=='all')active.push(person);if(priority!=='all')active.push(priority==='ALTA'?'Prioridad alta':'Prioridad normal');if(state!=='all')active.push(state==='PENDIENTE'?'Pendientes':state==='REALIZADO'?'Realizadas':'En proceso');summary.textContent=active.length?`Filtrado: ${active.join(' · ')}`:'Mostrando todos los estados';
  if($('pending-count'))$('pending-count').textContent=`${rows.length} registros`;
}

function refreshPendingPersonSelect(){
 const select=$('pending-person');if(!select)return;
 const selected=window.person||'all';
 const people=[...new Set(pendingRows.map(r=>r.person).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 select.innerHTML='<option value="all">Todas las personas</option>'+people.map(p=>`<option value="${htmlEscape(p)}">${htmlEscape(p)}</option>`).join('');
 select.value=people.includes(selected)?selected:'all';window.person=select.value;
}
function resetPendingFilters(){window.person='all';$('pending-search').value='';$('pending-priority').value='all';$('pending-status').value='all';if($('pending-person'))$('pending-person').value='all';if($('pending-sort'))$('pending-sort').value='person';renderPending();saveViewFilters('pending')}
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
 const rows=centerRows.filter(r=>(select.value==='all'||canonicalCategory(r.category)===select.value)&&(state==='all'||effectiveStatus(r)===state)&&[r.activity,r.category,r.frequency,r.last,r.next,r.owner,r.type,r.provider,r.action].join(' ').toLocaleLowerCase('es').includes(q)&&
 (date==='all'||date==='overdue'&&isOverdue(r)||date==='soon'&&dueTone(r)==='row-soon'||date==='nodate'&&!r.next||date==='dated'&&!!r.next)).sort((a,b)=>{const av=sortValue(a,'next'),bv=sortValue(b,'next');return av>bv?1:av<bv?-1:0});
 $('center-table').innerHTML=rows.length?rows.map(r=>`<tr class="${dueTone(r)}"><td>${htmlEscape(r.activity)}</td><td>${htmlEscape(canonicalCategory(r.category))}</td><td>${htmlEscape(r.frequency||'Sin periodicidad')}</td><td><span class="maintenance-pill ${String(r.type||'').toLowerCase()}">${htmlEscape(r.type==='EXTERNO'?'Externo':r.type==='INTERNO'?'Interno':'Sin indicar')}</span>${r.type==='EXTERNO'&&r.provider?`<small class="provider-name">${htmlEscape(r.provider)}</small>`:''}</td><td class="date">${htmlEscape(displayDate(r.last)||'Sin fecha')}</td><td class="date">${htmlEscape(displayDate(r.next)||'Sin fecha')}${isOverdue(r)?' <span class="overdue-label">VENCIDA</span>':''}</td><td>${htmlEscape(canonicalOwner(r.owner)||'Sin asignar')}</td><td>${statusTag(effectiveStatus(r))}</td><td>${htmlEscape(r.action||'Sin comentarios')}</td><td><button class="edit-btn" onclick="openCenterEditor(${centerRows.indexOf(r)})">Editar</button></td></tr>`).join(''):'<tr><td colspan="10" class="empty">No hay resultados con estos filtros.</td></tr>';
 $('center-count').textContent=`${rows.length} registros`;
}
function refreshKURROMetrics(){renderSimpleCenterSummary()}
let dataLoadInFlight=null;
async function refreshKURROFromFirebase(silent=false){
 if(!firebaseUser||editorBusy||directoryImportBusy||kurroRefreshInFlight||document.querySelector('.modal.open'))return false;
 kurroRefreshInFlight=true;
 try{let ok=await loadRemoteData();if(ok)await ensureEvidenceTestLine();if($('directory-view')?.classList.contains('active-view')){if(!silent)directoryLoaded=false;ok=await loadDirectoryFromFirebase()&&ok}if(!silent&&ok)showSyncToast('Datos actualizados desde Firebase');return ok}finally{kurroRefreshInFlight=false}
}
try{init();ensureClientControls();ensurePendingControls()}catch(error){console.error('No se pudo preparar una vista inicial',error)}
$('pending-person').addEventListener('change',event=>{window.person=event.target.value;renderPending()});
$('client-filter-client').addEventListener('change',renderClients);
$('center-date-filter').addEventListener('change',renderCenter);
$('center-sort')?.remove();
renderCenter();renderPending();renderClients();
startFirebaseRest();
function init(){
 window.person='all';
 const accountLabelObserver=new MutationObserver(()=>{const account=$('firebase-auth-open');if(account&&account.textContent!=='Cuenta')account.textContent='Cuenta'});
 accountLabelObserver.observe(document.body,{childList:true,subtree:true});
 document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.nav-item').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-current',b===button?'page':'false')});
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active-view',v.id===button.dataset.view+'-view'));
  $('page-title').textContent={center:'Control del centro',pending:'Seguimientos',clients:'Gestiones de clientes',directory:'Directorio'}[button.dataset.view];
  if(button.dataset.view==='directory')loadDirectoryFromFirebase();
 }));
 ['center-search','center-category','center-status'].forEach(id=>$(id)?.addEventListener('input',()=>{renderCenter();saveViewFilters('center')}));
 ['pending-search','pending-priority','pending-status'].forEach(id=>$(id)?.addEventListener('input',()=>{renderPending();saveViewFilters('pending')}));
 ['client-search','client-filter-client','client-priority','client-status'].forEach(id=>$(id)?.addEventListener('input',()=>{renderClients();saveViewFilters('clients')}));
 document.addEventListener('change',event=>{if(event.target?.id==='pending-person'||event.target?.id==='pending-sort')saveViewFilters('pending')});
 if(EVIDENCE_ENABLED)ensureEvidenceControls();
 if(EVIDENCE_ENABLED)document.addEventListener('click',event=>{if(!$('center-editor')?.classList.contains('open'))return;const target=event.target?.closest?.('.edit-btn,[data-new-center]');if(!target)return;if(centerEditorIndex<0)window.pendingEvidenceMetadata=null;showEvidence(centerEditorIndex>=0?centerRows[centerEditorIndex]?.evidence:null)});
 if(EVIDENCE_ENABLED)document.addEventListener('click',async event=>{const link=event.target?.closest?.('#edit-evidence-view');if(!link||link.hidden)return;event.preventDefault();const popup=window.open('about:blank','_blank');try{const url=new URL(link.href);const prefix=`/v0/b/${FIREBASE_CONFIG.storageBucket}/o/`;if(url.hostname!=='firebasestorage.googleapis.com'||!url.pathname.startsWith(prefix))throw new Error();const response=await fetch(url.href,{headers:{Authorization:'Bearer '+restIdToken}});if(!response.ok)throw new Error();const blob=await response.blob();const objectUrl=URL.createObjectURL(blob);if(popup&&!popup.closed)popup.location.href=objectUrl;else window.location.href=objectUrl;setTimeout(()=>URL.revokeObjectURL(objectUrl),60000)}catch(error){if(popup&&!popup.closed)popup.close();showSyncToast('No se ha podido abrir la evidencia. Comprueba la sesión.')}});
 restoreViewFilters('center');restoreViewFilters('pending');restoreViewFilters('clients');
 $('pending-status').value='all';
 window.person=$('pending-person')?.value||'all';
 renderCenter();renderPending();renderClients();renderDirectory();
}

// Allocate colors from the complete canonical list, consistently on every device.
function groupColorStyle(name){
 const key=String(name||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
 if(!key)return '--group-bg:#f4f6f7;--group-accent:#687980;--group-chip:#e8edef';
 const names=[...new Set([...pendingRows.map(r=>r.person),...clientRows.map(r=>r.client)]
  .map(v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es')).filter(Boolean))].sort();
 const assigned=Object.fromEntries(names.map((name,index)=>[name,index]));
 const hues=[210,25,145,280,48,180,335,245,85,0,305,165];
 const index=assigned[key]??0,hue=hues[index%hues.length];
 const light=89-Math.floor(index/hues.length)%3*4;
 return `--group-bg:hsl(${hue} 65% ${light}%);--group-accent:hsl(${hue} 68% 32%);--group-chip:hsl(${hue} 65% 80%)`;
}

// Confirmed application state and conditional writes. Drafts remain in forms.
let appRevision=null, appDocument={}, editorBusy=false, directoryImportBusy=false;
let uncertainSave=null,uncertainIntent=null;
function fireFields(value){return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,fsEncode(v)]))}
function documentURL(collection,id){return `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collection}/${id}`}
async function readDocument(collection,id){
 const response=await restFetch(documentURL(collection,id));
 if(response.status===404)return null;
 if(!response.ok)throw new Error(response.status===429?'Se ha alcanzado el límite de Firebase.':'No se pudo leer Firebase.');
 const doc=await response.json();
 return {value:fsDecode({mapValue:{fields:doc.fields||{}}}),revision:doc.updateTime};
}
async function writeDocument(collection,id,value,revision){
 const condition=revision?{'currentDocument.updateTime':revision}:{'currentDocument.exists':'false'};
 const response=await restFetch(documentURL(collection,id)+'?'+new URLSearchParams(condition),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:fireFields(value)})});
 if(!response.ok){const error=new Error([409,412].includes(response.status)?'CONFLICT':'No se pudo confirmar el guardado.');error.status=response.status;throw error}
 const doc=await response.json();
 return {value:fsDecode({mapValue:{fields:doc.fields||{}}}),revision:doc.updateTime};
}
function applyConfirmedDocument(doc){
 const value=doc.value;
 if(!doc.revision||!['center','pending','clients'].every(key=>Array.isArray(value[key])))throw new Error('Los datos recibidos están incompletos.');
 appRevision=doc.revision;appDocument=structuredClone(value);
 centerRows.splice(0,centerRows.length,...value.center);pendingRows.splice(0,pendingRows.length,...value.pending);clientRows.splice(0,clientRows.length,...value.clients);
 remoteKurroLists=structuredClone(value.lists||{});clientsLoading=false;
 refreshKurroPeopleOptions();refreshClientOptions();refreshKURROMetrics();renderCenter();renderPending();renderClients();
 markSyncSuccess();setDataAlert('');
}
async function loadRemoteData(){
 if(!firebaseUser||editorBusy||document.querySelector('#center-editor.open,#pending-editor.open,#client-editor.open'))return false;
 if(dataLoadInFlight)return dataLoadInFlight;
 const revisionBefore=appRevision;
 dataLoadInFlight=(async()=>{try{
  const doc=await readDocument('appState','main');if(!doc)throw new Error('Firebase no contiene el documento de datos.');
  if(appRevision!==revisionBefore||editorBusy||document.querySelector('#center-editor.open,#pending-editor.open,#client-editor.open'))return false;
  applyConfirmedDocument(doc);
  const seen={}; const restored=centerRows.map(row=>{const meta=maintenanceMetaFor(row,seen);if(!meta)return row;const next={...row};if(!String(next.type||'').trim()&&meta[0])next.type=meta[0];if(next.type==='INTERNO')next.provider='';else if(!String(next.provider||'').trim()&&meta[1])next.provider=meta[1];return next});
  if(JSON.stringify(restored)!==JSON.stringify(centerRows)){const payload=structuredClone(appDocument);payload.center=restored;payload.updated=new Date().toISOString();payload.lastMutation=crypto.randomUUID();try{const confirmed=await writeDocument('appState','main',payload,appRevision);applyConfirmedDocument(confirmed)}catch(error){console.warn('No se pudieron restaurar los campos de mantenimiento',error)}}
  return true;
 }catch(error){clientsLoading=false;renderClients();markSyncFailure();setDataAlert('No se han podido actualizar los datos de Firebase. Se conserva la última lectura de esta sesión. Pulsa Actualizar para reintentarlo.');return false}
 finally{dataLoadInFlight=null}})();return dataLoadInFlight;
}
function editorMessage(modal,text){
 if(text==='')modal.dataset.dirty='false';
 let node=modal.querySelector('.save-feedback');
 if(!node){node=document.createElement('p');node.className='save-feedback';node.setAttribute('role','status');modal.querySelector('.modal-actions').before(node)}
 node.textContent=text;
}
function setEditorBusy(modal,busy){
 editorBusy=busy;modal.setAttribute('aria-busy',String(busy));
 modal.querySelectorAll('button,input,select,textarea').forEach(node=>{if(busy){node.dataset.wasDisabled=String(node.disabled);node.disabled=true}else{node.disabled=node.dataset.wasDisabled==='true';delete node.dataset.wasDisabled}});
}
async function commitEditor(kind,index,changes,modalId,close,remove=false){
 if(editorBusy)return;
 const modal=$(modalId);
 if(!firebaseUser||!appRevision){editorMessage(modal,'Actualiza los datos de Firebase antes de guardar.');return}
 const rows={center:centerRows,pending:pendingRows,clients:clientRows}[kind];
 const oldEvidence=kind==='center'&&index>=0?rows[index]?.evidence:null;
 if(index>=0&&!rows[index]){editorMessage(modal,'Este registro ya no está disponible.');return}
 const payload=structuredClone(appDocument);
 if(kind==='center'&&window.pendingEvidenceMetadata)changes.evidence=window.pendingEvidenceMetadata;
 if(kind==='center'&&window._sharepointUrlToSave!==undefined){changes.sharepointUrl=window._sharepointUrlToSave;window._sharepointUrlToSave=undefined}
 if(kind==='center'&&index<0&&!changes.id)changes.id=crypto.randomUUID();
 payload[kind]=rows.map(row=>({...row}));
 if(remove)payload[kind].splice(index,1);
 else if(index<0)payload[kind].push({...changes,id:changes.id||crypto.randomUUID()});
 else payload[kind][index]={...payload[kind][index],...changes};
 payload.lists=mergedKurroLists();payload.updated=new Date().toISOString();payload.lastMutation=crypto.randomUUID();
 const revision=appRevision,intent=JSON.stringify({kind,index,changes,remove});
 setEditorBusy(modal,true);editorMessage(modal,remove?'Eliminando…':'Guardando…');
 try{
  if(uncertainSave){
   const current=await readDocument('appState','main');
   if(current?.value.lastMutation===uncertainSave.lastMutation){
    const sameIntent=uncertainIntent===intent;
    uncertainSave=null;uncertainIntent=null;
    if(!sameIntent){
     appRevision=null;
     editorMessage(modal,'El intento anterior sí se guardó. Conserva los cambios posteriores de este formulario, cancela y pulsa Actualizar antes de volver a editar.');return;
    }
    applyConfirmedDocument(current);setEditorBusy(modal,false);modal.dataset.dirty="false";close();showSyncToast('Guardado confirmado');return;
   }
   uncertainSave=null;
  }
  uncertainSave=payload;uncertainIntent=intent;
  const confirmed=await writeDocument('appState','main',payload,revision);
  if(oldEvidence&&changes.evidence&&oldEvidence.path!==changes.evidence.path)deleteEvidence(oldEvidence).catch(()=>{});
  uncertainSave=null;applyConfirmedDocument(confirmed);setEditorBusy(modal,false);modal.dataset.dirty="false";close();showSyncToast(remove?'Registro eliminado':'Cambios guardados');
 }catch(error){
  if(error.message==='CONFLICT')uncertainSave=null;
  markSyncFailure();
  editorMessage(modal,error.message==='CONFLICT'?'Hay cambios más recientes en Firebase. Tu formulario sigue intacto: copia lo que necesites, cancela y pulsa Actualizar antes de volver a editar.':'No se ha confirmado el guardado. Tu formulario sigue intacto. Comprueba la conexión y vuelve a pulsar Guardar.');
 }finally{setEditorBusy(modal,false)}
}
async function saveCenterEditorFlexible(){
 const frequency=$('edit-frequency').value==='custom'?$('edit-frequency-custom').value.trim():$('edit-frequency').value;
 const providerValue=$('edit-provider')?.value.trim()||'';const changes={activity:$('edit-activity').value.trim(),category:$('edit-category').value.trim()||'Otros',frequency,last:$('edit-last').value?dateFromEditor($('edit-last').value):'',next:$('edit-next').value?dateFromEditor($('edit-next').value):'',owner:$('edit-owner').value.trim(),type:$('edit-type')?.value||'INTERNO',provider:providerValue==='Ninguno'?'':providerValue,action:$('edit-action').value,status:$('edit-status').value};
 if(!changes.activity){editorMessage($('center-editor'),'Escribe una actividad.');return}
 if(changes.status==='done'&&(!changes.last||isOverdue(changes))){editorMessage($('center-editor'),'Para marcarla como realizada indica una fecha válida y revisa el próximo vencimiento.');return}
 return commitEditor('center',centerEditorIndex,changes,'center-editor',closeCenterEditor);
}
async function savePendingEditor(){
 const text=$('pending-edit-text').value.trim();if(!text){editorMessage($('pending-editor'),'Escribe el pendiente.');return}
 return commitEditor('pending',pendingEditorIndex,{text,person:$('pending-edit-person').value,priority:$('pending-edit-priority').value,status:$('pending-edit-status').value,date:$('pending-edit-date').value?pendingDateFromEditor($('pending-edit-date').value):'',comments:$('pending-edit-comments').value,updated:formatDate(new Date())},'pending-editor',closePendingEditor);
}
async function saveClientEditor(){
 const text=$('client-edit-text').value.trim();if(!text){editorMessage($('client-editor'),'Escribe la gestión.');return}
 return commitEditor('clients',clientEditorIndex,{text,client:$('client-edit-client').value,contact:$('client-edit-contact').value.trim(),priority:$('client-edit-priority').value,status:$('client-edit-status').value,date:$('client-edit-date').value?clientDateFromEditor($('client-edit-date').value):'',comments:$('client-edit-comments').value,updated:formatDate(new Date())},'client-editor',closeClientEditor);
}
async function deleteCenterEditor(){if(centerEditorIndex>=0&&confirm('¿Quieres eliminar esta actividad?'))return commitEditor('center',centerEditorIndex,null,'center-editor',closeCenterEditor,true)}
async function deleteClientEditor(){if(clientEditorIndex>=0&&confirm('¿Quieres eliminar esta gestión?'))return commitEditor('clients',clientEditorIndex,null,'client-editor',closeClientEditor,true)}
async function importDirectoryWorkbook(file){
 if(directoryImportBusy)return;
 if(!firebaseUser){openFirebaseAuth();return}
 if(typeof XLSX==='undefined'){showSyncToast('No se puede leer el Excel en este momento.');return}
 directoryImportBusy=true;directoryEpoch++;const button=$('directory-import-button');if(button)button.disabled=true;
 let activated=false;
 try{
  const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
  const values=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false});
  const headers=(values.shift()||[]).map(v=>String(v??'').trim());
  const rows=values.filter(row=>row.some(v=>String(v??'').trim())).map(row=>headers.map((_,i)=>String(row[i]??'').trim()));
  const previous=await readDocument(DIRECTORY_META_COLLECTION,'main');
  if(headers.length!==30||!rows.length)throw new Error('El archivo debe contener las 30 columnas del directorio y al menos un cliente.');
  if(previous?.value.headers?.length&&JSON.stringify(previous.value.headers)!==JSON.stringify(headers))throw new Error('Las columnas no coinciden con el directorio actual. Usa el mismo orden y los mismos encabezados.');
  if(!confirm(`Se importarán ${rows.length} clientes de ${file.name}. El archivo sustituirá al directorio actual solo cuando termine la carga. ¿Continuar?`))return;
  showSyncToast('Importando directorio…');
  const version=crypto.randomUUID(),chunkIds=[];
  for(let offset=0;offset<rows.length;offset+=DIRECTORY_CHUNK_SIZE){
   const id=`v-${version}-${chunkIds.length}`;chunkIds.push(id);
   await writeDocument(DIRECTORY_COLLECTION,id,{payload:JSON.stringify(rows.slice(offset,offset+DIRECTORY_CHUNK_SIZE))},null);
  }
  const meta={headers,count:rows.length,chunks:chunkIds.length,chunkIds,version,updated:new Date().toISOString(),previous:previous?.value||null};
  // Keep only one prior manifest; its immutable chunks remain recoverable.
  if(meta.previous)delete meta.previous.previous;
  try{await writeDocument(DIRECTORY_META_COLLECTION,'main',meta,previous?.revision||null);activated=true}
  catch(error){const current=await readDocument(DIRECTORY_META_COLLECTION,'main');if(current?.value.version===version)activated=true;else throw error}
  directoryHeaders=headers;directoryRows.splice(0,directoryRows.length,...rows);directoryLoaded=true;directoryError='';directoryPage=1;renderDirectory();
  setDataAlert('');showSyncToast(`Directorio importado: ${rows.length} clientes`);
 }catch(error){showSyncToast(error.message==='CONFLICT'?'Otra importación ha actualizado el directorio. Recarga antes de reintentarlo.':error.message);setDataAlert('La importación no se ha confirmado. Pulsa Actualizar para comprobar qué directorio está activo.');}
 finally{directoryImportBusy=false;if(button)button.disabled=false}
}

async function fetchWithTimeout(url,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{return await fetch(url,{...options,signal:options.signal||controller.signal})}finally{clearTimeout(timer)}
}
function allowEditorClose(id){
 if(editorBusy)return false;
 const modal=$(id);
 if(modal.dataset.dirty==='true'&&!confirm('Hay cambios sin guardar. ¿Quieres descartarlos y cerrar?'))return false;
 modal.dataset.dirty='false';uncertainSave=null;uncertainIntent=null;return true;
}
for(const id of ['center-editor','pending-editor','client-editor']){
 const modal=$(id);for(const event of ['input','change'])modal.addEventListener(event,()=>{modal.dataset.dirty='true'});
}
window.addEventListener('beforeunload',event=>{
 if(editorBusy||directoryImportBusy||document.querySelector('.modal.open[data-dirty="true"]')){event.preventDefault();event.returnValue=''}
});

async function deletePendingEditor(){if(editorBusy)return;if(pendingEditorIndex>=0&&confirm('¿Quieres eliminar este seguimiento? Esta acción no se puede deshacer.'))return commitEditor('pending',pendingEditorIndex,null,'pending-editor',closePendingEditor,true)}
