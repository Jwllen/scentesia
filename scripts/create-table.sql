-- Run this in your Supabase SQL Editor
-- Go to: Supabase Dashboard → SQL Editor → New Query → paste this → Run

CREATE TABLE IF NOT EXISTS perfumes (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  brand           TEXT NOT NULL,
  country         TEXT,
  gender          TEXT,
  rating          DECIMAL(4,2),
  votes           INTEGER,
  year            INTEGER,
  top_notes       TEXT[],
  heart_notes     TEXT[],
  base_notes      TEXT[],
  accords         TEXT[],
  url             TEXT,
  is_loreal       BOOLEAN DEFAULT false,
  loreal_brand    TEXT
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_perfumes_accords ON perfumes USING GIN(accords);
CREATE INDEX IF NOT EXISTS idx_perfumes_top_notes ON perfumes USING GIN(top_notes);
CREATE INDEX IF NOT EXISTS idx_perfumes_is_loreal ON perfumes(is_loreal);
CREATE INDEX IF NOT EXISTS idx_perfumes_rating ON perfumes(rating DESC);
