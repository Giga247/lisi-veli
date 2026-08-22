/**
 * ახალი პროექტის ფორმა — admin და მოდერატორისთვის.
 *
 * ფორმა ქმნის **დაუმტკიცებელ** პროექტს (`draft`). ვალდებულებები ამ წამს
 * არ ჩნდება: ისინი ადმინის დამტკიცებისას იქმნება, ერთ ტრანზაქციაში.
 * ამიტომ აქ შეცდომა იაფია — უარყოფილი პროექტი მეზობლების სიას არ ეხება.
 *
 * ნაკვეთების არჩევის სამი რეჟიმი — „ყველა", „ქუჩა", „ცალცალკე" — ერთი
 * ხეა და არა სამი კონტროლი: ქუჩის ჩექბოქსი მის ნაკვეთებს რთავს, ნაკვეთის
 * ცალკე მონიშვნა ქუჩის მდგომარეობას შუალედურზე (`indeterminate`) სვამს.
 * არჩევანი ყოველთვის ერთი სიაა — საკადასტრო კოდები.
 */
const ProjectForm = (function () {
  'use strict';

  const esc = function (v) { return WebLib.escapeHtml(v); };

  const NO_STREET = 'ქუჩის გარეშე';

  function byStreet(plots) {
    const groups = {};
    (plots || []).forEach(function (plot) {
      const street = String(plot.street || '').trim() || NO_STREET;
      (groups[street] = groups[street] || []).push(plot);
    });
    Object.keys(groups).forEach(function (street) {
      groups[street].sort(function (a, b) {
        const an = Number(a.num), bn = Number(b.num);
        if (isFinite(an) && isFinite(bn) && an !== bn) return an - bn;
        return String(a.cad) < String(b.cad) ? -1 : 1;
      });
    });
    return groups;
  }

  function plotLabel(plot) {
    const name = [plot.first_name, plot.last_name]
      .filter(function (part) { return part && String(part).trim(); }).join(' ');
    const where = plot.num ? '№' + plot.num : plot.cad;
    return name ? where + ' · ' + name : where;
  }

  function treeHtml(groups) {
    const streets = Object.keys(groups).sort();
    return streets.map(function (street) {
      const rows = groups[street];
      return '<details class="pf-street">' +
        '<summary>' +
        '<label class="pf-check"><input type="checkbox" data-street="' + esc(street) + '">' +
        '<span>' + esc(street) + '</span></label>' +
        '<span class="pf-count">' + rows.length + '</span>' +
        '</summary>' +
        '<ul class="pf-plots">' +
        rows.map(function (plot) {
          return '<li><label class="pf-check">' +
            '<input type="checkbox" data-cad="' + esc(plot.cad) + '" ' +
            'data-in-street="' + esc(street) + '">' +
            '<span>' + esc(plotLabel(plot)) + '</span></label></li>';
        }).join('') +
        '</ul></details>';
    }).join('');
  }

  function formHtml(groups) {
    return '<form class="pr-dialog-box pf-box">' +
      '<h3>ახალი პროექტი</h3>' +

      '<label class="pf-field">სახელი' +
      '<input name="name" type="text" required maxlength="120" ' +
      'placeholder="მაგ. ქუჩის განათება"></label>' +

      '<label class="pf-field">აღწერა' +
      '<textarea name="description" rows="4" maxlength="4000" ' +
      'placeholder="რას ვაკეთებთ და რატომ"></textarea></label>' +

      // ორივე რიცხვს `step="any"` განზრახ აქვს. `step="5"`-ს ბრაუზერი
      // ბადედ კითხულობს, რომელიც `min`-იდან იწყება — 1, 6, 11… — და
      // 100-საც კი უარყოფდა, ინგლისური შეტყობინებით, ფორმა კი ჩუმად
      // შეწყვეტდა გაგზავნას. დამრგვალება `roundToFive`-ს აქვს და
      // შედეგი ღილაკის ზემოთ, ჯამის სტრიქონში, ისედაც წერია.
      '<div class="pf-row">' +
      '<label class="pf-field">ბიუჯეტი (₾)' +
      '<input name="budget" type="number" min="0" step="any" inputmode="numeric" ' +
      'placeholder="სულ რა ღირს"></label>' +
      '<label class="pf-field">თანხა ოჯახიდან (₾)' +
      '<input name="amount" type="number" min="1" step="any" inputmode="numeric" required ' +
      'placeholder="ვინც რამდენს იხდის"></label>' +
      '</div>' +

      // ჩამოსაშლელი სია აქ ვერ იქნება: მომხმარებლების ნახვის უფლება
      // მხოლოდ ადმინს აქვს (RLS), პროექტს კი მოდერატორიც ქმნის.
      // მეილს ბაზა ამოწმებს — არარსებული ან დაუმტკიცებელი უარიყოფა
      // ქართული შეტყობინებით, ასე რომ ტიპო ჩუმად არ გაივლის.
      '<label class="pf-field">ხაზინდარი — მეილი (არასავალდებულო)' +
      '<input name="treasurer" type="email" autocomplete="off" ' +
      'placeholder="ვინც ფულს ჩაწერს"></label>' +

      '<label class="pf-field">ფოტოები' +
      '<input name="photos" type="file" accept="image/*" multiple></label>' +

      '<fieldset class="pf-select">' +
      '<legend>ვინ მონაწილეობს</legend>' +
      '<label class="pf-check pf-all"><input type="checkbox" data-all="1">' +
      '<span>ყველა ნაკვეთი</span></label>' +
      '<div class="pf-tree">' + treeHtml(groups) + '</div>' +
      '</fieldset>' +

      '<p class="pf-summary" aria-live="polite"></p>' +
      '<p class="pr-dialog-error" hidden></p>' +
      '<div class="pr-dialog-actions">' +
      '<button type="button" data-cancel="1">გაუქმება</button>' +
      '<button type="submit">შექმნა</button></div>' +
      '</form>';
  }

  /**
   * @param {Array}    plots      ყველა ნაკვეთი (`window.PLOTS`)
   * @param {Function} onCreated  გამოიძახება შექმნის შემდეგ, id-ით
   */
  function open(plots, onCreated) {
    const groups = byStreet(plots);
    const dialog = document.createElement('div');
    dialog.className = 'pr-dialog';
    dialog.innerHTML = formHtml(groups);
    document.body.appendChild(dialog);

    const form = dialog.querySelector('form');
    const errorBox = dialog.querySelector('.pr-dialog-error');
    const summary = dialog.querySelector('.pf-summary');
    const submit = form.querySelector('button[type="submit"]');
    const allBox = form.querySelector('[data-all]');
    const close = function () { dialog.remove(); };

    dialog.querySelector('[data-cancel]').addEventListener('click', close);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) close();
    });

    const cadBoxes = function () {
      return Array.prototype.slice.call(form.querySelectorAll('[data-cad]'));
    };
    const selected = function () {
      return cadBoxes().filter(function (box) { return box.checked; })
        .map(function (box) { return box.getAttribute('data-cad'); });
    };

    /** ქუჩისა და „ყველას" ჩექბოქსები ნაკვეთებს მიჰყვებიან, არა პირიქით. */
    function syncParents() {
      form.querySelectorAll('[data-street]').forEach(function (streetBox) {
        const street = streetBox.getAttribute('data-street');
        const rows = cadBoxes().filter(function (box) {
          return box.getAttribute('data-in-street') === street;
        });
        const on = rows.filter(function (box) { return box.checked; }).length;
        streetBox.checked = on === rows.length && rows.length > 0;
        streetBox.indeterminate = on > 0 && on < rows.length;
      });
      const total = cadBoxes().length;
      const on = selected().length;
      allBox.checked = on === total && total > 0;
      allBox.indeterminate = on > 0 && on < total;
    }

    function updateSummary() {
      const count = selected().length;
      const each = WebLib.roundToFive(form.elements.amount.value);
      summary.textContent = count === 0
        ? 'ნაკვეთი ჯერ არ არის არჩეული'
        : count + ' კომლი · ' + WebLib.money(each) + ' თითოეულს · სულ ' +
          WebLib.money(count * each);
    }

    form.addEventListener('change', function (event) {
      const target = event.target;
      if (target.hasAttribute('data-all')) {
        cadBoxes().forEach(function (box) { box.checked = target.checked; });
      } else if (target.hasAttribute('data-street')) {
        const street = target.getAttribute('data-street');
        cadBoxes().forEach(function (box) {
          if (box.getAttribute('data-in-street') === street) box.checked = target.checked;
        });
      } else if (!target.hasAttribute('data-cad')) {
        updateSummary();
        return;
      }
      syncParents();
      updateSummary();
    });
    form.addEventListener('input', function (event) {
      if (event.target.name === 'amount') updateSummary();
    });

    updateSummary();

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const cads = selected();
      const amount = WebLib.roundToFive(form.elements.amount.value);

      if (!String(form.elements.name.value).trim()) {
        return showError('პროექტის სახელი სავალდებულოა');
      }
      if (amount <= 0) return showError('თანხა ოჯახიდან დადებითი უნდა იყოს');
      if (cads.length === 0) return showError('ერთი ნაკვეთი მაინც აირჩიეთ');

      submit.disabled = true;
      submit.textContent = 'იქმნება…';
      errorBox.hidden = true;

      try {
        const created = await API.call('createProject', {
          name: form.elements.name.value,
          description: form.elements.description.value,
          budget: form.elements.budget.value,
          amount_per_household: amount,
          treasurer: form.elements.treasurer.value,
          cads: cads,
        });

        // ფოტოები პროექტის შექმნის შემდეგ იტვირთება — მათ project_id
        // სჭირდებათ. ერთის ჩავარდნა პროექტს არ აუქმებს: ის უკვე შექმნილია
        // და ფოტოს ცალკე დამატება მოგვიანებითაც შეიძლება.
        const files = Array.prototype.slice.call(form.elements.photos.files);
        const failed = [];
        for (let i = 0; i < files.length; i++) {
          submit.textContent = 'ფოტო ' + (i + 1) + '/' + files.length + '…';
          try {
            await API.uploadPhoto(created.id, files[i], i);
          } catch (photoError) {
            failed.push(files[i].name);
          }
        }

        close();
        if (failed.length) {
          UI.showError('პროექტი შეიქმნა, მაგრამ ვერ აიტვირთა: ' + failed.join(', '));
        }
        if (onCreated) onCreated(created.id);
      } catch (error) {
        showError(error.message || 'პროექტი ვერ შეიქმნა');
        submit.disabled = false;
        submit.textContent = 'შექმნა';
      }
    });

    function showError(message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }

    form.elements.name.focus();
  }

  return { open: open };
})();
