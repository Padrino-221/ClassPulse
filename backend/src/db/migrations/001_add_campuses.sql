-- Migration 001: Add campuses table and campus_id to active_sessions

CREATE TABLE IF NOT EXISTS campuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    radius INTEGER NOT NULL DEFAULT 400,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add campus_id to active_sessions (nullable for backward compatibility)
ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS campus_id INTEGER REFERENCES campuses(id) ON DELETE SET NULL;

-- Seed default campus (Accra, Ghana — adjust coordinates as needed)
INSERT INTO campuses (name, latitude, longitude, radius)
VALUES ('Main Campus', 5.650000, -0.186000, 400)
ON CONFLICT DO NOTHING;
