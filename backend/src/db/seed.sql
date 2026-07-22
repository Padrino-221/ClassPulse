-- ClassPulse: Seed Data

-- Admin (password: admin123)
INSERT INTO admins (name, email, password_hash) VALUES
('System Admin', 'admin@classpulse.com', '$2a$10$dummy-hash-replace-with-bcrypt-hash');

-- Lecturers (password: lecturer123)
INSERT INTO lecturers (name, email, password_hash) VALUES
('Dr. Kwame Asante', 'kasante@university.edu', '$2a$10$dummy-hash-replace-with-bcrypt-hash'),
('Prof. Ama Serwaa', 'aserwaa@university.edu', '$2a$10$dummy-hash-replace-with-bcrypt-hash');

-- Courses
INSERT INTO courses (course_code, course_name, total_weeks) VALUES
('CS101', 'Introduction to Computer Science', 12),
('CS201', 'Data Structures & Algorithms', 12),
('MATH101', 'Calculus I', 12);

-- Classes
INSERT INTO classes (class_name) VALUES
('BSc Computer Science - Year 1'),
('BSc Computer Science - Year 2');

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
