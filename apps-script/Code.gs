const CONFIG = {
  sourceId: '1AiIsFZCyZVp4ERTi0ExreV10StjayEw9tLWv4W21foQ',
  planningSheet: 'Registro Maestro',
  pendingSheet: 'Seguimientos',
  clientsSheet: 'Clientes',
  configSheet: 'Listas',
  allowedEmail: 'optimizia.agents@gmail.com'
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.api) {
    let result;
    if (p.api === 'data') result = getAppData();
    else if (p.api === 'config') result = getConfig();
    else if (p.api === 'updateConfig') result = updateConfigOption(p.type, p.value || '');
    else if (p.api === 'updatePending') result = updatePendingField(p.fileId, p.row, p.field, p.value || '');
    else if (p.api === 'updateClient') result = updateClientField(p.fileId, p.row, p.field, p.value || '');
    else if (p.api === 'updateCell') result = updateCell(p.fileId, p.sheetName || '', p.row, p.column, p.value || '');
    else if (p.api === 'markPlanningDone') result = markPlanningDone(p.row, p.dateText);
    else throw new Error('Acción no válida');
    const body = JSON.stringify({ok: true, result});
    const callback = p.callback || 'kurroCallback';
    return ContentService.createTextOutput(callback + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  assertAllowed_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Aroa Rodríguez · Gestión del centro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function readSheet_(id, sheetName) {
  const book = SpreadsheetApp.openById(id);
  const sheet = sheetName ? book.getSheetByName(sheetName) : book.getSheets()[0];
  return {id, name: sheet.getName(), values: sheet.getDataRange().getDisplayValues()};
}

function assertAllowed_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (email !== CONFIG.allowedEmail) throw new Error('Acceso no autorizado');
}

function sourceSheet_(name) {
  const book = SpreadsheetApp.openById(CONFIG.sourceId);
  const sheet = book.getSheetByName(name);
  if (!sheet) throw new Error('Pestaña no encontrada: ' + name);
  return sheet;
}

function pendingView_(person) {
  const sheet = sourceSheet_(CONFIG.pendingSheet);
  const values = sheet.getDataRange().getDisplayValues();
  const header = values[0] || [];
  const personCol = header.indexOf('Persona o empresa');
  const statusCol = header.indexOf('Estado');
  const commentsCol = header.indexOf('Comentarios');
  const taskCol = header.indexOf('Pendiente / decisión');
  const priorityCol = header.indexOf('Prioridad');
  const targetCol = header.indexOf('Fecha objetivo');
  const updatedCol = header.indexOf('Actualización');
  const closedCol = header.indexOf('Cerrado');
  const rows = values.slice(1).map((row, index) => ({row, index: index + 2})).filter(item => String(item.row[personCol] || '').trim() === person);
  return {
    id: CONFIG.sourceId,
    name: CONFIG.pendingSheet,
    values: [
      ['Estado', 'Comentarios', 'Pendiente / decisión', 'Prioridad', 'Fecha objetivo', 'Actualización', 'Cerrado', '_fila_origen'],
      ...rows.map(item => [
        item.row[statusCol] || '', item.row[commentsCol] || '', item.row[taskCol] || '',
        item.row[priorityCol] || '', item.row[targetCol] || '', item.row[updatedCol] || '',
        item.row[closedCol] || '', item.index
      ])
    ]
  };
}

function getAppData() {
  assertAllowed_();
  return {
    planning: readSheet_(CONFIG.sourceId, CONFIG.planningSheet),
    miguel: pendingView_('Miguel'),
    properval: pendingView_('Properval'),
    clients: readSheet_(CONFIG.sourceId, CONFIG.clientsSheet),
    generatedAt: new Date().toISOString()
  };
}

function getConfig() {
  assertAllowed_();
  return readSheet_(CONFIG.sourceId, CONFIG.configSheet);
}

function updateConfigOption(type, value) {
  assertAllowed_();
  const allowed = ['categoria', 'prioridad', 'responsable', 'persona', 'client'];
  const cleanType = String(type || '').trim().toLowerCase();
  const cleanValue = String(value || '').trim();
  if (!allowed.includes(cleanType) || !cleanValue) throw new Error('Opción no válida');
  const sheet = sourceSheet_(CONFIG.configSheet);
  const values = sheet.getDataRange().getDisplayValues();
  const exists = values.slice(1).some(row => String(row[0]).toLowerCase() === cleanType && String(row[1]).trim().toLowerCase() === cleanValue.toLowerCase() && String(row[2]).toUpperCase() !== 'FALSE');
  if (!exists) sheet.appendRow([cleanType, cleanValue, true, values.length, 'Añadido desde la aplicación']);
  return {ok: true, type: cleanType, value: cleanValue};
}

function updateClientField(fileId, row, field, value) {
  assertAllowed_();
  if (String(fileId) !== CONFIG.sourceId) throw new Error('Archivo no permitido');
  const sheet = sourceSheet_(CONFIG.clientsSheet);
  const map = {status:1, client:2, contact:3, task:4, priority:5, target:6, updated:7, comments:8, closed:9};
  if (!map[field]) throw new Error('Campo no permitido');
  sheet.getRange(Number(row), map[field]).setValue(value || '');
  return {ok:true, field, updatedAt:new Date().toISOString()};
}

function updateCell(fileId, sheetName, row, column, value) {
  assertAllowed_();
  if (String(fileId) !== CONFIG.sourceId || ![CONFIG.planningSheet, CONFIG.pendingSheet, CONFIG.clientsSheet, CONFIG.configSheet].includes(sheetName)) throw new Error('Destino no permitido');
  const sheet = sourceSheet_(sheetName);
  sheet.getRange(Number(row), Number(column)).setValue(value);
  return {ok: true, updatedAt: new Date().toISOString()};
}

function updatePendingField(fileId, row, field, value) {
  assertAllowed_();
  if (String(fileId) !== CONFIG.sourceId) throw new Error('Archivo no permitido');
  const sheet = sourceSheet_(CONFIG.pendingSheet);
  const r = Number(row);
  const map = {person: 'Persona o empresa', status: 'Estado', comments: 'Comentarios', task: 'Pendiente / decisión', priority: 'Prioridad', target: 'Fecha objetivo', updated: 'Actualización', closed: 'Cerrado'};
  const column = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].indexOf(map[field]) + 1;
  if (!column) throw new Error('Campo no permitido');
  sheet.getRange(r, column).setValue(value || '');
  return {ok: true, field, updatedAt: new Date().toISOString()};
}

