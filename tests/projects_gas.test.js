/**
 * პროექტების სერვერული ჰენდლერები Node-ში, Sheet-ის სტაბებით.
 *
 * ეს ფუნქციები ცოცხალ ბაზას წერენ, ამიტომ ტესტით უნდა იყოს დაფარული
 * ის, რასაც სუფთა ლოგიკა ვერ ხედავს: სწორ უჯრაში ჩაწერა, უცხო ქუჩის
 * უარყოფა სერვერზე, სტორნო და გააქტიურების გაყინვა.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lib = require('../apps-script/lib.js');
const CODE = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');

const SHEETS = {
  'ნაკვეთები': ['საკადასტრო კოდი', 'ქუჩა', 'N', 'სრული მისამართი', 'ფართობი კვ.მ',
    'დანიშნულება', 'სახელი', 'გვარი', 'ტელეფონი', 'გრძედი', 'განედი',
    'გეომეტრია', 'წყარო', 'შენიშვნა', 'განახლდა', 'განმაახლებელი'],
  'მომხმარებლები': ['მეილი', 'როლი', 'ქუჩა', 'სახელი გვარი', 'მოთხოვნის თარიღი',
    'დამტკიცების თარიღი', 'დამამტკიცებელი'],
  'ლოგი': ['დრო', 'ვინ', 'მოქმედება', 'საკადასტრო კოდი', 'ველი',
    'ძველი მნიშვნელობა', 'ახალი მნიშვნელობა'],
  'პროექტები': ['პროექტის ID', 'პროექტის სახელი', 'აღწერა', 'ბიუჯეტი',
    'განაწილების წესი', 'ფიქსირებული თანხა', 'ქუჩები', 'ხაზინდარი',
    'დაწყება', 'დასრულება', 'სტატუსი', 'შექმნის თარიღი', 'შემქმნელი'],
  'ვალდებულებები': ['პროექტი', 'საკადასტრო კოდი', 'წილი', 'პასუხი',
    'შენიშვნა', 'ვინ ჩაწერა', 'როდის ჩაიწერა'],
  'გადახდები': ['გადახდის ID', 'პროექტი', 'საკადასტრო კოდი', 'თანხა',
    'გადახდის თარიღი', 'ფორმა', 'შენიშვნა', 'ვინ ჩაწერა', 'როდის ჩაიწერა'],
};

function makeSheet(headers, rows) {
  const grid = [headers.slice()].concat((rows || []).map(function (r) { return r.slice(); }));
  return {
    grid: grid,
    formats: [],
    getDataRange() { const g = this.grid; return { getValues() { return g; } }; },
    getLastColumn() { return headers.length; },
    getLastRow() { return this.grid.length; },
    getMaxRows() { return this.grid.length + 100; },
    getRange(row, col, numRows, numCols) {
      const sheet = this;
      const rowCount = numRows || 1;
      const colCount = numCols || 1;
      return {
        setNumberFormat(fmt) { sheet.formats.push({ row, col, fmt }); return this; },
        setFontWeight() { return this; },
        setValue(value) {
          if (!sheet.grid[row - 1]) sheet.grid[row - 1] = [];
          sheet.grid[row - 1][col - 1] = value;
          return this;
        },
        setValues(values) {
          for (let r = 0; r < rowCount; r++) {
            if (!sheet.grid[row - 1 + r]) sheet.grid[row - 1 + r] = new Array(headers.length).fill('');
            for (let c = 0; c < colCount; c++) sheet.grid[row - 1 + r][col - 1 + c] = values[r][c];
          }
          return this;
        },
      };
    },
  };
}

/** ერთი რიგი სათაურების მიხედვით. */
function rowFor(sheetName, values) {
  const headers = SHEETS[sheetName];
  const out = new Array(headers.length).fill('');
  Object.keys(values).forEach(function (title) {
    const index = headers.indexOf(title);
    if (index === -1) throw new Error('უცნობი სვეტი: ' + title);
    out[index] = values[title];
  });
  return out;
}

function load(initial) {
  const sheets = {};
  Object.keys(SHEETS).forEach(function (name) {
    sheets[name] = makeSheet(SHEETS[name], (initial && initial[name]) || []);
  });

  let locked = false;
  const sandbox = {
    console: { log() {}, error() {} },
    JSON: JSON,
    Math: Math,
    Date: Date,
    String: String,
    Number: Number,
    Array: Array,
    Object: Object,
    isFinite: isFinite,
    Utilities: {
      formatDate(date, tz, fmt) {
        const iso = new Date(date).toISOString();
        return fmt === 'yyyy-MM-dd' ? iso.slice(0, 10) : iso;
      },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheetByName(name) { return sheets[name] || null; },
          insertSheet(name) { sheets[name] = makeSheet(SHEETS[name] || [], []); return sheets[name]; },
        };
      },
      flush() {},
    },
    LockService: {
      getScriptLock() {
        return {
          tryLock() { if (locked) return false; locked = true; return true; },
          releaseLock() { locked = false; },
        };
      },
    },
    ContentService: {
      createTextOutput(text) { return { setMimeType() { return { getContent() { return text; } }; } }; },
      MimeType: { JSON: 'json' },
    },
  };
  Object.keys(lib).forEach(function (key) { sandbox['Lib_' + key] = lib[key]; });
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox);
  return { sandbox: sandbox, sheets: sheets };
}

