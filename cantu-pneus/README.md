# CantuPneus | Dengage On-Site Scenario Demo

> **This is the original demo site.** The repository now holds four sites and
> the shared platform knowledge lives one level up: see the
> [repository README](../README.md),
> [`docs/DENGAGE-INTEGRATION.md`](../docs/DENGAGE-INTEGRATION.md),
> [`docs/PANEL-SETUP.md`](../docs/PANEL-SETUP.md) and
> [`docs/DECISIONS-AND-GOTCHAS.md`](../docs/DECISIONS-AND-GOTCHAS.md).
> An English copy of this site lives in [`en/`](en/README.md).

Demonstration storefront that shows every Dengage on-site engagement scenario
in a B2B tyre distribution context. Derived from the `jewelry-example` demo,
rethemed to CantuPneus and written in pt-BR.

**This is not the official CantuPneus website.** It is a demonstration asset.
Product data, prices and stock figures are invented.

Live: <https://salil-dengage.github.io/dengage-demos/cantu-pneus/>

---

## Running it

The site **must be served over HTTP**. Opening `index.html` from the file
system breaks the recommendation widgets and the product grid, because
browsers block `fetch()` of the local JSON feed on `file://`.

```bash
cd cantu-pneus
python3 -m http.server 8000
# open http://localhost:8000
```

GitHub Pages: Settings > Pages > Deploy from branch > `main` / root.

Nothing on the page loads from a third-party CDN except Google Fonts and the
GTM container, so the demo still works on a venue network that blocks
jsdelivr or cdnjs.

---

## Pointing it at a Dengage account

The Dengage Web SDK snippet sits in the `<head>` of both `index.html` and
`product.html`, between `DENGAGE SDK START` / `DENGAGE SDK END` markers,
verbatim as the panel issued it. It loads the BFSI web application,
account **28**.

The team's own GTM container, **GTM-NL6J5Z53**, is installed on both pages
for analytics and future tags. It plays no part in the Dengage integration
and must never load the Dengage SDK: the SDK is on the page directly, and a
GTM copy would double-initialise it. (The container the demo originally
inherited, `GTM-5CLZHR7J`, was removed because it initialised three
unrelated Dengage accounts, one of which fired a video popup onto this
site.)

### Web application advanced settings

| Setting | Value | Why |
|---|---|---|
| Trigger Initialize on Install | **off** | the snippet calls `initialize()` itself |
| Trigger Page View on Initialize | **off** | `js/pageView.js` calls `pageView()` with real parameters; leaving this on double-counts every page |
| Allow connecting multiple contacts to single device | off | Dengage's own recommendation |
| Disable `setNavigation` | on | never called here |

### What the site sends

| Moment | Call |
|---|---|
| Home load | `dengage('pageView', {page_type:'home'})` |
| Product load | `dengage('pageView', {page_type:'product', product_id, category_path, price, discounted_price, stock_count})` |
| Add to cart | `dengage('ec:addToCart', {...,cartItems})` |
| Decrement / remove | `dengage('ec:removeFromCart', {...,cartItems})` |
| Empty cart | `dengage('ec:deleteCart', {})` |
| Checkout | `dengage('ec:beginCheckout', {cartItems})` then `dengage('ec:order', {...})` |
| Sign-up | `dengage('setContactKey', email)` |
| Catalog button | `dengage('sendDeviceEvent', 'onsite_events', {event_name: slug, ...})` |

`ec:order` fills `order_events` and `order_events_detail`; the SDK owns those
shapes, so nothing here writes them by hand.

### Triggering the eight Default Scenarios

On-Site messages are triggered by a **dataLayer event**, and the SDK watches
`window.dataLayer` itself. No GTM tag is involved.

All eight are configured identically, confirmed from the panel.

The catalog already pushes exactly that event, so each panel scenario only
needs `triggerBy = DATA_LAYER_EVENT` and `eventName` set to the slug:

| Scenario | eventName |
|---|---|
| Pesquisa | `survey` |
| Popup NPS | `nps-popup` |
| Popup de Inscrição | `subscripton-popup` |
| Barra Fixa | `stickey-bar` |
| Popup de Imagem | `image-popup` |
| Barra de Imagem | `image-bar` |
| Popup Horizontal | `horizonal-popup` |
| Popup de Imagem CTA | `cta-image-popup` |

Set `whereToDisplay` to `/.*/` so they fire on any page of the demo, and keep
`dontShowAfterClick` off while presenting, or a scenario shows only once.

The SDK also accepts `CUSTOM_EVENT`, `EXIT_INTENT` and `ON_SCROLL` as trigger
types, if a scenario should fire on something other than a button.

The separate `onsite_events` custom event still fires on all 25 buttons and
is useful for behavioural campaigns and analytics. It needs a **Big Data
Table** named `onsite_events` with columns `event_name`, `scenario_group`,
`widget_name`, `page_type`, `page_url` (`key` and `event_date` are filled by
the SDK). The table name is the constant `DENGAGE_EVENT_TABLE` in
`js/cantuCatalog.js`.

