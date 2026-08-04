# NovaPay mobile content: the panel side of the Test Area

> The Test Area on the phone shows every Dengage capability. Push, Live Update
> and the deep links run entirely on the handset and need nothing here. In-App,
> inline, Stories and the inbox come from the server, so they need a campaign,
> and this file is what to put in it.

Artwork is committed at
`https://salil-dengage.github.io/dengage-demos/fintech/images/inapp/<name>.svg`,
rendered as **SVG** because these are read by a WebView, which draws SVG
natively and at any density. A **notification** image is decoded as a bitmap and
would need PNG instead, which is why nothing in this folder is reused for push.

---

## 0. Read this before writing any mobile In-App content

**The `Dn` object in a mobile In-App is not the `Dn` object on the website.**
They are different objects with different methods. The mobile contract for
SDK 6.0.96:

| Doing this | On the website | In a mobile In-App |
|---|---|---|
| Going somewhere | `<a href>` plus `target="_top"` | `Dn.androidUrl('novapay://<screen>')` |
| Counting the click | `Dn.sendClick('id')` | `Dn.sendClick('id')`, same |
| Closing | `Dn.close()` | `Dn.close()`, same |
| Capturing an answer | `data-dn-form-id` plus `Dn.postQuestion()` | `Dn.setTags('tag:<key>,value:<v>')` |
| Asking for notifications | not applicable | `Dn.promptPushPermission()` |
| A coupon code | not applicable | `Dn.copyToClipboard('CODE')` |

Also available on mobile and not on the web: `Dn.dismiss()`, `Dn.closeN()`,
`Dn.openSettings()`, `Dn.showRating()`, `Dn.androidUrlN(url, inAppBrowser,
retrieveOnSameLink)`.

**A `novapay://` href does nothing in this WebView.** There is no
`shouldOverrideUrlLoading` for a custom scheme, so it fails with
`ERR_UNKNOWN_URL_SCHEME`, silently, and no click is recorded. Every file here
goes through `Dn.androidUrl` instead, and `fintech/tools/mobiletest.js` fails
the build if one drifts back to the web contract.

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

The gallery has three groups and twelve templates. There is a file for every
one, and no file invents a template that is not there, so this table and the
panel agree line for line. `inapp-realtime.html` is the thirteenth file and is
a trigger type rather than a template, see below.

**Nothing has to be configured in the app.** The screen names below are already
reported by `Dengage.setNavigation`, so targeting is entirely in the campaign:
Trigger > Where to Show > **Specific Screens**, Screen Name **is** the value in
the table, Applications the NovaPay app. That is the whole setup.

**Check the Applications field before you save.** Meridian Bank reports the
same `test_inapp_*` vocabulary, deliberately, so one set of words describes both
finance demos. They never collide because the campaign selects its application.
Leaving both ticked is the one way to put a NovaPay message in front of a
Meridian audience.

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

Countdown and Scratch carry `{{#coupon}} ... {{/coupon}}` and `{{couponCode}}`,
which the SDK fills from the campaign's coupon pool through a Mustache pass.
**Leave the tags alone.** A hard-coded code shows the same one to every customer
and cannot be redeemed. `inapp-spin.html` carries a fixed code instead, because
Spin to Win has no coupon pool behind it; if a per customer code is wanted,
build it as a Scratch to Win campaign.

Countdown to Win is the only layout with its own `ContentType`
(`COUNTDOWN_TO_WIN`); set it in the panel or the coupon never arrives. What the
SDK does with the clock is enforce expiry, and nothing else: it logs
`COUNTDOWN_TO_WIN in-app message is expired, skipping display`. There is no
element id it writes a running time into, so a live ticking clock has to come
from the panel's own countdown widget.

All three are written as a **fee waiver** rather than a cash prize. In a
regulated industry that is the version that survives compliance, and it is also
the one with a real number behind it.

### Real time

| File | Panel template | Target screen |
|---|---|---|
| `inapp-realtime.html` | Modal, **Real Time** trigger | `test_inapp_realtime` |

Not a thirteenth template: any layout above can be real time. The app calls
`Dengage.showRealTimeInApp(activity, screen, params)` and sends `tier` and
`surface`, which the content reads, so the message is resolved at the moment of
display rather than at campaign build time.

### Why an In-App looks broken when it is not

Three things, and none of them reports an error.

1. **A campaign exists for that exact screen name.** A typo is a campaign that
   never shows.
2. **The device has already FETCHED it.** The SDK fetches on its own schedule,
   so a campaign saved thirty seconds ago is not on the handset yet. Press
   **Refresh from the server** in the Test Area first, and watch the
   **In-App fetched** row.
3. **Delivery Control has not already spent it.** Trigger > Delivery Limit caps
   how often one visitor sees one campaign, and the default is a total count
   plus a "once in every N minutes" window. Both are held against the visitor
   on the platform, so **killing the app does not reset either one**. A message
   that appeared once and then stops on repeated relaunches is almost always
   this, not a fault. While rehearsing, widen the window; set it back before
   the call.

