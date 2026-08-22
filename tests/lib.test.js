/**
 * `js/lib.js` — სუფთა ლოგიკა, რომელიც Apps Script-იდან გადმოვიდა.
 *
 * ტელეფონის ნორმალიზება, რედაქტირებადი ველების თეთრი სია და
 * დამრგვალება ადრე სერვერზე ცხოვრობდნენ და იქ იტესტებოდნენ. სერვერი
 * აღარ არსებობს — ლოგიკა ბრაუზერშია, ტესტებიც მას მიჰყვა უცვლელად.
 *
 * `plotColor` და `projectTotals` ხელახლა დაიწერა: ნაწილობრივი გადახდა
 * აღარ არსებობს და სტატუსი თავად არის ფერი.
 */
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../js/lib.js');

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

// უბანში უცხოელი მფლობელებიც არიან. `+`-ით დაწყებული ნომერი საერთაშორისოდ
// ითვლება და უცვლელად ინახება. ქვემოთ ნომრები გამოგონილია.

test('normalizePhone — +-ით დაწყებული უცხოური ნომერი მიიღება', () => {
  assert.deepStrictEqual(lib.normalizePhone('+989001234567'),
    { ok: true, value: '+989001234567' });
});

test('normalizePhone — უცხოური ნომრის გამოტოვებები ირეცხება', () => {
  assert.deepStrictEqual(lib.normalizePhone('+44 7700 900123'),
    { ok: true, value: '+447700900123' });
});

// `+`-ის გარეშე ისევ მხოლოდ ქართული ფორმატია — ათნიშნა ნომერი ტიპოა,
// არა საერთაშორისო ნომერი, და ჩუმად არ უნდა გაიაროს.

test('normalizePhone — +-ის გარეშე ათნიშნა ნომერი უარყოფილია', () => {
  assert.strictEqual(lib.normalizePhone('5991234567').ok, false);
});

test('normalizePhone — ძალიან მოკლე საერთაშორისო ნომერი უარყოფილია', () => {
  assert.strictEqual(lib.normalizePhone('+1234567').ok, false);
});

