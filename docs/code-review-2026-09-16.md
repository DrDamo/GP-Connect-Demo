# GP-Connect-Demo — full code review (16 September 2026)

Scope: the whole repository at commit `87afcd2` on `main`, plus the live Supabase project `GP Connect Demo` (`bkvmtftimqeybkffczot`) and the Vercel project `gp-connect-demo`. Reviewed as healthcare‑adjacent code that could plausibly hold patient‑shaped data.

## Executive summary

**Headline risk: HIGH.** The repository is public on GitHub, and it contains a working admin password for an account that exists in the live database. Two further design issues let any anonymous internet user consume the NHS Terminology Server credentials and let any self‑signed‑up user edit the training content shown to every organisation.

New findings (the six already-confirmed advisor items are fixed and listed separately):

| Category | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| 1. Security | 1 | 3 | 6 | 5 | 15 |
| 2. Correctness / bugs | – | 3 | 6 | 5 | 14 |
| 3. Inconsistencies | – | – | 4 | 6 | 10 |
| 4. Redundant / dead code, tidy‑up | – | – | 2 | 8 | 10 |
| **Total** | **1** | **6** | **18** | **24** | **49** |

Fixed in this branch (`claude/laughing-volta-76r3om`) and applied to the live database:

- S‑01 to S‑06 (the six known advisor issues) — see the "Already‑confirmed" block in section 1. Three new migration files mirror what is now live; migration 007 was applied for the first time.
- A root `.env.example` (placeholders only) and a `.gitignore` fix so it is not ignored.

Everything else is a recommendation with a proposed fix; nothing outside `supabase/`, `.env.example` and `.gitignore` was changed.

Things to do today, in order:

1. Rotate the password of `drdamo@gpc-demo.local` in the Supabase dashboard (S‑07).
2. Decide who may edit global training content and apply the policy change (S‑08).
3. Put an auth check and an origin restriction on the Vercel `api/` functions (S‑09).
4. Enable leaked‑password protection in Supabase Auth (S‑15).

---

## 1. Security

### Already‑confirmed items (from live Supabase advisors) — fixed

| # | Item | Verified finding | Fix |
|---|---|---|---|
| S‑01 | SECURITY DEFINER functions callable via RPC by `anon` / `authenticated` | `current_org_id()` and `current_user_role()` (`supabase/migrations/004_fix_rls_recursion.sql:18-36`) read only the **caller's own** `profiles` row, which the caller can already read under `read_own_profile`, so they leak nothing. They **must** stay executable by `authenticated`: RLS policy expressions run with the privileges of the querying role, so revoking from `authenticated` breaks every org‑scoped policy. `anon` gets `null` from both (no `auth.uid()`), so there is no reason to expose them. `handle_new_user()` (`005_self_serve_signup.sql:20-49`) returns `trigger`; Postgres refuses to call trigger functions directly, so `/rpc/handle_new_user` could never run it, but it should only be executable by the role that fires the `auth.users` trigger. | `20260916135814_security_hardening.sql` revokes EXECUTE from `PUBLIC` and `anon` on the two helpers and grants `authenticated`, `service_role`; revokes from `PUBLIC`, `anon`, `authenticated` on `handle_new_user()` and grants `supabase_auth_admin`. The advisor still reports lint 0029 for `authenticated` on the two helpers — that is intentional and documented in the migration. |
| S‑02 | `set_updated_at` mutable `search_path` | The repo's definition (`001_initial.sql:36-39`) has no `search_path`. The live function already had `SET search_path = ''` from a migration (`20260916104124`) that had been applied to the project but never committed. | Committed the live migration verbatim as `20260916104124_fix_search_path_and_rls_initplan.sql` so git matches the database. |
| S‑03 | Two overlapping permissive SELECT policies on `profiles` | `read_own_profile` (`id = auth.uid()`) and `org_members_read_profiles` (`org_id = current_org_id()`). The second does **not** strictly subsume the first: `profiles.org_id` is nullable (`001_initial.sql:18`), and a profile with a null `org_id` would be invisible to its own owner under the org policy alone (`null = null` is not true). | Consolidated into one policy `read_profiles` (`id = (select auth.uid()) or org_id = current_org_id()`), scoped `to authenticated`. |
| S‑04 | Policies calling `auth.uid()` per row | Repo files `001`, `003`, `006`, `007` use bare `auth.uid()`. The live database already had the initplan form for the tables that exist, from the uncommitted migration above. `007` had never been applied anywhere. | Committed the live migration; rewrote `007_onboarding_progress.sql:24-28` to `(select auth.uid())` before applying it. All policies are also now `to authenticated` (`20260916140058_scope_policies_to_authenticated.sql`), so anon short‑circuits instead of evaluating org policies (and, after S‑01, instead of failing with `42501`). |
| S‑05 | `list_migrations` empty / schema drift | Drift in both directions. (a) `supabase_migrations.schema_migrations` contained only `20260916104124`, which is not in git; migrations 001‑007 were run by hand in the SQL editor and are untracked. (b) `007_onboarding_progress.sql` was **never applied**: the live database had no `user_tour_progress` or `user_hint_dismissals` tables, so every call in `src/onboarding/OnboardingContext.tsx:64-77, 82-92, 140-159` was failing silently (see C‑03). Tables, columns, functions, triggers and policies for 001‑006 otherwise match. | Applied 007 live (`20260916135800`). Committed the missing migration. Recommendation: run `supabase migration repair --status applied 001 002 003 004 005 006 007` (or renumber them with timestamps) so `supabase db push` works, and stop applying SQL through the dashboard. |
| S‑06 | Five unindexed foreign keys | `patient_drafts.org_id` and `profiles.org_id` are filtered by every RLS policy, so they are hit on every read. `patient_drafts` is listed ordered by `updated_at` within org (`src/shared/SharedPatientsView.tsx:36-39`). The `created_by`/`updated_by` columns matter for the FK integrity check when a profile is deleted (cascade from `auth.users`) and for the `created_by = auth.uid()` branch of the notes policies. | Added `(org_id, updated_at desc)` on `patient_drafts` plus single‑column indexes on the other four. The advisor now reports them as "unused" — expected for brand‑new indexes on tables with 0‑3 rows. |

