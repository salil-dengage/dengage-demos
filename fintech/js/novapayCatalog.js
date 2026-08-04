/* ============================================================================
   Dengage On-Site scenario catalog  |  NovaPay (FinTech demo)
   ----------------------------------------------------------------------------
   TWO EVENT CONTRACTS:

   1) Default Scenarios  -> the event name is the PREFIXED slug
      { event: 'fintech_<slug>', actionType: 'fintech_<slug>', category: 'Default Scenarios' }
      These 8 scenarios have no local code. They are built in the Dengage
      panel (BFSI account) with triggerBy = DATA_LAYER_EVENT and eventName
      equal to the prefixed slug (fintech_survey, ...), so NovaPay serves
      its own campaigns and its own creative.

   2) Every other group  -> a fintech-prefixed event name
      { event: 'fintech_<slug>', actionType: '<slug>', widgetName: '<name>',
        category: '<group>' }
      These have local code in this folder. The button fires the event AND
      runs the local function, so the demo works whether or not a matching
      scenario exists in the panel. The prefix keeps this site's events in
      their own namespace, next to banking_ and the CantuPneus events.
   ========================================================================== */

/* ----------------------------------------------------------------------------
   The scenario surface writes fintech_engagement_events, through the site's
   one event layer (js/novapayEvents.js) rather than calling the SDK here.

   It used to write fintech_onsite_events with its own five-column payload.
   That table is not in the model any more. A 200 means accepted; the row in
   Data Space is the only proof, so every event goes to a table the model
   actually defines.

   Going through NovaPayEvents also means these rows carry the same nine-column
   spine as every other table, so a segment can span the scenario surface and
   the money journey together.
---------------------------------------------------------------------------- */

/* SCENARIO EVENT PREFIX, ON since 31 July 2026.

   The eight Default Scenarios fire PREFIXED slugs (fintech_survey, ...) and
   are served by NovaPay's own campaigns, with the NovaPay creative written in
   fintech/panel-content/. The eight campaigns exist in the panel with these
   exact trigger names, and were confirmed rendering on 2 August 2026:

     fintech_survey            fintech_nps-popup      fintech_subscripton-popup
     fintech_stickey-bar       fintech_image-popup    fintech_image-bar
     fintech_horizonal-popup   fintech_cta-image-popup

   A scenario appears only if a campaign exists with that exact trigger name.
   A trigger that never fires is a campaign that is silently dark, so check
   the panel before suspecting this code.

   To put the eight back on the shared unprefixed campaigns, set this to ''
   again. One line. */
var SCENARIO_EVENT_PREFIX = 'fintech_';

/* Prefix for this site's own dataLayer events. The 8 Default Scenarios are
   exempt on purpose, see the note above. */
var EVENT_PREFIX = 'fintech_';

/* Sends the custom event that triggers the On-Site scenario configured in
   the panel. Silent, and never breaks the page if the SDK has not loaded. */
function sendScenarioEvent(item, menu) {
  if (!window.NovaPayEvents) {
    console.error('[novapay-catalog] event layer missing, scenario not recorded');
    return;
  }
  window.NovaPayEvents.engagement('scenario_triggered', {
    scenario_slug: (typeof SCENARIO_EVENT_PREFIX === 'string' && menu.mode === 'panel'
                     ? SCENARIO_EVENT_PREFIX : '') + item.slug,
    scenario_group: menu.category,
    widget_name: item.widgetName,
    channel: 'onsite',
    page_type: (document.body && document.body.dataset && document.body.dataset.pageType) || 'other',
    interaction: 'triggered'
  });
}

