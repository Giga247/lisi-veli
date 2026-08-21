/**
 * პროექტების სუფთა ლოგიკა — წილის დაანგარიშება, სტატუსები, უფლებები.
 *
 * გაშვება: node --test tests/*.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../apps-script/lib.js');

/* ── roundToFive ─────────────────────────────────────────────────── */

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

test('calculateSplit — area: წილი ფართობის პროპორციულია', () => {
  const out = lib.calculateSplit(PLOTS, { budget: 1000, split_method: 'area', streets: '' });
  // მონაწილე ფართობი: 500+1000+500+250 = 2250 (E ფართობის გარეშეა)
  // A: 1000*500/2250 = 222.2 -> 220
  assert.strictEqual(out.shares.A, 220);
  assert.strictEqual(out.shares.B, 445);   // 444.4 -> 445
  assert.strictEqual(out.shares.C, 220);
  assert.strictEqual(out.shares.D, 110);   // 111.1 -> 110
});

test('calculateSplit — area: ფართობის გარეშე ნაკვეთი გამოირიცხება და ცალკე ჩანს', () => {
  const out = lib.calculateSplit(PLOTS, { budget: 1000, split_method: 'area', streets: '' });
  assert.ok(!('E' in out.shares), 'ფართობის გარეშე ნაკვეთს წილი არ ეწერება');
  assert.deepStrictEqual(out.noArea, ['E']);
});

test('calculateSplit — დამრგვალების სხვაობა ცალკე ითვლება, არ იმალება', () => {
  const out = lib.calculateSplit(PLOTS, { budget: 1000, split_method: 'area', streets: '' });
  const sum = Object.keys(out.shares).reduce((a, k) => a + out.shares[k], 0);
  assert.strictEqual(sum, 995);
  assert.strictEqual(out.roundingDiff, -5, 'ჯამი ბიუჯეტს 5 ლარით ჩამორჩება');
});

test('calculateSplit — ქუჩების ფილტრი ირჩევს მონაწილეებს', () => {
  const out = lib.calculateSplit(PLOTS, {
    budget: 1000, split_method: 'equal', streets: 'კედრის ქუჩა',
  });
  assert.deepStrictEqual(Object.keys(out.shares).sort(), ['A', 'B', 'E']);
});

test('calculateSplit — ქუჩის გარეშე ნაკვეთი კონკრეტულ ქუჩას ვერ დაემთხვევა', () => {
  const out = lib.calculateSplit(PLOTS, {
    budget: 1000, split_method: 'equal', streets: 'კედრის ქუჩა',
  });
  assert.ok(!('D' in out.shares));
  assert.deepStrictEqual(out.noStreet, ['D'], 'გაფრთხილებისთვის მაინც ჩანს');
});

test('calculateSplit — equal: თანაბრად, ფართობის მიუხედავად', () => {
  const out = lib.calculateSplit(PLOTS, { budget: 1000, split_method: 'equal', streets: '' });
  // 5 ნაკვეთი, 200 თითოს — equal-ს ფართობი არ სჭირდება, E-ც შედის
  assert.strictEqual(out.shares.A, 200);
  assert.strictEqual(out.shares.E, 200);
  assert.deepStrictEqual(out.noArea, [], 'equal-ს ფართობი არ სჭირდება');
});

test('calculateSplit — fixed: ერთი და იგივე თანხა თითოეულს', () => {
  const out = lib.calculateSplit(PLOTS, {
    budget: 1000, split_method: 'fixed', fixed_amount: 50, streets: '',
  });
  assert.strictEqual(out.shares.A, 50);
  assert.strictEqual(out.shares.E, 50);
});

test('calculateSplit — free: წილი არავის ეწერება', () => {
  const out = lib.calculateSplit(PLOTS, { budget: 1000, split_method: 'free', streets: '' });
  Object.keys(out.shares).forEach((cad) => assert.strictEqual(out.shares[cad], 0));
});

test('calculateSplit — ცარიელი სია არ ვარდება', () => {
  const out = lib.calculateSplit([], { budget: 1000, split_method: 'area', streets: '' });
  assert.deepStrictEqual(out.shares, {});
  assert.strictEqual(out.roundingDiff, -1000);
});

/* ── პასუხების ნუსხა ─────────────────────────────────────────────── */

test('isPledgeStatus — ნუსხის ოთხი მნიშვნელობა', () => {
  ['not_contacted', 'paying', 'loan', 'declined'].forEach((s) => {
    assert.strictEqual(lib.isPledgeStatus(s), true, s);
  });
});

test('isPledgeStatus — ნუსხის გარეთ ყველაფერი უარყოფილია', () => {
  ['', 'promised', 'PAYING', 'yes', null, undefined].forEach((s) => {
    assert.strictEqual(lib.isPledgeStatus(s), false, String(s));
  });
});

/* ── plotColor ───────────────────────────────────────────────────── */

test('plotColor — გადახდილი მწვანეა, პასუხის მიუხედავად', () => {
  assert.strictEqual(lib.plotColor({ status: 'paying' }, 100, 100), 'paid');
  assert.strictEqual(lib.plotColor({ status: 'declined' }, 100, 100), 'paid');
});

