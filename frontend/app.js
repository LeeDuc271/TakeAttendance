function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Hàm mã hóa an toàn các tham số chuỗi cho các sự kiện HTML inline (ví dụ: onclick)
function safeArgs(...args) {
    return args.map(arg => {
        if (typeof arg === 'string') {
            return `decodeURIComponent(atob('${btoa(encodeURIComponent(arg))}'))`;
        }
        return arg;
    }).join(', ');
}

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');

// Navigation & Views
const navAttendance = document.getElementById('navAttendance');
const navClasses = document.getElementById('navClasses');
const navStats = document.getElementById('navStats');
const navTeachers = document.getElementById('navTeachers');
const attendanceView = document.getElementById('attendanceView');
const classesView = document.getElementById('classesView');
const statsView = document.getElementById('statsView');
const teachersView = document.getElementById('teachersView');
const logoutBtn = document.getElementById('logoutBtn');

// Attendance View Elements
const attendanceGrid = document.getElementById('attendanceGrid');
const scanInterface = document.getElementById('scanInterface');
const backToGridBtn = document.getElementById('backToGridBtn');
const attendanceHeaderTitle = document.getElementById('attendanceHeaderTitle');
const attendanceHeaderSub = document.getElementById('attendanceHeaderSub');

// Scan Elements
const fileInput = document.getElementById('fileInput');
const scanFilesBtn = document.getElementById('scanFilesBtn');
const webcamBtn = document.getElementById('webcamBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const cameraBox = document.getElementById('cameraBox');
const webcamVideo = document.getElementById('webcamVideo');
const webcamOverlay = document.getElementById('webcamOverlay');
const scannerOverlay = document.getElementById('scannerOverlay');
const previewContainer = document.getElementById('previewContainer');
const emptyState = document.getElementById('emptyState');

// Results
const detectedCountEl = document.getElementById('detectedCount');
const presentCountEl = document.getElementById('presentCount');
const absentCountEl = document.getElementById('absentCount');
const tabPresent = document.getElementById('tabPresent');
const tabAbsent = document.getElementById('tabAbsent');
const presentList = document.getElementById('present-tab');
const absentList = document.getElementById('absent-tab');

// Data Management Elements
const tabAdminClasses = document.getElementById('tabAdminClasses');
const tabAdminStudents = document.getElementById('tabAdminStudents');
const adminClassesSection = document.getElementById('adminClassesSection');
const adminStudentsSection = document.getElementById('adminStudentsSection');
const adminClassesTableBody = document.getElementById('adminClassesTableBody');
const adminStudentsTableBody = document.getElementById('adminStudentsTableBody');
const adminTeachersTableBody = document.getElementById('adminTeachersTableBody');
const adminTeachersSection = document.getElementById('adminTeachersSection');
const tabAdminTeachers = document.getElementById('tabAdminTeachers');

const statCardClasses = document.getElementById('statCardClasses');
const statTotalClasses = document.getElementById('statTotalClasses');
const statsClassesTable = document.getElementById('statsClassesTable');
const statsClassesTableBody = document.getElementById('statsClassesTableBody');

const toastEl = document.getElementById('toast');

// State
let currentUser = null;
let currentClassId = null;
let currentClassName = null;
let webcamStream = null;
let webcamInterval = null;
let isWebcamActive = false;
let accumulatedPresentStudents = new Map();
let currentSessionId = null;
let currentFacingMode = 'user';
let selectedFiles = [];

// --- INITIALIZATION ---

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    loginBtn.disabled = true;
    loginError.classList.add('hidden');
    
    try {
        const user = await ApiService.login(username, password);
        currentUser = user;
        
        document.getElementById('profileName').textContent = user.username;
        document.getElementById('profileRole').textContent = user.role.toUpperCase();
        
        const isTeacher = user.role === 'teacher';
        document.getElementById('showAddClassBtn').style.display = isTeacher ? 'none' : 'inline-flex';
        document.getElementById('showBatchUploadBtn').style.display = isTeacher ? 'none' : 'inline-flex';
        document.getElementById('showAddStudentBtn').style.display = isTeacher ? 'none' : 'inline-flex';
        document.getElementById('showAddTeacherBtn').style.display = isTeacher ? 'none' : 'inline-flex';
        
        loginScreen.style.display = 'none';
        mainApp.style.display = 'flex'; 
        
        // Show Scan view by default
        navAttendance.click();
        
    } catch (error) {
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', async () => {
    await ApiService.logout();
    currentUser = null;
    stopWebcam();
    mainApp.style.display = 'none';
    loginScreen.style.display = 'flex';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
});

// --- NAVIGATION ---

function hideAllViews() {
    attendanceView.style.display = 'none';
    classesView.style.display = 'none';
    statsView.style.display = 'none';
    teachersView.style.display = 'none';
    navAttendance.classList.remove('active');
    navClasses.classList.remove('active');
    navStats.classList.remove('active');
    navTeachers.classList.remove('active');
}

navAttendance.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllViews();
    navAttendance.classList.add('active');
    attendanceView.style.display = 'flex';
    backToGridBtn.click(); 
});

