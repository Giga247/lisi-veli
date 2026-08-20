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

test('isEditableField — თეთრი სია', () => {
  assert.strictEqual(lib.isEditableField('phone'), true);
  assert.strictEqual(lib.isEditableField('first_name'), true);
  assert.strictEqual(lib.isEditableField('note'), true);
});

test('isEditableField — გეო-ველები და გასაღები დაცულია', () => {
  assert.strictEqual(lib.isEditableField('geometry'), false);
  assert.strictEqual(lib.isEditableField('lat'), false);
  assert.strictEqual(lib.isEditableField('lon'), false);
  assert.strictEqual(lib.isEditableField('cad'), false);
});

test('isEditableField — სისტემური ველები დაცულია', () => {
  assert.strictEqual(lib.isEditableField('updated_at'), false);
  assert.strictEqual(lib.isEditableField('updated_by'), false);
});

test('isEditableField — უცნობი ველი უარყოფილია (თეთრი სია, არა შავი)', () => {
  assert.strictEqual(lib.isEditableField('რაღაც_ახალი'), false);
});

test('checkPermission — member მხოლოდ კითხულობს', () => {
  assert.strictEqual(lib.checkPermission('member', 'plots'), true);
  assert.strictEqual(lib.checkPermission('member', 'updatePlot'), false);
  assert.strictEqual(lib.checkPermission('member', 'setRole'), false);
});

test('checkPermission — moderator რედაქტირებს, ადმინობს ვერა', () => {
  assert.strictEqual(lib.checkPermission('moderator', 'updatePlot'), true);
  assert.strictEqual(lib.checkPermission('moderator', 'setRole'), false);
  assert.strictEqual(lib.checkPermission('moderator', 'logs'), false);
});

test('checkPermission — admin ყველაფერს', () => {
  assert.strictEqual(lib.checkPermission('admin', 'updatePlot'), true);
  assert.strictEqual(lib.checkPermission('admin', 'setRole'), true);
  assert.strictEqual(lib.checkPermission('admin', 'logs'), true);
});

test('checkPermission — pending და blocked ვერაფერს', () => {
  assert.strictEqual(lib.checkPermission('pending', 'plots'), false);
  assert.strictEqual(lib.checkPermission('blocked', 'plots'), false);
  assert.strictEqual(lib.checkPermission('', 'plots'), false);
});

const CID = '123456789-abc.apps.googleusercontent.com';
const NOW = 1800000000;

function claims(extra) {
  return Object.assign({
    aud: CID,
    iss: 'https://accounts.google.com',
    email: 'Neighbor@Gmail.com',
    email_verified: 'true',
    exp: String(NOW + 3600),
  }, extra || {});
}

test('verifyTokenClaims — სწორი ტოკენი, მეილი lowercase-ში', () => {
  const r = lib.verifyTokenClaims(claims(), CID, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.email, 'neighbor@gmail.com');
});

test('verifyTokenClaims — სხვისი aud უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ aud: 'სხვა-აპლიკაცია' }), CID, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'UNAUTHENTICATED');
});

test('verifyTokenClaims — არასწორი iss უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ iss: 'evil.example.com' }), CID, NOW);
  assert.strictEqual(r.ok, false);
});

test('verifyTokenClaims — accounts.google.com სქემის გარეშეც ვარგისია', () => {
  const r = lib.verifyTokenClaims(claims({ iss: 'accounts.google.com' }), CID, NOW);
  assert.strictEqual(r.ok, true);
});

test('verifyTokenClaims — დაუდასტურებელი მეილი უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ email_verified: 'false' }), CID, NOW);
  assert.strictEqual(r.ok, false);
});

test('verifyTokenClaims — გასული ტოკენი უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ exp: String(NOW - 1) }), CID, NOW);
  assert.strictEqual(r.ok, false);
});

test('verifyTokenClaims — მეილის გარეშე უარყოფილია', () => {
  const r = lib.verifyTokenClaims(claims({ email: '' }), CID, NOW);
  assert.strictEqual(r.ok, false);
});

test('verifyTokenClaims — ცარიელი claims უარყოფილია', () => {
  assert.strictEqual(lib.verifyTokenClaims(null, CID, NOW).ok, false);
  assert.strictEqual(lib.verifyTokenClaims({}, CID, NOW).ok, false);
});

test('diffFields — მხოლოდ შეცვლილი ველები', () => {
  const oldRow = { phone: '+995599111111', first_name: 'ზურაბ' };
  const out = lib.diffFields(oldRow, { phone: '+995599222222', first_name: 'ზურაბ' });
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0], {
    field: 'phone', old: '+995599111111', new: '+995599222222',
  });
});

test('diffFields — უცვლელი ველი არ იწერება', () => {
  const out = lib.diffFields({ phone: 'X' }, { phone: 'X' });
  assert.strictEqual(out.length, 0);
});

test('diffFields — ცარიელიდან შევსებამდე ჩაიწერება', () => {
  const out = lib.diffFields({ phone: '' }, { phone: '+995599111111' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].old, '');
});

test('diffFields — რიცხვი და ტექსტი ერთნაირად ედრება', () => {
  const out = lib.diffFields({ area: 599 }, { area: '599' });
  assert.strictEqual(out.length, 0);
});
