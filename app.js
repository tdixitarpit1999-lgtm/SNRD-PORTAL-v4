import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.SNRD_CONFIG || {};
const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey &&
  !String(cfg.supabaseUrl).includes('YOUR-PROJECT') &&
  !String(cfg.supabaseAnonKey).includes('YOUR_SUPABASE'));
const supabase = configured ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let currentPage = 'overview';
let authReady = false;
let authEventBusy = false;

const titles = {
  overview: 'Dashboard', students: 'Students', teachers: 'Teachers',
  attendance: 'Attendance', exams: 'Exams & Results', fees: 'Fees',
  documents: 'Documents', reports: 'Reports', settings: 'Settings'
};
const roleLabel = {
  super_admin: 'Super Admin', office_admin: 'Office Admin',
  teacher: 'Teacher', parent: 'Parent / Family', student: 'Student'
};

function toast(msg) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  window.setTimeout(() => el.classList.remove('show'), 2800);
}
function showLogin(msg = '') {
  $('loginView')?.classList.remove('hidden');
  $('dashboardView')?.classList.add('hidden');
  $('logoutBtn')?.classList.add('hidden');
  $('sidebar')?.classList.remove('open');
  if ($('loginMessage')) $('loginMessage').textContent = msg;
}
function showDashboard() {
  $('loginView')?.classList.add('hidden');
  $('dashboardView')?.classList.remove('hidden');
  $('logoutBtn')?.classList.remove('hidden');
  $('previewPage')?.classList.add('hidden');
  $('previewDrawer')?.classList.remove('open');
  $('previewOverlay')?.classList.remove('show');
}
function safe(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function stat(label, value, icon, caption = '') {
  return `<article class="stat-card"><div class="stat-top"><span>${safe(label)}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${safe(value)}</div><div class="stat-caption">${safe(caption)}</div></article>`;
}
function empty(title, desc) {
  return `<div class="empty-card"><strong>${safe(title)}</strong>${safe(desc)}</div>`;
}

async function loadProfile(user) {
  const { data, error } = await supabase.from('user_profiles')
    .select('user_id,full_name,role,is_active').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) throw new Error('आपका सक्रिय User Profile नहीं मिला। School Admin से संपर्क करें।');
  return data;
}

async function doLogin(e) {
  e.preventDefault();
  if (!supabase) {
    $('loginMessage').textContent = 'Supabase configuration उपलब्ध नहीं है। School Admin से संपर्क करें।';
    return;
  }
  const btn = $('loginSubmit');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  $('loginMessage').textContent = '';
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $('email').value.trim(), password: $('password').value
    });
    if (error) throw error;
    currentUser = data.user;
    currentProfile = await loadProfile(data.user);
    await enterApp();
  } catch (err) {
    currentUser = null;
    currentProfile = null;
    showLogin(err.message || 'Login नहीं हो सका।');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login to Portal';
  }
}

async function enterApp() {
  if (!currentUser || !currentProfile) return;
  showDashboard();
  $('userName').textContent = currentProfile.full_name || currentUser.email || 'User';
  $('userRole').textContent = roleLabel[currentProfile.role] || currentProfile.role || 'User';
  $('userInitial').textContent = (currentProfile.full_name || 'S').trim().charAt(0).toUpperCase();
  $('welcomeText').textContent = `Welcome, ${currentProfile.full_name || 'User'}`;
  $('todayLabel').textContent = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date());
  applyRoleNavigation();
  await renderPage('overview');
}

function applyRoleNavigation() {
  const role = currentProfile?.role;
  document.querySelectorAll('.nav-item').forEach(b => {
    const page = b.dataset.page;
    let allowed = role === 'super_admin' || role === 'office_admin';
    if (role === 'teacher') allowed = ['overview', 'students', 'attendance', 'exams', 'documents'].includes(page);
    if (role === 'parent') allowed = ['overview', 'students', 'attendance', 'exams', 'fees', 'documents'].includes(page);
    if (role === 'student') allowed = ['overview', 'attendance', 'exams', 'documents'].includes(page);
    b.classList.toggle('hidden', !allowed);
  });
}

