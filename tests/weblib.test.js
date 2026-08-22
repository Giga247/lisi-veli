const test = require('node:test');
const assert = require('node:assert');
const WebLib = require('../js/lib.js');

const PLOTS = [
  { cad: 'A', street: 'კედრის ქუჩა', num: '1', address: 'კედრის ქუჩა N1',
    first_name: 'ზურაბ', last_name: 'ბერიძე', phone: '+995599111111',
    area: 599, geometry: [[[44.7, 41.7], [44.7, 41.8], [44.8, 41.8], [44.7, 41.7]]],
    lat: 41.7, lon: 44.7 },
  { cad: 'B', street: 'კედრის I ჩიხი', num: '2', address: 'კედრის I ჩიხი N2',
    first_name: 'ელენე', last_name: 'კაპანაძე', phone: '',
    area: 300, geometry: null, lat: 41.75, lon: 44.72 },
  { cad: 'C', street: '', num: '', address: '',
    first_name: '', last_name: '', phone: '',
    area: '', geometry: null, lat: null, lon: null },
];

test('fullName — გვარი და სახელი', () => {
  assert.strictEqual(WebLib.fullName(PLOTS[0]), 'ბერიძე ზურაბ');
});

test('fullName — ცარიელი -> ტირე', () => {
  assert.strictEqual(WebLib.fullName(PLOTS[2]), '—');
});

test('mapStatus — პოლიგონი, მარკერი, არცერთი', () => {
  assert.strictEqual(WebLib.mapStatus(PLOTS[0]), 'polygon');
  assert.strictEqual(WebLib.mapStatus(PLOTS[1]), 'marker');
  assert.strictEqual(WebLib.mapStatus(PLOTS[2]), 'missing');
});

test('streetList — უნიკალური, დალაგებული, ცარიელის გარეშე', () => {
  assert.deepStrictEqual(WebLib.streetList(PLOTS),
    ['კედრის I ჩიხი', 'კედრის ქუჩა']);
});

test('filterPlots — ძებნა სახელით', () => {
  const out = WebLib.filterPlots(PLOTS, { query: 'ბერიძე', street: '' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].cad, 'A');
});

test('filterPlots — ძებნა საკადასტრო კოდით', () => {
  const out = WebLib.filterPlots(PLOTS, { query: 'B', street: '' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].cad, 'B');
});

test('filterPlots — ძებნა რეგისტრს არ ითვალისწინებს', () => {
  const out = WebLib.filterPlots(PLOTS, { query: 'b', street: '' });
  assert.strictEqual(out.length, 1);
});

test('filterPlots — ქუჩის ფილტრი', () => {
  const out = WebLib.filterPlots(PLOTS, { query: '', street: 'კედრის ქუჩა' });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].cad, 'A');
});

test('filterPlots — ძებნა და ფილტრი ერთად', () => {
  const out = WebLib.filterPlots(PLOTS, { query: 'ელენე', street: 'კედრის ქუჩა' });
  assert.strictEqual(out.length, 0);
});

test('filterPlots — ცარიელი ფილტრი ყველას აბრუნებს', () => {
  assert.strictEqual(WebLib.filterPlots(PLOTS, { query: '', street: '' }).length, 3);
});

test('sortPlots — ფართობით ზრდადობით, ცარიელი ბოლოში', () => {
  const out = WebLib.sortPlots(PLOTS, 'area', 'asc');
  assert.deepStrictEqual(out.map((p) => p.cad), ['B', 'A', 'C']);
});

test('sortPlots — ფართობით კლებადობით, ცარიელი ისევ ბოლოში', () => {
  const out = WebLib.sortPlots(PLOTS, 'area', 'desc');
  assert.deepStrictEqual(out.map((p) => p.cad), ['A', 'B', 'C']);
});

test('sortPlots — ორიგინალი მასივი არ იცვლება', () => {
  const before = PLOTS.map((p) => p.cad).join(',');
  WebLib.sortPlots(PLOTS, 'area', 'desc');
  assert.strictEqual(PLOTS.map((p) => p.cad).join(','), before);
});

