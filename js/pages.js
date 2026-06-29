/**
 * Page renderers — each function fills #main with its content
 * Uses event delegation via [data-action] instead of inline onclick
 * @module pages
 */

import { supabase } from './supabase.js';
import { esc, timeAgo, getFavorites, isFavorite, toggleFavorite, isPreviewable, getPreviewUrl, getFileIcon, toast, delegate, SUBJECTS } from './utils.js';

// ── Shared helpers ──

let starRating = 0;

function renderCards(papers) {
  return papers.map(function (p) {
    const size = p.file_size ? (p.file_size / 1048576).toFixed(2) + 'MB' : '';
    const icon = getFileIcon(p.file_type);
    return '<div class="paper-card" data-action="detail" data-id="' + p.id + '">' +
      '<div class="paper-title">' + esc(p.title || '') + '</div>' +
      '<div class="paper-tags">' +
      '<span class="tag tag-subject">' + esc(p.subject || '') + '</span>' +
      '<span class="tag tag-year">' + (p.year || '—') + '</span>' +
      (p.file_type ? '<span class="tag tag-file">' + icon + ' ' + p.file_type.toUpperCase() + ' ' + size + '</span>' : '') +
      '</div>' +
      '<div class="paper-footer">' +
      '<span>↓ ' + (p.downloads || 0) + '</span>' +
      '<span>' + (p.rating_count ? '★ ' + p.avg_rating.toFixed(1) : '-') + '</span>' +
      '<span>' + timeAgo(p.created_at) + '</span>' +
      '</div></div>';
  }).join('');
}

function skeletonGrid(count) {
  count = count || 6;
  let html = '';
  for (let i = 0; i < count; i++) {
    html += '<div class="paper-card"><div class="skeleton"></div><div class="skeleton skeleton-short"></div></div>';
  }
  return html;
}

function renderPagination(current, total, perPage) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return '';
  let html = '<div class="pagination">';
  if (current > 1) {
    html += '<button class="btn btn-outline btn-small" data-action="page" data-id="' + (current - 1) + '">← 上一页</button>';
  }
  html += '<span class="page-info">第 ' + current + ' / ' + totalPages + ' 页</span>';
  if (current < totalPages) {
    html += '<button class="btn btn-outline btn-small" data-action="page" data-id="' + (current + 1) + '">下一页 →</button>';
  }
  html += '</div>';
  return html;
}

// ── Event Delegation Setup ──

let mainDelegateAttached = false;

function ensureMainDelegate() {
  if (mainDelegateAttached) return;
  mainDelegateAttached = true;
  const main = document.getElementById('main');
  delegate(main, 'click', function (action, id, extra, target, e) {
    switch (action) {
      case 'detail':
        location.hash = '#/detail/' + id;
        break;
      case 'download':
        e.stopPropagation();
        downloadFile(id, extra);
        break;
      case 'preview':
        e.stopPropagation();
        previewFile(extra, id);
        break;
      case 'showRateForm':
        e.stopPropagation();
        showRateForm(id);
        break;
      case 'toggleFav':
        e.stopPropagation();
        toggleFavorite(id, extra);
        break;
      case 'deletePaper':
        e.stopPropagation();
        deletePaper(id);
        break;
      case 'submitReview':
        e.stopPropagation();
        submitReview(id);
        break;
      case 'setStar':
        e.stopPropagation();
        setStar(parseInt(id));
        break;
      case 'acceptFriend':
        e.stopPropagation();
        acceptFriend(id);
        break;
      case 'addFriend':
        e.stopPropagation();
        addFriend();
        break;
      case 'page':
        e.stopPropagation();
        goToPage(parseInt(id));
        break;
      case 'subjectFilter':
        e.stopPropagation();
        filterBySubject(id);
        break;
      case 'doUpload':
        e.stopPropagation();
        doUpload();
        break;
      case 'doAuth':
        e.stopPropagation();
        doAuth();
        break;
      case 'switchAuth':
        e.stopPropagation();
        switchAuthMode();
        break;
      case 'showAll':
        e.stopPropagation();
        showAll();
        break;
    }
  });
}

// ── Home Page ──

let currentSubject = '';
let allPapers = [];
let searchTimer = null;
let currentPage = 1;
const PER_PAGE = 20;