/** ჰენდლერის პასუხი JSON-ად. */
function unwrap(response) { return JSON.parse(response.getContent()); }

const PLOTS = [
  rowFor('ნაკვეთები', { 'საკადასტრო კოდი': 'A', 'ქუჩა': 'კედრის ქუჩა', 'ფართობი კვ.მ': 500,
    'სახელი': 'ზურაბ', 'გვარი': 'ბერიძე', 'სრული მისამართი': 'კედრის ქუჩა 1' }),
  rowFor('ნაკვეთები', { 'საკადასტრო კოდი': 'B', 'ქუჩა': 'კედრის ქუჩა', 'ფართობი კვ.მ': 1500,
    'სახელი': 'ელენე', 'გვარი': 'კაპანაძე', 'სრული მისამართი': 'კედრის ქუჩა 2' }),
  rowFor('ნაკვეთები', { 'საკადასტრო კოდი': 'C', 'ქუჩა': 'კედრის I ჩიხი', 'ფართობი კვ.მ': 1000,
    'სახელი': 'ქეთევან', 'გვარი': 'ხარაძე', 'სრული მისამართი': 'კედრის I ჩიხი 3' }),
];

const USERS = [
  rowFor('მომხმარებლები', { 'მეილი': 'admin@x.ge', 'როლი': 'admin' }),
  rowFor('მომხმარებლები', { 'მეილი': 'mod@x.ge', 'როლი': 'moderator', 'ქუჩა': 'კედრის ქუჩა' }),
  rowFor('მომხმარებლები', { 'მეილი': 'kaz@x.ge', 'როლი': 'member' }),
];

const ADMIN = { email: 'admin@x.ge', role: 'admin', street: '' };
const MOD = { email: 'mod@x.ge', role: 'moderator', street: 'კედრის ქუჩა' };
const TREASURER = { email: 'kaz@x.ge', role: 'member', street: '' };

/** პროექტი შექმნილი და გააქტიურებული — ტესტების საერთო საწყისი. */
function activeProject(overrides) {
  const env = load({ 'ნაკვეთები': PLOTS, 'მომხმარებლები': USERS });
  const created = unwrap(env.sandbox.handleCreateProject(ADMIN, {
    project: Object.assign({
      name: 'სანიაღვრე', description: 'არხი', budget: 1000,
      split_method: 'area', streets: '', treasurer: 'kaz@x.ge',
    }, overrides || {}),
  }));
  assert.strictEqual(created.ok, true, created.message);
  const activated = unwrap(env.sandbox.handleActivateProject(ADMIN, { id: created.data.id }));
  assert.strictEqual(activated.ok, true, activated.message);
  return { env: env, id: created.data.id, activated: activated.data };
}

/* ── შექმნა და გააქტიურება ───────────────────────────────────────── */

test('შექმნა — პროექტი draft სტატუსით იწერება', () => {
  const env = load({ 'ნაკვეთები': PLOTS, 'მომხმარებლები': USERS });
  const result = unwrap(env.sandbox.handleCreateProject(ADMIN, {
    project: { name: 'სანიაღვრე', budget: 1000, split_method: 'area' },
  }));
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.data.id, 'PRJ-001');
  assert.strictEqual(result.data.status, 'draft');
  const grid = env.sheets['პროექტები'].grid;
  assert.strictEqual(grid.length, 2, 'სათაური + ერთი პროექტი');
  assert.strictEqual(grid[1][SHEETS['პროექტები'].indexOf('სტატუსი')], 'draft');
});

test('შექმნა — ხაზინდარი ვერ იქნება იმავე ქუჩის მოდერატორი', () => {
  const env = load({ 'ნაკვეთები': PLOTS, 'მომხმარებლები': USERS });
  const result = unwrap(env.sandbox.handleCreateProject(ADMIN, {
    project: { name: 'ს', budget: 100, streets: 'კედრის ქუჩა', treasurer: 'mod@x.ge' },
  }));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'VALIDATION');
});

