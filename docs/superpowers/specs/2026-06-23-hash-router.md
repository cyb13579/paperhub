# PaperHub Hash Router Design Spec

## overview
Single-file HTML app with Hash routing, Supabase backend, GitHub Pages hosting.

## Routes
- `#/` — Home (search, filter, stats, paper list)
- `#/detail/:id` — Paper detail (download, preview, rate, fav)
- `#/upload` — Upload form (login required)
- `#/mine` — My uploads (login required)
- `#/favs` — Favorites (login required)
- `#/login` — Login/register modal

## Architecture
- `router()` function reads `location.hash`, calls corresponding page renderer
- `navigate(hash)` function sets hash, triggers router
- `hashchange` event listener for back/forward
- Route guard: check login state, redirect to `#/login` if needed

## Tech
- Hash change: `window.addEventListener('hashchange', router)`
- Navigation: `location.hash = '#/xxx'` or `navigate('#/xxx')`
- No external libraries
- Keep existing Supabase client
