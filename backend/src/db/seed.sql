-- ClassPulse: Seed Data

-- University (required for admin hierarchy)
INSERT INTO universities (name, code) VALUES ('ClassPulse University', 'CPU');

-- Admin (password: admin123)
INSERT INTO admins (name, email, password_hash, role, university_id) VALUES
('System Admin', 'admin@classpulse.com', '$2a$10$dummy-hash-replace-with-bcrypt-hash', 'university', 1);

-- Lecturers (password: lecturer123)
INSERT INTO lecturers (name, email, password_hash) VALUES
('Dr. Kwame Asante', 'kasante@university.edu', '$2a$10$dummy-hash-replace-with-bcrypt-hash'),
('Prof. Ama Serwaa', 'aserwaa@university.edu', '$2a$10$dummy-hash-replace-with-bcrypt-hash');

-- Courses
INSERT INTO courses (course_code, course_name, total_weeks, department_id) VALUES
('CS101', 'Introduction to Computer Science', 12, NULL),
('CS201', 'Data Structures & Algorithms', 12, NULL),
('MATH101', 'Calculus I', 12, NULL);

-- Classes
INSERT INTO classes (class_name, department_id) VALUES
('BSc Computer Science - Year 1', NULL),
('BSc Computer Science - Year 2', NULL);

-- Student Roster - Year 1
INSERT INTO student_roster (index_number, student_name, class_id) VALUES
('CS2024001', 'Kofi Mensah', 1),
('CS2024002', 'Akua Boateng', 1),
('CS2024003', 'Yaw Asare', 1),
('CS2024004', 'Esi Ofori', 1),
('CS2024005', 'Kwame Nyarko', 1);

-- Student Roster - Year 2
INSERT INTO student_roster (index_number, student_name, class_id) VALUES
('CS2023001', 'Adwoa Bempong', 2),
('CS2023002', 'Kwasi Agyeman', 2),
('CS2023003', 'Nana Yaa Ampomah', 2),
('CS2023004', 'Kojo Asante', 2),
('CS2023005', 'Abena Adjei', 2);
