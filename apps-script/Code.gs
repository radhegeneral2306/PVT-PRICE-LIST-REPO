/**
 * Pricelist Vault: Google Apps Script backend (single file, V8 runtime).
 *
 * Bound to a Google Sheet (Extensions > Apps Script). The Sheet is the database,
 * a Drive folder "Pricelist Vault Files" holds uploaded PDFs and images.
 * Contract: docs/api-contract.md and src/types.ts.
 *
 * FIRST TIME: edit OWNER_NAME and OWNER_PIN below, then run setup() once.
 */

// ---------------------------------------------------------------------------
// EDIT THESE TWO LINES BEFORE RUNNING setup() (PIN must be 4 to 8 digits)
// ---------------------------------------------------------------------------
var OWNER_NAME = 'Owner';
var OWNER_PIN = '';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
var FOLDER_NAME = 'Pricelist Vault Files';
var SESSION_SECONDS = 6 * 60 * 60; // CacheService max is 21600
var MAX_FAILS = 5;
var LOCK_MS = 5 * 60 * 1000;
var MAX_ITEMS = 3000;
var MAX_FILES = 20;
var MAX_BASE64_CHARS = 11500000; // about 8 MB of file data

var CATEGORIES = ['Tiles', 'Sanitaryware', 'Other'];
var SOURCES = ['items', 'pdf', 'image'];
var UNITS = ['sqft', 'sqm', 'box', 'pc', 'set'];
var ROLES = ['owner', 'staff'];
var MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

// Exact tab names and header rows from the contract. "numeric" columns are
// real numbers; every other column is forced to text format (@) so Sheets
// never turns "600x1200", "2026-03-01", ids like "12e4567890" or phone numbers
// into dates or numbers.
var SCHEMA = {
  Factories: {
    headers: ['id', 'name', 'city', 'category', 'contactName', 'phone', 'notes', 'createdAt'],
    numeric: {}
  },
  Pricelists: {
    headers: ['id', 'factoryId', 'title', 'category', 'effectiveDate', 'source', 'filesJson',
      'itemCount', 'note', 'status', 'createdAt', 'createdBy'],
    numeric: { itemCount: '0' }
  },
  Items: {
    headers: ['id', 'pricelistId', 'name', 'code', 'size', 'finish', 'thickness', 'boxPcs',
      'unit', 'rate', 'note'],
    numeric: { rate: '0.00' }
  },
  Users: {
    headers: ['id', 'name', 'role', 'pinHash', 'salt', 'failCount', 'lockedUntil'],
    numeric: { failCount: '0', lockedUntil: '0' }
  },
  Settings: {
    headers: ['key', 'value'],
    numeric: {}
  },
  Log: {
    headers: ['time', 'user', 'action', 'detail'],
    numeric: {}
  }
};