Post‑fix verification (run against the live database as the `authenticated` and `anon` roles):

| Role | profiles | organisations | patient_drafts | training_content | tour tables | helper functions |
|---|---|---|---|---|---|---|
| authenticated (first admin user) | 1 visible | 1 | 3 | 1 | query OK | resolve org id and role |
| anon | 0 | 0 | 0 | 0 | 0 | EXECUTE denied |

### New findings

**S‑07 · CRITICAL · Working admin password committed to a public repository**
`api/account/setup.ts:46-51`, `scripts/setup-user.mjs:49-50,68`, `scripts/repair-auth-user.mjs:61,68-70`
The password `CopyCat-33` for `drdamo@gpc-demo.local` is hard‑coded in three files and in git history (`git log -S CopyCat`). The repository returns HTTP 200 unauthenticated, and the live `auth.users` table contains exactly one `@gpc-demo.local` account. The login page (`src/auth/AuthContext.tsx:99`) maps username `DrDamo` to that email. Failure scenario: anyone reading GitHub signs in as an `admin`, reads every patient draft in that organisation and edits the global training content. The `SETUP_TOKEN` guard on the endpoint does not help because the *password* is the secret that leaked.
Fix: rotate the password now (Supabase dashboard → Authentication → Users). Then delete `api/account/setup.ts` (self‑serve signup in migration 005 superseded it) and make the two scripts read the password from an env var:
```js
const password = process.env.SETUP_ADMIN_PASSWORD
if (!password) { console.error('Set SETUP_ADMIN_PASSWORD'); process.exit(1) }
```
Also replace `token !== setupToken` (`api/account/setup.ts:9`) with a constant‑time compare if the endpoint is kept.

**S‑08 · HIGH · Every self‑signed‑up user is an `admin` who can edit global training content**
`supabase/migrations/005_self_serve_signup.sql:38-45` (role `'admin'`), `003_training_content_and_notes.sql:6-8, 51-65`, `004_fix_rls_recursion.sql:66-76`
`training_content` is explicitly "one shared version across all orgs", but its insert/update/delete policies only check `current_user_role() = 'admin'`, and the signup trigger makes every new user the admin of a fresh org. All four live profiles are `admin`. Failure scenario: an attacker signs up with any email, opens Training → Edit, and rewrites the clinical guidance every other organisation sees (react‑markdown blocks raw HTML, so this is content defacement / misinformation and phishing links rather than script injection).
Fix (pick one): (a) add `is_platform_admin boolean default false` to `profiles` and use it in the three `training_content` write policies; or (b) make overrides org‑scoped by adding `org_id` to `training_content` with a unique `(org_id, page_id)` and `org_id = current_org_id()` in every policy. Option (b) matches how `training_notes` already works. Also hide the Edit button in `src/components/training/TrainingView.tsx` behind the same flag.

