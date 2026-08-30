const express = require('express');
const router = express.Router();
const multer = require('multer');

const path = require('path');

// Configure multer for file uploads with security limits
const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max per file
    },
    fileFilter: (req, file, cb) => {
        // Allow only images
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG and WEBP are allowed.'), false);
        }
    }
});

// Controllers
const authController = require('../controllers/auth.controller');
const adminController = require('../controllers/admin.controller');
const teacherController = require('../controllers/teacher.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { validate, schemas, validateIdParam } = require('../middleware/validation.middleware');
const statsController = require('../controllers/stats.controller');

// --- Auth Routes ---
router.post('/auth/login', authMiddleware.loginRateLimiter, validate(schemas.login), authController.login);
router.post('/auth/logout', authController.logout);

// Global route param validation for IDs
router.use(validateIdParam);

// --- Admin Routes ---
// Protected by auth and admin role (or teacher for GET requests)
router.use('/admin', authMiddleware.authenticateToken, (req, res, next) => {
    if (req.method === 'GET') {
        return authMiddleware.authorizeRole(['admin', 'teacher'])(req, res, next);
    }
    return authMiddleware.authorizeRole(['admin'])(req, res, next);
});

router.get('/admin/stats', statsController.getOverview);
router.get('/admin/stats/sessions', statsController.getSessionsStat);
router.get('/admin/stats/teachers', statsController.getTeachersStat);
router.get('/admin/stats/classes', statsController.getClassStats);
router.get('/admin/stats/classes/:classId/export', statsController.exportClassExcel);

router.get('/admin/teachers', adminController.getTeachers);
router.post('/admin/teachers', validate(schemas.createTeacher), adminController.createTeacher);
router.put('/admin/teachers/:id', validate(schemas.updateTeacher), adminController.updateTeacher);
router.delete('/admin/teachers/:id', adminController.deleteTeacher);

router.post('/admin/classes', validate(schemas.createClass), adminController.createClass);
router.get('/admin/classes', adminController.getClasses);
router.put('/admin/classes/:id', validate(schemas.createClass), adminController.updateClass);
router.delete('/admin/classes/:id', adminController.deleteClass);

router.post('/admin/students', upload.single('file'), validate(schemas.createStudent), adminController.createStudent);
router.post('/admin/students/batch', upload.array('files', 1000), adminController.batchUploadStudents);
router.get('/admin/students', adminController.getStudents);
router.put('/admin/students/:id', validate(schemas.createStudent), adminController.updateStudent);
router.delete('/admin/students/:id', adminController.deleteStudent);

// --- Teacher Routes ---
// Protected by auth and teacher/admin role
router.use('/teacher', authMiddleware.authenticateToken, authMiddleware.authorizeRole(['teacher', 'admin']));

router.get('/teacher/classes', teacherController.getClasses);
router.post('/teacher/attendance/scan', upload.array('files', 10), validate(schemas.scanAttendance), teacherController.scanAttendance);
router.post('/teacher/attendance/webcam', upload.single('file'), validate(schemas.scanAttendance), teacherController.scanWebcamFrame);
router.get('/teacher/attendance/sessions', teacherController.getSessions);
router.get('/teacher/attendance/sessions/:sessionId', teacherController.getSessionDetails);
router.post('/teacher/attendance/save', validate(schemas.saveAttendance), teacherController.saveAttendanceSession);
router.put('/teacher/attendance/save/:sessionId', validate(schemas.saveAttendance), teacherController.updateAttendanceSession);
router.get('/teacher/attendance/export/:sessionId', teacherController.exportSessionToExcel);

module.exports = router;
