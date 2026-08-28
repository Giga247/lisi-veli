/**
 * ქვედა ბარათი — ნაკვეთის დეტალები.
 *
 * ერთი მოდულია იმიტომ, რომ ორივე გზა — რუკაზე შეხება და სიაში დაჭერა —
 * ერთსა და იმავე რამეს უნდა ხსნიდეს. ორი ცალკე იმპლემენტაცია დროთა
 * განმავლობაში აუცილებლად დაშორდებოდა ერთმანეთს.
 *
 * ტელეფონზე ის ქვემოდან ამოდის, დესკტოპზე — მარჯვნიდან; ორივე CSS-ია,
 * ლოგიკა ერთი და იგივე.
 */
const Sheet = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  let box = null;
  let onEdit = null;
  let onClose = null;

  function close() {
    if (!box) return;
    // მსმენელი აუცილებლად აქ იხსნება: ბარათი ბევრჯერ იხსნება და
    // იკეტება, და დარჩენილი მსმენელები დაგროვდებოდა — თითოეული
    // საკუთარ, უკვე წაშლილ `box`-ს რომ იხსენებდა.
    document.removeEventListener('keydown', box._key);
    box.remove();
    box = null;
    document.body.classList.remove('sheet-open');
    if (onClose) onClose();
  }

  function statusChip(status) {
    if (!status) return '';
    const view = WebLib.pledgeView(status);
    return '<span class="chip tint-' + esc(status) + '">' +
      esc(view.icon) + ' ' + esc(view.label) + '</span>';
  }

  function row(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return '<div class="kv"><span>' + esc(label) + '</span><span>' + value + '</span></div>';
  }

  /**
   * @param {object} plot     ნაკვეთი `plots`-იდან
   * @param {object} [ctx]    { status, amount_due, canEdit, projectName,
   *                            canSeePhone, canSeeHistory }
   */
  function open(plot, ctx) {
    close();
    const info = ctx || {};
    const name = WebLib.fullName(plot);
    const phone = plot.phone ? String(plot.phone) : '';

    box = document.createElement('div');
    box.className = 'sheet-wrap';
    box.innerHTML =
      '<div class="sheet-bg" data-close="1"></div>' +
      '<div class="sheet" role="dialog" aria-modal="true">' +
      '<div class="grab"></div>' +
      '<div class="sh-h">' +
      '<h3>' + esc(name || 'მფლობელი უცნობია') + '</h3>' +
      statusChip(info.status) + '</div>' +
      row('მისამართი', esc(plot.address || plot.street || '—')) +
      row('ფართობი', plot.area ? esc(plot.area) + ' მ²' : '') +
      row('საკადასტრო კოდი', '<span class="mono">' + esc(plot.cad) + '</span>') +
      row('დანიშნულება', esc(plot.purpose || '')) +
      (info.amount_due
        ? row('წილი — ' + esc(info.projectName || 'პროექტი'),
              esc(WebLib.money(info.amount_due)))
        : '') +
      row('შენიშვნა', esc(plot.note || '')) +
      // ვინ შეცვალა ბოლოს — ღილაკებამდე, რადგან ის ინფორმაციაა და არა
      // მოქმედება. ცარიელი კონტეინერი მოგვიანებით ივსება.
      (info.canSeeHistory ? '<div class="hist-box" data-history hidden></div>' : '') +
      '<div class="cta">' +
      // სამი მდგომარეობაა და სამივე სხვადასხვა რამეს ნიშნავს: ნომერი
      // არსებობს; ნომერი არ არის ჩაწერილი; ნომერი არსებობს, მაგრამ ამ
      // მომხმარებელს არ ეკუთვნის. ბოლო შემთხვევაში ღილაკი საერთოდ არ
      // ჩანს — „ტელეფონი არ არის" ტყუილი იქნებოდა.
      (phone
        ? '<a class="pri" href="tel:' + esc(phone) + '">დარეკვა</a>'
        : (info.canSeePhone
            ? '<span class="pri is-off">ტელეფონი არ არის</span>' : '')) +
      (info.canEdit
        ? '<button type="button" data-edit="' + esc(plot.cad) + '">რედაქტირება</button>'
        : '') +
      '</div></div>';

    document.body.appendChild(box);
    document.body.classList.add('sheet-open');

    HistoryView.mount(box.querySelector('[data-history]'), plot.cad);

    box.addEventListener('click', function (event) {
      if (event.target.closest('[data-close]')) { close(); return; }
      const edit = event.target.closest('[data-edit]');
      if (edit && onEdit) {
        const cad = edit.getAttribute('data-edit');
        close();
        onEdit(cad);
      }
    });
    // Escape ყოველთვის კეტავს — ბარათი მოდალია და კლავიატურით სხვა
    // გამოსავალი არ აქვს.
    box._key = function (event) { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', box._key);
  }

  function handlers(opts) {
    onEdit = (opts || {}).onEdit || null;
    onClose = (opts || {}).onClose || null;
  }

  return { open: open, close: close, handlers: handlers };
})();