async function renderPage(page) {
  if (!currentProfile) return;
  currentPage = titles[page] ? page : 'overview';
  $('pageTitle').textContent = titles[currentPage];
  $('pageEyebrow').textContent = (currentProfile.role || '').replaceAll('_', ' ').toUpperCase();
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === currentPage));
  if (currentProfile.role === 'parent') {
    await renderParent(currentPage);
    return;
  }
  if (currentProfile.role === 'super_admin' || currentProfile.role === 'office_admin') {
    await renderAdmin(currentPage);
    return;
  }
  $('pageContent').innerHTML = empty('Dashboard access is being configured', 'आपके Role की table permissions और संबंधित सुविधाएँ अभी तैयार की जा रही हैं।');
}

async function renderAdmin(page) {
  if (page === 'overview') {
    $('pageContent').innerHTML = `<div class="stats">${stat('Students', '—', '♙', 'Verified data setup के बाद count')}${stat('Teachers', '—', '♧', 'Teacher profiles')}${stat('Classes', 'PG–12', '▤', 'English + Hindi sections')}${stat('Sections', '—', '▦', 'Admin-defined sections')}</div>
      <div class="panel-grid"><div class="panel"><h3>Quick Actions</h3><div class="quick-actions"><div class="quick-action" data-action="new-admission" role="button" tabindex="0"><b>＋</b>New Admission</div><div class="quick-action"><b>₹</b>Fee Collection</div><div class="quick-action"><b>▤</b>Mark Entry</div><div class="quick-action"><b>◷</b>Attendance</div></div></div><div class="panel"><h3>School Structure</h3><p class="muted">PG–5 English · Classes 6–8 Hindi + English · Classes 9–12 Hindi · Classes 11–12 Science / Arts</p><p class="muted">Academic Session: April–March</p></div></div>`;
    document.querySelector('[data-action="new-admission"]')?.addEventListener('click', showAdmissionForm);
    return;
  }
  if (page === 'students') { await renderStudents(); return; }
  const map = {
    teachers: ['Teacher Directory', 'Teacher profiles और staff assignments अभी configure होना बाकी है.'],
    attendance: ['Attendance', 'Attendance module अभी तैयार और test होना बाकी है.'],
    exams: ['Exams & Results', 'Exam setup और marksheet module अभी connect होना बाकी है.'],
    fees: ['Fees', 'Fee heads, dues, receipts और payment system अभी connect नहीं हैं.'],
    documents: ['Documents', 'Private document storage और access links अभी configure नहीं हैं.'],
    reports: ['Reports', 'Reports संबंधित modules connect होने के बाद उपलब्ध होंगे.'],
    settings: ['Settings', 'School settings और user management अभी तैयार किए जा रहे हैं.']
  };
  $('pageContent').innerHTML = empty(...(map[page] || ['Coming soon', 'यह module अभी connect नहीं है.']));
}

