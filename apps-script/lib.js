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
  const digits = String(raw).replace(/[\s\-()+.]/g, '');
  if (!/^[0-9]+$/.test(digits)) {
    return { ok: false, message: 'ტელეფონი მხოლოდ ციფრებს უნდა შეიცავდეს' };
  }
  let local;
  if (digits.length === 9) {
    local = digits;
  } else if (digits.length === 12 && digits.indexOf('995') === 0) {
    local = digits.slice(3);
  } else {
    return { ok: false, message: 'ნომერი უნდა იყოს 9 ციფრი, ან 995 + 9 ციფრი' };
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mapHeaders, normalizePhone, parseGeometry, isEditableField, checkPermission };
}
