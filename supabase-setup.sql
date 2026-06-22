-- ============================================================
-- 📚 PaperHub · Supabase 数据库初始化脚本
-- 在 Supabase 控制台 → SQL Editor 中运行此文件
-- ============================================================

-- 1. 试卷资料表
CREATE TABLE IF NOT EXISTS papers (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title       TEXT NOT NULL,
    subject     TEXT NOT NULL,
    year        INTEGER NOT NULL,
    tags        TEXT DEFAULT '',
    description TEXT DEFAULT '',
    file_path   TEXT NOT NULL,
    file_type   TEXT DEFAULT '',
    file_size   BIGINT DEFAULT 0,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email  TEXT DEFAULT '',
    downloads   INTEGER DEFAULT 0,
    avg_rating  FLOAT DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_papers_subject ON papers(subject);
CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(year);
CREATE INDEX IF NOT EXISTS idx_papers_user ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_created ON papers(created_at DESC);

-- 2. 评价表
CREATE TABLE IF NOT EXISTS reviews (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paper_id    UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email  TEXT DEFAULT '',
    rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment     TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_paper ON reviews(paper_id);

-- 3. 下载计数函数（使用 RPC 保证原子性）
CREATE OR REPLACE FUNCTION increment_downloads(paper_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE papers SET downloads = downloads + 1 WHERE id = paper_id;
END;
$$ LANGUAGE plpgsql;

-- 4. 启用 Row Level Security
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略：papers
--    任何人可以查看
CREATE POLICY "Anyone can view papers"
    ON papers FOR SELECT
    USING (true);

--    只有登录用户可以上传
CREATE POLICY "Authenticated users can insert papers"
    ON papers FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

--    只有上传者可以删除自己的资料
CREATE POLICY "Users can delete own papers"
    ON papers FOR DELETE
    USING (auth.uid() = user_id);

--    上传者可以更新自己的资料
CREATE POLICY "Users can update own papers"
    ON papers FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. RLS 策略：reviews
--    任何人可以查看
CREATE POLICY "Anyone can view reviews"
    ON reviews FOR SELECT
    USING (true);

--    登录用户可以发表评价
CREATE POLICY "Authenticated users can insert reviews"
    ON reviews FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 7. Storage 策略：允许登录用户上传文件
CREATE POLICY "Allow authenticated uploads"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'papers');

--    允许任何人读取文件
CREATE POLICY "Allow public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'papers');

--    允许上传者删除自己的文件
CREATE POLICY "Allow owner delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (owner = auth.uid());
