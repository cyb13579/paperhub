/**
 * Utility helpers
 * @module utils
 */

/** Escape HTML to prevent XSS */
export function esc(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** Format relative time */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  var minutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return minutes + '分钟前';
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + '小时前';
  var days = Math.floor(hours / 24);
  if (days < 30) return days + '天前';
  if (days < 365) return Math.floor(days / 30) + '个月前';
  return Math.floor(days / 365) + '年前';
}

/** Show a toast notification */
export function toast(message) {
  var el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(function () { el.classList.remove('show'); }, 2500);
}

/** Favorite helpers (localStorage based) */
export function getFavorites() {
  try { return JSON.parse(localStorage.getItem('favs') || '[]'); }
  catch (e) { return []; }
}

export function isFavorite(id) {
  return getFavorites().some(function (f) { return f.id === id; });
}

export function toggleFavorite(id, title) {
  var favs = getFavorites();
  if (isFavorite(id)) {
    favs = favs.filter(function (x) { return x.id !== id; });
    toast('已取消收藏');
  } else {
    favs.push({ id: id, title: title });
    toast('已收藏');
  }
  localStorage.setItem('favs', JSON.stringify(favs));
}

/** Subjects list and mappings */
export var SUBJECTS = [
  '数学', '语文', '英语', '物理', '化学',
  '生物', '历史', '地理', '政治', '计算机'
];

/** Previewable file types */
var PREVIEWABLE = [
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp',
  'txt', 'md', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'
];

var OFFICE_TYPES = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'];

export function isPreviewable(ext) {
  return PREVIEWABLE.indexOf((ext || '').toLowerCase()) > -1;
}

export function getPreviewUrl(url, ext) {
  if (OFFICE_TYPES.indexOf((ext || '').toLowerCase()) > -1) {
    return 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(url);
  }
  return url;
}
