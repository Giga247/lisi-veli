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

  /**
   * ჯგუფები „მომხმარებლების" განყოფილებაში.
   *
   * ათი ბარათი ერთ გროვად ეკრანს ავსებდა და ადმინი მათ სათითაოდ
   * კითხულობდა. ჯგუფი პასუხობს კითხვას „ვინ რას აკეთებს" ერთი
   * შეხედვით. ხაზინდრობა როლი არ არის — ის პროექტის ველია, ამიტომ
   * ცალკე ჯგუფად მხოლოდ მაშინ ჩნდება, როცა კაცს გლობალური როლით
   * უფრო მაღალი ადგილი არ უჭირავს.
   */
  const GROUPS = [
    { key: 'admin', label: 'ადმინები' },
    { key: 'moderator', label: 'მოდერატორები' },
    { key: 'treasurer', label: 'ხაზინდრები' },
    { key: 'member', label: 'მაცხოვრებლები' },
    { key: 'blocked', label: 'დაბლოკილები' },
  ];

  function groupOf(user) {
    if (user.role === 'blocked') return 'blocked';
    if (user.role === 'admin') return 'admin';
    if (user.role === 'moderator') return 'moderator';
    if ((user.treasurer_of || []).length) return 'treasurer';
    return 'member';
  }

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
      const pick = event.target.closest('[data-pick]');
      if (pick) { openPicker(pick.closest('[data-email]')); return; }
      const add = event.target.closest('[data-add]');
      if (add) { addTyped(add.closest('[data-email]')); return; }
      const drop = event.target.closest('[data-drop]');
      if (drop) {
        const card = drop.closest('[data-email]');
        dropPlot(card, drop.getAttribute('data-drop'));
        return;
      }
      const remove = event.target.closest('[data-del]');
      if (remove) { confirmDelete(remove); return; }
      const button = event.target.closest('[data-save]');
      if (button) save(button);
    });
    // ქუჩა და ნომერი აკრეფისთანავე ეძებს ნაკვეთს. `input` ორივეს ხვდება —
    // ტექსტურ ველსაც და სელექტსაც.
    panel.addEventListener('input', function (event) {
      if (!event.target.closest('[data-street], [data-num]')) return;
      preview(event.target.closest('[data-email]'));
    });
    // Enter ნომრის ველში = „დამატება": მისამართი ისედაც აკრეფილია და
    // თითის მაუსზე გადატანა ზედმეტი ნაბიჯია.
    panel.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || !event.target.closest('[data-num]')) return;
      event.preventDefault();
      addTyped(event.target.closest('[data-email]'));
    });
  }

  function roleOptions(current) {
    return ROLES.map(function (role) {
      return '<option value="' + role.value + '"' +
        (role.value === current ? ' selected' : '') + '>' + esc(role.label) + '</option>';
    }).join('');
  }

  /**
   * ქუჩების ნუსხა დასამატებელი მისამართისთვის.
   *
   * აქ შენახული მნიშვნელობა აღარ არსებობს: ქუჩა და ნომერი პროფილის
   * ველები აღარაა, არამედ ის ორი სიტყვაა, რომლითაც ადმინი ნაკვეთს
   * ეძებს. ამიტომ სია ყოველთვის ცარიელი არჩევანით იწყება.
   */
  function streetOptions() {
    const streets = window.PLOTS ? WebLib.streetList(window.PLOTS) : [];
    return '<option value="">ქუჩა…</option>' +
      streets.map(function (street) {
        return '<option value="' + esc(street) + '">' + esc(street) + '</option>';
      }).join('');
  }

  /** ნაკვეთი კოდით — `window.PLOTS`-ში, რომელიც ისედაც ჩატვირთულია. */
  function plotOf(cad) {
    const code = String(cad || '').trim();
    if (!code) return null;
    return (window.PLOTS || []).filter(function (plot) {
      return plot.cad === code;
    })[0] || null;
  }

  /**
   * რა ეწეროს ბარათზე ნაკვეთის ადგილას.
   *
   * სამი მდგომარეობაა: მიბმული ნაკვეთი, მიბმა არ არის, და მიბმულია
   * ისეთი კოდი, რომელიც რეესტრში აღარ ჩანს. ბოლო ჩუმად რომ იმალებოდეს,
   * ადმინი ვერ მიხვდებოდა, რატომ არ უჩანს მაცხოვრებელს „ჩემი ნაკვეთი".
   */
  function plotText(cad) {
    const code = String(cad || '').trim();
    if (!code) return 'მიბმული არ არის';
    const plot = plotOf(code);
    return plot ? WebLib.plotLabel(plot) : code + ' — რეესტრში არ არის';
  }

  /**
   * ჩემი მეილი — მთავარი ნაკადის გლობალიდან.
   *
   * პანელს ორი რამისთვის სჭირდება: საკუთარ როლს ადმინი ვერ იცვლის და
   * საკუთარ ანგარიშს ვერ შლის. სია კი ყველა ბარათს ერთნაირად აჩვენებს,
   * ამიტომ „ჩემი" მხოლოდ მეილის შედარებით იცნობა.
   */
  function myEmail() {
    return typeof CURRENT_USER !== 'undefined' && CURRENT_USER
      ? String(CURRENT_USER.email || '').trim().toLowerCase() : '';
  }

  /** ავატარის ორი ასო — იგივე წესი, რაც ზედა ზოლში. */
  function initials(user) {
    const source = String(user.display_name || user.email || '?').trim();
    const parts = source.split(/[\s@._-]+/).filter(Boolean);
    const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
    return letters.toUpperCase();
  }

  /** ერთი ან რამდენიმე — შეკეცილ მწკრივზე ორივე ერთ სტრიქონად უნდა ჩაჯდეს. */
  function cadsSummary(cads) {
    const list = cads || [];
    if (!list.length) return 'ნაკვეთის გარეშე';
    if (list.length === 1) return plotText(list[0]);
    return list.length + ' ნაკვეთი';
  }

  function userCard(user, open) {
    const name = String(user.display_name || '').trim();
    const isMe = String(user.email || '').trim().toLowerCase() === myEmail();
    // ხაზინდრობა როლი არ არის და აქ არც იცვლება — ის პროექტის ველია.
    // ნიშანი და სტრიქონი მხოლოდ იმას ეუბნება ადმინს, ვის რომელ
    // პროექტში ევალება ფულის ჩაწერა.
    const projects = user.treasurer_of || [];
    const moderates = user.moderator_of || [];
    // `<details>` და არა ჩვენი ჩამკეცი: კლავიატურა, სკრინრიდერი და
    // ბრაუზერის ძებნა (Cmd+F ხსნის დახურულს) უფასოდ მოდის.
    return '<details class="ad-u" data-email="' + esc(user.email) + '"' +
      (open ? ' open' : '') + '>' +
      '<summary class="ad-u-h">' +
      '<span class="ad-av">' + esc(initials(user)) + '</span>' +
      '<span class="ad-u-id">' +
      '<span class="ad-u-n">' + esc(name || '— სახელის გარეშე') + '</span>' +
      '<span class="ad-u-e">' + esc(user.email) + '</span></span>' +
      // მისამართი შეკეცილ მწკრივზეც ჩანს: ადმინი ბარათს ხშირად
      // სწორედ იმის სანახავად ხსნიდა, მიბმულია თუ არა ნაკვეთი.
      '<span class="ad-u-sum">' + esc(cadsSummary(user.cads)) + '</span>' +
      '<span class="ad-tags">' +
      '<span class="ad-tag ad-tag-' + esc(user.role) + '">' +
      esc(ROLE_SHORT[user.role] || user.role) + '</span>' +
      (projects.length
        ? '<span class="ad-tag ad-tag-treasurer">ხაზინდარი</span>' : '') +
      '</span>' +
      '</summary>' +
      // შიგთავსი ცალკე კონტეინერშია: `<details>`-ის პირდაპირ ბავშვებზე
      // grid/flex-ის დაყრდნობა ბრაუზერებში სხვადასხვანაირად იქცევა
      // (Chrome-ს `::details-content` ფენა აქვს), ეს კი უბრალო div-ია.
      '<div class="ad-u-b">' +
      (projects.length
        ? '<p class="ad-u-tre"><span>ხაზინდარი:</span> ' +
          esc(projects.join(', ')) + '</p>'
        : '') +
      (moderates.length
        ? '<p class="ad-u-tre"><span>მოდერატორი:</span> ' +
          esc(moderates.join(', ')) + '</p>'
        : '') +
      '<div class="ad-u-f">' +
      // საკუთარ როლს ადმინი ვერ იცვლის (ბაზაშიც და `setRole`-შიც ასეა) —
      // ჩაკეტილი სელექტი ამას შენახვამდე ამბობს და არა შემდეგ, წითელი
      // შეცდომით. მისამართი კი საკუთარ ბარათზეც იწერება.
      '<label>როლი<select data-role' + (isMe ? ' disabled' : '') + '>' +
      roleOptions(user.role) + '</select>' +
      (isMe ? '<span class="ad-u-hint">საკუთარ როლს ვერ შეცვლი</span>' : '') +
      '</label>' +
      '</div>' +
      // ნაკვეთები სიაა და არა ერთი ველი: ერთ კაცს უბანში რამდენიმე
      // ნაკვეთი აქვს. ქუჩა და ნომერი აქ პროფილის ველები აღარაა —
      // ისინი დასამატებელი მისამართის საძებნი ველებია.
      '<div class="ad-plots" data-plots>' +
      '<span class="ad-u-plot-l">ნაკვეთები</span>' +
      '<ul class="ad-plot-list" data-list>' + plotChips(user.cads) + '</ul>' +
      '<div class="ad-plot-add">' +
      '<select data-street aria-label="ქუჩა">' + streetOptions() + '</select>' +
      '<input type="text" data-num maxlength="16" autocomplete="off" ' +
      'placeholder="ნომერი" aria-label="სახლის ნომერი">' +
      '<button type="button" class="ad-plot-b" data-add disabled>დამატება</button>' +
      '<button type="button" class="ad-u-plot-x" data-pick>რუკიდან</button>' +
      '</div>' +
      '<span class="ad-plot-found" data-found></span>' +
      '</div>' +
      '<div class="ad-u-a">' +
      '<button type="button" class="ad-save" data-save>შენახვა</button>' +
      (isMe ? '' : '<button type="button" class="ad-del" data-del>წაშლა</button>') +
      '<span class="ad-msg" data-msg></span>' +
      '</div>' +
      '</div>' +
      '</details>';
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

  /** სახელით — ჯგუფის შიგნით ანბანური რიგი ყველაზე მოსალოდნელია. */
  function byName(a, b) {
    const left = String(a.display_name || a.email || '').toLowerCase();
    const right = String(b.display_name || b.email || '').toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
  }

  function groupBlock(users, opened) {
    return GROUPS.map(function (group) {
      const rows = users.filter(function (user) {
        return groupOf(user) === group.key;
      }).sort(byName);
      if (!rows.length) return '';
      return '<div class="ad-grp">' +
        '<h3 class="ad-grp-h">' + esc(group.label) +
        '<span>' + rows.length + '</span></h3>' +
        '<div class="ad-cards">' + rows.map(function (user) {
          return userCard(user, opened.indexOf(user.email) !== -1);
        }).join('') + '</div></div>';
    }).join('');
  }

  /**
   * ხელახლა დახატვა.
   *
   * `opened` — ის ბარათები, რომლებიც ადმინს გახსნილი ჰქონდა: შენახვის
   * შემდეგ სია თავიდან იგება და გახსნილი ბარათი სხვაგვარად ჩუმად
   * დაიკეცებოდა სწორედ მაშინ, როცა ადმინი მასზე მუშაობს.
   */
  function draw(panel, opened) {
    const users = state.users;
    const logs = state.logs;
    const open = opened || [];
    const pending = users.filter(function (u) { return u.role === 'pending'; });
    const active = users.filter(function (u) { return u.role !== 'pending'; });

    panel.innerHTML = shell(
      section('დასამტკიცებელი მოთხოვნები', pending.length,
        pending.length === 0
          ? '<p class="empty">ახალი მოთხოვნა არ არის.</p>'
          // დასამტკიცებელი ბარათი თავიდანვე გახსნილია: ის სამუშაოა და
          // არა საცნობარო მწკრივი.
          : '<p class="empty">აირჩიე როლი და მისამართი, შემდეგ დააჭირე „შენახვა".</p>' +
            '<div class="ad-cards">' + pending.map(function (user) {
              return userCard(user, true);
            }).join('') + '</div>') +
      section('მომხმარებლები', active.length,
        active.length === 0
          ? '<p class="empty">ჯერ არავინაა.</p>'
          : groupBlock(active, open)) +
      section('ცვლილებების ლოგი', logs.length,
        logs.length === 0
          ? '<p class="empty">ჩანაწერი არ არის.</p>'
          : '<ol class="ad-log">' + logs.map(logItem).join('') + '</ol>'));
  }

  /* ── ნაკვეთის არჩევა რუკიდან ─────────────────────────────── */

  // გეგმის მონაცემს `PlanView` თვითონ იქეშებს, ინსტანციას კი ყოველ
  // გახსნაზე თავიდან ვაგებთ: ფანჯარა იხურება და მისი DOM ქრება.
  function openPicker(card) {
    const currentCads = cadsOf(card);

    const dialog = document.createElement('div');
    dialog.className = 'pr-dialog';
    dialog.innerHTML = '<div class="pr-dialog-box ad-pick">' +
      '<header class="ad-pick-h"><h3>ნაკვეთის არჩევა</h3>' +
      '<button type="button" class="pc-x" data-close aria-label="დახურვა">✕</button>' +
      '</header>' +
      '<p class="ad-pick-hint">შეეხე ნაკვეთს — სიაში დაემატება.' +
      (currentCads.length
        ? ' ახლა მიბმულია: <b>' + esc(currentCads.map(plotText).join(', ')) + '</b>.'
        : '') +
      '</p>' +
      '<div class="ad-pick-map"><p class="empty">იტვირთება…</p></div>' +
      '</div>';
    document.body.appendChild(dialog);
    document.body.classList.add('sheet-open');

    const close = function () {
      document.removeEventListener('keydown', dialog._key);
      dialog.remove();
      document.body.classList.remove('sheet-open');
    };
    dialog._key = function (event) { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', dialog._key);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog || event.target.closest('[data-close]')) close();
    });

    const host = dialog.querySelector('.ad-pick-map');
    PlanView.load().then(function (data) {
      if (!host.isConnected) return;
      PlanView.create(host, data, {
        sidebar: false,
        // წარწერა რეესტრიდან და არა გეგმის ფაილიდან — იქ ნომრები
        // ერთხელ ჩაიწერა და შესწორებები აღარ ხვდება.
        label: function (cad) {
          const plot = plotOf(cad);
          return plot && plot.num ? String(plot.num) : '';
        },
        // ახლა მიბმული ნაკვეთი ნახაზზეც უნდა ჩანდეს და არა მხოლოდ
        // ზემოთ, ტექსტში — ადმინი სწორედ იმას ეძებს, რომ შეცვალოს.
        mark: currentCads,
        markLabel: 'ახლა მიბმულია',
        onSelect: function (cad) {
          if (!cad) return;
          addPlot(card, cad);
          close();
        },
      });
    }).catch(function () {
      if (host.isConnected) {
        host.innerHTML = '<p class="empty">გეგმა ვერ ჩაიტვირთა — ' +
          'გადატვირთეთ გვერდი.</p>';
      }
    });
  }

  /** მიბმული ნაკვეთები ისე, როგორც ბარათზე ახლა წერია. */
  function cadsOf(card) {
    return Array.prototype.map.call(
      card.querySelectorAll('[data-list] [data-cad]'),
      function (item) { return item.getAttribute('data-cad'); });
  }

  /** სიის მწკრივები. ცარიელი სია ტექსტია და არა უჩინარი ადგილი. */
  function plotChips(cads) {
    const list = cads || [];
    if (!list.length) return '<li class="ad-plot-none">მიბმული არ არის</li>';
    return list.map(function (cad) {
      return '<li class="ad-plot-i" data-cad="' + esc(cad) + '">' +
        '<span>' + esc(plotText(cad)) + '</span>' +
        '<button type="button" class="ad-plot-x" data-drop="' + esc(cad) + '" ' +
        'aria-label="მოხსნა">✕</button></li>';
    }).join('');
  }

  function redrawChips(card) {
    card.querySelector('[data-list]').innerHTML = plotChips(cadsOf(card));
    preview(card);
  }

  /**
   * აკრეფილი მისამართის შედეგი — ჯერ მხოლოდ საჩვენებლად.
   *
   * ავტომატური მიბმა აქ აღარ გამოდგება: სიაში აკრეფის გზაზე ყოველი
   * შუალედური ნომერიც ჩავარდებოდა („1" გზაზე „17"-ისკენ). ამიტომ ძებნა
   * მაინც აკრეფისთანავე მუშაობს, ჩამატება კი ერთ დაჭერას ითხოვს.
   */
  function preview(card) {
    if (!card) return;
    const found = card.querySelector('[data-found]');
    const button = card.querySelector('[data-add]');
    if (!found || !button) return;
    const street = card.querySelector('[data-street]').value;
    const num = card.querySelector('[data-num]').value;
    const plot = WebLib.findPlotByAddress(window.PLOTS || [], street, num);

    button.removeAttribute('data-cad');
    if (!street || !String(num).trim()) {
      button.disabled = true;
      found.textContent = '';
      return;
    }
    if (!plot) {
      button.disabled = true;
      found.textContent = 'ასეთი მისამართი რეესტრში არ არის';
      return;
    }
    if (cadsOf(card).indexOf(plot.cad) !== -1) {
      button.disabled = true;
      found.textContent = plotText(plot.cad) + ' — უკვე დამატებულია';
      return;
    }
    button.disabled = false;
    button.setAttribute('data-cad', plot.cad);
    found.textContent = plotText(plot.cad);
  }

  /** აკრეფილის ჩამატება სიაში. */
  function addTyped(card) {
    const button = card.querySelector('[data-add]');
    if (!button || button.disabled) return;
    addPlot(card, button.getAttribute('data-cad'));
    // ქუჩა რჩება, ნომერი იწმინდება: ერთსა და იმავე ქუჩაზე ორი ნაკვეთი
    // ჩვეულებრივი შემთხვევაა და ქუჩის ხელახლა არჩევა ზედმეტი ნაბიჯია.
    card.querySelector('[data-num]').value = '';
    card.querySelector('[data-num]').focus();
    preview(card);
  }

  function addPlot(card, cad) {
    const code = String(cad || '').trim();
    if (!code || cadsOf(card).indexOf(code) !== -1) return;
    const list = card.querySelector('[data-list]');
    const empty = list.querySelector('.ad-plot-none');
    if (empty) empty.remove();
    list.insertAdjacentHTML('beforeend', plotChips([code]));
    preview(card);
  }

  function dropPlot(card, cad) {
    const item = card.querySelector('[data-list] [data-cad="' + cad + '"]');
    if (item) item.remove();
    redrawChips(card);
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
    const cads = cadsOf(card);

    button.disabled = true;
    message.className = 'ad-msg';
    message.textContent = 'ინახება…';
    try {
      const saved = await API.call('setRole',
        { email: email, role: role, cads: cads });
      state.users = state.users.map(function (user) {
        return user.email === email ? Object.assign({}, user, saved) : user;
      });
      const scroll = window.scrollY;
      draw(UI.el('view-admin'), openCards());
      window.scrollTo(0, scroll);
      flash(email, 'is-ok', 'შენახულია');
    } catch (error) {
      message.className = 'ad-msg is-bad';
      message.textContent = error.message;
      UI.showError(error.message);
      button.disabled = false;
    }
  }

  /**
   * მომხმარებლის წაშლა — ორ დაჭერაში.
   *
   * იგივე წესი, რაც პროექტის დამტკიცებას: `confirm()` ბრაუზერის მოდალია,
   * ინგლისურ ჩარჩოში ქართული ტექსტით. მეორე დაჭერა შემთხვევითისგან
   * ისევე იცავს, ხუთ წამში კი ღილაკი თავისით უკან ბრუნდება.
   */
  async function confirmDelete(button) {
    const card = button.closest('[data-email]');
    const email = card.getAttribute('data-email');
    if (button.getAttribute('data-armed') !== '1') {
      button.setAttribute('data-armed', '1');
      button.textContent = 'ნამდვილად წავშალო?';
      button.classList.add('is-armed');
      setTimeout(function () {
        if (!button.isConnected) return;
        button.removeAttribute('data-armed');
        button.textContent = 'წაშლა';
        button.classList.remove('is-armed');
      }, 5000);
      return;
    }

    button.disabled = true;
    button.textContent = 'იშლება…';
    try {
      await API.call('deleteUser', { email: email });
      state.users = state.users.filter(function (user) {
        return user.email !== email;
      });
      const scroll = window.scrollY;
      draw(UI.el('view-admin'), openCards());
      window.scrollTo(0, scroll);
      // წაშლა ბანი არ არის — ადმინმა ეს უნდა იცოდეს მაშინვე, თორემ
      // იმავე კაცის ხელახლა გამოჩენა შეცდომად მოეჩვენება.
      UI.showError(email + ' წაიშალა. თუ ისევ შემოვა, ახალ მოთხოვნად ' +
        'გამოჩნდება — სამუდამოდ დახურვა „დაბლოკილია".');
    } catch (error) {
      UI.showError(error.message || 'წაშლა ვერ მოხერხდა');
      button.disabled = false;
      button.textContent = 'წაშლა';
      button.removeAttribute('data-armed');
      button.classList.remove('is-armed');
    }
  }

  /** რომელი ბარათებია ახლა გახსნილი — გადახატვამდე. */
  function openCards() {
    return Array.prototype.map.call(
      UI.el('view-admin').querySelectorAll('.ad-u[open]'),
      function (card) { return card.getAttribute('data-email'); });
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
