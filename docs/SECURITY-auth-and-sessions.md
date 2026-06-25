# Authentication & Session Security — Notes and Recommended Settings

**Date:** 2026-06-25
**Scope:** How the app authenticates users and persists sessions, what is and isn't a
secret, and the Supabase **Auth project settings** we recommend. The session settings
below live in the Supabase dashboard (this project is not CLI/`config.toml`-managed),
so they are **not** enforced by anything in this repo — this file records the intended
configuration so it doesn't drift silently.
**Method:** Static review of `src/lib/supabase.ts`, `src/lib/auth.ts`, and the edge
functions under `supabase/functions/`.

---

## 1. How sessions work here

- The browser client (`src/lib/supabase.ts`) is created with `persistSession: true` and
  `autoRefreshToken: true`, and **no custom storage** — so supabase-js stores the
  session in **`localStorage`** under the key `sb-<project-ref>-auth-token`.
- That entry holds an **access token** (a short-lived JWT) and a **refresh token**
  (long-lived; used to silently mint new access tokens).
- Auth is **password → session tokens**. There are **no per-user keypairs / private
  keys**. "Logging in as admin" just yields a normal session whose profile has
  `role = 'Admin'`; privilege is enforced server-side by RLS (`is_admin()`), keyed off
  whoever holds the token.

## 2. What is NOT a secret vs. what IS

| Item | Sensitive? | Where it lives |
|------|------------|----------------|
| `VITE_SUPABASE_ANON_KEY` (anon JWT) | **No — public by design** | Shipped in the client bundle. Safe to expose; it's low-privilege. |
| `service_role` key (bypasses all RLS) | **Yes — must stay server-only** | Confirmed in **none** of `src/`; used only in the 3 edge functions (`admin-deactivate`, `admin-delete-user`, `request-reactivation`). ✅ |
| Per-user **session tokens** (access + refresh) | **Yes** | `localStorage` in the user's browser. |

## 3. The "copy my session to another device" risk

Copying the `sb-<ref>-auth-token` `localStorage` value into the same app (same origin) on
another browser/device logs that browser in **as you, with no password** — admin
included — and the refresh token keeps it alive until the session is revoked. This is
ordinary **session-token theft**; it requires access to your logged-in browser (unlocked
machine / devtools) or an XSS hole. It is not unique to this app — it's the default for
Supabase SPAs.

Mitigations (in order of impact for this specific risk):

1. **Refresh-token rotation** — the durable part of a copied session is the *refresh*
   token; rotation invalidates a stale copy once the real client rotates.
2. **Shorter access-token (JWT) expiry** — shrinks the window a copied *access* token
   alone stays valid.
3. **Sign out when done**, especially on shared machines — revokes the session.
4. **Keep the app XSS-free** — React escapes by default; never introduce
   `dangerouslySetInnerHTML` around user-supplied content (file names, notes, etc.).

## 4. Recommended Supabase Auth settings

Dashboard → **Project Settings → Authentication**
(`https://supabase.com/dashboard/project/<project-ref>/settings/auth`):

| Setting | Default | Recommended | Why |
|---------|---------|-------------|-----|
| Access token (JWT) expiry | `3600` s (1 h) | **`1800` s (30 min)**, or `900` s for stricter | Limits a stolen access token. Invisible to users — the client auto-refreshes. |
| Refresh token rotation | off | **on** | Each use issues a new refresh token; invalidates a copied one. The real fix for §3. |
| Refresh token reuse interval | — | **~10 s** | A leaked refresh token used twice trips reuse detection → revocation. |

These have **no meaningful UX cost** (background refresh is silent); the only effect of a
shorter expiry is slightly more frequent refresh calls.

## 5. Admin-specific note (by design, flagged for awareness)

The admin "deactivate user" flow (`admin-deactivate` edge function) generates a new
password, resets the user's auth password to it, and stores that **plaintext** password
in the `admin_access` table so the admin can sign in **as** the deactivated user to review
their activity (`getAccessPasswords()` in `src/lib/auth.ts`). `admin_access` is
admin-only via RLS, so it is **not** exposed to normal users — but it does mean the admin
account can authenticate as those users with a real password. This is intentional for the
view-as feature; documented here so it isn't mistaken for a leak.

---

*Sources: `src/lib/supabase.ts`, `src/lib/auth.ts`, `supabase/functions/*`. The settings
in §4 are dashboard-managed and must be applied/verified in the Supabase project — they
are not reproduced by anything in this repository.*
