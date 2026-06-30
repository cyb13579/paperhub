# PaperHub Improvements Design

## Scope

Implement all accepted review improvements except changing the existing auth guard. The site should keep its current requirement that users log in before using non-login routes.

## Goals

- Move paper search and pagination toward server-side filtering so the UI no longer depends on fetching a fixed 500-record slice.
- Replace local-only favorites with account-backed favorites in Supabase, while keeping a safe fallback for users whose database has not yet been migrated.
- Update the Supabase setup script with the favorites table, useful search indexes, and row-level security policies.
- Improve interaction polish and accessibility for the navigation drawer, external preview windows, busy buttons, and empty/error states.
- Fix documentation drift in the README so deployment instructions match the current file layout and upload limits.

## Architecture

The current no-build static architecture remains in place. `js/supabase.js` will gain small query capabilities needed by the existing pages: ranges, exact counts, OR filters, and optional text-search helpers. `js/pages.js` will keep rendering the current pages but will use server count/range queries for home results and a new favorites data path for logged-in users. `js/utils.js` will keep local favorites as fallback storage and expose async helpers for account favorites.

## Data Model

Add a `favorites` table:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`
- `paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL`
- `title TEXT DEFAULT ''`
- `created_at TIMESTAMPTZ DEFAULT now()`
- `UNIQUE(user_id, paper_id)`

RLS allows authenticated users to read, insert, and delete only their own favorites.

## Search And Pagination

Home search should request only the current page. Subject and year remain exact filters. Text search should use an OR query across `title`, `tags`, `description`, and `subject`, with the existing client-side fallback kept for compatibility if the REST query fails. Pagination should use the returned count instead of `papers.length`.

## Interaction Improvements

The sidebar should expose dialog-like attributes, close on `Escape`, restore focus to the menu button after closing, and prevent background scroll while open. Preview windows should use `noopener,noreferrer`. Upload, auth, and review actions should present stable loading labels and restore them after completion.

## Documentation

README should say the app is configured in `js/supabase.js`, mention the 100MB upload limit used by the code, and describe the new favorites migration step through `supabase-setup.sql`.

## Verification

Verification should include:

- `node --check js/supabase.js`
- `node --check js/utils.js`
- `node --check js/pages.js`
- `node --check js/router.js`
- Static inspection of SQL and README changes
