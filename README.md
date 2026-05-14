# Yolo:Home AI Smart System

Yolo:Home là hệ thống nhà thông minh thử nghiệm, gồm backend Flask, dashboard web React/Vite và ứng dụng mobile Expo. Project tập trung vào điều khiển thiết bị qua Adafruit IO, giám sát cảm biến, bảo mật bằng PIN, nhận diện khuôn mặt FaceAI và tự động hóa quạt/đèn bằng model ML đơn giản.

## Tính năng chính

- Dashboard web để xem cảm biến, trạng thái thiết bị, lịch sử và thao tác điều khiển.
- Kết nối Adafruit IO để đọc/ghi feed thiết bị như nhiệt độ, độ ẩm, đèn, quạt, khóa cửa, relay và trạng thái PIN.
- API bảo mật PIN với khóa tạm thời sau nhiều lần nhập sai.
- FaceAI: đăng ký khuôn mặt, huấn luyện lại model, nhận diện khuôn mặt và gửi lệnh mở khóa cửa.
- Auto control: dùng DecisionTree model để đề xuất bật/tắt quạt và đèn theo dữ liệu cảm biến.
- Mobile app Expo có các tab tổng quan, khuôn mặt, giọng nói và cảnh báo. Một số màn hình mobile vẫn dùng mock data.
- Bộ HTML mockup tĩnh trong `mockup/` để tham khảo giao diện.

## Tech stack

| Phần | Công nghệ |
| --- | --- |
| Backend | Python, Flask, Flask-CORS, python-dotenv, requests |
| AI/ML | scikit-learn, pandas, numpy, joblib, Pillow, OpenCV headless |
| Web frontend | React 19, Vite, React Router, Axios, Recharts |
| Mobile | Expo SDK 54, React Native 0.81, expo-router, TypeScript |
| IoT cloud | Adafruit IO REST API |

## Cấu trúc thư mục

```text
Yolo-home-ai-smart-system/
|-- README.md
|-- .gitignore
|-- index.html                         # Trang chọn mockup PC/mobile
|-- backend/
|   |-- app.py                         # Flask entrypoint
|   |-- requirements.txt
|   |-- train.py                       # Train model quạt/đèn từ dataset
|   |-- retrain.py                     # Retrain model từ user_log.csv
|   |-- face_train.py
|   |-- face_retrain.py
|   |-- ai/
|   |   |-- auto_control.py            # ML đề xuất bật/tắt quạt, đèn
|   |   |-- face_ai.py                 # Đăng ký, train, nhận diện khuôn mặt
|   |   |-- face_logger.py
|   |   |-- recognition.py             # Voice recognition mock
|   |   `-- user_logger.py
|   |-- routes/
|   |   |-- feeds.py                   # API Adafruit feed
|   |   |-- ai.py                      # API FaceAI, voice, auto-control
|   |   `-- security.py                # API PIN, face log, voice log
|   |-- utils/
|   |   `-- adafruit.py                # Adafruit IO REST client
|   |-- data/
|   |   |-- ashrae.csv                 # Dataset train quạt
|   |   |-- light_dataset.csv          # Dataset train đèn
|   |   |-- user_log.csv               # Log thao tác để retrain
|   |   |-- face_log.csv               # Log nhận diện khuôn mặt
|   |   `-- action_count.txt
|   |-- models/
|   |   |-- fan_model.pkl
|   |   |-- features.pkl
|   |   |-- light_model.pkl
|   |   `-- light_features.pkl
|   |-- scripts/
|   |   `-- test-aio-post.ps1
|   `-- tests/
|       `-- test_face_ai.py
|-- frontend/
|   |-- package.json
|   |-- vite.config.js
|   |-- eslint.config.js
|   |-- index.html
|   |-- public/
|   |   |-- favicon.svg
|   |   `-- icons.svg
|   `-- src/
|       |-- main.jsx
|       |-- App.jsx
|       |-- App.css
|       |-- index.css
|       |-- services/
|       |   `-- api.js
|       |-- assets/
|       |   |-- hero.png
|       |   |-- react.svg
|       |   `-- vite.svg
|       `-- pages/
|           |-- Dashboard.jsx
|           |-- ControlPanel.jsx
|           |-- AIPanel.jsx
|           |-- ThresholdPanel.jsx
|           |-- PinPanel.jsx
|           |-- FacePanel.jsx
|           |-- VoicePanel.jsx
|           |-- AlertPanel.jsx
|           `-- HistoryPanel.jsx
|-- mobile/
|   |-- package.json
|   |-- app.json
|   |-- index.js
|   |-- tsconfig.json
|   |-- App.js
|   |-- Project CYolohome0205docexpo-qr.png
|   |-- app/
|   |   |-- _layout.tsx
|   |   |-- pin.tsx
|   |   `-- (tabs)/
|   |       |-- _layout.tsx
|   |       |-- index.tsx                # Tổng quan
|   |       |-- face.tsx                 # FaceAI
|   |       |-- voice.tsx                # Giọng nói/mock
|   |       `-- alerts.tsx               # Cảnh báo/mock
|   |-- services/
|   |   `-- api.ts                      # Sửa BASE_URL theo IP LAN
|   |-- constants/
|   |   |-- Colors.ts
|   |   `-- mockData.ts
|   `-- assets/
|       |-- icon.png
|       |-- adaptive-icon.png
|       |-- splash-icon.png
|       `-- favicon.png
`-- mockup/
    |-- style.css
    |-- script.js
    |-- update_mockups.py
    |-- update_mobile_links.py
    |-- 01 dashboard_tong_quan.html
    |-- 02 cua_bao_mat.html
    |-- 03 dieu_khien_thu_cong.html
    |-- 04 cai_dat_nguong_tu_dong.html
    |-- 05 canh_bao_thong_bao.html
    |-- 06 quan_ly_mat_ma.html
    |-- 07 quan_ly_khuon_mat.html
    |-- 08 cai_dat_giong_noi.html
    |-- 9 lich_su_thong_ke.html
    |-- 10 cai_dat_he_thong.html
    |-- nhan_dien_khuon_mat.mobile.html
    |-- dieu_khien_giong_noi.mobile.html
    `-- canh_bao_khan_cap.mobile.html
```

