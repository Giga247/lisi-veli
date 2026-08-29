/**
 * „ვინ ცხოვრობს" — ნაკვეთის მაცხოვრებლები ბარათზე.
 *
 * ერთი მოდულია იმავე მიზეზით, რის გამოც `HistoryView`-იც ერთია: ორივე
 * ბარათი — მთავარი გვერდისა და პროექტისა — ერთსა და იმავე ნაკვეთზე
 * ერთსა და იმავე კითხვას სვამს.
 *
 * მეპატრონე რეესტრიდან მოდის და ერთია; მაცხოვრებელი კი ის არის, ვინც
 * საიტზე შემოვიდა და ადმინმა ამ ნაკვეთზე მიაბა — ერთ სახლში რამდენიმეც
 * შეიძლება იყოს. მეილი სიაში მხოლოდ მაშინ ჩნდება, თუ ბაზამ გამოგზავნა:
 * მაცხოვრებელს ის `null`-ად მოსდის.
 */
const ResidentsView = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  function line(row) {
    const email = String(row.email || '').trim();
    return '<li class="res-i">' +
      '<span class="res-n">' + esc(WebLib.residentName(row)) + '</span>' +
      (email
        ? '<a class="res-e" href="mailto:' + esc(email) + '">' + esc(email) + '</a>'
        : '') +
      '</li>';
  }

  /**
   * ბლოკის ჩასმა. `host` თავიდან `hidden`-ია და ისეთივე რჩება, თუ ამ
   * ნაკვეთზე არავინაა მიბმული — ცარიელი სათაური „მაცხოვრებლები" ისე
   * გამოიყურებოდა, თითქოს სახლი ცარიელია.
   *
   * @param {Element} host  ცარიელი კონტეინერი ბარათში
   * @param {string}  cad   ნაკვეთის საკადასტრო კოდი
   */
  async function mount(host, cad) {
    if (!host || !cad) return;
    let rows;
    try {
      rows = await API.call('plotResidents', { cad: cad });
    } catch (error) {
      // დამხმარე ინფორმაციაა: მისი ჩავარდნა ბარათის დანარჩენ ნაწილს
      // არ ეხება და მომხმარებელს წითელ ტოსტს არ უჩვენებს.
      return;
    }
    // ბარათი შეიძლება პასუხის დაბრუნებამდე დაიხუროს.
    if (!host.isConnected || !rows || rows.length === 0) return;
    host.innerHTML =
      '<p class="res-h">' +
      (rows.length > 1 ? 'მაცხოვრებლები' : 'მაცხოვრებელი') + '</p>' +
      '<ul class="res-l">' + rows.map(line).join('') + '</ul>';
    host.hidden = false;
  }

  return { mount: mount };
})();