navClasses.addEventListener('click', (e) => {
    e.preventDefault();
    hideAllViews();
    navClasses.classList.add('active');
    classesView.style.display = 'flex';
    stopWebcam();
    loadAdminData();
});

navTeachers.addEventListener('click', async (e) => {
    e.preventDefault();
    hideAllViews();
    navTeachers.classList.add('active');
    teachersView.style.display = 'flex';
    stopWebcam();
    await loadAdminTeachers();
});

let classAttendanceChartInstance = null;
let overallAttendanceChartInstance = null;

navStats.addEventListener('click', async (e) => {
    e.preventDefault();
    hideAllViews();
    navStats.classList.add('active');
    statsView.style.display = 'flex';
    stopWebcam();
    try {
        const stats = await ApiService.getStats();
        document.getElementById('statTotalStudents').textContent = stats.totalStudents;
        document.getElementById('statTotalTeachers').textContent = stats.totalTeachers;
        document.getElementById('statTotalSessions').textContent = stats.totalSessions;
        document.getElementById('statTotalClasses').textContent = stats.totalClasses;

        // Fetch classes stats for the table and bar chart
        const [classesStats, sessionsStats] = await Promise.all([
            ApiService.getStatsClasses(),
            ApiService.getStatsSessions()
        ]);
        const statsClassesTableBody = document.getElementById('statsClassesTableBody');
        statsClassesTableBody.innerHTML = '';
        
        const chartClassSelect = document.getElementById('chartClassSelect');
        chartClassSelect.innerHTML = '<option value="all">Tất cả các lớp</option>';

        classesStats.forEach((c, index) => {
            chartClassSelect.innerHTML += `<option value="${escapeHTML(c.class_name)}">${escapeHTML(c.class_name)}</option>`;

            statsClassesTableBody.innerHTML += `
                <tr>
                    <td class="data-text">${index + 1}</td>
                    <td>${escapeHTML(c.class_name)}</td>
                    <td>${escapeHTML(c.teacher_name || 'Chưa phân công')}</td>
                    <td class="data-text">${c.student_count || 0}</td>
                    <td class="data-text">${c.session_count || 0}</td>
                    <td>
                        <button class="btn btn-primary" style="padding: 0.25rem 0.5rem;" onclick="event.stopPropagation(); ApiService.exportClassExcel(${c.id})" title="Xuất Excel toàn bộ">
                            <i class="fa-solid fa-file-excel"></i> Xuất Excel
                        </button>
                    </td>
                </tr>
            `;
        });

        // 1. Render Line Chart (Class Stats)
        const ctxClass = document.getElementById('classAttendanceChart');
        
        function renderLineChart(selectedClassName) {
            if (!ctxClass) return;
            if (classAttendanceChartInstance) classAttendanceChartInstance.destroy();

            let filteredSessions = sessionsStats;
            if (selectedClassName !== 'all') {
                filteredSessions = sessionsStats.filter(s => s.class_name === selectedClassName);
            }
            
            filteredSessions.sort((a, b) => new Date(a.session_date) - new Date(b.session_date));

            let chartLabels = [];
            let chartData = [];
            
            if (selectedClassName === 'all') {
                const dateMap = {};
                filteredSessions.forEach(s => {
                    const dateStr = new Date(s.session_date).toLocaleDateString('vi-VN');
                    if (!dateMap[dateStr]) dateMap[dateStr] = { present: 0, total: 0 };
                    dateMap[dateStr].present += parseInt(s.present_count || 0);
                    dateMap[dateStr].total += parseInt(s.total_students || 0);
                });
                
                chartLabels = Object.keys(dateMap);
                chartData = chartLabels.map(date => {
                    const d = dateMap[date];
                    return d.total > 0 ? (d.present / d.total * 100).toFixed(1) : 0;
                });
            } else {
                chartLabels = filteredSessions.map(s => new Date(s.session_date).toLocaleDateString('vi-VN'));
                chartData = filteredSessions.map(s => s.total_students > 0 ? (s.present_count / s.total_students * 100).toFixed(1) : 0);
            }

            classAttendanceChartInstance = new Chart(ctxClass, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Tỷ lệ đi học (%)',
                        data: chartData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        pointBackgroundColor: '#3b82f6',
                        fill: true,
                        tension: 0
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            max: 100,
                            ticks: { font: { family: 'JetBrains Mono' } } 
                        },
                        x: { ticks: { font: { family: 'Space Grotesk' } } }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
        


        // 2. Render Doughnut Chart (Overall Attendance Rate)
        const ctxOverall = document.getElementById('overallAttendanceChart');
        const overallChartTitle = document.getElementById('overallChartTitle');

        function renderOverallChart(selectedClassName) {
            if (!ctxOverall) return;
            if (overallAttendanceChartInstance) overallAttendanceChartInstance.destroy();
            
            let rate = 0;
            let title = 'Tỷ lệ toàn hệ thống';
            
            if (selectedClassName === 'all') {
                rate = parseFloat(stats.attendanceRate) || 0;
            } else {
                const c = classesStats.find(c => c.class_name === selectedClassName);
                if (c) {
                    rate = parseFloat(c.attendance_rate) || 0;
                    title = 'Tỷ lệ lớp ' + escapeHTML(c.class_name);
                }
            }
            
            if (overallChartTitle) {
                overallChartTitle.innerHTML = title;
            }
            
            const absentRate = 100 - rate;
            
            overallAttendanceChartInstance = new Chart(ctxOverall, {
                type: 'doughnut',
                data: {
                    labels: ['Có mặt', 'Vắng mặt'],
                    datasets: [{
                        data: [rate, absentRate],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    cutout: '70%',
                    plugins: {
                        legend: { 
                            position: 'bottom', 
                            labels: { 
                                font: { family: 'Space Grotesk' }, 
                                padding: 20,
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    if (data.labels.length && data.datasets.length) {
                                        return data.labels.map((label, i) => {
                                            const meta = chart.getDatasetMeta(0);
                                            const style = meta.controller.getStyle(i);
                                            const value = data.datasets[0].data[i];
                                            return {
                                                text: `${label}: ${value.toFixed(1)}%`,
                                                fillStyle: style.backgroundColor,
                                                strokeStyle: style.borderColor,
                                                lineWidth: style.borderWidth,
                                                hidden: isNaN(value) || meta.data[i].hidden,
                                                index: i
                                            };
                                        });
                                    }
                                    return [];
                                }
                            } 
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return ' ' + context.label + ': ' + context.parsed.toFixed(1) + '%';
                                }
                            }
                        }
                    }
                }
            });
        }
        
        renderLineChart('all');
        renderOverallChart('all');
        
        chartClassSelect.onchange = (e) => {
            renderLineChart(e.target.value);
            renderOverallChart(e.target.value);
        };

    } catch (error) {
        showToast('Failed to load stats overview', 'error');
    }
});

