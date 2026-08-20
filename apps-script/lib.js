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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mapHeaders };
}
