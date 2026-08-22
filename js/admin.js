/**
 * ადმინის პანელი — მომხმარებლების დამტკიცება, როლები და აუდიტ-ლოგი.
 *
 * განლაგება ბარათებია და არა ცხრილი. ცხრილს ხუთი და შვიდი სვეტი ჰქონდა,
 * რაც 375px-იან ეკრანზე ჰორიზონტალურ გრაგნილს ნიშნავდა — ადმინი კი
 * ხშირად სწორედ ტელეფონიდან ამტკიცებს ახალ მოთხოვნას. დესკტოპზე იგივე
 * ბარათები ერთ მწკრივში ეწყობა (იხ. `css/admin.css`).
 */
const AdminView = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  const ROLES = [
    { value: 'member', label: 'მაცხოვრებელი — მხოლოდ ნახვა' },
    { value: 'moderator', label: 'მოდერატორი — რედაქტირება' },
    { value: 'admin', label: 'ადმინი — სრული წვდომა' },
    { value: 'blocked', label: 'დაბლოკილი' },
  ];

  const ROLE_SHORT = {
    pending: 'მოლოდინში',
    member: 'მაცხოვრებელი',
    moderator: 'მოდერატორი',
    admin: 'ადმინი',
    blocked: 'დაბლოკილი',
  };

  let bound = false;
  let state = { users: [], logs: [] };

  async function render() {
    const panel = UI.el('view-admin');
    panel.innerHTML = shell('<p class="empty">იტვირთება…</p>');
    bind(panel);
    try {
      // ორივე მოთხოვნა პარალელურად: ლოგი მომხმარებლებს არ ელოდება.
      const both = await Promise.all([API.call('users'), API.call('logs', { limit: 200 })]);
      state = { users: both[0] || [], logs: both[1] || [] };
      draw(panel);
    } catch (error) {
      UI.showError(error.message);
      panel.innerHTML = shell('<p class="empty">ჩატვირთვა ვერ მოხერხდა.</p>');
    }
  }

  /** უკან დაბრუნების ღილაკი ყოველთვის უნდა იყოს — ჩატვირთვისასაც და
   *  ჩავარდნისასაც. მის გარეშე ადმინის ხედიდან გამოსავალი არ არსებობს:
   *  ზედა ზოლის „ადმინი" აქედან იმავე ხედს ხსნის. */
  function shell(inner) {
    return '<div class="ad-page">' +
      '<button type="button" class="pr-back" data-back="1">← მთავარი</button>' +
      inner + '</div>';
  }

  function bind(panel) {
    if (bound) return;
    bound = true;
    panel.addEventListener('click', function (event) {
      if (event.target.closest('[data-back]')) {
        UI.showView('home');
        return;
      }
      const button = event.target.closest('[data-save]');
      if (button) save(button);
    });
  }

  function roleOptions(current) {
    return ROLES.map(function (role) {
      return '<option value="' + role.value + '"' +
        (role.value === current ? ' selected' : '') + '>' + esc(role.label) + '</option>';
    }).join('');
  }

  function streetOptions(current) {
    const streets = window.PLOTS ? WebLib.streetList(window.PLOTS) : [];
    const trimmedCurrent = String(current || '').trim();
    // მომხმარებლის შენახული ქუჩა შეიძლება არცერთ ნაკვეთზე აღარ ჩანდეს
    // (გადარქმეული, სხვანაირად აკრეფილი, ან ბოლო ნაკვეთი შეიცვალა) — ასეთ
    // შემთხვევაში streets-ს შორის selected ვერაფერი ემთხვევა და ბრაუზერი
    // პირველ option-ს (ქუჩის გარეშე) აირჩევდა ნაგულისხმევად. მხოლოდ როლის
    // შესაცვლელად შენახვისას ეს ჩუმად წაშლიდა ქუჩას — ამიტომ რეალური მნიშვნელობა
    // ყოველთვის უნდა ჩანდეს, თუნდაც არცერთ ნაკვეთს არ ეკუთვნოდეს.
    const isOrphan = trimmedCurrent && streets.indexOf(trimmedCurrent) === -1;
    const orphanOption = isOrphan
      ? '<option value="' + esc(trimmedCurrent) + '" selected>' +
        esc(trimmedCurrent) + ' (ნაკვეთებში არ გვხვდება)</option>'
      : '';
    return orphanOption + '<option value="">ქუჩის გარეშე</option>' +
      streets.map(function (street) {
        return '<option value="' + esc(street) + '"' +
          (street === trimmedCurrent ? ' selected' : '') + '>' + esc(street) + '</option>';
      }).join('');
  }

  /** ავატარის ორი ასო — იგივე წესი, რაც ზედა ზოლში. */
  function initials(user) {
    const source = String(user.display_name || user.email || '?').trim();
    const parts = source.split(/[\s@._-]+/).filter(Boolean);
    const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
    return letters.toUpperCase();
  }

  function userCard(user) {
    const name = String(user.display_name || '').trim();
    // ხაზინდრობა როლი არ არის და აქ არც იცვლება — ის პროექტის ველია.
    // ნიშანი და სტრიქონი მხოლოდ იმას ეუბნება ადმინს, ვის რომელ
    // პროექტში ევალება ფულის ჩაწერა.
    const projects = user.treasurer_of || [];
    const moderates = user.moderator_of || [];
    return '<article class="ad-u" data-email="' + esc(user.email) + '">' +
      '<header class="ad-u-h">' +
      '<span class="ad-av">' + esc(initials(user)) + '</span>' +
      '<span class="ad-u-id">' +
      '<span class="ad-u-n">' + esc(name || '— სახელის გარეშე') + '</span>' +
      '<span class="ad-u-e">' + esc(user.email) + '</span></span>' +
      '<span class="ad-tags">' +
      '<span class="ad-tag ad-tag-' + esc(user.role) + '">' +
      esc(ROLE_SHORT[user.role] || user.role) + '</span>' +
      (projects.length
        ? '<span class="ad-tag ad-tag-treasurer">ხაზინდარი</span>' : '') +
      '</span>' +
      '</header>' +
      (projects.length
        ? '<p class="ad-u-tre"><span>ხაზინდარი:</span> ' +
          esc(projects.join(', ')) + '</p>'
        : '') +
      (moderates.length
        ? '<p class="ad-u-tre"><span>მოდერატორი:</span> ' +
          esc(moderates.join(', ')) + '</p>'
        : '') +
      '<div class="ad-u-f">' +
      '<label>როლი<select data-role>' + roleOptions(user.role) + '</select></label>' +
      '<label>ქუჩა<select data-street>' + streetOptions(user.street) + '</select></label>' +
      '</div>' +
      '<div class="ad-u-a">' +
      '<button type="button" class="ad-save" data-save>შენახვა</button>' +
      '<span class="ad-msg" data-msg></span>' +
      '</div>' +
      '</article>';
  }

  function logItem(row) {
    const when = String(row.at || '').slice(0, 16).replace('T', ' ');
    return '<li class="ad-log-i">' +
      '<div class="ad-log-h"><code>' + esc(row.cad || '—') + '</code>' +
      '<time>' + esc(when) + '</time></div>' +
      // ძველი მნიშვნელობა მხოლოდ მაშინ, როცა არსებობდა: გადახაზული
      // ტირე „ცარიელი იყო"-ს ნაცვლად უბრალოდ ხმაურია.
      '<div class="ad-log-b"><span class="ad-log-f">' + esc(row.field || row.action) + '</span>' +
      (row.old ? '<span class="ad-log-o">' + esc(row.old) + '</span>' : '') +
      '<span class="ad-log-ar">→</span>' +
      '<span class="ad-log-nw">' + esc(row.new || '—') + '</span></div>' +
      '<div class="ad-log-w">' + esc(row.by || '—') + ' · ' + esc(row.action) + '</div>' +
      '</li>';
  }

  function section(title, count, body) {
    return '<section class="ad-sec">' +
      '<div class="sec-h"><h2>' + esc(title) + '</h2>' +
      '<span class="muted">' + count + '</span></div>' + body + '</section>';
  }

  function draw(panel) {
    const users = state.users;
    const logs = state.logs;
    const pending = users.filter(function (u) { return u.role === 'pending'; });
    const active = users.filter(function (u) { return u.role !== 'pending'; });

    panel.innerHTML = shell(
      section('დასამტკიცებელი მოთხოვნები', pending.length,
        pending.length === 0
          ? '<p class="empty">ახალი მოთხოვნა არ არის.</p>'
          : '<p class="empty">აირჩიე როლი და ქუჩა, შემდეგ დააჭირე „შენახვა".</p>' +
            '<div class="ad-cards">' + pending.map(userCard).join('') + '</div>') +
      section('მომხმარებლები', active.length,
        active.length === 0
          ? '<p class="empty">ჯერ არავინაა.</p>'
          : '<div class="ad-cards">' + active.map(userCard).join('') + '</div>') +
      section('ცვლილებების ლოგი', logs.length,
        logs.length === 0
          ? '<p class="empty">ჩანაწერი არ არის.</p>'
          : '<ol class="ad-log">' + logs.map(logItem).join('') + '</ol>'));
  }

  /**
   * შენახვა და სიის ადგილზე განახლება.
   *
   * პასუხს ვინახავთ ლოკალურ ასლში და თავიდან ვხატავთ — დამტკიცებული
   * მოთხოვნა „დასამტკიცებელიდან" აქტიურებში ისე უნდა გადავიდეს, რომ
   * ადმინმა გვერდი ხელით არ გადატვირთოს. გრაგნილი უცვლელი რჩება:
   * გრძელ სიაში თავში ახტომა ადგილს აკარგვინებდა.
   */
  async function save(button) {
    const card = button.closest('[data-email]');
    const message = card.querySelector('[data-msg]');
    const email = card.getAttribute('data-email');
    const role = card.querySelector('[data-role]').value;
    const street = card.querySelector('[data-street]').value;

    button.disabled = true;
    message.className = 'ad-msg';
    message.textContent = 'ინახება…';
    try {
      const saved = await API.call('setRole', { email: email, role: role, street: street });
      state.users = state.users.map(function (user) {
        return user.email === email ? Object.assign({}, user, saved) : user;
      });
      const scroll = window.scrollY;
      draw(UI.el('view-admin'));
      window.scrollTo(0, scroll);
      flash(email, 'is-ok', 'შენახულია');
    } catch (error) {
      message.className = 'ad-msg is-bad';
      message.textContent = error.message;
      UI.showError(error.message);
      button.disabled = false;
    }
  }

  /** გადახატვის შემდეგ ბარათი ახალია — შეტყობინება მას უნდა მიება. */
  function flash(email, tone, text) {
    const card = UI.el('view-admin')
      .querySelector('[data-email="' + (window.CSS && CSS.escape ? CSS.escape(email) : email) + '"]');
    if (!card) return;
    const message = card.querySelector('[data-msg]');
    message.className = 'ad-msg ' + tone;
    message.textContent = text;
  }

  return { render: render };
})();
