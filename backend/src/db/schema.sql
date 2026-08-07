-- ClassPulse: University Attendance Management System
-- PostgreSQL Schema (v5 - University Hierarchy + Soft Deletes + Audit)

-- 0. Universities (top level)
CREATE TABLE IF NOT EXISTS universities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 1. Schools / Faculties
CREATE TABLE IF NOT EXISTS schools (
    id SERIAL PRIMARY KEY,
    university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_active_code ON schools(university_id, code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_active_name ON schools(university_id, name) WHERE deleted_at IS NULL;

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_active_code ON departments(school_id, code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_active_name ON departments(school_id, name) WHERE deleted_at IS NULL;

-- 3. Lecture Halls
CREATE TABLE IF NOT EXISTS lecture_halls (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    radius INTEGER NOT NULL DEFAULT 400,
    university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Academic Years
CREATE TABLE IF NOT EXISTS academic_years (
    id SERIAL PRIMARY KEY,
    label VARCHAR(100) NOT NULL UNIQUE,
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Semesters
CREATE TABLE IF NOT EXISTS semesters (
    id SERIAL PRIMARY KEY,
    academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    number INTEGER NOT NULL CHECK (number IN (1, 2)),
    label VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(academic_year_id, number)
);

-- 6. Admins (multi-level: university, school, department)
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'university',
    university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
    school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_active_email ON admins(email) WHERE deleted_at IS NULL;

-- 7. Lecturers
CREATE TABLE IF NOT EXISTS lecturers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lecturers_active_email ON lecturers(email) WHERE deleted_at IS NULL;

-- 8. Courses (surrogate id PK, course_code reusable after soft-delete)
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    total_weeks INTEGER NOT NULL CHECK (total_weeks > 0 AND total_weeks <= 52),
    min_attendance_pct INTEGER DEFAULT 70 CHECK (min_attendance_pct >= 0 AND min_attendance_pct <= 100),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_active_code ON courses(course_code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_active_dept_name ON courses(department_id, course_name) WHERE deleted_at IS NULL;

-- 9. Course <-> Lecturer (many-to-many)
CREATE TABLE IF NOT EXISTS course_lecturers (
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, lecturer_id)
);
CREATE INDEX IF NOT EXISTS idx_course_lecturers_lecturer ON course_lecturers(lecturer_id);

-- 10. Classes / Cohorts
CREATE TABLE IF NOT EXISTS classes (
    class_id SERIAL PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_dept_name ON classes(department_id, class_name) WHERE deleted_at IS NULL;

-- 11. Class <-> Lecturer (many-to-many)
CREATE TABLE IF NOT EXISTS class_lecturers (
    class_id    INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    PRIMARY KEY (class_id, lecturer_id)
);

-- 12. Student Roster
CREATE TABLE IF NOT EXISTS student_roster (
    id SERIAL PRIMARY KEY,
    index_number VARCHAR(50) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    deleted_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_roster_active_index ON student_roster(index_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_student_roster_class ON student_roster(class_id);

-- 13. Active Sessions
CREATE TABLE IF NOT EXISTS active_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code VARCHAR(20) NOT NULL,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    lecture_hall_id INTEGER REFERENCES lecture_halls(id) ON DELETE SET NULL,
    week_number INTEGER NOT NULL CHECK (week_number > 0),
    pin_seed VARCHAR(255) NOT NULL,
    pin_spinning BOOLEAN DEFAULT TRUE,
    semester_id INTEGER REFERENCES semesters(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_active_sessions_pin ON active_sessions(pin_seed, course_code);
CREATE INDEX IF NOT EXISTS idx_active_sessions_lecturer ON active_sessions(lecturer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_sessions_course_class_week ON active_sessions(course_id, class_id, week_number);
CREATE INDEX IF NOT EXISTS idx_active_sessions_active_expires ON active_sessions(is_active, expires_at);

-- 14. Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
    record_id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES active_sessions(session_id) ON DELETE CASCADE,
    index_number VARCHAR(50) NOT NULL,
    verification_method VARCHAR(10) NOT NULL CHECK (verification_method IN ('GPS', 'MANUAL', 'PIN')),
    marked_by INTEGER REFERENCES lecturers(id) ON DELETE SET NULL,
    device_fingerprint_hash VARCHAR(64),
    timestamp TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    UNIQUE(session_id, index_number)
);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_index ON attendance_records(session_id, index_number);
CREATE INDEX IF NOT EXISTS idx_attendance_fingerprint ON attendance_records(device_fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_attendance_fingerprint_session ON attendance_records(device_fingerprint_hash, session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance_records(timestamp);

-- 15. Password Reset Tokens
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

-- 16. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- 17. Admin Invitations
CREATE TABLE IF NOT EXISTS admin_invitations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    invited_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    accepted BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON admin_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON admin_invitations(email);

-- 18. Schema Migrations Tracker
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
