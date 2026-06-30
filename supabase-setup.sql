-- ============================================
-- PaperHub — Supabase Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- ── Profiles Table ──
-- Auto-created on signup via trigger
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT '';

-- Auto-create profile on new user signup
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Papers Table ──
CREATE TABLE IF NOT EXISTS papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT DEFAULT '',
  year INTEGER DEFAULT EXTRACT(YEAR FROM now()),
  tags TEXT DEFAULT '',
  description TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  file_type TEXT DEFAULT '',
  file_size BIGINT DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT DEFAULT '',
  downloads INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_papers_user_id ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_subject ON papers(subject);
CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_downloads ON papers(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_papers_avg_rating ON papers(avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(year);
CREATE INDEX IF NOT EXISTS idx_papers_title_lower ON papers(LOWER(title));
CREATE INDEX IF NOT EXISTS idx_papers_tags_lower ON papers(LOWER(tags));
CREATE INDEX IF NOT EXISTS idx_papers_description_lower ON papers(LOWER(description));

-- ── Reviews Table ──
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT DEFAULT '',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(paper_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_paper_id ON reviews(paper_id);

-- ── Favorites Table ──
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, paper_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_paper_id ON favorites(paper_id);

-- ── Friendships Table ──
CREATE TABLE IF NOT EXISTS friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT DEFAULT '',
  friend_email TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

-- ── Notifications Table ──
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  paper_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- ── Atomic Download Increment ──
DROP FUNCTION IF EXISTS increment_downloads(UUID);
CREATE OR REPLACE FUNCTION increment_downloads(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE papers SET downloads = downloads + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Atomic Rating Update ──
DROP FUNCTION IF EXISTS update_paper_rating(UUID, NUMERIC, INTEGER);
CREATE OR REPLACE FUNCTION update_paper_rating(p_id UUID, avg_r NUMERIC, r_count INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE papers SET avg_rating = avg_r, rating_count = r_count WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Auto Recalculate Rating on Review Change ──
DROP FUNCTION IF EXISTS recalc_paper_rating() CASCADE;
CREATE OR REPLACE FUNCTION recalc_paper_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE papers SET
    avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE paper_id = COALESCE(NEW.paper_id, OLD.paper_id)), 0),
    rating_count = (SELECT COUNT(*) FROM reviews WHERE paper_id = COALESCE(NEW.paper_id, OLD.paper_id))
  WHERE id = COALESCE(NEW.paper_id, OLD.paper_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_change ON reviews;
CREATE TRIGGER on_review_change
  AFTER INSERT OR DELETE OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION recalc_paper_rating();

-- ── Create Notification (bypasses RLS) ──
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION create_notification(p_user_id UUID, p_message TEXT, p_paper_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (user_id, message, paper_id, read)
  VALUES (p_user_id, p_message, p_paper_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- ── Profiles ──
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles: public read" ON profiles;
DROP POLICY IF EXISTS "Profiles: owner insert" ON profiles;
DROP POLICY IF EXISTS "Profiles: owner update" ON profiles;

-- Anyone can read profiles (for friend email lookup)
CREATE POLICY "Profiles: public read" ON profiles
  FOR SELECT USING (true);

-- Users can create their own profile if a legacy account is missing one
CREATE POLICY "Profiles: owner insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Profiles: owner update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── Papers ──
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Papers: public read" ON papers;
DROP POLICY IF EXISTS "Papers: auth insert" ON papers;
DROP POLICY IF EXISTS "Papers: owner update" ON papers;
DROP POLICY IF EXISTS "Papers: owner delete" ON papers;

-- Anyone (even anon) can read papers
CREATE POLICY "Papers: public read" ON papers
  FOR SELECT USING (true);

-- Only authenticated users can insert papers
CREATE POLICY "Papers: auth insert" ON papers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only owner can update their papers
CREATE POLICY "Papers: owner update" ON papers
  FOR UPDATE USING (auth.uid() = user_id);

-- Only owner can delete their papers
CREATE POLICY "Papers: owner delete" ON papers
  FOR DELETE USING (auth.uid() = user_id);

-- ── Reviews ──
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews: public read" ON reviews;
DROP POLICY IF EXISTS "Reviews: auth insert" ON reviews;
DROP POLICY IF EXISTS "Reviews: owner update" ON reviews;
DROP POLICY IF EXISTS "Reviews: owner delete" ON reviews;

-- Anyone can read reviews
CREATE POLICY "Reviews: public read" ON reviews
  FOR SELECT USING (true);

-- Authenticated users can insert reviews (must be their own user_id)
CREATE POLICY "Reviews: auth insert" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only owner can update their reviews
CREATE POLICY "Reviews: owner update" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- Only owner can delete their reviews
CREATE POLICY "Reviews: owner delete" ON reviews
  FOR DELETE USING (auth.uid() = user_id);

-- ── Favorites ──
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Favorites: owner read" ON favorites;
DROP POLICY IF EXISTS "Favorites: owner insert" ON favorites;
DROP POLICY IF EXISTS "Favorites: owner delete" ON favorites;

-- Users can only read their own favorites
CREATE POLICY "Favorites: owner read" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only create favorites for themselves
CREATE POLICY "Favorites: owner insert" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own favorites
CREATE POLICY "Favorites: owner delete" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

-- ── Friendships ──
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Friendships: involved read" ON friendships;
DROP POLICY IF EXISTS "Friendships: auth insert" ON friendships;
DROP POLICY IF EXISTS "Friendships: involved update" ON friendships;
DROP POLICY IF EXISTS "Friendships: involved delete" ON friendships;

-- Users can see friendships where they are involved
CREATE POLICY "Friendships: involved read" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can create friendship requests as sender
CREATE POLICY "Friendships: auth insert" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update friendships where they are the receiver (accept)
-- or the sender (cancel)
CREATE POLICY "Friendships: involved update" ON friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can delete friendships they are involved in
CREATE POLICY "Friendships: involved delete" ON friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ── Notifications ──
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications: owner read" ON notifications;
DROP POLICY IF EXISTS "Notifications: auth insert" ON notifications;
DROP POLICY IF EXISTS "Notifications: owner update" ON notifications;
DROP POLICY IF EXISTS "Notifications: owner delete" ON notifications;

-- Users can only see their own notifications
CREATE POLICY "Notifications: owner read" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Authenticated users can create notifications (for friends)
CREATE POLICY "Notifications: auth insert" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can update (mark as read) their own notifications
CREATE POLICY "Notifications: owner update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Notifications: owner delete" ON notifications
  FOR DELETE USING (auth.uid() = user_id);
