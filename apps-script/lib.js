/**
 * სუფთა ფუნქციები — Sheet-ს, ქსელს და Apps Script-ის API-ს არ ეხებიან.
 * ყველა გადაწყვეტილება აქ მიიღება, რომ ლოკალურად იტესტებოდეს.
 *
 * ფაილი მუშაობს ორივე გარემოში: Apps Script-ში (module undefined-ია,
 * ბოლო ბლოკი გამოტოვდება) და Node-ში (require-ით).
 */

/** Sheet-ის ქართული სათაური -> კოდის გასაღები. */
const HEADER_MAP = {
  'საკადასტრო კოდი': 'cad',
  'ქუჩა': 'street',
  'N': 'num',
  'სრული მისამართი': 'address',
  'ფართობი კვ.მ': 'area',
  'დანიშნულება': 'purpose',
  'სახელი': 'first_name',
  'გვარი': 'last_name',
  'ტელეფონი': 'phone',
  'გრძედი': 'lon',
  'განედი': 'lat',
  'გეომეტრია': 'geometry',
  'წყარო': 'source',
  'შენიშვნა': 'note',
  'განახლდა': 'updated_at',
  'განმაახლებელი': 'updated_by',
  // მომხმარებლები
  'მეილი': 'email',
  'როლი': 'role',
  'სახელი გვარი': 'display_name',
  'მოთხოვნის თარიღი': 'requested_at',
  'დამტკიცების თარიღი': 'approved_at',
  'დამამტკიცებელი': 'approved_by',
  // ლოგი
  'დრო': 'at',
  'ვინ': 'by',
  'მოქმედება': 'action',
  'ველი': 'field',
  'ძველი მნიშვნელობა': 'old',
  'ახალი მნიშვნელობა': 'new',
};

/**
 * სათაურების რიგი -> {გასაღები: სვეტის ინდექსი}.
 * ძებნა სახელით ხდება, არა პოზიციით — სვეტების გადალაგება არაფერს ტეხს.
 */
function mapHeaders(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    const raw = String(headerRow[i] == null ? '' : headerRow[i]).trim();
    const key = HEADER_MAP[raw];
    if (key) map[key] = i;
  }
  return map;
}

/**
 * ტელეფონის ნორმალიზება +995XXXXXXXXX ფორმატში.
 * მიიღება: 599123456 | 995599123456 | +995599123456 — გამოტოვებებით,
 * დეფისებით, ფრჩხილებით. ცარიელი ველი დაშვებულია.
 */
function normalizePhone(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { ok: true, value: '' };
  }
  const text = String(raw).trim();
  // წამყვანი `+` განზრახვის ნიშანია: მფლობელი უცხოურ ნომერს წერს. მის გარეშე
  // ისევ მხოლოდ ქართული ფორმატი მიიღება — ათნიშნა ნომერი ტიპოა, არა უცხოური.
  const international = text.charAt(0) === '+';
  const digits = text.replace(/[\s\-()+.]/g, '');
  if (!/^[0-9]+$/.test(digits)) {
    return { ok: false, message: 'ტელეფონი მხოლოდ ციფრებს უნდა შეიცავდეს' };
  }
  if (international) {
    // E.164: ქვეყნის კოდი + ნომერი, სულ 15 ციფრამდე.
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, message: 'საერთაშორისო ნომერი უნდა იყოს 8-15 ციფრი' };
    }
    return { ok: true, value: '+' + digits };
  }
  let local;
  if (digits.length === 9) {
    local = digits;
  } else if (digits.length === 12 && digits.indexOf('995') === 0) {
    local = digits.slice(3);
  } else {
    return { ok: false, message: 'ნომერი უნდა იყოს 9 ციფრი, 995 + 9 ციფრი, ან +ქვეყნის-კოდი' };
  }
  return { ok: true, value: '+995' + local };
}

