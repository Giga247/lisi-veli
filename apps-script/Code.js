/**
 * კედრის უბანი — სერვერი.
 *
 * განთავსება: Deploy → Web app → Execute as: Me → Who has access: Anyone.
 * უსაფრთხოებას ტოკენის შემოწმება უზრუნველყოფს, არა წვდომის პარამეტრი.
 * Sheet პირადი რჩება — მასთან წვდომა მხოლოდ ამ სკრიპტს აქვს.
 */

const CLIENT_ID = 'ჩასვი-შენი-client-id.apps.googleusercontent.com';
const ADMIN_EMAIL = 'g.gabriadze@gmail.com';

const SHEET_PLOTS = 'ნაკვეთები';
const SHEET_USERS = 'მომხმარებლები';
const SHEET_LOG = 'ლოგი';

const RATE_LIMIT_PER_MINUTE = 60;
const TOKEN_CACHE_SECONDS = 300;
const LOCK_WAIT_MS = 10000;

// ── პასუხის helper-ები ──────────────────────────────────────────────

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(code, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: code, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── შესასვლელი ──────────────────────────────────────────────────────

function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return err('VALIDATION', 'მოთხოვნის ფორმატი არასწორია');
    }

    const auth = verifyToken(body.idToken);
    if (!auth.ok) return err(auth.error, auth.message);

    if (!allowRequest(auth.email)) {
      return err('RATE_LIMIT', 'ძალიან ბევრი მოთხოვნა, დაელოდეთ ერთი წუთი');
    }

    const user = findUser(auth.email);
    const action = String(body.action || '');
    const payload = body.payload || {};

    if (action === 'requestAccess') return handleRequestAccess(auth.email, user);

    if (!user) return err('NO_ACCOUNT', 'ანგარიში ვერ მოიძებნა');
    if (user.role === 'pending') return err('PENDING', 'თქვენი მოთხოვნა დამტკიცების პროცესშია');
    if (user.role === 'blocked') return err('BLOCKED', 'წვდომა შეზღუდულია');

    if (!Lib_checkPermission(user.role, action)) {
      return err('FORBIDDEN', 'ამ მოქმედების უფლება არ გაქვთ');
    }

    switch (action) {
      case 'me': return ok(user);
      case 'plots': return ok(readPlots());
      case 'updatePlot': return handleUpdatePlot(user, payload);
      case 'users': return ok(readUsers());
      case 'setRole': return handleSetRole(user, payload);
      case 'logs': return ok(readLogs(Number(payload.limit) || 200));
      default: return err('VALIDATION', 'უცნობი მოქმედება');
    }
  } catch (fatal) {
    console.error(fatal);
    return err('SERVER', 'სისტემური შეცდომა');
  }
}

function doGet() {
  return ContentService.createTextOutput('კედრის უბანი — API. მოთხოვნები POST-ით მიიღება.');
}

// ── ავტორიზაცია ─────────────────────────────────────────────────────

/**
 * ID token -> {ok, email}. შედეგი ქეშირდება 5 წუთით.
 * ქეშის გასაღები ტოკენის hash-ია, არა თავად ტოკენი.
 */
