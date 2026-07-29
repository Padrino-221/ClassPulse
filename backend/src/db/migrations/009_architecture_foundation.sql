-- Migration 009: Architecture Plan — Database Foundation
-- Creates universities, schools, departments tables
-- Adds scope columns to admins, lecturers, courses, classes, lecture_halls, academic_years

-- 1. Universities (top level)
CREATE TABLE IF NOT EXISTS universities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Schools / Faculties
CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  university_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(university_id, code)
);

-- 3. Departments
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(school_id, code)
);

-- 4. Alter admins table — add role & scope columns
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'university';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- 5. Alter lecturers — add department scope
ALTER TABLE lecturers ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- 6. Alter courses — add department scope
ALTER TABLE courses ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- 7. Alter classes — add department scope
ALTER TABLE classes ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- 8. Alter lecture_halls — add university scope
ALTER TABLE lecture_halls ADD COLUMN IF NOT EXISTS university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL;

-- 9. Alter academic_years — add university scope
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS university_id INTEGER REFERENCES universities(id) ON DELETE SET NULL;

-- 10. Audit logs table
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

-- 11. Admin invitations table
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

-- 12. Soft delete columns (added to all major tables)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE lecturers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE lecture_halls ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE student_roster ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