**S‑09 · HIGH · Terminology proxy is an open, unauthenticated relay with `Access-Control-Allow-Origin: *`**
`api/snomed/search.ts:6`, `api/dmd/search.ts:6`, `api/snomed/validate-batch.ts:9`, `api/snomed/status-batch.ts:12`, `api/dmd/validate-batch.ts:9`, `api/health.ts:6`
Every function accepts requests from any origin with no credential and forwards them to the NHS England Terminology Server under the project's system‑to‑system client credentials. Failure scenario: anyone scripts `https://gp-connect-demo.vercel.app/api/snomed/search?q=…` and consumes the account's quota, or gets it suspended for breaching the terms of the system‑to‑system agreement. The batch endpoints also accept unbounded arrays (`api/snomed/validate-batch.ts:13-18`), so one request can fan out into hundreds of upstream calls.
Fix: require the Supabase session JWT and check it server‑side, restrict CORS to the app origin, and cap batch sizes:
```ts
// api/_lib/requireUser.ts
import { createClient } from '@supabase/supabase-js'
export async function requireUser(req: VercelRequest): Promise<string | null> {
  const auth = req.headers.authorization ?? ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!jwt) return null
  const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
  const { data, error } = await sb.auth.getUser(jwt)
  return error ? null : data.user.id
}
// in each handler
res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN ?? 'https://gp-connect-demo.vercel.app')
if (!(await requireUser(req))) { res.status(401).json({ error: 'Sign in required' }); return }
if (codes.length > 2000) { res.status(413).json({ error: 'Too many codes' }); return }
```
The frontend already sends `Authorization: Bearer <token>` when a token is stored (`src/fhir/snomedDegrade.ts:140-141`, `src/builder/forms/shared/SnomedPicker.tsx:345`), so pass `session.access_token` there.

**S‑10 · HIGH · Silent clinical‑code rewriting on any upstream per‑entry failure**
`api/_lib/lookup.ts:63-66` (compare with the guarded version at `:174-177`), consumed by `src/fhir/snomedDegrade.ts:264-291` and `src/App.tsx:203-226`
`validateCodesBatch` sets `results[code] = result === true`, so a missing or non‑2xx batch entry (upstream 429/500 for that entry, or a truncated response) becomes `false`. The frontend then rewrites the coding to a "Transfer‑degraded" SNOMED concept, re‑serialises the bundle, and shows/downloads it. Failure scenario: a transient terminology‑server hiccup silently converts a valid problem code into "Transfer‑degraded record entry" in the file the user downloads. For a tool that demonstrates GP Connect behaviour this is a clinical‑safety‑relevant correctness defect, so it is listed here rather than under bugs.
Fix:
```ts
chunk.forEach((code, idx) => {
  const entry = entries[idx]
  if (!entry?.response?.status?.startsWith('2') || !entry.resource) return // unknown — leave unset
  const result = entry.resource.parameter?.find(p => p.name === 'result')?.valueBoolean
  if (typeof result === 'boolean') results[code] = result
})
```
`snomedDegrade.ts:266` already treats an absent key as "not degraded", so nothing else changes. Mirror the fix in `server/src/fhir/lookup.ts`.

**S‑11 · MEDIUM · Patient‑shaped data stored in plaintext columns and in `localStorage`**
`001_initial.sql:28-29`, `src/builder/views/BuilderView.tsx:242-243, 267-268`, `src/builder/hooks/useDraftRecord.ts:1355-1359`
`nhs_number` and `patient_name` are separate indexed‑by‑nothing plaintext columns, `draft_data` holds the whole record, and the builder persists the full draft to `localStorage` on every keystroke. Failure scenario: a trainee pastes a real record "to see how it renders"; it now lives in a shared table readable by the whole org, and in the browser profile of a shared training PC. `AccountPage` also collects the user's own date of birth and address (`006_account_details.sql:10-13`) with no stated purpose.
Fix: keep the "test data only" banner but enforce it — reject NHS numbers that pass the Modulus‑11 check unless they are in the 999 test range, clear `gpc-builder-draft` on sign‑out, and drop the `date_of_birth`/`address` columns unless they are needed.

**S‑12 · MEDIUM · `update_own_profile` does not pin `username` although its comment says it does**
`006_account_details.sql:15-26`
The `WITH CHECK` pins `org_id` and `role` but not `username`. PostgREST accepts any column, so a user can rename themselves (subject only to the unique index). Failure scenario: a member sets `username` to a near‑duplicate of a colleague's and their drafts show "by <that name>" in `SharedPatientsView`. Fix: add `and username = (select username from public.profiles where id = (select auth.uid()))` — or simpler, a `current_username()` helper alongside the other two.

**S‑13 · MEDIUM · `patient_drafts.created_by` is not pinned to the caller**
`001_initial.sql:75-78`, `src/builder/views/BuilderView.tsx:241`
The insert policy checks `org_id` only. A member can attribute a draft to any colleague. Fix: `with check (org_id = current_org_id() and created_by = (select auth.uid()))`, as `training_notes` already does.

