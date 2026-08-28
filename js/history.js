/**
 * „ვინ შეცვალა" — ნაკვეთის ისტორია ბარათზე.
 *
 * ერთი მოდულია იმავე მიზეზით, რის გამოც `Sheet`-იც ერთია: ორივე
 * ბარათი — მთავარი გვერდისა და პროექტისა — ერთსა და იმავე ნაკვეთზე
 * ერთსა და იმავე კითხვას სვამს.
 *
 * ორი დონე ერთ ბლოკში: ზემოთ ბოლო ცვლილება, ერთი ჩუმი სტრიქონი —
 * სწორედ ეს არის ის, რასაც ზარის დროს კითხულობ. ქვემოთ ჩასაკეცი
 * სია — მას მაშინ ხსნი, როცა „მოიცა, ეს ვინ შეცვალა?" ჩნდება.
 *
 * მოთხოვნა ბარათის გახსნისთანავე მიდის და არა ჩაკეცილის გახსნაზე:
 * ზედა სტრიქონსაც იმავე პასუხი სჭირდება.
 */
const HistoryView = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  function line(row) {
    const entry = WebLib.historyEntry(row);
    return '<li class="hist-i">' +
      '<span class="hist-t">' + esc(entry.title) + '</span>' +
      '<span class="hist-d">' + esc(entry.detail) + '</span>' +
      '<span class="hist-w">' + esc(row.actor_name || row.actor || '—') +
      ' · ' + esc(WebLib.since(row.at)) + '</span>' +
      '</li>';
  }

  function html(rows) {
    const last = rows[0];
    return '<p class="hist-last">' +
      '<span class="hist-p" aria-hidden="true">✎</span> ' +
      '<b>' + esc(last.actor_name || last.actor || '—') + '</b>' +
      ' · ' + esc(WebLib.since(last.at)) + '</p>' +
      (rows.length > 1
        ? '<details class="hist">' +
          '<summary>ისტორია (' + rows.length + ')</summary>' +
          '<ol class="hist-l">' + rows.map(line).join('') + '</ol>' +
          '</details>'
        : '<ol class="hist-l hist-solo">' + line(last) + '</ol>');
  }

  /**
   * ბლოკის ჩასმა. `host` თავიდან `hidden`-ია და ისეთივე რჩება, თუ
   * ისტორია ცარიელია ან უფლება არ არის — ცარიელი სათაური ბარათს
   * ისე გამოაჩენდა, თითქოს რაღაც არ ჩაიტვირთა.
   *
   * @param {Element} host   ცარიელი კონტეინერი ბარათში
   * @param {string}  cad    ნაკვეთის საკადასტრო კოდი
   */
  async function mount(host, cad) {
    if (!host || !cad) return;
    let rows;
    try {
      rows = await API.call('plotHistory', { cad: cad, limit: 20 });
    } catch (error) {
      // ისტორია დამხმარე ინფორმაციაა: მისი ჩავარდნა ბარათის დანარჩენ
      // ნაწილს არ ეხება და მოდერატორს წითელ ტოსტს არ უჩვენებს.
      return;
    }
    // ბარათი შეიძლება პასუხის დაბრუნებამდე დაიხუროს.
    if (!host.isConnected || !rows || rows.length === 0) return;
    host.innerHTML = html(rows);
    host.hidden = false;
  }

  return { mount: mount };
})();
