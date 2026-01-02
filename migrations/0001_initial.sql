-- Zookeeper D1 Database Schema
-- Run with: wrangler d1 migrations apply zookeeper-db

-- Users table (from Google OAuth)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Zoos (GLOBAL - shared by all users)
CREATE TABLE zoos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  country TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  website_url TEXT,
  animals_generated_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id TEXT REFERENCES users(id)
);

-- Animals (GLOBAL - tied to zoos)
CREATE TABLE animals (
  id TEXT PRIMARY KEY,
  zoo_id TEXT NOT NULL REFERENCES zoos(id) ON DELETE CASCADE,
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  category TEXT NOT NULL,
  exhibit_area TEXT,
  fun_fact TEXT,
  image_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Visits (PRIVATE - per user)
CREATE TABLE visits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zoo_id TEXT NOT NULL REFERENCES zoos(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  notes TEXT
);

-- Sightings (PRIVATE - per user)
CREATE TABLE sightings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  animal_id TEXT NOT NULL REFERENCES animals(id),
  seen_at TEXT NOT NULL,
  photo_url TEXT,
  ai_identified INTEGER DEFAULT 0,
  ai_confidence REAL,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_zoos_country ON zoos(country);
CREATE INDEX idx_animals_zoo ON animals(zoo_id);
CREATE INDEX idx_animals_category ON animals(category);
CREATE INDEX idx_visits_user ON visits(user_id);
CREATE INDEX idx_visits_zoo ON visits(zoo_id);
CREATE INDEX idx_sightings_user ON sightings(user_id);
CREATE INDEX idx_sightings_visit ON sightings(visit_id);
CREATE INDEX idx_sightings_animal ON sightings(animal_id);

-- Zoo data is populated by the UK Zoo Scraper (scripts/uk-zoo-scraper)
-- Run: npx tsx scripts/uk-zoo-scraper/index.ts --write-db