export async function renderHome() {
  ensureMainDelegate();
  currentSubject = '';
  currentPage = 1;
  document.getElementById('hero').style.display = '';

  let html = '<div class="search-row">' +
    '<div class="search-box"><input type="text" id="searchInput" placeholder="搜索试卷标题、标签..." data-action-input="search"></div>' +
    '<select class="filter-select" id="searchYear" data-action-change="doSearch"><option value="">全部年份</option>';
  for (let y = new Date().getFullYear(); y >= 2000; y--) {
    html += '<option value="' + y + '">' + y + '</option>';
  }
  html += '</select>' +
    '<select class="filter-select" id="searchSort" data-action-change="doSearch">' +
    '<option value="created_at.desc">最新上传</option>' +
    '<option value="downloads.desc">最多下载</option>' +
    '<option value="avg_rating.desc">最高评分</option>' +
    '<option value="title.asc">标题 A-Z</option>' +
    '</select></div>';

  // Subject pills
  html += '<div class="subject-pills" id="subjectPills">';
  html += '<button class="pill active" data-action="subjectFilter" data-id="">全部</button>';
  SUBJECTS.forEach(function (s) {
    html += '<button class="pill" data-action="subjectFilter" data-id="' + esc(s) + '">' + esc(s) + '</button>';
  });
  html += '</div>';

  html += '<div class="section-title"><span>资料列表</span><span class="count" id="resultCount"></span></div>' +
    '<div class="paper-grid" id="paperGrid"></div>' +
    '<div id="paginationWrap"></div>';

  document.getElementById('main').innerHTML = html;

  // Bind input events
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { currentPage = 1; loadPapers(); }, 400);
    });
  }

  const selects = document.querySelectorAll('[data-action-change="doSearch"]');
  selects.forEach(function (sel) {
    sel.addEventListener('change', function () { currentPage = 1; loadPapers(); });
  });

  loadStats();
  loadPapers();
}

export function filterBySubject(subject) {
  currentSubject = subject;
  currentPage = 1;
  // Update pill active state
  const pills = document.querySelectorAll('#subjectPills .pill');
  pills.forEach(function (p) {
    p.classList.toggle('active', p.dataset.id === subject);
  });
  loadPapers();
}

export function goToPage(page) {
  currentPage = page;
  loadPapers();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function showAll() {
  currentPage = 1;
  PER_PAGE && loadPapers();
}

async function loadStats() {
  try {
    const count = await supabase.query('papers', { count: true, limit: 0 });
    const el = document.getElementById('statTotal');
    if (el) el.textContent = count || '0';
  } catch (e) { /* ignore */ }

  try {
    // Fetch all papers for stats (paginated if needed)
    let allPapers = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const batch = await supabase.query('papers', {
        select: 'downloads,user_id',
        limit: batchSize,
        skip: offset
      });
      if (!batch || !batch.length) break;
      allPapers = allPapers.concat(batch);
      if (batch.length < batchSize) break;
      offset += batchSize;
    }
    let dl = 0;
    const users = new Set();
    allPapers.forEach(function (p) {
      dl += p.downloads || 0;
      if (p.user_id) users.add(p.user_id);
    });
    const dlEl = document.getElementById('statDL');
    if (dlEl) dlEl.textContent = dl.toLocaleString();
    const usersEl = document.getElementById('statUsers');
    if (usersEl) usersEl.textContent = users.size || '0';
  } catch (e) { /* ignore */ }
}

async function loadPapers() {
  const grid = document.getElementById('paperGrid');
  if (!grid) return;

  const search = (document.getElementById('searchInput')?.value || '').trim();
  const year = document.getElementById('searchYear')?.value || '';
  const sortVal = (document.getElementById('searchSort')?.value || 'created_at.desc').split('.');
  const sortCol = sortVal[0];
  const sortDir = sortVal[1] || 'desc';

  grid.innerHTML = skeletonGrid(6);

  try {
    const where = {};
    if (currentSubject) where.subject = currentSubject;
    if (year) where.year = parseInt(year);

    // Server-side search using ilike
    let papers;
    if (search) {
      // Supabase doesn't support OR in a single query easily with REST,
      // so we fetch with subject/year filter and then client-filter for multi-field search
      const opts = {
        where: Object.keys(where).length ? where : undefined,
        order: sortCol + '.' + sortDir,
        limit: 500
      };
      papers = await supabase.query('papers', opts);
      const lower = search.toLowerCase();
      papers = papers.filter(function (p) {
        return (p.title || '').toLowerCase().includes(lower) ||
          (p.tags || '').toLowerCase().includes(lower) ||
          (p.description || '').toLowerCase().includes(lower) ||
          (p.subject || '').toLowerCase().includes(lower);
      });
    } else {
      const opts = {
        where: Object.keys(where).length ? where : undefined,
        order: sortCol + '.' + sortDir,
        limit: 500
      };
      papers = await supabase.query('papers', opts);
    }

    const countEl = document.getElementById('resultCount');
    if (countEl) countEl.textContent = papers.length + ' 份资料';

    if (!papers.length) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>' +
        (supabase.getUser() ? '暂无资料，快来上传第一份！' : '暂无资料') + '</p></div>';
      document.getElementById('paginationWrap').innerHTML = '';
      return;
    }

    allPapers = papers;
    const start = (currentPage - 1) * PER_PAGE;
    const shown = papers.slice(start, start + PER_PAGE);
    grid.innerHTML = renderCards(shown);
    document.getElementById('paginationWrap').innerHTML = renderPagination(currentPage, papers.length, PER_PAGE);
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>加载失败，请稍后重试</p></div>';
  }
}

