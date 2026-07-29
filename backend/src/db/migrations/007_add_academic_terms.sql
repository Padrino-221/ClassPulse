-- Migration 007: Add academic_years and semesters tables

-- Academic Years (e.g., "2026/2027")
CREATE TABLE IF NOT EXISTS academic_years (
  id SERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL UNIQUE,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Semesters (linked to an academic year)
CREATE TABLE IF NOT EXISTS semesters (
  id SERIAL PRIMARY KEY,
  academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  label VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(academic_year_id, number)
);

-- Add semester_id to active_sessions
ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS semester_id INTEGER REFERENCES semesters(id) ON DELETE SET NULL;
