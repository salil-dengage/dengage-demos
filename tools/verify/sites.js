/* ============================================================================
   Per-site configuration for the verification suites.

   Every suite takes a site name as its first argument:

       node tools/verify/review.js fintech

   The point of this file is that the four demo sites are the same machinery
   with different brand namespaces, catalogues and copy. Element ids and CSS
   classes are namespaced per site on purpose (so the sites cannot collide in
   one browser), which means a suite cannot hard-code "#cantupneus-...". It
   reads the namespace from here instead.

   BASE assumes a static server rooted at the REPOSITORY root, e.g.
       cd <repo> && python3 -m http.server 8101
   ========================================================================== */
const ROOT = process.env.BASE_URL || 'http://localhost:8101';

/* ---------------------------------------------------------------------------
   Word lists for the rendered-copy sweep (ptsweep.js).

   Accent-independent on purpose: the leaks we actually hit were unaccented
   ("Mais vendido"), and a first pass that only looked for accented characters
   missed them.
--------------------------------------------------------------------------- */
const PT_WORDS = 'Adicionar|carrinho|Fechar|Abrir|Enviar|Pesquisa|Ofertas?|Linha|Carga|Passeio|'
    + 'Diminuir|Aumentar|quantidade|Esgotado|Remover|Favoritos?|Salvar|Salvo|Buscar|Busque|'
    + 'Limpar|Comprar|Continuar|Entrar|Cadastr[ao]|Senha|Sobrenome|Obrigado|Encontrado|'
    + 'restam|dispon[íi]vel|indispon[íi]vel|detalhes|marca|'
    + 'Agr[íi]cola|medidas?|pneus?|Frete|gr[áa]tis|estoque|pedido|consultor|Veja|Fale|Falar|'
    + 'Voc[êe]|Semana|Carreteiro|Destaques?|Cupom|Gire|Raspe|Ganhe|ganhou|Salvar|salvo|'
    + 'In[íi]cio|Voltar|Institucional|Nossa|Senha|Sobrenome|Bem-vindo|Simule|Simula[çc][ãa]o|'
    + 'Monte|Confira|Pr[ée]via|Indispon[íi]vel|Disponibilidade|Constru[çc][ãa]o|'
    + 'Notifica[çc][õo]es|Resetar|exibi[çc][õo]es|Cen[áa]rios?|Cat[áa]logo|Assine|Novidade|'
    + 'filial|vendido|vendidos|Selecionado|Recomendado|Personalizado|semelhantes|'
    // launcher chrome: 'Exibir' sat untranslated on the EN site from the day it
    // was forked, because the sweep list only covered storefront copy.
    + 'Exibir|Painel|Ativar|Testar|Bloqueado|Limpando|Cen[aá]rio|'
    // Spin to Win chrome. The prize wheel shipped Portuguese on all five sites
    // and no sweep saw it, because the labels are baked into an SVG served as
    // an <img> and ptsweep only reads rendered text.
    + 'Girar|Parab[ée]ns|Copiar|Copiado|cumulativa|promo[çc][õo]es';

// English-only signals, for sweeping the pt-BR site in the other direction.
// Kept conservative on purpose: brand names (Marshal, Aeolus, CEAT, Kumho),
// technical tokens (SKU, OTR, API, SDK, WhatsApp, Pix) and anything spelled the
// same in both languages are excluded, so a hit is always a real leak.
const EN_WORDS = 'Close|Open|Add to cart|Add to|Remove|Removed|Search|Save[d]?|Wishlist|'
    + 'Decrease|Increase|Quantity|Sold Out|In stock|Unavailable|View details|'
    + 'Availability|Construction|Back to|Purchase|successful|empty|'
    + 'available|Submit|Thanks|Welcome|Sign up|Create account|Password|'
    + 'Last name|First name|Your cart|Nothing|left|results?\\b|Clear list|'
    + 'Saved items|work email|Send|Try|talk to|'
    // Spin to Win chrome, which was hard-coded English on all three sites.
    + 'Congratulations|Copied|Copy Code|Spin Now|cannot be combined|promotions';

// Russian is the only Cyrillic set, so one script class catches a leak of it
// into any Latin-script site without needing a word list at all.
const RU_WORDS = '[\\u0400-\\u04FF]{2,}';