function verifyToken(idToken) {
  if (!idToken) return { ok: false, error: 'UNAUTHENTICATED', message: 'გთხოვთ შეხვიდეთ Google-ით' };

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(idToken));
  const key = 'tok_' + Utilities.base64Encode(digest);

  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  if (cached) return { ok: true, email: cached };

  let claims;
  try {
    const response = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      return { ok: false, error: 'UNAUTHENTICATED', message: 'ტოკენი არასწორია' };
    }
    claims = JSON.parse(response.getContentText());
  } catch (fetchError) {
    return { ok: false, error: 'SERVER', message: 'ავტორიზაცია ვერ შემოწმდა' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const result = Lib_verifyTokenClaims(claims, CLIENT_ID, nowSec);
  if (!result.ok) return result;

  // TTL არასდროს სცდება ტოკენის საკუთარ exp-ს — ქეში ვადაგასულ ტოკენს არ განაცხოვრებს.
  const ttl = Math.max(0, Math.min(TOKEN_CACHE_SECONDS, Number(claims.exp) - nowSec));
  cache.put(key, result.email, ttl);
  return result;
}

/** მრიცხველი წუთზე. ერთდროულობა აქ კრიტიკული არაა. */
function allowRequest(email) {
  const cache = CacheService.getScriptCache();
  const key = 'rate_' + email + '_' + Math.floor(Date.now() / 60000);
  const current = Number(cache.get(key) || 0);
  if (current >= RATE_LIMIT_PER_MINUTE) return false;
  cache.put(key, String(current + 1), 120);
  return true;
}

// ── Sheet-თან წვდომა ────────────────────────────────────────────────

function sheetRows(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('ფურცელი ვერ მოიძებნა: ' + name);
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return { sheet: sheet, map: {}, rows: [] };
  return { sheet: sheet, map: Lib_mapHeaders(values[0]), rows: values.slice(1) };
}

function rowToObject(row, map) {
  const out = {};
  for (const key in map) {
    const value = row[map[key]];
    out[key] = value == null ? '' : value;
  }
  return out;
}

function readPlots() {
  const data = sheetRows(SHEET_PLOTS);
  return data.rows
    .filter(function (row) { return String(row[data.map.cad] || '').trim() !== ''; })
    .map(function (row) {
      const plot = rowToObject(row, data.map);
      plot.cad = String(plot.cad).trim();
      plot.updated_at = String(plot.updated_at || '');
      plot.geometry = Lib_parseGeometry(plot.geometry);
      plot.lat = plot.lat === '' ? null : Number(plot.lat);
      plot.lon = plot.lon === '' ? null : Number(plot.lon);
      return plot;
    });
}

function readUsers() {
  const data = sheetRows(SHEET_USERS);
  return data.rows
    .filter(function (row) { return String(row[data.map.email] || '').trim() !== ''; })
    .map(function (row) { return rowToObject(row, data.map); });
}

function findUser(email) {
  const users = readUsers();
  for (const user of users) {
    if (String(user.email).trim().toLowerCase() === email) {
      user.email = email;
      user.role = String(user.role || '').trim();
      return user;
    }
  }
  return null;
}

function readLogs(limit) {
  const data = sheetRows(SHEET_LOG);
  return data.rows.slice(-limit).reverse()
    .map(function (row) { return rowToObject(row, data.map); });
}

function appendLog(email, action, cad, changes) {
  if (changes.length === 0) return;
  // სვეტების პოზიცია სათაურის რუკიდან იკითხება, არა ხისტად — ლოგის სვეტების
  // გადალაგება/ჩამატება ამ ჩანაწერს არ დაუშლის, ისევე როგორც სხვა ყველა ჩაწერას ამ ფაილში.
  const data = sheetRows(SHEET_LOG);
  const width = data.sheet.getLastColumn();
  const now = new Date().toISOString();
  const rows = changes.map(function (change) {
    const row = new Array(width).fill('');
    row[data.map.at] = now;
    row[data.map.by] = email;
    row[data.map.action] = action;
    row[data.map.cad] = cad;
    row[data.map.field] = change.field;
    row[data.map.old] = change.old;
    row[data.map.new] = change.new;
    return row;
  });
  data.sheet.getRange(data.sheet.getLastRow() + 1, 1, rows.length, width).setValues(rows);
}

// ── მოქმედებები ─────────────────────────────────────────────────────

function handleRequestAccess(email, existingUser) {
  if (existingUser) {
    if (existingUser.role === 'pending') {
      return err('PENDING', 'თქვენი მოთხოვნა დამტკიცების პროცესშია');
    }
    if (existingUser.role === 'blocked') {
      return err('BLOCKED', 'წვდომა შეზღუდულია');
    }
    return ok(existingUser);
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return err('SERVER', 'სისტემა დაკავებულია, სცადეთ ხელახლა');
  try {
    if (findUser(email)) return err('PENDING', 'თქვენი მოთხოვნა დამტკიცების პროცესშია');

    const data = sheetRows(SHEET_USERS);
    const row = new Array(Object.keys(data.map).length).fill('');
    row[data.map.email] = email;
    row[data.map.role] = 'pending';
    row[data.map.requested_at] = new Date().toISOString();
    data.sheet.appendRow(row);

    try {
      MailApp.sendEmail(ADMIN_EMAIL, 'კედრის უბანი — ახალი მოთხოვნა',
        email + ' ითხოვს წვდომას. დაამტკიცეთ ადმინის გვერდიდან.');
    } catch (mailError) {
      console.error('მეილი ვერ გაიგზავნა: ' + mailError);
    }
  } finally {
    lock.releaseLock();
  }
  return err('PENDING', 'მოთხოვნა გაგზავნილია. ადმინი დაგიდასტურებთ.');
}

function handleUpdatePlot(user, payload) {
  const cad = String(payload.cad || '').trim();
  const fields = payload.fields || {};
  const expected = payload.expected_updated_at;

  if (!cad) return err('VALIDATION', 'საკადასტრო კოდი არ არის მითითებული');
  if (typeof expected !== 'string') {
    return err('VALIDATION', 'expected_updated_at სავალდებულოა (ცარიელი ჩანაწერისთვის "")');
  }

  const clean = {};
  for (const field in fields) {
    if (!Object.prototype.hasOwnProperty.call(fields, field)) continue;
    if (!Lib_isEditableField(field)) {
      return err('FORBIDDEN', 'ველი არ ექვემდებარება რედაქტირებას: ' + field);
    }
    if (field === 'phone') {
      const phone = Lib_normalizePhone(fields[field]);
      if (!phone.ok) return err('VALIDATION', phone.message);
      clean[field] = phone.value;
    } else {
      clean[field] = String(fields[field] == null ? '' : fields[field]).trim().slice(0, 200);
    }
  }
  if (Object.keys(clean).length === 0) return err('VALIDATION', 'შესაცვლელი ველი არ არის');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return err('SERVER', 'სისტემა დაკავებულია, სცადეთ ხელახლა');
  try {
    const data = sheetRows(SHEET_PLOTS);
    let index = -1;
    for (let i = 0; i < data.rows.length; i++) {
      if (String(data.rows[i][data.map.cad]).trim() === cad) { index = i; break; }
    }
    if (index === -1) return err('NOT_FOUND', 'ნაკვეთი ვერ მოიძებნა');

    const row = data.rows[index];
    const current = String(row[data.map.updated_at] || '');
    if (current !== expected) {
      return err('CONFLICT', 'ჩანაწერი სხვამ შეცვალა, გადატვირთეთ გვერდი');
    }

    const before = rowToObject(row, data.map);
    const changes = Lib_diffFields(before, clean);
    if (changes.length === 0) return ok({ cad: cad, updated_at: current, changed: 0 });

    for (const field in clean) {
      if (data.map[field] === undefined) {
        return err('VALIDATION', 'Sheet-ში ასეთი სვეტი არ არის: ' + field);
      }
    }

    const now = new Date().toISOString();
    const sheetRow = index + 2; // +1 სათაური, +1 ერთიდან ათვლა
    for (const field in clean) {
      data.sheet.getRange(sheetRow, data.map[field] + 1).setValue(clean[field]);
    }
    // ტექსტის ფორმატი წინასწარ ეყენება — Sheets ISO-სტრიქონს თარიღად არ გადააქცევს,
    // წინააღმდეგ შემთხვევაში მომდევნო შედარება expected_updated_at-თან ვერასდროს დაემთხვევა.
    data.sheet.getRange(sheetRow, data.map.updated_at + 1).setNumberFormat('@').setValue(now);
    data.sheet.getRange(sheetRow, data.map.updated_by + 1).setValue(user.email);

    appendLog(user.email, 'update', cad, changes);
    return ok({ cad: cad, updated_at: now, changed: changes.length });
  } finally {
    lock.releaseLock();
  }
}

function handleSetRole(admin, payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const role = String(payload.role || '').trim();
  // street იწერება მხოლოდ მაშინ, თუ გამომძახებელმა ის რეალურად გადმოსცა —
  // წინააღმდეგ შემთხვევაში setRole (მაგ. მხოლოდ როლის შესაცვლელად გამოძახებული)
  // ჩუმად წაშლიდა მომხმარებლის უკვე არსებულ ქუჩას.
  const hasStreet = Object.prototype.hasOwnProperty.call(payload, 'street');
  const street = hasStreet ? String(payload.street || '').trim() : null;

  const allowed = ['admin', 'moderator', 'member', 'pending', 'blocked'];
  if (allowed.indexOf(role) === -1) return err('VALIDATION', 'უცნობი როლი');
  if (!email) return err('VALIDATION', 'მეილი არ არის მითითებული');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return err('SERVER', 'სისტემა დაკავებულია, სცადეთ ხელახლა');
  try {
    const data = sheetRows(SHEET_USERS);
    let index = -1;
    for (let i = 0; i < data.rows.length; i++) {
      if (String(data.rows[i][data.map.email]).trim().toLowerCase() === email) { index = i; break; }
    }
    if (index === -1) return err('NOT_FOUND', 'მომხმარებელი ვერ მოიძებნა');

    const before = rowToObject(data.rows[index], data.map);
    // .trim() აქ სავალდებულოა: Step 1.7-ში ადმინის რიგი ხელით იწერება და
    // "admin " (ბოლო whitespace-ით) ამ შემოწმებას ჩუმად გვერდს აუვლიდა.
    if (String(before.role).trim() === 'admin' && role !== 'admin') {
      let admins = 0;
      for (const row of data.rows) {
        if (String(row[data.map.role]).trim() === 'admin') admins++;
      }
      if (admins <= 1) return err('FORBIDDEN', 'ბოლო ადმინის როლი ვერ შეიცვლება');
      if (email === admin.email) return err('FORBIDDEN', 'საკუთარი როლის დაქვეითება არ შეიძლება');
    }

    const sheetRow = index + 2;
    data.sheet.getRange(sheetRow, data.map.role + 1).setValue(role);
    if (hasStreet) {
      data.sheet.getRange(sheetRow, data.map.street + 1).setValue(street);
    }
    // ტექსტის ფორმატი წინასწარ ეყენება — იგივე მიზეზით, რაც ნაკვეთის განახლდა-ს დროს.
    data.sheet.getRange(sheetRow, data.map.approved_at + 1).setNumberFormat('@').setValue(new Date().toISOString());
    data.sheet.getRange(sheetRow, data.map.approved_by + 1).setValue(admin.email);

    const changes = [{ field: 'role', old: before.role, new: role }];
    if (hasStreet && String(before.street || '') !== street) {
      changes.push({ field: 'street', old: before.street, new: street });
    }
    appendLog(admin.email, 'role_change', email, changes);
    return ok({ email: email, role: role, street: hasStreet ? street : before.street });
  } finally {
    lock.releaseLock();
  }
}

// ── smoke test — რედაქტორიდან ხელით გასაშვები ───────────────────────

function smokeTest() {
  const plots = readPlots();
  console.log('ნაკვეთი: ' + plots.length);
  console.log('პოლიგონით: ' + plots.filter(function (p) { return p.geometry; }).length);
  console.log('კოორდინატით: ' + plots.filter(function (p) { return p.lat; }).length);
  console.log('პირველი: ' + JSON.stringify(plots[0]).slice(0, 200));
  console.log('პირველის updated_at: "' + plots[0].updated_at + '" (უნდა იყოს ISO სტრიქონი ან ცარიელი — არა თარიღის ტექსტი "Wed Aug..." სახის)');

  const users = readUsers();
  console.log('მომხმარებელი: ' + users.length);
  const admin = findUser(ADMIN_EMAIL);
  console.log('ადმინი ნაპოვნია: ' + (admin ? admin.role : 'არა — შეავსე მომხმარებლები!'));

  if (CLIENT_ID.indexOf('ჩასვი') === 0) {
    throw new Error('CLIENT_ID ჯერ არ ჩასმულა');
  }
  console.log('smokeTest დასრულდა');
}