test('plotColor — ნაწილობრივ გადახდილი ჯერ მწვანე არაა', () => {
  assert.strictEqual(lib.plotColor({ status: 'paying' }, 100, 40), 'partial');
});

test('plotColor — დაპირება გადახდის გარეშე ნარინჯისფერია', () => {
  assert.strictEqual(lib.plotColor({ status: 'paying' }, 100, 0), 'promised');
  assert.strictEqual(lib.plotColor({ status: 'loan' }, 100, 0), 'loan');
});

test('plotColor — უარი წითელია', () => {
  assert.strictEqual(lib.plotColor({ status: 'declined' }, 100, 0), 'declined');
});

test('plotColor — პასუხის გარეშე ნაცრისფერია', () => {
  assert.strictEqual(lib.plotColor({ status: 'not_contacted' }, 100, 0), 'none');
  assert.strictEqual(lib.plotColor(null, 100, 0), 'none');
});

test('plotColor — ნულოვანი წილი გადახდით მაინც მწვანეა', () => {
  // `free` წესის დროს წილი 0-ია. თუ ადამიანმა თანხა შემოიტანა, ის
  // გადახდილია — თორემ 0 >= 0 ყველას მწვანედ აქცევდა.
  assert.strictEqual(lib.plotColor({ status: 'paying' }, 0, 50), 'paid');
  assert.strictEqual(lib.plotColor({ status: 'paying' }, 0, 0), 'promised');
});

/* ── canSetPledge ────────────────────────────────────────────────── */

const ACTIVE = { id: 'PRJ-001', status: 'active' };
const ADMIN = { email: 'a@x.ge', role: 'admin', street: '' };
const MOD = { email: 'm@x.ge', role: 'moderator', street: 'კედრის ქუჩა' };
const MEMBER = { email: 'u@x.ge', role: 'member', street: '' };

test('canSetPledge — ადმინს ყველგან შეუძლია', () => {
  assert.strictEqual(lib.canSetPledge(ADMIN, PLOTS[2], ACTIVE).ok, true);
});

test('canSetPledge — მოდერატორს მხოლოდ თავის ქუჩაზე', () => {
  assert.strictEqual(lib.canSetPledge(MOD, PLOTS[0], ACTIVE).ok, true);
  const other = lib.canSetPledge(MOD, PLOTS[2], ACTIVE);
  assert.strictEqual(other.ok, false);
  assert.strictEqual(other.code, 'FORBIDDEN');
});

test('canSetPledge — ქუჩის გარეშე ნაკვეთი მხოლოდ ადმინისაა', () => {
  assert.strictEqual(lib.canSetPledge(MOD, PLOTS[3], ACTIVE).ok, false);
  assert.strictEqual(lib.canSetPledge(ADMIN, PLOTS[3], ACTIVE).ok, true);
});

test('canSetPledge — მკითხველი ვერ წერს', () => {
  assert.strictEqual(lib.canSetPledge(MEMBER, PLOTS[0], ACTIVE).ok, false);
});

test('canSetPledge — არააქტიურ პროექტში ვერავინ წერს, ადმინიც ვერა', () => {
  const draft = { id: 'PRJ-001', status: 'draft' };
  const result = lib.canSetPledge(ADMIN, PLOTS[0], draft);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'VALIDATION');
});

/* ── canRecordPayment ────────────────────────────────────────────── */

test('canRecordPayment — მხოლოდ ამ პროექტის ხაზინდარი ან ადმინი', () => {
  const project = { id: 'PRJ-001', status: 'active', treasurer: 'k@x.ge' };
  assert.strictEqual(lib.canRecordPayment(ADMIN, project).ok, true);
  assert.strictEqual(lib.canRecordPayment({ email: 'k@x.ge', role: 'member' }, project).ok, true);
  assert.strictEqual(lib.canRecordPayment(MOD, project).ok, false);
});

test('canRecordPayment — ხაზინდრის მეილი რეგისტრის მიუხედავად ემთხვევა', () => {
  const project = { id: 'PRJ-001', status: 'active', treasurer: 'K@X.ge ' };
  assert.strictEqual(lib.canRecordPayment({ email: 'k@x.ge', role: 'member' }, project).ok, true);
});

/* ── validateTeam ────────────────────────────────────────────────── */

test('validateTeam — ხაზინდარი ვერ იქნება იმავე პროექტის მოდერატორი', () => {
  const moderators = [{ email: 'm@x.ge', street: 'კედრის ქუჩა' }];
  const bad = lib.validateTeam({ treasurer: 'm@x.ge', streets: 'კედრის ქუჩა' }, moderators);
  assert.strictEqual(bad.ok, false);
  const good = lib.validateTeam({ treasurer: 'k@x.ge', streets: 'კედრის ქუჩა' }, moderators);
  assert.strictEqual(good.ok, true);
});

