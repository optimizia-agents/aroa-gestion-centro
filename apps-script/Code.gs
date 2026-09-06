const CONFIG = {
  planningId: '1AiIsFZCyZVp4ERTi0ExreV10StjayEw9tLWv4W21foQ',
  planningSheet: 'Registro Maestro',
  miguelId: '1XYm5UjRaFjbOL2mMxgEI5FaENbN5CNExHRTBqc481SI',
  propervalId: '1QKJDejpfH7wuSCQXwH1465k5Q363F32IJ45B9w7EIqs',
  clientsId: '1hSQQSyeWiJ03Hf76s0X4pbYANMDAUwygN6pOUbQNNtY'
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.api) {
    let result;
    if (p.api === 'data') result = getAppData();
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
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Aroa Rodríguez · Gestión del centro')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function readSheet_(id, sheetName) {
  const book = SpreadsheetApp.openById(id);
  const sheet = sheetName ? book.getSheetByName(sheetName) : book.getSheets()[0];
  return {id, name: sheet.getName(), values: sheet.getDataRange().getDisplayValues()};
}

function getAppData() {
  return {
    planning: readSheet_(CONFIG.planningId, CONFIG.planningSheet),
    miguel: readSheet_(CONFIG.miguelId),
    properval: readSheet_(CONFIG.propervalId),
    clients: readSheet_(CONFIG.clientsId),
    generatedAt: new Date().toISOString()
  };
}

function updateClientField(fileId, row, field, value) {
  if (String(fileId) !== CONFIG.clientsId) throw new Error('Archivo no permitido');
  const sheet = SpreadsheetApp.openById(fileId).getSheets()[0];
  const map = {status:1, client:2, contact:3, task:4, priority:5, target:6, updated:7, comments:8, closed:9};
  if (!map[field]) throw new Error('Campo no permitido');
  sheet.getRange(Number(row), map[field]).setValue(value || '');
  return {ok:true, field, updatedAt:new Date().toISOString()};
}

function updateCell(fileId, sheetName, row, column, value) {
  const book = SpreadsheetApp.openById(fileId);
  const sheet = book.getSheetByName(sheetName) || book.getSheets()[0];
  sheet.getRange(Number(row), Number(column)).setValue(value);
  return {ok: true, updatedAt: new Date().toISOString()};
}

function updatePendingField(fileId, row, field, value) {
  const book = SpreadsheetApp.openById(fileId);
  const sheet = book.getSheets()[0];
  const r = Number(row);
  const map = {status: 1, task: 2, priority: 3, target: 4, updated: 5, closed: 6};
  if (field === 'comments') {
    let last = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, Math.max(last, 1)).getDisplayValues()[0];
    let col = headers.indexOf('Comentarios') + 1;
    if (!col) { col = last + 1; sheet.getRange(1, col).setValue('Comentarios'); }
    sheet.getRange(r, col).setValue(value || '');
  } else if (map[field]) {
    sheet.getRange(r, map[field]).setValue(value || '');
  } else { throw new Error('Campo no permitido'); }
  return {ok: true, field, updatedAt: new Date().toISOString()};
}

function markPlanningDone(row, dateText) {
  const book = SpreadsheetApp.openById(CONFIG.planningId);
  const sheet = book.getSheetByName(CONFIG.planningSheet);
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
  const url = 'https://docs.google.com/spreadsheets/d/' + CONFIG.planningId + '/export?format=xlsx';
  const response = UrlFetchApp.fetch(url, {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}});
  const blob = response.getBlob().setName('Planificación General Sales Center Fuenlabrada.xlsx');
  return {name: blob.getName(), mimeType: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes())};
}