// რეგრესია: streetList-ში კოდპოინტური შედარებაა გამოყენებული (და არა
// localeCompare(a, b, 'ka')) — იხ. განმარტება js/lib.js-ში, streetList-ის
// ფუნქციაში. ეს ტესტი რეალურ, შერეულ-დამწერლობიან ქუჩების სახელებზეა აგებული
// და მიზნად ისახავს არა happy-path-ის შემოწმებას, არამედ იმ შემთხვევის დაჭერას,
// როცა ვინმე ამ არჩევანს localeCompare('ka')-ზე დააბრუნებს — მაშინ ეს ტესტი
// უნდა ჩავარდეს.
test('streetList — რეგრესია: ნამდვილი ქუჩების სახელები (ლათინური რომაული ციფრები) სწორად ლაგდება, localeCompare("ka") არასწორად', () => {
  const shuffledStreets = [
    'ლეო კვაჭაძის ქუჩა',
    'კედრის III გასასვლელი',
    'კედრის ქუჩა',
    'კედრის I ჩიხი',
    'კედრის IV გასასვლელი',
    'კედრის I გასასვლელი',
    'კედრის II გასასვლელი',
    'კედრის I შესახვევი',
  ];
  const plots = shuffledStreets.map((street, i) => ({ cad: 'S' + i, street: street }));
  assert.deepStrictEqual(WebLib.streetList(plots), [
    'კედრის I გასასვლელი',
    'კედრის I შესახვევი',
    'კედრის I ჩიხი',
    'კედრის II გასასვლელი',
    'კედრის III გასასვლელი',
    'კედრის IV გასასვლელი',
    'კედრის ქუჩა',
    'ლეო კვაჭაძის ქუჩა',
  ]);
});

// ── escapeHtml ─────────────────────────────────────────────────────────
// სამი კერძო ასლი (table.js, map.js, admin.js) აქ გაერთიანდა. ეს
// ერთადერთი ფუნქციაა, რომელიც ხელით რედაქტირებულ Sheet-ს შენახული
// injection-ისგან გვიცავს — ამიტომ ყველა სიმბოლო ცალკე მოწმდება.

test('escapeHtml — თითოეული სიმბოლო ცალკე', () => {
  assert.strictEqual(WebLib.escapeHtml('&'), '&amp;');
  assert.strictEqual(WebLib.escapeHtml('<'), '&lt;');
  assert.strictEqual(WebLib.escapeHtml('>'), '&gt;');
  assert.strictEqual(WebLib.escapeHtml('"'), '&quot;');
  assert.strictEqual(WebLib.escapeHtml("'"), '&#39;');
});

test('escapeHtml — რამდენიმე სიმბოლო ერთ სტრიქონში', () => {
  assert.strictEqual(
    WebLib.escapeHtml('<img src="x" onerror=\'alert(1)\'> & მეტი'),
    '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp; მეტი');
});

test('escapeHtml — უსაფრთხო სტრიქონი უცვლელი რჩება', () => {
  assert.strictEqual(WebLib.escapeHtml('კედრის ქუჩა N7'), 'კედრის ქუჩა N7');
  assert.strictEqual(WebLib.escapeHtml('01.99.99.999.001'), '01.99.99.999.001');
});

test('escapeHtml — ცარიელი, null, undefined -> ცარიელი სტრიქონი', () => {
  assert.strictEqual(WebLib.escapeHtml(''), '');
  assert.strictEqual(WebLib.escapeHtml(null), '');
  assert.strictEqual(WebLib.escapeHtml(undefined), '');
});

test('escapeHtml — არა-სტრიქონი სტრიქონად გადადის', () => {
  assert.strictEqual(WebLib.escapeHtml(0), '0');
  assert.strictEqual(WebLib.escapeHtml(599), '599');
});

// რეგრესია: `&` აუცილებლად პირველი უნდა შეიცვალოს. თუ ვინმე replace-ების
// რიგს გადაალაგებს (მაგ. `<`-ს პირველ ადგილას გადმოიტანს), უკვე ჩასმული
// `&lt;`-ის `&` მეორედ დამუშავდება და შედეგი `&amp;lt;` გახდება — ტექსტი
// გვერდზე `&lt;`-ად, და არა `<`-ად გამოჩნდება.
test('escapeHtml — რეგრესია: & პირველი იცვლება, ორმაგი escape არ ხდება', () => {
  assert.strictEqual(WebLib.escapeHtml('<'), '&lt;');
  assert.strictEqual(WebLib.escapeHtml('&lt;'), '&amp;lt;');
  assert.strictEqual(WebLib.escapeHtml('&amp;'), '&amp;amp;');
  assert.strictEqual(WebLib.escapeHtml('a & b < c'), 'a &amp; b &lt; c');
});

/* ── პროექტების ხედი ─────────────────────────────────────────────── */