test('გააქტიურება — ყოველ ნაკვეთს ვალდებულება ეწერება', () => {
  const { env, activated } = activeProject();
  assert.strictEqual(activated.households, 3);
  const grid = env.sheets['ვალდებულებები'].grid;
  assert.strictEqual(grid.length, 4, 'სათაური + სამი კომლი');
  const dueColumn = SHEETS['ვალდებულებები'].indexOf('წილი');
  const statusColumn = SHEETS['ვალდებულებები'].indexOf('პასუხი');
  // ფართობები 500/1500/1000 = 3000; 1000 ₾ -> 165/500/335 დამრგვალებით
  assert.deepStrictEqual(grid.slice(1).map(function (r) { return r[dueColumn]; }),
    [165, 500, 335]);
  grid.slice(1).forEach(function (r) {
    assert.strictEqual(r[statusColumn], 'not_contacted');
  });
});

test('გააქტიურება — მეორედ ვერ გაკეთდება', () => {
  const { env, id } = activeProject();
  const again = unwrap(env.sandbox.handleActivateProject(ADMIN, { id: id }));
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.error, 'VALIDATION', 'active -> active გადასვლა არ არსებობს');
});

test('გააქტიურება — წილი იყინება: ფართობის შეცვლა მას აღარ ცვლის', () => {
  const { env, id } = activeProject();
  const areaColumn = SHEETS['ნაკვეთები'].indexOf('ფართობი კვ.მ');
  env.sheets['ნაკვეთები'].grid[1][areaColumn] = 99999;

  const view = unwrap(env.sandbox.handleProject({ id: id }));
  const rowA = view.data.rows.filter(function (r) { return r.cad === 'A'; })[0];
  assert.strictEqual(rowA.amount_due, 165, 'გაყინული წილი უცვლელია');
});

/* ── პასუხის ჩაწერა ──────────────────────────────────────────────── */

test('პასუხი — მოდერატორი თავის ქუჩაზე წერს', () => {
  const { env, id } = activeProject();
  const result = unwrap(env.sandbox.handleSetPledge(MOD, {
    project_id: id, cad: 'A', status: 'paying',
  }));
  assert.strictEqual(result.ok, true);
  const grid = env.sheets['ვალდებულებები'].grid;
  const statusColumn = SHEETS['ვალდებულებები'].indexOf('პასუხი');
  const byColumn = SHEETS['ვალდებულებები'].indexOf('ვინ ჩაწერა');
  assert.strictEqual(grid[1][statusColumn], 'paying');
  assert.strictEqual(grid[1][byColumn], 'mod@x.ge');
});

test('პასუხი — მოდერატორი სხვის ქუჩაზე ვერ წერს', () => {
  const { env, id } = activeProject();
  const result = unwrap(env.sandbox.handleSetPledge(MOD, {
    project_id: id, cad: 'C', status: 'paying',
  }));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'FORBIDDEN');
  const statusColumn = SHEETS['ვალდებულებები'].indexOf('პასუხი');
  assert.strictEqual(env.sheets['ვალდებულებები'].grid[3][statusColumn], 'not_contacted',
    'უარყოფის შემდეგ ფურცელი ხელუხლებელია');
});

test('პასუხი — ნუსხის გარეთ მნიშვნელობა უარყოფილია', () => {
  const { env, id } = activeProject();
  const result = unwrap(env.sandbox.handleSetPledge(ADMIN, {
    project_id: id, cad: 'A', status: 'maybe',
  }));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'VALIDATION');
});

test('პასუხი — სამივე ნუსხისეული მნიშვნელობა გადის', () => {
  const { env, id } = activeProject();
  ['paying', 'loan', 'declined'].forEach(function (status, index) {
    const cad = ['A', 'B', 'C'][index];
    const result = unwrap(env.sandbox.handleSetPledge(ADMIN, {
      project_id: id, cad: cad, status: status,
    }));
    assert.strictEqual(result.ok, true, status + ': ' + result.message);
  });
});

test('პასუხი — ლოგში ჩანს ვინ, რა და რომელ პროექტში', () => {
  const { env, id } = activeProject();
  unwrap(env.sandbox.handleSetPledge(MOD, { project_id: id, cad: 'A', status: 'declined' }));
  const log = env.sheets['ლოგი'].grid;
  const last = log[log.length - 1];
  assert.strictEqual(last[SHEETS['ლოგი'].indexOf('ვინ')], 'mod@x.ge');
  assert.strictEqual(last[SHEETS['ლოგი'].indexOf('მოქმედება')], 'pledge');
  assert.strictEqual(last[SHEETS['ლოგი'].indexOf('საკადასტრო კოდი')], 'A');
  assert.strictEqual(last[SHEETS['ლოგი'].indexOf('ახალი მნიშვნელობა')], 'declined');
});

/* ── გადახდა ─────────────────────────────────────────────────────── */