async function renderStudents() {
  const { data, error } = await supabase.from('students')
    .select('id,admission_number,full_name,date_of_birth,gender,admission_date,status')
    .order('created_at', { ascending: false }).limit(200);
  if (error) {
    $('pageContent').innerHTML = empty('Student register load नहीं हुआ', error.message);
    return;
  }

  const studentIds = (data || []).map(s => s.id);
  let docs = [];
  if (studentIds.length) {
    const { data: docData, error: docError } = await supabase.from('student_documents')
      .select('id,student_id,document_type,file_name,storage_path,uploaded_at')
      .in('student_id', studentIds).order('uploaded_at', { ascending: false });
    if (docError) console.warn('Student documents list unavailable:', docError.message);
    docs = docData || [];
  }

  // Private bucket: create short-lived signed links only for display.
  const photoByStudent = new Map();
  for (const d of docs.filter(x => x.document_type === 'student_photo')) {
    if (photoByStudent.has(d.student_id)) continue;
    const { data: signed, error: signError } = await supabase.storage
      .from('student-documents').createSignedUrl(d.storage_path, 3600);
    if (!signError && signed?.signedUrl) photoByStudent.set(d.student_id, signed.signedUrl);
  }

  const rows = (data || []).map(s => {
    const photo = photoByStudent.get(s.id);
    const avatar = photo
      ? `<img src="${safe(photo)}" alt="${safe(s.full_name)} photo" class="student-register-photo" loading="lazy">`
      : `<span class="student-register-avatar">${safe((s.full_name || '?').trim().charAt(0).toUpperCase())}</span>`;
    const docCount = docs.filter(d => d.student_id === s.id).length;
    return `<tr data-student-id="${safe(s.id)}">
      <td>${safe(s.admission_number || '—')}</td>
      <td><div class="student-register-name">${avatar}<span>${safe(s.full_name || '—')}</span></div></td>
      <td>${safe(s.gender || '—')}</td>
      <td>${safe(s.admission_date || '—')}</td>
      <td>${safe(s.status || '—')}</td>
      <td><button type="button" class="outline-btn student-profile-btn" data-student-id="${safe(s.id)}">Profile</button> <button type="button" class="outline-btn student-docs-btn" data-student-id="${safe(s.id)}">Documents (${docCount})</button></td>
    </tr>`;
  }).join('');

  $('pageContent').innerHTML = `
    <div class="panel" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div><h3 style="margin:0">Student Register</h3><p class="muted" style="margin:6px 0 0">कुल loaded records: ${data?.length || 0}</p></div>
        <button class="primary-btn" id="addStudentBtn" type="button">＋ Add New Admission</button>
      </div>
      <input id="studentSearch" type="search" placeholder="नाम / Admission No. खोजें" style="margin-top:14px;width:100%;padding:12px;border:1px solid #d5deea;border-radius:10px">
    </div>
    <div class="panel"><div class="table-wrap"><table>
      <thead><tr><th>Admission No.</th><th>Student</th><th>Gender</th><th>Admission Date</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="studentRows">${rows || '<tr><td colspan="6">अभी कोई विद्यार्थी रिकॉर्ड नहीं है।</td></tr>'}</tbody>
    </table></div></div>
    <div id="studentProfilePanel" class="panel hidden" style="margin-top:16px"></div><div id="studentDocsPanel" class="panel hidden" style="margin-top:16px"></div>
    <style>
      .student-register-name{display:flex;align-items:center;gap:10px;min-width:150px}
      .student-register-photo,.student-register-avatar{width:44px;height:44px;min-width:44px;border-radius:50%;object-fit:cover;display:inline-flex;align-items:center;justify-content:center;background:#e6eefb;color:#174a8b;font-weight:700}
      .student-docs-btn{white-space:nowrap;padding:8px 12px}
    </style>`;
  $('addStudentBtn')?.addEventListener('click', showAdmissionForm);
  $('studentSearch')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    $('studentRows')?.querySelectorAll('tr').forEach(row => row.classList.toggle('hidden', !row.textContent.toLowerCase().includes(q)));
  });
  document.querySelectorAll('.student-docs-btn').forEach(btn => btn.addEventListener('click', () => showStudentDocuments(btn.dataset.studentId, data, docs)));
  document.querySelectorAll('.student-profile-btn').forEach(btn => btn.addEventListener('click', () => showStudentProfile(btn.dataset.studentId)));
}

async function showStudentProfile(studentId) {
  const panel = $('studentProfilePanel');
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.innerHTML = '<p>Student Profile लोड हो रहा है…</p>';
  try {
    const { data: student, error } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
    if (error) throw error;
    if (!student) throw new Error('Student record नहीं मिला।');
    const { data: enrollments, error: enrollmentError } = await supabase.from('enrollments').select('*').eq('student_id', studentId).order('enrollment_date', { ascending: false });
    if (enrollmentError) console.warn('Enrollment profile load:', enrollmentError.message);
    const { data: docs, error: docsError } = await supabase.from('student_documents').select('id,document_type,file_name,uploaded_at').eq('student_id', studentId).order('uploaded_at', { ascending: false });
    if (docsError) console.warn('Document profile load:', docsError.message);
    const field = (label, value) => `<div style="padding:10px;border:1px solid #e3e9f2;border-radius:10px"><small class="muted">${safe(label)}</small><div><b>${safe(value || '—')}</b></div></div>`;
    const enrollmentHtml = (enrollments || []).length ? (enrollments || []).map(en => `<li>Roll: ${safe(en.roll_number || '—')} · Section ID: ${safe(en.section_id || '—')} · Session ID: ${safe(en.session_id || '—')} · Status: ${safe(en.status || '—')}</li>`).join('') : '<li>Enrollment detail उपलब्ध नहीं है।</li>';
    const docHtml = (docs || []).length ? (docs || []).map(d => `<li>${safe(String(d.document_type || '').replaceAll('_',' '))} — ${safe(d.file_name || '')}</li>`).join('') : '<li>अभी कोई document नहीं।</li>';
    panel.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><h3 style="margin:0">Student Profile</h3><button type="button" class="outline-btn" id="closeStudentProfile">Close</button></div><h4>${safe(student.full_name || 'Student')}</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:12px 0">${field('Admission Number',student.admission_number)}${field('PEN',student.pen_number)}${field('Date of Birth',student.date_of_birth)}${field('Gender',student.gender)}${field('Admission Date',student.admission_date)}${field('Student Mobile',student.student_phone)}${field('Status',student.status)}${field('Address',student.address)}</div><h4>Enrollment</h4><ul>${enrollmentHtml}</ul><h4>Documents (${(docs||[]).length})</h4><ul>${docHtml}</ul><p class="muted">यह Profile view अभी read-only है। Edit सुविधा अगले चरण में जोड़ी जाएगी।</p>`;
    $('closeStudentProfile')?.addEventListener('click', () => panel.classList.add('hidden'));
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  } catch (err) {
    panel.innerHTML = `<h3>Student Profile</h3><p>${safe(err.message || err)}</p><button type="button" class="outline-btn" id="closeStudentProfile">Close</button>`;
    $('closeStudentProfile')?.addEventListener('click', () => panel.classList.add('hidden'));
  }
}