const ROWS = [
  { cad: 'A', street: 'კედრის ქუჩა', address: 'კედრის ქუჩა 1', first_name: 'ზურაბ',
    last_name: 'ბერიძე', amount_due: 165, paid: 165, color: 'paid', status: 'paying' },
  { cad: 'B', street: 'კედრის ქუჩა', address: 'კედრის ქუჩა 2', first_name: 'ელენე',
    last_name: 'კაპანაძე', amount_due: 500, paid: 0, color: 'loan', status: 'loan' },
  { cad: 'C', street: 'კედრის I ჩიხი', address: 'კედრის I ჩიხი 3', first_name: 'ქეთევან',
    last_name: 'ხარაძე', amount_due: 335, paid: 0, color: 'none', status: 'not_contacted' },
  { cad: 'D', street: '', address: '', first_name: '', last_name: '',
    amount_due: 50, paid: 0, color: 'declined', status: 'declined' },
];

test('pledgeView — ყველა პასუხს სიმბოლოც აქვს და წარწერაც', () => {
  ['not_contacted', 'paying', 'loan', 'declined'].forEach((status) => {
    const view = WebLib.pledgeView(status);
    assert.ok(view.label.length > 0, status + ': წარწერა');
    assert.ok(view.icon.length > 0, status + ': სიმბოლო');
  });
});

test('pledgeView — უცნობი სტატუსი ნაგულისხმევზე ვარდება', () => {
  assert.strictEqual(WebLib.pledgeView('xxx'), WebLib.PLEDGE_VIEW.not_contacted);
  assert.strictEqual(WebLib.pledgeView(undefined), WebLib.PLEDGE_VIEW.not_contacted);
});

test('toneView — რუკის ექვსივე მდგომარეობას სიმბოლო აქვს', () => {
  ['none', 'promised', 'loan', 'partial', 'paid', 'declined'].forEach((tone) => {
    assert.ok(WebLib.toneView(tone).icon.length > 0, tone);
  });
});

test('money — ლარი, წილადის გარეშე', () => {
  assert.strictEqual(WebLib.money(0), '0 ₾');
  assert.strictEqual(WebLib.money(1234.7), '1\u202f235 \u20be');
  assert.strictEqual(WebLib.money(-40), '\u221240 \u20be');
  assert.strictEqual(WebLib.money(null), '0 ₾');
});

test('streetBreakdown — ქუჩების ჭრილი ითვლის კომლებსაც და თანხასაც', () => {
  const out = WebLib.streetBreakdown(ROWS);
  const kedris = out.filter((s) => s.street === 'კედრის ქუჩა')[0];
  assert.strictEqual(kedris.total, 2);
  assert.strictEqual(kedris.due, 665);
  assert.strictEqual(kedris.paid, 165);
  assert.strictEqual(kedris.counts.paid, 1, 'მთვლელი ფულის ველს არ ერევა');
});

test('streetBreakdown — ქუჩის გარეშე ნაკვეთს ცალკე სახელი აქვს', () => {
  const out = WebLib.streetBreakdown(ROWS);
  assert.ok(out.some((s) => s.street === 'ქუჩის გარეშე'));
});

test('streetBreakdown — ცარიელი სია ცარიელს აბრუნებს', () => {
  assert.deepStrictEqual(WebLib.streetBreakdown([]), []);
  assert.deepStrictEqual(WebLib.streetBreakdown(null), []);
});

test('filterPledgeRows — ქუჩით, მდგომარეობით და ძებნით', () => {
  assert.strictEqual(WebLib.filterPledgeRows(ROWS, { street: 'კედრის ქუჩა' }).length, 2);
  assert.strictEqual(WebLib.filterPledgeRows(ROWS, { tone: 'paid' }).length, 1);
  assert.strictEqual(WebLib.filterPledgeRows(ROWS, { query: 'ხარაძე' }).length, 1);
  assert.strictEqual(WebLib.filterPledgeRows(ROWS, {}).length, 4);
});

test('filterPledgeRows — ძებნა კოდითაც მუშაობს და რეგისტრს არ ითვალისწინებს', () => {
  assert.strictEqual(WebLib.filterPledgeRows(ROWS, { query: 'b' }).length, 1,
    'კოდი B რეგისტრის მიუხედავად იძებნება');
  assert.strictEqual(WebLib.filterPledgeRows(ROWS, { query: 'ჩიხი 3' }).length, 1);
});

// ── ხაზინდრობა ────────────────────────────────────────────────────────────
// ხაზინდარი გლობალური როლი არ არის — ის პროექტის ველია. ადმინის პანელს
// მისი ჩვენება სჭირდება, ამიტომ პროექტების სიიდან მეილების ინდექსი აიგება.