test('validateTeam — სხვა ქუჩის მოდერატორი ხაზინდარი შეიძლება იყოს', () => {
  const moderators = [{ email: 'm@x.ge', street: 'კედრის I ჩიხი' }];
  const out = lib.validateTeam({ treasurer: 'm@x.ge', streets: 'კედრის ქუჩა' }, moderators);
  assert.strictEqual(out.ok, true);
});

/* ── projectTotals ───────────────────────────────────────────────── */

test('projectTotals — შეგროვდა / დაპირებული / ვალი / უარი / აკლია', () => {
  const pledges = [
    { cad: 'A', amount_due: 220, status: 'paying' },
    { cad: 'B', amount_due: 445, status: 'loan' },
    { cad: 'C', amount_due: 220, status: 'declined' },
    { cad: 'D', amount_due: 110, status: 'not_contacted' },
  ];
  const payments = [
    { cad: 'A', amount: 220 },
    { cad: 'B', amount: 100 },
  ];
  const out = lib.projectTotals({ budget: 1000 }, pledges, payments);
  assert.strictEqual(out.collected, 320);
  assert.strictEqual(out.promised, 0, 'A-მ უკვე გადაიხადა — დაპირებულში აღარაა');
  assert.strictEqual(out.loan, 345, 'B-ს 445-იდან 100 შემოვიდა');
  assert.strictEqual(out.declined, 220);
  assert.strictEqual(out.pending, 110);
  assert.strictEqual(out.remaining, 680, 'ბიუჯეტი მინუს შემოსული');
});

test('projectTotals — storno უარყოფითი თანხით აკლდება', () => {
  const pledges = [{ cad: 'A', amount_due: 220, status: 'paying' }];
  const payments = [{ cad: 'A', amount: 220 }, { cad: 'A', amount: -220, note: 'storno' }];
  const out = lib.projectTotals({ budget: 1000 }, pledges, payments);
  assert.strictEqual(out.collected, 0);
  assert.strictEqual(out.promised, 220, 'სტორნოს შემდეგ ისევ დაპირებულია');
});

test('projectTotals — ცარიელი პროექტი ნულებს აბრუნებს', () => {
  const out = lib.projectTotals({ budget: 1000 }, [], []);
  assert.strictEqual(out.collected, 0);
  assert.strictEqual(out.remaining, 1000);
});

/* ── statusTransition ────────────────────────────────────────────── */

test('statusTransition — draft -> active -> done', () => {
  assert.strictEqual(lib.statusTransition('draft', 'active'), true);
  assert.strictEqual(lib.statusTransition('active', 'done'), true);
});

test('statusTransition — active -> draft აკრძალულია', () => {
  // წილები გააქტიურებისას იყინება. draft-ში დაბრუნება ნიშნავდა, რომ
  // უკვე გადახდილ კომლს თანხა შეიძლება შეცვლოდა.
  assert.strictEqual(lib.statusTransition('active', 'draft'), false);
});

test('statusTransition — cancelled ნებისმიერიდან, უკან არსაიდან', () => {
  assert.strictEqual(lib.statusTransition('draft', 'cancelled'), true);
  assert.strictEqual(lib.statusTransition('active', 'cancelled'), true);
  assert.strictEqual(lib.statusTransition('cancelled', 'active'), false);
  assert.strictEqual(lib.statusTransition('done', 'active'), false);
});

/* ── validateProject ─────────────────────────────────────────────── */

test('validateProject — სახელი და ბიუჯეტი სავალდებულოა', () => {
  assert.strictEqual(lib.validateProject({ name: '', budget: 1000 }).ok, false);
  assert.strictEqual(lib.validateProject({ name: 'სანიაღვრე', budget: 0 }).ok, false);
  assert.strictEqual(lib.validateProject({ name: 'სანიაღვრე', budget: -5 }).ok, false);
});

test('validateProject — free წესს ნულოვანი ბიუჯეტი შეუძლია', () => {
  const out = lib.validateProject({ name: 'გამწვანება', budget: 0, split_method: 'free' });
  assert.strictEqual(out.ok, true);
});

test('validateProject — დასრულება დაწყებაზე ადრე ვერ იქნება', () => {
  const bad = lib.validateProject({
    name: 'ს', budget: 100, starts_on: '2026-09-01', ends_on: '2026-08-01',
  });
  assert.strictEqual(bad.ok, false);
  const good = lib.validateProject({
    name: 'ს', budget: 100, starts_on: '2026-08-01', ends_on: '2026-09-01',
  });
  assert.strictEqual(good.ok, true);
});

test('validateProject — fixed წესს თანხა სჭირდება', () => {
  assert.strictEqual(
    lib.validateProject({ name: 'ს', budget: 100, split_method: 'fixed' }).ok, false);
  assert.strictEqual(
    lib.validateProject({ name: 'ს', budget: 100, split_method: 'fixed', fixed_amount: 50 }).ok,
    true);
});

test('validateProject — უცნობი განაწილების წესი უარყოფილია', () => {
  assert.strictEqual(lib.validateProject({ name: 'ს', budget: 100, split_method: 'x' }).ok, false);
});