// ── Detail Page ──

export async function renderDetail(id) {
  ensureMainDelegate();
  if (!id) { location.hash = '#/'; return; }

  try {
    const paper = await supabase.get('papers', id);
    if (!paper) { toast('资料不存在'); location.hash = '#/'; return; }

    let reviews = [];
    try {
      reviews = await supabase.query('reviews', {
        where: { paper_id: id },
        order: 'created_at.desc'
      });
    } catch (e) { /* ignore */ }

    const user = supabase.getUser();
    const isOwner = user && user.id === paper.user_id;
    const fileUrl = paper.file_path || '';
    const fileType = paper.file_type || '';
    const fileSize = paper.file_size ? (paper.file_size / 1048576).toFixed(2) + 'MB' : '';
    const rating = paper.rating_count
      ? paper.avg_rating.toFixed(1) + ' (' + paper.rating_count + ' 人)'
      : '暂无评分';
    const icon = getFileIcon(fileType);

    let html = '<a href="#/" class="back-link">← 返回</a>' +
      '<div class="detail-card">' +
      '<h1 class="detail-title">' + esc(paper.title || '') + '</h1>' +
      '<div class="detail-meta">' +
      '<span class="tag tag-subject">' + esc(paper.subject || '') + '</span>' +
      '<span class="tag tag-year">' + paper.year + '</span>';

    if (fileType) {
      html += '<span class="tag tag-file">' + icon + ' ' + fileType.toUpperCase() + ' ' + fileSize + '</span>';
    }

    html += '<span style="font-size:0.82rem;color:var(--text-secondary)">↓ ' + (paper.downloads || 0) + ' 下载</span>' +
      '<span style="font-size:0.82rem;color:var(--text-secondary)">★ ' + rating + '</span>';

    if (paper.user_email) {
      html += '<span style="font-size:0.82rem;color:var(--text-muted)">· ' + esc(paper.user_email) + '</span>';
    }

    html += '</div>';

    if (paper.tags) {
      html += '<div style="margin:4px 0;font-size:0.82rem;color:var(--text-secondary)">🏷️ ' + esc(paper.tags) + '</div>';
    }
    if (paper.description) {
      html += '<div style="margin:8px 0;color:var(--text-secondary);font-size:0.9rem;white-space:pre-wrap">' + esc(paper.description) + '</div>';
    }

    html += '<div class="detail-actions">';

    if (user) {
      html += '<button class="btn btn-primary" data-action="download" data-id="' + paper.id + '" data-extra="' + esc(fileUrl) + '">下载</button>';

      if (isPreviewable(fileType)) {
        html += '<button class="btn btn-outline btn-small" data-action="preview" data-id="' + esc(fileType) + '" data-extra="' + esc(fileUrl) + '">预览</button>';
      }

      html += '<button class="btn btn-ghost btn-small" data-action="showRateForm" data-id="' + paper.id + '">评分</button>';
      html += '<button class="btn btn-outline btn-small" data-action="toggleFav" data-id="' + paper.id + '" data-extra="' + esc(paper.title || '') + '" data-fav-id="' + paper.id + '">' +
        (isFavorite(paper.id) ? '取消收藏' : '收藏') + '</button>';
    } else {
      html += '<p style="color:var(--orange)">请<a href="#/login">登录</a>后下载</p>';
    }

    if (isOwner) {
      html += '<button class="btn btn-danger btn-small" data-action="deletePaper" data-id="' + paper.id + '">删除</button>';
    }

    html += '</div></div>' +
      '<div class="section-title">评价 (' + reviews.length + ')</div>' +
      '<div id="reviewList">';

    if (!reviews.length) {
      html += '<p style="color:var(--text-secondary);font-size:0.9rem">暂无评价</p>';
    } else {
      reviews.forEach(function (r) {
        html += '<div class="review-card">' +
          '<div class="review-header">' +
          '<span>' + esc(r.user_email || '匿名') + '</span>' +
          '<span class="stars">' + '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0)) + '</span>' +
          '<span>' + timeAgo(r.created_at) + '</span>' +
          '</div>' +
          (r.comment ? '<p style="font-size:0.85rem">' + esc(r.comment) + '</p>' : '') +
          '</div>';
      });
    }

    html += '</div><div id="reviewForm"></div>';
    document.getElementById('main').innerHTML = html;
  } catch (e) {
    toast('加载失败');
    location.hash = '#/';
  }
}

// ── Detail Actions ──

