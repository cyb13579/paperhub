/**
 * Utility helpers
 * @module utils
 */

/** Escape HTML to prevent XSS — uses string replacement for safety */
export function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format relative time */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return minutes + '分钟前';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + '小时前';
  const days = Math.floor(hours / 24);
  if (days < 30) return days + '天前';
  if (days < 365) return Math.floor(days / 30) + '个月前';
  return Math.floor(days / 365) + '年前';
}

/** Show a toast notification */
export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(function () { el.classList.remove('show'); }, 2500);
}

/** Favorite helpers (localStorage based, synced to DB when logged in) */
export function getFavorites() {
  try { return JSON.parse(localStorage.getItem('favs') || '[]'); }
  catch (e) { return []; }
}

export function isFavorite(id) {
  return getFavorites().some(function (f) { return f.id === id; });
}

export function toggleFavorite(id, title) {
  const favs = getFavorites();
  if (isFavorite(id)) {
    const newFavs = favs.filter(function (x) { return x.id !== id; });
    localStorage.setItem('favs', JSON.stringify(newFavs));
    toast('已取消收藏');
  } else {
    favs.push({ id: id, title: title });
    localStorage.setItem('favs', JSON.stringify(favs));
    toast('已收藏');
  }
  // Update UI if on detail page
  const btn = document.querySelector('[data-fav-id="' + id + '"]');
  if (btn) {
    btn.textContent = isFavorite(id) ? '取消收藏' : '收藏';
  }
}

/** Previewable file types */
const PREVIEWABLE = [
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp',
  'txt', 'md'
];

const OFFICE_TYPES = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'];

export function isPreviewable(ext) {
  return PREVIEWABLE.indexOf((ext || '').toLowerCase()) > -1 ||
    OFFICE_TYPES.indexOf((ext || '').toLowerCase()) > -1;
}

export function getPreviewUrl(url, ext) {
  if (OFFICE_TYPES.indexOf((ext || '').toLowerCase()) > -1) {
    return 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(url);
  }
  return url;
}

/**
 * Event delegation helper
 * Attach one listener on a parent, dispatch by [data-action] attribute
 */
export function delegate(container, eventType, handler) {
  container.addEventListener(eventType, function (e) {
    const target = e.target.closest('[data-action]');
    if (!target || !container.contains(target)) return;
    const action = target.dataset.action;
    const id = target.dataset.id || '';
    const extra = target.dataset.extra || '';
    handler(action, id, extra, target, e);
  });
}

/** File type icon map */
export function getFileIcon(ext) {
  const icons = {
    pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', bmp: '🖼️', webp: '🖼️',
    zip: '📦', rar: '📦', '7z': '📦',
    doc: '📝', docx: '📝', txt: '📝', md: '📝', csv: '📝',
    ppt: '📊', pptx: '📊',
    xls: '📈', xlsx: '📈'
  };
  return icons[(ext || '').toLowerCase()] || '📎';
}

/** Subject presets for pills */
export const SUBJECTS = [
  '高等数学', '线性代数', '概率统计', '大学物理', '大学英语',
  '数据结构', '计算机网络', '操作系统', '数据库', 'C语言', 'Java'
];