// --- ATTENDANCE: GRID VIEW ---

async function loadClassGrid() {
    try {
        const classes = currentUser && currentUser.role === 'admin' 
            ? await ApiService.getAdminClasses() 
            : await ApiService.getClasses();
        attendanceGrid.innerHTML = '';
        
        if (classes.length === 0) {
            attendanceGrid.innerHTML = '<div style="color:var(--text-muted); font-family:var(--font-data);">CHƯA CÓ LỚP HỌC NÀO</div>';
            return;
        }

        classes.forEach(cls => {
            const card = document.createElement('div');
            card.className = 'class-card';
            card.innerHTML = `
                <div style="font-family: var(--font-data); color: var(--accent); font-size: 0.75rem;">SYS_ID: ${cls.id}</div>
                <h3>${cls.name}</h3>
                <div class="meta">
                    <span>GV: ${cls.teacher_name || cls.teacher_id || 'N/A'}</span>
                    <span><i class="fa-solid fa-arrow-right"></i></span>
                </div>
            `;
            card.addEventListener('click', () => openSessionsView(cls.id, cls.name));
            attendanceGrid.appendChild(card);
        });
    } catch (err) {
        showToast('Failed to load class grid', 'error');
    }
}

async function openSessionsView(classId, className) {
    currentClassId = classId;
    currentClassName = className;
    
    document.getElementById('attendanceHeaderTitle').textContent = `LỚP: ${escapeHTML(className)}`;
    document.getElementById('attendanceHeaderSub').textContent = `Quản lý phiên điểm danh cho lớp ${escapeHTML(className)}.`;
    
    document.getElementById('attendanceGrid').style.display = 'none';
    document.getElementById('scanInterface').classList.add('hidden');
    document.getElementById('sessionsView').classList.remove('hidden');
    document.getElementById('backToGridBtn').classList.remove('hidden');
    document.getElementById('saveAttendanceBtn')?.classList.add('hidden');
    
    // Load sessions
    try {
        const sessions = await ApiService.getSessions(classId);
        const tbody = document.getElementById('sessionsTableBody');
        tbody.innerHTML = '';
        if (sessions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); font-family:var(--font-data);">NO SESSIONS RECORDED</td></tr>';
        } else {
            sessions.forEach(s => {
                const date = new Date(s.session_date).toLocaleString('en-GB');
                tbody.innerHTML += `
                    <tr>
                        <td class="data-text">${s.id}</td>
                        <td class="data-text">${date}</td>
                        <td>${s.status.toUpperCase() === 'COMPLETED' ? 'Đã hoàn thành' : (s.status.toUpperCase() === 'IN_PROGRESS' ? 'Đang diễn ra' : s.status.toUpperCase())}</td>
                        <td class="data-text">${s.present_students} / ${s.total_students}</td>
                        <td>
                            <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; margin-right: 5px;" onclick="openScanInterface(${safeArgs(classId, className, s.id)})" title="Tiếp tục / Thêm"><i class="fa-solid fa-camera"></i> Tiếp tục</button>
                            <button class="btn btn-primary" style="padding: 0.25rem 0.5rem;" onclick="exportSession(${s.id})" title="Xuất Excel"><i class="fa-solid fa-download"></i></button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (e) {
        showToast('FAILED TO LOAD SESSIONS', 'error');
    }
}

document.getElementById('newSessionBtn')?.addEventListener('click', () => {
    openScanInterface(currentClassId, currentClassName, null);
});

function exportSession(sessionId) {
    window.open(`${API_BASE_URL}/teacher/attendance/export/${sessionId}`, '_blank');
}

async function openScanInterface(classId, className, sessionId = null) {
    currentClassId = classId;
    currentClassName = className;
    currentSessionId = sessionId;
    accumulatedPresentStudents.clear();
    
    document.getElementById('attendanceGrid').style.display = 'none';
    document.getElementById('sessionsView').classList.add('hidden');
    document.getElementById('scanInterface').classList.remove('hidden');
    document.getElementById('backToGridBtn').classList.remove('hidden');
    document.getElementById('saveAttendanceBtn')?.classList.remove('hidden');
    
    document.getElementById('attendanceHeaderTitle').textContent = `TARGET: ${escapeHTML(className)}`;
    document.getElementById('attendanceHeaderSub').textContent = sessionId ? `Resuming session #${sessionId} stream.` : `Awaiting input stream for new session.`;
    
    resetScanResults();

    if (sessionId) {
        showToast('LOADING SESSION DATA...', 'success');
        try {
            const details = await ApiService.getSessionDetails(sessionId);
            // Preload present students
            details.presentList.forEach(s => {
                accumulatedPresentStudents.set(s.student_code, s);
            });
            renderRealResults([], details.absentList);
        } catch (e) {
            showToast('FAILED TO LOAD SESSION LOGS', 'error');
        }
    }
}

backToGridBtn.addEventListener('click', () => {
    stopWebcam();
    document.getElementById('scanInterface').classList.add('hidden');
    document.getElementById('sessionsView').classList.add('hidden');
    document.getElementById('attendanceGrid').style.display = 'grid';
    document.getElementById('backToGridBtn').classList.add('hidden');
    document.getElementById('saveAttendanceBtn')?.classList.add('hidden');
    
    document.getElementById('attendanceHeaderTitle').textContent = `Chọn đối tượng`;
    document.getElementById('attendanceHeaderSub').textContent = `Khởi tạo máy quét cho nhóm cụ thể.`;
    
    loadClassGrid();
});

// --- ATTENDANCE: SCAN LOGIC ---

fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length === 0) return;
    
    stopWebcam(); // Prioritize file if webcam was on
    selectedFiles = Array.from(files);
    scanFilesBtn.classList.remove('hidden');
    
    // Preview first image
    const file = selectedFiles[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
            previewContainer.classList.remove('hidden');
            emptyState.classList.add('hidden');
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
});

scanFilesBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0 || !currentClassId) return;
    
    scanFilesBtn.disabled = true;
    scannerOverlay.classList.add('active'); // Start scan animation
    showToast('PROCESSING BATCH DATA...', 'success');
    
    try {
        const response = await ApiService.scanAttendance(currentClassId, selectedFiles);
        if (response && response.status === 'success') {
            renderRealResults(response.data.presentList || [], response.data.absentList || []);
            showToast('PROCESSING COMPLETE', 'success');
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        showToast(error.message || 'PROCESS FAILED', 'error');
    } finally {
        scanFilesBtn.disabled = false;
        scannerOverlay.classList.remove('active');
        scanFilesBtn.classList.add('hidden');
        selectedFiles = [];
    }
});

