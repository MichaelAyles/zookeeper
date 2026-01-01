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

-- Seed initial zoos (same as current Dexie seed data)
INSERT INTO zoos (id, name, city, country, latitude, longitude) VALUES
  ('zoo-1', 'San Diego Zoo', 'San Diego', 'USA', 32.7353, -117.1490),
  ('zoo-2', 'Singapore Zoo', 'Singapore', 'Singapore', 1.4043, 103.7930),
  ('zoo-3', 'Chester Zoo', 'Chester', 'UK', 53.2274, -2.8868),
  ('zoo-4', 'Taronga Zoo', 'Sydney', 'Australia', -33.8432, 151.2413),
  ('zoo-5', 'Berlin Zoological Garden', 'Berlin', 'Germany', 52.5079, 13.3378),
  ('zoo-6', 'Toronto Zoo', 'Toronto', 'Canada', 43.8175, -79.1853),
  ('zoo-7', 'Bronx Zoo', 'New York', 'USA', 40.8506, -73.8769),
  ('zoo-8', 'London Zoo', 'London', 'UK', 51.5353, -0.1534),
  ('zoo-9', 'Beijing Zoo', 'Beijing', 'China', 39.9390, 116.3390),
  ('zoo-10', 'Ueno Zoo', 'Tokyo', 'Japan', 35.7164, 139.7714),
  ('zoo-11', 'Melbourne Zoo', 'Melbourne', 'Australia', -37.7847, 144.9516),
  ('zoo-12', 'Schönbrunn Zoo', 'Vienna', 'Austria', 48.1823, 16.3028),
  ('zoo-13', 'Henry Doorly Zoo', 'Omaha', 'USA', 41.2260, -95.9281),
  ('zoo-14', 'Zurich Zoo', 'Zurich', 'Switzerland', 47.3851, 8.5743),
  ('zoo-15', 'Prague Zoo', 'Prague', 'Czech Republic', 50.1171, 14.4063);
