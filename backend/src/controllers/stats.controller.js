const db = require('../config/db');

exports.getOverview = async (req, res, next) => {
  try {
    // Total students
    const studentsRes = await db.query('SELECT COUNT(*) FROM students');
    const totalStudents = parseInt(studentsRes.rows[0].count, 10);

    // Total classes
    const classesRes = await db.query('SELECT COUNT(*) FROM classes');
    const totalClasses = parseInt(classesRes.rows[0].count, 10);

    // Total teachers
    const teachersRes = await db.query('SELECT COUNT(*) FROM users WHERE role = $1', ['teacher']);
    const totalTeachers = parseInt(teachersRes.rows[0].count, 10);

    // Total attendance sessions
    const sessionsRes = await db.query('SELECT COUNT(*) FROM attendance_sessions');
    const totalSessions = parseInt(sessionsRes.rows[0].count, 10);

    // Attendance rate
    const logsRes = await db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
        COUNT(*) as total_logs
      FROM attendance_logs
    `);
    
    const presentCount = parseInt(logsRes.rows[0].present_count, 10) || 0;
    const totalLogs = parseInt(logsRes.rows[0].total_logs, 10) || 0;
    
    const attendanceRate = totalLogs > 0 ? ((presentCount / totalLogs) * 100).toFixed(1) : 0;

    res.json({
      status: 'success',
      data: {
        totalStudents,
        totalClasses,
        totalTeachers,
        totalSessions,
        attendanceRate
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSessionsStat = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        s.id, 
        c.name as class_name, 
        u.username as teacher_name, 
        s.session_date,
        COUNT(CASE WHEN al.status = 'present' THEN 1 END) as present_count,
        COUNT(al.id) as total_students
      FROM attendance_sessions s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN users u ON s.teacher_id = u.id
      LEFT JOIN attendance_logs al ON s.id = al.session_id
      GROUP BY s.id, c.name, u.username, s.session_date
      ORDER BY s.session_date DESC
    `;
    const result = await db.query(query);
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.getTeachersStat = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        u.id, 
        u.username,
        COUNT(DISTINCT s.id) as sessions_taught,
        COUNT(DISTINCT c.id) as classes_taught
      FROM users u
      LEFT JOIN attendance_sessions s ON u.id = s.teacher_id
      LEFT JOIN classes c ON u.id = c.teacher_id
      WHERE u.role = 'teacher'
      GROUP BY u.id, u.username
      ORDER BY sessions_taught DESC
    `;
    const result = await db.query(query);
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.getClassStats = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        c.id, 
        c.name as class_name,
        u.username as teacher_name,
        (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count,
        (SELECT COUNT(*) FROM attendance_sessions WHERE class_id = c.id) as session_count,
        COALESCE(
          (
            SELECT COUNT(*) 
            FROM attendance_logs al 
            JOIN attendance_sessions s ON al.session_id = s.id 
            WHERE s.class_id = c.id AND al.status = 'present'
          )::float / NULLIF(
            (
              SELECT COUNT(*) 
              FROM attendance_logs al 
              JOIN attendance_sessions s ON al.session_id = s.id 
              WHERE s.class_id = c.id
            ), 0
          ) * 100, 0
        ) as attendance_rate
      FROM classes c
      LEFT JOIN users u ON c.teacher_id = u.id
      ORDER BY c.id DESC
    `;
    const result = await db.query(query);
    res.json({ status: 'success', data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.exportClassExcel = async (req, res, next) => {
  try {
    const classId = req.params.classId;
    
    // 1. Get class info
    const classRes = await db.query('SELECT name FROM classes WHERE id = $1', [classId]);
    if (classRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Class not found' });
    }
    const className = classRes.rows[0].name;

    // 2. Get all students in the class
    const studentsRes = await db.query('SELECT id, student_code, full_name FROM students WHERE class_id = $1 ORDER BY student_code ASC', [classId]);
    const students = studentsRes.rows;

    // 3. Get all sessions for the class
    const sessionsRes = await db.query('SELECT id, session_date FROM attendance_sessions WHERE class_id = $1 ORDER BY session_date ASC', [classId]);
    const sessions = sessionsRes.rows;

    // 4. Get all attendance logs for the class
    const logsRes = await db.query(`
      SELECT al.student_id, al.session_id, al.status 
      FROM attendance_logs al
      JOIN attendance_sessions s ON al.session_id = s.id
      WHERE s.class_id = $1
    `, [classId]);
    const logs = logsRes.rows;

    // Create a map for quick lookup: map[student_id][session_id] = status
    const logMap = {};
    logs.forEach(log => {
      if (!logMap[log.student_id]) logMap[log.student_id] = {};
      logMap[log.student_id][log.session_id] = log.status;
    });

    // 5. Generate Excel
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Lớp ${className}`);

    // Columns: STT, Mã SV, Họ tên, [Buổi 1, Buổi 2...]
    const columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Mã SV', key: 'student_code', width: 15 },
      { header: 'Họ tên', key: 'full_name', width: 30 }
    ];

    sessions.forEach((session, index) => {
      const dateStr = new Date(session.session_date).toLocaleDateString('vi-VN');
      columns.push({ header: `Buổi ${index + 1} (${dateStr})`, key: `session_${session.id}`, width: 20 });
    });

    worksheet.columns = columns;

    // Add title row
    // Calculate end column letter (A, B, C...)
    const endColIndex = columns.length - 1;
    let endColLetter = '';
    if (endColIndex < 26) {
        endColLetter = String.fromCharCode(65 + endColIndex);
    } else {
        endColLetter = String.fromCharCode(64 + Math.floor(endColIndex / 26)) + String.fromCharCode(65 + (endColIndex % 26));
    }

    worksheet.insertRow(1, [`Bảng tổng hợp điểm danh lớp ${className}`]);
    worksheet.mergeCells(`A1:${endColLetter}1`);
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    // Format header row (now at row 2)
    worksheet.getRow(2).font = { bold: true };

    // Add student rows
    students.forEach((student, index) => {
      const rowData = {
        stt: index + 1,
        student_code: student.student_code,
        full_name: student.full_name
      };

      sessions.forEach(session => {
        const status = logMap[student.id]?.[session.id];
        let statusText = 'Chưa ĐD';
        if (status === 'present') statusText = 'Có mặt';
        else if (status === 'absent') statusText = 'Vắng mặt';
        rowData[`session_${session.id}`] = statusText;
      });

      worksheet.addRow(rowData);
    });

    const fileName = `TongHopDiemDanh_${className.replace(/\s+/g, '_')}.xlsx`;
    const encodedFileName = encodeURIComponent(fileName);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};
