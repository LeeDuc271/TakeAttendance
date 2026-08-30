# Hệ Thống Điểm Danh Khuôn Mặt Bằng AI 📸

Một hệ thống điểm danh tự động, tốc độ cao theo thời gian thực. Được xây dựng trên kiến trúc **Microservices** hiện đại, hệ thống sử dụng các mô hình AI tiên tiến nhất để tự động hóa việc điểm danh lớp học một cách chính xác, nhanh chóng và bảo mật cực cao.

---

## 🌟 Tính Năng Nổi Bật

### 👩‍🏫 Phân Quyền Truy Cập Chặt Chẽ (RBAC)
- **Quản trị viên (Admin)**: Toàn quyền truy cập hệ thống. Quản lý danh sách Lớp học, Sinh viên, Giáo viên, và giám sát thống kê toàn hệ thống.
- **Giáo viên (Teacher)**: Quyền truy cập giới hạn. Chỉ quản lý các lớp học được phân công, thực hiện điểm danh và xuất báo cáo.

### 🧠 Tích Hợp Trí Tuệ Nhân Tạo (AI) Đầu Bảng
- **Nhận Diện Khuôn Mặt Thời Gian Thực**: Sử dụng mô hình **YOLOv8-face** tối ưu để phát hiện nhanh các khuôn mặt trong ảnh, hoạt động mượt mà ngay cả với lớp học đông người. Tốc độ quét qua Webcam đã được tối ưu đạt **0.5s/frame**.
- **Trích Xuất Đặc Trưng Sinh Trắc Học**: Áp dụng thuật toán **InsightFace (ArcFace)** để trích xuất chính xác khuôn mặt thành vector 512 chiều.
- **Cơ Sở Dữ Liệu Vector**: Ứng dụng công nghệ **pgvector** trong PostgreSQL giúp đối chiếu và tìm kiếm độ tương đồng Cosine cực nhanh.

### 🚀 Chức Năng Cốt Lõi Vượt Trội
- **Điểm Danh Đa Phương Thức**: Hỗ trợ nhận diện qua ảnh tĩnh tải lên hoặc điểm danh trực tiếp liên tục thông qua **Camera/Webcam**. 
- **Tương Thích Mạng Nội Bộ & Tunneling**: Hỗ trợ kết nối mượt mà từ thiết bị di động (Mobile/Tablet) vào máy tính qua mạng LAN hoặc **Ngrok**.
- **Nạp Dữ Liệu Hàng Loạt (Batch Upload)**: Hỗ trợ nạp nhanh hàng loạt dữ liệu sinh viên qua cấu trúc thư mục nén một cách tự động.
- **Xuất Báo Cáo Excel Tổng Hợp**: Quản trị viên (Admin) và Giáo viên có thể trích xuất toàn bộ dữ liệu điểm danh ra file định dạng `.xlsx` cực chuẩn chỉ với một click.

---

## 🛠️ Công Nghệ Sử Dụng

| Thành phần | Công nghệ |
| --- | --- |
| **Frontend** | Vanilla HTML, CSS, JavaScript thuần (Phục vụ qua Nginx) |
| **Backend API** | Node.js, Express.js |
| **AI Microservice** | Python, FastAPI, YOLOv8, InsightFace |
| **Cơ Sở Dữ Liệu** | PostgreSQL 16 (tích hợp extension `pgvector`) |
| **Triển Khai** | Docker, Docker Compose |

---

## 🏗️ Kiến Trúc Hệ Thống

Dự án được triển khai tinh gọn thông qua Docker với 4 container hoạt động độc lập:
1. **Frontend (Nginx)**: Phục vụ giao diện người dùng tĩnh và làm Reverse Proxy tại cổng `80`.
2. **Backend**: Trung tâm xử lý logic nghiệp vụ, xác thực JWT và điều phối API tại cổng `3000`.
3. **AI Worker**: Dịch vụ AI (Python) chạy độc lập tại cổng `8000`. Xử lý ảnh tĩnh trực tiếp trên RAM.
4. **Database**: Máy chủ PostgreSQL lưu trữ dữ liệu và lập chỉ mục HNSW cho vector khuôn mặt.

---

## 🛡️ Hệ Thống Bảo Mật Đa Tầng (Security)

Hệ thống được thiết kế với tiêu chí bảo mật cấp doanh nghiệp, bao gồm các lớp phòng thủ toàn diện:
- **Ngăn Chặn Mã Độc File Upload**: Sử dụng `multer` với bộ lọc định dạng tệp (chỉ chấp nhận JPG, PNG, WEBP).
- **Phòng Chống XSS Toàn Diện**: Mã hóa triệt để dữ liệu đầu vào. Tích hợp thư viện **Helmet** để thêm các HTTP Security Headers chuẩn xác (chống Clickjacking, MIME-sniffing).
- **Chống Tấn Công DoS & Rate Limiting**: 
  - Áp dụng **express-rate-limit** toàn cầu (2000 requests/15 phút) và cho API Login (50 requests/5 phút/IP) chống Brute-Force. 
  - Đã cấu hình `trust proxy` để nhận diện chuẩn IP qua Nginx.
  - Giới hạn kích thước Body Payload tối đa **10MB** để chống lỗi cạn kiệt bộ nhớ (Memory Exhaustion).