// ---------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------
function doGet() {
  return json_({ ok: true, data: 'Pricelist Vault API is running' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Empty request');
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      throw new Error('Request is not valid JSON');
    }
    if (!body || typeof body !== 'object') throw new Error('Bad request');
    var action = String(body.action || '');

    if (action === 'login') return json_({ ok: true, data: actionLogin_(body) });

    var handler = ACTIONS[action];
    if (!handler) throw new Error('Unknown action');
    var sess = requireSession_(body.token);
    return json_({ ok: true, data: handler(body, sess) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

var ACTIONS = {
  bootstrap: actionBootstrap_,
  getItems: actionGetItems_,
  getAllCurrentItems: actionGetAllCurrentItems_,
  saveFactory: actionSaveFactory_,
  savePricelist: actionSavePricelist_,
  uploadFile: actionUploadFile_,
  getFile: actionGetFile_,
  saveSettings: actionSaveSettings_,
  listUsers: actionListUsers_,
  saveUser: actionSaveUser_,
  deleteUser: actionDeleteUser_
};

// ---------------------------------------------------------------------------
// One-time setup (owner runs this from the editor)
// ---------------------------------------------------------------------------
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from inside your Google Sheet (Extensions > Apps Script).');
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  _ss = ss;

  var notes = [];
  Object.keys(SCHEMA).forEach(function (tab) {
    notes.push(ensureTab_(ss, tab));
  });

  // Remove the empty default "Sheet1" if it is really empty.
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0 && def.getLastColumn() === 0) {
    ss.deleteSheet(def);
  }

  // Default settings (only the missing keys, never overwrites).
  withLock_(function () {
    var have = {};
    readTab_('Settings').forEach(function (r) { have[s_(r.key).trim()] = true; });
    var add = [];
    if (!have.hideRatesFromStaff) add.push({ key: 'hideRatesFromStaff', value: 'true' });
    if (!have.staleWeeks) add.push({ key: 'staleWeeks', value: '3' });
    appendRows_('Settings', add);
  });

  var folder = getVaultFolder_(true);
  notes.push('Drive folder "' + FOLDER_NAME + '" is ready.');

  // First owner (only if there is no owner yet).
  var users = readTab_('Users');
  var hasOwner = users.some(function (u) { return s_(u.role) === 'owner'; });
  if (hasOwner) {
    notes.push('An owner user already exists, so no new owner was created.');
  } else {
    var name = s_(OWNER_NAME).trim();
    var pin = s_(OWNER_PIN).trim();
    if (!name || name.length > 40) throw new Error('Edit OWNER_NAME at the top of the file (1 to 40 letters), then run setup again.');
    if (!/^\d{4,8}$/.test(pin)) throw new Error('Edit OWNER_PIN at the top of the file (4 to 8 digits only), then run setup again.');
    if (users.some(function (u) { return s_(u.name).trim().toLowerCase() === name.toLowerCase(); })) {
      throw new Error('A user named "' + name + '" already exists. Choose another OWNER_NAME.');
    }
    withLock_(function () {
      var salt = newId_() + newId_();
      appendRows_('Users', [{
        id: newId_(), name: name, role: 'owner', pinHash: hashPin_(salt, pin),
        salt: salt, failCount: 0, lockedUntil: 0
      }]);
      appendLog_('setup', 'setup', 'owner created: ' + name);
    });
    notes.push('Owner user "' + name + '" created. Login with this name and your PIN.');
  }

  var msg = 'SETUP DONE. ' + notes.join(' ') + ' Folder id: ' + folder.getId() +
    ' | Next step: Deploy > New deployment > Web app.';
  Logger.log(msg);
  try { ss.toast('Setup done. Now deploy as Web app.', 'Pricelist Vault', 8); } catch (e) { /* ignore */ }
  return msg;
}

function ensureTab_(ss, tab) {
  var def = SCHEMA[tab];
  var sh = ss.getSheetByName(tab);
  var created = false;
  if (!sh) { sh = ss.insertSheet(tab); created = true; }
  var cols = def.headers.length;
  var first = sh.getLastRow() === 0 ? [] : sh.getRange(1, 1, 1, cols).getValues()[0];
  var empty = first.every(function (c) { return c === ''; });
  var note = 'Tab "' + tab + '" ok.';
  if (empty) {
    sh.getRange(1, 1, 1, cols).setNumberFormat('@').setValues([def.headers]);
    note = 'Tab "' + tab + (created ? '" created.' : '" header written.');
  } else if (first.map(function (c) { return String(c).trim(); }).join('|') !== def.headers.join('|')) {
    note = 'WARNING: tab "' + tab + '" has different headers than expected. Left unchanged.';
  }
  // Column formats for the whole column (text for text columns).
  var rows = sh.getMaxRows();
  def.headers.forEach(function (h, i) {
    sh.getRange(1, i + 1, rows, 1).setNumberFormat(def.numeric[h] || '@');
  });
  sh.getRange(1, 1, 1, cols).setNumberFormat('@').setFontWeight('bold');
  sh.setFrozenRows(1);
  return note;
}

// ---------------------------------------------------------------------------
// Spreadsheet helpers
// ---------------------------------------------------------------------------
var _ss = null;
function getSS_() {
  if (_ss) return _ss;
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!id) throw new Error('Not set up yet. Run setup() once from the Apps Script editor.');
    ss = SpreadsheetApp.openById(id);
  }
  _ss = ss;
  return ss;
}

function getSheet_(tab) {
  var sh = getSS_().getSheetByName(tab);
  if (!sh) throw new Error('Tab "' + tab + '" is missing. Run setup() again.');
  return sh;
}

