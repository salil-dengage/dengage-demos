# Meridian Bank mobile content: the panel side of the Test Area

> The Test Area on the phone shows every Dengage capability. Push, Live Update
> and the deep links run entirely on the handset and need nothing here. In-App,
> inline, Stories and the inbox come from the server, so they need a campaign,
> and this file is what to put in it.

Artwork is committed at
`https://salil-dengage.github.io/dengage-demos/banking/images/push/<name>.png`,
rendered as **PNG** because a notification image is decoded as a bitmap and the
rest of this repository's artwork is SVG, which will not render.

---

## 0. Read this before writing any mobile In-App content

**The `Dn` object in a mobile In-App is not the `Dn` object on the website.**
They are different objects with different methods. The mobile contract for
SDK 6.0.96:

| Doing this | On the website | In a mobile In-App |
|---|---|---|
| Going somewhere | `<a href>` plus `target="_top"` | `Dn.androidUrl('meridian://<screen>')` |
| Counting the click | `Dn.sendClick('id')` | `Dn.sendClick('id')`, same |
| Closing | `Dn.close()` | `Dn.close()`, same |
| Capturing an answer | `data-dn-form-id` plus `Dn.postQuestion()` | `Dn.setTags('tag:<key>,value:<v>')` |
| Asking for notifications | not applicable | `Dn.promptPushPermission()` |
| A coupon code | not applicable | `Dn.copyToClipboard('CODE')` |

Also available on mobile and not on the web: `Dn.dismiss()`, `Dn.closeN()`,
`Dn.openSettings()`, `Dn.showRating()`, `Dn.androidUrlN(url, inAppBrowser,
retrieveOnSameLink)`.

**A `meridian://` href does nothing in this WebView.** There is no
`shouldOverrideUrlLoading` for a custom scheme, so it fails with
`ERR_UNKNOWN_URL_SCHEME`, silently, and no click is recorded. Every file here
was written to the web contract on 2 August and had to be rewritten;
`banking/tools/mobiletest.js` now fails the build if one drifts back.

`Dn.setTags` is the other trap. The native interface takes **one string of
comma-separated `key:value` pairs, with the literal keys `tag` and `value`**:

```
Dn.setTags('tag:nps_score,value:9')     ->  TagItem("nps_score", "9")
```

Any other shape is dropped without a word. And tags attach to the **device**,
not the contact: segment on the tag, do not go looking for it on the contact's
Fields tab.

---

## 1. In-App: one file per template the panel offers

The gallery has three groups and ten templates. There is a file for every one,
and no file invents a template that is not there, so this table and the panel
agree line for line.

**Nothing has to be configured in the app.** The screen names below are already
reported by `Dengage.setNavigation`, so targeting is entirely in the campaign:
Trigger > Where to Show > **Specific Screens**, Screen Name **is** the value in
the table, Target Device the banking app. That is the whole setup.

### Blank Layout

| File | Panel template | Target screen |
|---|---|---|
| `inapp-banner.html` | Banner | `test_inapp_banner` |
| `inapp-bar.html` | Banner, position **BOTTOM** | `test_inapp_bar` |
| `inapp-modal.html` | Modal (image + text) | `test_inapp_modal` |
| `inapp-image-modal.html` | Image Modal (image only) | `test_inapp_image_modal` |
| `inapp-full.html` | Full Screen (image + text) | `test_inapp_full` |
| `inapp-full-image.html` | Full Image (image only) | `test_inapp_full_image` |
| `inapp-permission.html` | Modal | `test_inapp_permission` |

`inapp-bar.html` is the Banner template with the position changed, not a
different layout. Worth saying in a demo: the same content can move without
being rebuilt.

`inapp-permission.html` is a Modal used as a notification soft ask. Its CTA
calls `Dn.promptPushPermission()`, which raises Android's own dialog. Android
13 gives an app one attempt at that permission and a No is close to permanent,
so asking here first is the difference between a recoverable no and a
permanent one.

### Feedback

| File | Panel template | Target screen |
|---|---|---|
| `inapp-survey.html` | Survey | `test_inapp_survey` |
| `inapp-nps.html` | NPS (Net Promoter Score) | `test_inapp_nps` |

Both capture with `Dn.setTags`, writing `goal_interest` and `nps_score`
respectively. See §0 for the argument format.

### Gamification

| File | Panel template | Target screen |
|---|---|---|
| `inapp-countdown.html` | Countdown to Win | `test_inapp_countdown` |
| `inapp-scratch.html` | Scratch to Win | `test_inapp_scratch` |
| `inapp-spin.html` | Spin to Win | `test_inapp_spin` |

These three carry `{{#coupon}} ... {{/coupon}}` and `{{couponCode}}`, which the
SDK fills from the campaign's coupon pool through a Mustache pass. **Leave the
tags alone.** A hard-coded code shows the same one to every customer and cannot
be redeemed.

