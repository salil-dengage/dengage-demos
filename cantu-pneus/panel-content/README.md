# panel-content

The On-Site content that lives in the Dengage panel, kept here so it is
reviewable, testable and in version control. Nothing in this folder is served by
a site: these files are pasted by hand into the panel's HTML editor, one file per
campaign. Paste the whole file including `<!DOCTYPE>` and `<head>`; the engine
takes what it needs.

```
en/                  English content, for the /cantu-pneus/en/ site
  <8 scenarios>.html
  ab-testing/        three variants of one campaign
pt/                  Portuguese content, for the /cantu-pneus/ site
  <8 scenarios>.html
  ab-testing/
ru/                  Russian content, for the /cantu-pneus/ru/ site
  <8 scenarios>.html
  ab-testing/
personalized/        per-contact popups (see its own README)
story/               Story rail notes
```

## Three languages, three campaigns

A campaign is bound to one piece of content, so one campaign cannot serve
Portuguese to the BR site, English to the EN site and Russian to the RU site.
The event name is therefore split per site, and each language gets its own
campaign:

| Site | Pushes | Content to paste |
|---|---|---|
| `/cantu-pneus/` (pt-BR) | `br_survey`, `br_nps-popup`, `br_ab-testing`, ... | `pt/` |
| `/cantu-pneus/en/` | `en_survey`, `en_nps-popup`, `en_ab-testing`, ... | `en/` |
| `/cantu-pneus/ru/` | `ru_survey`, `ru_nps-popup`, `ru_ab-testing`, ... | `ru/` |
| `/fintech/`, `/banking/` | `survey`, `nps-popup`, ... unprefixed | `en/` |

The prefix is set in each site's `js/cantuCatalog.js` as
`SCENARIO_EVENT_PREFIX`, and it is **ON for all three CantuPneus sites**.

**What that means day to day:** every panel-driven scenario on a CantuPneus
site now needs a campaign whose trigger event carries the prefix. If one of the
nine is missing, that widget is silently dark on that site. Nothing errors, it
simply never appears, so check the panel before suspecting the code.

**To turn it off** for a site, set `SCENARIO_EVENT_PREFIX` back to `''` in that
site's `cantuCatalog.js` and mirror it in `scenarioPrefix` in
`tools/verify/sites.js`. Two lines per site, and it can be done one language at
a time.

**So the 9 campaigns become 27 for CantuPneus**, eight scenarios plus the A/B
test, in three languages. **Do not delete the original unprefixed campaigns**:
NovaPay and Meridian still trigger on those bare slugs, and deleting them takes
eight widgets dark on two sites.

The three misspelled slugs are unchanged and still part of the contract:
`subscripton-popup`, `horizonal-popup`, `stickey-bar`. So the BR events are
`br_subscripton-popup`, and the RU ones `ru_subscripton-popup`. Do not
"correct" them.

## What is identical across the three languages, on purpose

Only the words differ. Everything a campaign or a segment depends on is the same
in all three files:

- **Click ids**: `survey__submit`, `ab-testing__A` and so on. Identical in both,
  so CTR is directly comparable across the Portuguese, English and Russian
  campaigns.
- **Form field ids**: `data-dn-id="email"`, `data-dn-type="EMAIL"`,
  `mergedPermission`.
- **Tag names and tag values**: `tyre_line_interest` with values `truck`,
  `passenger`, `agricultural`, `industrial-otr`, `wheels-tubes`, and `nps_score`
  with `0` to `10`. The Portuguese survey shows "Carga" but still writes `truck`,
  so one segment works no matter which language the visitor saw. `formtest.js`
  runs both languages and asserts the payloads match.
- **Layout, width and CSS**, so the panel settings below apply to both.

What differs: the copy, `<html lang>`, and the CTA destination. Portuguese
content links to `/cantu-pneus/`, English to `/cantu-pneus/en/`, Russian to
`/cantu-pneus/ru/`.

## Panel settings

Same for all three languages; only the event name changes.

| File | Layout | Width | Trigger event |
|---|---|---|---|
| `survey.html` | Popup | 560 | `br_survey` / `en_survey` / `ru_survey` |
| `nps-popup.html` | Popup | 560 | `br_nps-popup` / `en_nps-popup` |
| `subscripton-popup.html` | Popup | 560 | `br_subscripton-popup` / `en_subscripton-popup` |
| `image-popup.html` | Popup | 560 | `br_image-popup` / `en_image-popup` |
| `cta-image-popup.html` | Popup | 560 | `br_cta-image-popup` / `en_cta-image-popup` |
| `horizonal-popup.html` | Popup | 700 | `br_horizonal-popup` / `en_horizonal-popup` |
| `stickey-bar.html` | **Banner**, Top | n/a | `br_stickey-bar` / `en_stickey-bar` |
| `image-bar.html` | **Banner**, Top | n/a | `br_image-bar` / `en_image-bar` |
| `ab-testing/*` | Popup | 560 | `br_ab-testing` / `en_ab-testing` |

All of them: padding 0, transparent background, trigger `DATA_LAYER_EVENT`. The
two bars need "Keep this message in place on scroll" ON. The A/B campaign holds
all three variants in one campaign per language, at a 10/30/30/30
control/A/B/C split.

## The rules these files follow

Each exists because it was a live bug at some point. `paneltest.js` enforces
them.

1. **No `<script>`.** The panel strips it. Interactivity is pure CSS, plus
   inline `onclick` attributes, which do survive.
2. **Every link needs `target="_top"`** or it navigates the iframe instead of
   the page.
3. **Exactly one `Dn.sendClick(id)` per file**, on the CTA. Without it a
   campaign reads 0 clicks and an A/B test can never pick a winner. A close
   control must never call `sendClick`, or a dismissal inflates CTR.
6. **Popups draw no close control.** The panel supplies it: Layout, Close
   Button, "Add close button to outside". A second one inside the card reads as
   a duplicate. The two banners keep their own, because Banner layout is not
   offered that setting. Do not confuse the close control with the `-vh`
   visually-hidden class: in `survey.html` and `nps-popup.html` that class hides
   the real inputs behind the styled score buttons, and removing it unstyles the
   whole row.
4. **No em or en dashes.**
5. **All CSS scoped** under the file's own `#cantu-*` root, and the card fills
   its container width exactly.

## Verify before pasting

```bash
node tools/verify/paneltest.js     # all 33 files, three languages
node tools/verify/formtest.js      # the 3 capture widgets, every language
node tools/verify/rutext.js        # the quality of the Russian itself
```

`paneltest` checks the rules above, renders each file, checks images and
overflow, confirms the card fills its container and that no CSS leaks onto the
host page. It also checks the language split specifically: that all three sets hold
the same scenarios, that each file declares the right `<html lang>`, that its
links point at the site speaking that language, and that no copy was left
untranslated in any direction. Russian is Cyrillic, so a single script check
catches a leak of it into either Latin-script set and vice versa.