/** Reads a whole tab with ONE getDataRange().getValues(); returns row objects with _row (1-based sheet row). */
function readTab_(tab) {
  var vals = getSheet_(tab).getDataRange().getValues();
  var headers = SCHEMA[tab].headers;
  var head = (vals[0] || []).map(function (h) { return String(h).trim(); });
  var idx = headers.map(function (h) {
    var i = head.indexOf(h);
    if (i < 0) throw new Error('Tab "' + tab + '" is missing column "' + h + '". Run setup() or fix the header row.');
    return i;
  });
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    var key = row[idx[0]];
    if (key === '' || key === null || key === undefined) continue; // blank row
    var o = { _row: r + 1 };
    for (var c = 0; c < headers.length; c++) o[headers[c]] = row[idx[c]];
    out.push(o);
  }
  return out;
}

function rowToArray_(tab, obj) {
  var def = SCHEMA[tab];
  return def.headers.map(function (h) {
    var v = obj[h];
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return h === 'effectiveDate' ? toDay_(v) : v.toISOString();
    if (def.numeric[h]) return typeof v === 'number' ? v : (v === '' ? '' : Number(v));
    return String(v); // text column; text format keeps "=..." and "600x1200" as text
  });
}

function formatsRow_(tab) {
  var def = SCHEMA[tab];
  return def.headers.map(function (h) { return def.numeric[h] || '@'; });
}

/** Appends many rows with ONE setValues call. */
function appendRows_(tab, objs) {
  if (!objs.length) return;
  var sh = getSheet_(tab);
  var n = objs.length;
  var cols = SCHEMA[tab].headers.length;
  var start = sh.getLastRow() + 1;
  var extra = start + n - 1 - sh.getMaxRows();
  if (extra > 0) sh.insertRowsAfter(sh.getMaxRows(), extra);
  var range = sh.getRange(start, 1, n, cols);
  var fmt = formatsRow_(tab);
  range.setNumberFormats(objs.map(function () { return fmt; }));
  range.setValues(objs.map(function (o) { return rowToArray_(tab, o); }));
}

/** Overwrites one existing sheet row (1-based) with the object. */
function updateRow_(tab, rowNum, obj) {
  var sh = getSheet_(tab);
  var range = sh.getRange(rowNum, 1, 1, SCHEMA[tab].headers.length);
  range.setNumberFormats([formatsRow_(tab)]);
  range.setValues([rowToArray_(tab, obj)]);
}

/** Writes ONE cell (text format) of an existing row. */
function setCell_(tab, rowNum, header, value) {
  var col = SCHEMA[tab].headers.indexOf(header) + 1;
  var cell = getSheet_(tab).getRange(rowNum, col);
  cell.setNumberFormat('@');
  cell.setValue(value);
}

function appendLog_(user, action, detail) {
  appendRows_('Log', [{ time: new Date().toISOString(), user: user, action: action, detail: String(detail).slice(0, 500) }]);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    throw new Error('Server is busy, please try again in a few seconds');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Value helpers and converters (sheet row -> typed object)
// ---------------------------------------------------------------------------
function s_(v) { return v === null || v === undefined ? '' : String(v); }

function toIso_(v) {
  if (v instanceof Date) return v.toISOString();
  return s_(v);
}

function toDay_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, getSS_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  var t = s_(v).trim();
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  return m ? m[1] : t;
}

function toRate_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

function toFactory_(r) {
  return {
    id: s_(r.id), name: s_(r.name), city: s_(r.city), category: s_(r.category),
    contactName: s_(r.contactName), phone: s_(r.phone), notes: s_(r.notes),
    createdAt: toIso_(r.createdAt)
  };
}

function toPricelist_(r) {
  var files = [];
  try {
    var parsed = JSON.parse(s_(r.filesJson) || '[]');
    if (Array.isArray(parsed)) files = parsed;
  } catch (e) { files = []; }
  return {
    id: s_(r.id), factoryId: s_(r.factoryId), title: s_(r.title), category: s_(r.category),
    effectiveDate: toDay_(r.effectiveDate), source: s_(r.source), files: files,
    itemCount: Number(r.itemCount) || 0, note: s_(r.note),
    status: s_(r.status) === 'current' ? 'current' : 'archived',
    createdAt: toIso_(r.createdAt), createdBy: s_(r.createdBy)
  };
}