### Recommendation engine

The five recommendation widgets read the local catalogue by default so the
demo works unconfigured. Put a container key into `CANTU_RECO_CONTAINERS` at
the top of `js/allReco.js` and that widget switches to
`dengage('getRecommendation', containerKey, {}, cb)`, mapping the response
into the catalogue shape. The widget renders from the local catalogue when no
live recommendation is configured.

### Web push

The service worker is published at the origin root,
`https://salil-dengage.github.io/dengagewebpushsw.js`, from the separate
`salil-dengage.github.io` repository. It has to live there: the SDK fetches it
from the origin root, and a service worker cannot claim a scope above its own
path. The copies under `/dengage-demos/` are harmless leftovers.

The SDK only registers the worker and creates a subscription when something
asks for permission. If **Show Permission Prompt on page load** is off in the
panel, nothing happens by itself: `Notification.permission` stays `default`
and `navigator.serviceWorker.getRegistrations()` returns empty until something
asks for permission.

The scenario catalog therefore carries an **Ativar** button for push, which
calls `dengage('showNativePrompt')` on demand. For a demo that beats an
automatic prompt, because the opt-in can be shown live. Once granted, the
same button reports the registration scope and device id to the console.

### Not applicable here

`sendevent`, `upsertproduct` and `upsertorders` are server-side REST APIs
needing an access token or account id. They cannot be called from a static
site without leaking credentials, so this demo does not use them.

## The scenario catalog

The blue Dengage icon at bottom right opens the catalog. 25 scenarios in five
groups, under **two different event contracts**, matching the jewelry example.

### 1. Default Scenarios (8): panel-driven

No local code. Built in the Dengage panel and delivered by the On-Site
engine, which watches `window.dataLayer` directly (no GTM involved). The
event name *is* the scenario slug:

```js
{ event: 'survey', actionType: 'survey', category: 'Default Scenarios' }
```

| Scenario | Slug |
|---|---|
| Pesquisa | `survey` |
| Popup NPS | `nps-popup` |
| Popup de Inscrição | `subscripton-popup` |
| Barra Fixa | `stickey-bar` |
| Popup de Imagem | `image-popup` |
| Barra de Imagem | `image-bar` |
| Popup Horizontal | `horizonal-popup` |
| Popup de Imagem CTA | `cta-image-popup` |

Slugs keep the original spelling, `subscripton` and `horizonal` included, so
existing scenario triggers keep matching. Do not "fix" them.

### 2. Inline / On Site / Gamification / Recommendation (17): local modules

Generic envelope, plus a direct call to the local render function so the demo
works with no scenario configured:

```js
{ event: 'dengage', actionType: 'spin-to-win', widgetName: 'Spin to Win',
  category: 'Gamification Scenarios' }
```

| Group | Scenario | Slug | Function |
|---|---|---|---|
| Inline | Mega Banner | `mega-banner` | `showSliderBanner()` |
| Inline | Banner Expansível | `expand-banner` | `ExpandBanner()` |
| Inline | Head Banner | `head-banner` | `showHeadBanner()` |
| Inline | Ícone de Notificação | `notification-icon` | `addIcon()` |
| On Site | Barra Lateral | `side-bar` | `earingWidget()` then `EaringWidget.open()` |
| On Site | Assistente Inferior | `bottom-assistant` | `BottomAssistant()` then `openBottomAssistant()` |
| On Site | Banner Carrossel | `carousel-banner` | `carouselBanner()` |
| Gamification | Roleta da Sorte | `spin-to-win` | `WheelGame()` |
| Gamification | Raspadinha | `scratch-to-win` | `ScratchGame()` |
| Gamification | Santa Deer | `santa-deer` | `SantaGame()` |
| Gamification | Like Card | `like-card` | `LikeCardGame()` |
| Gamification | Neve | `snow` | `SnowStorm()` |
| Recommendation | Widget Clássico | `classic-widget` | `ClassicWidget()` |
| Recommendation | Widget Banner | `banner-widget` | `BannerWidget()` |
| Recommendation | Widget em Abas | `tab-widget` | `TabWidget()` |
| Recommendation | Widget Lateral | `sidebar-widget` | `SideBarWidget()` |
| Recommendation | Widget Popup | `popup-widget` | `PopupWidget()` |

`side-bar` and `bottom-assistant` publish their public API from inside a
builder that never runs on page load, so the catalog builds the widget before
opening it. Both builders are safe to call twice.

Widgets that inject themselves into the page body (Mega Banner and the three
inline recommendation widgets) are scrolled into view after they render, so
clicking a catalog button always produces something visible.

---

## Dengage Web SDK events

| Trigger | Call |
|---|---|
| Page load | `dengage('sendDeviceEvent', 'page_view_events', {page_type, page_url})` |
| Cart change | `dengage('sendDeviceEvent', 'shopping_cart_events', payload)` |
| Sign-up form | Email captured as the Dengage contact key |

The floating event modal (bottom left, PT/EN) fires arbitrary custom events by
table name during a live demo.

