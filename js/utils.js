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

/** Favorite helpers (Supabase account storage with local fallback) */
export function getLocalFavorites() {
  try { return JSON.parse(localStorage.getItem('favs') || '[]'); }
  catch (e) { return []; }
}

function setLocalFavorites(favs) {
  localStorage.setItem('favs', JSON.stringify(favs));
}

export async function getFavorites(supabase, user) {
  if (!user) return getLocalFavorites();
  try {
    const rows = await supabase.query('favorites', {
      where: { user_id: user.id },
      order: 'created_at.desc',
      limit: 300
    });
    return rows.map(function (f) {
      return { id: f.paper_id, title: f.title || '' };
    });
  } catch (e) {
    return getLocalFavorites();
  }
}

export async function isFavorite(id, supabase, user) {
  const favs = await getFavorites(supabase, user);
  return favs.some(function (f) { return f.id === id; });
}

export async function syncLocalFavorites(supabase, user) {
  if (!user) return;
  const favs = getLocalFavorites();
  if (!favs.length) return;
  try {
    const existing = await supabase.query('favorites', {
      where: { user_id: user.id },
      limit: 300
    });
    const existingIds = new Set(existing.map(function (f) { return f.paper_id; }));
    await Promise.all(favs.filter(function (f) {
      return !existingIds.has(f.id);
    }).map(function (f) {
      return supabase.create('favorites', {
        user_id: user.id,
        paper_id: f.id,
        title: f.title || ''
      }).catch(function () { return null; });
    }));
    localStorage.removeItem('favs');
  } catch (e) { /* keep local favorites as fallback */ }
}

export async function toggleFavorite(id, title, supabase, user) {
  const favs = await getFavorites(supabase, user);
  const exists = favs.some(function (f) { return f.id === id; });

  if (user) {
    try {
      if (exists) {
        await supabase.removeWhere('favorites', { user_id: user.id, paper_id: id });
        toast('已取消收藏');
      } else {
        await supabase.create('favorites', {
          user_id: user.id,
          paper_id: id,
          title: title || ''
        });
        toast('已收藏');
      }
    } catch (e) {
      toggleLocalFavorite(id, title, exists);
    }
  } else {
    toggleLocalFavorite(id, title, exists);
  }

  const btn = document.querySelector('[data-fav-id="' + id + '"]');
  if (btn) {
    const nowFav = await isFavorite(id, supabase, user);
    btn.textContent = nowFav ? '取消收藏' : '收藏';
  }
}

function toggleLocalFavorite(id, title, exists) {
  const favs = getLocalFavorites();
  if (exists) {
    setLocalFavorites(favs.filter(function (x) { return x.id !== id; }));
    toast('已取消收藏');
    return;
  }
  favs.push({ id: id, title: title });
  setLocalFavorites(favs);
  toast('已收藏');
}

/** Previewable file types */
const PREVIEWABLE = [
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp',
  'txt', 'md'
];

const OFFICE_TYPES = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'];
const VIDEO_TYPES = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];

export function isPdfPreview(ext) {
  return (ext || '').toLowerCase() === 'pdf';
}

export function isVideoPreview(ext) {
  return VIDEO_TYPES.indexOf((ext || '').toLowerCase()) > -1;
}

export function isEmbeddedPreview(ext) {
  return isPdfPreview(ext) || isVideoPreview(ext);
}

export function getVideoMime(ext) {
  const type = (ext || '').toLowerCase();
  if (type === 'webm') return 'video/webm';
  if (type === 'ogg') return 'video/ogg';
  if (type === 'mp4' || type === 'mov' || type === 'm4v') return 'video/mp4';
  return '';
}

export function isPreviewable(ext) {
  return PREVIEWABLE.indexOf((ext || '').toLowerCase()) > -1 ||
    OFFICE_TYPES.indexOf((ext || '').toLowerCase()) > -1 ||
    isVideoPreview(ext);
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
    xls: '📈', xlsx: '📈',
    mp4: '🎬', webm: '🎬', ogg: '🎬', mov: '🎬', m4v: '🎬'
  };
  return icons[(ext || '').toLowerCase()] || '📎';
}

/** Subject presets for pills */
export const SUBJECTS = [
  '高等数学', '线性代数', '概率统计', '大学物理', '大学英语',
  '数据结构', '计算机网络', '操作系统', '数据库', 'C语言', 'Java'
];