function toItem_(r, hideRate) {
  return {
    id: s_(r.id), pricelistId: s_(r.pricelistId), name: s_(r.name), code: s_(r.code),
    size: s_(r.size), finish: s_(r.finish), thickness: s_(r.thickness), boxPcs: s_(r.boxPcs),
    unit: s_(r.unit), rate: hideRate ? null : toRate_(r.rate), note: s_(r.note)
  };
}

function readSettings_() {
  var st = { hideRatesFromStaff: true, staleWeeks: 3 };
  readTab_('Settings').forEach(function (r) {
    var k = s_(r.key).trim();
    if (k === 'hideRatesFromStaff') {
      st.hideRatesFromStaff = r.value === true || s_(r.value).trim().toLowerCase() === 'true';
    } else if (k === 'staleWeeks') {
      var n = parseInt(s_(r.value), 10);
      if (n >= 1 && n <= 52) st.staleWeeks = n;
    }
  });
  return st;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
function reqStr_(v, label, max) {
  var t = s_(v).trim();
  if (!t) throw new Error(label + ' is required');
  if (t.length > max) throw new Error(label + ' is too long (max ' + max + ' characters)');
  return t;
}

function optStr_(v, label, max) {
  var t = s_(v).trim();
  if (t.length > max) throw new Error(label + ' is too long (max ' + max + ' characters)');
  return t;
}

function enumVal_(v, list, label) {
  if (list.indexOf(v) < 0) throw new Error('Invalid ' + label);
  return v;
}

function dayVal_(v) {
  var t = s_(v).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) throw new Error('Date must look like 2026-03-01');
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    throw new Error('Date is not a real calendar date');
  }
  return t;
}

function pinVal_(v) {
  var t = s_(v).trim();
  if (!/^\d{4,8}$/.test(t)) throw new Error('PIN must be 4 to 8 digits');
  return t;
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 10);
}

function hashPin_(salt, pin) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pin, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var h = (b < 0 ? b + 256 : b).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');
}

// ---------------------------------------------------------------------------
// Sessions and login
// ---------------------------------------------------------------------------
function requireSession_(token) {
  var cache = CacheService.getScriptCache();
  var t = s_(token);
  if (!t || t.length > 200) throw new Error('SESSION_EXPIRED');
  var raw = cache.get('sess_' + t);
  if (!raw) throw new Error('SESSION_EXPIRED');
  var sess;
  try { sess = JSON.parse(raw); } catch (e) { throw new Error('SESSION_EXPIRED'); }
  // Sessions of users whose PIN, role or account changed after login are cut.
  var rev = cache.get('rev_' + sess.id);
  if (rev && Number(rev) > sess.iat) {
    cache.remove('sess_' + t);
    throw new Error('SESSION_EXPIRED');
  }
  return sess; // { id, name, role, iat } : role comes from the server, never from the client
}

function revokeSessions_(userId) {
  CacheService.getScriptCache().put('rev_' + userId, String(Date.now()), SESSION_SECONDS);
}

function requireOwner_(sess) {
  if (sess.role !== 'owner') throw new Error('Only the owner can do this');
}