export function downloadFile(paperId, url) {
  if (!url) return;
  // Atomic download increment via RPC
  supabase.rpc('increment_downloads', { p_id: paperId }).catch(function () {
    // Fallback: non-atomic update
    supabase.get('papers', paperId).then(function (p) {
      if (p) supabase.update('papers', paperId, { downloads: (p.downloads || 0) + 1 });
    }).catch(function () { });
  });
  // Use hidden link for download — avoids loading entire file into memory
  const a = document.createElement('a');
  a.href = url;
  a.download = url.split('/').pop() || 'download';
  a.target = '_blank';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('下载中...');
}

export function previewFile(url, ext) {
  if (!url) return;
  window.open(getPreviewUrl(url, ext), '_blank');
}

export function showRateForm(paperId) {
  let html = '<div class="review-card">' +
    '<div style="font-weight:600;margin-bottom:6px">留下评价</div>' +
    '<div style="margin-bottom:6px">';
  for (let i = 1; i <= 5; i++) {
    html += '<button class="btn btn-ghost" data-action="setStar" data-id="' + i + '" id="star' + i + '" style="font-size:1.2rem;padding:2px 4px">☆</button>';
  }
  html += '</div>' +
    '<div class="form-group"><textarea id="rateComment" placeholder="写点评论（可选）" rows="2"></textarea></div>' +
    '<button class="btn btn-primary btn-small" data-action="submitReview" data-id="' + paperId + '">提交</button>' +
    '</div>';
  document.getElementById('reviewForm').innerHTML = html;
  starRating = 0;
}

export function setStar(n) {
  starRating = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('star' + i);
    if (el) el.textContent = i <= n ? '★' : '☆';
  }
}

export async function submitReview(paperId) {
  const user = supabase.getUser();
  if (!user) { toast('请先登录'); return; }
  if (!starRating) { toast('请选择评分'); return; }

  const comment = document.getElementById('rateComment')?.value?.trim() || '';

  try {
    // Prevent duplicate
    const existing = await supabase.query('reviews', {
      where: { paper_id: paperId, user_id: user.id }
    });
    if (existing && existing.length) { toast('你已经评价过了'); return; }

    await supabase.create('reviews', {
      paper_id: paperId,
      user_id: user.id,
      user_email: user.email,
      rating: starRating,
      comment: comment
    });

    // DB trigger auto-recalculates avg_rating and rating_count
    toast('评价已提交');
    location.hash = '#/detail/' + paperId;
  } catch (e) {
    toast('提交失败: ' + e.message);
  }
}

export async function deletePaper(paperId) {
  if (!confirm('确定删除此资料？删除后无法恢复。')) return;
  try {
    const paper = await supabase.get('papers', paperId);
    const user = supabase.getUser();
    const title = paper ? (paper.title || '未知资料') : '未知资料';

    // Notify friends before deletion
    if (user) {
      try {
        await notifyFriends(paperId, user.email + ' 删除了资料：' + title);
      } catch (e) {
        console.warn('通知好友失败:', e.message);
      }
    }

    // Delete associated file from storage
    if (paper && paper.file_path) {
      try {
        const path = paper.file_path.split('/public/papers/')[1];
        if (path) await supabase.deleteFile('papers', path);
      } catch (e) { /* ignore file delete errors */ }
    }

    // Delete paper — reviews are CASCADE deleted by the database
    await supabase.remove('papers', paperId);
    toast('已删除');
    location.hash = '#/';
  } catch (e) { toast('删除失败: ' + e.message); }
}

// ── Upload Page ──