## Yêu cầu môi trường

- Python 3.10 trở lên
- Node.js 18 trở lên
- npm
- Expo Go nếu chạy mobile trên điện thoại
- Tài khoản Adafruit IO nếu muốn đọc/ghi thiết bị thật

## Cấu hình backend

Tạo file `backend/.env` thủ công:

```env
ADAFRUIT_USERNAME=your_adafruit_username
ADAFRUIT_API_KEY=your_adafruit_api_key
ADAFRUIT_DASHBOARD_KEY=your_dashboard_key

FLASK_HOST=0.0.0.0
FLASK_PORT=5000

FACE_ADMIN_PIN=2468
FACE_CONFIDENCE_THRESHOLD=0.90
FACE_MIN_SAMPLES_PER_LABEL=3
FACE_REQUIRE_DETECTED_FACE=1

ADAFRUIT_DOOR_FEED=lock-status
ADAFRUIT_DOOR_OPEN_VALUE=UNLOCKED
```

Các biến quan trọng khác:

- `FACE_ADMIN_PIN_SHA256`: dùng thay `FACE_ADMIN_PIN` nếu muốn lưu PIN dạng hash SHA-256.
- `FACE_DATA_DIR`: thư mục lưu mẫu khuôn mặt, mặc định là `backend/data/faces`.
- `FACE_MODEL_PATH`: đường dẫn model FaceAI, mặc định là `backend/models/face_model.pkl`.
- `FACE_MAX_IMAGE_BYTES`: dung lượng ảnh tối đa, mặc định `5242880`.
- `LIGHT_DATA_PATH`: CSV train đèn, mặc định `backend/data/light_dataset.csv`.
- `LIGHT_USE_TIME_FEATURE`: bật/tắt feature giờ trong ngày cho model đèn, mặc định bật.
- `LIGHT_NEED_ON_MAX_LUX`: ngưỡng lux để tạo nhãn cần bật đèn, mặc định `380`.
- `LIGHT_INVERT_OUTPUT`: đảo kết quả model đèn khi inference nếu cần khớp phần cứng.

Các feed Adafruit IO backend đang dùng:

```text
temperature, gauge, light, signal, fan-speed, light-control,
remote, logs, led-switch, relay-switch, lock-status, pin-fail-count
```