test('გადახდა — ხაზინდარი წერს, მოდერატორი ვერა', () => {
  const { env, id } = activeProject();
  const good = unwrap(env.sandbox.handleRecordPayment(TREASURER, {
    project_id: id, cad: 'A', amount: 165, method: 'cash',
  }));
  assert.strictEqual(good.ok, true, good.message);

  const bad = unwrap(env.sandbox.handleRecordPayment(MOD, {
    project_id: id, cad: 'B', amount: 100, method: 'cash',
  }));
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.error, 'FORBIDDEN');
});

test('გადახდა — ნულოვანი თანხა უარყოფილია', () => {
  const { env, id } = activeProject();
  const result = unwrap(env.sandbox.handleRecordPayment(ADMIN, {
    project_id: id, cad: 'A', amount: 0,
  }));
  assert.strictEqual(result.ok, false);
});

test('გადახდა — უარყოფითი მხოლოდ შენიშვნით (storno)', () => {
  const { env, id } = activeProject();
  const noNote = unwrap(env.sandbox.handleRecordPayment(ADMIN, {
    project_id: id, cad: 'A', amount: -50,
  }));
  assert.strictEqual(noNote.ok, false);
  const withNote = unwrap(env.sandbox.handleRecordPayment(ADMIN, {
    project_id: id, cad: 'A', amount: -50, note: 'storno — ორჯერ ჩაიწერა',
  }));
  assert.strictEqual(withNote.ok, true, withNote.message);
});

test('გადახდა — მომავლის თარიღი უარყოფილია', () => {
  const { env, id } = activeProject();
  const result = unwrap(env.sandbox.handleRecordPayment(ADMIN, {
    project_id: id, cad: 'A', amount: 100, paid_on: '2099-01-01',
  }));
  assert.strictEqual(result.ok, false);
});

/* ── ხედი ────────────────────────────────────────────────────────── */

test('ხედი — ფერი გადახდისა და პასუხის მიხედვით', () => {
  const { env, id } = activeProject();
  unwrap(env.sandbox.handleSetPledge(ADMIN, { project_id: id, cad: 'A', status: 'paying' }));
  unwrap(env.sandbox.handleSetPledge(ADMIN, { project_id: id, cad: 'B', status: 'declined' }));
  unwrap(env.sandbox.handleRecordPayment(ADMIN, {
    project_id: id, cad: 'A', amount: 165, method: 'cash',
  }));

  const view = unwrap(env.sandbox.handleProject({ id: id }));
  const byCad = {};
  view.data.rows.forEach(function (r) { byCad[r.cad] = r; });
  assert.strictEqual(byCad.A.color, 'paid');
  assert.strictEqual(byCad.B.color, 'declined');
  assert.strictEqual(byCad.C.color, 'none');
  assert.strictEqual(byCad.A.paid, 165);
});

test('ხედი — ჯამები ბიუჯეტთან შედარებით', () => {
  const { env, id } = activeProject();
  unwrap(env.sandbox.handleSetPledge(ADMIN, { project_id: id, cad: 'B', status: 'loan' }));
  unwrap(env.sandbox.handleRecordPayment(ADMIN, {
    project_id: id, cad: 'A', amount: 165, method: 'cash',
  }));
  const view = unwrap(env.sandbox.handleProject({ id: id }));
  assert.strictEqual(view.data.totals.collected, 165);
  assert.strictEqual(view.data.totals.loan, 500);
  assert.strictEqual(view.data.totals.remaining, 835);
});

test('ხედი — მფლობელი და მისამართი ნაკვეთების ფურცლიდან ერწყმის', () => {
  const { env, id } = activeProject();
  const view = unwrap(env.sandbox.handleProject({ id: id }));
  const rowA = view.data.rows.filter(function (r) { return r.cad === 'A'; })[0];
  assert.strictEqual(rowA.last_name, 'ბერიძე');
  assert.strictEqual(rowA.street, 'კედრის ქუჩა');
  assert.strictEqual(rowA.address, 'კედრის ქუჩა 1');
});

test('სია — ბარათს ჯამები და კომლების რაოდენობა მოსდევს', () => {
  const { env } = activeProject();
  const list = unwrap(env.sandbox.handleProjects());
  assert.strictEqual(list.ok, true);
  assert.strictEqual(list.data.length, 1);
  assert.strictEqual(list.data[0].households, 3);
  assert.strictEqual(list.data[0].totals.budget, 1000);
});

test('ფურცლების შექმნა — განმეორებით გაშვება უსაფრთხოა', () => {
  const env = load({ 'ნაკვეთები': PLOTS, 'მომხმარებლები': USERS });
  const first = env.sandbox.setupProjectSheets();
  const second = env.sandbox.setupProjectSheets();
  assert.ok(second.every(function (line) { return line.indexOf('უკვე არსებობს') !== -1; }),
    'მეორე გაშვება მხოლოდ ანგარიშს აბრუნებს: ' + second.join(' | '));
  assert.ok(first.length === 3);
});
