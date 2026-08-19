# Hệ Thống Nhập Liệu Thông Tin Ứng Viên

Đây là dự án Web App giúp tự động hóa quá trình nhập liệu thông tin cá nhân của nhân viên/ứng viên vào hệ thống HRM thông qua công nghệ nhận dạng ký tự quang học (OCR) sử dụng Tesseract.js.

## 🚀 Tính Năng Chính

- **Quét CCCD Tự Động (OCR):** 
  - Đọc tự động mặt trước (Họ tên, Số CCCD, Ngày sinh, Giới tính, Quê quán...).
  - Đọc tự động mặt sau (Vùng MRZ chuẩn ICAO) để trích xuất và đối chiếu chéo (Cross-check) dữ liệu với mặt trước.
- **Xử lý "Ảo giác" OCR (Hallucination Handling):** Thuật toán làm sạch dữ liệu mạnh mẽ, loại bỏ các ký tự rác do lỗi quét hình ảnh.
- **Xác Thực Dữ Liệu (Validation):** 
  - Tính toán và xác thực Checksum ICAO cho phần MRZ.
  - Đối chiếu chéo Số CCCD và Họ tên giữa hai mặt.
  - Xác thực độ tuổi động (từ 14 đến 100 tuổi).
- **Giao Diện Trực Quan:** Thiết kế UI/UX dạng Form đa bước (Multi-step form) thân thiện, dễ sử dụng.
- **Gửi Dữ Liệu Tự Động:** Tích hợp gửi dữ liệu thẳng lên Google Sheets thông qua Google Apps Script.

## 🛠️ Công Nghệ Sử Dụng

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (Không sử dụng framework phức tạp để đảm bảo tốc độ và tính tương thích).
- **OCR Engine:** [Tesseract.js](https://tesseract.projectnaptha.com/) (Chạy trực tiếp trên trình duyệt - Client-side OCR).
- **Lưu Trữ:** LocalStorage (Lưu tạm) và Google Sheets (Cơ sở dữ liệu chính).

## 💡 Luồng Xử Lý OCR (Pipeline)

1. **Upload Ảnh:** Người dùng chọn hoặc chụp ảnh mặt trước và mặt sau CCCD.
2. **Tiền Xử Lý & Đọc Chữ (Tesseract.js):** 
   - Mặt trước quét với ngôn ngữ Tiếng Việt (`vie`).
   - Mặt sau quét vùng MRZ với ngôn ngữ Tiếng Anh (`eng`).
3. **Trích Xuất Thông Tin (Parsing):**
   - Dùng Biểu thức chính quy (Regex) và từ khóa để lọc Họ Tên, CCCD, Ngày Sinh...
   - Loại bỏ các cụm từ gây nhiễu (Quốc hiệu, Tiêu ngữ, nhãn trường).
4. **Xác Thực & Đối Chiếu (Cross-check & Validation):**
   - Kiểm tra xem 12 số CCCD mặt trước có khớp với dữ liệu trong chuỗi MRZ hay không.
   - Tính tổng kiểm (Checksum) ngày sinh theo chuẩn ICAO.
5. **Điền Dữ Liệu Tự Động (Auto-fill):** Trả kết quả sạch về Form HTML và cảnh báo (Toast) nếu phát hiện dữ liệu không khớp để người dùng kiểm tra thủ công.

## 📜 Hướng Dẫn Sử Dụng

1. **Mở hệ thống:** Truy cập vào file `index.html` hoặc đường dẫn được Host trên GitHub Pages.
2. Ấn nút **Quét CCCD Tự Động**.
3. Cung cấp hình ảnh **Mặt Trước** và **Mặt Sau** của CCCD.
4. Chờ hệ thống OCR phân tích.
5. Kiểm tra lại dữ liệu trên màn hình, chỉnh sửa thủ công nếu có trường nào OCR đọc sai.
6. Hoàn thành các bước Form và ấn **Gửi Dữ Liệu**.

## ⚠️ Lưu Ý Về Trình Duyệt

- Để đảm bảo Tesseract.js hoạt động mượt mà, khuyến nghị sử dụng Google Chrome, Cốc Cốc, hoặc Safari bản mới nhất.
- Lần đầu tiên chạy OCR, trình duyệt sẽ cần tải file ngôn ngữ (khoảng 30MB) từ CDN nên có thể mất vài giây. Các lần sau file ngôn ngữ sẽ được lưu trong bộ nhớ đệm (Cache).
- Nếu dữ liệu không cập nhật sau khi tải bản cập nhật mới, hãy nhấn `Ctrl + Shift + R` (hoặc `Cmd + Shift + R`) để Hard Refresh trình duyệt.
