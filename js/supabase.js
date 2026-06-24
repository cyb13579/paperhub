/**
 * Supabase Client Module
 * Pure fetch-based REST API wrapper — zero dependencies
 * @module supabase
 */

const SUPA_URL = 'https://ugkyvcevycpmcbrqucla.supabase.co';
const SUPA_KEY = 'sb_publishable_L-cWMAfLnZ1jw-S3yscfdQ_B5lmiElK';

let session = null;

function authHeaders() {
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': 'application/json'
  };
  if (session && session.access_token) {
    headers['Authorization'] = 'Bearer ' + session.access_token;
  }
  return headers;
}

/** Handle expired JWT — auto logout and reload */
function handleExpiredJwt() {
  session = null;
  localStorage.removeItem('sb_session');
  if (typeof window !== 'undefined') {
    window.location.hash = '#/login';
    window.location.reload();
  }
}

/** Check response for JWT errors */
async function checkAuth(res) {
  if (res.status === 401 || res.status === 403) {
    try {
      const body = await res.clone().json();
      if (body.message && body.message.includes('JWT')) {
        handleExpiredJwt();
        throw new Error('登录已过期，请重新登录');
      }
    } catch (e) {
      if (e.message.includes('登录已过期')) throw e;
      // JSON parse error, ignore
    }
  }
  return res;
}

/** Check if stored session is still valid (not expired) */
function isSessionValid(s) {
  if (!s || !s.access_token) return false;
  try {
    // JWT expiry is in the 'exp' claim (seconds since epoch)
    const payload = JSON.parse(atob(s.access_token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (e) {
    return false;
  }
}

export const supabase = {
  /** Get/restore session from localStorage with expiry check */
  async getSession() {
    try {
      const stored = localStorage.getItem('sb_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isSessionValid(parsed)) {
          session = parsed;
        } else {
          // Session expired, clean up
          session = null;
          localStorage.removeItem('sb_session');
        }
      }
    } catch (e) { /* ignore */ }
    return session;
  },

  /** Sign up a new user */
  async signUp(email, password) {
    const res = await fetch(SUPA_URL + '/auth/v1/signup', {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || '注册失败');
    if (data.session) {
      session = {
        access_token: data.session.access_token,
        user: data.user
      };
      localStorage.setItem('sb_session', JSON.stringify(session));
    }
  },

  /** Sign in with email/password */
  async signIn(email, password) {
    const res = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || '登录失败');
    session = {
      access_token: data.access_token,
      user: data.user
    };
    localStorage.setItem('sb_session', JSON.stringify(session));
  },

  /** Sign out */
  async signOut() {
    if (session && session.access_token) {
      await fetch(SUPA_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: authHeaders()
      }).catch(function () { });
    }
    session = null;
    localStorage.removeItem('sb_session');
  },

  /** Get current user */
  getUser() {
    return session ? session.user : null;
  },

  // ── Database ──

  /** Query records with advanced filtering */
  async query(table, options) {
    options = options || {};
    const params = new URLSearchParams();
    if (options.select) params.set('select', options.select);
    if (options.where) {
      Object.keys(options.where).forEach(function (k) {
        const val = options.where[k];
        if (val === null || val === undefined) return;
        // Support operators: { field: { op: 'ilike', value: '%text%' } }
        if (typeof val === 'object' && val.op) {
          params.set(k, val.op + '.' + val.value);
        } else {
          params.set(k, 'eq.' + val);
        }
      });
    }
    if (options.order) params.set('order', options.order);
    if (options.limit) params.set('limit', options.limit);
    if (options.skip) params.set('offset', options.skip);

    const isCount = options.count;
    if (isCount) {
      params.set('limit', '0');
    }

    const queryString = params.toString();
    const url = SUPA_URL + '/rest/v1/' + table + (queryString ? '?' + queryString : '');
    const headers = authHeaders();
    if (isCount) headers['Prefer'] = 'count=exact';

    const res = await checkAuth(await fetch(url, { headers: headers }));
    if (!res.ok) throw new Error(await res.text());

    if (isCount) {
      const range = res.headers.get('content-range') || '';
      return parseInt(range.split('/').pop()) || 0;
    }
    return await res.json();
  },

  /** Get a single record by ID */
  async get(table, id) {
    const res = await checkAuth(await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      headers: authHeaders()
    }));
    const data = await res.json();
    return (data && data[0]) ? data[0] : null;
  },

  /** Create a record */
  async create(table, data) {
    const res = await checkAuth(await fetch(SUPA_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: { ...authHeaders(), 'Prefer': 'return=representation' },
      body: JSON.stringify(data)
    }));
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  /** Update a record */
  async update(table, id, data) {
    const res = await checkAuth(await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }));
    if (!res.ok) throw new Error(await res.text());
  },

  /** Delete a record */
  async remove(table, id) {
    const headers = authHeaders();
    delete headers['Content-Type']; // DELETE has no body
    const res = await checkAuth(await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'DELETE',
      headers: headers
    }));
    if (!res.ok) throw new Error(await res.text());
  },

  // ── Storage ──

  /** Upload a file to storage */
  async uploadFile(bucket, path, file, onProgress) {
    // Check session validity before upload
    const token = (session && isSessionValid(session)) ? session.access_token : SUPA_KEY;
    return new Promise(function (resolve, reject) {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      if (onProgress) {
        xhr.upload.onprogress = function (e) {
          if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
        };
      }
      xhr.onload = function () {
        if (xhr.status === 200) resolve();
        else if (xhr.status === 401 || xhr.status === 403) {
          handleExpiredJwt();
          reject(new Error('登录已过期，请重新登录'));
        }
        else reject(new Error('上传失败 (HTTP ' + xhr.status + ')'));
      };
      xhr.onerror = function () { reject(new Error('网络错误')); };

      xhr.open('POST', SUPA_URL + '/storage/v1/object/' + bucket + '/' + path);
      xhr.setRequestHeader('apikey', SUPA_KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.send(formData);
    });
  },

  /** Get public URL for a file */
  getFileUrl(bucket, path) {
    return SUPA_URL + '/storage/v1/object/public/' + bucket + '/' + path;
  },

  /** Delete a file from storage */
  async deleteFile(bucket, path) {
    const headers = authHeaders();
    delete headers['Content-Type']; // DELETE has no body, Fastify rejects empty JSON
    const res = await fetch(SUPA_URL + '/storage/v1/object/' + bucket + '/' + path, {
      method: 'DELETE',
      headers: headers
    });
    if (!res.ok) throw new Error('文件删除失败');
  },

  /**
   * Call an RPC function (SECURITY DEFINER)
   * Used for operations that need elevated privileges
   */
  async rpc(functionName, params) {
    const headers = { ...authHeaders(), 'Prefer': 'return=minimal' };
    const res = await checkAuth(await fetch(SUPA_URL + '/rest/v1/rpc/' + functionName, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(params || {})
    }));
    if (!res.ok) {
      const err = await res.json().catch(function () { return { message: 'RPC 请求失败' }; });
      throw new Error(err.message || 'RPC 请求失败');
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
};