const TYRE_WORDS = 'CantuPneus|tyres?|tires?|[Tt]ruck|[Tt]rucker|freight|lug|retread|tractor|'
    + 'forklift|OTR|Marshal|Aeolus|CEAT|Kumho|SpeedMax|Itaro|DOT';

const SITES = {
    'cantu-pneus': {
        scenarioPrefix: 'br_',   // live, the br_ campaigns exist in the panel
        launcherButton: 'Exibir',    // the scenario launcher's per-card button label
        tracksStock: true,   // this catalogue carries a real stock figure per product
        path: '/cantu-pneus',
        ns: 'cantupneus',            // element-id / class namespace
        launcherIcon: '#sticky-icon',
        productId: 'CNT-CRG-29580-HN08',
        featuredId: 'CNT-CRG-29580-KLD01',
        currency: 'BRL',
        eventPrefix: '',             // original site: widget events use 'dengage'
        /* The three CantuPneus sites push a LITERAL event:'dengage' for the
           local widgets, with the slug in actionType. Banking and FinTech push
           <prefix><slug> as the event instead. review.js has to know which,
           or it reads a correct site as broken. */
        localWidgetEvent: 'dengage',
        customTable: 'events',
        onsiteTable: 'onsite_events',
        lang: 'pt',
        panel: {
            product:  { id: 'CNT-CRG-29580-KLD01', price: 2090, discounted: 1890, stock: 12,
                        categoryPath: 'Pneus > Carga > Borrachudo', promotionId: 'OFERTA-DA-SEMANA' },
            category: { id: 'LINHA-CARGA', path: 'Pneus > Carga' },
            cart:     { id: 'CNT-CRG-29580-HN08', qty: 2, unit: 1890, discounted: 1740 },
            wishlist: { id: 'CNT-AGR-1834-R1W', list: 'medidas-favoritas', price: 3980, stock: 6 },
            order:    { idPattern: '^ORD-\\d+$', itemCount: 2, total: 3780,
                        payment: 'credit_card', shipping: 'frete_cif', coupon: 'FROTA10' },
            customEvents: ['advisor_appointment', 'full_load_quote'],
        },
        /* Swept in REVERSE: this site is Portuguese, so ENGLISH is what must
           not appear. It ran unswept for a long time and had real leaks,
           "Decrease quantity", "Unavailable", "Your cart is empty". */
        sweep: { enabled: true, forbid: EN_WORDS + '|' + RU_WORDS, direction: 'en-in-pt' },
    },
    'cantu-pneus-en': {
        scenarioPrefix: 'en_',   // live, the en_ campaigns exist in the panel
        launcherButton: 'Show',
        tracksStock: true,   // this catalogue carries a real stock figure per product
        path: '/cantu-pneus/en',
        ns: 'cantupneus',
        launcherIcon: '#sticky-icon',
        productId: 'CNT-CRG-29580-HN08',
        featuredId: 'CNT-CRG-29580-KLD01',
        currency: 'BRL',
        eventPrefix: '',
        localWidgetEvent: 'dengage',   // see cantu-pneus above
        customTable: 'events',
        onsiteTable: 'onsite_events',
        lang: 'en',
        panel: {
            product:  { id: 'CNT-CRG-29580-KLD01', price: 2090, discounted: 1890, stock: 12,
                        categoryPath: 'Tires > Truck > Lug', promotionId: 'OFFER-OF-THE-WEEK' },
            category: { id: 'TRUCK-LINE', path: 'Tires > Truck' },
            cart:     { id: 'CNT-CRG-29580-HN08', qty: 2, unit: 1890, discounted: 1740 },
            wishlist: { id: 'CNT-AGR-1834-R1W', list: 'favorite-sizes', price: 3980, stock: 6 },
            order:    { idPattern: '^ORD-\\d+$', itemCount: 2, total: 3780,
                        payment: 'credit_card', shipping: 'cif_freight', coupon: 'FROTA10' },
            customEvents: ['advisor_appointment', 'full_load_quote'],
        },
        /* English copy of a Portuguese site: the sweep exists to catch
           untranslated strings, so it only forbids Portuguese. */
        sweep: { enabled: true, forbid: PT_WORDS + '|' + RU_WORDS },
    },
    'cantu-pneus-ru': {
        scenarioPrefix: 'ru_',   // live, the ru_ campaigns exist in the panel
        launcherButton: '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c',
        tracksStock: true,   // this catalogue carries a real stock figure per product
        path: '/cantu-pneus/ru',
        ns: 'cantupneus',
        launcherIcon: '#sticky-icon',
        productId: 'CNT-CRG-29580-HN08',
        featuredId: 'CNT-CRG-29580-KLD01',
        currency: 'BRL',
        eventPrefix: '',
        localWidgetEvent: 'dengage',   // see cantu-pneus above
        customTable: 'events',
        onsiteTable: 'onsite_events',
        lang: 'ru',
        panel: {
            product:  { id: 'CNT-CRG-29580-KLD01', price: 2090, discounted: 1890, stock: 12,
                        categoryPath: '\u0428\u0438\u043d\u044b > \u0413\u0440\u0443\u0437\u043e\u0432\u044b\u0435 > \u0401\u043b\u043e\u0447\u043a\u0430', promotionId: 'PREDLOZHENIE-NEDELI' },
            category: { id: 'LINEYKA-GRUZOVYE', path: '\u0428\u0438\u043d\u044b > \u0413\u0440\u0443\u0437\u043e\u0432\u044b\u0435' },
            cart:     { id: 'CNT-CRG-29580-HN08', qty: 2, unit: 1890, discounted: 1740 },
            wishlist: { id: 'CNT-AGR-1834-R1W', list: 'izbrannye-tiporazmery', price: 3980, stock: 6 },
            order:    { idPattern: '^ORD-\\d+$', itemCount: 2, total: 3780,
                        payment: 'credit_card', shipping: 'dostavka_cif', coupon: 'FROTA10' },
            customEvents: ['advisor_appointment', 'full_load_quote'],
        },
        /* Russian copy of a Portuguese site: forbid both of the other two, so a
           string left behind in either language is caught. */
        sweep: { enabled: true, forbid: PT_WORDS + '|' + EN_WORDS },
    },
    fintech: {
        // live since 31 Jul 2026: NovaPay serves its own creative from the
        // fintech_ campaigns instead of sharing the banking demo's
        scenarioPrefix: 'fintech_',
        launcherButton: 'Show',
        path: '/fintech',
        ns: 'novapay',
        launcherIcon: '#sticky-icon',
        productId: 'NPY-CRD-PLUS',
        featuredId: 'NPY-CRD-METAL',
        currency: 'USD',
        eventPrefix: 'fintech_',
        customTable: 'fintech_events',
        onsiteTable: 'fintech_onsite_events',
        lang: 'en',
        /* The logged-in money app. Sites without one skip appevents.js, which
           is why this is a config value and not a list inside the suite. */
        appSurface: 'app.html',
        /* app.html is gated by js/novapayGate.js since 1 Aug 2026: no session,
           no portal. Any suite that opens it must seed the session first or it
           silently ends up measuring the landing page. seedSession() in this
           file is the one way to do that. */
        sessionSeed: {
            store: 'novapay_user',
            value: { firstName: 'Alex', lastName: 'Morgan',
                     email: 'alex@example.com' },
        },
        /* What gatetest.js drives. The portal is closed, "Open account" opens
           a Dengage lead form instead of the portal, and signing in is the
           only way through. */
        gate: {
            surface: 'app.html',
            bounceTo: 'index.html?signin=1',
            blockedEvent: 'fintech_portal_gate_blocked',
            intentEvent: 'fintech_open_account_intent',
            openAccount: '[data-open-account]',
            formActive: '#loginModal.active',
            submit: '.login-submit-btn',
            fill: {
                '#loginFirstName': 'Alex',
                '#loginLastName': 'Morgan',
                /* deliberately NOT salil@dengage.com: that resolves to the
                   salil-demo contact key, and CLAUDE.md 5 forbids test traffic
                   landing on Salil's own contact. */
                '#loginEmail': 'alex@example.com',
                '#loginPassword': 'pw123456',
            },
        },
        /* No cart, no search panel, no saved-items drawer. All three are
           ecommerce features that write the standard tables through ec:*, and
           this site does not use the ecommerce API. searchwishtest.js reads
           this to skip the site, while still checking that the four shared
           modules stay byte-identical here. */
        ecommerceUi: false,
        /* The event panel fires no ec:* call either. Its eight cards write
           page_view_events twice and the fintech_* tables six times, so
           modaltest's ecommerce-funnel assertions are stale here rather than
           failing. The panel IS covered: appevents.js opens it, fires every
           card, and asserts both that no ec:* call is made and that every
           table written exists in the model. Same arrangement Banking uses. */
        usesEcommerceFunnel: false,
        /* Inline On-Site content for the account portal, and which slot each
           file targets. inlinetest.js injects them the way the SDK does and
           checks they leave the host page alone. Lives here rather than in the
           suite because the slot map is per-site data. */
        inlineContent: {
            dir: 'fintech/panel-content/inline',
            /* Slot AND page, since the portal became five pages on 2 Aug 2026.
               A file whose page is wrong would be injected into a page that
               does not carry its slot, and the suite would report a missing
               target rather than the real mistake. */
            slots: {
                'salary-landed.html':
                    { page: 'money.html', slot: 'dn_inline_target_portal_below_balance' },
                'travel-spender.html':
                    { page: 'money.html', slot: 'dn_inline_target_portal_money_top' },
                'subscription-detected.html':
                    { page: 'money.html', slot: 'dn_inline_target_portal_subscriptions' },
                'goal-in-reach.html':
                    { page: 'grow.html', slot: 'dn_inline_target_in_grid' },
                'credit-score-up.html':
                    { page: 'app.html', slot: 'dn_inline_target_above_footer' },
            },
        },
        /* The portal, one page per view. Every one is gated, so anything that
           opens them needs seedSession() first. */
        portalPages: ['app.html', 'money.html', 'cards.html', 'grow.html', 'products.html'],
        /* mobile.js measures these on top of index and product. */
        mobilePages: ['money.html', 'cards.html', 'grow.html', 'products.html'],
        /* What portaltest.js drives. `always` fires in the demo's default
           state; `conditional` belongs to the page but needs a state change
           first (balance is 2,480, the seed card is activated, the goals sit
           at 38% and 15%). The property that matters is that a page fires
           NOTHING belonging to another page: that is what makes each campaign
           demonstrable on its own without touching the panel. */
        portal: {
            'app.html': { view: 'home',
                always: ['fintech_kyc_incomplete', 'fintech_credit_score_up'],
                conditional: [],
                slots: ['dn_inline_target_below_header',
                        'dn_inline_target_portal_below_balance',
                        'dn_inline_target_above_footer'] },
            'money.html': { view: 'money',
                always: ['fintech_salary_landed', 'fintech_travel_spender',
                         'fintech_subscription_detected', 'fintech_fx_unused'],
                conditional: ['fintech_low_balance'],
                slots: ['dn_inline_target_portal_below_balance',
                        'dn_inline_target_portal_money_top',
                        'dn_inline_target_portal_subscriptions'] },
            'cards.html': { view: 'cards',
                always: [], conditional: ['fintech_card_dormant'], slots: [] },
            'grow.html': { view: 'grow',
                always: ['fintech_idle_cash'], conditional: ['fintech_goal_in_reach'],
                slots: ['dn_inline_target_in_grid'] },
            'products.html': { view: 'products',
                always: [], conditional: [], slots: ['dn_inline_target_in_grid'] },
        },
        /* dn_inline_target_in_grid used to sit inside the shoppable product
           grid. That grid is gone, so the slot lives in the grid that replaced
           it. slottest.js reads the parent from here rather than assuming
           every site calls it productGrid. */
        inGridParent: 'novapayLeadGrid',
        /* The Big Data tables this site writes, specified in
           fintech/EVENT-MODEL.md and created by hand in the panel. The suite
           reads them from here so a rename is a one-line change, not a hunt
           through assertions. */
        tables: {
            onboarding:  'fintech_onboarding_events',
            account:     'fintech_account_events',
            transaction: 'fintech_transaction_events',
            card:        'fintech_card_events',
            savings:     'fintech_savings_events',
            investment:  'fintech_investment_events',
            credit:      'fintech_credit_events',
            product:     'fintech_product_events',
            support:     'fintech_support_events',
            engagement:  'fintech_engagement_events',
        },
        panel: {
            product:  { id: 'NPY-CRD-METAL', price: 299, discounted: 240, stock: 1,
                        categoryPath: 'Products > Cards > Premium', promotionId: 'LAUNCH-HALF-PRICE' },
            category: { id: 'CARDS', path: 'Products > Cards' },
            cart:     { id: 'NPY-CRD-METAL', qty: 1, unit: 299, discounted: 240 },
            wishlist: { id: 'NPY-INV-ROBO', list: 'products-to-compare', price: 84, stock: 1 },
            order:    { idPattern: '^NPY-APP-\\d+$', itemCount: 2, total: 324,
                        payment: 'direct_debit', shipping: 'digital_delivery', coupon: 'LAUNCH50' },
            customEvents: ['fintech_kyc_completed', 'fintech_transfer_completed'],
        },
        /* Must contain neither Portuguese nor tyre-trade nor banking wording. */
        sweep: { enabled: true, forbid: PT_WORDS + '|' + RU_WORDS + '|' + TYRE_WORDS + '|Meridian' },
    },
    banking: {
        scenarioPrefix: 'banking_',  // flipped once the banking_ campaigns were built
        launcherButton: 'Show',
        path: '/banking',
        ns: 'meridian',
        /* No cart on this site. A customer shortlists products to compare and
           then applies for one; there is no basket and no checkout. */
        hooks: {
            add:   '[data-shortlist-add]',
            open:  '[data-shortlist-open]',
            close: '[data-shortlist-close]',
            count: '[data-shortlist-count]',
            items: '[data-shortlist-items]',
            cardButton: '.product-card-save',
        },
        /* js/searchPanel.js and js/wishlist.js are byte-identical across the
           five sites and write to search_events and wishlist_events. Banking
           does not use the ecommerce tables, so it does not load them. */
        /* Main's vocabulary for "this site does not use the ecommerce API".
           Drives searchwishtest, sdkfull, aligntest and ptsweep. */
        ecommerceUi: false,
        hasSearchAndWishlist: false,
        /* Banking keeps a shortlist where the retail sites keep a cart. Not a
           basket: no quantities, no total, and it writes here. */
        shortlistTable: 'banking_product_events',
        /* No cart, no checkout, no order. See banking/docs/TABLE-DESIGN.md. */
        usesEcommerceFunnel: false,
        gridLabel: 'Everything we offer',
        /* The eleven pages beyond home and product. Without these the mobile
           suite measured two pages out of thirteen. */
        mobilePages: [
            'calculators.html', 'eligibility.html', 'appointments.html',
            'compare.html?ids=MRD-MTG-FIX5,MRD-MTG-FIRST',
            'apply.html?product=MRD-MTG-FIX5',
            'dashboard.html', 'account.html?id=4471', 'cards.html',
            'payments.html', 'wealth.html', 'profile.html',
        ],
        /* The portal pages gate on a signed-in user and would otherwise be
           measured as their sign-in screen. */
        mobileUser: { firstName: 'Eleanor', lastName: 'Whitfield',
                      email: 'eleanor@example.co.uk', tier: 'premier' },
        launcherIcon: '#sticky-icon',
        productId: 'MRD-SAV-ISA',
        featuredId: 'MRD-MTG-FIRST',
        currency: 'GBP',
        eventPrefix: 'banking_',
        customTable: 'banking_events',
        onsiteTable: 'banking_onsite_events',
        lang: 'en',
        panel: {
            product:  { id: 'MRD-MTG-FIRST', price: 999, discounted: 0, stock: 1,
                        categoryPath: 'Products > Mortgages > First home', promotionId: 'RATE-WEEK-FEES-WAIVED' },
            category: { id: 'SAVINGS', path: 'Products > Savings' },
            cart:     { id: 'MRD-SAV-ISA', qty: 1, unit: 25, discounted: 25 },
            wishlist: { id: 'MRD-CRD-INFINITE', list: 'products-to-compare', price: 350, stock: 1 },
            order:    { idPattern: '^MRD-APP-\\d+$', itemCount: 2, total: 1024,
                        payment: 'direct_debit', shipping: 'branch_collection', coupon: 'RATEWEEK' },
            customEvents: ['banking_mortgage_calculated', 'banking_appointment_booked'],
        },
        /* Must contain neither Portuguese nor tyre-trade nor fintech wording. */
        sweep: { enabled: true, forbid: PT_WORDS + '|' + RU_WORDS + '|' + TYRE_WORDS + '|NovaPay' },
    },
};