function actionLogin_(b) {
  var name = s_(b.name).trim();
  var pin = s_(b.pin).trim();
  if (!name || name.length > 40) throw new Error('Enter your name');
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4 to 8 digits');
  var lname = name.toLowerCase();
  var wrong = 'Wrong name or PIN';
  var cache = CacheService.getScriptCache();
  var now = Date.now();

  var user = readTab_('Users').filter(function (u) { return s_(u.name).trim().toLowerCase() === lname; })[0];

  if (!user) {
    // Unknown name: count tries in cache so guessing names is also slowed down.
    var ukey = 'ufail_' + lname.slice(0, 60);
    var cnt = Number(cache.get(ukey) || 0);
    if (cnt >= MAX_FAILS) throw new Error('Too many wrong tries. Wait 5 minutes and try again.');
    cache.put(ukey, String(cnt + 1), 300);
    throw new Error(wrong);
  }

  if (Number(user.lockedUntil) > now) {
    var mins = Math.ceil((Number(user.lockedUntil) - now) / 60000);
    throw new Error('Too many wrong tries. Wait ' + mins + ' minute' + (mins === 1 ? '' : 's') + ' and try again.');
  }

  var ok = hashPin_(s_(user.salt), pin) === s_(user.pinHash);

  if (!ok) {
    var msg = wrong;
    withLock_(function () {
      // Re-read inside the lock so parallel wrong tries are counted correctly.
      var fresh = readTab_('Users').filter(function (u) { return s_(u.id) === s_(user.id); })[0];
      if (!fresh) return;
      var fails = (Number(fresh.failCount) || 0) + 1;
      var locked = 0;
      if (fails >= MAX_FAILS) {
        locked = Date.now() + LOCK_MS;
        fails = 0;
        msg = 'Too many wrong tries. Wait 5 minutes and try again.';
        appendLog_(fresh.name, 'lockout', 'locked for 5 minutes');
      }
      fresh.failCount = fails;
      fresh.lockedUntil = locked;
      updateRow_('Users', fresh._row, fresh);
    });
    throw new Error(msg);
  }

  if ((Number(user.failCount) || 0) > 0 || Number(user.lockedUntil) > 0) {
    withLock_(function () {
      var fresh = readTab_('Users').filter(function (u) { return s_(u.id) === s_(user.id); })[0];
      if (!fresh) return;
      fresh.failCount = 0;
      fresh.lockedUntil = 0;
      updateRow_('Users', fresh._row, fresh);
    });
  }

  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var sess = { id: s_(user.id), name: s_(user.name), role: s_(user.role) === 'owner' ? 'owner' : 'staff', iat: now };
  cache.put('sess_' + token, JSON.stringify(sess), SESSION_SECONDS);
  withLock_(function () { appendLog_(sess.name, 'login', sess.id); });
  return { token: token, user: { id: sess.id, name: sess.name, role: sess.role } };
}

// ---------------------------------------------------------------------------
// Read actions
// ---------------------------------------------------------------------------
function shouldHideRates_(sess) {
  return sess.role === 'staff' && readSettings_().hideRatesFromStaff;
}

function actionBootstrap_() {
  return {
    factories: readTab_('Factories').map(toFactory_),
    pricelists: readTab_('Pricelists').map(toPricelist_),
    settings: readSettings_(),
    serverTime: new Date().toISOString()
  };
}

function actionGetItems_(b, sess) {
  var id = reqStr_(b.pricelistId, 'pricelistId', 50);
  var hide = shouldHideRates_(sess);
  return readTab_('Items')
    .filter(function (r) { return s_(r.pricelistId) === id; })
    .map(function (r) { return toItem_(r, hide); });
}