- **Cấu hình CORS Nghiêm Ngặt**: Không mở public `origin: true`. Chỉ cấp phép (Whitelist) cho các domain tin cậy (như `localhost`, `127.0.0.1`, `ngrok-free.app`) chặn hoàn toàn CORS Spoofing và CSRF.
- **An Toàn SQL Injection**: 100% truy vấn DB sử dụng `Parameterized Queries`.

---

## 🚀 Hướng Dẫn Cài Đặt và Khởi Chạy

### Yêu Cầu Hệ Thống
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) đã được cài đặt và đang chạy.
- Máy tính có cấu hình tối thiểu 4GB RAM (để chạy các AI Models).
- Tùy chọn: Đã cài đặt công cụ [Ngrok](https://ngrok.com/download) (nếu muốn truy cập ứng dụng từ mạng ngoài như điện thoại 4G).

### Các Bước Khởi Chạy Hệ Thống

**Bước 0: Chuẩn bị mô hình AI (Bắt buộc)**
Do giới hạn dung lượng lưu trữ của GitHub, các mô hình AI phục vụ nhận diện khuôn mặt không được đính kèm sẵn. Bạn cần tải chúng thủ công trước khi khởi chạy hệ thống:
1. Tải mô hình InsightFace ArcFace (`buffalo_l.zip`):
   - Tải trực tiếp từ [kho lưu trữ của InsightFace](https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip).
2. Giải nén file `.zip` vừa tải về.
3. Chép toàn bộ các file (có đuôi `.onnx`) bên trong vào đường dẫn sau trong dự án của bạn: `ai_worker/models/models/buffalo_l/`. *(Tạo các thư mục này nếu chưa có).*

**Bước 1: Chạy hệ thống bằng Docker**
Mở thư mục gốc của dự án (`d:\AI\TakeAttendance`) bằng Terminal (PowerShell hoặc Command Prompt) và chạy lệnh:
```bash
docker compose up -d --build
```
*(Lệnh này sẽ tự động tải các dependencies, build image và chạy toàn bộ hệ thống ngầm (detached). Việc này có thể mất vài phút cho lần đầu tiên).*

**Bước 2: Truy cập ứng dụng (Mạng Nội Bộ - Local)**
- Mở trình duyệt trên máy tính hiện tại và truy cập: `http://localhost`

**Bước 3: Chia sẻ ứng dụng ra Internet (Sử dụng Ngrok)**
Nếu bạn muốn dùng điện thoại để điểm danh thông qua 4G hoặc Wifi khác, bạn cần kết nối Ngrok.
Vẫn giữ hệ thống Docker đang chạy, mở một cửa sổ Terminal mới và chạy lệnh:
```bash
ngrok http 80
```
- Ngrok sẽ sinh ra một giao diện hiển thị 1 đường link **Forwarding** dạng `https://xxxx.ngrok-free.app`.
- Bạn có thể copy đường link này gửi sang điện thoại hoặc trình duyệt khác để truy cập hệ thống ở bất cứ đâu.

**Bước 4: Dừng hệ thống**
- Tắt Ngrok: Tại cửa sổ terminal chạy ngrok, nhấn `Ctrl + C`.
- Tắt Docker: Tại thư mục dự án, chạy lệnh:
  ```bash
  docker compose down
  ```

---

## 📖 Hướng Dẫn Sử Dụng Giao Diện

### 1. Đăng Nhập
Hệ thống tự động có sẵn 2 tài khoản mặc định:
- **Quản Trị Viên (Admin):** `admin` / Mật khẩu: `admin123`
- **Giáo viên:** `teacher1` / Mật khẩu: `admin123`

### 2. Dành Cho Quản Trị Viên (Admin)
- **Dashboard Thống Kê**: Xem tổng quan số liệu sinh viên, tỷ lệ điểm danh, giáo viên, lớp học. Xuất báo cáo Excel cực kỳ dễ dàng.
- **Quản lý Hệ thống**: Thêm, sửa, xóa Giáo viên, Lớp học và cấu hình các Lớp.
- **Sinh viên**: Đăng ký sinh viên mới bằng hình ảnh khuôn mặt. Hỗ trợ tính năng siêu việt **Batch Upload** nén nhiều lớp và nhiều sinh viên chỉ bằng 1 thao tác kéo thả.

### 3. Dành Cho Giáo Viên (Vận Hành Điểm Danh)
- Lựa chọn Lớp học mà mình được phân công để điểm danh.
- **Quét Tự Động**: Bật **Webcam** hoặc **Tải ảnh chụp tập thể** lên hệ thống. AI sẽ tự động phân tích và điểm danh ngay lập tức các sinh viên có mặt trong lớp.
- **Báo cáo Buổi học**: Dễ dàng chỉnh sửa kết quả, xem lại lịch sử buổi học và xuất trực tiếp ra tệp Excel.