**S‑14 · MEDIUM · `api/health.ts` discloses upstream configuration to anyone**
`api/health.ts:8`, `server/src/routes/health.ts:9-13`
Returns `fhirBase` and whether a live bearer token is cached. Low value to an attacker, zero value to the app in production (`SnomedPicker.tsx:179` only calls it from the dev config modal). Fix: return `{ status: 'ok' }` only, or put it behind S‑09's auth check.

**S‑15 · MEDIUM · Leaked‑password protection disabled** (Supabase advisor `auth_leaked_password_protection`)
Self‑serve signup accepts any 8‑character password (`src/auth/SignupPage.tsx:28`). Fix: Dashboard → Authentication → Providers → Email → "Prevent use of leaked passwords". See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

**S‑16 · MEDIUM · Signup error messages enable account enumeration**
`src/auth/AuthContext.tsx:122` returns `error.message` verbatim ("User already registered"). Login (`:101`) is already generic. Fix: map to a generic message and rely on the confirmation email.

**S‑17 · LOW · Service‑role key / `VITE_` audit — clean**
Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` reach the bundle (`src/lib/supabase.ts:3-4`); `SUPABASE_SERVICE_ROLE_KEY` is read only in `api/account/setup.ts:14` and the two scripts. No `.env` file has ever been committed (`git log --all -- .env .env.local server/.env` is empty) and no JWT‑shaped strings appear in history. One wrinkle: the scripts expect the service‑role key in `server/.env` (`scripts/setup-user.mjs:3,23`), so the *terminology proxy's* env file becomes the home of the most privileged secret in the project. Keep it in the root `.env.local` only.

**S‑18 · LOW · XML external entities — not exploitable, but disable entity processing anyway**
`src/fhir/parser.ts:15-25`
Parsing runs in the browser with `fast-xml-parser` 5.x, which never fetches external entities and caps internal entity expansion (`processEntities.maxTotalExpansions`). I confirmed a `<!DOCTYPE … <!ENTITY …>>` payload is not expanded with the current options. FHIR XML never needs custom entities, so add `processEntities: false` to remove the question entirely.

**S‑19 · LOW · Markdown rendering — safe**
`src/components/training/MarkdownContent.tsx:29-31, 63-72`
`react-markdown` v10 with `remark-gfm` and no `rehype-raw`: raw HTML is escaped and `javascript:` hrefs are stripped by the default `urlTransform`. No `dangerouslySetInnerHTML` anywhere in `src/`. Training content and notes are therefore text‑only even though admins and org members can write them.

**S‑20 · LOW · Terminology server URL is user‑controllable via `localStorage`**
`src/fhir/snomedDegrade.ts:125-135`, `src/builder/forms/shared/SnomedPicker.tsx:69-95`
Every SNOMED code in a loaded bundle is POSTed to whatever `serverUrl` sits in `gpc-snomed-config`. In production the config modal is hidden, so only the user's own devtools can change it; in dev it is a feature. Acceptable, but pin production to `window.location.origin` and ignore the stored value when `!import.meta.env.DEV`.

**S‑21 · LOW · Node dev proxy has no auth or rate limit either**
`server/src/index.ts:10` (`cors()` with defaults). Only relevant if someone deploys `server/`; see I‑01.

---

## 2. Correctness / bugs

**C‑01 · HIGH · XML bundles: single repeating elements are parsed as objects, and the extractors then crash**
`src/fhir/parser.ts:21-24` lists 15 element names that are forced to arrays. FHIR has many more repeating elements. Confirmed by running the parser with the same options: an `<Observation>` with one `<component>` yields `component: {…}` and one `<security>` under `<meta>` yields an object. Consumers that then throw `TypeError: … is not a function`: `src/fhir/utils.ts:279` and `:115` (`.map`/`.some`), `src/fhir/validator.ts:310, 405`, `src/fhir/codedData.ts:41, 95`, `src/fhir/investigations.ts:225`, `src/fhir/consultations.ts:109`. Because `handleLoad` (`src/App.tsx:187-199`) has no try/catch around `validateMedicationsBundle`/`buildRecordFromBundle`, the exception escapes the click handler: nothing loads and no parse error is shown. Failure scenario: any real GP Connect XML bundle with a blood‑pressure Observation or a NOPAT label does nothing when dropped onto the page.
Fix: invert the rule — treat everything as an array except known singletons, or extend the list:
```ts
isArray: (name, jpath) => !FHIR_SINGLETONS.has(name) && REPEATING.has(name)
// REPEATING should at least add: component, security, profile, tag, contained, given, prefix,
// suffix, line, participant, type, result, reaction, manifestation, link, relationship,
// item, diagnosis, location, author, content, dosageInstruction, interpretation, referenceRange,
// reasonReference, supportingInfo, specimen, recipient, serviceRequested, specialty, event
```
and wrap the two synchronous calls in `handleLoad` in a try/catch that sets `parseError`.

**C‑02 · HIGH · Shared‑patient saves have no optimistic‑concurrency check**
`src/builder/views/BuilderView.tsx:265-274`
`version` is bumped client‑side and the update matches on `id` only. Two colleagues who "Load into builder" the same record and both save will silently overwrite each other; the loser's work is gone and both think they saved `v3`. Fix: `.eq('id', currentDraftId).eq('version', currentVersion).select('id')` and treat an empty result as a conflict ("This record was changed by someone else — reload before saving").

**C‑03 · HIGH (was live) · Onboarding progress never persisted**
`src/onboarding/OnboardingContext.tsx:64-77, 82-92, 140-159`
The two tables did not exist in production (S‑05). Every insert/select failed; errors are swallowed by `.then(() => {})`, and `writeLocalSet` is skipped whenever Supabase is configured (`:86, :102, :144`). Result: the "home" tour auto‑started on every page load for every user. Now fixed by applying migration 007, but the code should not fail silently: log `error` from each call, and fall back to `localStorage` when the write fails.

**C‑04 · MEDIUM · Supabase calls inside `onAuthStateChange`**
`src/auth/AuthContext.tsx:83-91`
`loadProfile` issues two PostgREST queries from inside the auth callback. Supabase's docs warn this can deadlock the client ("avoid using other Supabase functions inside the callback… use `setTimeout`", https://supabase.com/docs/reference/javascript/auth-onauthstatechange). It also duplicates the `getSession()` load at `:75-82` because `INITIAL_SESSION` fires immediately. Fix: drop the `getSession()` block and call `setTimeout(() => loadProfile(session.user.id), 0)` from the callback; set `isLoading` false there.

**C‑05 · MEDIUM · `SharedPatientsView` shows "Loading…" forever when the profile is missing**
`src/shared/SharedPatientsView.tsx:32-43`
`fetchRows` returns early on `!profile` without `setLoading(false)`. A user whose `profiles` row failed to load (admin‑provisioned account, trigger not fired, or the `loadProfile` race above) sees a permanent spinner. Fix: `if (!supabase || !profile) { setLoading(false); return }` as `useTrainingNotes.ts:22` already does.

**C‑06 · MEDIUM · Errors ignored on delete/insert/update**
`src/shared/SharedPatientsView.tsx:60-65`, `src/components/training/hooks/useTrainingNotes.ts:38-59`, `src/onboarding/OnboardingContext.tsx:90, 106, 148, 157`
Supabase returns errors as values; every one of these discards them, so an RLS rejection (e.g. a `staff` user deleting an admin's note) looks like success followed by the row reappearing on refetch. Fix: destructure `{ error }` and surface it (the component already has `setError`).

**C‑07 · MEDIUM · `Profile.org_id` typed as required but nullable in the schema**
`src/auth/AuthContext.tsx:9, 59, 65`, `001_initial.sql:18`
`profileData as Profile` asserts `org_id: string`; the column is nullable. With a null `org_id` the code runs `.eq('id', null)` for the organisation and every RLS policy silently returns nothing. Fix: either `alter column org_id set not null` (nothing in the repo creates a null one) or type it `string | null` and handle it.

**C‑08 · MEDIUM · `limit` query parameter is not validated**
`api/snomed/search.ts:10`, `api/dmd/search.ts:10`, `server/src/routes/snomed.ts:12`, `server/src/routes/dmd.ts:13`
`Math.min(parseInt('abc'), 50)` is `NaN`, which becomes `count=NaN` on the upstream URL and a 502. Negative values pass through too. Fix: `const limit = Math.min(Math.max(Number.parseInt(raw, 10) || 10, 1), 50)`.

**C‑09 · MEDIUM · Token exchange is not de‑duplicated**
`api/_lib/auth.ts:10-36`, `server/src/auth.ts`
`checkSnomedStatuses` fires two requests in parallel (`src/fhir/snomedDegrade.ts:198-208`); on a cold instance both miss the cache and both POST to the NHS token endpoint. Fix: cache the in‑flight promise:
```ts
let inflight: Promise<string> | null = null
export function getToken() { return inflight ??= fetchToken().finally(() => { inflight = null }) }
```

**C‑10 · LOW · `npm run lint` fails with 63 errors on `main`**
`eslint.config.js` enables `eslint-plugin-react-hooks` v7, whose new `set-state-in-effect` rule flags 14 sites, plus 27 `no-explicit-any`, 9 `no-empty`, 7 `react-refresh/only-export-components`, 5 `no-unused-expressions`, 1 `no-irregular-whitespace`. `tsc -b` passes. Failure scenario: nobody runs lint because it is always red, so new real findings are missed. Fix: either downgrade the two new rules to `warn` in `eslint.config.js` or fix them; add `npm run lint` to the Vercel build command.

**C‑11 · LOW · `api/tsconfig.json` no longer compiles under the pinned TypeScript**
`api/tsconfig.json:5` uses `moduleResolution: node`, which TypeScript 6 (`package.json:41`) rejects with TS5107. Vercel compiles functions with its own toolchain so production still works, but `npx tsc -p api` fails locally. Fix: `"moduleResolution": "node16"` (or `bundler`) and `"module": "node16"`.

**C‑12 · LOW · Explicit `any` that bypasses the FHIR types**
27 sites, concentrated in `src/fhir/utils.ts:279, 317, 330, 342, 361, 379`, `src/fhir/immunisations.ts:56, 60-61`, `src/fhir/problems.ts:5, 17`, `src/fhir/documents.ts:7, 9`, `src/fhir/diaryEntries.ts:7, 9`. Most are `(e.resource as any)?.id` lookups that `resolveReference` in `utils.ts` already types correctly, or STU3 fields that `@types/fhir` does have (`Immunization.explanation.reason` is typed). Fix: replace the id lookups with `resolveReference`/`getEntries`, and type the rest as `fhir3.*`.

**C‑13 · LOW · No Zod schemas exist**
`package.json:29` lists `zod` but nothing imports it (`grep -r "from 'zod'" src` is empty). FHIR validation is the hand‑written `src/fhir/validator.ts`, and DB rows are cast without runtime checks (`SharedPatientsView.tsx:57`, `useTrainingNotes.ts:29`). The hand‑written rules I checked are right for STU3 (`MedicationStatement.taken` 1..1, `Immunization.notGiven` 1..1, `AllergyIntolerance.patient` 1..1). Fix: either use Zod to validate `draft_data` on load (it is the one untrusted JSON blob that reaches the reducer) or remove the dependency.

**C‑14 · LOW · `SnomedPicker` sends `sort=relevance`, which no backend implements**
`src/builder/forms/shared/SnomedPicker.tsx:342`; neither `api/snomed/search.ts` nor `server/src/routes/snomed.ts` reads it. Harmless today; remove it or implement it.

---

## 3. Inconsistencies

**I‑01 · MEDIUM · Why `api/` and `server/` both exist, and which to keep**
`server/` is the local‑development Express proxy: `vite.config.ts:9` proxies `/api` to `localhost:3001`, and `package.json:10` starts it. `api/` is the Vercel port of the same code for production (`SnomedPicker.tsx:97-99`). They are not a "second, less‑guarded path to patient data": neither touches Supabase except `api/account/setup.ts`. But they are ~600 duplicated lines (`server/src/fhir/{expand,lookup,mappers,normalForm,types}.ts` vs `api/_lib/*`, `server/src/auth.ts` vs `api/_lib/auth.ts`), and they have already diverged (I‑02, I‑03). `server/` is therefore **redundant**, not merely inconsistent. Recommendation: keep `api/` as the single implementation and run it locally with `vercel dev` (change the Vite proxy target to `http://localhost:3000`); port the two dev‑only `/lookup` routes into `api/`; delete `server/`. If you prefer to keep Express, make `server/src` import from `api/_lib` instead of copying it. I could not find any statement of intent in the repo (README is the Vite template, `CLAUDE.md` is empty), so this is inferred from the Vite proxy and the picker comments — **question for the author: is `server/` still used by anyone, or is it only there for `npm run dev`?**

**I‑02 · MEDIUM · Behaviour differs between dev and production for allergy searches**
`api/_lib/mappers.ts:29-30` maps semantic tag `allergy` to ECL `<< 420134006`; `server/src/fhir/mappers.ts` has no such entry. `src/builder/forms/AllergyForm.tsx:120` passes `semanticTag="substance,product,allergy"`. In production the allergy hierarchy is searched; in dev it is silently dropped. Fix: consolidate per I‑01.

**I‑03 · MEDIUM · Endpoints present in one backend and not the other**
`server/src/routes/snomed.ts:37` and `dmd.ts:44` expose `/lookup`, which `SnomedPicker.tsx:424` and `DmdPicker.tsx:210` call from the dev‑only debug panel; `api/` has no such functions, so in production the call hits the SPA rewrite (`vercel.json:4-6`), gets `index.html`, and `res.json()` throws. Default dm+d limit is 25 in `server/src/routes/dmd.ts:13` and 10 in `api/dmd/search.ts:10` (the frontend passes an explicit limit, so this is latent).

**I‑04 · MEDIUM · README, CLAUDE.md and the checked‑in skill file describe a different project**
`README.md` is the unmodified Vite template. `CLAUDE.md` is empty. `.claude/skills/run-gp-connect-demo/SKILL.md` is tracked even though `.gitignore:19` ignores `.claude/`, and it hard‑codes `/home/drdamo/GP-Connect-Demo` and a GitHub Pages base path (`/GP-Connect-Demo/`) while the app deploys on Vercel at `/`. A new developer cannot discover: the two backends, the `.env` variables (now in `.env.example`), how migrations are applied, or the org/profile/role model. The README should cover: what the app is (GP Connect Access Record Structured demonstrator, FHIR STU3, not a clinical system); setup (`npm ci`, `.env.local`, `npm run dev`, terminology proxy); required env vars and which are public; architecture (frontend, `api/` Vercel functions, Supabase with RLS, the terminology proxy); deployment (Vercel, Supabase migrations via CLI); the multi‑tenancy model (organisation → profiles with `admin`/`staff`, self‑signup creates an org, what admins can do); and the "test data only" policy from S‑11.

**I‑05 · LOW · Response shape naming diverges across the API**
`SnomedResult` is snake_case (`display_term`, `fully_specified_name`, `semantic_tag` — `api/_lib/mappers.ts:4-9`) while `DmdResult`, `CodeStatus` and every batch response are camelCase. The frontend mirrors both. Pick one (camelCase matches the rest of the codebase) when consolidating per I‑01.

**I‑06 · LOW · `validateMedicationsBundle` / `GpConnectMedicationsRecord` "backward‑compat" aliases**
`src/fhir/validator.ts:486`, `src/fhir/types.ts:557`. `App.tsx:22, 38` uses the aliases; `BuilderView.tsx:5` uses `validateBundle`. Two names for one thing in a codebase with no external consumers. Fix: replace the two imports and delete the aliases.

**I‑07 · LOW · Dead login stubs in both backends**
`api/auth/login.ts` and `server/src/index.ts:17-23` return 410 for an endpoint nothing in `src/` calls (`grep -r "/api/auth" src` is empty). Delete both.

**I‑08 · LOW · `express` 4 with `@types/express` 5**
`server/package.json:14, 18`. Type definitions for a major version you are not running. Align to one or the other (moot if `server/` is removed).

**I‑09 · LOW · Vercel routing relies on function precedence over the catch‑all rewrite**
`vercel.json:4-6` rewrites `/(.*)` to `index.html`. Vercel checks the filesystem (including `api/` functions) before rewrites, so this works, but a typo'd or missing function returns HTML with HTTP 200 (see I‑03). Add an explicit `{ "source": "/api/(.*)", "destination": "/api/$1" }` first, or a `404` function, so missing endpoints fail loudly.

**I‑10 · LOW · `.gitignore` ignored the file that documents the environment**
`.gitignore:15` (`.env.*`) matched `.env.example`. Fixed in this branch with `!.env.example`.

---

## 4. Redundant / dead code and structural tidy‑up

**R‑01 · MEDIUM · Duplicated backend (see I‑01)** — the single biggest tidy‑up; ~600 lines.

**R‑02 · MEDIUM · Oversized modules**
`src/builder/hooks/useDraftRecord.ts` (1,362 lines: one reducer with 60+ actions plus migration code), `src/App.tsx` (780 lines: tab routing, load pipeline, theme handling, and six inline page layouts), `src/builder/forms/shared/SnomedPicker.tsx` (656 lines: three modals plus the picker), `src/fhir/investigations.ts` (657), `src/components/InspectorView.tsx` (561), `src/builder/views/BuilderView.tsx` (535). Suggested cuts: split `useDraftRecord` into per‑domain reducer slices combined by a root reducer, and `migrateDraft` into its own file; move the six `<main>` layouts in `App.tsx` into a `WorkspaceShell` component that takes `tab` and children; move `SnomedInfoModal`/`ConfigModal` out of `SnomedPicker.tsx`.

**R‑03 · LOW · Unused dependencies and phantom dependencies**
`package.json:29` `zod` (unused, see C‑13); `codemirror` (`:19`) is never imported directly while `@codemirror/view`, `@codemirror/state` and `@codemirror/language` are imported (`src/components/CodeMirrorView.tsx:2-6`, `TrainingMarkdownEditor.tsx:2-4`) but not listed — they only resolve because the `codemirror` meta‑package pulls them in. List the three explicitly and drop the meta‑package. `@types/fhir` (`:15`) and `@types/react-syntax-highlighter` (`:16`) belong in `devDependencies`.

**R‑04 · LOW · Dead code**
`src/components/clinical/DomainPlaceholder.tsx` (component never imported), `src/builder/sampleData.ts:448` `createFullSampleDraft`, `src/fhir/utils.ts:181` `resolveResourceName`, the 17 `Fhir*` type aliases in `src/fhir/types.ts:3-19` (nothing imports them; every file uses the global `fhir3.*` namespace), `api/auth/login.ts` and the Express equivalent (I‑07), `api/account/setup.ts` (superseded by migration 005 and the scripts; and see S‑07).

**R‑05 · LOW · Exports that are only used in their own file**
`FHIR_EXAMPLES` (`fhirExamples.ts:7`), `NOPAT_SECURITY_CODING` (`generate/security.ts:11`), `parseToIso` (`DateField.tsx:40`), `TITLE_KEY_PREFIX` (`lineIndex.ts:44`), `extractSnomedDisplay` (`utils.ts:125`), `findSnomedCodings` (`snomedDegrade.ts:58`), and 15 `*Props` interfaces. Not harmful, but `react-refresh/only-export-components` flags the component files and `noUnusedLocals` cannot catch exported dead code. Drop the `export` keyword where nothing imports it.

**R‑06 · LOW · Four copies of the terminology‑config `localStorage` logic**
`SnomedPicker.tsx:67-95`, `DmdPicker.tsx:65-80`, `snomedDegrade.ts:123-135`, `BuilderView.tsx:88-96` all read/write `gpc-snomed-config`, three of them with the `localhost:3000 → 3001` migration. Extract `src/lib/terminologyConfig.ts` with `loadConfig()`, `saveConfig()`, `defaultServerUrl()`.

**R‑07 · LOW · `downloadJson` implemented twice**
`src/builder/views/BuilderView.tsx:33-43` and inline at `src/App.tsx:744-750`. Move to `src/lib/download.ts`.

**R‑08 · LOW · Resource‑by‑id lookup reimplemented with `any`**
`(bundle.entry ?? []).find(e => (e.resource as any)?.id === id)` appears at `utils.ts:342, 361`, `immunisations.ts:56`, `problems.ts:5, 17` while `resolveReference` (`utils.ts`) already does it with types (C‑12).

**R‑09 · LOW · `parseEnvFile` duplicated in both scripts**
`scripts/setup-user.mjs:8-17` and `scripts/repair-auth-user.mjs:7-16`; neither strips quotes, so `KEY="value"` breaks. Use `dotenv` (already a dependency of `server/`) or `node --env-file`.

**R‑10 · LOW · `handleLoad` rebuilds the full record inside a state updater**
`src/App.tsx:208-226` calls `buildRecordFromBundle(parsed.data)` inside `setLoaded(prev => …)`. It is pure, but React Strict Mode runs updaters twice, so the 2.4 MB sample is re‑extracted twice on every degrade. Compute the new record before calling `setLoaded`.

---

## Appendix A — what changed in this branch

| File | Change |
|---|---|
| `supabase/migrations/007_onboarding_progress.sql` | `auth.uid()` → `(select auth.uid())` in both policies (applied live as `20260916135800`). |
| `supabase/migrations/20260916104124_fix_search_path_and_rls_initplan.sql` | New: byte‑for‑byte copy of the migration that was already live but not in git. |
| `supabase/migrations/20260916135814_security_hardening.sql` | New: function grants (S‑01), profiles policy consolidation (S‑03), five FK indexes (S‑06). Applied live. |
| `supabase/migrations/20260916140058_scope_policies_to_authenticated.sql` | New: every policy `to authenticated` (S‑04). Applied live. |
| `.env.example` | New: every variable the frontend, `api/` and `server/` read, placeholders only, with a note on what `VITE_` exposes. |
| `.gitignore` | `!.env.example` so the example is tracked. |
| `docs/code-review-2026-09-16.md` | This report. |

Live migration history is now: `20260916104124`, `20260916135800`, `20260916135814`, `20260916140058`. Migrations `001`‑`006` remain untracked in `schema_migrations` (S‑05).

## Appendix B — how findings were verified

- Static reading of every file under `api/`, `server/`, `scripts/`, `supabase/`, and the security‑relevant parts of `src/` (auth, Supabase access, parser, markdown, terminology client, validator, App shell).
- `npx tsc -b` (passes), `npx tsc -p api` (TS5107), `npx eslint .` (63 errors, tallied by rule).
- `fast-xml-parser` behaviour tested directly with the parser options from `src/fhir/parser.ts` (C‑01, S‑18).
- Live Supabase: `list_tables`, `list_migrations`, both advisors before and after, `pg_policies`/`pg_proc`/`pg_indexes` dump, role counts, and role‑switched queries as `authenticated` and `anon` after each migration.
- Vercel: project `gp-connect-demo` (framework vite, Node 24, domain `gp-connect-demo.vercel.app`). Environment variable *values* were not read; names were inferred from code.
- GitHub: repository page returns HTTP 200 without credentials (public).