function markPlanningDone(row, dateText) {
  assertAllowed_();
  const sheet = sourceSheet_(CONFIG.planningSheet);
  const r = Number(row);
  const frequency = String(sheet.getRange(r, 3).getDisplayValue() || '').toLowerCase();
  const date = new Date(dateText + 'T12:00:00');
  if (isNaN(date.getTime())) throw new Error('Fecha no válida');
  let next = null;
  const months = frequency.includes('bimes') ? 2 : frequency.includes('trimes') ? 3 : frequency.includes('semes') ? 6 : frequency.includes('mens') ? 1 : frequency.includes('5 años') ? 60 : frequency.includes('3 años') ? 36 : (frequency.includes('anual') || frequency.includes('año')) ? 12 : null;
  if (frequency.includes('seman')) date.setDate(date.getDate() + 7), next = date;
  else if (months) { next = new Date(date); next.setMonth(next.getMonth() + months); }
  sheet.getRange(r, 4).setValue(dateText);
  if (next) sheet.getRange(r, 5).setValue(Utilities.formatDate(next, Session.getScriptTimeZone(), 'dd/MM/yyyy'));
  // El estado de planificación se conserva en la columna del año actual.
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const yearColumn = headers.indexOf(String(new Date().getFullYear())) + 1;
  if (yearColumn > 0) sheet.getRange(r, yearColumn).setValue('REALIZADO');
  return {ok: true, next: next ? Utilities.formatDate(next, Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''};
}

function exportPlanningXlsx() {
  const url = 'https://docs.google.com/spreadsheets/d/' + CONFIG.sourceId + '/export?format=xlsx';
  const response = UrlFetchApp.fetch(url, {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}});
  const blob = response.getBlob().setName('Planificación General Sales Center Fuenlabrada.xlsx');
  return {name: blob.getName(), mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes())};
}