export function renderUpload() {
  ensureMainDelegate();
  let html = '<a href="#/" class="back-link">← 返回</a>' +
    '<div class="detail-card"><h1 class="detail-title">📤 上传资料</h1>' +
    '<div class="form-group"><label>标题 <span style="color:var(--red)">*</span></label><input type="text" id="upTitle" placeholder="例：2024年高考数学真题" maxlength="100"></div>' +
    '<div class="form-row">' +
    '<div class="form-group"><label>学科</label>' +
    '<select id="upSubject"><option value="">选择学科</option>';
  SUBJECTS.forEach(function (s) {
    html += '<option value="' + esc(s) + '">' + esc(s) + '</option>';
  });
  html += '</select></div>' +
    '<div class="form-group"><label>年份</label><select id="upYear">';
  for (let y = new Date().getFullYear(); y >= 2000; y--) {
    html += '<option value="' + y + '">' + y + '</option>';
  }
  html += '</select></div></div>' +
    '<div class="form-group"><label>昵称（可选）</label><input type="text" id="upNick" placeholder="不填显示邮箱" maxlength="30"></div>' +
    '<div class="form-group"><label>标签（逗号分隔）</label><input type="text" id="upTags" placeholder="高考,真题,全国卷" maxlength="200"></div>' +
    '<div class="form-group"><label>描述（可选）</label><textarea id="upDesc" placeholder="简要描述这份资料" rows="2" maxlength="500"></textarea></div>' +
    '<div class="form-group"><label>文件 <span style="color:var(--red)">*</span>（最大100MB）</label>' +
    '<div class="upload-zone" id="dropZone">' +
    '<div>📁 拖拽文件到此处，或<strong>点击选择</strong></div>' +
    '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">支持 PDF、图片、Office、压缩包等格式</div>' +
    '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px" id="fileInfo"></div>' +
    '</div>' +
    '<input type="file" id="upFile" accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.zip,.rar,.7z,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv" style="display:none">' +
    '</div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" onclick="location.hash=\'#/\'">取消</button>' +
    '<button class="btn btn-primary" data-action="doUpload" id="uploadBtn">上传</button>' +
    '</div></div>';

  document.getElementById('main').innerHTML = html;

  // Wire drop zone
  const dz = document.getElementById('dropZone');
  const fileInput = document.getElementById('upFile');
  const ALLOWED_EXT = ['pdf','jpg','jpeg','png','gif','bmp','webp','zip','rar','7z','doc','docx','ppt','pptx','xls','xlsx','txt','md','csv'];
  if (dz) {
    dz.addEventListener('click', function () { fileInput.click(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('drag'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault();
      dz.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) {
        const ext = f.name.split('.').pop().toLowerCase();
        if (ALLOWED_EXT.indexOf(ext) === -1) {
          toast('不支持的文件格式: .' + ext);
          return;
        }
        fileInput.files = e.dataTransfer.files;
        document.getElementById('fileInfo').textContent = '已选择: ' + f.name + ' (' + (f.size / 1048576).toFixed(1) + 'MB)';
      }
    });
  }
  if (fileInput) {
    fileInput.addEventListener('change', function () {
      const f = this.files[0];
      if (f) document.getElementById('fileInfo').textContent = '已选择: ' + f.name + ' (' + (f.size / 1048576).toFixed(1) + 'MB)';
    });
  }
}

export async function doUpload() {
  const user = supabase.getUser();
  if (!user) { toast('请先登录'); return; }

  const nick = document.getElementById('upNick')?.value?.trim() || '';
  const title = document.getElementById('upTitle').value.trim();
  const subject = document.getElementById('upSubject').value;
  const year = document.getElementById('upYear').value;
  const tags = document.getElementById('upTags').value.trim();
  const desc = document.getElementById('upDesc').value.trim();
  const file = document.getElementById('upFile').files[0];

  if (!title) { toast('请输入标题'); return; }
  if (title.length < 2) { toast('标题至少2个字符'); return; }
  if (!file) { toast('请选择文件'); return; }
  if (file.size > 104857600) { toast('文件不能超过100MB'); return; }
  if (file.size === 0) { toast('文件为空'); return; }

  const btn = document.getElementById('uploadBtn');
  btn.textContent = '0%';
  btn.disabled = true;

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    const filePath = user.id + '/' + Date.now() + '.' + ext;

    await supabase.uploadFile('papers', filePath, file, function (pct) {
      btn.textContent = pct + '%';
    });

    const url = supabase.getFileUrl('papers', filePath);
    const result = await supabase.create('papers', {
      title: title,
      subject: subject,
      year: parseInt(year),
      tags: tags,
      description: desc,
      file_path: url,
      file_type: ext,
      file_size: file.size,
      user_id: user.id,
      user_email: nick || user.email,
      downloads: 0,
      avg_rating: 0,
      rating_count: 0
    });

    toast('上传成功 🎉');
    // Await notification to ensure requests complete before navigation
    try {
      await notifyFriends(result[0].id, user.email + ' 上传了资料：' + title);
    } catch (e) {
      console.warn('通知好友失败:', e.message);
    }
    location.hash = '#/detail/' + result[0].id;
  } catch (e) {
    toast('上传失败: ' + e.message);
  }
  btn.textContent = '上传';
  btn.disabled = false;
}

// ── Mine Page ──