/* The DOM hooks a suite has to click. They vary by site, so they live here
   rather than hard-coded in a suite: 'Exibir' and TRACKS_STOCK both broke the
   build by being duplicated into a suite instead of read from this file.

   The four retail sites drive a cart. Banking drives a shortlist, because a
   bank has no basket, so it overrides these. */
const DEFAULT_HOOKS = {
    add:   '[data-cart-add]',
    open:  '[data-cart-open]',
    close: '[data-cart-close]',
    count: '[data-cart-count]',
    items: '[data-cart-items]',
    cardButton: '.product-card-cart-btn',
};

function site(name) {
    const key = name || process.argv[2] || 'cantu-pneus';
    const cfg = SITES[key];
    if (!cfg) {
        console.error('Unknown site "' + key + '". Known: ' + Object.keys(SITES).join(', '));
        process.exit(2);
    }
    return Object.assign({ key: key, root: ROOT, base: ROOT + cfg.path }, cfg, {
        home: ROOT + cfg.path + '/index.html',
        product: ROOT + cfg.path + '/product.html?id=' + cfg.productId,
        hooks: Object.assign({}, DEFAULT_HOOKS, cfg.hooks || {}),
        /* Search and saved items are shared modules that hard-code ec:search
           into search_events and wishlist_events. Banking does not use the
           ecommerce tables, so it does not load them. Defaults to true so the
           other four sites are unaffected. */
        hasSearchAndWishlist: cfg.hasSearchAndWishlist !== false,
        /* Whether the site drives the ecommerce tables. The retail demos map
           the funnel onto ec:addToCart / beginCheckout / order. Banking does
           not: a mortgage is not a basket item, so it writes step-level rows
           to banking_application_events instead. Defaults to true so the other
           four sites are unaffected. */
        usesEcommerceFunnel: cfg.usesEcommerceFunnel !== false,
        shortlistTable: cfg.shortlistTable || null,
        /* The homepage grid's own heading, for suite output only. */
        gridLabel: cfg.gridLabel || 'Mais vendidos',
    });
}

