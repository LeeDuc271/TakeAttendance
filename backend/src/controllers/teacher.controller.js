const db = require('../config/db');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

exports.getClasses = async (req, res, next) => {
  try {
    const result = await db.query(`
        SELECT c.*, u.username as teacher_name 
        FROM classes c 
        LEFT JOIN users u ON c.teacher_id = u.id 
        WHERE c.teacher_id = $1
        ORDER BY c.created_at DESC
    `, [req.user.id]);
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    next(error);
  }
};

const determinePosition = (box, allBoxes) => {
    if (!allBoxes || allBoxes.length === 0) return "Unknown";
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allBoxes.forEach(b => {
        if (b.x < minX) minX = b.x;
        if (b.x + b.w > maxX) maxX = b.x + b.w;
        if (b.y < minY) minY = b.y;
        if (b.y + b.h > maxY) maxY = b.y + b.h;
    });
    
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    
    const centerX = box.x + box.w / 2;
    const centerY = box.y + box.h / 2;
    
    let position = "";
    position += centerY < midY ? "Front " : "Back ";
    position += centerX < midX ? "Left" : "Right";
    
    return position;
};

exports.scanAttendance = async (req, res, next) => {
  try {
    const { class_id } = req.body;
    const files = req.files; // provided by multer

    if (!class_id || !files || files.length === 0) {
      return res.status(400).json({ status: 'error', message: 'class_id and files are required' });
    }

    // 1. Prepare images to send to AI microservice
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', fs.createReadStream(file.path), file.originalname);
    });

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    
    // 2. Call AI Microservice
    const aiResponse = await axios.post(`${aiServiceUrl}/extract_faces`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    if (aiResponse.data.status !== 'success') {
      throw new Error('AI processing failed');
    }

    const detectedFaces = aiResponse.data.data; // [{ bounding_box, embedding }]

    const MATCH_THRESHOLD = parseFloat(process.env.MATCH_THRESHOLD) || 0.5;

    // 3. Match vectors against DB concurrently
    const matchedStudentsMap = new Map(); // to avoid duplicates
    const allBoxes = detectedFaces.map(f => f.bounding_box);

    const matchPromises = detectedFaces.map(async (face) => {
      const embeddingString = `[${face.embedding.join(',')}]`;
      const matchResult = await db.query(
        'SELECT * FROM match_faces_in_class($1, $2, $3, $4)',
        [class_id, embeddingString, MATCH_THRESHOLD, 1] 
      );
      return { face, matchResult };
    });

    const matchResults = await Promise.all(matchPromises);

    for (const { face, matchResult } of matchResults) {
      if (matchResult.rows.length > 0) {
        const student = matchResult.rows[0];
        if (!matchedStudentsMap.has(student.student_id)) {
          matchedStudentsMap.set(student.student_id, {
            ...student,
            position: determinePosition(face.bounding_box, allBoxes)
          });
        }
      }
    }

    const presentList = Array.from(matchedStudentsMap.values());
    const presentIds = presentList.map(s => s.student_id);

    // 4. Get all students in the class
    const allStudentsResult = await db.query(
      'SELECT id, student_code, full_name FROM students WHERE class_id = $1',
      [class_id]
    );
    const allStudents = allStudentsResult.rows;

    // 5. Determine absent students
    const absentList = allStudents.filter(s => !presentIds.includes(s.id));

    // 6. Return accumulated data WITHOUT saving to DB
    // We now just return the matched results.

    // Clean up uploaded temp files
    files.forEach(file => fs.unlinkSync(file.path));

    res.json({
      status: 'success',
      data: {
        presentList,
        absentList
      }
    });

  } catch (error) {
    // Clean up uploaded temp files on error
    if (req.files) {
        req.files.forEach(file => {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
    }
    next(error);
  }
};

exports.scanWebcamFrame = async (req, res, next) => {
  try {
    const { class_id } = req.body;
    const file = req.file;

    if (!class_id || !file) {
      return res.status(400).json({ status: 'error', message: 'class_id and file are required' });
    }

    const formData = new FormData();
    formData.append('files', fs.createReadStream(file.path), file.originalname);

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    
    const aiResponse = await axios.post(`${aiServiceUrl}/extract_faces`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    if (aiResponse.data.status !== 'success') {
      throw new Error('AI processing failed');
    }

    const detectedFaces = aiResponse.data.data;
    const MATCH_THRESHOLD = parseFloat(process.env.MATCH_THRESHOLD) || 0.5;

    const recognizedStudents = [];
    const matchPromises = detectedFaces.map(async (face) => {
      const embeddingString = `[${face.embedding.join(',')}]`;
      const matchResult = await db.query(
        'SELECT student_code, full_name, similarity FROM match_faces_in_class($1, $2, $3, $4)',
        [class_id, embeddingString, MATCH_THRESHOLD, 1]
      );
      
      let studentName = "Unknown";
      let studentCode = "";
      if (matchResult.rows.length > 0) {
          studentName = matchResult.rows[0].full_name;
          studentCode = matchResult.rows[0].student_code;
      }

      recognizedStudents.push({
          bounding_box: face.bounding_box,
          student_name: studentName,
          student_code: studentCode
      });
    });

    await Promise.all(matchPromises);

    // Clean up temp file
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    res.json({
      status: 'success',
      data: recognizedStudents
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
};

exports.saveAttendanceSession = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { class_id, present_ids } = req.body;

    if (!class_id || !Array.isArray(present_ids)) {
      return res.status(400).json({ status: 'error', message: 'class_id and present_ids array are required' });
    }

    // 1. Create session
    const sessionResult = await client.query(
      'INSERT INTO attendance_sessions (class_id, teacher_id) VALUES ($1, $2) RETURNING id',
      [class_id, req.user ? req.user.id : null]
    );
    const sessionId = sessionResult.rows[0].id;

    // 2. Get all students
    const allResult = await client.query('SELECT id, student_code FROM students WHERE class_id = $1', [class_id]);
    const allStudents = allResult.rows;

    // 3. Log present and absent
    const promises = allStudents.map(s => {
      const isPresent = present_ids.includes(s.student_code);
      return client.query(
        'INSERT INTO attendance_logs (session_id, student_id, status) VALUES ($1, $2, $3)',
        [sessionId, s.id, isPresent ? 'present' : 'absent']
      );
    });

    await Promise.all(promises);
    await client.query('COMMIT');

    res.json({ status: 'success', data: { sessionId } });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.getSessions = async (req, res, next) => {
  try {
    const { class_id } = req.query;
    if (!class_id) {
      return res.status(400).json({ status: 'error', message: 'class_id is required' });
    }

    // Query to get sessions for this class and the count of present students vs total
    const query = `
      SELECT 
        s.id, 
        s.session_date, 
        s.status,
        (SELECT COUNT(DISTINCT student_id) FROM attendance_logs al WHERE al.session_id = s.id) as total_students,
        (SELECT COUNT(DISTINCT student_id) FROM attendance_logs al WHERE al.session_id = s.id AND al.status = 'present') as present_students
      FROM attendance_sessions s
      WHERE s.class_id = $1
      ORDER BY s.session_date DESC
    `;
    const result = await db.query(query, [class_id]);
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.getSessionDetails = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Query to get all students and their status for a specific session
    const query = `
      SELECT 
        st.id as student_id,
        st.student_code, 
        st.full_name, 
        al.status
      FROM attendance_logs al
      JOIN students st ON al.student_id = st.id
      WHERE al.session_id = $1
    `;
    const result = await db.query(query, [sessionId]);
    
    const presentList = result.rows.filter(r => r.status === 'present');
    const absentList = result.rows.filter(r => r.status === 'absent');
    
    res.json({ status: 'success', data: { presentList, absentList } });
  } catch (error) {
    next(error);
  }
};

exports.updateAttendanceSession = async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { sessionId } = req.params;
    const { present_ids } = req.body;

    if (!sessionId || !Array.isArray(present_ids)) {
      return res.status(400).json({ status: 'error', message: 'sessionId and present_ids array are required' });
    }

    // Get the class_id for this session to get all students
    const sessionResult = await client.query('SELECT class_id, teacher_id FROM attendance_sessions WHERE id = $1', [sessionId]);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }
    
    // Authorization check: Ensure the teacher owns this session
    if (req.user.role === 'teacher' && sessionResult.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Access denied: You do not own this session' });
    }

    const classId = sessionResult.rows[0].class_id;

    // 1. Delete all existing logs for this session to ensure a clean state
    await client.query('DELETE FROM attendance_logs WHERE session_id = $1', [sessionId]);

    // 2. Fetch all current students in the class
    const allResult = await client.query('SELECT id, student_code FROM students WHERE class_id = $1', [classId]);
    const allStudents = allResult.rows;

    // 3. Re-insert logs for every student
    const promises = allStudents.map(s => {
      const isPresent = present_ids.includes(s.student_code);
      return client.query(
        'INSERT INTO attendance_logs (session_id, student_id, status) VALUES ($1, $2, $3)',
        [sessionId, s.id, isPresent ? 'present' : 'absent']
      );
    });

    await Promise.all(promises);

    await client.query('COMMIT');
    res.json({ status: 'success', data: { sessionId } });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

exports.exportSessionToExcel = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // Check if session exists and get class info
    const sessionResult = await db.query(`
      SELECT s.session_date, c.name as class_name 
      FROM attendance_sessions s 
      JOIN classes c ON s.class_id = c.id 
      WHERE s.id = $1
    `, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }
    
    const sessionData = sessionResult.rows[0];
    
    // Get students attendance for this session
    const logsResult = await db.query(`
      SELECT 
        st.student_code, 
        st.full_name, 
        al.status,
        al.created_at
      FROM attendance_logs al
      JOIN students st ON al.student_id = st.id
      WHERE al.session_id = $1
      ORDER BY st.student_code ASC
    `, [sessionId]);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    const sessionDateStr = new Date(sessionData.session_date).toLocaleDateString().replace(/\//g, '-');
    const worksheet = workbook.addWorksheet(`Attendance ${sessionDateStr}`);

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Mã SV', key: 'student_code', width: 15 },
      { header: 'Họ tên', key: 'full_name', width: 30 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Thời gian', key: 'time', width: 20 }
    ];

    // Add title row
    worksheet.insertRow(1, [`Bảng điểm danh lớp ${sessionData.class_name}`]);
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    // Header row is now at row 2
    worksheet.getRow(2).font = { bold: true };

    logsResult.rows.forEach((log, index) => {
      worksheet.addRow({
        stt: index + 1,
        student_code: log.student_code,
        full_name: log.full_name,
        status: log.status === 'present' ? 'Có mặt' : 'Vắng mặt',
        time: new Date(log.created_at).toLocaleString()
      });
    });

    const fileName = `DiemDanh_${sessionData.class_name.replace(/\s+/g, '_')}_${sessionDateStr}.xlsx`;
    const encodedFileName = encodeURIComponent(fileName);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};
