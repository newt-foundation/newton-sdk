# Vocs Cutover Runbook

**Date:** 2026-07-23  
**Domain:** docs.newton.xyz  
**Current:** Mintlify (via GitHub App)  
**Target:** Vocs + Vercel (Git integration)

This runbook is a **user-only operator guide** for dashboard and DNS actions. Code migration work is complete; all actions below require Vercel account access, DNS admin for docs.newton.xyz, and GitHub repository admin access.

---

## Preconditions Checklist

Before starting, verify:

- [ ] Branch `docs/mintlify-to-vocs-migration` is merged to `main`
- [ ] `site/vercel.json` exists with the 2 external + 1 home redirect (see Stage 1.3 verification)
- [ ] `site/` is a standalone package: `site/package.json` and `site/pnpm-lock.yaml` exist
- [ ] `site/vocs.config.ts` present and builds cleanly: `cd site && pnpm install && pnpm build` exits 0
- [ ] Parity harness ready: `site/scripts/verify-parity.mjs` and `site/scripts/expected-routes.json` + `site/scripts/expected-redirects.json` exist
- [ ] Vercel account access (can create/manage projects and domains)
- [ ] DNS admin access for docs.newton.xyz (can change CNAME/A record and TTL)
- [ ] GitHub repo admin access (can disconnect GitHub Apps)
- [ ] Current Mintlify GitHub App is still connected to the repo (to enable fast rollback)

---

## Stage 0: Record Rollback Baseline

**Duration:** 5 min  
**Risk:** None (read-only)

Record the current `docs.newton.xyz` DNS configuration before any changes. This is your rollback target.

### 0.1 Capture Current DNS Record

```bash
dig +noall +answer docs.newton.xyz CNAME A
```

**Expected output:** A line like `docs.newton.xyz. 300 IN CNAME something.mintlify.app.` or `docs.newton.xyz. 300 IN A 1.2.3.4`

Record the **full output verbatim**:
- Type (CNAME or A)
- Value (domain or IP)
- TTL

**Example (save to your cutover ticket):**
```
docs.newton.xyz. 300 IN CNAME docs-new-newton-sdk.mintlify.app.
```

### 0.2 Note Current Configuration

Record in the cutover ticket:
- **Mintlify GitHub App connection:** still active (used for fast rollback)
- **Current site:** https://docs.newton.xyz serving Mintlify
- **Date/time of capture:** `date -u`

---

## Stage 1: Build & Host Preflight (No DNS Change)

**Duration:** 15–20 min  
**Risk:** Low (confined to Vercel preview URL; production DNS untouched)

Validate the Vocs build on Vercel-owned infrastructure before touching production DNS.

### 1.1 Create Vercel Project from Repository

