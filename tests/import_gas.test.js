/**
 * `importPlotsFromDrive()` — Apps Script-ის იმპორტი Node-ში, სტაბებით.
 *
 * ეს ფუნქცია ცოცხალ ბაზას წერს, ამიტომ სამი თვისება ტესტით უნდა იყოს
 * დაფარული: ცარიელი CSV-მნიშვნელობა არაფერს შლის, ტელეფონი ტექსტად
 * იწერება (Sheets-ის ფორმულა-ინტერპრეტაცია სწორედ მას ტეხდა) და
 * მეორე გაშვება არაფერს ცვლის.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lib = require('../apps-script/lib.js');
const CODE = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');

const HEADERS = ['საკადასტრო კოდი', 'ქუჩა', 'N', 'სრული მისამართი', 'ფართობი კვ.მ',
  'დანიშნულება', 'სახელი', 'გვარი', 'ტელეფონი', 'გრძედი', 'განედი',
  'გეომეტრია', 'წყარო', 'შენიშვნა', 'განახლდა', 'განმაახლებელი'];

/** მინიმალური Sheet — მხოლოდ ის, რასაც იმპორტი იყენებს. */
function makeSheet(rows) {
  const grid = [HEADERS.slice()].concat(rows.map(function (r) { return r.slice(); }));
  const formats = [];
  return {
    grid: grid,
    formats: formats,
    getDataRange() { const g = this.grid; return { getValues() { return g; } }; },
    getLastColumn() { return HEADERS.length; },
    getLastRow() { return this.grid.length; },
    getRange(row, col, numRows, numCols) {
      const sheet = this;
      const rowCount = numRows || 1;
      const colCount = numCols || 1;
      return {
        setNumberFormat(fmt) { formats.push({ row, col, rowCount, colCount, fmt }); return this; },
        setValue(value) { sheet.grid[row - 1][col - 1] = value; return this; },
        setValues(values) {
          for (let r = 0; r < rowCount; r++) {
            if (!sheet.grid[row - 1 + r]) sheet.grid[row - 1 + r] = [];
            for (let c = 0; c < colCount; c++) sheet.grid[row - 1 + r][col - 1 + c] = values[r][c];
          }
          return this;
        },
      };
    },
  };
}

