# 🔧 Hướng Dẫn Cài Đặt Google Sheets & Drive

## Tổng quan

Web app này đồng bộ dữ liệu ứng viên lên:
- **Google Sheets** → Trang tính chứa toàn bộ thông tin
- **Google Drive** → Ảnh CCCD, SMS, VNeID được lưu vào từng folder riêng

---

## Bước 1: Mở Google Apps Script

1. Truy cập **[script.google.com](https://script.google.com)**
2. Nhấn **"Dự án mới"** (New project)
3. Đặt tên: `Nhập Liệu Ứng Viên API`

## Bước 2: Dán code

1. Mở file **`Code.gs`** trong thư mục dự án `checkthongtin`
2. **Copy toàn bộ nội dung** file `Code.gs`
3. Quay lại Google Apps Script → **Xóa hết code mẫu** → **Dán code vào**
4. Nhấn **Ctrl+S** để lưu

## Bước 3: Tạo header cho Spreadsheet

1. Trong Google Apps Script, ở dropdown chọn hàm → chọn **`setupHeaders`**
2. Nhấn nút **▶ Chạy** (Run)
3. Lần đầu sẽ yêu cầu **cấp quyền**:
   - Nhấn "Xem xét quyền" → Chọn tài khoản Google
   - Nhấn "Nâng cao" → "Truy cập [tên dự án] (không an toàn)"
   - Nhấn "Cho phép"
4. Kiểm tra Google Sheet → Hàng đầu tiên đã có header

## Bước 4: Triển khai Web App

1. Nhấn **"Triển khai"** (Deploy) → **"Triển khai mới"** (New deployment)
2. Nhấn ⚙️ bên cạnh "Chọn loại" → chọn **"Ứng dụng web"** (Web app)
3. Cấu hình:
   - **Mô tả**: `API nhập liệu ứng viên`
   - **Thực thi với tư cách**: `Tôi` (Me)
   - **Ai có quyền truy cập**: `Bất kỳ ai` (Anyone)
4. Nhấn **"Triển khai"**
5. **Copy URL** hiển thị (dạng: `https://script.google.com/macros/s/xxxxx/exec`)

## Bước 5: Kết nối Web App

1. Mở web app nhập liệu (localhost:3000)
2. Nhấn nút **⚙️** ở góc phải header
3. Dán URL vào ô **"URL Google Apps Script"**
4. Nhấn **"💾 Lưu cài đặt"**
5. Chấm tròn sẽ chuyển **🟢 xanh** = đã kết nối

---

## 📂 Cấu trúc Google Drive

| Loại ảnh | Folder ID |
|----------|-----------|
| Ảnh SMS xác nhận thuê bao | `1v9l3cSAR4e04Fq85Jtf_oXS-reLHJe0e` |
| Ảnh CCCD nhân viên (trước/sau) | `1t7AYRoB-Bg5AyCj57JR-K19D5id3Qruc` |
| Ảnh VNeID mức 2 | `1mHRlIqsb8s0wsM2Vx7WLkYkijq3f1g76` |
| Ảnh Chủ hộ VNeID / Mối quan hệ | `1lEiht3pgknQCyvmEYUQYCEloP0qusdwA` |

---

## ⚠️ Lưu ý quan trọng

- **Ảnh được nén** xuống max 1600px trước khi upload (tiết kiệm dung lượng)
- **Dữ liệu luôn lưu local** (localStorage) trước, sau đó mới gửi Google
- Nếu Google gặp lỗi, dữ liệu vẫn an toàn trên local
- **Giới hạn**: Mỗi ảnh tối đa 5MB, tổng payload ~50MB
- Khi cập nhật code Apps Script, cần **triển khai phiên bản mới**

---

## 🔄 Cập nhật Apps Script (khi có thay đổi)

1. Sửa code trong Google Apps Script
2. **Triển khai** → **Quản lý triển khai** → **Chỉnh sửa** (✏️)
3. Phiên bản: chọn **"Triển khai mới"**
4. Nhấn **"Triển khai"**
5. URL không thay đổi