const TPROJECTS = [
  { id: 'road-2026', name: 'გზის რემონტი 2026',
    treasurers: ['nino.k@gmail.com'], status: 'active' },
  { id: 'lights', name: 'განათება',
    treasurers: ['Nino.K@Gmail.com '], status: 'draft' },
  { id: 'gate', name: 'ჭიშკარი',
    treasurers: ['zura@gmail.com'], status: 'done' },
  { id: 'old', name: 'გაუქმებული',
    treasurers: ['zura@gmail.com'], status: 'cancelled' },
  { id: 'none', name: 'ხაზინდრის გარეშე', treasurer: null, status: 'active' },
];

test('treasurerIndex — მეილი პროექტების სახელებზე', () => {
  const index = WebLib.treasurerIndex(TPROJECTS);
  assert.deepStrictEqual(index['nino.k@gmail.com'],
    ['გზის რემონტი 2026', 'განათება']);
});

test('treasurerIndex — რეგისტრი და ზედმეტი ჰარეები არ ითვლება', () => {
  // `create_project` მეილს lower()-ით ინახავს, მაგრამ ძველი ჩანაწერები
  // პირდაპირ Sheet-იდან მოვიდა და იქ რეგისტრი დაცული არ იყო.
  const index = WebLib.treasurerIndex(TPROJECTS);
  assert.strictEqual(index['Nino.K@Gmail.com'], undefined);
  assert.strictEqual(index['nino.k@gmail.com'].length, 2);
});

test('treasurerIndex — გაუქმებული პროექტი არ ითვლება', () => {
  const index = WebLib.treasurerIndex(TPROJECTS);
  assert.deepStrictEqual(index['zura@gmail.com'], ['ჭიშკარი']);
});

test('treasurerIndex — ხაზინდრის გარეშე პროექტი ინდექსში არ ხვდება', () => {
  const index = WebLib.treasurerIndex(TPROJECTS);
  assert.strictEqual(Object.keys(index).length, 2);
  assert.strictEqual(index[''], undefined);
});

test('staffIndex — ერთ პროექტს რამდენიმე პასუხისმგებელი ჰყავს', () => {
  const index = WebLib.staffIndex([{
    id: 'p-1', name: 'ჭიშკარი', status: 'active',
    moderators: ['a@b.com', 'C@D.com '],
  }], 'moderators');
  assert.deepStrictEqual(index['a@b.com'], ['ჭიშკარი']);
  assert.deepStrictEqual(index['c@d.com'], ['ჭიშკარი']);
});

test('staffIndex — ცარიელი მასივი ინდექსში არ ხვდება', () => {
  const index = WebLib.staffIndex(
    [{ id: 'p-1', name: 'ჭიშკარი', status: 'active', treasurers: [] }],
    'treasurers');
  assert.deepStrictEqual(index, {});
});

test('treasurerIndex — ცარიელი შემავალი ცარიელ ინდექსს აბრუნებს', () => {
  assert.deepStrictEqual(WebLib.treasurerIndex([]), {});
  assert.deepStrictEqual(WebLib.treasurerIndex(null), {});
});

test('treasurerIndex — უსახელო პროექტი კოდით ჩანს', () => {
  const index = WebLib.treasurerIndex([
    { id: 'x-1', name: '', treasurers: ['a@b.com'], status: 'active' }]);
  assert.deepStrictEqual(index['a@b.com'], ['x-1']);
});

test('ownerCount — ერთი მეპატრონე რამდენიმე ნაკვეთით ერთხელ ითვლება', () => {
  const rows = [
    { first_name: 'ალფა', last_name: 'ერთაძე' },
    { first_name: 'ალფა', last_name: 'ერთაძე' },
    { first_name: 'ბეტა', last_name: 'ორაძე' },
  ];
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(WebLib.ownerCount(rows), 2);
});

test('ownerCount — ჰარეები და რეგისტრი ერთსა და იმავე კაცს არ ყოფს', () => {
  assert.strictEqual(WebLib.ownerCount([
    { first_name: 'Alfa ', last_name: 'Ertadze' },
    { first_name: 'alfa', last_name: 'ertadze' },
  ]), 1);
});

test('ownerCount — უსახელო ნაკვეთი ცალკე ითვლება', () => {
  assert.strictEqual(WebLib.ownerCount([
    { first_name: '', last_name: '' },
    { first_name: '', last_name: '' },
    { first_name: 'ბეტა', last_name: 'ორაძე' },
  ]), 3);
});

test('ownerCount — ცარიელი სია ნულია', () => {
  assert.strictEqual(WebLib.ownerCount([]), 0);
  assert.strictEqual(WebLib.ownerCount(null), 0);
});
