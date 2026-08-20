const test = require('node:test');
const assert = require('node:assert');
const lib = require('../apps-script/lib.js');

test('mapHeaders — ქართული სათაურები გასაღებებად', () => {
  const headers = ['საკადასტრო კოდი', 'ქუჩა', 'ტელეფონი'];
  const map = lib.mapHeaders(headers);
  assert.strictEqual(map.cad, 0);
  assert.strictEqual(map.street, 1);
  assert.strictEqual(map.phone, 2);
});

test('mapHeaders — არეული თანმიმდევრობა მაინც მუშაობს', () => {
  const map = lib.mapHeaders(['ტელეფონი', 'საკადასტრო კოდი']);
  assert.strictEqual(map.phone, 0);
  assert.strictEqual(map.cad, 1);
});

test('mapHeaders — ზედმეტი გამოტოვება ირეცხება', () => {
  const map = lib.mapHeaders(['  საკადასტრო კოდი  ']);
  assert.strictEqual(map.cad, 0);
});

test('mapHeaders — ლოგის „ვინ" და მომხმარებლის „მეილი" არ ერევა', () => {
  const log = lib.mapHeaders(['დრო', 'ვინ', 'მოქმედება']);
  assert.strictEqual(log.by, 1);
  assert.strictEqual(log.email, undefined);
  const users = lib.mapHeaders(['მეილი', 'როლი']);
  assert.strictEqual(users.email, 0);
  assert.strictEqual(users.by, undefined);
});

test('mapHeaders — უცნობი სვეტი იგნორირდება, არ აგდებს შეცდომას', () => {
  const map = lib.mapHeaders(['საკადასტრო კოდი', 'რაღაც ახალი სვეტი']);
  assert.strictEqual(map.cad, 0);
  assert.strictEqual(Object.keys(map).length, 1);
});

test('normalizePhone — ცხრანიშნა ნომერს კოდი ემატება', () => {
  assert.deepStrictEqual(lib.normalizePhone('599123456'),
    { ok: true, value: '+995599123456' });
});

test('normalizePhone — გამოტოვებები და დეფისები ირეცხება', () => {
  assert.deepStrictEqual(lib.normalizePhone('+995 599 12-34-56'),
    { ok: true, value: '+995599123456' });
});

test('normalizePhone — 995-ით დაწყებული', () => {
  assert.deepStrictEqual(lib.normalizePhone('995599123456'),
    { ok: true, value: '+995599123456' });
});

test('normalizePhone — ცარიელი დაშვებულია', () => {
  assert.deepStrictEqual(lib.normalizePhone(''), { ok: true, value: '' });
  assert.deepStrictEqual(lib.normalizePhone(null), { ok: true, value: '' });
});

test('normalizePhone — ასოები უარყოფილია', () => {
  const r = lib.normalizePhone('abc');
  assert.strictEqual(r.ok, false);
  assert.ok(r.message.length > 0);
});

test('normalizePhone — მოკლე ნომერი უარყოფილია', () => {
  assert.strictEqual(lib.normalizePhone('5991234').ok, false);
});

test('normalizePhone — გრძელი ნომერი უარყოფილია', () => {
  assert.strictEqual(lib.normalizePhone('5991234567890').ok, false);
});

test('parseGeometry — სწორი პოლიგონი', () => {
  const cell = '[[[44.72,41.74],[44.73,41.74],[44.73,41.75],[44.72,41.74]]]';
  const out = lib.parseGeometry(cell);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].length, 4);
  assert.deepStrictEqual(out[0][0], [44.72, 41.74]);
});

test('parseGeometry — ცარიელი უჯრა -> null', () => {
  assert.strictEqual(lib.parseGeometry(''), null);
  assert.strictEqual(lib.parseGeometry(null), null);
});

test('parseGeometry — დაზიანებული JSON -> null, არა გამონაკლისი', () => {
  assert.strictEqual(lib.parseGeometry('[[[44.72,'), null);
});

test('parseGeometry — არასწორი სტრუქტურა -> null', () => {
  assert.strictEqual(lib.parseGeometry('"რაღაც ტექსტი"'), null);
  assert.strictEqual(lib.parseGeometry('[]'), null);
  assert.strictEqual(lib.parseGeometry('[[[44.72,41.74]]]'), null); // 1 წერტილი
});
