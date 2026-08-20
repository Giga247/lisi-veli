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