/**
 * უჯრის ტექსტი -> პოლიგონის კოორდინატები, ან null.
 *
 * ტოლერანტულია განზრახ: გეომეტრიას ადმინი ხელით სვამს Sheet-ში და
 * შეცდომა გარდაუვალია. დაზიანებული უჯრა ერთ ნაკვეთს მარკერზე გადაიყვანს,
 * და არ ჩამოაგდებს მთელ რუკას.
 */
function parseGeometry(cell) {
  if (cell == null || String(cell).trim() === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(String(cell));
  } catch (e) {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  for (const ring of parsed) {
    if (!Array.isArray(ring) || ring.length < 3) return null;
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2) return null;
      if (typeof point[0] !== 'number' || typeof point[1] !== 'number') return null;
    }
  }
  return parsed;
}

/** რედაქტირებადი ველების თეთრი სია. სიის გარეთ ყველაფერი აკრძალულია. */
const EDITABLE_FIELDS = [
  'first_name', 'last_name', 'phone', 'street',
  'num', 'address', 'area', 'purpose', 'note',
];

function isEditableField(field) {
  return EDITABLE_FIELDS.indexOf(field) !== -1;
}

/** მოქმედება -> როლები, რომლებსაც უფლება აქვთ. */
const PERMISSIONS = {
  me: ['member', 'moderator', 'admin'],
  plots: ['member', 'moderator', 'admin'],
  updatePlot: ['moderator', 'admin'],
  users: ['admin'],
  setRole: ['admin'],
  logs: ['admin'],
};

function checkPermission(role, action) {
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.indexOf(role) !== -1;
}

const VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Google-ის tokeninfo-ს პასუხის შემოწმება.
 *
 * `aud`-ის შემოწმება კრიტიკულია: მის გარეშე ნებისმიერი Google აპლიკაციის
 * ტოკენი მიიღებოდა და ბაზა ღია იქნებოდა. ხელმოწერას და ვადას tokeninfo
 * უკვე ამოწმებს, მაგრამ `exp` აქაც მოწმდება ქეშირების გამო.
 */
function verifyTokenClaims(claims, clientId, nowSec) {
  const bad = function (message) {
    return { ok: false, error: 'UNAUTHENTICATED', message: message };
  };
  if (!claims || typeof claims !== 'object') return bad('ტოკენი არასწორია');
  if (claims.aud !== clientId) return bad('ტოკენი სხვა აპლიკაციისაა');
  if (VALID_ISSUERS.indexOf(String(claims.iss)) === -1) return bad('ტოკენის წყარო არასწორია');
  if (String(claims.email_verified) !== 'true') return bad('მეილი დადასტურებული არაა');
  const email = String(claims.email || '').trim().toLowerCase();
  if (!email) return bad('ტოკენში მეილი არ არის');
  if (!(Number(claims.exp) > nowSec)) return bad('ტოკენს ვადა გაუვიდა');
  return { ok: true, email: email };
}

/**
 * ძველი რიგი და ახალი ველები -> ლოგისთვის ცვლილებების სია.
 * უცვლელი ველი არ იწერება — ლოგი მხოლოდ რეალურ ცვლილებას ინახავს.
 */
function diffFields(oldRow, newFields) {
  const out = [];
  for (const field in newFields) {
    if (!Object.prototype.hasOwnProperty.call(newFields, field)) continue;
    const before = oldRow[field] == null ? '' : String(oldRow[field]);
    const after = newFields[field] == null ? '' : String(newFields[field]);
    if (before !== after) {
      out.push({ field: field, old: before, new: after });
    }
  }
  return out;
}

/* ══ პროექტები ═══════════════════════════════════════════════════════
 *
 * მოდერატორი ურეკავს მეზობელს და სამი პასუხიდან ერთს წერს. მეოთხე —
 * `not_contacted` — ნაგულისხმევია და ნიშნავს, რომ საუბარი ჯერ არ ყოფილა.
 * ისიც ყველას უჩანს: ჩამორჩენა კომუნიკაციაში მოდერატორის საქმეა, არა
 * მეზობლის, და ეს განზრახ ჩანს.
 */
