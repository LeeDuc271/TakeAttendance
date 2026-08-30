const db = require('../config/db');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

exports.createClass = async (req, res, next) => {
  try {
    const { name, teacher_id } = req.body;
    
    let finalTeacherId = teacher_id;
    if (typeof finalTeacherId === 'string') finalTeacherId = finalTeacherId.trim();

    if (!finalTeacherId) {
        return res.status(400).json({ status: 'error', message: 'Tên giáo viên hoặc ID không hợp lệ' });
    }

    if (isNaN(finalTeacherId)) {
        const u = await db.query('SELECT id FROM users WHERE username = $1', [finalTeacherId]);
        if (u.rows.length > 0) {
            finalTeacherId = u.rows[0].id;
        } else {
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('123456', 10);
            const newUser = await db.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id', [finalTeacherId, hash, 'teacher']);
            finalTeacherId = newUser.rows[0].id;
        }
    }

    const result = await db.query(
      'INSERT INTO classes (name, teacher_id) VALUES ($1, $2) RETURNING *',
      [name, finalTeacherId]
    );
    
    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

exports.createStudent = async (req, res, next) => {
  try {
    const { student_code, full_name, class_id } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ status: 'error', message: 'Student image is required' });
    }

    const formData = new FormData();
    formData.append('files', fs.createReadStream(file.path), file.originalname);

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    
    // Call AI Microservice
    const aiResponse = await axios.post(`${aiServiceUrl}/extract_faces`, formData, {
      headers: { ...formData.getHeaders() }
    });

    // Cleanup temp file
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    if (aiResponse.data.status !== 'success' || !aiResponse.data.data || aiResponse.data.data.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No face detected in the uploaded image' });
    }

    // Take the first detected face's embedding
    const face = aiResponse.data.data[0];
    const embeddingString = `[${face.embedding.join(',')}]`;
    
    const result = await db.query(
      'INSERT INTO students (student_code, full_name, class_id, embedding) VALUES ($1, $2, $3, $4) RETURNING id, student_code, full_name, class_id',
      [student_code, full_name, class_id, embeddingString]
    );
    
    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
};