webcamBtn.addEventListener('click', async () => {
    if (isWebcamActive) {
        stopWebcam();
    } else {
        await startWebcam();
    }
});

switchCameraBtn.addEventListener('click', async () => {
    // Toggle facing mode between front and rear
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    if (isWebcamActive) {
        stopWebcam();
        await startWebcam();
    }
});

document.getElementById('floatingSwitchBtn').addEventListener('click', () => {
    switchCameraBtn.click();
});

document.getElementById('floatingCloseBtn').addEventListener('click', () => {
    webcamBtn.click();
});

async function startWebcam() {
    if (!currentClassId) return;
    
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } });
        webcamVideo.srcObject = webcamStream;
        
        previewContainer.classList.add('hidden');
        previewContainer.innerHTML = '';
        selectedFiles = [];
        scanFilesBtn.classList.add('hidden');
        
        webcamVideo.classList.remove('hidden');
        webcamOverlay.classList.remove('hidden');
        scannerOverlay.classList.add('active');
        emptyState.classList.add('hidden');
        switchCameraBtn.classList.remove('hidden');
        
        webcamBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i> TERMINATE CAMERA';
        webcamBtn.classList.replace('btn-primary', 'btn-secondary');
        isWebcamActive = true;
        
        // Fullscreen camera on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('cameraBox').classList.add('camera-fullscreen-mode');
            document.getElementById('cameraFloatingControls').classList.remove('hidden');
        }
        
        webcamVideo.onloadedmetadata = () => {
            webcamOverlay.width = webcamVideo.videoWidth;
            webcamOverlay.height = webcamVideo.videoHeight;
            webcamInterval = setInterval(() => processWebcamFrame(), 500); // 2 khung hình / 1 giây (0.5s)
        };
        
    } catch (err) {
        if (!navigator.mediaDevices) {
            showToast('BROWSER BLOCKED CAMERA (HTTPS REQUIRED)', 'error');
        } else {
            showToast('CAMERA ACCESS DENIED', 'error');
        }
    }
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
    }
    if (webcamInterval) clearInterval(webcamInterval);
    
    webcamVideo.classList.add('hidden');
    webcamOverlay.classList.add('hidden');
    scannerOverlay.classList.remove('active');
    emptyState.classList.remove('hidden');
    switchCameraBtn.classList.add('hidden');
    
    webcamBtn.innerHTML = '<i class="fa-solid fa-video"></i> ENGAGE CAMERA';
    webcamBtn.classList.replace('btn-secondary', 'btn-primary');
    isWebcamActive = false;
    
    document.getElementById('cameraBox').classList.remove('camera-fullscreen-mode');
    document.getElementById('cameraFloatingControls').classList.add('hidden');
    
    const ctx = webcamOverlay.getContext('2d');
    ctx.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
}

