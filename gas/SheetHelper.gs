/**
 * SheetHelper.gs - スプレッドシート汎用操作ユーティリティ
 */

// ===== スプレッドシート参照キャッシュ =====
var _ss = null;
function getSS() {
  if (!_ss) _ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return _ss;
}

function getSheet(name) {
  var sheet = getSS().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

// ===== ID生成 =====
function nextId(sheetName) {
  var cache = CacheService.getScriptCache();
  var key = 'maxid_' + sheetName;
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    cache.put(key, '1', CONFIG.CACHE_TTL_SEC);
    return 1;
  }
  // ヘッダー行+1 ~ lastRow のID列(A列)から最大値を取得
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(r) { return Number(r[0]) || 0; });
  var maxId = Math.max.apply(null, ids) + 1;
  cache.put(key, String(maxId), CONFIG.CACHE_TTL_SEC);
  return maxId;
}

// ===== 全行取得（ヘッダー付きオブジェクト配列） =====
function getAllRows(sheetName) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var headers = HEADERS[sheetName];
  if (!headers) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }
  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return data.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// ===== 条件検索 =====
function findRows(sheetName, filters) {
  var rows = getAllRows(sheetName);
  return rows.filter(function(row) {
    for (var key in filters) {
      if (row[key] != filters[key]) return false;
    }
    return true;
  });
}

function findRow(sheetName, filters) {
  var results = findRows(sheetName, filters);
  return results.length > 0 ? results[0] : null;
}

// ===== 行追記 =====
function appendRow(sheetName, obj) {
  var sheet = getSheet(sheetName);
  var headers = HEADERS[sheetName];
  var row = headers.map(function(h) {
    var v = obj[h];
    return v !== undefined && v !== null ? v : '';
  });
  sheet.appendRow(row);
  return obj;
}

// ===== 行更新（ID指定） =====
function updateRowById(sheetName, id, updates) {
  var sheet = getSheet(sheetName);
  var headers = HEADERS[sheetName];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  // ID列から該当行を検索
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIdx = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { rowIdx = i; break; }
  }
  if (rowIdx === -1) return null;

  var actualRow = rowIdx + 2; // 1-indexed + header
  var rowData = sheet.getRange(actualRow, 1, 1, headers.length).getValues()[0];

  headers.forEach(function(h, colIdx) {
    if (updates.hasOwnProperty(h)) {
      rowData[colIdx] = updates[h];
    }
  });

  sheet.getRange(actualRow, 1, 1, headers.length).setValues([rowData]);

  var obj = {};
  headers.forEach(function(h, i) { obj[h] = rowData[i]; });
  return obj;
}

// ===== 行削除（ID指定） =====
function deleteRowById(sheetName, id) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

// ===== 条件で行削除 =====
function deleteRows(sheetName, filters) {
  var sheet = getSheet(sheetName);
  var headers = HEADERS[sheetName];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var filterKeys = Object.keys(filters);
  var deleted = 0;

  // 下の行から削除（インデックスずれ防止）
  for (var i = data.length - 1; i >= 0; i--) {
    var match = true;
    for (var k = 0; k < filterKeys.length; k++) {
      var colIdx = headers.indexOf(filterKeys[k]);
      if (colIdx === -1 || String(data[i][colIdx]) !== String(filters[filterKeys[k]])) {
        match = false; break;
      }
    }
    if (match) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

// ===== Upsert（条件一致なら更新、なければ追記） =====
function upsertRow(sheetName, matchKeys, obj) {
  var sheet = getSheet(sheetName);
  var headers = HEADERS[sheetName];
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (var i = 0; i < data.length; i++) {
      var match = true;
      for (var k = 0; k < matchKeys.length; k++) {
        var colIdx = headers.indexOf(matchKeys[k]);
        if (colIdx === -1 || String(data[i][colIdx]) !== String(obj[matchKeys[k]])) {
          match = false; break;
        }
      }
      if (match) {
        // 更新
        var rowData = data[i];
        headers.forEach(function(h, ci) {
          if (obj.hasOwnProperty(h)) rowData[ci] = obj[h];
        });
        sheet.getRange(i + 2, 1, 1, headers.length).setValues([rowData]);
        var result = {};
        headers.forEach(function(h, ci) { result[h] = rowData[ci]; });
        return result;
      }
    }
  }

  // 新規追記
  return appendRow(sheetName, obj);
}

// ===== ページネーション付き取得 =====
function getRowsPaginated(sheetName, filters, page, pageSize, sortKey, sortDesc) {
  var rows = filters ? findRows(sheetName, filters) : getAllRows(sheetName);

  if (sortKey) {
    rows.sort(function(a, b) {
      var va = a[sortKey] || '', vb = b[sortKey] || '';
      if (va < vb) return sortDesc ? 1 : -1;
      if (va > vb) return sortDesc ? -1 : 1;
      return 0;
    });
  }

  var total = rows.length;
  var p = page || 1;
  var ps = pageSize || CONFIG.PAGE_SIZE;
  var start = (p - 1) * ps;
  var items = rows.slice(start, start + ps);

  return { items: items, total: total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) };
}

// ===== キューの先頭行を取得して削除（アトミック） =====
function popQueueHead(queueSheetName) {
  var sheet = getSheet(queueSheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null; // キュー空

  var headers = HEADERS[queueSheetName];
  var rowData = sheet.getRange(2, 1, 1, headers.length).getValues()[0];
  var obj = {};
  headers.forEach(function(h, i) { obj[h] = rowData[i]; });

  sheet.deleteRow(2); // 先頭データ行を削除
  return obj;
}

// ===== バッチ追記 =====
function appendRows(sheetName, objArray) {
  if (!objArray || objArray.length === 0) return;
  var sheet = getSheet(sheetName);
  var headers = HEADERS[sheetName];
  var data = objArray.map(function(obj) {
    return headers.map(function(h) {
      var v = obj[h];
      return v !== undefined && v !== null ? v : '';
    });
  });
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, data.length, headers.length).setValues(data);
}

// ===== 条件に一致する行を一括更新 =====
function updateRows(sheetName, filters, updates) {
  var sheet = getSheet(sheetName);
  var headers = HEADERS[sheetName];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  var data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var filterKeys = Object.keys(filters);
  var updated = 0;

  for (var i = 0; i < data.length; i++) {
    var match = true;
    for (var k = 0; k < filterKeys.length; k++) {
      var colIdx = headers.indexOf(filterKeys[k]);
      if (colIdx === -1 || String(data[i][colIdx]) !== String(filters[filterKeys[k]])) {
        match = false; break;
      }
    }
    if (match) {
      for (var key in updates) {
        var ci = headers.indexOf(key);
        if (ci !== -1) data[i][ci] = updates[key];
      }
      updated++;
    }
  }

  if (updated > 0) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }
  return updated;
}

// ===== CacheService ラッパー =====
function cacheGet(key) {
  var cache = CacheService.getScriptCache();
  var val = cache.get(key);
  return val ? JSON.parse(val) : null;
}

function cachePut(key, obj, ttl) {
  var cache = CacheService.getScriptCache();
  var str = JSON.stringify(obj);
  if (str.length > 100000) return; // 100KB制限
  cache.put(key, str, ttl || CONFIG.CACHE_TTL_SEC);
}

function cacheRemove(key) {
  CacheService.getScriptCache().remove(key);
}

// ===== UUID生成 =====
function generateUUID() {
  return Utilities.getUuid();
}

// ===== 日時ユーティリティ =====
function now() {
  return new Date().toISOString();
}

function nowDate() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
}

function addMinutes(date, min) {
  return new Date(date.getTime() + min * 60000).toISOString();
}