async function showStudentDocuments(studentId, students, docs) {
  const student = (students || []).find(s => String(s.id) === String(studentId));
  const panel = $('studentDocsPanel');
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.innerHTML = `<h3>${safe(student?.full_name || 'Student')} — Documents</h3><p>Private documents के लिए temporary secure links बनाए जा रहे हैं…</p>`;
  const list = (docs || []).filter(d => String(d.student_id) === String(studentId));
  if (!list.length) {
    panel.innerHTML = `<h3>${safe(student?.full_name || 'Student')} — Documents</h3><p class="muted">इस विद्यार्थी के लिए अभी कोई document upload नहीं है।</p><button class="outline-btn" id="closeDocsPanel" type="button">Close</button>`;
    $('closeDocsPanel')?.addEventListener('click', () => panel.classList.add('hidden'));
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const items = [];
  for (const d of list) {
    const { data: signed, error } = await supabase.storage.from('student-documents').createSignedUrl(d.storage_path, 3600);
    if (error || !signed?.signedUrl) {
      items.push(`<li>${safe(d.file_name)} <small>(link नहीं बन सका)</small></li>`);
    } else {
      const label = safe(d.document_type.replaceAll('_', ' '));
      items.push(`<li><b>${label}</b> — ${safe(d.file_name)} <a href="${safe(signed.signedUrl)}" target="_blank" rel="noopener">View / Download</a></li>`);
    }
  }
  panel.innerHTML = `<h3>${safe(student?.full_name || 'Student')} — Documents</h3><ul style="padding-left:22px;line-height:2">${items.join('')}</ul><p class="muted">Links 1 घंटे में expire हो जाएंगे। केवल अधिकृत Admin को documents access करना चाहिए।</p><button class="outline-btn" id="closeDocsPanel" type="button">Close</button>`;
  $('closeDocsPanel')?.addEventListener('click', () => panel.classList.add('hidden'));
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showAdmissionForm() {
  const today = new Date().toISOString().slice(0, 10);
  $('pageContent').innerHTML = `<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3>New Student Admission</h3><button class="outline-btn" id="backToRegister" type="button">← Student Register</button></div>
  <form id="admissionForm">
  <h4>Student Details</h4><div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
  <label>Admission Number<input name="admission_number" placeholder="Admission No." required></label>
  <label>Student Full Name<input name="full_name" required></label>
  <label>Date of Birth<input name="date_of_birth" type="date"></label>
  <label>Gender<select name="gender"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label>
  <label>Admission Date<input name="admission_date" type="date" value="${today}" required></label>
  <label>Student Mobile (optional)<input name="student_phone" type="tel"></label>
  <label>PEN Number (optional)<input name="pen_number" inputmode="text" autocomplete="off" maxlength="30" placeholder="Permanent Education Number"></label></div>
  <h4>Academic Placement</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
  <label>Academic Session<select name="session_id" id="adSession" required><option value="">Loading sessions…</option></select></label>
  <label>Class<select name="class_id" id="adClass" required><option value="">Loading classes…</option></select></label>
  <label>Medium<select name="medium_id" id="adMedium" required><option value="">Select medium</option></select></label>
  <label>Stream (11–12)<select name="stream_id" id="adStream"><option value="">Not applicable</option></select></label>
  <label>Section<select name="section_id" id="adSection" required><option value="">Class/medium पहले चुनें</option></select></label>
  <label>Roll Number<input name="roll_number" placeholder="Optional"></label></div>
  <h4>Father Details</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px"><label>Father's Name<input name="father_name" required></label><label>Father's Mobile<input name="father_mobile" type="tel"></label></div>
  <h4>Mother Details</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px"><label>Mother's Name<input name="mother_name" required></label><label>Mother's Mobile<input name="mother_mobile" type="tel"></label></div>
  <h4>Address</h4><label>Full Address<textarea name="address" rows="3"></textarea></label>
  <h4>Documents Upload (Optional)</h4><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
  <label>Student Photo<input name="student_photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
  <label>Student Aadhaar Card (if required)<input name="student_aadhaar_doc" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label>
  <label>Father Aadhaar Card (if required)<input name="father_aadhaar_doc" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label>
  <label>Mother Aadhaar Card (if required)<input name="mother_aadhaar_doc" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label>
  <label>Birth Certificate<input name="birth_certificate" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label>
  <label>Transfer Certificate (TC)<input name="tc_document" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label>
  <label>Previous Marksheet<input name="previous_marksheet" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label></div>
  <p class="muted">केवल आवश्यक दस्तावेज़ अपलोड करें। Aadhaar नंबर यहाँ दर्ज न करें। Files 10 MB तक।</p>
  <p class="notice" style="display:block">Save करने पर Student, Parents और Enrollment records database में एक transaction के अंतर्गत save होंगे।</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><button class="primary-btn" type="submit">Save Admission</button><button class="outline-btn" id="cancelAdmission" type="button">Cancel</button></div><p id="admissionMsg" role="status"></p></form></div>`;
  $('backToRegister')?.addEventListener('click', renderStudents);
  $('cancelAdmission')?.addEventListener('click', renderStudents);
  $('admissionForm')?.addEventListener('submit', saveAdmission);
  loadAdmissionDropdowns().catch(err => {
    $('admissionMsg').textContent = 'Dropdown data load नहीं हुआ: ' + err.message;
  });
}

let admissionData = { sessions: [], classes: [], mediums: [], streams: [], offerings: [], sections: [] };

async function loadAdmissionDropdowns() {
  const [sessionsRes, classesRes, mediumsRes, streamsRes, offeringsRes] = await Promise.all([
    supabase.from('academic_sessions').select('id,session_name,start_date,end_date').order('start_date', { ascending: false }),
    supabase.from('classes').select('id,class_name,sort_order').order('sort_order'),
    supabase.from('mediums').select('id,medium_name').order('medium_name'),
    supabase.from('streams').select('id,stream_name').order('stream_name'),
    supabase.from('class_offerings').select('id,class_id,medium_id,stream_id')
  ]);
  for (const r of [sessionsRes, classesRes, mediumsRes, streamsRes, offeringsRes]) if (r.error) throw r.error;
  admissionData = { sessions: sessionsRes.data || [], classes: classesRes.data || [], mediums: mediumsRes.data || [], streams: streamsRes.data || [], offerings: offeringsRes.data || [], sections: [] };
  fillSelect('adSession', admissionData.sessions, x => x.id, x => x.session_name, 'Select session');
  fillSelect('adClass', admissionData.classes, x => x.id, x => x.class_name, 'Select class');
  fillSelect('adMedium', admissionData.mediums, x => x.id, x => x.medium_name, 'Select medium');
  fillSelect('adStream', admissionData.streams, x => x.id, x => x.stream_name, 'Not applicable');
  $('adClass').addEventListener('change', refreshOfferingAndSections);
  $('adMedium').addEventListener('change', refreshOfferingAndSections);
  $('adStream').addEventListener('change', refreshOfferingAndSections);
  $('adSession').addEventListener('change', refreshOfferingAndSections);
  refreshOfferingAndSections();
}

function fillSelect(id, items, valueFn, labelFn, placeholder) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = `<option value="">${safe(placeholder)}</option>` + (items || []).map(x => `<option value="${safe(valueFn(x))}">${safe(labelFn(x))}</option>`).join('');
}

async function refreshOfferingAndSections() {
  const classId = $('adClass')?.value;
  const mediumId = $('adMedium')?.value;
  const streamId = $('adStream')?.value || null;
  const sessionId = $('adSession')?.value;
  const streamSelect = $('adStream');
  const applicableStreams = admissionData.streams;
  if (!classId || !mediumId || !sessionId) {
    fillSelect('adSection', [], x => x.id, x => x.section_name, 'Class, medium और session चुनें');
    return;
  }
  const offerings = admissionData.offerings.filter(o => String(o.class_id) === String(classId) && String(o.medium_id) === String(mediumId));
  const hasStreams = offerings.some(o => o.stream_id != null);
  streamSelect.disabled = !hasStreams;
  if (!hasStreams) streamSelect.value = '';
  const matching = offerings.filter(o => hasStreams ? String(o.stream_id || '') === String(streamId || '') : o.stream_id == null);
  if (!matching.length) {
    fillSelect('adSection', [], x => x.id, x => x.section_name, hasStreams ? 'Stream चुनें / offering नहीं मिली' : 'Offering नहीं मिली');
    return;
  }
  const offering = matching[0];
  const { data, error } = await supabase.from('sections').select('id,section_name,offering_id,session_id').eq('offering_id', offering.id).eq('session_id', sessionId).order('section_name');
  if (error) throw error;
  admissionData.sections = data || [];
  fillSelect('adSection', admissionData.sections, x => x.id, x => x.section_name, 'Select section');
}

async function saveAdmission(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  const msg = $('admissionMsg');
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving admission…';
  msg.textContent = '';
  const payload = {
    p_admission_number: String(fd.get('admission_number') || '').trim(),
    p_full_name: String(fd.get('full_name') || '').trim(),
    p_date_of_birth: fd.get('date_of_birth') || null,
    p_gender: fd.get('gender') || null,
    p_admission_date: fd.get('admission_date') || null,
    p_student_phone: String(fd.get('student_phone') || '').trim() || null,
    p_address: String(fd.get('address') || '').trim() || null,
    p_session_id: Number(fd.get('session_id')),
    p_section_id: Number(fd.get('section_id')),
    p_roll_number: String(fd.get('roll_number') || '').trim() || null,
    p_father_name: String(fd.get('father_name') || '').trim(),
    p_father_mobile: String(fd.get('father_mobile') || '').trim() || null,
    p_mother_name: String(fd.get('mother_name') || '').trim(),
    p_mother_mobile: String(fd.get('mother_mobile') || '').trim() || null
  };
  try {
    if (!payload.p_session_id || !payload.p_section_id) throw new Error('Academic Session और Section चुनना जरूरी है।');
    const { data, error } = await supabase.rpc('save_student_admission', payload);
    if (error) throw error;
    const studentId = data;
    const pen = String(fd.get('pen_number') || '').trim();
    if (pen) {
      const { error: penError } = await supabase.from('students').update({ pen_number: pen }).eq('id', studentId);
      if (penError) throw new Error('Admission सेव हो गया, लेकिन PEN सेव नहीं हुआ: ' + penError.message);
    }
    const documentMap = [
      ['student_photo', 'student_photo'], ['student_aadhaar_doc', 'student_aadhaar'],
      ['father_aadhaar_doc', 'father_aadhaar'], ['mother_aadhaar_doc', 'mother_aadhaar'],
      ['birth_certificate', 'birth_certificate'], ['tc_document', 'transfer_certificate'],
      ['previous_marksheet', 'previous_marksheet']
    ];
    const filesToUpload = documentMap.map(([field, type]) => ({ file: fd.get(field), type })).filter(x => x.file && x.file.size);
    for (const item of filesToUpload) {
      if (item.file.size > 10 * 1024 * 1024) throw new Error(`${item.file.name}: file 10 MB से बड़ी है।`);
      const ext = (item.file.name.split('.').pop() || 'file').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${studentId}/${item.type}_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('student-documents').upload(path, item.file, { contentType: item.file.type, upsert: false });
      if (uploadError) throw new Error('Admission सेव हुआ, लेकिन दस्तावेज़ अपलोड नहीं हुआ: ' + uploadError.message);
      const { error: recordError } = await supabase.from('student_documents').insert({ student_id: studentId, document_type: item.type, file_name: item.file.name, storage_path: path, uploaded_by: currentUser?.id });
      if (recordError) throw new Error('File अपलोड हुई, लेकिन document record सेव नहीं हुआ: ' + recordError.message);
    }
    msg.textContent = `Admission सफल! Student ID: ${studentId}${filesToUpload.length ? ` | ${filesToUpload.length} documents uploaded` : ''}`;
    toast('Admission successfully saved');
    setTimeout(() => renderStudents(), 1800);
  } catch (err) {
    msg.textContent = 'Admission save नहीं हुआ: ' + (err.message || 'Unknown error');
    btn.disabled = false;
    btn.textContent = 'Save Admission';
  }
}

async function renderParent(page) {
  if (page !== 'overview' && page !== 'students') {
    $('pageContent').innerHTML = empty((titles[page] || page) + ' module', 'इस module का सुरक्षित data access configure और test होना बाकी है.');
    return;
  }
  const { data: students, error } = await supabase.from('students')
    .select('id,admission_number,full_name,status').order('full_name');
  if (error) {
    $('pageContent').innerHTML = empty('Student list could not load', error.message);
    return;
  }
  const { data: enrollments, error: enErr } = await supabase.from('enrollments')
    .select('student_id,roll_number,section_id,session_id,status');
  const byStudent = new Map((enrollments || []).map(x => [x.student_id, x]));
  const rows = (students || []).map(s => {
    const en = byStudent.get(s.id);
    return `<tr><td><div class="student-row"><div class="student-photo">${safe((s.full_name || '?').charAt(0))}</div><div><b>${safe(s.full_name)}</b><br><small>${safe(s.admission_number || 'Admission no. pending')}</small></div></div></td><td>${safe(en?.roll_number || '—')}</td><td>${safe(en?.status || s.status || '—')}</td></tr>`;
  }).join('');
  $('pageContent').innerHTML = `<div class="stats">${stat('My Children', students?.length ?? 0, '♙', 'Linked student profiles')}${stat('Attendance', '—', '◷', 'Attendance module pending')}${stat('Fees', '—', '₹', 'Fee module pending')}${stat('Results', '—', '▤', 'Exam module pending')}</div><div class="panel"><h3>My Children</h3>${students?.length ? `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Roll Number</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No linked children found', 'School office has not linked a student to this family account yet.')}</div>`;
  if (enErr) toast('Enrollment detail could not be loaded: ' + enErr.message);
}

async function logout() {
  if (supabase) await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showLogin('आप लॉगआउट हो गए हैं।');
}
function closeMobileMenu() { $('sidebar')?.classList.remove('open'); }

async function init() {
  $('loginView')?.classList.add('hidden');
  $('dashboardView')?.classList.add('hidden');
  $('previewPage')?.classList.add('hidden');
  $('previewDrawer')?.classList.remove('open');
  $('previewOverlay')?.classList.remove('show');
  $('loginForm')?.addEventListener('submit', doLogin);
  $('togglePassword')?.addEventListener('click', () => {
    const p = $('password'); p.type = p.type === 'password' ? 'text' : 'password';
    $('togglePassword').textContent = p.type === 'password' ? 'Show' : 'Hide';
  });
  $('logoutBtn')?.addEventListener('click', logout);
  $('refreshBtn')?.addEventListener('click', () => renderPage(currentPage));
  $('menuBtn')?.addEventListener('click', () => {
    if (!currentUser || $('dashboardView')?.classList.contains('hidden')) return;
    $('sidebar')?.classList.toggle('open');
  });
  $('navList')?.addEventListener('click', e => {
    const b = e.target.closest('[data-page]');
    if (!b || b.classList.contains('hidden')) return;
    closeMobileMenu(); renderPage(b.dataset.page);
  });
  if (!configured) { authReady = true; showLogin('Preview mode: Supabase configuration अभी उपलब्ध नहीं है.'); return; }
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (session) { currentUser = session.user; currentProfile = await loadProfile(session.user); await enterApp(); }
    else showLogin();
  } catch (err) {
    currentUser = null; currentProfile = null;
    showLogin(err.message || 'Session restore नहीं हो सका। कृपया फिर से login करें.');
  } finally { authReady = true; }
  supabase.auth.onAuthStateChange((event) => {
    if (!authReady || authEventBusy) return;
    if (event === 'SIGNED_OUT') { currentUser = null; currentProfile = null; showLogin(); }
  });
}
init().catch(err => { console.error('SNRD Portal initialization error:', err); showLogin('Portal start नहीं हो सका। कृपया page reload करें.'); });