async function processWebcamFrame() {
    if (!isWebcamActive || !currentClassId) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = webcamVideo.videoWidth;
    canvas.height = webcamVideo.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
        
        try {
            const data = await ApiService.scanWebcamFrame(currentClassId, file);
            drawWebcamBoxes(data);
            updateWebcamList(data);
        } catch (err) {
            console.error('Frame error:', err);
        }
    }, 'image/jpeg', 0.8);
}

function drawWebcamBoxes(faces) {
    const ctx = webcamOverlay.getContext('2d');
    ctx.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
    
    faces.forEach(face => {
        const box = face.bounding_box;
        ctx.strokeStyle = '#2563EB'; // Accent color
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        
        ctx.fillStyle = 'rgba(37, 99, 235, 0.9)';
        ctx.fillRect(box.x, box.y - 25, box.w, 25);
        
        ctx.fillStyle = '#FFF';
        ctx.font = '14px "JetBrains Mono", monospace';
        ctx.fillText(face.student_name, box.x + 5, box.y - 7);
    });
}

function updateWebcamList(faces) {
    const present = faces.filter(f => f.student_name !== 'Unknown');
    detectedCountEl.textContent = present.length;
    
    present.forEach(p => {
        if (!accumulatedPresentStudents.has(p.student_code)) {
            accumulatedPresentStudents.set(p.student_code, { full_name: p.student_name, student_code: p.student_code });
        }
    });

    const accumulatedArray = Array.from(accumulatedPresentStudents.values());
    
    presentList.innerHTML = '';
    presentCountEl.textContent = accumulatedArray.length;
    
    if (accumulatedArray.length === 0) {
        presentList.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-family:var(--font-data);">NO KNOWN SUBJECTS</div>`;
    } else {
        accumulatedArray.forEach(p => {
            presentList.innerHTML += createStudentCard(p.full_name, 'present', `ID: ${escapeHTML(p.student_code || 'N/A')}`);
        });
    }
}

function resetScanResults() {
    detectedCountEl.textContent = '0';
    presentCountEl.textContent = '0';
    absentCountEl.textContent = '0';
    presentList.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-family:var(--font-data);">AWAITING DATA</div>`;
    absentList.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-family:var(--font-data);">AWAITING DATA</div>`;
    tabPresent.click();
    
    previewContainer.innerHTML = '';
    previewContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    scanFilesBtn.classList.add('hidden');
    selectedFiles = [];
}

function renderRealResults(presentStudents, absentStudents) {
    presentStudents.forEach(student => {
        if (!accumulatedPresentStudents.has(student.student_code)) {
            accumulatedPresentStudents.set(student.student_code, student);
        }
    });
    
    const accumulatedArray = Array.from(accumulatedPresentStudents.values());
    
    presentList.innerHTML = '';
    presentCountEl.textContent = accumulatedArray.length;
    
    if (accumulatedArray.length === 0) {
        presentList.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-family:var(--font-data);">NO SUBJECTS DETECTED</div>`;
    } else {
        accumulatedArray.forEach(student => {
            presentList.innerHTML += createStudentCard(student.full_name, 'present', `ID: ${escapeHTML(student.student_code || 'N/A')}`);
        });
    }
    
    // For absent, we can optionally just show total class minus accumulated, 
    // but the API already returns absent list based on current frame/files.
    // We'll just show the remainder as absent if we want, or leave it.
    // For simplicity, we just filter the original absentList.
    const currentAbsent = absentStudents.filter(a => !accumulatedPresentStudents.has(a.student_code));
    
    absentList.innerHTML = '';
    absentCountEl.textContent = currentAbsent.length;
    if (currentAbsent.length === 0) {
        absentList.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-family:var(--font-data);">NO ABSENTEES</div>`;
    } else {
        currentAbsent.forEach(student => {
            absentList.innerHTML += createStudentCard(student.full_name, 'absent', `ID: ${escapeHTML(student.student_code || 'N/A')}`);
        });
    }
}

