# 📚 PaperHub · 试卷资料共享平台

一个基于 Supabase + Vercel 的试卷资料共享网站，支持上传、搜索、下载、评分。

## 功能

- 🔐 邮箱注册/登录（Supabase Auth）
- 👤 账号昵称（资料、评论、好友列表优先显示昵称）
- 📤 上传试卷（PDF/图片/ZIP/Office 等，最大 100MB）
- 🔍 按标题、学科、年份、标签搜索
- ⬇ 下载计数
- ⭐ 五星评分 + 评论
- ⭐ 账号云端收藏（未迁移数据库时自动降级为本地收藏）
- 📱 响应式设计，手机可用

## 部署步骤（约 10 分钟）

### 第一步：创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) → 用 GitHub 登录
2. 点击 **New project** → 输入名称 `paperhub`
3. **Database Password** 设置一个密码（记下来）
4. Region 选 **Northeast Asia (Tokyo)** 或默认
5. 等 2 分钟项目创建完成

### 第二步：配置数据库

1. 在 Supabase 控制台左侧 → **SQL Editor**
2. 点击 **New query**
3. 复制 [`supabase-setup.sql`](supabase-setup.sql) 的全部内容 → 粘贴
4. 点击右下角 **Run** → 看到 "Success"
5. 如果你是从旧版本升级，也需要重新运行这份 SQL，以创建收藏表、搜索索引和 RLS 策略。

### 第三步：创建存储桶

1. 左侧 → **Storage**
2. 点击 **New bucket** → 名称填 `papers`
3. ✅ 勾选 **Public bucket**
4. 点击 **Create bucket**

### 第四步：获取 API 密钥

1. 左侧 → **Project Settings** → **API**
2. 复制 **Project URL**（类似 `https://xxxxx.supabase.co`）
3. 复制 **anon public key**（以 `eyJ` 开头）

### 第五步：配置代码

1. 打开 `js/supabase.js`
2. 修改文件顶部的 Supabase 配置：
```js
const SUPA_URL = 'https://xxxxx.supabase.co';   // 填你的 Project URL
const SUPA_KEY = 'sb_publishable_xxx';          // 填你的 publishable/anon key
```

### 第六步：部署到 Vercel（永久在线，免费）

1. 打开 [vercel.com](https://vercel.com) → 用 GitHub 登录
2. 先把代码推送到 GitHub：
```bash
git init
git add .
git commit -m "init"
# 在 GitHub 上创建仓库，然后：
git remote add origin https://github.com/你的用户名/paperhub.git
git push -u origin main
```
3. 在 Vercel 点击 **New Project** → 选择你的仓库 → **Deploy**
4. 30 秒后网站上线，获得 `https://xxx.vercel.app` 永久地址

### 本地测试

```bash
# 任意方式启动一个本地服务器
python -m http.server 8080
# 打开 http://localhost:8080
```

> ⚠️ 直接用浏览器打开 `index.html` 会因 CORS 限制而无法连接 Supabase，需要用 http server。

## 技术栈

- **前端**: 纯 HTML/CSS/JS，零框架
- **后端**: Supabase（PostgreSQL + Auth + Storage）
- **部署**: Vercel（免费托管，24/7 在线）

## 免费额度

Supabase 免费版：
- 500MB 数据库
- 1GB 文件存储
- 50,000 月活用户
- 无限 API 请求

足够个人或小团队使用。
