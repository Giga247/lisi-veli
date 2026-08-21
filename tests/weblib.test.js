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

// ── გეგმის გეომეტრია ────────────────────────────────────────────────

test('projectPoint — ნულოვანი წერტილი კვადრატის ცენტრშია', () => {
  const p = WebLib.projectPoint(0, 0);
  assert.ok(Math.abs(p.x - 0.5) < 1e-12);
  assert.ok(Math.abs(p.y - 0.5) < 1e-12);
});

test('projectPoint — ლისი ველის კოორდინატი', () => {
  const p = WebLib.projectPoint(44.72, 41.745);
  assert.ok(Math.abs(p.x - 0.6242222222) < 1e-9);
  assert.ok(Math.abs(p.y - 0.3721682906) < 1e-9);
});

test('projectPoint — y ქვევით იზრდება (SVG-ის მიმართულება)', () => {
  const north = WebLib.projectPoint(44.72, 41.75);
  const south = WebLib.projectPoint(44.72, 41.74);
  assert.ok(north.y < south.y);
});

test('projectPoint — Mercator ჭიმავს: ამ განედზე მასშტაბი lon-ისა და lat-ის ტოლი არაა', () => {
  // 0.001° გრძედი vs 0.001° განედი — Mercator-ში განედი ~1.34-ჯერ გრძელია
  const dx = WebLib.projectPoint(44.721, 41.745).x - WebLib.projectPoint(44.72, 41.745).x;
  const dy = WebLib.projectPoint(44.745, 41.745).y - WebLib.projectPoint(44.745, 41.746).y;
  assert.ok(dy / dx > 1.3 && dy / dx < 1.4);
});

test('flattenCoords — Polygon და LineString', () => {
  assert.deepStrictEqual(
    WebLib.flattenCoords({ type: 'LineString', coordinates: [[1, 2], [3, 4]] }),
    [[1, 2], [3, 4]]);
  assert.deepStrictEqual(
    WebLib.flattenCoords({ type: 'Polygon', coordinates: [[[1, 2], [3, 4], [1, 2]]] }),
    [[1, 2], [3, 4], [1, 2]]);
  assert.deepStrictEqual(
    WebLib.flattenCoords({ type: 'Point', coordinates: [5, 6] }), [[5, 6]]);
  assert.deepStrictEqual(WebLib.flattenCoords(null), []);
});

test('createProjector — კიდეები padding-ზე ჯდება', () => {
  const points = [[44.717, 41.743], [44.721, 41.747]];
  const proj = WebLib.createProjector(points, 1000, 0.05);
  const pad = 50; // 1000 * 0.05
  const left = proj.project(44.717, 41.743);
  const right = proj.project(44.721, 41.747);
  assert.ok(Math.abs(left.x - pad) < 1e-6);
  assert.ok(Math.abs(right.x - (1000 + pad)) < 1e-6);
  // ჩრდილოეთი ზემოთაა: 41.747 ყველაზე პატარა y-ია
  assert.ok(Math.abs(right.y - pad) < 1e-6);
  assert.ok(Math.abs(proj.width - 1100) < 1e-6);
});

test('createProjector — viewBox სიგანესა და სიმაღლეს იმეორებს', () => {
  const proj = WebLib.createProjector(
    [[44.717, 41.743], [44.721, 41.747]], 1000, 0.05);
  assert.strictEqual(proj.viewBox, '0 0 ' + proj.width + ' ' + proj.height);
});

test('createProjector — ერთი წერტილი არ ტეხს (ნულოვანი გაშლა)', () => {
  const proj = WebLib.createProjector([[44.72, 41.745]], 1000, 0.05);
  const p = proj.project(44.72, 41.745);
  assert.ok(isFinite(p.x) && isFinite(p.y));
});

test('polygonCentroid — კვადრატის ცენტრი', () => {
  const c = WebLib.polygonCentroid([
    { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]);
  assert.ok(Math.abs(c.x - 1) < 1e-9);
  assert.ok(Math.abs(c.y - 1) < 1e-9);
});

test('polygonCentroid — დახურული რგოლი იმავე პასუხს იძლევა', () => {
  const c = WebLib.polygonCentroid([
    { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 0 }]);
  assert.ok(Math.abs(c.x - 1) < 1e-9);
  assert.ok(Math.abs(c.y - 1) < 1e-9);
});

test('polygonCentroid — გადაგვარებული რგოლი საშუალოს აბრუნებს', () => {
  const c = WebLib.polygonCentroid([
    { x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }]);
  assert.ok(Math.abs(c.x - 1) < 1e-9);
  assert.ok(Math.abs(c.y - 1) < 1e-9);
});

test('pathFromRings — დახურული, ორნიშნა სიზუსტით', () => {
  const d = WebLib.pathFromRings([[
    { x: 0, y: 0 }, { x: 1.005, y: 0 }, { x: 1, y: 1 }]]);
  assert.strictEqual(d, 'M0 0 L1.01 0 L1 1 Z');
});

test('pathFromLine — ღია, Z-ის გარეშე', () => {
  const d = WebLib.pathFromLine([{ x: 0, y: 0 }, { x: 5, y: 5 }]);
  assert.strictEqual(d, 'M0 0 L5 5');
});

test('pathFromLine — ცარიელი შემოსვლა ცარიელ სტრიქონს აბრუნებს', () => {
  assert.strictEqual(WebLib.pathFromLine([]), '');
  assert.strictEqual(WebLib.pathFromRings([]), '');
});
