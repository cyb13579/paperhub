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
  const hash = location.hash || '#/';
  const parts = hash.replace('#/', '').split('/');
  const page = parts[0] || '';
  const param = parts[1] || '';

  // Show/hide hero (only on home page)
  const hero = document.getElementById('hero');
  if (hero) {
    hero.style.display = (page === '' || page === 'home') ? '' : 'none';
  }

  // Auth guard: all pages except login require authentication
  if (page !== 'login' && !supabase.getUser()) {
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
    case 'notifications':
      pages.showNotifications();
      break;
    default:
      pages.renderHome();
  }

  // Scroll to top on navigation
  window.scrollTo({ top: 0, behavior: 'instant' });
  // Poll notifications
  if (supabase.getUser()) { pages.checkNotifications(); }
}
