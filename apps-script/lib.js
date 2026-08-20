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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mapHeaders, normalizePhone };
}
