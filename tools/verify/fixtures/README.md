# fixtures

Third-party sources captured so the suites run without network access.

| File | Source | Why it is here |
|---|---|---|
| `form-handler.js` | `https://pcdn.dengage.com/onsite-message/form-handler.js` | `formtest.js` runs the engine's real form handler against `cantu-pneus/panel-content/*.html`, so the native `subscription_form` and `question_form` contracts are checked against the actual implementation instead of against our reading of it. |

Refresh with:

```
curl -s https://pcdn.dengage.com/onsite-message/form-handler.js \
  -o tools/verify/fixtures/form-handler.js
```

Re-run `tools/verify/run.sh cantu-pneus formtest` after refreshing. If the
contract changed, the suite is where you will find out.

This vendored copy is what the offline suites use, so `formtest.js` runs the
same engine code a live page loads, without needing outbound access.
