/**
 * `js/ui.js`-ის ტესტი vm-სენდბოქსში.
 *
 * ბრაუზერში ყველა ჩვენი მოდული ცალკე `<script>`-ია და `const X = (function
 * () {...})()`-ით იწყება. ასეთი `const` **არ** ხდება `window`-ის თვისება —
 * ის სკრიპტების საერთო ლექსიკურ სკოპში ჯდება. `vm.runInContext` ზუსტად
 * იმავენაირად იქცევა, ამიტომ სენდბოქსი ნამდვილ გვერდს ბაძავს და ტესტს
 * შეუძლია დაიჭიროს ის შეცდომა, რომლის გამოც `window.AdminView`-ის
 * შემოწმება ყოველთვის false იყო და ადმინის პანელი ცარიელი რჩებოდა.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const UI_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui.js'), 'utf8');

/** მინიმალური DOM: მხოლოდ ის, რასაც `ui.js` ეხება. */
function sandbox() {
  const nodes = {};
  ['view-home', 'view-project', 'view-admin', 'error-box',
    'screen-loading', 'screen-signin', 'screen-pending', 'screen-app',
  ].forEach(function (id) { nodes[id] = { id: id, hidden: true }; });

  const calls = { admin: 0, mapRefresh: 0, scrollTo: [] };
  const context = {
    document: { getElementById: function (id) { return nodes[id] || null; } },
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    calls: calls,
  };
  context.window = context;
  context.scrollY = 0;
  context.scrollTo = function (x, y) { calls.scrollTo.push([x, y]); };
  vm.createContext(context);

  // მოდულები ისე იტვირთება, როგორც index.html-ში — ცალკე სკრიპტებად,
  // top-level `const`-ით.
  vm.runInContext(UI_SOURCE, context);
  vm.runInContext(
    'const AdminView = { render: function () { calls.admin += 1; } };' +
    'const MapView = { refresh: function () { calls.mapRefresh += 1; } };',
    context);

  return { context: context, nodes: nodes, calls: calls };
}

test('showView("admin") ხატავს ადმინის პანელს', () => {
  const env = sandbox();
  vm.runInContext('UI.showView("admin")', env.context);
  assert.strictEqual(env.calls.admin, 1, 'AdminView.render() უნდა გამოძახებულიყო');
  assert.strictEqual(env.nodes['view-admin'].hidden, false);
  assert.strictEqual(env.nodes['view-home'].hidden, true);
});

test('მთავარზე დაბრუნება რუკას თავიდან ჯდომს', () => {
  const env = sandbox();
  vm.runInContext('UI.showView("home")', env.context);
  assert.strictEqual(env.calls.mapRefresh, 1, 'MapView.refresh() უნდა გამოძახებულიყო');
});

test('showView სხვა ხედებს მალავს', () => {
  const env = sandbox();
  vm.runInContext('UI.showView("project")', env.context);
  assert.strictEqual(env.nodes['view-project'].hidden, false);
  assert.strictEqual(env.nodes['view-admin'].hidden, true);
  assert.strictEqual(env.nodes['view-home'].hidden, true);
});
