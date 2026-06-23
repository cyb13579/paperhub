/**
 * Page renderers — each function fills #main with its content
 * @module pages
 */

import { supabase } from './supabase.js';
import { esc, timeAgo, getFavorites, isFavorite, toggleFavorite, isPreviewable, getPreviewUrl, toast } from './utils.js';

// ── Shared helpers ──

function renderCards(papers) {
  return papers.map(function (p) {
    var size = p.file_size ? (p.file_size / 1048576).toFixed(2) + 'MB' : '';
    return '<div class="paper-card" onclick="location.hash=\'#/detail/' + p.id + '\'">' +
      '<div class="paper-title">' + esc(p.title || '') + '</div>' +
      '<div class="paper-tags">' +
      '<span class="tag tag-subject">' + esc(p.subject || '') + '</span>' +
      '<span class="tag tag-year">' + p.year + '</span>' +
      (p.file_type ? '<span class="tag tag-file">' + p.file_type.toUpperCase() + ' ' + size + '</span>' : '') +
      '</div>' +
      '<div class="paper-footer">' +
      '<span>Down ' + (p.downloads || 0) + '</span>' +
      '<span>' + (p.rating_count ? '★ ' + p.avg_rating.toFixed(1) : '-') + '</span>' +
      '<span>' + timeAgo(p.created_at) + '</span>' +
      '</div></div>';
  }).join('');
}

function skeletonGrid(count) {
  count = count || 6;
  var html = '';
  for (var i = 0; i < count; i++) {
    html += '<div class="paper-card"><div class="skeleton"></div><div class="skeleton skeleton-short"></div></div>';
  }
  return html;
}

// ── Home Page ──

var currentSubject = '';
var allPapers = [];
var searchTimer = null;

export async function renderHome() {
  currentSubject = '';
  document.getElementById('hero').style.display = '';

  var html = '<div class="search-row">' +
    '<div class="search-box"><input type="text" id="searchInput" placeholder="搜索试卷..." oninput="window._debounceSearch()"></div>' +
    '<select class="filter-select" id="searchYear" onchange="window._doSearch()"><option value="">全部年份</option>';
  for (var y = new Date().getFullYear(); y >= 2000; y--) {
    html += '<option value="' + y + '">' + y + '</option>';
  }
  html += '</select></div>' +
    '<div class="section-title"><span>资料列表</span><span class="count" id="resultCount"></span></div>' +
    '<div class="paper-grid" id="paperGrid"></div>';

  document.getElementById('main').innerHTML = html;

  loadStats();
  loadPapers();
}


export function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(function () { currentSubject = ''; loadPapers(); }, 400);
}

export function doSearch() {
  currentSubject = '';
  loadPapers();
}

async function loadStats() {
  try {
    var r = await fetch(
      'https://ugkyvcevycpmcbrqucla.supabase.co/rest/v1/papers?limit=1&select=id',
      {
        headers: {
          'apikey': 'sb_publishable_L-cWMAfLnZ1jw-S3yscfdQ_B5lmiElK',
          'Authorization': 'Bearer sb_publishable_L-cWMAfLnZ1jw-S3yscfdQ_B5lmiElK',
          'Prefer': 'count=exact'
        }
      }
    );
    var range = r.headers.get('content-range') || '';
    document.getElementById('statTotal').textContent = range.split('/').pop() || '0';
  } catch (e) { /* ignore */ }

  try {
    var papers = await supabase.query('papers', { limit: 200 });
    var dl = 0;
    var users = new Set();
    papers.forEach(function (p) {
      dl += p.downloads || 0;
      if (p.user_id) users.add(p.user_id);
    });
    document.getElementById('statDL').textContent = dl.toLocaleString();
    document.getElementById('statUsers').textContent = users.size || '0';
  } catch (e) { /* ignore */ }
}

