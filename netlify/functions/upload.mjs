// Netlify Serverless Function — 代理文件上传到 GitHub
// Token 安全存储在 Netlify 环境变量中，不暴露前端

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const filePath = formData.get('path'); // e.g. "uid/timestamp.pdf"

    if (!file || !filePath) {
      return Response.json({ error: 'Missing file or path' }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    const repo = 'cyb13579/paperhub';
    const buf = Buffer.from(await file.arrayBuffer());

    // Upload to GitHub via Contents API
    const githubUrl = `https://api.github.com/repos/${repo}/contents/files/${filePath}`;
    const body = JSON.stringify({
      message: `Upload ${filePath}`,
      content: buf.toString('base64'),
      branch: 'master',
    });

    const ghRes = await fetch(githubUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body,
    });

    if (!ghRes.ok) {
      const err = await ghRes.json().catch(() => ({}));
      return Response.json({ error: err.message || 'Upload failed' }, { status: ghRes.status });
    }

    const data = await ghRes.json();
    const downloadUrl = data.content?.download_url || `https://raw.githubusercontent.com/${repo}/master/files/${encodeURIComponent(filePath)}`;

    return Response.json({ url: downloadUrl });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const config = { path: '/api/upload' };