1. Log in to [vercel.com](https://vercel.com)
2. Click **"Add New"** → **"Project"**
3. Select the `newton-sdk` repository
4. **Framework Preset:** Vocs should auto-detect. If not, select manually
5. **Root Directory:** Set to `site` (critical — Vercel runs `npm/pnpm install` and `npm/pnpm build` from this directory)
6. **Install Command:** Keep default (Vercel detects `pnpm-lock.yaml`)
7. **Build Command:** Keep default (Vercel detects `vocs build` from `site/package.json`)
8. **Output Directory:** Confirm it is `dist` (standard for Vocs)
9. Click **"Deploy"**

Wait for the initial build to complete. Vercel assigns a preview URL like `https://newton-sdk-abc123.vercel.app`.

### 1.2 Confirm Build Success

In the Vercel project **Deployments** tab:
- [ ] Latest deployment shows **"Ready"** (green checkmark)
- [ ] Build logs show `vocs build` exit 0
- [ ] No TypeScript or build errors

If build fails, review logs and fix in the repo before proceeding.

### 1.3 Verify the Three Hosting-Layer Redirects

The `vercel.json` redirects (2 external blog + 1 home) are applied by Vercel's hosting layer, **not** by `pnpm preview`. Use `curl` to verify them against the Vercel preview URL:

**Get your preview URL:** From the Vercel Deployments tab, copy the full deployment URL (e.g., `https://newton-sdk-abc123.vercel.app`).

```bash
# Redirect 1: Home to developers overview
curl -i https://newton-sdk-abc123.vercel.app/ | head -20
# Expected: 307 or 308 Location: /developers/overview/about

# Redirect 2: how-to-guides/newt-token-staking → blog
curl -i https://newton-sdk-abc123.vercel.app/how-to-guides/newt-token-staking | head -20
# Expected: 307 or 308 Location: https://blog.newton.xyz/how-to-stake-newt/

# Redirect 3: references/newt-token-airdrop → blog
curl -i https://newton-sdk-abc123.vercel.app/references/newt-token-airdrop | head -20
# Expected: 307 or 308 Location: https://blog.newton.xyz/newt-airdrop-claiming-staking/
```

- [ ] All three redirects return 307/308 with correct Location header
- [ ] External blog URLs are complete (not relative)

### 1.4 Run Parity Harness Against Preview URL

Verify route and redirect parity against the built site:

```bash
cd site
node scripts/verify-parity.mjs https://newton-sdk-abc123.vercel.app
```

**Expected output:**
```
PARITY OK: 96 routes verified, 16 internal redirects verified, 0 failures
```

If failures appear, investigate (common causes: missing assets, broken frontmatter, component import errors):
- [ ] All 96 routes return 2xx
- [ ] All 16 internal redirects hit their exact destination
- [ ] No broken assets (images, logos)

**Abort if:** Any route non-2xx, any redirect wrong destination, or assets missing. Fix in repo and redeploy.

### 1.5 Checklist: Stage 1 Complete

- [ ] Vercel project created, Root Directory = `site`
- [ ] Build succeeded (Deployments tab shows "Ready")
- [ ] Three hosting-layer redirects verified via curl
- [ ] Parity harness passed (96 routes + 16 redirects + 2 external redirects)
- [ ] Preview URL noted for Stage 2

**Next:** Proceed to Stage 2 only after all checkboxes pass.

---

## Stage 2: Mapped-Domain Preflight (Low-TTL, Reversible)

**Duration:** 15–20 min + TTL wait  
**Risk:** Medium (DNS change; reversible within the TTL window)

Add production domain to Vercel and validate against it, with low TTL for fast rollback.

### 2.1 Lower DNS TTL

Before making any DNS changes, lower the TTL to allow fast rollback:

1. Log in to your DNS provider (CloudFlare, Route53, etc.)
2. Find the `docs.newton.xyz` DNS record (type CNAME or A)
3. **Lower TTL to 300 seconds** (5 minutes)
4. Save

**Wait for the old TTL to expire.** If the old TTL was 3600 (1 hour), wait ~1 hour before proceeding to 2.2. During this window, cached DNS at ISPs/resolvers will continue serving the old target, but any fresh lookups get the new one within 5 minutes.

### 2.2 Add Domain to Vercel Project

1. In the Vercel project, go to **Settings** → **Domains**
2. Click **"Add"** and enter `docs.newton.xyz`
3. Vercel displays the required DNS record (typically a CNAME to `cname.vercel-dns.com` or an A record to a Vercel IP)
4. **Copy the CNAME or A record value**

### 2.3 Update DNS Record

1. In your DNS provider, find the `docs.newton.xyz` record
2. **Replace the value** with Vercel's CNAME/A from Step 2.2
3. Confirm TTL is still 300s
4. Save

**Wait ~2–5 minutes** for DNS to propagate.

### 2.4 Verify DNS Propagation

```bash
dig +noall +answer docs.newton.xyz CNAME A
```

**Expected:** Output shows Vercel's CNAME or A record (not the old Mintlify target).

Retry every 30 seconds if still showing old record; propagation typically completes within 5 minutes.

### 2.5 Verify HTTPS & Certificate

Once DNS resolves to Vercel:

```bash
curl -i https://docs.newton.xyz | head -20
```

- [ ] HTTP 2xx response (not redirect to another domain)
- [ ] HTTPS works (no certificate errors)
- [ ] Homepage loads at `/developers/overview/about`

### 2.6 Run Parity Harness Against Production Domain

```bash
cd site
node scripts/verify-parity.mjs https://docs.newton.xyz
```

**Expected output:**
```
PARITY OK: 96 routes verified, 16 internal redirects verified, 0 failures
```

- [ ] All 96 routes return 2xx over HTTPS
- [ ] All 16 internal redirects verified
- [ ] 2 external blog redirects working

### 2.7 Verify GA4 and OG Tags (Spot-Check)

Open a browser and visit https://docs.newton.xyz in an incognito tab:

```bash
# Check GA4 ID in page source
curl -s https://docs.newton.xyz | grep -o 'G-[A-Z0-9]*'
# Expected: G-JFG7Z812VK
```

- [ ] GA4 ID present: `G-JFG7Z812VK`
- [ ] Page title displays correctly
- [ ] OG tags for social sharing present (inspect page source or DevTools Network tab)

### 2.8 Checklist: Stage 2 Complete

- [ ] DNS TTL lowered to 300s and waited out old TTL
- [ ] `docs.newton.xyz` added as domain in Vercel project
- [ ] DNS record updated to Vercel's CNAME/A
- [ ] DNS propagation verified (`dig` shows Vercel target)
- [ ] HTTPS works and loads homepage
- [ ] Parity harness passed against https://docs.newton.xyz
- [ ] GA4 and OG tags verified

**Note:** At this point, the Vocs site is live at docs.newton.xyz. Mintlify GitHub App is still connected; if you rollback here, DNS revert takes ~5 minutes and Mintlify site resumes.

---

## Stage 3: Monitor, Then Decommission

**Duration:** ≥24h monitoring + 5 min decommission  
**Risk:** Medium (live production traffic); monitored with abort thresholds

Monitor the live site for errors. If thresholds are breached, execute rollback immediately. Otherwise, after 24h clean, decommission Mintlify.

### 3.1 Establish Monitoring Window

- **Start time:** Post-Stage-2 completion (note the UTC timestamp)
- **Duration:** Minimum **24 hours** of clean traffic
- **Monitoring tools:** Vercel Analytics, GA4, error tracking (Sentry if configured)

### 3.2 Abort Thresholds (Trigger Rollback Immediately)

Monitor for these conditions. **If any threshold is breached, execute rollback immediately** (see Rollback Procedure below):

| Threshold | Metric | Action |
|-----------|--------|--------|
| **5xx errors** | Any 5xx on a **top-level route** (e.g., `/`, `/developers/overview`, `/whitepaper/introduction`, `/protocol/overview`) | Rollback |
| **Error rate** | >2% of all routes returning non-2xx (4xx/5xx) | Rollback |
| **Broken nav path** | Any page in the **primary left sidebar** (e.g., `/developers/overview/about`, `/whitepaper/introduction`, `/protocol/overview`) returns non-2xx or error page | Rollback |

### 3.3 Monitoring Checklist (Sample Every 2–4 Hours)

Every 2–4 hours, run:

```bash
# Spot-check a few top-level routes
curl -s -o /dev/null -w '%{http_code}\n' https://docs.newton.xyz/
curl -s -o /dev/null -w '%{http_code}\n' https://docs.newton.xyz/developers/overview/about
curl -s -o /dev/null -w '%{http_code}\n' https://docs.newton.xyz/whitepaper/introduction
curl -s -o /dev/null -w '%{http_code}\n' https://docs.newton.xyz/protocol/overview

# Expected: All 200 (or appropriate 3xx for redirects, not 5xx)
```

- [ ] All responses 2xx
- [ ] GA4 reports traffic (check dashboard)
- [ ] No error spikes in Vercel Analytics

### 3.4 Post-24h-Clean: Disconnect Mintlify GitHub App

Only after **24 hours of clean traffic** with **no abort-threshold breaches**:

1. Go to the `newton-sdk` repository → **Settings** → **Applications** → **Installed GitHub Apps**
2. Find **"Mintlify"** (or "Mintlify GitHub App")
3. Click **"Uninstall"**
4. Confirm the uninstall

Once uninstalled, the Mintlify GitHub App can no longer auto-deploy. The old Mintlify site is operationally retired (though `main` still has `site/docs.json` and Mintlify can be re-enabled if needed).

### 3.5 Restore Production TTL

Lower DNS TTL was temporary; now restore it to a standard value:

1. Log in to DNS provider
2. Find `docs.newton.xyz` record (currently at 300s)
3. **Restore TTL to production standard** (typically 3600s / 1 hour or higher)
4. Save

### 3.6 Checklist: Stage 3 Complete

- [ ] ≥24h monitoring window completed without abort-threshold breaches
- [ ] Mintlify GitHub App disconnected from repository
- [ ] DNS TTL restored to production (3600s or configured standard)
- [ ] `docs.newton.xyz` stably serving Vocs site

**Cutover is now complete.** Proceed to Post-Cutover Cleanup.

---

## Rollback Procedure (Any Stage)

**If any abort threshold is breached or an unrecoverable issue occurs, rollback immediately.**

### R.1 Revert DNS

```bash
# Restore the Stage 0 DNS record you recorded earlier
# Example: if Stage 0 recorded docs.newton.xyz. 300 IN CNAME docs-new-newton-sdk.mintlify.app.
# then repoint DNS back to docs-new-newton-sdk.mintlify.app
```

1. Log in to DNS provider
2. Find `docs.newton.xyz` record
3. **Change CNAME/A value back to the Stage 0 target** you recorded
4. Save
5. Wait 2–5 minutes for propagation

**Verify:**
```bash
dig +noall +answer docs.newton.xyz CNAME A
# Should show the old Mintlify target
```

### R.2 Confirm Mintlify Site Resumes

```bash
curl -i https://docs.newton.xyz | head -20
# Should load Mintlify site (different styling/structure than Vocs)
```

If Mintlify loads, rollback is successful. If DNS still shows Vercel, retry the DNS update — propagation may be slow.

### R.3 Investigation & Retry

After rollback:
1. Identify what caused the abort (from Vercel logs, GA4, user reports)
2. Fix the issue in the `docs/mintlify-to-vocs-migration` branch
3. Merge to `main`
4. Re-deploy Vercel project (or trigger a new build)
5. Repeat Stages 1–3

**Note:** Because the Mintlify GitHub App **remains connected until Stage 3.4**, the old Mintlify site stays live and DNS revert is the only rollback action needed. No code or configuration cleanup is required to resume Mintlify operation.

---

## Post-Cutover Cleanup

After cutover is confirmed stable (Stage 3 complete), the following cleanup is not urgent but completes the migration:

### C.1 Delete Mintlify Configuration from `main`

Once the monitoring window passes and Mintlify is disconnected, the `site/docs.json` and Mintlify assets can be safely deleted from `main`:

```bash
git rm site/docs.json site/.mintlify/ site/.mintignore site/agent.md site/README.md
git commit -m "docs: remove Mintlify configuration (cutover complete)"
git push
```

(These deletions may have already merged from the migration branch; if so, no action needed.)

### C.2 Archive Mintlify Dashboard (Optional)

In the Mintlify dashboard:
1. Archive the Newton SDK documentation project (if not already archived)
2. This prevents accidental re-deployment

---

## Cutover Ticket Template

Use this checklist in your cutover ticket to track progress:

```markdown
## Vocs Cutover Ticket

### Stage 0: Baseline
- [ ] DNS record captured: [paste dig output]
- [ ] Mintlify GitHub App confirmed connected
- [ ] Capture timestamp: [UTC]

### Stage 1: Build & Host Preflight
- [ ] Vercel project created, Root Directory = site
- [ ] Build succeeded (Ready status)
- [ ] Three redirects verified (curl checks)
- [ ] Parity harness passed

### Stage 2: Mapped-Domain Preflight
- [ ] DNS TTL lowered to 300s and waited
- [ ] docs.newton.xyz added to Vercel project
- [ ] DNS record updated to Vercel CNAME/A
- [ ] DNS propagation verified (dig)
- [ ] HTTPS loads homepage
- [ ] Parity harness passed against https://docs.newton.xyz
- [ ] GA4 ID G-JFG7Z812VK verified
- [ ] Go-live timestamp: [UTC]

### Stage 3: Monitor & Decommission
- [ ] ≥24h monitoring window started: [UTC]
- [ ] Spot-checks passed (all 200 responses)
- [ ] No 5xx on top-level routes
- [ ] Error rate <2%
- [ ] No broken nav paths
- [ ] Monitoring window completed: [UTC]
- [ ] Mintlify GitHub App disconnected
- [ ] DNS TTL restored to production
- [ ] Cutover complete timestamp: [UTC]

### Post-Cutover
- [ ] Mintlify dashboard archived (optional)
- [ ] Cleanup commit merged (docs.json removed)

**Cutover Owner:** [name]
**Approver:** [name]
```

---

## Troubleshooting

### Vercel Build Fails

**Symptom:** Deployments tab shows red "Failed" status.  
**Action:**
1. Review build logs in Vercel Deployments tab
2. Common causes: missing dependencies, TypeScript error, vocs.config.ts syntax error
3. Fix in repo and push; Vercel auto-rebuilds
4. If stuck, contact the SDK team (code issue)

### Parity Harness Fails

**Symptom:** `verify-parity.mjs` reports missing routes or broken redirects.  
**Action:**
1. Check which routes are failing: `node scripts/verify-parity.mjs <url> 2>&1 | grep FAIL`
2. Curl the failing route directly: `curl -v https://docs.newton.xyz/[route]`
3. If 404, the route may be orphaned or the page was deleted (check commit history)
4. If error page, likely a frontmatter or component import issue (check logs, fix in repo)

### DNS Not Propagating

**Symptom:** `dig docs.newton.xyz` still shows old Mintlify target after 10+ minutes.  
**Action:**
1. Clear local DNS cache: `sudo dscacheutil -flushcache` (macOS) or `sudo systemctl restart systemd-resolved` (Linux)
2. Retry `dig` from a different network (mobile hotspot) to rule out ISP cache
3. Wait another 5 minutes; TTL-based caches can be slow
4. If >20 minutes and still not updated, verify DNS record was actually saved in the provider's dashboard

### Rollback Not Working (DNS Still Points to Vercel)

**Symptom:** After DNS revert, `dig` still shows Vercel.  
**Action:**
1. Verify DNS change was saved in the provider's dashboard (not just the form; refresh the page)
2. Check for a DNS alias/subdomain override (e.g., a separate CNAME for `docs.newton.xyz`)
3. If a CNAME chain exists, update the **final target**, not an intermediate
4. Wait another 5 minutes; slow propagation can occur

---

## Summary

| Stage | What | Duration | Risk | Rollback |
|-------|------|----------|------|----------|
| **0** | Record DNS baseline | 5 min | None | N/A (read-only) |
| **1** | Build & validate on `*.vercel.app` | 15 min | Low (preview only) | Delete Vercel project |
| **2** | Add domain, point DNS | 15 min + TTL | Medium (live, but <5min revert) | DNS revert (~5 min) |
| **3** | Monitor 24h, decommission | 24h + 5 min | Medium (live) | DNS revert + re-enable Mintlify (~5 min) |

**Key principle:** Prove the Vocs site healthy on Vercel-owned infrastructure first (Stage 1), then on mapped production domain (Stage 2), then monitor (Stage 3). Mintlify stays live until Stage 3.4, enabling zero-downtime rollback at any step.
