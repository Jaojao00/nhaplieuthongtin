// ============================================
// HỆ THỐNG NHẬP LIỆU THÔNG TIN ỨNG VIÊN
// Main Application Logic — Google Sheets + Drive Integration
// ============================================

(function () {
  'use strict';

  // --- State ---
  let currentStep = 1;
  const totalSteps = 4;
  let savedRecords = localStorage.getItem('employeeRecords');
  if (savedRecords === 'undefined') savedRecords = '[]';
  let records = JSON.parse(savedRecords || '[]');
  let imageData = {}; // Stores base64 image data for current form
  let editingIndex = -1; // -1 means new record
  let isSubmitting = false;

  // --- Auth State ---
  let isAdmin = sessionStorage.getItem('isAdmin') === 'true';
  let ADMIN_PIN = localStorage.getItem('adminPin') || '123456';

  // --- Google Apps Script URL (stored in localStorage) ---
  let SCRIPT_URL = localStorage.getItem('googleScriptUrl') || 'https://script.google.com/macros/s/AKfycby4frTN7VToMDIK6stKi_QXlOmmmXYwF74LR5dXeyY61_ABe3XxUff7e1XO1LBzM3CJ/exec';

  // --- DOM Cache ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ============================================
  // OCR QUICK ENTRY
  // ============================================
  let ocrFileFront = null;
  let ocrFileBack = null;

  function setupOCR() {
    const btnOpenOCR = document.getElementById('btnOpenOCR');
    const ocrModal = document.getElementById('ocrModal');
    const btnCloseOCRModal = document.getElementById('btnCloseOCRModal');
    
    const inputFront = document.getElementById('ocrFileInputFront');
    const inputBack = document.getElementById('ocrFileInputBack');
    const dropFront = document.getElementById('ocrDropzoneFront');
    const dropBack = document.getElementById('ocrDropzoneBack');
    const btnStart = document.getElementById('btnStartOCR');
    
    if (!btnOpenOCR || !ocrModal) return;

    btnOpenOCR.addEventListener('click', () => {
      resetOCRModal();
      ocrModal.classList.add('active');
    });

    btnCloseOCRModal.addEventListener('click', () => {
      ocrModal.classList.remove('active');
    });

    document.getElementById('btnOCRRetry').addEventListener('click', resetOCRModal);
    document.getElementById('btnOCRConfirm').addEventListener('click', () => ocrModal.classList.remove('active'));

    const handleFileSelect = (file, type) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        if (type === 'front') {
          ocrFileFront = file;
          document.getElementById('ocrPreviewFrontThumbnail').src = e.target.result;
          document.getElementById('ocrDropzoneFront').classList.add('hidden');
          document.getElementById('ocrPreviewFrontContainer').classList.remove('hidden');
        } else {
          ocrFileBack = file;
          document.getElementById('ocrPreviewBackThumbnail').src = e.target.result;
          document.getElementById('ocrDropzoneBack').classList.add('hidden');
          document.getElementById('ocrPreviewBackContainer').classList.remove('hidden');
        }
        checkOCRStartBtn();
      };
      reader.readAsDataURL(file);
    };

    inputFront.addEventListener('change', e => { if (e.target.files.length) handleFileSelect(e.target.files[0], 'front'); });
    inputBack.addEventListener('change', e => { if (e.target.files.length) handleFileSelect(e.target.files[0], 'back'); });

    // Drag and drop front
    dropFront.addEventListener('dragover', e => { e.preventDefault(); dropFront.classList.add('dragover'); });
    dropFront.addEventListener('dragleave', () => dropFront.classList.remove('dragover'));
    dropFront.addEventListener('drop', e => {
      e.preventDefault(); dropFront.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0], 'front');
    });

    // Drag and drop back
    dropBack.addEventListener('dragover', e => { e.preventDefault(); dropBack.classList.add('dragover'); });
    dropBack.addEventListener('dragleave', () => dropBack.classList.remove('dragover'));
    dropBack.addEventListener('drop', e => {
      e.preventDefault(); dropBack.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0], 'back');
    });

    // Remove buttons
    document.getElementById('btnRemoveOcrFront').addEventListener('click', () => {
      ocrFileFront = null;
      inputFront.value = '';
      document.getElementById('ocrPreviewFrontContainer').classList.add('hidden');
      document.getElementById('ocrDropzoneFront').classList.remove('hidden');
      checkOCRStartBtn();
    });
    document.getElementById('btnRemoveOcrBack').addEventListener('click', () => {
      ocrFileBack = null;
      inputBack.value = '';
      document.getElementById('ocrPreviewBackContainer').classList.add('hidden');
      document.getElementById('ocrDropzoneBack').classList.remove('hidden');
      checkOCRStartBtn();
    });

    btnStart.addEventListener('click', () => {
      startOCRProcess();
    });
  }

  function checkOCRStartBtn() {
    // Enable if at least front is selected
    const btn = document.getElementById('btnStartOCR');
    if (ocrFileFront) {
      btn.removeAttribute('disabled');
    } else {
      btn.setAttribute('disabled', 'true');
    }
  }

  function resetOCRModal() {
    document.getElementById('ocrStateUpload').classList.remove('hidden');
    document.getElementById('ocrStateProcessing').classList.add('hidden');
    document.getElementById('ocrStateResult').classList.add('hidden');
    
    ocrFileFront = null;
    ocrFileBack = null;
    document.getElementById('ocrFileInputFront').value = '';
    document.getElementById('ocrFileInputBack').value = '';
    
    document.getElementById('ocrPreviewFrontContainer').classList.add('hidden');
    document.getElementById('ocrDropzoneFront').classList.remove('hidden');
    document.getElementById('ocrPreviewBackContainer').classList.add('hidden');
    document.getElementById('ocrDropzoneBack').classList.remove('hidden');
    checkOCRStartBtn();
  }

  function setUploadPreview(field, base64) {
    imageData[field] = base64;
    const zone = document.querySelector(`.upload-zone[data-field="${field}"]`);
    if (zone) {
      const parent = zone.parentElement;
      const previewContainer = parent.querySelector('.image-preview-container');
      const previewImg = parent.querySelector('.image-preview');
      zone.style.display = 'none';
      previewContainer.style.display = 'block';
      previewImg.src = base64;
      previewImg.style.display = 'block';
    }
  }

  async function startOCRProcess() {
    document.getElementById('ocrStateUpload').classList.add('hidden');
    document.getElementById('ocrStateProcessing').classList.remove('hidden');
    
    const img1 = document.getElementById('ocrPreviewImage1');
    const img2 = document.getElementById('ocrPreviewImage2');
    img2.style.display = 'none';
    img1.style.width = '100%';

    const fileToBase64 = file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });

    if (ocrFileFront) {
      const b64_1 = await fileToBase64(ocrFileFront);
      img1.src = b64_1;
      setUploadPreview('anhCCCDTruoc', b64_1);
    }
    if (ocrFileBack) {
      const b64_2 = await fileToBase64(ocrFileBack);
      img2.src = b64_2;
      img2.style.display = 'block';
      img1.style.width = '50%';
      setUploadPreview('anhCCCDSau', b64_2);
    }

  async function startOCRProcess() {
    const progress = document.getElementById('ocrProgressBar');
    const text = document.getElementById('ocrProgressText');

    if (!progress || !text) {
        console.error('Không tìm thấy thành phần OCR progress.');
        return;
    }

    progress.style.width = '0%';
    text.textContent = 'Đang chuẩn bị OCR...';

    let ocrData = {
        cccd: "",
        fullNameVN: "",
        fullNameEN: "",
        dateOfBirth: "",
        gender: "",
        nationality: "Việt Nam",
        placeOfOrigin: "",
        placeOfResidence: "",
        personalIdentificationDate: "",
        issuePlace: "Bộ Công an"
    };

    if (!window.Tesseract) {
        console.error('Tesseract.js chưa được tải.');
        text.textContent = 'Không tải được OCR engine.';
        document.getElementById('ocrStateProcessing').classList.add('hidden');
        document.getElementById('ocrStateUpload').classList.remove('hidden');
        return;
    }

    if (!ocrFileFront && !ocrFileBack) {
        text.textContent = 'Chưa có ảnh CCCD để quét.';
        document.getElementById('ocrStateProcessing').classList.add('hidden');
        document.getElementById('ocrStateUpload').classList.remove('hidden');
        return;
    }

    try {
        const results = [];

        // ==============================
        // MẶT TRƯỚC
        // ==============================
        if (ocrFileFront) {
            const result = await Tesseract.recognize(
                ocrFileFront,
                'vie',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            const p = Math.round(m.progress * 40);
                            progress.style.width = `${10 + p}%`;
                            text.textContent = `Đang đọc mặt trước... ${Math.round(m.progress * 100)}%`;
                        }
                    }
                }
            );

            results.push({
                side: 'front',
                text: result.data.text || ''
            });
        }

        // ==============================
        // MẶT SAU - ƯU TIÊN ENG CHO MRZ
        // ==============================
        if (ocrFileBack) {
            const result = await Tesseract.recognize(
                ocrFileBack,
                'eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            const p = Math.round(m.progress * 40);
                            progress.style.width = `${50 + p}%`;
                            text.textContent = `Đang đọc mặt sau / MRZ... ${Math.round(m.progress * 100)}%`;
                        }
                    }
                }
            );

            results.push({
                side: 'back',
                text: result.data.text || ''
            });
        }

        let frontText = '';
        let backText = '';

        for (const result of results) {
            if (result.side === 'front') {
                frontText = result.text;
            }

            if (result.side === 'back') {
                backText = result.text;
            }
        }

        console.log('===== OCR FRONT =====');
        console.log(frontText);

        console.log('===== OCR BACK =====');
        console.log(backText);

        progress.style.width = '90%';
        text.textContent = 'Đang phân tích dữ liệu CCCD...';

        // ==============================
        // PHÂN TÍCH MẶT TRƯỚC
        // ==============================
        parseFrontCCCD(frontText, ocrData);

        // ==============================
        // PHÂN TÍCH MẶT SAU / MRZ
        // ==============================
        parseBackCCCD(backText, ocrData);

        // ==============================
        // VALIDATE
        // ==============================
        validateOCRData(ocrData);

        console.log('===== OCR RESULT =====');
        console.table(ocrData);

        progress.style.width = '100%';
        text.textContent = 'Đã quét CCCD thành công.';

        // ==============================
        // ĐỔ DỮ LIỆU VÀO FORM
        // ==============================
        fillOCRData(ocrData);
        
        document.getElementById('ocrStateProcessing').classList.add('hidden');
        document.getElementById('ocrStateResult').classList.remove('hidden');

    } catch (error) {
        console.error('OCR Error:', error);

        progress.style.width = '0%';
        text.textContent = 'Không thể đọc CCCD. Vui lòng kiểm tra ảnh và thử lại.';

        document.getElementById('ocrStateProcessing').classList.add('hidden');
        document.getElementById('ocrStateUpload').classList.remove('hidden');
    }
  }

  function parseFrontCCCD(frontText, data) {
    if (!frontText) return;

    const lines = frontText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    // CCCD 12 SỐ
    const cccdMatch = frontText.match(/\b\d{12}\b/);
    if (cccdMatch) {
        data.cccd = cccdMatch[0];
    }

    // TÌM HỌ TÊN
    const nameCandidates = [];
    for (const line of lines) {
        const cleaned = line.replace(/[|_]+/g, '').replace(/\s+/g, ' ').trim();
        if (cleaned.length < 5) continue;

        const lower = cleaned.toLowerCase();
        if (lower.includes('căn cước') || lower.includes('công dân') || lower.includes('số định danh') ||
            lower.includes('ngày sinh') || lower.includes('giới tính') || lower.includes('quốc tịch') ||
            lower.includes('quê quán') || lower.includes('nơi thường trú') || lower.includes('residence')) {
            continue;
        }

        const words = cleaned.split(/\s+/);
        if (words.length < 2 || words.length > 8) continue;

        const digitCount = (cleaned.match(/\d/g) || []).length;
        if (digitCount > 2) continue;

        if (!/[A-Za-zÀ-ỹ]/.test(cleaned)) continue;

        nameCandidates.push(cleaned);
    }

    if (nameCandidates.length) {
        const uppercaseName = nameCandidates.find(name => name === name.toUpperCase());
        data.fullNameVN = uppercaseName || nameCandidates[0];
    }

    // GIỚI TÍNH
    for (const line of lines) {
        const normalized = line.toLowerCase();
        if (normalized.includes('giới tính') || normalized.includes('gioi tinh')) {
            if (normalized.includes('nữ') || normalized.includes('nu')) {
                data.gender = 'Nữ';
            } else if (normalized.includes('nam')) {
                data.gender = 'Nam';
            }
            break;
        }
    }

    // QUỐC TỊCH
    for (const line of lines) {
        const normalized = line.toLowerCase();
        if (normalized.includes('quốc tịch') || normalized.includes('quoc tich')) {
            if (normalized.includes('việt nam') || normalized.includes('viet nam')) {
                data.nationality = 'Việt Nam';
            }
            break;
        }
    }
  }

  function parseBackCCCD(backText, data) {
    if (!backText) return;
    const mrzLines = extractMRZLines(backText);

    if (mrzLines.length >= 3) {
        const line1 = mrzLines[0];
        const line2 = mrzLines[1];
        const line3 = mrzLines[2];

        // Document number in Vietnamese MRZ starts at index 5 and is 12 chars long
        if (line1.length >= 17) {
            const mrzCccd = line1.substring(5, 17).replace(/</g, '');
            if (mrzCccd.length === 12) {
                data.cccdMRZ = mrzCccd;
            }
        }

        const dob = parseMRZDate(line2.substring(0, 6));
        if (dob) data.dateOfBirth = dob;

        const gender = line2.charAt(7);
        if (gender === 'M') data.gender = 'Nam';
        else if (gender === 'F') data.gender = 'Nữ';

        const nationality = line2.substring(15, 18);
        if (nationality === 'VNM') data.nationality = 'Việt Nam';

        const nameEN = parseMRZName(line3);
        if (nameEN) data.fullNameEN = nameEN;
    }

    // Ngày cấp (Issue date fallback)
    const dates = backText.match(/\b\d{2}\/\d{2}\/\d{4}\b/g);
    if (dates && dates.length > 0) {
        data.personalIdentificationDate = parseVietnameseDate(dates[0]);
    }

    parseResidence(backText, data);
  }

  function parseVietnameseDate(value) {
    if (!value) return '';

    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return '';

    const [, dd, mm, yyyy] = match;

    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));

    if (
        date.getFullYear() !== Number(yyyy) ||
        date.getMonth() !== Number(mm) - 1 ||
        date.getDate() !== Number(dd)
    ) {
        return '';
    }

    return `${yyyy}-${mm}-${dd}`;
  }

  function calculateICAOChecksum(str) {
    const weights = [7, 3, 1];
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        let val = 0;
        if (char >= '0' && char <= '9') val = parseInt(char, 10);
        else if (char >= 'A' && char <= 'Z') val = char.charCodeAt(0) - 55;
        else if (char === '<') val = 0;
        
        sum += val * weights[i % 3];
    }
    return sum % 10;
  }

  function extractMRZLines(text) {
    if (!text) return [];

    const lines = text
        .split(/\r?\n/)
        .map(line => {
            return line
                .toUpperCase()
                .replace(/\s+/g, '')
                .replace(/[|]/g, 'I')
                .replace(/[«‹>]/g, '<')
                .replace(/[^A-Z0-9<]/g, '');
        })
        .filter(line => line.length >= 25);

    // Tìm 3 dòng MRZ liên tiếp
    for (let i = 0; i < lines.length - 2; i++) {
        const a = lines[i];
        const b = lines[i + 1];
        const c = lines[i + 2];

        // Dòng 1: bắt đầu ID + mã quốc gia. CCCD checksum
        const line1Valid = /^I[A-Z]<[A-Z]{3}/.test(a) || /^I<[A-Z]{3}/.test(a) || /^ID[A-Z]{3}/.test(a);
        
        // Dòng 2: YYMMDD + check + gender + ...
        const line2Valid = /^\d{6}\d[MF<]/.test(b);

        // Dòng 3: tên
        const line3Valid = /^[A-Z<]+$/.test(c) && c.includes('<');

        if (line1Valid && line2Valid && line3Valid) {
            // Checksum validate
            const dobStr = b.substring(0, 6);
            const dobCheck = parseInt(b.charAt(6), 10);
            if (calculateICAOChecksum(dobStr) !== dobCheck) {
                console.warn("MRZ DOB Checksum failed", dobStr);
                continue;
            }

            return [a, b, c];
        }
    }

    return [];
  }

  function parseMRZDate(value) {
    if (!/^\d{6}$/.test(value)) return '';
    const yy = parseInt(value.substring(0, 2), 10);
    const mm = parseInt(value.substring(2, 4), 10);
    const dd = parseInt(value.substring(4, 6), 10);

    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';

    const currentYear = new Date().getFullYear();
    let year = 2000 + yy;

    // Validate using age 14 to 100
    let age = currentYear - year;
    if (age < 14 || age > 100) {
        year = 1900 + yy;
        age = currentYear - year;
        if (age < 14 || age > 100) {
            return ''; // Still invalid
        }
    }

    const date = new Date(year, mm - 1, dd);
    if (date.getFullYear() !== year || date.getMonth() !== mm - 1 || date.getDate() !== dd) return '';

    return [year, String(mm).padStart(2, '0'), String(dd).padStart(2, '0')].join('-');
  }

  function parseMRZName(line) {
    if (!line) return '';
    let name = line.replace(/</g, ' ').replace(/\s+/g, ' ').trim();
    name = name.replace(/[^A-Z\s]/g, '');
    return name || '';
  }

  function parseResidence(backText, data) {
    if (!backText) return;
    const lines = backText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
        const normalized = lines[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalized.includes('cu tru') || normalized.includes('thuong tru') || normalized.includes('residence')) {
            let address = lines[i];
            const colonIndex = address.indexOf(':');
            if (colonIndex >= 0) address = address.substring(colonIndex + 1).trim();

            if (i + 1 < lines.length && lines[i + 1].length > 5) {
                // Ignore if it looks like an MRZ line
                if (!/[A-Z0-9<]{15,}/.test(lines[i + 1])) {
                    address += ' ' + lines[i + 1];
                }
            }

            address = address.replace(/[|<>]+/g, ' ').replace(/\s+/g, ' ').trim();
            if (address.length > 5) {
                data.placeOfResidence = address;
                return;
            }
        }
    }
  }

  function namesAreEquivalent(name1, name2) {
    if (!name1 || !name2) return false;
    const n1 = removeVietnameseTones(name1).toUpperCase().replace(/[^A-Z]/g, '');
    const n2 = removeVietnameseTones(name2).toUpperCase().replace(/[^A-Z]/g, '');
    return n1 === n2;
  }

  function validateOCRData(data) {
    // 1. Cross-check CCCD
    if (data.cccd && data.cccdMRZ) {
        if (data.cccd !== data.cccdMRZ) {
            console.warn('⚠️ CCCD không khớp giữa mặt trước và MRZ:', data.cccd, 'vs', data.cccdMRZ);
            data.cccd = ''; // Xóa để người dùng tự điền/kiểm tra
            showToast('Cảnh báo: Số CCCD không khớp giữa mặt trước và MRZ. Vui lòng kiểm tra lại!', 'warning');
        }
    } else if (data.cccdMRZ && !data.cccd) {
        data.cccd = data.cccdMRZ;
    }

    if (data.cccd && !/^\d{12}$/.test(data.cccd)) {
        console.warn('CCCD không hợp lệ:', data.cccd);
        data.cccd = '';
    }

    // 2. Validate Date of Birth
    if (data.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)) {
        console.warn('Ngày sinh không hợp lệ:', data.dateOfBirth);
        data.dateOfBirth = '';
    } else if (data.dateOfBirth) {
        // Validate age
        const birthYear = parseInt(data.dateOfBirth.substring(0, 4), 10);
        const age = new Date().getFullYear() - birthYear;
        if (age < 14 || age > 100) {
            console.warn('Tuổi không hợp lệ:', age);
            data.dateOfBirth = '';
        }
    }

    if (data.gender !== 'Nam' && data.gender !== 'Nữ') {
        data.gender = '';
    }

    // 3. Cross-check Names
    if (data.fullNameVN && data.fullNameEN) {
        if (!namesAreEquivalent(data.fullNameVN, data.fullNameEN)) {
            console.warn('⚠️ Tên không khớp giữa mặt trước và MRZ:', data.fullNameVN, 'vs', data.fullNameEN);
            showToast('Cảnh báo: Họ tên không khớp giữa mặt trước và MRZ.', 'warning');
        }
    }

    if (data.fullNameVN) {
        data.fullNameVN = data.fullNameVN.replace(/\s+/g, ' ').trim();
    }
    if (data.fullNameEN) {
        data.fullNameEN = data.fullNameEN.replace(/\s+/g, ' ').trim().toUpperCase();
    }
  }

  function removeVietnameseTones(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }

  function setOCRField(id, value) {
    const el = document.getElementById(id);
    if (!el || value === undefined || value === null || value === '') {
        return false;
    }

    if (el.tagName === 'SELECT') {
        const option = [...el.options].find(opt => opt.value === value);
        if (!option) {
            console.warn(`OCR: Không tìm thấy option "${value}" trong #${id}`);
            return false;
        }
    }

    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    el.classList.remove('ocr-filled');
    void el.offsetWidth;
    el.classList.add('ocr-filled');

    return true;
  }

  function fillOCRData(data) {
    let nameEN = data.fullNameEN;
    if (!nameEN && data.fullNameVN) {
        nameEN = removeVietnameseTones(data.fullNameVN).toUpperCase();
    }

    const map = {
        soCCCD: data.cccd,
        idHrm: data.cccd,
        hoTenVN: data.fullNameVN,
        hoTenEN: nameEN,
        ngaySinh: data.dateOfBirth,
        gioiTinh: data.gender,
        quocTich: data.nationality,
        diaChiThuongTru: data.placeOfResidence,
        ngayCapCCCD: data.personalIdentificationDate,
        noiCapCCCD: data.issuePlace
    };

    let count = 0;
    for (const [id, value] of Object.entries(map)) {
        if (setOCRField(id, value)) {
            count++;
        }
    }

    const countEl = document.getElementById('ocrSuccessCount');
    if (countEl) {
        countEl.textContent = count;
    }

    return count;
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    initStepIndicator();
    initFormNavigation();
    initUploadZones();
    initToggles();
    initAutoConvert();
    initTableView();
    initSettings();
    updateStats();
    showStep(1);
    updateSettingsStatus();
    setupOCR();
  });

  // ============================================
  // AUTHENTICATION
  // ============================================
  function initAuth() {
    applyAuthState();

    const loginBtn = $('#loginBtn');
    const logoutBtn = $('#logoutBtn');
    const submitLoginBtn = $('#submitLoginBtn');
    const pinInput = $('#loginPinInput');

    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        $('#loginModal').classList.add('active');
        document.body.style.overflow = 'hidden';
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        isAdmin = false;
        sessionStorage.removeItem('isAdmin');
        applyAuthState();
        
        // Force back to form view
        $$('.nav-item').forEach((t) => t.classList.remove('active'));
        if ($$('.nav-item')[0]) $$('.nav-item')[0].classList.add('active');
        $('#formView').classList.remove('hidden', 'hidden-view');
        $('#tableView').classList.add('hidden');
        
        showToast('Đã đăng xuất khỏi tài khoản Quản trị viên.', 'info');
      });
    }

    if (submitLoginBtn && pinInput) {
      const handleLogin = () => {
        if (pinInput.value === ADMIN_PIN) {
          isAdmin = true;
          sessionStorage.setItem('isAdmin', 'true');
          applyAuthState();
          closeLoginModal();
          showToast('Đăng nhập thành công! Bạn có quyền Quản trị viên.', 'success');
        } else {
          showToast('Mã PIN không đúng!', 'error');
          pinInput.value = '';
          pinInput.focus();
        }
      };

      submitLoginBtn.addEventListener('click', handleLogin);
      pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    }
  }

  function applyAuthState() {
    const roleText = $('#displayRoleName');
    if (isAdmin) {
      document.body.classList.add('is-admin');
      if (roleText) roleText.textContent = 'Administrator';
    } else {
      document.body.classList.remove('is-admin');
      if (roleText) roleText.textContent = 'Guest User';
    }
  }

  function closeLoginModal() {
    const modal = $('#loginModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  window.closeLoginModal = closeLoginModal;

  // ============================================
  // SETTINGS (Google Script URL)
  // ============================================
  function initSettings() {
    const settingsBtn = $('#settingsBtn');
    const settingsModal = $('#settingsModal');
    const saveSettingsBtn = $('#saveSettings');
    const scriptUrlInput = $('#scriptUrl');

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (scriptUrlInput) scriptUrlInput.value = SCRIPT_URL;
        if (settingsModal) settingsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        const url = scriptUrlInput ? scriptUrlInput.value.trim() : '';
        SCRIPT_URL = url;
        localStorage.setItem('googleScriptUrl', url);

        // Update PIN if provided
        const pinInput = $('#adminPin');
        if (pinInput && pinInput.value.trim()) {
          ADMIN_PIN = pinInput.value.trim();
          localStorage.setItem('adminPin', ADMIN_PIN);
          showToast('Đã cập nhật mã PIN mới và URL!', 'success');
          pinInput.value = ''; // clear it
        } else {
          if (url) {
            showToast('Đã lưu URL Google Apps Script!', 'success');
          } else {
            showToast('Đã xóa URL. Dữ liệu chỉ lưu local.', 'info');
          }
        }

        closeSettingsModal();
        updateSettingsStatus();

        if (url) {
          testConnection(url);
        }
      });
    }
  }

  function closeSettingsModal() {
    const modal = $('#settingsModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  window.closeSettingsModal = closeSettingsModal;

  function updateSettingsStatus() {
    const indicator = $('#connectionStatus');
    if (!indicator) return;

    if (SCRIPT_URL) {
      indicator.className = 'status-dot connected';
      indicator.title = 'Đã kết nối Google Sheets';
    } else {
      indicator.className = 'status-dot disconnected';
      indicator.title = 'Chưa kết nối Google Sheets';
    }
  }

  async function testConnection(url) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (res.ok) {
        showToast('✅ Kết nối Google Apps Script thành công!', 'success');
      }
    } catch {
      showToast('Không thể kiểm tra kết nối (có thể do CORS). Thử gửi dữ liệu để xác nhận.', 'info');
    }
  }

  // ============================================
  // NAVIGATION (Form vs Table)
  // ============================================
  function initNavigation() {
    $$('.nav-item').forEach((tab) => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;

        // Prevent non-admins from entering table view
        if (view === 'table' && !isAdmin) {
          showToast('Chỉ Quản trị viên mới được xem Danh sách!', 'error');
          return;
        }

        $$('.nav-item').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        if (view === 'form') {
          $('#formView').classList.remove('hidden', 'hidden-view');
          $('#tableView').classList.add('hidden', 'hidden-view');
        } else if (view === 'table') {
          $('#formView').classList.add('hidden', 'hidden-view');
          $('#tableView').classList.remove('hidden', 'hidden-view');
          renderTable(); // Re-render when switching to table
        }
      });
    });
  }

  // ============================================
  // STEP INDICATOR
  // ============================================
  function initStepIndicator() {
    $$('.step-item').forEach((item) => {
      item.addEventListener('click', () => {
        const step = parseInt(item.dataset.step);
        if (step <= currentStep || validateStepsUpTo(step - 1)) {
          showStep(step);
        }
      });
    });
  }

  function showStep(step) {
    currentStep = step;

    $$('.step-item').forEach((item) => {
      const s = parseInt(item.dataset.step);
      item.classList.remove('active', 'completed');
      if (s === step) item.classList.add('active');
      else if (s < step) item.classList.add('completed');
    });

    $$('.form-step').forEach((fs) => {
      fs.classList.remove('active');
      if (parseInt(fs.dataset.step) === step) {
        fs.classList.add('active');
      }
    });

    window.scrollTo({ top: 200, behavior: 'smooth' });
  }

  function validateStepsUpTo(step) {
    for (let s = 1; s <= step; s++) {
      const formStep = $(`.form-step[data-step="${s}"]`);
      if (!formStep) continue;
      const requiredFields = formStep.querySelectorAll('[required]');
      for (const field of requiredFields) {
        if (!field.value.trim()) {
          showToast(`Vui lòng điền đầy đủ thông tin ở Bước ${s}`, 'error');
          showStep(s);
          field.focus();
          return false;
        }
      }
    }
    return true;
  }

  // ============================================
  // FORM NAVIGATION (Prev/Next/Submit)
  // ============================================
  function initFormNavigation() {
    $$('.btn-next').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.closest('.form-step').dataset.step);
        if (validateCurrentStep(step)) {
          showStep(step + 1);
        }
      });
    });

    $$('.btn-prev').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.closest('.form-step').dataset.step);
        showStep(step - 1);
      });
    });

    const submitBtn = $('#btnSubmit');
    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmit);
    }
  }

  function validateCurrentStep(step) {
    const formStep = $(`.form-step[data-step="${step}"]`);
    if (!formStep) return true;

    const requiredFields = formStep.querySelectorAll('[required]');
    for (const field of requiredFields) {
      if (!field.value.trim()) {
        field.classList.add('error');
        field.focus();
        showToast('Vui lòng điền đầy đủ các trường bắt buộc', 'error');
        setTimeout(() => field.classList.remove('error'), 3000);
        return false;
      }
    }

    if (step === 1) {
      const cccd = $('#soCCCD');
      if (cccd && cccd.value && !/^\d{12}$/.test(cccd.value)) {
        cccd.classList.add('error');
        cccd.focus();
        showToast('Số CCCD phải gồm 12 chữ số', 'error');
        setTimeout(() => cccd.classList.remove('error'), 3000);
        return false;
      }

      const phone = $('#dienThoai');
      if (phone && phone.value && !/^0\d{9,10}$/.test(phone.value)) {
        phone.classList.add('error');
        phone.focus();
        showToast('Số điện thoại không hợp lệ (VD: 0xxxxxxxxx)', 'error');
        setTimeout(() => phone.classList.remove('error'), 3000);
        return false;
      }
    }

    if (step === 2) {
      if (!imageData['anhCCCDTruoc']) {
        showToast('Vui lòng tải lên Ảnh CCCD mặt trước (bắt buộc)', 'error');
        return false;
      }
      if (!imageData['anhCCCDSau']) {
        showToast('Vui lòng tải lên Ảnh CCCD mặt sau (bắt buộc)', 'error');
        return false;
      }
    }

    if (step === 4) {
      if (!imageData['anhVNeID2']) {
        showToast('Vui lòng tải lên Ảnh VNeID mức 2 (bắt buộc)', 'error');
        return false;
      }
      if (!imageData['anhVNeIDChuHo']) {
        showToast('Vui lòng tải lên Ảnh Chủ hộ VNeID (bắt buộc)', 'error');
        return false;
      }
      if (!imageData['anhVNeIDMQH']) {
        showToast('Vui lòng tải lên Ảnh VNeID thể hiện mối quan hệ (bắt buộc)', 'error');
        return false;
      }
    }

    return true;
  }

  // ============================================
  // IMAGE COMPRESSION (resize trước khi gửi)
  // ============================================
  function compressImage(base64Data, maxWidth = 1600, quality = 0.82) {
    return new Promise((resolve) => {
      // If it's a PDF, don't compress
      if (base64Data.startsWith('data:application/pdf')) {
        resolve(base64Data);
        return;
      }

      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        // Only resize if larger than maxWidth
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(base64Data); // Fallback to original
      img.src = base64Data;
    });
  }

  // ============================================
  // FORM SUBMIT — Google Sheets + Drive
  // ============================================
  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate all steps
    if (!validateStepsUpTo(totalSteps)) return;

    const record = collectFormData();
    record.createdAt = new Date().toISOString();
    record.status = 'Đã nhập';

    // Save locally first
    if (editingIndex >= 0) {
      records[editingIndex] = { ...records[editingIndex], ...record, updatedAt: new Date().toISOString() };
      editingIndex = -1;
    } else {
      records.push(record);
    }
    saveRecords();
    updateStats();

    // If Google Script URL is configured, send to Google
    if (SCRIPT_URL) {
      await submitToGoogle(record);
    } else {
      showToast('Đã lưu local! Hãy cài đặt Google Apps Script URL để đồng bộ lên Google Sheets.', 'warning');
    }

    resetForm();
    showStep(1);
  }

  async function submitToGoogle(record) {
    isSubmitting = true;
    showLoading(true);

    try {
      // Compress images before sending
      showLoadingMessage('Đang nén ảnh...');
      const imageFields = ['anhSMS', 'anhCCCDTruoc', 'anhCCCDSau', 'anhVNeID2', 'anhVNeIDChuHo', 'anhVNeIDMQH'];
      const payload = { ...record };

      for (const field of imageFields) {
        if (payload[field] && payload[field].startsWith('data:')) {
          payload[field] = await compressImage(payload[field]);
        }
      }

      showLoadingMessage('Đang gửi dữ liệu lên Google Sheets...');

      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
      }

      const resultText = await response.text();
      let result;
      try {
          result = JSON.parse(resultText);
      } catch {
          // Response is not JSON
          throw new Error('Server không trả về JSON hợp lệ.');
      }

      if (result.status === 'success') {
          showToast('✅ Dữ liệu đã được lưu lên Google Sheets thành công!', 'success');
      } else {
          showToast('⚠️ Lỗi từ server: ' + (result.message || 'Không xác định'), 'error');
          throw new Error('Server báo lỗi');
      }
    } catch (error) {
      console.error('Submit error:', error);

      // Try no-cors as fallback
      try {
        showLoadingMessage('Đang thử gửi lại...');
        await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(record),
        });
        showToast('Đã gửi dữ liệu (không thể xác nhận phản hồi). Vui lòng kiểm tra Google Sheets.', 'info');
      } catch (fallbackError) {
        showToast('❌ Không thể kết nối Google Sheets. Dữ liệu đã lưu local.', 'error');
        console.error('Fallback error:', fallbackError);
      }
    } finally {
      isSubmitting = false;
      showLoading(false);
    }
  }

  // ============================================
  // LOADING OVERLAY
  function showLoading(show = true) {
    if (show) {
      if (!$('.loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
          <img src="assets/mascot.png" alt="Loading" class="loading-character" style="max-height: 120px; object-fit: contain;">
          <div class="loading-bar-container">
            <div class="loading-bar"></div>
          </div>
          <div class="loading-text" id="loadingMessage">Đang tải...</div>
        `;
        document.body.appendChild(overlay);
      }
    } else {
      const overlay = $('.loading-overlay');
      if (overlay) overlay.remove();
    }
  }

  function showLoadingMessage(msg) {
    const el = $('#loadingMessage');
    if (el) el.textContent = msg;
  }

  // ============================================
  // COLLECT FORM DATA
  // ============================================
  function collectFormData() {
    return {
      maOps: val('maOps'),
      idHrm: val('idHrm'),
      hoTenVN: val('hoTenVN'),
      hoTenEN: val('hoTenEN'),
      quocTich: val('quocTich'),
      gioiTinh: val('gioiTinh'),
      ngaySinh: val('ngaySinh'),
      soCCCD: val('soCCCD'),
      ngayCapCCCD: val('ngayCapCCCD'),
      noiCapCCCD: val('noiCapCCCD'),
      diaChiThuongTru: val('diaChiThuongTru'),
      dienThoai: val('dienThoai'),
      email: val('email'),

      anhSMS: imageData['anhSMS'] || '',
      anhCCCDTruoc: imageData['anhCCCDTruoc'] || '',
      anhCCCDSau: imageData['anhCCCDSau'] || '',

      soTaiKhoan1: val('soTaiKhoan1'),
      chuTaiKhoan1: val('chuTaiKhoan1'),
      tenNganHang1: val('tenNganHang1'),
      chinhChu: $('#chinhChu') ? ($('#chinhChu').checked ? 'Yes' : 'No') : 'Yes',


      anhVNeID2: imageData['anhVNeID2'] || '',
      anhVNeIDChuHo: imageData['anhVNeIDChuHo'] || '',
      anhVNeIDMQH: imageData['anhVNeIDMQH'] || '',
    };
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function resetForm() {
    const form = $('#entryForm');
    if (form) form.reset();

    $$('.image-preview-container').forEach((c) => (c.style.display = 'none'));
    $$('.upload-zone').forEach((z) => (z.style.display = 'flex'));
    imageData = {};

    const chinhChu = $('#chinhChu');
    if (chinhChu) chinhChu.checked = true;
    const uyQuyen = $('#uyQuyen');
    if (uyQuyen) {
      uyQuyen.checked = false;
      toggleAuthSection(false);
    }
    const checkUQ = $('#checkUyQuyen');
    if (checkUQ) checkUQ.checked = false;

    // Reset toggle labels
    $$('.toggle-label-text').forEach((label) => {
      const checkbox = label.closest('.toggle-wrapper')?.querySelector('input[type="checkbox"]');
      if (checkbox) label.textContent = checkbox.checked ? 'Yes' : 'No';
    });

    editingIndex = -1;
  }

  // ============================================
  // IMAGE UPLOAD
  // ============================================
  function initUploadZones() {
    $$('.upload-zone').forEach((zone) => {
      const fileInput = zone.querySelector('input[type="file"]');
      const field = zone.dataset.field;
      const parent = zone.closest('.upload-item') || zone.parentElement;
      const previewContainer = parent ? parent.querySelector('.image-preview-container') : null;

      zone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') fileInput.click();
      });

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileUpload(files[0], field, zone, previewContainer);
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleFileUpload(e.target.files[0], field, zone, previewContainer);
        }
      });

      if (previewContainer) {
        const removeBtn = previewContainer.querySelector('.remove-image-btn');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            delete imageData[field];
            previewContainer.style.display = 'none';
            zone.style.display = 'flex';
            fileInput.value = '';
          });
        }
      }
    });
  }

  function handleFileUpload(file, field, zone, previewContainer) {
    if (file.size > 5 * 1024 * 1024) {
      showToast('File quá lớn. Tối đa 5MB.', 'error');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Chỉ chấp nhận file ảnh (PNG, JPG) hoặc PDF.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      imageData[field] = e.target.result;

      if (previewContainer) {
        const img = previewContainer.querySelector('.image-preview');
        if (img) {
          if (file.type === 'application/pdf') {
            img.src = '';
            img.style.display = 'none';
            let pdfLabel = previewContainer.querySelector('.pdf-label');
            if (!pdfLabel) {
              pdfLabel = document.createElement('div');
              pdfLabel.className = 'pdf-label';
              pdfLabel.style.cssText = 'display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;color:var(--text-secondary);';
              pdfLabel.innerHTML = '<span style="font-size:48px">📄</span><span>' + file.name + '</span>';
              previewContainer.insertBefore(pdfLabel, previewContainer.querySelector('.remove-image-btn'));
            }
          } else {
            img.src = e.target.result;
            img.style.display = 'block';
            const pdfLabel = previewContainer.querySelector('.pdf-label');
            if (pdfLabel) pdfLabel.remove();
          }
        }
        previewContainer.style.display = 'flex';
        zone.style.display = 'none';
      }

      showToast('Tải ảnh thành công!', 'info');
    };
    reader.readAsDataURL(file);
  }

  // ============================================
  // TOGGLE SWITCHES
  // ============================================
  function initToggles() {
    const uyQuyenToggle = $('#uyQuyen');
    if (uyQuyenToggle) {
      uyQuyenToggle.addEventListener('change', () => {
        toggleAuthSection(uyQuyenToggle.checked);
        updateToggleLabel(uyQuyenToggle);
      });
    }

    $$('.toggle-switch input[type="checkbox"]').forEach((toggle) => {
      toggle.addEventListener('change', () => updateToggleLabel(toggle));
    });
  }

  function updateToggleLabel(checkbox) {
    const wrapper = checkbox.closest('.toggle-wrapper');
    if (wrapper) {
      const label = wrapper.querySelector('.toggle-label-text');
      if (label) label.textContent = checkbox.checked ? 'Yes' : 'No';
    }
  }

  function toggleAuthSection(show) {
    const authSection = $('#authSection');
    if (authSection) {
      if (show) {
        authSection.classList.remove('disabled');
        authSection.style.maxHeight = authSection.scrollHeight + 200 + 'px';
        authSection.style.opacity = '1';
        authSection.style.pointerEvents = 'auto';
      } else {
        authSection.classList.add('disabled');
        authSection.style.maxHeight = '0';
        authSection.style.opacity = '0';
        authSection.style.pointerEvents = 'none';
      }
    }
  }

  // ============================================
  // AUTO CONVERT (VN name -> EN name)
  // ============================================
  function initAutoConvert() {
    const hoTenVN = $('#hoTenVN');
    const hoTenEN = $('#hoTenEN');
    if (hoTenVN && hoTenEN) {
      hoTenVN.addEventListener('input', () => {
        if (!hoTenEN.dataset.manual) {
          hoTenEN.value = removeVietnameseTones(hoTenVN.value).toUpperCase();
        }
      });
      hoTenEN.addEventListener('input', () => {
        hoTenEN.dataset.manual = 'true';
      });
    }

    const chuTK1 = $('#chuTaiKhoan1');
    if (hoTenVN && chuTK1) {
      hoTenVN.addEventListener('input', () => {
        if (!chuTK1.dataset.manual) {
          chuTK1.value = removeVietnameseTones(hoTenVN.value).toUpperCase();
        }
      });
      chuTK1.addEventListener('input', () => {
        chuTK1.dataset.manual = 'true';
      });
    }
  }

  function removeVietnameseTones(str) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  // ============================================
  // TABLE VIEW
  // ============================================
  function initTableView() {
    const searchBox = $('#searchBox');
    if (searchBox) {
      searchBox.addEventListener('input', () => {
        renderTable(searchBox.value.trim().toLowerCase());
      });
    }

    const exportBtn = $('#btnExport');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportToCSV);
    }

    renderTable();
  }

  function renderTable(filter = '') {
    const tbody = $('#tableBody');
    const emptyState = $('#emptyState');
    if (!tbody) return;

    const filtered = filter
      ? records.filter(
          (r) =>
            (r.maOps || '').toLowerCase().includes(filter) ||
            (r.hoTenVN || '').toLowerCase().includes(filter) ||
            (r.soCCCD || '').includes(filter) ||
            (r.dienThoai || '').includes(filter) ||
            (r.idHrm || '').toLowerCase().includes(filter)
        )
      : records;

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach((record, idx) => {
      const realIndex = records.indexOf(record);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${esc(record.maOps)}</strong></td>
        <td>${esc(record.idHrm)}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="${record.gioiTinh === 'Nam' ? 'avatar-male' : 'avatar-female'}" style="width: 32px; height: 32px; flex-shrink: 0;"></div>
            ${esc(record.hoTenVN)}
          </div>
        </td>
        <td>${esc(record.soCCCD)}</td>
        <td>${esc(record.dienThoai)}</td>
        <td>${esc(record.tenNganHang1)}</td>
        <td>${formatDate(record.ngayVaoLam)}</td>
        <td><span class="badge ${record.ngayNghiViec ? 'badge-danger' : 'badge-success'}">${record.ngayNghiViec ? 'Đã nghỉ' : 'Đang làm'}</span></td>
        <td class="table-actions">
          <button class="btn btn-icon btn-view" data-index="${realIndex}" title="Xem chi tiết">👁️</button>
          <button class="btn btn-icon btn-edit" data-index="${realIndex}" title="Chỉnh sửa">✏️</button>
          <button class="btn btn-icon btn-delete" data-index="${realIndex}" title="Xóa">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-view').forEach((btn) => {
      btn.addEventListener('click', () => viewRecord(parseInt(btn.dataset.index)));
    });
    tbody.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', () => editRecord(parseInt(btn.dataset.index)));
    });
    tbody.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', () => deleteRecord(parseInt(btn.dataset.index)));
    });
  }

  function viewRecord(index) {
    const r = records[index];
    if (!r) return;

    const modalBody = $('#modalBody');
    if (!modalBody) return;

    let avatarClass = 'avatar-female';
    if (r.gioiTinh === 'Nam') avatarClass = 'avatar-male';

    modalBody.innerHTML = `
      <div class="modal-record">
        <div style="display: flex; justify-content: center; margin-bottom: 1.5rem;">
          <div class="${avatarClass}" style="width: 80px; height: 80px;"></div>
        </div>
        <h3>Thông tin cá nhân</h3>
        <div class="modal-grid">
          ${modalField('Mã OPS', r.maOps)}
          ${modalField('ID HRM', r.idHrm)}
          ${modalField('Họ tên VN', r.hoTenVN)}
          ${modalField('Họ tên EN', r.hoTenEN)}
          ${modalField('Quốc tịch', r.quocTich)}
          ${modalField('Giới tính', r.gioiTinh)}
          ${modalField('Ngày sinh', formatDate(r.ngaySinh))}
          ${modalField('Số CCCD', r.soCCCD)}
          ${modalField('Ngày cấp CCCD', formatDate(r.ngayCapCCCD))}
          ${modalField('Nơi cấp CCCD', r.noiCapCCCD)}
          ${modalField('Địa chỉ thường trú', r.diaChiThuongTru)}
          ${modalField('Điện thoại', r.dienThoai)}
          ${modalField('Email', r.email)}
        </div>

        <h3>Tài khoản ngân hàng</h3>
        <div class="modal-grid">
          ${modalField('Số TK chính', r.soTaiKhoan1)}
          ${modalField('Chủ TK chính', r.chuTaiKhoan1)}
          ${modalField('Ngân hàng chính', r.tenNganHang1)}
          ${modalField('Chính chủ', r.chinhChu ? 'Yes' : 'No')}
          ${r.soTaiKhoan2 ? modalField('Số TK phụ', r.soTaiKhoan2) : ''}
          ${r.chuTaiKhoan2 ? modalField('Chủ TK phụ', r.chuTaiKhoan2) : ''}
          ${r.tenNganHang2 ? modalField('Ngân hàng phụ', r.tenNganHang2) : ''}
        </div>

        ${
          r.uyQuyen
            ? `
          <h3>Thông tin ủy quyền</h3>
          <div class="modal-grid">
            ${modalField('Ủy quyền', 'Yes')}
            ${modalField('Check ủy quyền', r.checkUyQuyen ? 'Yes' : 'No')}
            ${modalField('Họ tên NĐ ủy quyền', r.hoTenNguoiUQ)}
            ${modalField('CCCD NĐ ủy quyền', r.soCCCDNguoiUQ)}
            ${modalField('Mối quan hệ', r.moiQuanHe)}
            ${modalField('ĐT NĐ ủy quyền', r.dienThoaiNguoiUQ)}
          </div>
        `
            : ''
        }

        <h3>Thông tin bổ sung</h3>
        <div class="modal-grid">
          ${modalField('Ngày vào làm', formatDate(r.ngayVaoLam))}
          ${modalField('Ngày nghỉ việc', formatDate(r.ngayNghiViec))}
          ${modalField('Dân tộc', r.danToc)}
          ${modalField('Ghi chú', r.ghiChu)}
        </div>
      </div>
    `;

    openModal();
  }

  function modalField(label, value) {
    return `<div class="modal-field"><span class="modal-label">${label}</span><span class="modal-value">${esc(value || '—')}</span></div>`;
  }

  function editRecord(index) {
    const r = records[index];
    if (!r) return;

    editingIndex = index;

    $$('.nav-tab').forEach((t) => t.classList.remove('active'));
    $$('.nav-tab')[0].classList.add('active');
    $('#formView').classList.remove('hidden');
    $('#tableView').classList.add('hidden');

    const fields = [
      'maOps', 'idHrm', 'hoTenVN', 'hoTenEN', 'quocTich', 'gioiTinh',
      'ngaySinh', 'soCCCD', 'ngayCapCCCD', 'noiCapCCCD', 'diaChiThuongTru',
      'dienThoai', 'email', 'soTaiKhoan1', 'chuTaiKhoan1', 'tenNganHang1',
      'soTaiKhoan2', 'chuTaiKhoan2', 'tenNganHang2', 'hoTenNguoiUQ',
      'soCCCDNguoiUQ', 'moiQuanHe', 'dienThoaiNguoiUQ', 'ngayVaoLam',
      'ngayNghiViec', 'danToc', 'ghiChu',
    ];

    fields.forEach((f) => {
      const el = document.getElementById(f);
      if (el && r[f] !== undefined) el.value = r[f];
    });

    if ($('#chinhChu')) $('#chinhChu').checked = r.chinhChu !== false;
    if ($('#uyQuyen')) {
      $('#uyQuyen').checked = !!r.uyQuyen;
      toggleAuthSection(!!r.uyQuyen);
    }
    if ($('#checkUyQuyen')) $('#checkUyQuyen').checked = !!r.checkUyQuyen;

    // Update toggle labels
    $$('.toggle-switch input[type="checkbox"]').forEach((t) => updateToggleLabel(t));

    // Restore images
    const imageFields = ['anhSMS', 'anhCCCDTruoc', 'anhCCCDSau', 'anhSMSUQ', 'anhCCCDUQ', 'anhVNeID2', 'anhVNeIDChuHo', 'anhVNeIDMQH'];
    imageFields.forEach((f) => {
      if (r[f]) {
        imageData[f] = r[f];
        const zone = $(`.upload-zone[data-field="${f}"]`);
        if (zone) {
          const parent = zone.closest('.upload-item') || zone.parentElement;
          const previewContainer = parent ? parent.querySelector('.image-preview-container') : null;
          if (previewContainer) {
            const img = previewContainer.querySelector('.image-preview');
            if (img) {
              img.src = r[f];
              img.style.display = 'block';
            }
            previewContainer.style.display = 'flex';
            zone.style.display = 'none';
          }
        }
      }
    });

    showStep(1);
    showToast('Đang chỉnh sửa thông tin ứng viên', 'info');
  }

  function deleteRecord(index) {
    if (!confirm('Bạn có chắc chắn muốn xóa ứng viên này?')) return;

    records.splice(index, 1);
    saveRecords();
    updateStats();
    renderTable();
    showToast('Đã xóa ứng viên', 'info');
  }

  // ============================================
  // EXPORT TO CSV
  // ============================================
  function exportToCSV() {
    if (records.length === 0) {
      showToast('Chưa có dữ liệu để xuất', 'error');
      return;
    }

    const headers = [
      'STT', 'Mã OPS', 'ID HRM', 'Họ tên VN', 'Họ tên EN', 'Quốc tịch',
      'Giới tính', 'Ngày sinh', 'Số CCCD', 'Ngày cấp CCCD', 'Nơi cấp CCCD',
      'Địa chỉ thường trú', 'Điện thoại', 'Email',
      'Số TK chính', 'Chủ TK chính', 'Ngân hàng chính', 'Chính chủ',
      'Số TK phụ', 'Chủ TK phụ', 'Ngân hàng phụ',
      'Ủy quyền', 'Check ủy quyền', 'Họ tên NĐ ủy quyền',
      'CCCD NĐ ủy quyền', 'Mối quan hệ', 'ĐT NĐ ủy quyền',
      'Ngày vào làm', 'Ngày nghỉ việc', 'Dân tộc', 'Ghi chú',
    ];

    const rows = records.map((r, i) => [
      i + 1, r.maOps, r.idHrm, r.hoTenVN, r.hoTenEN, r.quocTich,
      r.gioiTinh, formatDate(r.ngaySinh), r.soCCCD, formatDate(r.ngayCapCCCD),
      r.noiCapCCCD, r.diaChiThuongTru, r.dienThoai, r.email,
      r.soTaiKhoan1, r.chuTaiKhoan1, r.tenNganHang1, r.chinhChu ? 'Yes' : 'No',
      r.soTaiKhoan2, r.chuTaiKhoan2, r.tenNganHang2,
      r.uyQuyen ? 'Yes' : 'No', r.checkUyQuyen ? 'Yes' : 'No',
      r.hoTenNguoiUQ, r.soCCCDNguoiUQ, r.moiQuanHe, r.dienThoaiNguoiUQ,
      formatDate(r.ngayVaoLam), formatDate(r.ngayNghiViec), r.danToc, r.ghiChu,
    ]);

    let csv = '\uFEFF' + headers.map(csvEscape).join(',') + '\n';
    rows.forEach((row) => {
      csv += row.map(csvEscape).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `danh_sach_ung_vien_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('Xuất file CSV thành công!', 'success');
  }

  function csvEscape(val) {
    if (val === null || val === undefined) return '""';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return '"' + s + '"';
  }

  // ============================================
  // MODAL
  // ============================================
  function openModal() {
    const modal = $('#recordModal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  window.closeModal = function () {
    const modal = $('#recordModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
      if (e.target.id === 'recordModal') window.closeModal();
      if (e.target.id === 'settingsModal') closeSettingsModal();
      if (e.target.id === 'loginModal') closeLoginModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeModal();
      closeSettingsModal();
      closeLoginModal();
    }
  });

  // ============================================
  // TOAST NOTIFICATIONS
  // ============================================
  function showToast(message, type = 'info') {
    const container = $('#toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ============================================
  // STATS
  // ============================================
  function updateStats() {
    const total = $('#totalCount');
    const today = $('#todayCount');
    const pending = $('#pendingCount');

    if (total) total.textContent = records.length;

    if (today) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayRecords = records.filter((r) => r.createdAt && r.createdAt.startsWith(todayStr));
      today.textContent = todayRecords.length;
    }

    if (pending) {
      const pendingRecords = records.filter((r) => !r.ngayNghiViec);
      pending.textContent = pendingRecords.length;
    }
  }

  // ============================================
  // STORAGE
  // ============================================
  function saveRecords() {
    try {
      localStorage.setItem('employeeRecords', JSON.stringify(records));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        showToast('Bộ nhớ local đầy! Hãy xuất dữ liệu và xóa bớt.', 'error');
      }
    }
  }

  // ============================================
  // UTILITIES
  // ============================================
  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
})();
