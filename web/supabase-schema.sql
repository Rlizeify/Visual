CREATE TABLE IF NOT EXISTS users (
  spotify_id TEXT PRIMARY KEY,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  spotify_id TEXT PRIMARY KEY REFERENCES users(spotify_id),
  settings JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wiki_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  spotify_id TEXT REFERENCES users(spotify_id),
  category TEXT,
  title TEXT,
  content JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