document.getElementById('saveAttendanceBtn')?.addEventListener('click', async () => {
    if (!currentClassId) return;
    
    const btn = document.getElementById('saveAttendanceBtn');
    btn.disabled = true;
    showToast('SAVING ATTENDANCE...', 'success');
    
    try {
        const presentIds = Array.from(accumulatedPresentStudents.keys());
        
        if (currentSessionId) {
            await ApiService.updateAttendanceSession(currentSessionId, presentIds);
        } else {
            await ApiService.saveAttendance(currentClassId, presentIds);
        }
        
        showToast('ATTENDANCE SAVED', 'success');
        
        // Return to grid / sessions
        backToGridBtn.click();
    } catch (err) {
        showToast('FAILED TO SAVE ATTENDANCE', 'error');
    } finally {
        btn.disabled = false;
    }
});

function createStudentCard(name, status, subText) {
    const isPresent = status === 'present';
    return `
        <div class="student-card">
            <div class="info">
                <h4>${escapeHTML(name)}</h4>
                <p>${escapeHTML(subText)}</p>
            </div>
            <span class="status-tag status-${status}">
                ${isPresent ? 'VERIFIED' : 'MISSING'}
            </span>
        </div>
    `;
}

// Result Tabs
tabPresent.addEventListener('click', () => {
    tabPresent.style.borderBottomColor = 'var(--accent)';
    tabAbsent.style.borderBottomColor = 'transparent';
    presentList.classList.remove('hidden');
    absentList.classList.add('hidden');
});
tabAbsent.addEventListener('click', () => {
    tabAbsent.style.borderBottomColor = 'var(--accent)';
    tabPresent.style.borderBottomColor = 'transparent';
    absentList.classList.remove('hidden');
    presentList.classList.add('hidden');
});

// --- DATA MANAGEMENT (CRUD) ---

