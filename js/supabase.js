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

export const supabase = {
  /** Get/restore session from localStorage */
  async getSession() {
    try {
      const stored = localStorage.getItem('sb_session');
      if (stored) session = JSON.parse(stored);
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

  /** Query records */
  async query(table, options) {
    options = options || {};
    const params = new URLSearchParams();
    if (options.where) {
      Object.keys(options.where).forEach(function (k) {
        params.set(k, 'eq.' + options.where[k]);
      });
    }
    if (options.order) params.set('order', options.order);
    if (options.limit) params.set('limit', options.limit);
    if (options.skip) params.set('skip', options.skip);

    const isCount = options.count;
    if (isCount) {
      params.set('limit', '0');
    }

    const queryString = params.toString();
    const url = SUPA_URL + '/rest/v1/' + table + (queryString ? '?' + queryString : '');
    const headers = authHeaders();
    if (isCount) headers['Prefer'] = 'count=exact';

    const res = await fetch(url, { headers: headers });
    if (!res.ok) throw new Error(await res.text());

    if (isCount) {
      const range = res.headers.get('content-range') || '';
      return parseInt(range.split('/').pop()) || 0;
    }
    return await res.json();
  },

  /** Get a single record by ID */
  async get(table, id) {
    const res = await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      headers: authHeaders()
    });
    const data = await res.json();
    return (data && data[0]) ? data[0] : null;
  },

  /** Create a record */
  async create(table, data) {
    const res = await fetch(SUPA_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: { ...authHeaders(), 'Prefer': 'return=representation' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  /** Update a record */
  async update(table, id, data) {
    await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  /** Delete a record */
  async remove(table, id) {
    await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'DELETE',
      headers: authHeaders()
    });
  },

  // ── Storage ──

  /** Upload a file to storage */
  async uploadFile(bucket, path, file, onProgress) {
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
        else reject(new Error('上传失败'));
      };
      xhr.onerror = function () { reject(new Error('网络错误')); };

      xhr.open('POST', SUPA_URL + '/storage/v1/object/' + bucket + '/' + path);
      xhr.setRequestHeader('apikey', SUPA_KEY);
      xhr.setRequestHeader(
        'Authorization',
        'Bearer ' + (session ? session.access_token : SUPA_KEY)
      );
      xhr.send(formData);
    });
  },

  /** Get public URL for a file */
  getFileUrl(bucket, path) {
    return SUPA_URL + '/storage/v1/object/public/' + bucket + '/' + path;
  },

  /**
   * Call an RPC function (SECURITY DEFINER)
   * Used for operations that need elevated privileges
   */
  async rpc(functionName, params) {
    const headers = authHeaders();
    const res = await fetch(SUPA_URL + '/rest/v1/rpc/' + functionName, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(params || {})
    });
    if (!res.ok) {
      const err = await res.json().catch(function() { return { message: 'RPC 请求失败' }; });
      throw new Error(err.message || 'RPC 请求失败');
    }
    // Return parsed JSON, or null for empty responses
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
};