const PLEDGE_STATUSES = {
  not_contacted: 'ჯერ არ მიველაპარაკე',
  paying: 'ვდებ თანხას',
  loan: 'ახლა არ მაქვს — უბნის ვალად ვიღებ, წლის განმავლობაში დავაბრუნებ',
  declined: 'არ მაინტერესებს, არ ვდებ',
};

const SPLIT_METHODS = ['area', 'equal', 'fixed', 'free'];

const PROJECT_STATUSES = ['draft', 'active', 'done', 'cancelled'];

/**
 * უახლოეს ხუთეულამდე. უბანში ხუთლარიან ნაბიჯებში ლაპარაკობენ და ისე
 * იხდიან; 222.22 ლარი ქაღალდზეც უხერხულია და საუბარშიც.
 *
 * ზუსტად შუაზე (47.5) ზემოთ მრგვალდება: `Math.round`-ის ნახევრები
 * ზემოთ მიდის და შედეგი პროგნოზირებადია.
 */
function roundToFive(value) {
  const number = Number(value);
  if (!isFinite(number)) return 0;
  return Math.round(number / 5) * 5;
}

function projectStreets(project) {
  return String((project && project.streets) || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/**
 * ნაკვეთი ხვდება თუ არა პროექტში.
 *
 * ქუჩების სია ცარიელია = „ყველა ქუჩა", და ეს სიტყვასიტყვით ყველას
 * ნიშნავს — ქუჩის გარეშე დარჩენილ ნაკვეთსაც. თუ ქუჩები ჩამოთვლილია,
 * უცნობქუჩიანი ნაკვეთი ვერსად დაემთხვევა.
 */
function plotInProject(plot, project) {
  const streets = projectStreets(project);
  if (streets.length === 0) return true;
  const street = String((plot && plot.street) || '').trim();
  if (!street) return false;
  return streets.indexOf(street) !== -1;
}

/**
 * წილების დაანგარიშება. აბრუნებს:
 *   `shares`        {cad: თანხა} — მხოლოდ მონაწილეებისთვის
 *   `roundingDiff`  ჯამი − ბიუჯეტი; პროექტის გვერდზე ცალკე ჩანს
 *   `noArea`        ფართობის გარეშე დარჩენილი მონაწილეები (`area` წესზე)
 *   `noStreet`      ქუჩის გარეშე დარჩენილი ნაკვეთები — გასაფრთხილებლად
 *
 * ფართობის გარეშე ნაკვეთს `area` წესზე წილი **არ ეწერება**. ნული ჩუმად
 * რომ ჩაწერილიყო, ის სამი წლის შემდეგ აღმოჩნდებოდა — ისიც შემთხვევით.
 */
function calculateSplit(plots, project) {
  const method = String(project.split_method || 'area');
  const budget = Number(project.budget) || 0;
  const rows = (plots || []).filter(function (plot) {
    return plotInProject(plot, project);
  });

  const noStreet = (plots || [])
    .filter(function (plot) { return !String(plot.street || '').trim(); })
    .map(function (plot) { return plot.cad; });

  const shares = {};
  const noArea = [];

  if (method === 'free') {
    rows.forEach(function (plot) { shares[plot.cad] = 0; });
    return { shares: shares, roundingDiff: 0, noArea: [], noStreet: noStreet };
  }

  if (method === 'fixed') {
    const fixed = roundToFive(project.fixed_amount);
    rows.forEach(function (plot) { shares[plot.cad] = fixed; });
  } else if (method === 'equal') {
    const each = rows.length ? roundToFive(budget / rows.length) : 0;
    rows.forEach(function (plot) { shares[plot.cad] = each; });
  } else {
    const withArea = rows.filter(function (plot) {
      const area = Number(plot.area);
      if (!isFinite(area) || area <= 0) { noArea.push(plot.cad); return false; }
      return true;
    });
    const total = withArea.reduce(function (sum, plot) {
      return sum + Number(plot.area);
    }, 0);
    withArea.forEach(function (plot) {
      shares[plot.cad] = total > 0
        ? roundToFive(budget * Number(plot.area) / total)
        : 0;
    });
  }

  const sum = Object.keys(shares).reduce(function (a, cad) {
    return a + shares[cad];
  }, 0);
  return {
    shares: shares,
    roundingDiff: sum - budget,
    noArea: noArea,
    noStreet: noStreet,
  };
}

function isPledgeStatus(value) {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(PLEDGE_STATUSES, value);
}

/**
 * რუკის ფერი ერთი ნაკვეთისთვის.
 *
 * გადახდა პასუხზე მაღლა დგას: ფული შემოსულია, რაც არ უნდა ეწეროს
 * ჩანაწერში. „გადახდილად" ითვლება, როცა წილი სრულად დაიფარა — ან,
 * თუ წილი ნულია (`free` წესი), როცა თანხა საერთოდ შემოვიდა.
 */
function plotColor(pledge, amountDue, amountPaid) {
  const due = Number(amountDue) || 0;
  const paid = Number(amountPaid) || 0;
  if (paid > 0 && (due <= 0 || paid >= due)) return 'paid';
  if (paid > 0) return 'partial';
  const status = pledge && pledge.status;
  if (status === 'declined') return 'declined';
  if (status === 'loan') return 'loan';
  if (status === 'paying') return 'promised';
  return 'none';
}

function deny(code, message) { return { ok: false, code: code, message: message }; }

/**
 * დაპირების ჩაწერის უფლება. ოთხივე პირობა ცალკე მოწმდება, რომ
 * უარის მიზეზი ზუსტად ჩანდეს ლოგშიც და მომხმარებელთანაც.
 */
function canSetPledge(user, plot, project) {
  if (!project || project.status !== 'active') {
    return deny('VALIDATION', 'პროექტი აქტიური არ არის');
  }
  const role = user && user.role;
  if (role === 'admin') return { ok: true };
  if (role !== 'moderator') {
    return deny('FORBIDDEN', 'პასუხის ჩაწერა მოდერატორს შეუძლია');
  }
  const plotStreet = String((plot && plot.street) || '').trim();
  if (!plotStreet) {
    return deny('FORBIDDEN', 'ამ ნაკვეთს ქუჩა არ აქვს — პასუხს ადმინი წერს');
  }
  if (plotStreet !== String(user.street || '').trim()) {
    return deny('FORBIDDEN', 'პასუხის ჩაწერა მხოლოდ თქვენს ქუჩაზე შეგიძლიათ');
  }
  return { ok: true };
}

/**
 * გადახდის ჩაწერის უფლება.
 *
 * მოდერატორი ვერ წერს გადახდას და ხაზინდარი ვერ წერს დაპირებას —
 * „რას დაპირდა" და „რა შემოვიდა" ორი დამოუკიდებელი ჩანაწერია,
 * რომლებიც ერთმანეთს ამოწმებს. ერთ ხელში მოქცევა ამ შემოწმებას შლის.
 */
function canRecordPayment(user, project) {
  if (!project || project.status !== 'active') {
    return deny('VALIDATION', 'პროექტი აქტიური არ არის');
  }
  if (user && user.role === 'admin') return { ok: true };
  const treasurer = String((project && project.treasurer) || '').trim().toLowerCase();
  const email = String((user && user.email) || '').trim().toLowerCase();
  if (treasurer && email && treasurer === email) return { ok: true };
  return deny('FORBIDDEN', 'გადახდას ამ პროექტის ხაზინდარი წერს');
}

/** ხაზინდარი ვერ იქნება იმავე პროექტის ქუჩების მოდერატორი. */
function validateTeam(project, moderators) {
  const treasurer = String((project && project.treasurer) || '').trim().toLowerCase();
  if (!treasurer) return { ok: true };
  const streets = projectStreets(project);
  const clash = (moderators || []).some(function (mod) {
    if (String(mod.email || '').trim().toLowerCase() !== treasurer) return false;
    if (streets.length === 0) return true;
    return streets.indexOf(String(mod.street || '').trim()) !== -1;
  });
  if (clash) {
    return deny('VALIDATION',
      'ხაზინდარი ვერ იქნება ამავე პროექტის ქუჩის მოდერატორი');
  }
  return { ok: true };
}

/**
 * პროექტის ჯამები.
 *
 * `promised` და `loan` მხოლოდ **ჯერ შემოუსვლელ** ნაწილს ითვლის: თუ
 * კაცმა დაპირდა და გადაიხადა, თანხა ორჯერ არ უნდა ჩაითვალოს.
 */
function projectTotals(project, pledges, payments) {
  const paidByCad = {};
  (payments || []).forEach(function (payment) {
    const cad = String(payment.cad || '').trim();
    paidByCad[cad] = (paidByCad[cad] || 0) + (Number(payment.amount) || 0);
  });

  let collected = 0;
  Object.keys(paidByCad).forEach(function (cad) { collected += paidByCad[cad]; });

  let promised = 0;
  let loan = 0;
  let declined = 0;
  let pending = 0;

  (pledges || []).forEach(function (pledge) {
    const cad = String(pledge.cad || '').trim();
    const due = Number(pledge.amount_due) || 0;
    const paid = paidByCad[cad] || 0;
    const left = Math.max(0, due - paid);
    if (pledge.status === 'paying') promised += left;
    else if (pledge.status === 'loan') loan += left;
    else if (pledge.status === 'declined') declined += due;
    else pending += due;
  });

  const budget = Number(project && project.budget) || 0;
  return {
    budget: budget,
    collected: collected,
    promised: promised,
    loan: loan,
    declined: declined,
    pending: pending,
    remaining: Math.max(0, budget - collected),
  };
}

/**
 * პროექტის სტატუსის დასაშვები გადასვლები.
 *
 * `active → draft` აკრძალულია: წილები გააქტიურებისას იყინება, და
 * უკან დაბრუნება ნიშნავდა, რომ უკვე გადახდილ კომლს თანხა შეეცვლებოდა.
 */
function statusTransition(from, to) {
  const allowed = {
    draft: ['active', 'cancelled'],
    active: ['done', 'cancelled'],
    done: [],
    cancelled: [],
  };
  const list = allowed[String(from)];
  return !!list && list.indexOf(String(to)) !== -1;
}

function validateProject(project) {
  const name = String((project && project.name) || '').trim();
  if (!name) return deny('VALIDATION', 'პროექტს სახელი სჭირდება');

  const method = String((project && project.split_method) || 'area');
  if (SPLIT_METHODS.indexOf(method) === -1) {
    return deny('VALIDATION', 'უცნობი განაწილების წესი: ' + method);
  }

  const budget = Number(project && project.budget);
  if (!isFinite(budget) || budget < 0) {
    return deny('VALIDATION', 'ბიუჯეტი რიცხვი უნდა იყოს');
  }
  if (budget === 0 && method !== 'free') {
    return deny('VALIDATION', 'ბიუჯეტი ნულზე მეტი უნდა იყოს');
  }

  if (method === 'fixed') {
    const fixed = Number(project.fixed_amount);
    if (!isFinite(fixed) || fixed <= 0) {
      return deny('VALIDATION', 'ფიქსირებულ წესს თანხა სჭირდება');
    }
  }

  const starts = String((project && project.starts_on) || '').trim();
  const ends = String((project && project.ends_on) || '').trim();
  if (starts && ends && ends < starts) {
    return deny('VALIDATION', 'დასრულება დაწყებაზე ადრე ვერ იქნება');
  }

  return { ok: true };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mapHeaders, normalizePhone, parseGeometry,
    isEditableField, checkPermission, verifyTokenClaims, diffFields,
    PLEDGE_STATUSES, SPLIT_METHODS, PROJECT_STATUSES,
    roundToFive, projectStreets, plotInProject, calculateSplit,
    isPledgeStatus, plotColor, canSetPledge, canRecordPayment,
    validateTeam, projectTotals, statusTransition, validateProject,
  };
}