---

## Files

| Path | Purpose |
|---|---|
| `index.html` | Home page. Carries every DOM hook the widgets require. |
| `product.html` | Product detail page, driven by `?id=<sku>`. |
| `cantu-style.css` | Theme. Every colour and typeface is a variable in `:root`. |
| `cantu_prod_example.json` | 16-SKU tyre feed consumed by the grid and every recommendation widget. |
| `js/cantuCatalog.js` | The scenario catalog panel. |
| `js/allReco.js` | Five recommendation widgets. |
| `js/allGaming.js` | Wheel, scratch, santa and like-card engines. |
| `js/productDetail.js`, `js/similarProducts.js` | Product detail page. |
| `js/cartManager.js`, `js/cartUi.js` | Cart state and drawer. |
| `js/productCatalog.js`, `js/productList.js` | Feed loading and grid rendering. |
| `images/products/` | 16 generated SKU images, one per feed entry. |
| `images/scenes/` | Section photography. `CREDITS.json` records each source. |
| `vendor/` | Swiper, Hammer and the widget artwork, served locally. |

---

## Rethemeing

Every colour flows from two brand tokens at the top of `cantu-style.css`:

```css
--brand-purple: #4E018F;   /* primary */
--brand-yellow: #FFE958;   /* accent  */
```

Both were sampled from CantuPneus brand assets. The downstream
`--color-gold-*` names are inherited from the source template and mean
"primary brand colour", not gold.

---

## Product feed schema

```json
{
  "id": "CNT-CRG-29580-KLD01",
  "name": "Marshal KLD01 295/80 R22.5",
  "desc": "...",
  "price": "1890.00",
  "oldPrice": "2090.00",
  "currency": "BRL",
  "image": ["images/products/CNT-CRG-29580-KLD01.svg"],
  "category": "Pneus > Carga > Borrachudo",
  "brand": "Marshal",
  "availability": true,
  "colors": ["Borrachudo", "295/80 R22.5"]
}
```

`colors` is repurposed to carry construction type and measure, which is what
surfaces on the widget cards. `category` is matched by the Tab Widget on the
`> Carga >`, `> Passeio >`, `> Agrícola >` and `> Industrial e OTR >`
segments, so keep those paths intact when editing the feed.

Product images are drawn per tread family rather than photographed, so every
SKU has a consistent catalogue shot that always loads.

---

## Known gaps

- The eight Default Scenarios now have live campaigns and published content
  (`panel-content/`), but their content is Portuguese, so they stay
  Portuguese on the English and finance sites too. See
  [`docs/DECISIONS-AND-GOTCHAS.md`](../docs/DECISIONS-AND-GOTCHAS.md).
- Recommendation container keys are not filled in, so the five
  recommendation widgets run on the local product feed rather than the real
  engine.
- Company figures in the copy (founded 2006, Itajaí SC, 31 branches, 4
  distribution centres, brand list) come from public sources and are worth a
  sanity check before a call.
- Section photography is freely licensed documentary work, not CantuPneus
  catalogue photography. Swap in real assets when they are available.
- The push opt-in button opens the Dengage custom prompt; the native browser
  prompt follows if permission is still pending, so the flow always completes.

## Busca e favoritos

Duas funcoes reais do site, nao botoes do painel de eventos, e as duas gravam em
tabelas padrao do Data Space. O cabecalho tem uma lupa e um coracao, cada card de
produto tem um coracao, e a pagina do produto tem um botao de salvar.

| Acao | Evento | Tabela |
|---|---|---|
| busca concluida | `ec:search` | `search_events` |
| salvar um produto | `ec:addToWishlist` | `wishlist_events` |
| remover, ou Limpar lista | `ec:removeFromWishlist` | `wishlist_events` |

### Como demonstrar

**Busca.** Digite uma medida que a loja tem, `195/65 R15` ou `19565r15`, as duas
encontram o mesmo pneu. Depois digite algo que a loja nao tem. A linha
interessante e a segunda: `result_count` igual a 0, e essa e a base de uma
campanha que responde "nao temos essa medida, a mais proxima e esta". Vale
destacar que o evento e disparado uma vez por busca **concluida**, nao a cada
tecla, entao a tabela registra a intencao e nao a digitacao.

**Favoritos.** Salve dois ou tres pneus e abra a gaveta. Cada save grava o preco
de tabela e o preco praticado, para uma campanha de queda de preco ter com o que
comparar, um `expire_date` de 90 dias para a campanha parar de perseguir um save
antigo, e o `stock_count`, que e o campo necessario para um alerta de volta ao
estoque. Os avisos de estoque baixo na gaveta vem do mesmo numero.

O `stock_count` e enviado aqui e no site em ingles, porque este catalogo controla
unidades. Os catalogos NovaPay e Meridian nao enviam: um cartao ou um
financiamento nao tem contagem de unidades, e o campo e opcional.

Payloads exatos: `docs/DENGAGE-INTEGRATION.md` §5.11.
Verificacao: `node tools/verify/searchwishtest.js`.
