// API Configuration
const API_BASE_URL = '/api';

class ApiService {
    static async login(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok || data.status !== 'success') {
                throw new Error(data.message || 'Login failed');
            }
            return data.data;
        } catch (error) {
            console.error("Login Error:", error);
            throw error;
        }
    }

    static async logout() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await response.json();
            return data.status === 'success';
        } catch (error) {
            console.error("Logout Error:", error);
            return false;
        }
    }

    static async getClasses() {
        try {
            const response = await fetch(`${API_BASE_URL}/teacher/classes`, {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();
            if (!response.ok || data.status !== 'success') {
                throw new Error(data.message || 'Failed to fetch classes');
            }
            return data.data;
        } catch (error) {
            console.error("Get Classes Error:", error);
            throw error;
        }
    }

    static async scanAttendance(classId, files) {
        if (!files || files.length === 0 || !classId) return null;

        const formData = new FormData();
        formData.append('class_id', classId);
        files.forEach(file => {
            formData.append('files', file);
        });

        try {
            const response = await fetch(`${API_BASE_URL}/teacher/attendance/scan`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await response.json();
            if (!response.ok || data.status !== 'success') {
                throw new Error(data.message || `Server error: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error("Scan Error:", error);
            throw error;
        }
    }

    static async saveAttendance(classId, presentIds) {
        try {
            const response = await fetch(`${API_BASE_URL}/teacher/attendance/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ class_id: classId, present_ids: presentIds })
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }

    static async updateAttendanceSession(sessionId, presentIds) {
        try {
            const response = await fetch(`${API_BASE_URL}/teacher/attendance/save/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ present_ids: presentIds })
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }

    static async getSessions(classId) {
        try {
            const response = await fetch(`${API_BASE_URL}/teacher/attendance/sessions?class_id=${classId}`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }

    static async getSessionDetails(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/teacher/attendance/sessions/${sessionId}`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }



    // --- Admin APIs ---

    static async getStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/stats`, { credentials: 'include' });
            const data = await response.json();
            return data.data;
        } catch (error) { throw error; }
    }

    static async getStatsSessions() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/stats/sessions`, { credentials: 'include' });
            const data = await response.json();
            return data.data;
        } catch (error) { throw error; }
    }

    static async getStatsClasses() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/stats/classes`, { credentials: 'include' });
            const data = await response.json();
            return data.data;
        } catch (error) { throw error; }
    }

    static exportClassExcel(classId) {
        window.open(`${API_BASE_URL}/admin/stats/classes/${classId}/export`, '_blank');
    }

    static async getStatsTeachers() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/stats/teachers`, { credentials: 'include' });
            const data = await response.json();
            return data.data;
        } catch (error) { throw error; }
    }

    static async getAdminTeachers() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/teachers`, { credentials: 'include' });
            const data = await response.json();
            return data.data;
        } catch (error) { throw error; }
    }

    static async createTeacher(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/teachers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }

    static async updateTeacher(id, username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/teachers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }

    static async deleteTeacher(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/teachers/${id}`, { method: 'DELETE', credentials: 'include' });
            return response.ok;
        } catch (error) { throw error; }
    }

    static async getAdminClasses() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/classes`, { credentials: 'include' });
            const data = await response.json();
            return data.data;
        } catch (error) { throw error; }
    }

    static async createClass(name, teacher_id) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/classes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, teacher_id })
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }

    static async updateClass(id, name, teacher_id) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/classes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, teacher_id })
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }

    static async deleteClass(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/classes/${id}`, { method: 'DELETE', credentials: 'include' });
            return response.ok;
        } catch (error) { throw error; }
    }

    static async getAdminStudents(classId = '') {
        try {
            const url = classId ? `${API_BASE_URL}/admin/students?class_id=${classId}` : `${API_BASE_URL}/admin/students`;
            const response = await fetch(url, { credentials: 'include' });
            const data = await response.json();
            return data.data;
        } catch (error) { throw error; }
    }

    static async createStudent(code, name, classId, file) {
        const formData = new FormData();
        formData.append('student_code', code);
        formData.append('full_name', name);
        formData.append('class_id', classId);
        formData.append('file', file);
        try {
            const response = await fetch(`${API_BASE_URL}/admin/students`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }

    static async updateStudent(id, code, name, classId) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/students/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ student_code: code, full_name: name, class_id: classId })
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }

    static async deleteStudent(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/students/${id}`, { method: 'DELETE', credentials: 'include' });
            return response.ok;
        } catch (error) { throw error; }
    }

    static async batchUploadClass(files, paths) {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });
        formData.append('paths', JSON.stringify(paths));
        
        try {
            const response = await fetch(`${API_BASE_URL}/admin/students/batch`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data;
        } catch (error) { throw error; }
    }

    static async scanWebcamFrame(classId, file) {
        const formData = new FormData();
        formData.append('class_id', classId);
        formData.append('file', file);
        
        try {
            const response = await fetch(`${API_BASE_URL}/teacher/attendance/webcam`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const data = await response.json();
            if(data.status !== 'success') throw new Error(data.message);
            return data.data;
        } catch (error) { throw error; }
    }
}
