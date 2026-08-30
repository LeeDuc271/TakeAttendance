-- Enable vector extension for pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Table for Users (Admin and Teachers)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Classes
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Students
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    embedding vector(512), -- 512-dimensional vector from InsightFace
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Attendance Sessions
CREATE TABLE attendance_sessions (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'completed'
);

-- Table for Attendance Logs (Detailed records per session)
CREATE TABLE attendance_logs (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent')),
    confidence_score FLOAT,
    relative_position JSONB, -- To store { "cluster": "Front Left", "x": ..., "y": ... }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster cosine similarity search (using hnsw)
CREATE INDEX ON students USING hnsw (embedding vector_cosine_ops);

-- Create a function to find matching faces bounded by class_id
CREATE OR REPLACE FUNCTION match_faces_in_class(
    target_class_id INTEGER,
    query_embedding vector(512),
    match_threshold FLOAT DEFAULT 0.6,
    match_count INT DEFAULT 1
)
RETURNS TABLE (
    student_id INTEGER,
    student_code VARCHAR(20),
    full_name VARCHAR(100),
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.student_code,
        s.full_name,
        1 - (s.embedding <=> query_embedding) AS similarity
    FROM 
        students s
    WHERE 
        s.class_id = target_class_id
        AND 1 - (s.embedding <=> query_embedding) >= match_threshold
    ORDER BY 
        s.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Insert default users
-- Password for all is 'admin123'
INSERT INTO users (username, password_hash, role) VALUES 
('admin', '$2b$10$uOcTJXw70xfg1oA3b0WDkeYHgAFX3/IHinhNhf6fHVada5fj1YA.K', 'admin'),
('teacher1', '$2b$10$uOcTJXw70xfg1oA3b0WDkeYHgAFX3/IHinhNhf6fHVada5fj1YA.K', 'teacher')
ON CONFLICT (username) DO NOTHING;