function novapayCatalog() {

  var ACCENT = '#125cfa';

  var menuData = [
    {
      title: 'Default Scenarios',
      category: 'Default Scenarios',
      icon: '📱',
      note: 'Built in the Dengage panel (BFSI account)',
      mode: 'panel',
      items: [
        { label: 'Survey',            widgetName: 'Survey',              slug: 'survey' },
        { label: 'NPS Popup',           widgetName: 'Nps Popup',           slug: 'nps-popup' },
        { label: 'Subscription Popup',  widgetName: 'Subscripton Popup',   slug: 'subscripton-popup' },
        { label: 'Sticky Bar',          widgetName: 'Stickey Bar',         slug: 'stickey-bar' },
        { label: 'Image Popup',     widgetName: 'Image Popup',         slug: 'image-popup' },
        { label: 'Image Bar',     widgetName: 'Image Bar',           slug: 'image-bar' },
        { label: 'Horizontal Popup',    widgetName: 'Horizonal Popup',     slug: 'horizonal-popup' },
        { label: 'CTA Image Popup', widgetName: 'CTA Image Popup',     slug: 'cta-image-popup' }
      ]
    },
    {
      title: 'Inline Scenarios',
      category: 'Inline Scenarios',
      icon: '📐',
      note: 'Injected inside the page content',
      items: [
        { label: 'Mega Banner',          widgetName: 'Mega Banner',       slug: 'mega-banner',       reveal: '#novapay-highlights-slider', fn: function () { window.showSliderBanner(); } },
        { label: 'Expand Banner',    widgetName: 'Expand Banner',     slug: 'expand-banner',     fn: function () { ExpandBanner(); } },
        { label: 'Head Banner',          widgetName: 'Head Banner',       slug: 'head-banner',       fn: function () { window.showHeadBanner(); } },
        { label: 'Notification Icon', widgetName: 'Notification Icon', slug: 'notification-icon', fn: function () { addIcon(); } }
      ]
    },
    {
      title: 'On-Site Scenarios',
      category: 'On Site Scenarios',
      icon: '🎯',
      note: 'Overlaid on the content, layout untouched',
      items: [
        /* earing.js and asistant.js publish their public API from inside
           earingWidget() / BottomAssistant(). Neither builder runs on page
           load, so the demo has to build the widget before opening it. Both
           builders guard against being run twice. */
        { label: 'Side Bar',      widgetName: 'Side Bar',         slug: 'side-bar',
          fn: function () {
            if (!window.EaringWidget) earingWidget();
            window.EaringWidget.open();
          } },
        { label: 'Bottom Assistant',widgetName: 'Bottom Assistant', slug: 'bottom-assistant',
          fn: function () {
            if (!window.openBottomAssistant) BottomAssistant();
            window.openBottomAssistant();
          } },
        { label: 'Carousel Banner',   widgetName: 'Carousel Banner',  slug: 'carousel-banner',  fn: function () { carouselBanner(); } }
      ]
    },
    {
      title: 'Gamification Scenarios',
      category: 'Gamification Scenarios',
      icon: '🎮',
      note: 'Engagement mechanics with prizes',
      items: [
        { label: 'Spin to Win', widgetName: 'Spin to Win',    slug: 'spin-to-win',    fn: function () { WheelGame(); } },
        { label: 'Scratch to Win',      widgetName: 'Scratch to Win', slug: 'scratch-to-win', fn: function () { ScratchGame(); } },
        { label: 'Santa Deer',      widgetName: 'Santa Deer',     slug: 'santa-deer',     fn: function () { SantaGame(); } },
        { label: 'Like Card',       widgetName: 'Like Card',      slug: 'like-card',      fn: function () { LikeCardGame(); } },
        { label: 'Snow',            widgetName: 'Snow',           slug: 'snow',           fn: function () { SnowStorm(); } }
      ]
    },
    {
      title: 'Product Recommendations',
      category: 'Recommendation Example',
      icon: '◆',
      note: 'Powered by the NovaPay product catalog',
      items: [
        { label: 'Classic Widget', widgetName: 'Classic Widget', slug: 'classic-widget', reveal: '#classicWidget', fn: function () { ClassicWidget(); } },
        { label: 'Banner Widget',   widgetName: 'Banner Widget',  slug: 'banner-widget',  reveal: '#bannerWidget', fn: function () { BannerWidget(); } },
        { label: 'Tab Widget',  widgetName: 'Tab Widget',     slug: 'tab-widget',     reveal: '#tabWidget', fn: function () { TabWidget(); } },
        { label: 'Sidebar Widget',  widgetName: 'SideBar Widget', slug: 'sidebar-widget', fn: function () { SideBarWidget(); } },
        { label: 'Popup Widget',    widgetName: 'Popup Widget',   slug: 'popup-widget',   fn: function () { PopupWidget(); } }
      ]
    }
  ];

  /* ------------------------------------------------------------ sticky icon */
  var stickyIcon = document.createElement('div');
  stickyIcon.id = 'sticky-icon';
  stickyIcon.setAttribute('role', 'button');
  stickyIcon.setAttribute('tabindex', '0');
  stickyIcon.setAttribute('aria-label', 'Open the Dengage scenario catalog');
  stickyIcon.innerHTML = '<img src="vendor/assets/dengage-icon.png" alt="" style="width:32px;height:32px;object-fit:contain;filter:brightness(0) invert(1);" />';
  stickyIcon.style.cssText =
    'position:fixed;bottom:30px;right:30px;width:70px;height:70px;' +
    'background:linear-gradient(135deg,#125cfa 0%,#0d4bc4 50%,#0a3a9e 100%);' +
    'border-radius:20px;display:flex;align-items:center;justify-content:center;color:#fff;' +
    'cursor:pointer;z-index:1200;transition:all .4s cubic-bezier(.175,.885,.32,1.275);' +
    'user-select:none;border:1px solid rgba(255,255,255,.2);' +
    'box-shadow:0 8px 32px rgba(18,92,250,.3),inset 0 1px 0 rgba(255,255,255,.2);';
  stickyIcon.addEventListener('mouseenter', function () { this.style.transform = 'scale(1.15) translateY(-5px)'; });
  stickyIcon.addEventListener('mouseleave', function () { this.style.transform = 'scale(1) translateY(0)'; });

  /* ---------------------------------------------------------------- drawer */
  var modal = document.createElement('div');
  modal.id = 'sticky-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Dengage Catalog');
  modal.style.cssText =
    'position:fixed;top:0;right:-450px;width:450px;height:100vh;background:#fff;' +
    'z-index:1201;transition:right .5s cubic-bezier(.25,.46,.45,.94);overflow-y:auto;' +
    'box-sizing:border-box;box-shadow:-20px 0 60px rgba(0,0,0,.18);' +
    "font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif;";

  var header = document.createElement('div');
  header.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;padding:26px 30px 18px;' +
    'background:linear-gradient(135deg,rgba(18,92,250,.1) 0%,rgba(10,58,158,.1) 100%);' +
    'border-bottom:1px solid rgba(18,92,250,.12);position:sticky;top:0;z-index:2;backdrop-filter:blur(10px);';

  var title = document.createElement('h2');
  title.textContent = 'Dengage Catalog';
  title.style.cssText =
    'margin:0;font-weight:700;font-size:23px;letter-spacing:-.5px;' +
    'background:linear-gradient(135deg,#125cfa 0%,#0a3a9e 100%);' +
    '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';

  var closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close catalog');
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  closeBtn.style.cssText =
    'background:linear-gradient(135deg,#ff6b6b 0%,#ee5a52 100%);color:#fff;border:none;' +
    'width:40px;height:40px;border-radius:12px;cursor:pointer;display:flex;align-items:center;' +
    'justify-content:center;box-shadow:0 4px 15px rgba(255,107,107,.3);transition:transform .3s;';
  closeBtn.addEventListener('mouseenter', function () { this.style.transform = 'scale(1.1)'; });
  closeBtn.addEventListener('mouseleave', function () { this.style.transform = 'scale(1)'; });

  header.appendChild(title);
  header.appendChild(closeBtn);

  var counter = document.createElement('p');
  counter.style.cssText = 'margin:0;padding:12px 30px;font-size:12px;line-height:1.5;color:#64748b;background:rgba(18,92,250,.04);border-bottom:1px solid rgba(18,92,250,.08);';
  var total = menuData.reduce(function (n, m) { return n + m.items.length; }, 0);
  counter.textContent = total + ' On-Site scenarios. Each button pushes the event to the dataLayer with the slug shown.';

  /* ---------------------------------------------------------- push opt-in
     O SDK registra o service worker e cria a inscrição quando alguém pede a
     permissão. Com "Show Permission Prompt on page load" desligado no painel,
     o opt-in acontece sob demanda.

     Este botão pede a permissão na hora, que numa demonstração é melhor
     do que o prompt automático: dá para mostrar o opt-in ao vivo.
  --------------------------------------------------------------------- */
  var pushRow = document.createElement('div');
  pushRow.style.cssText =
    'margin:0 30px 4px;padding:14px 16px;border:1px solid rgba(18,92,250,.25);' +
    'border-radius:12px;background:rgba(18,92,250,.06);display:flex;' +
    'align-items:center;justify-content:space-between;gap:12px;';

  var pushLabel = document.createElement('span');
  pushLabel.style.cssText = 'font-size:13px;font-weight:600;color:#2d3748;';

  var pushBtn = document.createElement('button');
  pushBtn.style.cssText =
    'background:' + ACCENT + ';color:#fff;border:none;padding:9px 16px;border-radius:8px;' +
    'cursor:pointer;font-size:12px;font-weight:600;flex-shrink:0;';

  function permissionState() {
    try { return (window.Notification && Notification.permission) || 'unsupported'; }
    catch (e) { return 'unsupported'; }
  }

  function paintPush() {
    var state = permissionState();
    if (state === 'granted') {
      pushLabel.textContent = 'Push notifications enabled';
      pushBtn.textContent = 'Test';
      pushBtn.disabled = false;
    } else if (state === 'denied') {
      pushLabel.textContent = 'Notifications blocked in the browser';
      pushBtn.textContent = 'Blocked';
      pushBtn.disabled = true;
      pushBtn.style.opacity = '.5';
      pushBtn.style.cursor = 'not-allowed';
    } else {
      pushLabel.textContent = 'Push notifications';
      pushBtn.textContent = 'Enable';
      pushBtn.disabled = false;
    }
  }

  pushBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (typeof window.dengage !== 'function') {
      console.warn('Dengage SDK has not loaded yet.');
      return;
    }
    if (permissionState() === 'granted') {
      /* já concedida: mostra o estado atual da inscrição no console */
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        console.log('Service workers registrados:', regs.length,
                    regs.map(function (r) { return r.scope; }));
      });
      window.dengage('getDeviceId', function (id) { console.log('deviceId:', id); });
      return;
    }
    /* A aplicação já tem o prompt customizado da Dengage configurado
       (conteúdo, botões Allow / No Thanks, cores e logo). Ele só não aparece
       sozinho porque "Show Permission Prompt on page load" está desligado no
       painel. showCustomPrompt() abre exatamente esse prompt, e ao aceitar o
       SDK pede a permissão nativa, registra o worker e assina.

       O prompt nativo do navegador entra em seguida caso a permissão
       continue pendente, para o botão sempre concluir o fluxo. */
    var handled = false;
    function report(state) {
      if (handled) return;
      handled = true;
      console.log('Notification.permission ->', state);
      if (state !== 'granted') { paintPush(); return; }
      setTimeout(function () {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          console.log('service workers:', regs.length,
                      regs.map(function (r) { return r.scope; }));
          regs.forEach(function (r) {
            r.pushManager.getSubscription().then(function (sub) {
              console.log('subscription:', sub ? sub.endpoint : 'NENHUMA');
            });
          });
        });
        paintPush();
      }, 2500);
    }

    try {
      window.dengage('showCustomPrompt');
    } catch (err) {
      console.warn('showCustomPrompt unavailable:', err);
    }

    /* o prompt da Dengage é assíncrono; depois de alguns segundos o fluxo
       segue para o prompt nativo se a permissão continuar pendente */
    setTimeout(function () {
      if (handled) return;
      if (permissionState() !== 'default') { report(permissionState()); return; }
      console.log('Opening the browser permission prompt.');
      try {
        var res = Notification.requestPermission(report);
        if (res && typeof res.then === 'function') res.then(report);
      } catch (e) {
        console.error('requestPermission falhou:', e);
      }
    }, 6000);
  });

  paintPush();
  pushRow.appendChild(pushLabel);
  pushRow.appendChild(pushBtn);

  /* ----------------------------------------------------- reset de exibições
     Este botão limpa o histórico de exibição das campanhas On-Site deste
     visitante e recarrega, para repetir cenários sem limpar cache e cookies.
     deviceId, contactKey e inscrição push ficam intactos.

     Não remova: necessário para o comportamento correto com esta versão do
     SDK. Contexto: Salil.
  --------------------------------------------------------------------- */
  var resetRow = document.createElement('div');
  resetRow.style.cssText = pushRow.style.cssText;
  resetRow.style.marginTop = '10px';

  var resetLabel = document.createElement('span');
  resetLabel.style.cssText = pushLabel.style.cssText;
  resetLabel.textContent = 'Repeat scenarios without clearing the browser';

  var resetBtn = document.createElement('button');
  resetBtn.style.cssText = pushBtn.style.cssText;
  resetBtn.textContent = 'Reset displays';

  function scrubVisitor(v) {
    if (!v || typeof v !== 'object') return v;
    delete v.lastOnsitePopupDisplayTime;
    v.onsiteMessageHistories = {};
    v.onsiteABContentIds = {};
    return v;
  }

  resetBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    resetBtn.disabled = true;
    resetBtn.textContent = 'Clearing...';

    /* espelho em localStorage */
    try {
      var mirror = JSON.parse(localStorage.getItem('_dn_visitors'));
      if (mirror) localStorage.setItem('_dn_visitors', JSON.stringify(scrubVisitor(mirror)));
    } catch (err) { /* segue */ }
    try { localStorage.removeItem('_dn_show'); } catch (err) { /* segue */ }

    var reloaded = false;
    function done() {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    }
    /* rede de segurança: recarrega mesmo se o IndexedDB travar */
    setTimeout(done, 2500);

    try {
      if (!window.indexedDB || !indexedDB.databases) return done();
      indexedDB.databases().then(function (dbs) {
        var name = (dbs || []).map(function (d) { return d && d.name; })
          .filter(Boolean)
          .find(function (n) { return n.indexOf('Dengage ') === 0; });
        if (!name) return done();
        var rq = indexedDB.open(name);
        rq.onerror = done;
        rq.onsuccess = function () {
          var db = rq.result;
          try {
            var tx = db.transaction('visitors', 'readwrite');
            var cur = tx.objectStore('visitors').openCursor();
            cur.onsuccess = function (ev) {
              var c = ev.target.result;
              if (!c) return;
              c.update(scrubVisitor(c.value));
              c['continue']();
            };
            tx.oncomplete = function () { db.close(); done(); };
            tx.onabort = tx.onerror = function () { db.close(); done(); };
          } catch (err) { db.close(); done(); }
        };
      })['catch'](done);
    } catch (err) {
      done();
    }
  });

  resetRow.appendChild(resetLabel);
  resetRow.appendChild(resetBtn);

  var menuContainer = document.createElement('div');
  menuContainer.style.cssText = 'display:flex;flex-direction:column;gap:18px;padding:22px 30px 40px;';

  menuData.forEach(function (menu) {
    var wrapper = document.createElement('div');
    wrapper.style.cssText =
      'border:1px solid rgba(0,0,0,.1);border-radius:16px;overflow:hidden;background:#f8f9fa;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.08);transition:box-shadow .2s ease;';

    var mHeader = document.createElement('div');
    mHeader.setAttribute('role', 'button');
    mHeader.setAttribute('tabindex', '0');
    mHeader.style.cssText =
      'background:linear-gradient(135deg,#125cfa 0%,#0d4bc4 50%,#0a3a9e 100%);color:#fff;' +
      'padding:18px 20px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-weight:600;';
    mHeader.innerHTML =
      '<span style="display:flex;align-items:center;gap:12px">' +
        '<span style="font-size:20px">' + menu.icon + '</span>' +
        '<span><span style="font-size:16px;letter-spacing:-.3px">' + menu.title +
        ' <span style="opacity:.7;font-weight:500">(' + menu.items.length + ')</span></span>' +
        '<small style="display:block;font-size:11px;font-weight:400;opacity:.85;margin-top:1px">' + menu.note + '</small></span>' +
      '</span>' +
      '<span class="tg" style="transition:transform .2s;width:24px;height:24px;background:rgba(255,255,255,.3);border-radius:6px;display:flex;align-items:center;justify-content:center">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</span>';

    var content = document.createElement('div');
    content.style.cssText = 'max-height:0;overflow:hidden;transition:max-height .3s ease;background:#fff;';

    var list = document.createElement('div');
    list.style.cssText = 'padding:18px;display:flex;flex-direction:column;gap:10px;';

    menu.items.forEach(function (item) {
      var row = document.createElement('div');
      row.style.cssText =
        'display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;' +
        'background:#fff;border:1px solid #e0e0e0;border-radius:12px;transition:transform .15s ease,box-shadow .15s ease;';

      var label = document.createElement('span');
      label.innerHTML =
        '<span style="display:block;color:#2d3748;font-weight:600;font-size:14px;letter-spacing:-.2px">' + item.label + '</span>' +
        '<small style="display:block;font-size:10.5px;font-weight:500;color:#8b95a5;font-family:ui-monospace,Menlo,monospace;margin-top:2px">' +
        (menu.mode === 'panel'
           ? 'event: ' + SCENARIO_EVENT_PREFIX + item.slug
           : item.slug) + '</small>';

      var btn = document.createElement('button');
      btn.textContent = 'Show';
      btn.style.cssText =
        'background:linear-gradient(135deg,' + ACCENT + ' 0%,' + ACCENT + 'dd 100%);color:#fff;border:none;' +
        'padding:9px 18px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;flex-shrink:0;' +
        'box-shadow:0 4px 15px ' + ACCENT + '40;transition:transform .3s;';

      row.addEventListener('mouseenter', function () { this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 8px 25px rgba(0,0,0,.12)'; });
      row.addEventListener('mouseleave', function () { this.style.transform = 'translateY(0)'; this.style.boxShadow = 'none'; });
      btn.addEventListener('mouseenter', function () { this.style.transform = 'scale(1.05)'; });
      btn.addEventListener('mouseleave', function () { this.style.transform = 'scale(1)'; });

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.dataLayer = window.dataLayer || [];

        /* Custom event for the Dengage SDK. This is what triggers On-Site
           scenarios built in the panel, matched on event_name. It runs for
           all 25 buttons, so any of them can be given a panel scenario,
           not only the 8 defaults. */
        sendScenarioEvent(item, menu);

        if (menu.mode === 'panel') {
          /* Default Scenarios: the event name is the PREFIXED slug. It was the
             bare slug until 1 Aug 2026, left behind when the prefix was flipped
             on, so all eight campaigns were dark: the panel had fintech_survey
             and the page pushed survey. Nothing errors when this is wrong,
             which is exactly why review.js now asserts the name. */
          window.dataLayer.push({
            event: SCENARIO_EVENT_PREFIX + item.slug,
            actionType: SCENARIO_EVENT_PREFIX + item.slug,
            category: menu.category
          });
        } else {
          window.dataLayer.push({
            event: EVENT_PREFIX + item.slug,
            actionType: item.slug,
            widgetName: item.widgetName,
            category: menu.category
          });
          /* local execution, so the demo works with no panel scenario */
          if (typeof item.fn === 'function') {
            setTimeout(function () {
              try { item.fn(); }
              catch (err) { console.error('Widget ' + item.slug + ' failed:', err); return; }
              /* Widgets injected into the page body can land outside the
                 viewport. Without this the presenter clicks and nothing
                 appears to happen. */
              if (item.reveal) {
                setTimeout(function () {
                  var el = document.querySelector(item.reveal);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
              }
            }, 380);
          }
        }

        setTimeout(closeModal, 300);
      });

      row.appendChild(label);
      row.appendChild(btn);
      list.appendChild(row);
    });

    content.appendChild(list);

    var open = false;
    function toggle() {
      open = !open;
      content.style.maxHeight = open ? content.scrollHeight + 'px' : '0';
      mHeader.querySelector('.tg').style.transform = open ? 'rotate(180deg)' : 'rotate(0)';
      wrapper.style.boxShadow = open ? '0 4px 12px rgba(0,0,0,.12)' : '0 2px 8px rgba(0,0,0,.08)';
    }
    mHeader.addEventListener('click', toggle);
    mHeader.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    wrapper.appendChild(mHeader);
    wrapper.appendChild(content);
    menuContainer.appendChild(wrapper);
  });

  modal.appendChild(header);
  modal.appendChild(counter);
  modal.appendChild(pushRow);
  modal.appendChild(resetRow);
  modal.appendChild(menuContainer);

  var overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);z-index:1200;' +
    'opacity:0;visibility:hidden;transition:all .4s cubic-bezier(.25,.46,.45,.94);';

  function openModal() {
    modal.style.right = '0';
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    stickyIcon.style.opacity = '0';
    stickyIcon.style.pointerEvents = 'none';
    closeBtn.focus();
  }
  function closeModal() {
    modal.style.right = window.innerWidth < 768 ? '-100%' : '-450px';
    overlay.style.opacity = '0';
    overlay.style.visibility = 'hidden';
    stickyIcon.style.opacity = '1';
    stickyIcon.style.pointerEvents = 'auto';
  }

  stickyIcon.addEventListener('click', openModal);
  stickyIcon.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); }
  });
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.style.right === '0px') closeModal();
  });

  document.body.appendChild(stickyIcon);
  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  function handleResize() {
    if (window.innerWidth < 768) {
      modal.style.width = '100%';
      if (modal.style.right !== '0px') modal.style.right = '-100%';
    } else {
      modal.style.width = '450px';
      if (modal.style.right !== '0px') modal.style.right = '-450px';
    }
  }
  window.addEventListener('resize', handleResize);
  handleResize();
}

novapayCatalog();