async function loadPapers() {
  var grid = document.getElementById('paperGrid');
  if (!grid) return;

  var search = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  var subject = currentSubject || '';
  var year = document.getElementById('searchYear')?.value || '';
  var sort = (document.getElementById('searchSort')?.value || 'created_at.desc').split('.');

  grid.innerHTML = skeletonGrid(6);

  try {
    var where = {};
    if (subject) where.subject = subject;
    if (year) where.year = parseInt(year);

    var papers = await supabase.query('papers', {
      where: Object.keys(where).length ? where : undefined,
      order: sort[0] + '.' + (sort[1] || 'desc'),
      limit: 100
    });

    if (search) {
      papers = papers.filter(function (p) {
        return (p.title || '').toLowerCase().includes(search) ||
          (p.tags || '').toLowerCase().includes(search) ||
          (p.description || '').toLowerCase().includes(search);
      });
    }

    document.getElementById('resultCount').textContent = papers.length + ' 份资料';

    if (!papers.length) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">—</div><p>' +
        (supabase.getUser() ? '快来上传第一份！' : '还没有资料') + '</p></div>';
      return;
    }

    var shown = papers.slice(0, 20);
    grid.innerHTML = renderCards(shown);

    if (papers.length > 20) {
      grid.innerHTML += '<div class="load-more"><button class="btn btn-outline btn-small" onclick="window._showAll()">查看全部 ' + papers.length + ' 份</button></div>';
    }
    allPapers = papers;
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

export function showAll() {
  var grid = document.getElementById('paperGrid');
  if (!grid || !allPapers.length) return;
  grid.innerHTML = renderCards(allPapers);
  document.getElementById('resultCount').textContent = allPapers.length + ' 份资料';
}

// ── Detail Page ──

export async function renderDetail(id) {
  if (!id) { location.hash = '#/'; return; }

  try {
    var paper = await supabase.get('papers', id);
    if (!paper) { toast('资料不存在'); location.hash = '#/'; return; }

    var reviews = [];
    try {
      reviews = await supabase.query('reviews', {
        where: { paper_id: id },
        order: 'created_at.desc'
      });
    } catch (e) { /* ignore */ }

    var user = supabase.getUser();
    var isOwner = user && user.id === paper.user_id;
    var fileUrl = paper.file_path || '';
    var fileType = paper.file_type || '';
    var fileSize = paper.file_size ? (paper.file_size / 1048576).toFixed(2) + 'MB' : '';
    var rating = paper.rating_count
      ? paper.avg_rating.toFixed(1) + ' (' + paper.rating_count + ' 人)'
      : '暂无评分';

    var html = '<a href="#/" class="back-link">← 返回</a>' +
      '<div class="detail-card">' +
      '<h1 class="detail-title">' + esc(paper.title || '') + '</h1>' +
      '<div class="detail-meta">' +
      '<span class="tag tag-subject">' + esc(paper.subject || '') + '</span>' +
      '<span class="tag tag-year">' + paper.year + '</span>';

    if (fileType) {
      html += '<span class="tag tag-file">' + fileType.toUpperCase() + ' ' + fileSize + '</span>';
    }

    html += '<span style="font-size:0.82rem;color:var(--text-secondary)">↓ ' + (paper.downloads || 0) + ' 下载</span>' +
      '<span style="font-size:0.82rem;color:var(--text-secondary)">★ ' + rating + '</span>';

    if (paper.user_email) {
      html += '<span style="font-size:0.82rem;color:var(--text-muted)">· ' + esc(paper.user_email) + '</span>';
    }

    html += '</div>';

    if (paper.tags) {
      html += '<div style="margin:4px 0;font-size:0.82rem;color:var(--text-secondary)">' + esc(paper.tags) + '</div>';
    }
    if (paper.description) {
      html += '<div style="margin:8px 0;color:var(--text-secondary);font-size:0.9rem;white-space:pre-wrap">' + esc(paper.description) + '</div>';
    }

    html += '<div class="detail-actions">';

    if (user) {
      html += '<button class="btn btn-primary" onclick="window._download(\'' + paper.id + '\',\'' + fileUrl + '\')">下载</button>';

      if (isPreviewable(fileType)) {
        html += '<button class="btn btn-outline btn-small" onclick="window._preview(\'' + fileUrl + '\',\'' + fileType + '\')">预览</button>';
      }

      html += '<button class="btn btn-ghost btn-small" onclick="window._showRateForm(\'' + paper.id + '\')">评分</button>';
      html += '<button class="btn btn-outline btn-small" onclick="window._toggleFav(\'' + paper.id + '\',\'' + esc(paper.title || '') + '\')">' +
        (isFavorite(paper.id) ? '取消收藏' : '收藏') + '</button>';
    } else {
      html += '<p style="color:var(--orange)">请<a href="#/login">登录</a>后下载</p>';
    }

    if (isOwner) {
      html += '<button class="btn btn-danger btn-small" onclick="window._deletePaper(\'' + paper.id + '\')">删除</button>';
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

// Detail actions (exposed to window for onclick handlers)
export function downloadFile(paperId, url) {
  if (!url) return;
  supabase.get('papers', paperId).then(function (p) {
    if (p) supabase.update('papers', paperId, { downloads: (p.downloads || 0) + 1 });
  }).catch(function () { });
  toast('下载中...');
  fetch(url).then(function(r){return r.blob()}).then(function(b){
    var u=URL.createObjectURL(b);
    var a=document.createElement('a');
    a.href=u;
    a.download=url.split('/').pop()||'download';
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(u)},3000);
    toast('下载完成');
  }).catch(function(e){
    console.log('Download fallback:',e);
    window.open(url,'_blank');
  });
}

export function previewFile(url, ext) {
  if (!url) return;
  window.open(getPreviewUrl(url, ext), '_blank');
}

export function showRateForm(paperId) {
  var html = '<div class="review-card">' +
    '<div style="font-weight:600;margin-bottom:6px">留下评价</div>' +
    '<div style="margin-bottom:6px">';
  for (var i = 1; i <= 5; i++) {
    html += '<button class="btn btn-ghost" onclick="window._setStar(' + i + ')" id="star' + i + '" style="font-size:1.2rem;padding:2px 4px">☆</button>';
  }
  html += '</div>' +
    '<div class="form-group"><textarea id="rateComment" placeholder="写点评论" rows="2"></textarea></div>' +
    '<button class="btn btn-primary btn-small" onclick="window._submitReview(\'' + paperId + '\')">提交</button>' +
    '</div>';
  document.getElementById('reviewForm').innerHTML = html;
  window._starRating = 0;
}

export function setStar(n) {
  window._starRating = n;
  for (var i = 1; i <= 5; i++) {
    document.getElementById('star' + i).textContent = i <= n ? '★' : '☆';
  }
}

export async function submitReview(paperId) {
  var user = supabase.getUser();
  if (!user) { toast('请先登录'); return; }
  if (!window._starRating) { toast('请选择评分'); return; }

  var comment = document.getElementById('rateComment')?.value?.trim() || '';

  try {
    // Prevent duplicate
    var existing = await supabase.query('reviews', {
      where: { paper_id: paperId, user_id: user.id }
    });
    if (existing && existing.length) { toast('你已经评价过了'); return; }

    await supabase.create('reviews', {
      paper_id: paperId,
      user_id: user.id,
      user_email: user.email,
      rating: window._starRating,
      comment: comment
    });

    // Recalculate average
    var revs = await supabase.query('reviews', { where: { paper_id: paperId } });
    var avg = revs.reduce(function (s, r) { return s + (r.rating || 0); }, 0) / revs.length;

    await supabase.rpc('update_paper_rating', {
      p_id: paperId,
      avg_r: Math.round(avg * 10) / 10,
      r_count: revs.length
    });

    toast('评价已提交');
    location.hash = '#/detail/' + paperId;
  } catch (e) {
    toast('提交失败: ' + e.message);
  }
}

export async function deletePaper(paperId) {
  if (!confirm('确定删除？')) return;
  try {
    await supabase.remove('papers', paperId);
    var reviews = await supabase.query('reviews', { where: { paper_id: paperId } });
    for (var i = 0; i < reviews.length; i++) {
      await supabase.remove('reviews', reviews[i].id);
    }
    toast('已删除');
    location.hash = '#/';
  } catch (e) { toast('删除失败'); }
}

// ── Upload Page ──

export function renderUpload() {
  var html = '<a href="#/" class="back-link">← 返回</a>' +
    '<div class="detail-card"><h1 class="detail-title">上传资料</h1>' +
    '<div class="form-group"><label>标题</label><input type="text" id="upTitle" placeholder="例：2024年高考数学真题" maxlength="100"></div>' +
    '<div class="form-row">' +
    '<div class="form-group"><label>学科</label><input type="text" id="upSubject" placeholder="例如：数据结构、高等数学" maxlength="50"></div>' +
    '<div class="form-group"><label>年份</label><select id="upYear">';
  for (var y = new Date().getFullYear(); y >= 2000; y--) {
    html += '<option value="' + y + '">' + y + '</option>';
  }
  html += '</select></div></div>' +
    '<div class="form-group"><label>昵称（可选）</label><input type="text" id="upNick" placeholder="不填显示邮箱"></div>' +
    '<div class="form-group"><label>标签（逗号分隔）</label><input type="text" id="upTags" placeholder="高考,真题,全国卷"></div>' +
    '<div class="form-group"><label>描述（可选）</label><textarea id="upDesc" placeholder="简要描述" rows="2"></textarea></div>' +
    '<div class="form-group"><label>文件（最大100MB）</label>' +
    '<div class="upload-zone" id="dropZone" onclick="document.getElementById(\'upFile\').click()">' +
    '<div>拖拽文件到此处，或<strong>点击选择</strong></div>' +
    '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px" id="fileInfo"></div>' +
    '</div>' +
    '<input type="file" id="upFile" accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.zip,.rar,.7z,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv" style="display:none">' +
    '</div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" onclick="location.hash=\'#/\'">取消</button>' +
    '<button class="btn btn-primary" onclick="window._doUpload()" id="uploadBtn">上传</button>' +
    '</div></div>';

  document.getElementById('main').innerHTML = html;
  wireDropZone();
}

function wireDropZone() {
  var dz = document.getElementById('dropZone');
  if (!dz) return;
  dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', function () { dz.classList.remove('drag'); });
  dz.addEventListener('drop', function (e) {
    e.preventDefault();
    dz.classList.remove('drag');
    var f = e.dataTransfer.files[0];
    if (f) {
      document.getElementById('upFile').files = e.dataTransfer.files;
      document.getElementById('fileInfo').textContent = '已选择: ' + f.name + ' (' + (f.size / 1048576).toFixed(1) + 'MB)';
    }
  });
  document.getElementById('upFile').addEventListener('change', function () {
    var f = this.files[0];
    if (f) document.getElementById('fileInfo').textContent = '已选择: ' + f.name + ' (' + (f.size / 1048576).toFixed(1) + 'MB)';
  });
}

export async function doUpload() {
  var user = supabase.getUser();
  if (!user) { toast('请先登录'); return; }

  var nick = document.getElementById('upNick')?.value?.trim() || '';
  var title = document.getElementById('upTitle').value.trim();
  var subject = document.getElementById('upSubject').value;
  var year = document.getElementById('upYear').value;
  var tags = document.getElementById('upTags').value.trim();
  var desc = document.getElementById('upDesc').value.trim();
  var file = document.getElementById('upFile').files[0];

  if (!title) { toast('请输入标题'); return; }
  if (!file) { toast('请选择文件'); return; }
  if (file.size > 104857600) { toast('文件不能超过100MB'); return; }

  var btn = document.getElementById('uploadBtn');
  btn.textContent = '0%';
  btn.disabled = true;

  try {
    var ext = file.name.split('.').pop().toLowerCase();
    var filePath = user.id + '/' + Date.now() + '.' + ext;

    await supabase.uploadFile('papers', filePath, file, function (pct) {
      btn.textContent = pct + '%';
    });

    var url = supabase.getFileUrl('papers', filePath);
    var result = await supabase.create('papers', {
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

    toast('上传成功');
    location.hash = '#/detail/' + result[0].id;
  } catch (e) {
    toast('上传失败: ' + e.message);
  }
  btn.textContent = '上传';
  btn.disabled = false;
}

// ── Mine Page ──

export async function renderMine() {
  var user = supabase.getUser();
  if (!user) { location.hash = '#/login'; return; }

  document.getElementById('main').innerHTML =
    '<a href="#/" class="back-link">← 返回</a>' +
    '<div class="section-title">我上传的资料</div>' +
    '<div class="paper-grid" id="paperGrid"></div>';

  var grid = document.getElementById('paperGrid');
  try {
    var papers = await supabase.query('papers', {
      where: { user_id: user.id },
      order: 'created_at.desc',
      limit: 100
    });
    if (!papers.length) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">—</div><p>还没有上传</p></div>';
      return;
    }
    grid.innerHTML = papers.map(function (p) {
      return '<div class="paper-card" onclick="location.hash=\'#/detail/' + p.id + '\'">' +
        '<div class="paper-title">' + esc(p.title || '') + '</div>' +
        '<div class="paper-tags">' +
        '<span class="tag tag-subject">' + esc(p.subject || '') + '</span>' +
        '<span class="tag tag-year">' + p.year + '</span>' +
        '</div>' +
        '<div class="paper-footer">' +
        '<span>↓ ' + (p.downloads || 0) + '</span>' +
        '<span>' + (p.rating_count ? '★ ' + p.avg_rating.toFixed(1) : '-') + '</span>' +
        '<span>' + timeAgo(p.created_at) + '</span>' +
        '</div></div>';
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

// ── Favs Page ──

export async function renderFavs() {
  var user = supabase.getUser();
  if (!user) { location.hash = '#/login'; return; }

  var favs = getFavorites();
  document.getElementById('main').innerHTML =
    '<a href="#/" class="back-link">← 返回</a>' +
    '<div class="section-title">我的收藏</div>' +
    '<div class="paper-grid" id="paperGrid"></div>';

  var grid = document.getElementById('paperGrid');
  if (!favs.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">—</div><p>还没有收藏</p></div>';
    return;
  }

  try {
    var results = await Promise.all(favs.map(function (f) { return supabase.get('papers', f.id); }));
    var papers = results.filter(Boolean);
    grid.innerHTML = papers.map(function (p) {
      return '<div class="paper-card" onclick="location.hash=\'#/detail/' + p.id + '\'">' +
        '<div class="paper-title">' + esc(p.title || '') + '</div>' +
        '<div class="paper-tags">' +
        '<span class="tag tag-subject">' + esc(p.subject || '') + '</span>' +
        '<span class="tag tag-year">' + p.year + '</span>' +
        '</div></div>';
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
  }
}

// ── Login Page ──

var authMode = 'login';

export function renderLogin() {
  document.getElementById('hero').style.display = 'none';
  document.getElementById('main').innerHTML =
    '<div class="modal-overlay active" style="position:relative;background:transparent">' +
    '<div class="modal" style="margin:0 auto">' +
    '<h2>' + (authMode === 'login' ? '登录' : '注册') + '</h2>' +
    '<div class="form-group"><label>邮箱</label><input type="email" id="authEmail" placeholder="your@email.com"></div>' +
    '<div class="form-group"><label>密码（至少6位）</label><input type="password" id="authPassword" placeholder="···"></div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-ghost" onclick="window._switchAuth()">' + (authMode === 'login' ? '去注册' : '去登录') + '</button>' +
    '<button class="btn btn-primary" onclick="window._doAuth()">' + (authMode === 'login' ? '登录' : '注册') + '</button>' +
    '</div></div></div>';
}

export function switchAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  renderLogin();
}

export async function doAuth() {
  var email = document.getElementById('authEmail')?.value.trim();
  var password = document.getElementById('authPassword')?.value;
  if (!email || !password) { toast('请填写邮箱和密码'); return; }

  try {
    if (authMode === 'signup') {
      await supabase.signUp(email, password);
      if (!supabase.getUser()) {
        await supabase.signIn(email, password);
      }
    } else {
      await supabase.signIn(email, password);
    }
    toast('登录成功');
    updateNav();
    location.hash = '#/';
  } catch (e) {
    toast(e.message);
  }
}

export async function doLogout() {
  await supabase.signOut();
  updateNav();
  toast('已退出');
  location.hash = '#/';
}

// ── Nav Update ──

export function updateNav() {
  var user = supabase.getUser();
  document.getElementById('loginBtn').style.display = user ? 'none' : '';
  document.getElementById('logoutBtn').style.display = user ? '' : 'none';
  document.getElementById('upBtn').style.display = user ? '' : 'none';
  document.getElementById('favBtn').style.display = user ? '' : 'none';
  document.getElementById('mineBtn').style.display = user ? '' : 'none';
  document.getElementById('userInfo').textContent = user ? (user.email || '') : '';
}