Countdown to Win is the only layout with its own `ContentType`
(`COUNTDOWN_TO_WIN`); set it in the panel or the coupon never arrives. What the
SDK does with the clock is enforce expiry, and nothing else: it logs
`COUNTDOWN_TO_WIN in-app message is expired, skipping display`. There is no
element id it writes a running time into, so a live ticking clock has to come
from the panel's own countdown widget.

### Real time

| File | Panel template | Target screen |
|---|---|---|
| `inapp-realtime.html` | Modal, **Real Time** trigger | `test_inapp_realtime` |

Not an eleventh template: any layout above can be real time. The app calls
`Dengage.showRealTimeInApp(activity, screen, params)` and sends `tier` and
`surface`, which the content reads, so the message is resolved at the moment of
display rather than at campaign build time.

### Why an In-App looks broken when it is not

Two things must both be true, and neither reports an error:

1. **A campaign exists for that exact screen name.** A typo is a campaign that
   never shows.
2. **The device has already FETCHED it.** The SDK fetches on its own schedule,
   so a campaign saved thirty seconds ago is not on the handset yet. Press
   **Refresh from the server** in the Test Area first, and watch the
   **In-App fetched** row.

---

## 2. Inline In-App

`inline-offer.html`, in an In-App campaign with layout **Inline**, targeted at
one of the property ids the app declares.

**The app owns these ids, not the panel.** `Dengage.showInlineInApp` takes the
`propertyId` as an argument, so the vocabulary is declared in
`DengageKeys.InlineProperty` and the campaign matches it. One per screen, so a
page can carry a different inline message from any other page:

`meridian_inline_overview`, `meridian_inline_accounts`, `meridian_inline_cards`,
`meridian_inline_payments`, `meridian_inline_wealth`,
`meridian_inline_products`, `meridian_inline_profile`.

They are printed on the Test Area screen too, so a campaign can be built while
looking at the phone.

---

## 3. App Stories

Same arrangement, ids from `DengageKeys.StoryProperty`:
`meridian_stories_overview`, `meridian_stories_products`,
`meridian_stories_wealth`.

Three frames, portrait artwork:

| # | Title | Link |
|---|---|---|
| 1 | `Rate Week` | `meridian://products` |
| 2 | `Travel ready` | `meridian://cards` |
| 3 | `Your portfolio` | `meridian://wealth` |

Reuse `push/rate-week.png`, `push/travel.png` and `push/statement.png` if
portrait frames are not required; if they are, say so and they will be
re-rendered at 1080x1920.

---

## 4. App Inbox

**An empty inbox is not a fault, and it is the one surface that cannot be
faked.** The inbox is read from the server, so it holds what has actually been
delivered to this contact. Nothing has been, so it returns `200 []`. The push
gallery cannot fill it either: those notifications are drawn on the handset and
never reach the server, so the `addToInbox` row has nothing to write to.

To put something in it, send a real campaign with **Add to Inbox** ticked, then
press **Load the inbox**.

| Field | Value |
|---|---|
| Title | `Your Rate Week summary` |
| Message | `Fixed rates held until Friday, and what it means for your mortgage.` |
| Image | `.../banking/images/push/rate-week.png` |
| Target URL | `meridian://products` |

`inbox-message.html` holds the same copy laid out, for reference. It is **not**
bridge content: the app draws inbox rows in its own Compose UI from title,
message and image.

**Send it to the contact key, not the device id.** The app sets a contact key,
so the SDK asks for `type=c`, which is contact-addressed mail only. A message
sent to this device id is stored as `type=d` and this query will never return
it. That failure returns `200 []`, identical to an inbox with nothing in it,
which is why it is worth stating twice.

---

## 5. Push needs nothing here

Every push format is drawn on the handset by the SDK's own renderer, from a
payload assembled in `MeridianPushGallery`. Fourteen rows: text, subtext with
emoji and badge and sound, rich, action buttons, carousel, deep link, custom
parameters, an inbox copy, silent, expiry, and four personalisation examples.

That covers rendering and app handling. It does **not** cover delivery or
server-side personalisation, because there is no server involved. The
personalised rows print the resolved output plus the exact
`{%= $Contact.first_name %}` tag to paste into a panel campaign, so one real
send proves the other half.

The API credentials that used to sit in the app were removed on 2 August: they
were account-wide across account 28, contact data included, and an APK is a
shareable thing. See `../../docs/PROJECT-LOG.md` §5.12.

---

## 6. The house rules these follow

- **Navigation is `Dn.androidUrl`.** See §0. This is the one that fails silently.
- Exactly one `Dn.sendClick('<screen>__<action>')` per file, on the CTA. A close
  control calls `Dn.close()` and never `sendClick`, so a dismissal is never
  counted as a conversion.
- **Popups draw no close button.** The panel supplies it via
  Layout > Close Button > "Add close button to outside". Banners keep their own,
  because Banner layout is not offered that setting.
- The panel strips `<script>` on save, so interactivity is CSS plus inline
  `onclick`.
- Everything is namespaced under one `#mrd-*` root, and every CSS selector sits
  under it.

`node banking/tools/mobiletest.js` checks all of the above, plus that every
screen name in a file is one the app actually reports.
