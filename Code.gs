// ============================================
// HỆ THỐNG NHẬP LIỆU THÔNG TIN ỨNG VIÊN
// Google Apps Script - Backend API
// ============================================
// HƯỚNG DẪN:
// 1. Truy cập https://script.google.com
// 2. Tạo dự án mới → Dán toàn bộ code này vào
// 3. Nhấn "Triển khai" → "Triển khai mới"
// 4. Chọn loại: "Ứng dụng web"
//    - Thực thi với tư cách: "Tôi" (tài khoản của bạn)
//    - Ai có quyền truy cập: "Bất kỳ ai"
// 5. Nhấn "Triển khai" → Cấp quyền → Copy URL
// 6. Dán URL vào phần Cài đặt trong web app
// ============================================

// ── CẤU HÌNH ──
var CONFIG = {
  SPREADSHEET_ID: '1BKy9jMbDUvmkK8vAk3prg_bnCC92trnzi55Y70iL2BE',
  SHEET_NAME: '', // Để trống = dùng sheet đầu tiên

  // Google Drive folder IDs
  FOLDER_SMS: '1v9l3cSAR4e04Fq85Jtf_oXS-reLHJe0e',
  FOLDER_CCCD: '1t7AYRoB-Bg5AyCj57JR-K19D5id3Qruc',
  FOLDER_VNEID2: '1mHRlIqsb8s0wsM2Vx7WLkYkijq3f1g76',
  FOLDER_VNEID_CHUHO: '1lEiht3pgknQCyvmEYUQYCEloP0qusdwA'
};

// Map image fields → Drive folders
var IMAGE_FOLDER_MAP = {
  anhSMS:        CONFIG.FOLDER_SMS,
  anhCCCDTruoc:  CONFIG.FOLDER_CCCD,
  anhCCCDSau:    CONFIG.FOLDER_CCCD,
  anhSMSUQ:      CONFIG.FOLDER_SMS,
  anhCCCDUQ:     CONFIG.FOLDER_CCCD,
  anhVNeID2:     CONFIG.FOLDER_VNEID2,
  anhVNeIDChuHo: CONFIG.FOLDER_VNEID_CHUHO,
  anhVNeIDMQH:   CONFIG.FOLDER_VNEID_CHUHO
};

// ── Spreadsheet Headers (chạy 1 lần để tạo header) ──
function setupHeaders() {
  var headers = [
    'MÃ OPS',
    'ID HRM (CCCD)',
    'Họ tên VN - có dấu',
    'Họ tên EN - không dấu',
    'Quốc tịch',
    'Giới tính',
    'Ngày sinh',
    'Số CCCD',
    'Ngày cấp CCCD',
    'Nơi cấp CCCD',
    'Địa chỉ thường trú (theo CCCD) Mới',
    'Điện thoại (Thuê bao chính chủ)',
    'Email (nếu có)',
    'Link Ảnh SMS xác nhận thuê bao chính chủ',
    'Link Ảnh CCCD nhân viên mặt trước',
    'Link Ảnh CCCD nhân viên mặt sau',
    'Số tài khoản',
    'Chủ tài khoản EN - không dấu',
    'Tên ngân hàng',
    'Chính chủ (Yes/No)',
    'Ủy quyền (Yes/No)',
    'Check Ủy quyền (Yes/No)',
    'Họ tên Người được ủy quyền',
    'Số CCCD Người được ủy quyền',
    'Mối quan hệ Người được ủy quyền',
    'Điện thoại Người được ủy quyền',
    'Link Ảnh SMS NĐ ủy quyền',
    'Link Ảnh CCCD NĐ ủy quyền',
    'Ngày vào làm',
    'Ngày nghỉ việc',
    'Dân tộc',
    'Số tài khoản (phụ)',
    'Chủ tài khoản EN (phụ)',
    'Tên ngân hàng (phụ)',
    'Ghi chú (SMS/Email)',
    'Ảnh VNeID mức 2',
    'Ảnh Chủ hộ VNeID',
    'Ảnh VNeID thể hiện mối quan hệ',
    'Ngày nhập liệu'
  ];

  var sheet = getSheet_();
  // Chỉ thêm header nếu sheet trống
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    // Format header
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4472C4');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  Logger.log('Headers đã được tạo thành công!');
}

