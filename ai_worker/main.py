# pyrefly: ignore [missing-import]
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from typing import List
import torch
# Monkey-patch torch.load to bypass weights_only restriction in PyTorch 2.6
original_load = torch.load
def safe_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return original_load(*args, **kwargs)
torch.load = safe_load

from ultralytics import YOLO
import insightface
from insightface.app import FaceAnalysis
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="AI Face Extraction Microservice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Khởi tạo Models khi bật Server (chỉ load 1 lần để tối ưu tốc độ)
print("Loading YOLOv8-face model for real-time optimization...")
try:
    # Sử dụng YOLOv8 nano (yolov8n-face.pt) để tối ưu cho việc chạy real-time (tốc độ khung hình cao)
    model_path = os.environ.get('YOLO_MODEL_PATH', 'yolov8n-face.pt')
    if not os.path.exists(model_path):
        print(f"WARNING: Model file {model_path} not found. Ensure it is mapped correctly.")
    yolo_model = YOLO(model_path) 
except Exception as e:
    print(f"Error loading YOLO model: {e}")
    yolo_model = None
    

print("Loading InsightFace model...")
try:
    # providers=['CUDAExecutionProvider'] nếu có GPU, dùng 'CPUExecutionProvider' nếu chỉ có CPU
    app_face = FaceAnalysis(name='buffalo_l', root='./models', providers=['CPUExecutionProvider'])
    app_face.prepare(ctx_id=0, det_size=(640, 640))
except Exception as e:
    print(f"Error loading InsightFace model: {e}")
    app_face = None

@app.get("/health")
async def health_check():
    return {"status": "ok", "yolo_loaded": yolo_model is not None, "insightface_loaded": app_face is not None}

@app.post("/extract_faces")
async def extract_faces(files: List[UploadFile] = File(...)):
    if yolo_model is None or app_face is None:
        raise HTTPException(status_code=500, detail="AI models are not loaded properly.")
        
    results_data = []
    
    for file in files:
        try:
            # Đọc ảnh từ request
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                continue
                
            # 2. Phát hiện khuôn mặt bằng YOLOv8
            results = yolo_model(img)[0]
            
            # InsightFace yêu cầu ảnh RGB. Truyền toàn bộ ảnh để RetinaFace hoạt động tốt nhất.
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            insight_faces = app_face.get(img_rgb)
            
            for box in results.boxes:
                # Lấy toạ độ Bounding Box từ YOLO
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                w = x2 - x1
                h = y2 - y1
                
                # Tìm khuôn mặt tương ứng từ InsightFace thông qua tọa độ trung tâm
                yolo_cx = (x1 + x2) / 2
                yolo_cy = (y1 + y2) / 2
                
                best_face = None
                for face in insight_faces:
                    fx1, fy1, fx2, fy2 = face.bbox
                    if fx1 <= yolo_cx <= fx2 and fy1 <= yolo_cy <= fy2:
                        best_face = face
                        break
                
                # Nếu không trùng khớp trung tâm, lấy khuôn mặt đầu tiên làm dự phòng
                if best_face is None and len(insight_faces) > 0:
                    best_face = insight_faces[0]
                    
                if best_face is not None:
                    embedding = best_face.embedding.tolist()
                    results_data.append({
                        "bounding_box": {"x": x1, "y": y1, "w": w, "h": h},
                        "embedding": embedding
                    })
        except Exception as e:
            print(f"Error processing file {file.filename}: {e}")
            continue
                
    return {"status": "success", "data": results_data}