function actionGetAllCurrentItems_(b, sess) {
  var current = {};
  readTab_('Pricelists').forEach(function (r) {
    if (s_(r.status) === 'current') current[s_(r.id)] = true;
  });
  var hide = shouldHideRates_(sess);
  return readTab_('Items')
    .filter(function (r) { return current[s_(r.pricelistId)] === true; })
    .map(function (r) { return toItem_(r, hide); });
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
function actionSaveFactory_(b, sess) {
  var d = b.draft;
  if (!d || typeof d !== 'object') throw new Error('Missing factory details');
  var clean = {
    name: reqStr_(d.name, 'Factory name', 100),
    city: optStr_(d.city, 'City', 60),
    category: enumVal_(d.category, CATEGORIES, 'category'),
    contactName: optStr_(d.contactName, 'Contact name', 80),
    phone: optStr_(d.phone, 'Phone', 30),
    notes: optStr_(d.notes, 'Notes', 1000)
  };
  if (!/^[0-9 +\-()]*$/.test(clean.phone)) throw new Error('Phone can only have digits, spaces, + - ( )');

  return withLock_(function () {
    var existing = null;
    var wantId = s_(b.id).trim();
    if (wantId) {
      existing = readTab_('Factories').filter(function (r) { return s_(r.id) === wantId; })[0];
      if (!existing) throw new Error('Factory not found');
      var updated = {
        id: s_(existing.id), name: clean.name, city: clean.city, category: clean.category,
        contactName: clean.contactName, phone: clean.phone, notes: clean.notes,
        createdAt: toIso_(existing.createdAt)
      };
      updateRow_('Factories', existing._row, updated);
      appendLog_(sess.name, 'saveFactory', 'update ' + updated.id + ' ' + updated.name);
      return toFactory_(updated);
    }
    var row = {
      id: newId_(), name: clean.name, city: clean.city, category: clean.category,
      contactName: clean.contactName, phone: clean.phone, notes: clean.notes,
      createdAt: new Date().toISOString()
    };
    appendRows_('Factories', [row]);
    appendLog_(sess.name, 'saveFactory', 'create ' + row.id + ' ' + row.name);
    return toFactory_(row);
  });
}

// ---------------------------------------------------------------------------
// Pricelists
// ---------------------------------------------------------------------------
function cleanItem_(it, n) {
  if (!it || typeof it !== 'object') throw new Error('Item ' + n + ' is invalid');
  var rate = null;
  if (it.rate !== null && it.rate !== undefined && s_(it.rate).trim() !== '') {
    rate = toRate_(it.rate);
    if (rate === null || rate < 0 || rate > 100000000) throw new Error('Item ' + n + ': rate must be a number');
  }
  return {
    name: reqStr_(it.name, 'Item ' + n + ' name', 150),
    code: optStr_(it.code, 'Item ' + n + ' code', 60),
    size: optStr_(it.size, 'Item ' + n + ' size', 40),
    finish: optStr_(it.finish, 'Item ' + n + ' finish', 60),
    thickness: optStr_(it.thickness, 'Item ' + n + ' thickness', 30),
    boxPcs: optStr_(it.boxPcs, 'Item ' + n + ' boxPcs', 30),
    unit: enumVal_(it.unit, UNITS, 'unit on item ' + n),
    rate: rate,
    note: optStr_(it.note, 'Item ' + n + ' note', 300)
  };
}

function cleanFileRef_(f, n) {
  if (!f || typeof f !== 'object') throw new Error('File ' + n + ' is invalid');
  var ref = {
    fileId: reqStr_(f.fileId, 'File id', 100),
    name: reqStr_(f.name, 'File name', 150),
    mime: enumVal_(f.mime, MIMES, 'file type')
  };
  var pages = parseInt(f.pages, 10);
  if (pages >= 1 && pages <= 10000) ref.pages = pages;
  if (!isFileInVault_(ref.fileId)) throw new Error('File ' + n + ' is not in the Pricelist Vault folder');
  return ref;
}

function actionSavePricelist_(b, sess) {
  var d = b.draft;
  if (!d || typeof d !== 'object') throw new Error('Missing pricelist details');
  var source = enumVal_(d.source, SOURCES, 'source');
  var clean = {
    factoryId: reqStr_(d.factoryId, 'Factory', 50),
    title: reqStr_(d.title, 'Title', 120),
    category: enumVal_(d.category, CATEGORIES, 'category'),
    effectiveDate: dayVal_(d.effectiveDate),
    source: source,
    note: optStr_(d.note, 'Note', 1000)
  };

  var rawItems = Array.isArray(d.items) ? d.items : [];
  var rawFiles = Array.isArray(d.files) ? d.files : [];
  if (rawItems.length > MAX_ITEMS) throw new Error('Too many items (max ' + MAX_ITEMS + ')');
  if (rawFiles.length > MAX_FILES) throw new Error('Too many files (max ' + MAX_FILES + ')');

  var items = [];
  var files = [];
  if (source === 'items') {
    if (!rawItems.length) throw new Error('Add at least one item');
    items = rawItems.map(function (it, i) { return cleanItem_(it, i + 1); });
  } else {
    if (!rawFiles.length) throw new Error('Upload at least one file');
    files = rawFiles.map(function (f, i) { return cleanFileRef_(f, i + 1); });
  }

  return withLock_(function () {
    var factory = readTab_('Factories').filter(function (r) { return s_(r.id) === clean.factoryId; })[0];
    if (!factory) throw new Error('Factory not found');

    var plId = newId_();
    var now = new Date().toISOString();

    // 1) Items in ONE batched write.
    appendRows_('Items', items.map(function (it) {
      return {
        id: newId_(), pricelistId: plId, name: it.name, code: it.code, size: it.size,
        finish: it.finish, thickness: it.thickness, boxPcs: it.boxPcs, unit: it.unit,
        rate: it.rate, note: it.note
      };
    }));

    // 2) The new pricelist row.
    var plRow = {
      id: plId, factoryId: clean.factoryId, title: clean.title, category: clean.category,
      effectiveDate: clean.effectiveDate, source: source, filesJson: JSON.stringify(files),
      itemCount: items.length, note: clean.note, status: 'current', createdAt: now, createdBy: sess.name
    };
    appendRows_('Pricelists', [plRow]);

    // 3) Archive previous current lists of the same factory + category (never deleted).
    var archived = [];
    readTab_('Pricelists').forEach(function (r) {
      if (s_(r.id) !== plId && s_(r.factoryId) === clean.factoryId &&
          s_(r.category) === clean.category && s_(r.status) === 'current') {
        setCell_('Pricelists', r._row, 'status', 'archived'); // only this cell, other cells untouched
        archived.push(s_(r.id));
      }
    });

    appendLog_(sess.name, 'savePricelist', 'create ' + plId + ' ' + clean.title +
      (archived.length ? ' | archived ' + archived.join(',') : ''));
    return toPricelist_(plRow);
  });
}

// ---------------------------------------------------------------------------
// Files (Drive)
// ---------------------------------------------------------------------------
function getVaultFolder_(createIfMissing) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOLDER_ID');
  if (id) {
    try {
      var f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (e) { /* fall through and look by name */ }
  }
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  while (it.hasNext()) {
    var cand = it.next();
    if (!cand.isTrashed()) {
      props.setProperty('FOLDER_ID', cand.getId());
      return cand;
    }
  }
  if (!createIfMissing) throw new Error('Drive folder is missing. Run setup() again.');
  var folder = DriveApp.createFolder(FOLDER_NAME); // private by default
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function isFileInVault_(fileId) {
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(fileId)) return false;
  try {
    var folderId = getVaultFolder_(false).getId();
    var parents = DriveApp.getFileById(fileId).getParents();
    while (parents.hasNext()) {
      if (parents.next().getId() === folderId) return true;
    }
  } catch (e) { return false; }
  return false;
}

function actionUploadFile_(b, sess) {
  var name = reqStr_(b.name, 'File name', 150).replace(/[\\\/:*?"<>|\r\n]/g, '_');
  var mime = enumVal_(s_(b.mime).trim().toLowerCase(), MIMES, 'file type (only PDF, JPG, PNG)');
  var b64 = s_(b.base64);
  var comma = b64.indexOf('base64,');
  if (b64.indexOf('data:') === 0 && comma >= 0) b64 = b64.substring(comma + 7);
  if (!b64) throw new Error('File is empty');
  if (b64.length > MAX_BASE64_CHARS) throw new Error('File is too big (max about 8 MB)');

  var bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (e) { throw new Error('File data is not valid'); }
  if (!bytes.length) throw new Error('File is empty');

  var file = getVaultFolder_(false).createFile(Utilities.newBlob(bytes, mime, name));
  withLock_(function () { appendLog_(sess.name, 'uploadFile', file.getId() + ' ' + name); });
  return { fileId: file.getId(), name: name, mime: mime };
}

function actionGetFile_(b) {
  var id = s_(b.fileId).trim();
  if (!isFileInVault_(id)) throw new Error('File not found');
  var file = DriveApp.getFileById(id);
  if (file.isTrashed()) throw new Error('File not found');
  var blob = file.getBlob();
  return { mime: file.getMimeType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

// ---------------------------------------------------------------------------
// Settings and users (owner only)
// ---------------------------------------------------------------------------
function actionSaveSettings_(b, sess) {
  requireOwner_(sess);
  var st = b.settings;
  if (!st || typeof st !== 'object') throw new Error('Missing settings');
  if (typeof st.hideRatesFromStaff !== 'boolean') throw new Error('hideRatesFromStaff must be true or false');
  var weeks = parseInt(st.staleWeeks, 10);
  if (!(weeks >= 1 && weeks <= 52)) throw new Error('Stale weeks must be between 1 and 52');

  return withLock_(function () {
    var rows = readTab_('Settings');
    var want = { hideRatesFromStaff: st.hideRatesFromStaff ? 'true' : 'false', staleWeeks: String(weeks) };
    var add = [];
    Object.keys(want).forEach(function (key) {
      var found = rows.filter(function (r) { return s_(r.key).trim() === key; })[0];
      if (found) updateRow_('Settings', found._row, { key: key, value: want[key] });
      else add.push({ key: key, value: want[key] });
    });
    appendRows_('Settings', add);
    appendLog_(sess.name, 'saveSettings', JSON.stringify({ hideRatesFromStaff: st.hideRatesFromStaff, staleWeeks: weeks }));
    return { hideRatesFromStaff: st.hideRatesFromStaff, staleWeeks: weeks };
  });
}

function toUser_(r) {
  return { id: s_(r.id), name: s_(r.name), role: s_(r.role) === 'owner' ? 'owner' : 'staff' };
}

function actionListUsers_(b, sess) {
  requireOwner_(sess);
  return readTab_('Users').map(toUser_);
}

function actionSaveUser_(b, sess) {
  requireOwner_(sess);
  var name = reqStr_(b.name, 'Name', 40);
  var role = enumVal_(b.role, ROLES, 'role');
  var wantId = s_(b.id).trim();
  var hasPin = b.pin !== undefined && b.pin !== null && s_(b.pin).trim() !== '';
  var pin = hasPin ? pinVal_(b.pin) : '';
  if (!wantId && !hasPin) throw new Error('PIN is required for a new user');

  return withLock_(function () {
    var users = readTab_('Users');
    var lname = name.toLowerCase();
    var clash = users.filter(function (u) {
      return s_(u.name).trim().toLowerCase() === lname && s_(u.id) !== wantId;
    })[0];
    if (clash) throw new Error('A user with this name already exists');

    if (!wantId) {
      var salt = newId_() + newId_();
      var row = {
        id: newId_(), name: name, role: role, pinHash: hashPin_(salt, pin),
        salt: salt, failCount: 0, lockedUntil: 0
      };
      appendRows_('Users', [row]);
      appendLog_(sess.name, 'saveUser', 'create ' + row.id + ' ' + name + ' ' + role);
      return toUser_(row);
    }

    var u = users.filter(function (r) { return s_(r.id) === wantId; })[0];
    if (!u) throw new Error('User not found');
    var owners = users.filter(function (r) { return s_(r.role) === 'owner'; });
    if (s_(u.role) === 'owner' && role !== 'owner' && owners.length <= 1) {
      throw new Error('There must be at least one owner');
    }
    var changed = s_(u.name) !== name || s_(u.role) !== role || hasPin;
    u.name = name;
    u.role = role;
    if (hasPin) {
      u.salt = newId_() + newId_();
      u.pinHash = hashPin_(u.salt, pin);
      u.failCount = 0;
      u.lockedUntil = 0;
    }
    updateRow_('Users', u._row, u);
    if (changed) revokeSessions_(wantId);
    appendLog_(sess.name, 'saveUser', 'update ' + wantId + ' ' + name + ' ' + role + (hasPin ? ' (pin changed)' : ''));
    return toUser_(u);
  });
}

function actionDeleteUser_(b, sess) {
  requireOwner_(sess);
  var id = reqStr_(b.id, 'id', 50);
  if (id === sess.id) throw new Error('You cannot delete yourself');
  return withLock_(function () {
    var users = readTab_('Users');
    var u = users.filter(function (r) { return s_(r.id) === id; })[0];
    if (!u) throw new Error('User not found');
    if (s_(u.role) === 'owner' &&
        users.filter(function (r) { return s_(r.role) === 'owner'; }).length <= 1) {
      throw new Error('There must be at least one owner');
    }
    getSheet_('Users').deleteRow(u._row);
    revokeSessions_(id);
    appendLog_(sess.name, 'deleteUser', id + ' ' + s_(u.name));
    return {};
  });
}
