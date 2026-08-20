const UI = (function () {

  function el(id) { return document.getElementById(id); }

  function showTab(name) {
    ['table', 'map', 'admin'].forEach(function (tab) {
      const panel = el('panel-' + tab);
      const button = el('tab-' + tab);
      if (!panel || !button) return;
      panel.hidden = (tab !== name);
      button.classList.toggle('active', tab === name);
    });
    if (name === 'map' && window.MapView) MapView.refresh();
  }

  function showError(message) {
    const box = el('error-box');
    box.textContent = message;
    box.hidden = false;
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.hidden = true; }, 6000);
  }

  function showScreen(name) {
    ['loading', 'signin', 'pending', 'app'].forEach(function (screen) {
      el('screen-' + screen).hidden = (screen !== name);
    });
  }

  return { el: el, showTab: showTab, showError: showError, showScreen: showScreen };
})();