function toCsv(table) {
  return table.map(function (row) {
    return row.map(function (cell) {
      return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');
}

/** Code.js-ის ჩატვირთვა სტაბებით; აბრუნებს sandbox-ს და ფურცლებს. */
function loadCode(sheetRowsData, csvTable) {
  const plots = makeSheet(sheetRowsData);
  const log = makeSheet([]);
  const sandbox = {
    console: { log() {} },
    Utilities: { parseCsv(text) { return parseCsvSimple(text); } },
    DriveApp: {
      getFoldersByName() { return { hasNext() { return false; } }; },
      getFilesByName() {
        let served = false;
        return {
          hasNext() { return !served; },
          next() {
            served = true;
            return {
              getName() { return 'plots.csv'; },
              getLastUpdated() { return new Date(); },
              getBlob() { return { getDataAsString() { return toCsv(csvTable); } }; },
            };
          },
        };
      },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return { getSheetByName(name) { return name === 'ლოგი' ? log : plots; } };
      },
    },
    ContentService: { createTextOutput() { return { setMimeType() { return {}; } }; }, MimeType: {} },
    Lib_mapHeaders: lib.mapHeaders,
    Lib_HEADER_MAP: null,
    Lib_parseGeometry: lib.parseGeometry,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // `Lib_HEADER_MAP` მხოლოდ `headerTitle()`-ს სჭირდება — ქართული სათაური
  // ლოგისთვის. სტაბად საკმარისია იგივე რუკა.
  vm.runInContext(CODE, sandbox);
  sandbox.Lib_HEADER_MAP = HEADER_MAP_STUB;
  return { sandbox: sandbox, plots: plots, log: log };
}

const HEADER_MAP_STUB = {};
HEADERS.forEach(function (title) {
  const key = lib.mapHeaders([title]);
  HEADER_MAP_STUB[title] = Object.keys(key)[0];
});

function parseCsvSimple(text) {
  const rows = [];
  let row = [], cur = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); cur = ''; rows.push(row); row = []; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** ერთი რიგი სათაურების რიგზე მიბმული. */
function row(values) {
  const out = new Array(HEADERS.length).fill('');
  Object.keys(values).forEach(function (title) {
    out[HEADERS.indexOf(title)] = values[title];
  });
  return out;
}

const CSV_HEADER = HEADERS.slice();

test('იმპორტი — ცარიელი CSV-მნიშვნელობა Sheet-ში არსებულს არ შლის', () => {
  const sheet = [row({
    'საკადასტრო კოდი': '72.16.21.042', 'ქუჩა': 'კედრის I გასასვლელი',
    'ტელეფონი': '+995555111222', 'შენიშვნა': 'ხელით დამატებული შენიშვნა',
  })];
  const csv = [CSV_HEADER, row({
    'საკადასტრო კოდი': '72.16.21.042', 'ქუჩა': 'კედრის I გასასვლელი',
    'ტელეფონი': '', 'შენიშვნა': '',
  })];
  const { sandbox, plots } = loadCode(sheet, csv);
  const result = sandbox.importPlotsFromDrive();

  assert.strictEqual(result.added, 0);
  assert.strictEqual(result.changedCells, 0, 'ცარიელმა ველმა ცვლილება არ უნდა გამოიწვიოს');
  assert.strictEqual(plots.grid[1][HEADERS.indexOf('ტელეფონი')], '+995555111222');
  assert.strictEqual(plots.grid[1][HEADERS.indexOf('შენიშვნა')], 'ხელით დამატებული შენიშვნა');
});

test('იმპორტი — დაკარგული ტელეფონი CSV-იდან აღდგება და ტექსტად ინიშნება', () => {
  const sheet = [row({ 'საკადასტრო კოდი': '72.16.21.042', 'ტელეფონი': '' })];
  const csv = [CSV_HEADER, row({ 'საკადასტრო კოდი': '72.16.21.042', 'ტელეფონი': '+995555111222' })];
  const { sandbox, plots } = loadCode(sheet, csv);
  sandbox.importPlotsFromDrive();

  assert.strictEqual(plots.grid[1][HEADERS.indexOf('ტელეფონი')], '+995555111222');
  const phoneFormat = plots.formats.find(function (f) {
    return f.col === HEADERS.indexOf('ტელეფონი') + 1;
  });
  assert.ok(phoneFormat && phoneFormat.fmt === '@',
    'ტელეფონის უჯრა ტექსტად უნდა დაინიშნოს, თორემ +995… ფორმულად წაიკითხება');
});

test('იმპორტი — ახალი კოდი ემატება, არსებული არ ქრება', () => {
  const sheet = [row({ 'საკადასტრო კოდი': '72.16.21.042', 'ქუჩა': 'კედრის I გასასვლელი' })];
  const csv = [CSV_HEADER,
    row({ 'საკადასტრო კოდი': '72.16.21.042', 'ქუჩა': 'კედრის I გასასვლელი' }),
    row({ 'საკადასტრო კოდი': '72.16.21.111', 'ქუჩა': 'კედრის I გასასვლელი', 'N': '11' })];
  const { sandbox, plots } = loadCode(sheet, csv);
  const result = sandbox.importPlotsFromDrive();

  assert.strictEqual(result.added, 1);
  assert.strictEqual(plots.grid.length, 3, 'სათაური + ორი რიგი');
  assert.strictEqual(plots.grid[2][HEADERS.indexOf('საკადასტრო კოდი')], '72.16.21.111');
  assert.strictEqual(plots.grid[2][HEADERS.indexOf('N')], '11');
});

test('იმპორტი — CSV-ში აღარმყოფი რიგი არ იშლება, მხოლოდ ანგარიშშია', () => {
  const sheet = [
    row({ 'საკადასტრო კოდი': '72.16.21.042' }),
    row({ 'საკადასტრო კოდი': '99.99.99.999', 'შენიშვნა': 'ხელით შეტანილი' }),
  ];
  const csv = [CSV_HEADER, row({ 'საკადასტრო კოდი': '72.16.21.042' })];
  const { sandbox, plots } = loadCode(sheet, csv);
  const result = sandbox.importPlotsFromDrive();

  // მასივი vm-კონტექსტიდან მოდის — მისი prototype სხვა realm-ისაა,
  // ამიტომ deepStrictEqual ვერ გამოდგება; შიგთავსს ვადარებთ.
  assert.strictEqual(Array.from(result.notInCsv).join(','), '99.99.99.999');
  assert.strictEqual(plots.grid.length, 3, 'რიგი ადგილზე დარჩა');
  assert.strictEqual(plots.grid[2][HEADERS.indexOf('შენიშვნა')], 'ხელით შეტანილი');
});

test('იმპორტი — იდემპოტენტურია: მეორე გაშვება არაფერს ცვლის', () => {
  const sheet = [row({ 'საკადასტრო კოდი': '72.16.21.042', 'ქუჩა': 'ძველი ქუჩა' })];
  const csv = [CSV_HEADER,
    row({ 'საკადასტრო კოდი': '72.16.21.042', 'ქუჩა': 'კედრის I გასასვლელი' }),
    row({ 'საკადასტრო კოდი': '72.16.21.111', 'ქუჩა': 'კედრის I გასასვლელი' })];

  const first = loadCode(sheet, csv);
  const r1 = first.sandbox.importPlotsFromDrive();
  assert.strictEqual(r1.added, 1);
  assert.strictEqual(r1.changedCells, 1);

  // მეორე გაშვება უკვე განახლებულ ფურცელზე
  const after = first.plots.grid.slice(1);
  const second = loadCode(after, csv);
  const r2 = second.sandbox.importPlotsFromDrive();
  assert.strictEqual(r2.added, 0);
  assert.strictEqual(r2.changedCells, 0, 'მეორე გაშვება no-op უნდა იყოს');
});

test('იმპორტი — შეცვლილი საკადასტრო კოდი რიგს გადაარქმევს, დუბლიკატს არ ქმნის', () => {
  // ძველი კოდით რიგს მფლობელიც აქვს და ტელეფონიც — გადარქმევის გარეშე
  // ისინი ძველ რიგთან დარჩებოდნენ, ახალი კოდი კი ცარიელი დაემატებოდა.
  const sheet = [row({
    'საკადასტრო კოდი': '01.99.999.999',
    'სახელი': 'დარეჯან', 'გვარი': 'ჩხეიძე', 'ტელეფონი': '+995599123456',
  })];
  const csv = [CSV_HEADER, row({
    'საკადასტრო კოდი': '01.72.16.097.077', 'ქუჩა': 'კედრის I ჩიხი', 'ფართობი კვ.მ': '487.24',
  })];
  const { sandbox, plots } = loadCode(sheet, csv);
  const result = sandbox.importPlotsFromDrive();

  assert.strictEqual(result.renamed, 1);
  assert.strictEqual(result.added, 0, 'დუბლიკატი არ უნდა დაემატოს');
  assert.strictEqual(plots.grid.length, 2, 'სათაური + ერთი რიგი');
  assert.strictEqual(plots.grid[1][HEADERS.indexOf('საკადასტრო კოდი')], '01.72.16.097.077');
  assert.strictEqual(plots.grid[1][HEADERS.indexOf('ტელეფონი')], '+995599123456',
    'გადარქმევისას ტელეფონი რიგთან რჩება');
  assert.strictEqual(plots.grid[1][HEADERS.indexOf('ქუჩა')], 'კედრის I ჩიხი');
});

test('იმპორტი — გადარქმევა არ ხდება, თუ ახალი კოდი უკვე არსებობს', () => {
  const sheet = [
    row({ 'საკადასტრო კოდი': '01.99.999.999', 'ტელეფონი': '+995599123456' }),
    row({ 'საკადასტრო კოდი': '01.72.16.097.077' }),
  ];
  const csv = [CSV_HEADER, row({ 'საკადასტრო კოდი': '01.72.16.097.077' })];
  const { sandbox, plots } = loadCode(sheet, csv);
  const result = sandbox.importPlotsFromDrive();

  assert.strictEqual(result.renamed, 0);
  assert.strictEqual(plots.grid[1][HEADERS.indexOf('საკადასტრო კოდი')], '01.99.999.999');
});