exports.batchUploadStudents = async (req, res, next) => {
  try {
    const files = req.files;
    const pathsStr = req.body.paths; // JSON string array of paths corresponding to files
    if (!files || files.length === 0 || !pathsStr) {
      return res.status(400).json({ status: 'error', message: 'Files and paths are required' });
    }
    
    let paths = [];
    try {
      paths = JSON.parse(pathsStr);
    } catch (e) {
      return res.status(400).json({ status: 'error', message: 'Invalid paths format' });
    }
    
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    let addedCount = 0;
    let errors = [];

    // Map to cache class IDs to avoid excessive DB queries
    const classMap = {};

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = paths[i]; // e.g., "ClassA/SV01_Nguyen Van A/image.jpg"
      
      try {
        const parts = relativePath.split('/');
        if (parts.length < 3) {
            errors.push({ file: relativePath, error: 'Invalid directory structure. Expected ClassName/StudentCode_StudentName/image.jpg' });
            continue;
        }

        // Extract and sanitize inputs to prevent XSS / malicious strings
        let className = parts[0].replace(/[<>]/g, '').trim();
        const studentFolder = parts[1].replace(/[<>]/g, '').trim();
        
        // Parse Student Code and Name
        // Assuming format Code_Name
        let studentCode = studentFolder;
        let studentName = studentFolder;
        const underscoreIndex = studentFolder.indexOf('_');
        if (underscoreIndex !== -1) {
            studentCode = studentFolder.substring(0, underscoreIndex).trim();
            studentName = studentFolder.substring(underscoreIndex + 1).trim();
        }

        // Additional validation
        if (!className || !studentCode || !studentName) {
            errors.push({ file: relativePath, error: 'Invalid folder names after sanitization' });
            continue;
        }

        // 1. Get or Create Class
        let classId;
        if (classMap[className]) {
            classId = classMap[className];
        } else {
            // Check DB
            const classRes = await db.query('SELECT id FROM classes WHERE name = $1', [className]);
            if (classRes.rows.length > 0) {
                classId = classRes.rows[0].id;
            } else {
                // Dynamically get the first available teacher, or fallback to the current user (admin)
                let defaultTeacherId = req.user ? req.user.id : 1;
                const teacherRes = await db.query("SELECT id FROM users WHERE role = 'teacher' LIMIT 1");
                if (teacherRes.rows.length > 0) {
                    defaultTeacherId = teacherRes.rows[0].id;
                }
                const newClassRes = await db.query('INSERT INTO classes (name, teacher_id) VALUES ($1, $2) RETURNING id', [className, defaultTeacherId]);
                classId = newClassRes.rows[0].id;
            }
            classMap[className] = classId;
        }

        // 2. Call AI Microservice
        const formData = new FormData();
        formData.append('files', fs.createReadStream(file.path), file.originalname);

        const aiResponse = await axios.post(`${aiServiceUrl}/extract_faces`, formData, {
            headers: { ...formData.getHeaders() }
        });

        if (aiResponse.data.status !== 'success' || !aiResponse.data.data || aiResponse.data.data.length === 0) {
            errors.push({ file: relativePath, error: 'No face detected' });
            continue;
        }

        const face = aiResponse.data.data[0];
        const embeddingString = `[${face.embedding.join(',')}]`;

        // 3. Insert into DB (upsert based on student_code to avoid duplicates if possible, but for simplicity insert or ignore/fail)
        // Check if student exists
        const studentCheck = await db.query('SELECT id FROM students WHERE student_code = $1', [studentCode]);
        if (studentCheck.rows.length > 0) {
            // Update embedding and class if exists
            await db.query(
                'UPDATE students SET embedding = $1, full_name = $2, class_id = $3 WHERE student_code = $4',
                [embeddingString, studentName, classId, studentCode]
            );
        } else {
            // Insert
            await db.query(
                'INSERT INTO students (student_code, full_name, class_id, embedding) VALUES ($1, $2, $3, $4)',
                [studentCode, studentName, classId, embeddingString]
            );
        }
        addedCount++;
        
      } catch (err) {
        errors.push({ file: relativePath, error: err.message });
      } finally {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    
    res.status(200).json({
      status: 'success',
      message: `Successfully processed ${addedCount} students`,
      errors: errors
    });

  } catch (error) {
    // Cleanup any remaining files
    if (req.files) {
        req.files.forEach(f => {
            if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
    }
    next(error);
  }
};

exports.getClasses = async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT c.*, u.username as teacher_name 
            FROM classes c 
            LEFT JOIN users u ON c.teacher_id = u.id 
            ORDER BY c.created_at DESC
        `);
        res.json({ status: 'success', data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.updateClass = async (req, res, next) => {
  try {
    const { name, teacher_id } = req.body;
    let finalTeacherId = teacher_id;
    if (typeof finalTeacherId === 'string') finalTeacherId = finalTeacherId.trim();

    if (!finalTeacherId) {
        return res.status(400).json({ status: 'error', message: 'Tên giáo viên hoặc ID không hợp lệ' });
    }

    if (isNaN(finalTeacherId)) {
        const u = await db.query('SELECT id FROM users WHERE username = $1', [finalTeacherId]);
        if (u.rows.length > 0) {
            finalTeacherId = u.rows[0].id;
        } else {
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('123456', 10);
            const newUser = await db.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id', [finalTeacherId, hash, 'teacher']);
            finalTeacherId = newUser.rows[0].id;
        }
    }

    const result = await db.query(
      'UPDATE classes SET name = $1, teacher_id = $2 WHERE id = $3 RETURNING *',
      [name, finalTeacherId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Class not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM classes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Class not found' });
    res.json({ status: 'success', message: 'Class deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getStudents = async (req, res, next) => {
  try {
    const { class_id } = req.query;
    
    const query = `
      SELECT 
          s.id, 
          s.student_code, 
          s.full_name, 
          s.class_id, 
          c.name as class_name,
          s.created_at,
          (SELECT COUNT(DISTINCT ase.id) FROM attendance_sessions ase WHERE ase.class_id = s.class_id) as total_sessions,
          (SELECT COUNT(DISTINCT al.session_id) 
           FROM attendance_logs al 
           JOIN attendance_sessions ase2 ON al.session_id = ase2.id 
           WHERE al.student_id = s.id AND al.status = 'present' AND ase2.class_id = s.class_id) as attended_sessions
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      ${class_id ? 'WHERE s.class_id = $1' : ''}
      ORDER BY s.created_at DESC
    `;
    
    const params = class_id ? [class_id] : [];
    const result = await db.query(query, params);
    
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { student_code, full_name, class_id } = req.body;
    const result = await db.query(
      'UPDATE students SET student_code = $1, full_name = $2, class_id = $3 WHERE id = $4 RETURNING id, student_code, full_name, class_id',
      [student_code, full_name, class_id, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Student not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Student not found' });
    res.json({ status: 'success', message: 'Student deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getTeachers = async (req, res, next) => {
  try {
    const result = await db.query("SELECT id, username, role, created_at FROM users WHERE role = 'teacher' ORDER BY created_at DESC");
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.createTeacher = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ status: 'error', message: 'Username and password required' });
    }
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'teacher') RETURNING id, username, role, created_at",
      [username, hash]
    );
    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // unique violation
        return res.status(400).json({ status: 'error', message: 'Username already exists' });
    }
    next(error);
  }
};

exports.updateTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username, password } = req.body;
    
    let query = "UPDATE users SET username = $1 WHERE id = $2 AND role = 'teacher' RETURNING id, username, role";
    let params = [username, id];

    if (password) {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(password, 10);
        query = "UPDATE users SET username = $1, password_hash = $2 WHERE id = $3 AND role = 'teacher' RETURNING id, username, role";
        params = [username, hash, id];
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Teacher not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
        return res.status(400).json({ status: 'error', message: 'Username already exists' });
    }
    next(error);
  }
};

exports.deleteTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query("DELETE FROM users WHERE id = $1 AND role = 'teacher' RETURNING *", [id]);
    if (result.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Teacher not found' });
    res.json({ status: 'success', message: 'Teacher deleted successfully' });
  } catch (error) {
    if (error.code === '23503') { // foreign key violation
        return res.status(400).json({ status: 'error', message: 'Cannot delete teacher assigned to classes' });
    }
    next(error);
  }
};