// ── API Endpoints ──

function doGet(e) {
  return jsonResponse_({ status: 'ok', message: 'API đang hoạt động' });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Upload tất cả ảnh → lấy link Drive
    var imageUrls = {};
    var imageFields = Object.keys(IMAGE_FOLDER_MAP);

    for (var i = 0; i < imageFields.length; i++) {
      var field = imageFields[i];
      if (data[field] && typeof data[field] === 'string' && data[field].indexOf('data:') === 0) {
        imageUrls[field] = uploadImageToDrive_(
          data[field],
          field,
          data.maOps || 'unknown',
          IMAGE_FOLDER_MAP[field]
        );
      } else {
        imageUrls[field] = '';
      }
    }

    // Tạo row data theo đúng thứ tự cột
    var row = [
      data.maOps || '',
      data.idHrm || '',
      data.hoTenVN || '',
      data.hoTenEN || '',
      data.quocTich || '',
      data.gioiTinh || '',
      data.ngaySinh || '',
      data.soCCCD || '',
      data.ngayCapCCCD || '',
      data.noiCapCCCD || '',
      data.diaChiThuongTru || '',
      data.dienThoai || '',
      data.email || '',
      imageUrls.anhSMS || '',
      imageUrls.anhCCCDTruoc || '',
      imageUrls.anhCCCDSau || '',
      data.soTaiKhoan1 || '',
      data.chuTaiKhoan1 || '',
      data.tenNganHang1 || '',
      data.chinhChu ? 'Yes' : 'No',
      data.uyQuyen ? 'Yes' : 'No',
      data.checkUyQuyen ? 'Yes' : 'No',
      data.hoTenNguoiUQ || '',
      data.soCCCDNguoiUQ || '',
      data.moiQuanHe || '',
      data.dienThoaiNguoiUQ || '',
      imageUrls.anhSMSUQ || '',
      imageUrls.anhCCCDUQ || '',
      data.ngayVaoLam || '',
      data.ngayNghiViec || '',
      data.danToc || '',
      data.soTaiKhoan2 || '',
      data.chuTaiKhoan2 || '',
      data.tenNganHang2 || '',
      data.ghiChu || '',
      imageUrls.anhVNeID2 || '',
      imageUrls.anhVNeIDChuHo || '',
      imageUrls.anhVNeIDMQH || '',
      new Date().toLocaleString('vi-VN')
    ];

    // Ghi vào spreadsheet
    var sheet = getSheet_();
    sheet.appendRow(row);

    return jsonResponse_({
      status: 'success',
      message: 'Dữ liệu đã được lưu thành công!',
      row: sheet.getLastRow()
    });

  } catch (error) {
    return jsonResponse_({
      status: 'error',
      message: 'Lỗi: ' + error.toString()
    });
  }
}

// ── Helper Functions ──

function getSheet_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (CONFIG.SHEET_NAME) {
    return ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
  }
  return ss.getSheets()[0];
}

function uploadImageToDrive_(base64Data, fieldName, maOps, folderId) {
  try {
    var parts = base64Data.split(',');
    if (parts.length < 2) return '';

    var meta = parts[0]; // e.g. "data:image/png;base64"
    var contentType = meta.match(/:(.*?);/);
    contentType = contentType ? contentType[1] : 'image/png';

    var decoded = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(decoded, contentType);

    // Tạo tên file: MaOPS_fieldName_timestamp.ext
    var ext = contentType.split('/')[1] || 'png';
    if (ext === 'jpeg') ext = 'jpg';
    var timestamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmmss');
    var fileName = maOps + '_' + fieldName + '_' + timestamp + '.' + ext;
    blob.setName(fileName);

    // Upload vào folder
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);

    // Set quyền xem cho mọi người có link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return file.getUrl();
  } catch (e) {
    Logger.log('Upload error for ' + fieldName + ': ' + e.toString());
    return 'Lỗi upload: ' + e.toString();
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