test('normalizePhone — E.164-ის ზღვარზე გრძელი ნომერი უარყოფილია', () => {
  assert.strictEqual(lib.normalizePhone('+1234567890123456').ok, false);
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

test('roundToFive — უახლოეს ხუთეულამდე ამრგვალებს', () => {
  assert.strictEqual(lib.roundToFive(46.71), 45);
  assert.strictEqual(lib.roundToFive(48), 50);
  assert.strictEqual(lib.roundToFive(53.72), 55);
  assert.strictEqual(lib.roundToFive(100), 100);
});

test('roundToFive — ზუსტად შუაში ზემოთ მრგვალდება', () => {
  // 47.5 თანაბრად შორსაა 45-სა და 50-საგან. ზემოთ მრგვალდება, რომ
  // შედეგი პროგნოზირებადი იყოს და ბანკირის დამრგვალებაზე არ იყოს
  // დამოკიდებული — უბანში ასე ითვლიან.
  assert.strictEqual(lib.roundToFive(47.5), 50);
  assert.strictEqual(lib.roundToFive(42.5), 45);
});

test('roundToFive — ნული და უარყოფითი', () => {
  assert.strictEqual(lib.roundToFive(0), 0);
  assert.strictEqual(lib.roundToFive(1), 0);
  assert.strictEqual(lib.roundToFive(3), 5);
});

/* ── calculateSplit ──────────────────────────────────────────────── */

const PLOTS = [
  { cad: 'A', street: 'კედრის ქუჩა', area: 500 },
  { cad: 'B', street: 'კედრის ქუჩა', area: 1000 },
  { cad: 'C', street: 'კედრის I ჩიხი', area: 500 },
  { cad: 'D', street: '', area: 250 },
  { cad: 'E', street: 'კედრის ქუჩა', area: '' },
];

/* ── plotColor ────────────────────────────────────────────────── */

test('plotColor — ექვსივე სტატუსი საკუთარ ფერს აბრუნებს', () => {
  for (const status of Object.keys(lib.PLEDGE_VIEW)) {
    assert.strictEqual(lib.plotColor({ status: status }), status);
  }
});

test('plotColor — უცნობი სტატუსი ნაგულისხმევზე ვარდება', () => {
  assert.strictEqual(lib.plotColor({ status: 'რაღაც' }), 'not_contacted');
  assert.strictEqual(lib.plotColor({}), 'not_contacted');
  assert.strictEqual(lib.plotColor(null), 'not_contacted');
});

test('plotColor — თანხა ფერზე აღარ მოქმედებს', () => {
  // ადრე ფუნქცია გადახდილ თანხას ადარებდა წილს და „ნაწილობრივს"
  // აბრუნებდა. ასეთი მდგომარეობა უბანში არ არსებობს — ან დებს, ან არა.
  assert.strictEqual(lib.plotColor({ status: 'paying' }, 1000, 400), 'paying');
  assert.strictEqual(lib.plotColor({ status: 'paid' }, 0, 0), 'paid');
});

/* ── projectTotals ────────────────────────────────────────────── */

const PLEDGES = [
  { cad: 'a', amount_due: 1000, status: 'paid' },
  { cad: 'b', amount_due: 1000, status: 'paying' },
  { cad: 'c', amount_due: 1000, status: 'loan' },
  { cad: 'd', amount_due: 1000, status: 'declined' },
  { cad: 'e', amount_due: 1000, status: 'not_contacted' },
  { cad: 'f', amount_due: 1000, status: 'unreachable' },
];

test('projectTotals — თითო სტატუსი თავის სვეტში ჯდება', () => {
  const totals = lib.projectTotals({ budget: 6000 }, PLEDGES,
    [{ cad: 'a', amount: 1000 }]);
  assert.strictEqual(totals.collected, 1000);
  assert.strictEqual(totals.promised, 1000);   // paying
  assert.strictEqual(totals.loan, 1000);
  assert.strictEqual(totals.declined, 1000);
  // not_contacted + unreachable — ორივე „პასუხის გარეშეა"
  assert.strictEqual(totals.pending, 2000);
  assert.strictEqual(totals.remaining, 5000);
});

test('projectTotals — „გადახდილი" პასუხის გარეშედ აღარ ითვლება', () => {
  // რეგრესია: სანამ `paid` სტატუსი გაჩნდებოდა, ის `else`-ში ვარდებოდა
  // და გადახდილი კომლი ორჯერ ჩანდა — `collected`-შიც და `pending`-შიც.
  const totals = lib.projectTotals({ budget: 1000 },
    [{ cad: 'a', amount_due: 1000, status: 'paid' }],
    [{ cad: 'a', amount: 1000 }]);
  assert.strictEqual(totals.pending, 0);
  assert.strictEqual(totals.collected, 1000);
});

test('projectTotals — ნამეტი ცალკე ჩანს, არ იკარგება', () => {
  // 31 000-იან პროექტში შემოსული 56 000 ადრე „აკლია 0 ₾"-ად ჩანდა და
  // ნამეტი ეკრანიდან ქრებოდა. ნამეტი უბნის ფონდში რჩება.
  const totals = lib.projectTotals({ budget: 31000 },
    [{ cad: 'a', amount_due: 56000, status: 'paid' }],
    [{ cad: 'a', amount: 56000 }]);
  assert.strictEqual(totals.remaining, 0);
  assert.strictEqual(totals.surplus, 25000);
});

test('projectTotals — აკლია და ნამეტი ერთდროულად ვერასდროს იქნება', () => {
  for (const paid of [0, 15000, 31000, 40000]) {
    const totals = lib.projectTotals({ budget: 31000 },
      [{ cad: 'a', amount_due: 31000, status: 'paid' }],
      [{ cad: 'a', amount: paid }]);
    assert.ok(totals.remaining === 0 || totals.surplus === 0,
      'paid=' + paid + ' -> ორივე არანულოვანია');
  }
});

test('projectTotals — ნაწილობრივ გადახდილს დარჩენილი ეწერება, არა სრული წილი', () => {
  const totals = lib.projectTotals({ budget: 1000 },
    [{ cad: 'a', amount_due: 1000, status: 'paying' }],
    [{ cad: 'a', amount: 400 }]);
  assert.strictEqual(totals.collected, 400);
  assert.strictEqual(totals.promised, 600);
});

test('projectTotals — ცარიელი პროექტი ნულებს აბრუნებს', () => {
  const totals = lib.projectTotals({ budget: 0 }, [], []);
  assert.strictEqual(totals.collected, 0);
  assert.strictEqual(totals.pending, 0);
  assert.strictEqual(totals.remaining, 0);
  assert.strictEqual(totals.surplus, 0);
});

/* ── streetBreakdown ──────────────────────────────────────────── */

test('streetBreakdown — მთვლელები ექვსივე სტატუსს ფარავს', () => {
  // რეგრესია: მთვლელების სია ხელით იყო ჩამოწერილი ძველი ფერების
  // სახელებით და ახალი სტატუსები ჩუმად არსად არ ითვლებოდა.
  const rows = Object.keys(lib.PLEDGE_VIEW).map(function (status, i) {
    return { street: 'ა', amount_due: 100, paid: 0, color: status };
  });
  const out = lib.streetBreakdown(rows);
  assert.strictEqual(out.length, 1);
  for (const status of Object.keys(lib.PLEDGE_VIEW)) {
    assert.strictEqual(out[0].counts[status], 1, status + ' არ დაითვალა');
  }
});