## Chạy backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Backend mặc định chạy tại:

```text
http://localhost:5000
```

Nếu model fan/light chưa có hoặc muốn train lại từ dataset:

```powershell
cd backend
python train.py
```

Nếu muốn retrain từ log thao tác người dùng:

```powershell
cd backend
python retrain.py
```

## Chạy web frontend

```powershell
cd frontend
npm install
npm run dev
```

Web mặc định chạy tại:

```text
http://localhost:5173
```

Frontend dùng `frontend/src/services/api.js` với base URL mặc định `http://localhost:5000/api`. Nếu backend chạy port khác, tạo `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Chạy mobile app

```powershell
cd mobile
npm install
npx expo start
```

Trước khi quét QR bằng Expo Go, sửa `BASE_URL` trong `mobile/services/api.ts`:

```ts
const BASE_URL = 'http://<IP-LAN-cua-may-tinh>:5000/api';
```

Lấy IP trên Windows:

```powershell
ipconfig
```

Điện thoại và máy chạy backend cần ở cùng mạng Wi-Fi. Vì backend bind `0.0.0.0`, mobile có thể gọi qua IP LAN nếu firewall cho phép port `5000`.

## API chính

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/api/feeds` | Lấy danh sách feed và `last_value` từ Adafruit IO |
| GET | `/api/feeds/<feed_key>/data?limit=100` | Lấy lịch sử feed |
| POST | `/api/feeds/<feed_key>/data` | Gửi dữ liệu lên feed |
| GET | `/api/dashboard/blocks` | Lấy dashboard blocks từ Adafruit IO |
| POST | `/api/ai/auto-control` | Đề xuất điều khiển quạt/đèn bằng ML |
| POST | `/api/ai/face-register` | Đăng ký mẫu khuôn mặt |
| POST | `/api/ai/face-recognition` | Nhận diện khuôn mặt và mở cửa nếu đạt ngưỡng |
| POST | `/api/ai/face-retrain` | Train lại FaceAI từ mẫu đã lưu |
| GET | `/api/ai/face-labels` | Danh sách khuôn mặt đã đăng ký |
| DELETE | `/api/ai/face-labels/<label>` | Xóa một label khuôn mặt, cần PIN quản trị |
| POST | `/api/ai/voice-recognition` | Nhận diện giọng nói dạng mock |
| GET | `/api/security/pin/status` | Trạng thái PIN và khóa tạm thời |
| POST | `/api/security/pin/verify` | Xác thực PIN |
| POST | `/api/security/pin/change` | Đổi PIN |
| POST | `/api/security/pin/reset` | Reset khóa tạm thời |
| GET | `/api/security/pin/log` | Lịch sử nhập PIN |
| GET/POST | `/api/security/face/log` | Lịch sử nhận diện khuôn mặt |
| GET/POST | `/api/security/voice/log` | Lịch sử giọng nói |

## Kiểm thử và build

Backend unit test:

```powershell
cd backend
python -m unittest discover -s tests
```

Frontend lint/build:

```powershell
cd frontend
npm run lint
npm run build
```

Mobile có thể kiểm tra bằng Expo:

```powershell
cd mobile
npm run web
```

## Ghi chú hiện trạng

- `backend/.env`, `frontend/.env`, `node_modules`, build output và virtualenv đã được ignore.
- `backend/routes/security.py` lưu PIN và log trong memory, nên sẽ reset khi restart server.
- FaceAI lưu mẫu ảnh vào thư mục dữ liệu và tạo `face_model.pkl` sau khi retrain.
- Nhận diện giọng nói hiện là mock trong `backend/ai/recognition.py`.
- Một số màn hình mobile như cảnh báo và giọng nói vẫn dùng mock data hoặc UI demo.

## Chạy toàn hệ thống trong lúc demo

Mở 3 terminal:

```powershell
# Terminal 1
cd backend
.\venv\Scripts\Activate.ps1
python app.py

# Terminal 2
cd frontend
npm run dev

# Terminal 3
cd mobile
npx expo start
```

Luồng demo gợi ý: mở web dashboard, kiểm tra feed Adafruit, nhập PIN, đăng ký ít nhất 3 ảnh cho một label FaceAI, retrain, sau đó thử nhận diện để gửi lệnh mở cửa qua feed `lock-status`.