export async function renderMine() {
  ensureMainDelegate();
  const user = supabase.getUser();
  if (!user) { location.hash = '#/login'; return; }

  document.getElementById('main').innerHTML =
    '<a href="#/" class="back-link">← 返回</a>' +
    '<div class="section-title">📂 我上传的资料</div>' +
    '<div class="paper-grid" id="paperGrid">' + skeletonGrid(3) + '</div>';

  const grid = document.getElementById('paperGrid');
  try {
    const papers = await supabase.query('papers', {
      where: { user_id: user.id },
      order: 'created_at.desc',
      limit: 100
    });
    if (!papers.length) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>还没有上传过资料</p></div>';
      return;
    }
    grid.innerHTML = renderCards(papers);
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

// ── Favs Page ──

export async function renderFavs() {
  ensureMainDelegate();
  const user = supabase.getUser();
  if (!user) { location.hash = '#/login'; return; }

  const favs = getFavorites();
  document.getElementById('main').innerHTML =
    '<a href="#/" class="back-link">← 返回</a>' +
    '<div class="section-title">⭐ 我的收藏 (' + favs.length + ')</div>' +
    '<div class="paper-grid" id="paperGrid"></div>';

  const grid = document.getElementById('paperGrid');
  if (!favs.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">⭐</div><p>还没有收藏，浏览资料时点击"收藏"即可添加</p></div>';
    return;
  }

  grid.innerHTML = skeletonGrid(Math.min(favs.length, 6));

  try {
    const results = await Promise.all(favs.map(function (f) { return supabase.get('papers', f.id); }));
    const papers = results.filter(Boolean);
    if (!papers.length) {
      grid.innerHTML = '<div class="empty-state"><p>收藏的资料已被删除</p></div>';
      return;
    }
    grid.innerHTML = renderCards(papers);
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

// ── Login Page ──

let authMode = 'login';

export function renderLogin() {
  ensureMainDelegate();
  document.getElementById('hero').style.display = 'none';
  document.getElementById('main').innerHTML =
    '<div class="modal-overlay active" style="position:relative;background:transparent">' +
    '<div class="modal" style="margin:0 auto">' +
    '<h2>' + (authMode === 'login' ? '🔐 登录' : '📝 注册') + '</h2>' +
    '<div class="form-group"><label>邮箱</label><input type="email" id="authEmail" placeholder="your@email.com"></div>' +
    '<div class="form-group"><label>密码（至少6位）</label><input type="password" id="authPassword" placeholder="······"></div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" data-action="switchAuth">' + (authMode === 'login' ? '去注册' : '去登录') + '</button>' +
    '<button class="btn btn-primary" data-action="doAuth">' + (authMode === 'login' ? '登录' : '注册') + '</button>' +
    '</div></div></div>';
}

export function switchAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  renderLogin();
}

export async function doAuth() {
  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPassword')?.value;
  if (!email || !password) { toast('请填写邮箱和密码'); return; }
  if (password.length < 6) { toast('密码至少6位'); return; }

  const btn = document.querySelector('[data-action="doAuth"]');
  if (btn) { btn.disabled = true; btn.textContent = '处理中...'; }

  try {
    if (authMode === 'signup') {
      await supabase.signUp(email, password);
      if (!supabase.getUser()) {
        await supabase.signIn(email, password);
      }
    } else {
      await supabase.signIn(email, password);
    }

    // 所有账户均可登录（白名单已移除）
    toast('登录成功 🎉');
    updateNav();
    location.hash = '#/';
  } catch (e) {
    toast(e.message);
  }

  if (btn) { btn.disabled = false; btn.textContent = authMode === 'login' ? '登录' : '注册'; }
}

export async function doLogout() {
  await supabase.signOut();
  updateNav();
  toast('已退出');
  location.hash = '#/';
}

// ── Friends & Notifications ──

export async function renderFriends() {
  ensureMainDelegate();
  const user = supabase.getUser();
  if (!user) { location.hash = '#/login'; return; }
  document.getElementById('hero').style.display = 'none';
  document.getElementById('main').innerHTML = '<a href="#/" class="back-link">← 返回</a>' +
    '<div class="detail-card"><h1 class="detail-title">👥 好友</h1>' +
    '<div class="form-row" style="margin-bottom:16px"><div class="form-group" style="flex:1"><input type="email" id="friendEmail" placeholder="输入好友邮箱"></div>' +
    '<button class="btn btn-primary" data-action="addFriend">添加</button></div>' +
    '<div style="font-size:0.78rem;color:var(--text-muted)">提示：好友需已注册并上传过资料</div>' +
    '</div>' +
    '<div id="friendList"><div class="empty-state"><div class="skeleton"></div></div></div>';

  try {
    const friends = await supabase.query('friendships', { limit: 200 });
    const accepted = friends.filter(function (f) {
      return f.status === 'accepted' && (f.user_id === user.id || f.friend_id === user.id);
    });
    const pending = friends.filter(function (f) {
      return f.status === 'pending' && f.friend_id === user.id;
    });

    // Build UUID→email map
    const emailMap = {};
    friends.forEach(function (f) {
      if (f.user_email) emailMap[f.user_id] = f.user_email;
      if (f.friend_email) emailMap[f.friend_id] = f.friend_email;
    });

    // For missing emails, query profiles table first, then papers as fallback
    const missingIds = [];
    friends.forEach(function (f) {
      if (!emailMap[f.user_id] && missingIds.indexOf(f.user_id) === -1) missingIds.push(f.user_id);
      if (!emailMap[f.friend_id] && missingIds.indexOf(f.friend_id) === -1) missingIds.push(f.friend_id);
    });

    if (missingIds.length) {
      try {
        // Try profiles table first
        const profiles = await supabase.query('profiles', {
          where: { id: { op: 'in', value: '(' + missingIds.join(',') + ')' } }
        });
        if (profiles && profiles.length) {
          profiles.forEach(function (p) { if (p.email) emailMap[p.id] = p.email; });
        }
      } catch (e) { /* profiles table may not exist yet */ }

      // Fallback: query papers for remaining missing IDs
      const stillMissing = missingIds.filter(function (id) { return !emailMap[id]; });
      for (let i = 0; i < stillMissing.length; i++) {
        try {
          const p = await supabase.query('papers', { where: { user_id: stillMissing[i] }, limit: 1 });
          if (p && p.length && p[0].user_email) emailMap[stillMissing[i]] = p[0].user_email;
        } catch (e) { /* ignore */ }
      }
    }

    let html = '';
    if (pending.length) {
      html += '<div class="section-title">📩 待处理请求 (' + pending.length + ')</div>';
      pending.forEach(function (f) {
        const senderEmail = emailMap[f.user_id] || f.user_id;
        html += '<div class="review-card"><span style="font-weight:500">' + esc(senderEmail) + '</span> 想加你为好友 ' +
          '<button class="btn btn-primary btn-small" data-action="acceptFriend" data-id="' + f.id + '" style="margin-left:8px">接受</button></div>';
      });
    }
    if (accepted.length) {
      html += '<div class="section-title">👥 好友列表 (' + accepted.length + ')</div>';
      html += '<div class="paper-grid">';
      accepted.forEach(function (f) {
        const fid = f.user_id === user.id ? f.friend_id : f.user_id;
        const friendEmail = emailMap[fid] || fid;
        html += '<div class="paper-card" style="cursor:default"><div class="paper-title">' + esc(friendEmail) + '</div></div>';
      });
      html += '</div>';
    }
    if (!pending.length && !accepted.length) {
      html += '<div class="empty-state"><div class="icon">👥</div><p>还没有好友，输入邮箱添加</p></div>';
    }
    document.getElementById('friendList').innerHTML = html;
  } catch (e) {
    document.getElementById('friendList').innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

export async function addFriend() {
  const user = supabase.getUser();
  if (!user) return;
  const friendEmail = document.getElementById('friendEmail')?.value?.trim();
  if (!friendEmail) { toast('请输入好友邮箱'); return; }
  if (friendEmail === user.email) { toast('不能添加自己'); return; }

  try {
    // Find friend UUID from profiles or papers
    let friendId = null;

    // Try profiles table first
    try {
      const profiles = await supabase.query('profiles', { where: { email: friendEmail }, limit: 1 });
      if (profiles && profiles.length) friendId = profiles[0].id;
    } catch (e) { /* profiles may not exist */ }

    // Fallback: papers table
    if (!friendId) {
      const papers = await supabase.query('papers', { where: { user_email: friendEmail }, limit: 1 });
      if (!papers || !papers.length) { toast('未找到该用户（需已注册并上传过资料）'); return; }
      friendId = papers[0].user_id;
    }

    if (friendId === user.id) { toast('不能添加自己'); return; }

    // Check existing friendship (both directions)
    const existing1 = await supabase.query('friendships', { where: { user_id: user.id, friend_id: friendId }, limit: 1 });
    if (existing1 && existing1.length) {
      if (existing1[0].status === 'pending') { toast('已发送过请求'); return; }
      if (existing1[0].status === 'accepted') { toast('已经是好友'); return; }
    }
    const existing2 = await supabase.query('friendships', { where: { user_id: friendId, friend_id: user.id }, limit: 1 });
    if (existing2 && existing2.length) {
      if (existing2[0].status === 'accepted') { toast('已经是好友'); return; }
    }

    await supabase.create('friendships', {
      user_id: user.id,
      friend_id: friendId,
      user_email: user.email,
      friend_email: friendEmail,
      status: 'pending'
    });
    toast('好友请求已发送 ✉️');
    renderFriends();
  } catch (e) { toast('添加失败: ' + e.message); }
}

export async function acceptFriend(friendshipId) {
  try {
    await supabase.update('friendships', friendshipId, { status: 'accepted' });
    toast('已接受好友请求 🎉');
    renderFriends();
  } catch (e) { toast('操作失败'); }
}

export async function checkNotifications() {
  const user = supabase.getUser();
  if (!user) return;
  try {
    const notifs = await supabase.query('notifications', {
      where: { user_id: user.id, read: false },
      order: 'created_at.desc',
      limit: 20
    });
    const count = (notifs && notifs.length) ? notifs.length : 0;
    const text = count > 9 ? '9+' : String(count);

    // Update header badge
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = text;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    // Update sidebar badge
    const sideBadge = document.getElementById('sideNotifBadge');
    if (sideBadge) {
      sideBadge.textContent = text;
      sideBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  } catch (e) { /* ignore */ }
}

export async function showNotifications() {
  ensureMainDelegate();
  const user = supabase.getUser();
  if (!user) return;
  document.getElementById('hero').style.display = 'none';
  document.getElementById('main').innerHTML = '<a href="#/" class="back-link">← 返回</a><div class="section-title">🔔 通知</div><div id="notifList"><div class="empty-state"><div class="skeleton"></div></div></div>';
  try {
    const notifs = await supabase.query('notifications', {
      where: { user_id: user.id },
      order: 'created_at.desc',
      limit: 50
    });
    const list = document.getElementById('notifList');
    if (!notifs || !notifs.length) {
      list.innerHTML = '<div class="empty-state"><div class="icon">🔔</div><p>暂无通知</p></div>';
      return;
    }
    list.innerHTML = notifs.map(function (n) {
      return '<div class="review-card" style="opacity:' + (n.read ? '0.6' : '1') + '">' +
        '<span>' + esc(n.message) + '</span>' +
        '<span style="font-size:0.78rem;color:var(--text-muted);margin-left:12px">' + timeAgo(n.created_at) + '</span>' +
        (n.paper_id ? '<a href="#/detail/' + n.paper_id + '" style="margin-left:8px;font-size:0.8rem">查看</a>' : '') +
        '</div>';
    }).join('');
    // Mark all as read
    notifs.forEach(function (n) {
      if (!n.read) supabase.update('notifications', n.id, { read: true }).catch(function () { });
    });
    checkNotifications();
  } catch (e) {
    document.getElementById('notifList').innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

export async function notifyFriends(paperId, message) {
  const user = supabase.getUser();
  if (!user) { console.warn('notifyFriends: 未登录'); return; }
  try {
    // Query friendships in both directions
    const [friends, reverse] = await Promise.all([
      supabase.query('friendships', {
        where: { user_id: user.id, status: 'accepted' },
        limit: 200
      }),
      supabase.query('friendships', {
        where: { friend_id: user.id, status: 'accepted' },
        limit: 200
      })
    ]);
    const all = friends.concat(reverse);
    // Deduplicate
    const seen = {};
    const targets = [];
    all.forEach(function (f) {
      const fid = f.user_id === user.id ? f.friend_id : f.user_id;
      if (!seen[fid]) {
        seen[fid] = true;
        targets.push(fid);
      }
    });
    console.log('notifyFriends: 找到 ' + targets.length + ' 个好友');
    if (!targets.length) return;
    // Create notifications via RPC (bypasses RLS)
    const results = await Promise.all(targets.map(function (fid) {
      return supabase.rpc('create_notification', {
        p_user_id: fid,
        p_message: message,
        p_paper_id: paperId
      }).then(function () { return true; })
        .catch(function (e) {
          console.warn('通知发送失败:', fid, e.message);
          return false;
        });
    }));
    const success = results.filter(Boolean).length;
    console.log('notifyFriends: 成功发送 ' + success + '/' + targets.length + ' 条通知');
  } catch (e) {
    console.warn('notifyFriends 失败:', e.message);
  }
}

// ── Notification Polling ──
let notifTimer = null;

export function startNotifPolling() {
  if (notifTimer) return;
  checkNotifications();
  notifTimer = setInterval(function () {
    if (supabase.getUser()) {
      checkNotifications();
    } else {
      stopNotifPolling();
    }
  }, 30000); // every 30 seconds
}

export function stopNotifPolling() {
  if (notifTimer) {
    clearInterval(notifTimer);
    notifTimer = null;
  }
}

// ── Nav Update ──

export function updateNav() {
  const user = supabase.getUser();
  const ids = ['loginBtn', 'logoutBtn', 'upBtn', 'favBtn', 'mineBtn', 'friendsBtn', 'notifBell'];
  ids.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'loginBtn') el.style.display = user ? 'none' : '';
    else el.style.display = user ? '' : 'none';
  });
  const userInfo = document.getElementById('userInfo');
  if (userInfo) userInfo.textContent = user ? (user.email || '') : '';

  // Sidebar
  const sideItems = ['sideUpload', 'sideFavs', 'sideMine', 'sideFriends', 'sideNotifs'];
  sideItems.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = user ? '' : 'none';
  });
  const sl = document.getElementById('sideLogin');
  if (sl) sl.style.display = user ? 'none' : '';
  const so = document.getElementById('sideLogout');
  if (so) so.style.display = user ? '' : 'none';
  const su = document.getElementById('sideUser');
  if (su) su.textContent = user ? user.email || '' : '';
}
