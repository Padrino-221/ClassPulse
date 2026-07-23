-- ClassPulse: University Attendance Management System
-- PostgreSQL Schema (v4 - Building Geofence + Rolling PIN)

-- 0. Buildings (lecturer halls)
CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    radius INTEGER NOT NULL DEFAULT 400,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 1. Lecturers
CREATE TABLE IF NOT EXISTS lecturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Admins
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Courses
CREATE TABLE IF NOT EXISTS courses (
    course_code VARCHAR(20) PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    total_weeks INTEGER NOT NULL CHECK (total_weeks > 0 AND total_weeks <= 52),
    min_attendance_pct INTEGER DEFAULT 70 CHECK (min_attendance_pct >= 0 AND min_attendance_pct <= 100)
);

-- 3b. Course ↔ Lecturer (many-to-many)
CREATE TABLE IF NOT EXISTS course_lecturers (
    course_code VARCHAR(20) NOT NULL REFERENCES courses(course_code) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    PRIMARY KEY (course_code, lecturer_id)
);

CREATE INDEX IF NOT EXISTS idx_course_lecturers_lecturer ON course_lecturers(lecturer_id);
-- 4. Classes / Cohorts

CREATE TABLE IF NOT EXISTS classes (
    class_id SERIAL PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL
);

-- 5. Class ↔ Lecturer (many-to-many)

CREATE TABLE IF NOT EXISTS class_lecturers (
    class_id    INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    PRIMARY KEY (class_id, lecturer_id)
);

-- 5. Student Roster
CREATE TABLE IF NOT EXISTS student_roster (
    id SERIAL PRIMARY KEY,
    index_number VARCHAR(50) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    UNIQUE(index_number)
);

CREATE INDEX IF NOT EXISTS idx_student_roster_class ON student_roster(class_id);

-- 6. Active Sessions (v4: building geofence replaces classroom geofence)
CREATE TABLE IF NOT EXISTS active_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code VARCHAR(20) NOT NULL REFERENCES courses(course_code) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
    week_number INTEGER NOT NULL CHECK (week_number > 0),
    pin_seed VARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    radius_meters INTEGER DEFAULT 400,
    pin_spinning BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_pin ON active_sessions(pin_seed, course_code);
CREATE INDEX IF NOT EXISTS idx_active_sessions_lecturer ON active_sessions(lecturer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_sessions_course_class_week ON active_sessions(course_code, class_id, week_number);

-- 7. Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
    record_id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES active_sessions(session_id) ON DELETE CASCADE,
    index_number VARCHAR(50) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    verification_method VARCHAR(10) NOT NULL CHECK (verification_method IN ('GPS', 'MANUAL')),
    marked_by INTEGER REFERENCES lecturers(id) ON DELETE SET NULL,
    device_fingerprint_hash VARCHAR(64),
    timestamp TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, index_number)
);

CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_index ON attendance_records(session_id, index_number);
CREATE INDEX IF NOT EXISTS idx_attendance_fingerprint ON attendance_records(device_fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_attendance_fingerprint_session ON attendance_records(device_fingerprint_hash, session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_records(timestamp);

-- Composite index for active sessions query (is_active + expires_at)
CREATE INDEX IF NOT EXISTS idx_active_sessions_active_expires ON active_sessions(is_active, expires_at);

-- 8. Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('lecturer', 'admin')),
    user_id INTEGER NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token);