---

## 2. Inline In-App

`inline-offer.html`, in an In-App campaign with layout **Inline**, targeted at
one of the property ids the app declares.

**The app owns these ids, not the panel.** `Dengage.showInlineInApp` takes the
`propertyId` as an argument, so the vocabulary is declared in
`ui/Surfaces.kt`, `InlinePlacements`, and the campaign matches it. A placement
is the pair **(screen name, property id)**, so the same id on another screen is
a different placement:

| Property id | Screen | Does |
|---|---|---|
| `novapay_home_below_balance` | `home` | inserts **below** the balance card |
| `novapay_money_top` | `money` | inserts **above** the transaction list |
| `novapay_money_subscriptions` | `money` | inserts **below** the transaction list |
| `novapay_grow_goals` | `grow` | **replaces** the investing card |
| `novapay_products_end` | `products` | inserts **after** the product list |

They are printed on the Test Area screen too, with a copy control, so a
campaign can be built while looking at the phone.

**Insert above, insert below, or replace: the campaign is identical in all
three.** The content you write here does not know and does not need to know
which one it is doing. The app decides, by where it mounts the element and, for
a replacement, by drawing its own card only while the element is empty. So a
creative built for `novapay_grow_goals` should read as a card in its own right,
because it stands where the app's investing card would have been, whereas one
built for `novapay_money_top` sits above content that is still there.

An unused placement costs no space: `hideIfNotFound` is true. While empty it
draws a dashed marker naming the id, so the placement can be pointed at before
any campaign exists; **Test Area > Placement markers** turns that off.

---

## 3. App Stories

Same arrangement, and the ids are declared by the app in `ui/Surfaces.kt`,
`StoryPlacements`: `novapay_stories_home`, `novapay_stories_grow`,
`novapay_stories_products`.

Three frames, portrait artwork:

| # | Title | Link |
|---|---|---|
| 1 | `Pay day` | `novapay://grow` |
| 2 | `Spending abroad` | `novapay://cards` |
| 3 | `One plan` | `novapay://products` |

`images/inapp/plus-plan.svg` is already drawn 1080x1920 and can serve as a
frame. If portrait artwork is wanted for the other two, say so and they will be
rendered at the same size.

---

## 4. App Inbox

**An empty inbox is not a fault, and it is the one surface that cannot be
faked.** The inbox is read from the server, so it holds what has actually been
delivered to this contact. The push gallery cannot fill it either: those
notifications are drawn on the handset and never reach the server, so the
`addToInbox` row has nothing to write to.

To put something in it, send a real campaign with **Add to Inbox** ticked, then
press **Load inbox**.

| Field | Value |
|---|---|
| Title | `Your pay has landed` |
| Message | `Move some of it before the month does it for you.` |
| Image | `.../fintech/images/inapp/payday.svg` |
| Target URL | `novapay://grow` |

`inbox-message.html` holds the same copy laid out, for reference. It is **not**
bridge content: the app draws inbox rows in its own Compose UI from title and
message.

**Send it to the contact key, not the device id.** The app sets a contact key,
so the SDK asks for `type=c`, which is contact-addressed mail only. A message
sent to this device id is stored as `type=d` and this query will never return
it. That failure returns `200 []`, identical to an inbox with nothing in it,
which is why it is worth stating twice.

The three rows already on the inbox screen are **seeded locally** and say so.
They exist because an empty screen and a failed request look identical, and a
demo should not open on either.

---

## 5. Push needs nothing here

Every push format is drawn on the handset by the SDK's own renderer, from a
payload assembled in `push/NovaPayPushGallery.kt` and handed to the SDK's own
receiving path. Thirteen rows: text, subtext with emoji and badge and sound,
rich, action buttons, carousel, deep link, custom parameters, an inbox copy,
silent, expiry, and three personalisation examples.

That covers rendering and app handling. It does **not** cover delivery or
server-side personalisation, because there is no server involved: a locally
drawn notification cannot produce an inbox row, an open, or any campaign
statistic. The personalised rows print the resolved output plus the exact
`{%= $Contact.first_name %}` tag to paste into a panel campaign, with a copy
control, so one real send proves the other half.

The artwork those rows use is at
`.../fintech/images/push/<name>.png`, generated by `tools/assets/pushart.js`.
**PNG, not SVG**, because a notification image is decoded by `BitmapFactory`,
which does not read SVG. The failure is silent: the push arrives and the
expanded view is blank.

To evaluate a format properly, reproduce it with a real campaign send. The
`dengageCampId` row in the Test Area's "Last push received" card tells you which
you are looking at: absent or `0` means it was local.

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
- Everything is namespaced under one `#npy-*` root, and every CSS selector sits
  under it.
- All artwork is committed in this repository. Nothing here may reference a
  third-party image host.

`node fintech/tools/mobiletest.js` checks all of the above, plus that every
screen name in a file is one the app actually reports.
