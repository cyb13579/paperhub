# PaperHub Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve PaperHub search, favorites, setup documentation, and interaction polish without changing the existing route-level login requirement.

**Architecture:** Keep the no-build static site. Extend the fetch-based Supabase wrapper with count/range/OR support, then update the existing page renderers to consume those APIs. Add database support through the existing setup SQL and keep local favorites as a fallback.

**Tech Stack:** Plain HTML, CSS, JavaScript ES modules, Supabase REST/Auth/Storage, PostgreSQL SQL setup script.

## Global Constraints

- Do not change the existing auth guard behavior in `js/router.js`.
- Do not add a build system or third-party frontend dependency.
- Preserve the current static deployment model.
- Use server-side pagination for home results where Supabase supports it, with fallback behavior for compatibility.
- Keep all user-generated HTML escaped through `esc()`.

---

### Task 1: Supabase Query Capabilities

**Files:**
- Modify: `js/supabase.js`

**Interfaces:**
- Produces: `supabase.query(table, options)` supports `range: { from: number, to: number }`, `or: string`, `count: true`, and returns `{ data, count }` when `returnCount: true`.

- [ ] Add range and count support to `query`.
- [ ] Preserve existing array return behavior unless `returnCount` is requested.
- [ ] Run `node --check js/supabase.js`.

### Task 2: Server-Side Home Search

**Files:**
- Modify: `js/pages.js`

**Interfaces:**
- Consumes: `supabase.query(..., { returnCount: true, range, or })`.
- Produces: `loadPapers()` renders only current page records and paginates from Supabase count.

- [ ] Update search query construction to use exact subject/year filters plus OR `ilike` text filtering.
- [ ] Request only the current page range.
- [ ] Keep fallback client filtering if OR search fails.
- [ ] Run `node --check js/pages.js`.

### Task 3: Account Favorites

**Files:**
- Modify: `js/utils.js`
- Modify: `js/pages.js`
- Modify: `supabase-setup.sql`

**Interfaces:**
- Produces: async helpers `getFavorites(user)`, `isFavorite(id, user)`, `toggleFavorite(id, title, user)`, and `syncLocalFavorites(user)`.

- [ ] Add `favorites` SQL table, indexes, and RLS policies.
- [ ] Update favorites helpers to use Supabase when logged in and localStorage fallback otherwise.
- [ ] Sync local favorites after login if possible.
- [ ] Update detail and favorites pages to await favorite state.
- [ ] Run `node --check js/utils.js` and `node --check js/pages.js`.

### Task 4: Interaction Polish

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/pages.js`

**Interfaces:**
- Produces: sidebar Escape close/focus restore/body scroll lock; safer preview window; clearer busy states.

- [ ] Add ARIA attributes to sidebar and menu controls.
- [ ] Add Escape close and focus restore logic.
- [ ] Add body class for open sidebar and CSS scroll lock.
- [ ] Use `noopener,noreferrer` for preview windows.
- [ ] Improve upload/auth/review busy state labels.
- [ ] Run JS syntax checks.

### Task 5: Documentation Update

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: README consistent with current code.

- [ ] Update upload limit to 100MB.
- [ ] Point Supabase URL/key configuration to `js/supabase.js`.
- [ ] Mention rerunning `supabase-setup.sql` to create favorites support.
- [ ] Read README after editing for obvious mojibake or stale instructions.

### Task 6: Final Verification

**Files:**
- Check: `js/supabase.js`
- Check: `js/utils.js`
- Check: `js/pages.js`
- Check: `js/router.js`
- Check: `supabase-setup.sql`
- Check: `README.md`

- [ ] Run `node --check js/supabase.js`.
- [ ] Run `node --check js/utils.js`.
- [ ] Run `node --check js/pages.js`.
- [ ] Run `node --check js/router.js`.
- [ ] Review `git diff --check`.
- [ ] Summarize changed behavior and any deployment/database steps.
