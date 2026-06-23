/**
 * Hash Router Module
 * Handles all navigation and page rendering
 * @module router
 */

import { supabase } from './supabase.js';
import * as pages from './pages.js';

/**
 * Initialize the router: check auth, render current page, listen for hash changes
 */
export async function init() {
  // Restore session
  await supabase.getSession();
  pages.updateNav();

  // Route to current hash
  handleRoute();

  // Listen for hash changes (browser back/forward)
  window.addEventListener('hashchange', handleRoute);
}

function handleRoute() {
  var hash = location.hash || '#/';
  var parts = hash.replace('#/', '').split('/');
  var page = parts[0] || '';
  var param = parts[1] || '';

  // Show/hide hero (only on home page)
  var hero = document.getElementById('hero');
  if (hero) {
    hero.style.display = (page === '' || page === 'home') ? '' : 'none';
  }

  // Auth guard: redirect to login for protected pages
  var protectedPages = ['upload', 'mine', 'favs'];
  if (protectedPages.indexOf(page) > -1 && !supabase.getUser()) {
    location.hash = '#/login';
    return;
  }

  // Route to page
  switch (page) {
    case '':
    case 'home':
      pages.renderHome();
      break;
    case 'detail':
      pages.renderDetail(param);
      break;
    case 'upload':
      pages.renderUpload();
      break;
    case 'mine':
      pages.renderMine();
      break;
    case 'favs':
      pages.renderFavs();
      break;
    case 'login':
      pages.renderLogin();
      break;
    case 'friends':
      pages.renderFriends();
      break;
    default:
      pages.renderHome();
  }

  // Scroll to top on navigation
  window.scrollTo({ top: 0, behavior: 'instant' });
  // Poll notifications
  if (supabase.getUser()) { pages.checkNotifications(); }
}
