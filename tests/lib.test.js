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