/* Chromium here has no outbound access, so every non-local request is
   fulfilled empty. That also keeps the suites deterministic: no CDN, no
   Dengage SDK, no fonts. Suites that need the real SDK talk to the live
   GitHub Pages site instead (see live-display-reset.js). */
function offlineRoute(ctx, cfg) {
    return ctx.route('**/*', r => r.request().url().startsWith(cfg.root)
        ? r.continue()
        : r.fulfill({ status: 200, body: '' }));
}

/* Records the SDK calls the page makes, without a real SDK on the page. */
function stubDengage(page) {
    return page.addInitScript(() => {
        window.__sent = [];
        window.dengage = function () {
            const args = [].slice.call(arguments);
            /* Answer getDeviceId. The real SDK calls back with the device id,
               and code that waits for it (fintech's event layer buffers events
               until it resolves, so every row can be joined to master_device)
               would otherwise sit on a timeout in every suite. Callbacks are
               not serialisable, so they are dropped from the recorded call. */
            if (args[0] === 'getDeviceId' && typeof args[1] === 'function') {
                setTimeout(() => args[1]('test-device-id'), 0);
                window.__sent.push(['getDeviceId']);
                return;
            }
            window.__sent.push(JSON.parse(JSON.stringify(args)));
        };
    });
}

/* Sign a browser context in before it opens a gated page.

   A site whose portal is behind a session (fintech's app.html, guarded by
   js/novapayGate.js) redirects an unauthenticated visitor to the landing
   page. A suite that does not seed the session therefore measures the LANDING
   PAGE while believing it measured the portal, and passes. That is the worst
   failure a suite can have, so the seed lives here, once, rather than in each
   suite where one of them would eventually be forgotten.

   Sites with no sessionSeed are unaffected. */
function seedSession(ctx, cfg) {
    if (!cfg.sessionSeed) return Promise.resolve();
    const { store, value } = cfg.sessionSeed;
    return ctx.addInitScript(([k, v]) => {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }, [store, value]);
}

// every configured site, in the order run.sh uses them
function allSites() {
    return Object.keys(SITES);
}

module.exports = { SITES, site, allSites, offlineRoute, stubDengage, seedSession };