function getActionButtons(type, obj) {
    if (currentUser?.role !== 'admin') {
        return '<td><i class="fa-solid fa-lock" style="color: var(--border-color);" title="Chỉ Admin"></i></td>';
    }
    
    if (type === 'class') {
        return `
            <td>
                <button class="btn btn-primary" style="padding: 0.25rem 0.5rem; margin-right: 5px;" onclick="event.stopPropagation(); ApiService.exportClassExcel(${obj.id})" title="Xuất Excel toàn bộ"><i class="fa-solid fa-file-excel"></i></button>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; margin-right: 5px;" onclick="event.stopPropagation(); openEditClassModal(${safeArgs(obj.id, obj.name, obj.teacher_name || obj.teacher_id || '')})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; border-color:var(--danger); color:var(--danger);" onclick="event.stopPropagation(); deleteClass(${obj.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
    } else if (type === 'student') {
        return `
            <td>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; margin-right: 0.5rem;" onclick="event.stopPropagation(); openEditStudentModal(${safeArgs(obj.id, obj.student_code, obj.full_name, obj.class_id)})"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; border-color:var(--danger); color:var(--danger);" onclick="event.stopPropagation(); deleteStudent(${obj.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
    } else if (type === 'teacher') {
        return `
            <td>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; margin-right: 0.5rem;" onclick="openEditTeacherModal(${safeArgs(obj.id, obj.username)})"><i class="fa-solid fa-edit"></i></button>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; border-color:var(--danger); color:var(--danger);" onclick="deleteTeacher(${obj.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
    }
    return '<td></td>';
}

tabAdminClasses?.addEventListener('click', () => {
    tabAdminClasses.style.borderBottomColor = 'var(--accent)';
    tabAdminStudents.style.borderBottomColor = 'transparent';
    adminClassesSection.style.display = 'block';
    adminStudentsSection.style.display = 'none';
    
    // Reset the students tab text back to STUDENTS DB when going back to classes list
    tabAdminStudents.textContent = 'SINH VIÊN';
});

tabAdminStudents?.addEventListener('click', async () => {
    tabAdminStudents.style.borderBottomColor = 'var(--accent)';
    tabAdminClasses.style.borderBottomColor = 'transparent';
    adminStudentsSection.style.display = 'block';
    adminClassesSection.style.display = 'none';
    
    // If the tab is exactly STUDENTS DB, load all students.
    // If it's a class name, keep the current class view.
    if (tabAdminStudents.textContent === 'SINH VIÊN') {
        try {
            const students = await ApiService.getAdminStudents();
            adminStudentsTableBody.innerHTML = '';
            students.forEach((s, index) => {
                adminStudentsTableBody.innerHTML += `
                    <tr>
                        <td class="data-text">${index + 1}</td>
                        <td class="data-text">${escapeHTML(s.student_code)}</td>
                        <td>${escapeHTML(s.full_name)}</td>
                        <td class="data-text">${s.class_name || s.class_id}</td>
                        <td class="data-text">${s.attended_sessions || 0} / ${s.total_sessions || 0}</td>
                        ${getActionButtons('student', s)}
                    </tr>
                `;
            });
        } catch(e) {}
    }
});



async function loadAdminTeachers() {
    try {
        const teachers = await ApiService.getAdminTeachers();
        adminTeachersTableBody.innerHTML = '';
        teachers.forEach((t, index) => {
            adminTeachersTableBody.innerHTML += `
                <tr>
                    <td class="data-text">${index + 1}</td>
                    <td class="data-text">${escapeHTML(t.username)}</td>
                    <td>${t.role.toUpperCase()}</td>
                    <td class="data-text">${new Date(t.created_at).toLocaleString('en-GB')}</td>
                    ${getActionButtons('teacher', t)}
                </tr>
            `;
        });
    } catch(e) {
        showToast('Failed to load teachers', 'error');
    }
}

async function loadAdminData() {
    try {
        const classes = await ApiService.getAdminClasses();
        const students = await ApiService.getAdminStudents();
        await loadAdminTeachers();
        
        adminClassesTableBody.innerHTML = '';
        classes.forEach((c, index) => {
            adminClassesTableBody.innerHTML += `
                <tr style="cursor: pointer;" onclick="viewClassStudents(${safeArgs(c.id, c.name)})">
                    <td>${c.id}</td>
                    <td>${escapeHTML(c.name)}</td>
                    <td class="data-text">${escapeHTML(c.teacher_name || c.teacher_id || 'N/A')}</td>
                    <td class="data-text">${new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                    ${getActionButtons('class', c)}
                </tr>
            `;
        });
        
        adminStudentsTableBody.innerHTML = '';
        students.forEach((s, index) => {
            adminStudentsTableBody.innerHTML += `
                <tr>
                    <td class="data-text">${index + 1}</td>
                    <td class="data-text">${escapeHTML(s.student_code)}</td>
                    <td>${escapeHTML(s.full_name)}</td>
                    <td class="data-text">${escapeHTML(s.class_name || s.class_id || '')}</td>
                    <td class="data-text">${s.attended_sessions || 0} / ${s.total_sessions || 0}</td>
                    ${getActionButtons('student', s)}
                </tr>
            `;
        });
    } catch (e) {
        showToast('LỖI ĐỒNG BỘ DỮ LIỆU', 'error');
    }
}

// Modals
document.getElementById('showAddClassBtn')?.addEventListener('click', () => {
    document.getElementById('addClassModal').classList.remove('hidden');
});
document.getElementById('showAddStudentBtn')?.addEventListener('click', () => {
    document.getElementById('addStudentModal').classList.remove('hidden');
});
document.getElementById('showBatchUploadBtn')?.addEventListener('click', () => {
    document.getElementById('batchUploadModal').classList.remove('hidden');
});

// Class CRUD
document.getElementById('addClassForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newClassName').value;
    const tId = document.getElementById('newClassTeacherId').value;
    try {
        await ApiService.createClass(name, tId);
        document.getElementById('addClassModal').classList.add('hidden');
        showToast('ĐÃ TẠO LỚP HỌC', 'success');
        loadAdminData();
    } catch (err) {
        showToast('THAO TÁC THẤT BẠI', 'error');
    }
});

function openEditClassModal(id, name, teacherId) {
    document.getElementById('editClassId').value = id;
    document.getElementById('editClassName').value = name;
    document.getElementById('editClassTeacherId').value = teacherId;
    document.getElementById('editClassModal').classList.remove('hidden');
}

document.getElementById('editClassForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editClassId').value;
    const name = document.getElementById('editClassName').value;
    const tId = document.getElementById('editClassTeacherId').value;
    try {
        await ApiService.updateClass(id, name, tId);
        document.getElementById('editClassModal').classList.add('hidden');
        showToast('CẬP NHẬT LỚP HỌC', 'success');
        loadAdminData();
    } catch (err) {
        showToast('THAO TÁC THẤT BẠI', 'error');
    }
});

async function deleteClass(id) {
    if(!confirm('BẠN CÓ CHẮC CHẮN MUỐN XÓA LỚP NÀY?')) return;
    try {
        await ApiService.deleteClass(id);
        loadAdminData();
        showToast('ĐÃ XÓA LỚP HỌC', 'success');
    } catch(e) { showToast('THAO TÁC THẤT BẠI', 'error'); }
}

async function viewClassStudents(classId, className) {
    try {
        const students = await ApiService.getAdminStudents(classId);
        
        adminStudentsTableBody.innerHTML = '';
        if (students.length === 0) {
            adminStudentsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); font-family:var(--font-data);">KHÔNG CÓ DỮ LIỆU</td></tr>';
        } else {
            students.forEach((s, index) => {
                adminStudentsTableBody.innerHTML += `
                    <tr>
                        <td class="data-text">${index + 1}</td>
                        <td class="data-text">${escapeHTML(s.student_code)}</td>
                        <td>${escapeHTML(s.full_name)}</td>
                        <td class="data-text">${s.class_name || s.class_id}</td>
                        <td class="data-text">${s.attended_sessions || 0} / ${s.total_sessions || 0}</td>
                        ${getActionButtons('student', s)}
                    </tr>
                `;
            });
        }
        
        tabAdminStudents.style.borderBottomColor = 'var(--accent)';
        tabAdminClasses.style.borderBottomColor = 'transparent';
        adminStudentsSection.style.display = 'block';
        adminClassesSection.style.display = 'none';
        tabAdminStudents.textContent = className;
    } catch (err) {
        showToast('LỖI ĐỒNG BỘ', 'error');
    }
}

// Student CRUD
document.getElementById('addStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('newStudentCode').value;
    const name = document.getElementById('newStudentName').value;
    const cId = document.getElementById('newStudentClassId').value;
    const file = document.getElementById('newStudentImage').files[0];
    
    if(!file) return showToast('THIẾU DỮ LIỆU SINH TRẮC', 'error');
    
    showToast('ĐANG XỬ LÝ SINH TRẮC...', 'success');
    
    try {
        await ApiService.createStudent(code, name, cId, file);
        document.getElementById('addStudentModal').classList.add('hidden');
        showToast('ĐÃ TẠO BẢN GHI', 'success');
        loadAdminData();
    } catch (err) {
        showToast('THAO TÁC THẤT BẠI', 'error');
    }
});

async function deleteStudent(id) {
    if(!confirm('BẠN CÓ CHẮC CHẮN MUỐN XÓA SINH VIÊN?')) return;
    try {
        await ApiService.deleteStudent(id);
        loadAdminData();
        showToast('ĐÃ XÓA BẢN GHI', 'success');
    } catch(e) { showToast('THAO TÁC THẤT BẠI', 'error'); }
}

// Batch Upload
document.getElementById('batchUploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('batchUploadSubmitBtn');
    const input = document.getElementById('batchUploadDir');
    const files = input.files;
    
    if (files.length === 0) return showToast('CHƯA CHỌN MỤC TIÊU', 'error');
    
    btn.disabled = true;
    showToast('ĐANG NẠP DỮ LIỆU...', 'success');
    
    const paths = Array.from(files).map(f => f.webkitRelativePath);
    
    try {
        const response = await ApiService.batchUploadClass(Array.from(files), paths);
        document.getElementById('batchUploadModal').classList.add('hidden');
        
        const summary = document.getElementById('batchResultsSummary');
        const errorsDiv = document.getElementById('batchResultsErrors');
        const errorList = document.getElementById('batchResultsErrorList');
        
        summary.textContent = response.message || 'Quá trình tải lên đã hoàn tất.';
        
        if (response.errors && response.errors.length > 0) {
            errorsDiv.classList.remove('hidden');
            errorList.innerHTML = response.errors.map(err => `<li><strong>${escapeHTML(err.file)}</strong>: ${escapeHTML(err.error)}</li>`).join('');
        } else {
            errorsDiv.classList.add('hidden');
        }
        
        document.getElementById('batchResultsModal').classList.remove('hidden');
    } catch (err) {
        showToast('TẢI LÊN THẤT BẠI', 'error');
    } finally {
        btn.disabled = false;
        input.value = '';
    }
});

document.getElementById('showAddTeacherBtn')?.addEventListener('click', () => {
    document.getElementById('addTeacherModal').classList.remove('hidden');
});

document.getElementById('addTeacherForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('newTeacherUsername').value;
    const password = document.getElementById('newTeacherPassword').value;
    try {
        await ApiService.createTeacher(username, password);
        document.getElementById('addTeacherModal').classList.add('hidden');
        document.getElementById('newTeacherUsername').value = '';
        document.getElementById('newTeacherPassword').value = '';
        showToast('Thêm giáo viên thành công');
        loadAdminTeachers();
    } catch (e) {
        showToast(e.message, 'error');
    }
});

function openEditTeacherModal(id, username) {
    document.getElementById('editTeacherId').value = id;
    document.getElementById('editTeacherUsername').value = username;
    document.getElementById('editTeacherPassword').value = '';
    document.getElementById('editTeacherModal').classList.remove('hidden');
}

document.getElementById('editTeacherForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editTeacherId').value;
    const username = document.getElementById('editTeacherUsername').value;
    const password = document.getElementById('editTeacherPassword').value;
    try {
        await ApiService.updateTeacher(id, username, password || null);
        document.getElementById('editTeacherModal').classList.add('hidden');
        showToast('Cập nhật giáo viên thành công');
        loadAdminTeachers();
    } catch (e) {
        showToast(e.message, 'error');
    }
});

async function deleteTeacher(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa giáo viên này?')) return;
    try {
        await ApiService.deleteTeacher(id);
        showToast('Xóa giáo viên thành công');
        loadAdminTeachers();
    } catch (e) {
        showToast('Không thể xóa giáo viên. Có thể họ đang được phân công giảng dạy.', 'error');
    }
}
function openEditStudentModal(id, code, name, classId) {
    document.getElementById('editStudentId').value = id;
    document.getElementById('editStudentCode').value = code;
    document.getElementById('editStudentName').value = name;
    document.getElementById('editStudentClassId').value = classId;
    document.getElementById('editStudentModal').classList.remove('hidden');
}

document.getElementById('editStudentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editStudentId').value;
    const code = document.getElementById('editStudentCode').value;
    const name = document.getElementById('editStudentName').value;
    const classId = document.getElementById('editStudentClassId').value;
    
    try {
        await ApiService.updateStudent(id, code, name, classId);
        document.getElementById('editStudentModal').classList.add('hidden');
        showToast('CẬP NHẬT THÀNH CÔNG');
        loadAdminData();
    } catch (e) {
        showToast(e.message, 'error');
    }
});

// --- UTILS ---
function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    
    setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 3000);
}
