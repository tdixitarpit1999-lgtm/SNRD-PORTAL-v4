
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
  super_admin: 'Super Admin',
  office_admin: 'Office Admin',
  teacher: 'Teacher',
  parent: 'Parent / Family',
  student: 'Student'
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
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function stat(label, value, icon, caption = '') {
  return `<article class="stat-card">
    <div class="stat-top">
      <span>${safe(label)}</span>
      <span class="stat-icon">${icon}</span>
    </div>
    <div class="stat-value">${safe(value)}</div>
    <div class="stat-caption">${safe(caption)}</div>
  </article>`;
}

function empty(title, desc) {
  return `<div class="empty-card">
    <strong>${safe(title)}</strong>${safe(desc)}
  </div>`;
}

async function loadProfile(user) {
  const { data, error } = await supabase.from('user_profiles')
    .select('user_id,full_name,role,is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data || !data.is_active) {
    throw new Error('आपका सक्रिय User Profile नहीं मिला। School Admin से संपर्क करें।');
  }

  return data;
}

async function doLogin(e) {
  e.preventDefault();

  if (!supabase) {
    $('loginMessage').textContent =
      'Supabase configuration उपलब्ध नहीं है। School Admin से संपर्क करें।';
    return;
  }

  const btn = $('loginSubmit');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  $('loginMessage').textContent = '';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value
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

  $('userName').textContent =
    currentProfile.full_name || currentUser.email || 'User';

  $('userRole').textContent =
    roleLabel[currentProfile.role] || currentProfile.role || 'User';

  $('userInitial').textContent =
    (currentProfile.full_name || 'S').trim().charAt(0).toUpperCase();

  $('welcomeText').textContent =
    `Welcome, ${currentProfile.full_name || 'User'}`;

  $('todayLabel').textContent =
    new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date());

  applyRoleNavigation();
  await renderPage('overview');
}

function applyRoleNavigation() {
  const role = currentProfile?.role;

  document.querySelectorAll('.nav-item').forEach(b => {
    const page = b.dataset.page;
    let allowed = role === 'super_admin' || role === 'office_admin';

    if (role === 'teacher') {
      allowed = ['overview', 'students', 'attendance', 'exams', 'documents'].includes(page);
    }

    if (role === 'parent') {
      allowed = ['overview', 'students', 'attendance', 'exams', 'fees', 'documents'].includes(page);
    }

    if (role === 'student') {
      allowed = ['overview', 'attendance', 'exams', 'documents'].includes(page);
    }

    b.classList.toggle('hidden', !allowed);
  });
}

async function renderPage(page) {
  if (!currentProfile) return;

  currentPage = titles[page] ? page : 'overview';

  $('pageTitle').textContent = titles[currentPage];

  $('pageEyebrow').textContent =
    (currentProfile.role || '').replaceAll('_', ' ').toUpperCase();

  document.querySelectorAll('.nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.page === currentPage)
  );

  if (currentProfile.role === 'parent') {
    await renderParent(currentPage);
    return;
  }

  if (currentProfile.role === 'super_admin' ||
      currentProfile.role === 'office_admin') {
    await renderAdmin(currentPage);
    return;
  }

  $('pageContent').innerHTML = empty(
    'Dashboard access is being configured',
    'आपके Role की table permissions और संबंधित सुविधाएँ अभी तैयार की जा रही हैं।'
  );
}

async function renderAdmin(page) {
  if (page === 'overview') {
    $('pageContent').innerHTML = `
      <div class="stats">
        ${stat('Students', '—', '♙', 'Verified data setup के बाद count')}
        ${stat('Teachers', '—', '♧', 'Teacher profiles')}
        ${stat('Classes', 'PG–12', '▤', 'English + Hindi sections')}
        ${stat('Sections', '—', '▦', 'Admin-defined sections')}
      </div>

      <div class="panel-grid">
        <div class="panel">
          <h3>Quick Actions</h3>
          <div class="quick-actions">
            <div class="quick-action" data-action="new-admission"
                 role="button" tabindex="0">
              <b>＋</b>New Admission
            </div>
            <div class="quick-action"><b>₹</b>Fee Collection</div>
            <div class="quick-action"><b>▤</b>Mark Entry</div>
            <div class="quick-action"><b>◷</b>Attendance</div>
          </div>
        </div>

        <div class="panel">
          <h3>School Structure</h3>
          <p class="muted">
            PG–5 English · Classes 6–8 Hindi + English ·
            Classes 9–12 Hindi · Classes 11–12 Science / Arts
          </p>
          <p class="muted">Academic Session: April–March</p>
        </div>
      </div>`;

    document.querySelector('[data-action="new-admission"]')
      ?.addEventListener('click', showAdmissionForm);

    return;
  }

  if (page === 'students') {
    await renderStudents();
    return;
  }

  const map = {
    teachers: ['Teacher Directory', 'Teacher profiles और staff assignments अभी configure होना बाकी है.'],
    attendance: ['Attendance', 'Attendance module अभी तैयार और test होना बाकी है.'],
    exams: ['Exams & Results', 'Exam setup और marksheet module अभी connect होना बाकी है.'],
    fees: ['Fees', 'Fee heads, dues, receipts और payment system अभी connect नहीं हैं.'],
    documents: ['Documents', 'Private document storage और access links अभी configure नहीं हैं.'],
    reports: ['Reports', 'Reports संबंधित modules connect होने के बाद उपलब्ध होंगे.'],
    settings: ['Settings', 'School settings और user management अभी तैयार किए जा रहे हैं.']
  };

  $('pageContent').innerHTML =
    empty(...(map[page] || ['Coming soon', 'यह module अभी connect नहीं है.']));
}

async function renderStudents() {
  const { data, error } = await supabase.from('students')
    .select('id,admission_number,full_name,date_of_birth,gender,admission_date,status')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    $('pageContent').innerHTML =
      empty('Student register load नहीं हुआ', error.message);
    return;
  }

  const rows = (data || []).map(s => `
    <tr>
      <td>${safe(s.admission_number || '—')}</td>
      <td>${safe(s.full_name)}</td>
      <td>${safe(s.gender || '—')}</td>
      <td>${safe(s.admission_date || '—')}</td>
      <td>${safe(s.status || '—')}</td>
    </tr>
  `).join('');

  $('pageContent').innerHTML = `
    <div class="panel" style="margin-bottom:16px">
      <div style="display:flex;gap:12px;align-items:center;
                  justify-content:space-between;flex-wrap:wrap">
        <div>
          <h3 style="margin:0">Student Register</h3>
          <p class="muted" style="margin:6px 0 0">
            कुल loaded records: ${data?.length || 0}
          </p>
        </div>

        <button class="primary-btn" id="addStudentBtn" type="button">
          ＋ Add New Admission
        </button>
      </div>

      <input id="studentSearch" type="search"
        placeholder="नाम / Admission No. खोजें"
        style="margin-top:14px;width:100%;padding:12px;
               border:1px solid #d5deea;border-radius:10px">
    </div>

    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Admission No.</th>
              <th>Student Name</th>
              <th>Gender</th>
              <th>Admission Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="studentRows">
            ${rows || '<tr><td colspan="5">अभी कोई विद्यार्थी रिकॉर्ड नहीं है।</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  $('addStudentBtn')?.addEventListener('click', showAdmissionForm);

  $('studentSearch')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();

    $('studentRows')?.querySelectorAll('tr').forEach(row => {
      row.classList.toggle(
        'hidden',
        !row.textContent.toLowerCase().includes(q)
      );
    });
  });
}

function showAdmissionForm() {
  $('pageContent').innerHTML = `
    <div class="panel">

      <div style="display:flex;justify-content:space-between;
                  align-items:center;gap:10px;flex-wrap:wrap">
        <h3>New Student Admission</h3>

        <button class="outline-btn" id="backToRegister" type="button">
          ← Student Register
        </button>
      </div>

      <form id="admissionForm">

        <h4>Student Details</h4>

        <div style="display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
                    gap:12px">

          <label>Admission Number
            <input name="admission_number"
                   placeholder="Admission No." required>
          </label>

          <label>Student Full Name
            <input name="full_name" required>
          </label>

          <label>Date of Birth
            <input name="date_of_birth" type="date">
          </label>

          <label>Gender
            <select name="gender">
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </label>

          <label>Admission Date
            <input name="admission_date" type="date" required>
          </label>

          <label>Student Mobile (optional)
            <input name="student_phone" type="tel">
          </label>

        </div>

        <h4>Father Details</h4>

        <div style="display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
                    gap:12px">

          <label>Father's Name
            <input name="father_name" required>
          </label>

          <label>Father's Mobile
            <input name="father_mobile" type="tel">
          </label>

        </div>

        <h4>Mother Details</h4>

        <div style="display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
                    gap:12px">

          <label>Mother's Name
            <input name="mother_name" required>
          </label>

          <label>Mother's Mobile
            <input name="mother_mobile" type="tel">
          </label>

        </div>

        <h4>Guardian (Optional)</h4>

        <div style="display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
                    gap:12px">

          <label>Guardian Name
            <input name="guardian_name">
          </label>

          <label>Guardian Mobile
            <input name="guardian_mobile" type="tel">
          </label>

          <label>Relation
            <input name="guardian_relation"
                   placeholder="Uncle, Grandparent, etc.">
          </label>

        </div>

        <h4>Address</h4>

        <label>Full Address
          <textarea name="address" rows="3"></textarea>
        </label>

        <p class="notice" style="display:block">
          यह प्रारंभिक Admission Form है। Student record Save होगा;
          Father/Mother/Guardian जानकारी फिलहाल form में collect होगी,
          लेकिन Guardian tables में save करने से पहले उनके exact
          column/relationship names verify करना जरूरी है।
        </p>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
          <button class="primary-btn" type="submit">
            Save Student Record
          </button>

          <button class="outline-btn" id="cancelAdmission" type="button">
            Cancel
          </button>
        </div>

        <p id="admissionMsg" role="status"></p>

      </form>
    </div>`;

  $('backToRegister')?.addEventListener('click', renderStudents);
  $('cancelAdmission')?.addEventListener('click', renderStudents);
  $('admissionForm')?.addEventListener('submit', saveAdmission);
}

async function saveAdmission(e) {
  e.preventDefault();

  const form = e.currentTarget;
  const fd = new FormData(form);

  const payload = {
    admission_number: String(fd.get('admission_number') || '').trim(),
    full_name: String(fd.get('full_name') || '').trim(),
    date_of_birth: fd.get('date_of_birth') || null,
    gender: fd.get('gender') || null,
    admission_date: fd.get('admission_date') || null,
    student_phone: String(fd.get('student_phone') || '').trim() || null,
    address: String(fd.get('address') || '').trim() || null,
    status: 'active'
  };

  const msg = $('admissionMsg');
  const btn = form.querySelector('button[type="submit"]');

  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const { data, error } = await supabase.from('students')
      .insert(payload)
      .select('id,full_name,admission_number')
      .single();

    if (error) throw error;

    msg.textContent =
      `Student record saved successfully: ${data.full_name} (${data.admission_number}). Parent details are not yet written to guardian tables.`;

    toast('Student record saved');

    setTimeout(() => renderStudents(), 1200);

  } catch (err) {
    msg.textContent = 'Save failed: ' + (err.message || 'Unknown error');
    btn.disabled = false;
    btn.textContent = 'Save Student Record';
  }
}

async function renderParent(page) {
  if (page !== 'overview' && page !== 'students') {
    $('pageContent').innerHTML = empty(
      (titles[page] || page) + ' module',
      'इस module का सुरक्षित data access configure और test होना बाकी है.'
    );
    return;
  }

  const { data: students, error } = await supabase.from('students')
    .select('id,admission_number,full_name,status')
    .order('full_name');

  if (error) {
    $('pageContent').innerHTML =
      empty('Student list could not load', error.message);
    return;
  }

  const { data: enrollments, error: enErr } = await supabase.from('enrollments')
    .select('student_id,roll_number,section_id,session_id,status');

  const byStudent = new Map(
    (enrollments || []).map(x => [x.student_id, x])
  );

  const rows = (students || []).map(s => {
    const en = byStudent.get(s.id);

    return `<tr>
      <td>
        <div class="student-row">
          <div class="student-photo">${safe((s.full_name || '?').charAt(0))}</div>
          <div>
            <b>${safe(s.full_name)}</b><br>
            <small>${safe(s.admission_number || 'Admission no. pending')}</small>
          </div>
        </div>
      </td>
      <td>${safe(en?.roll_number || '—')}</td>
      <td>${safe(en?.status || s.status || '—')}</td>
    </tr>`;
  }).join('');

  $('pageContent').innerHTML = `
    <div class="stats">
      ${stat('My Children', students?.length ?? 0, '♙', 'Linked student profiles')}
      ${stat('Attendance', '—', '◷', 'Attendance module pending')}
      ${stat('Fees', '—', '₹', 'Fee module pending')}
      ${stat('Results', '—', '▤', 'Exam module pending')}
    </div>

    <div class="panel">
      <h3>My Children</h3>

      ${students?.length
        ? `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll Number</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`
        : empty(
            'No linked children found',
            'School office has not linked a student to this family account yet.'
          )
      }
    </div>`;

  if (enErr) {
    toast('Enrollment detail could not be loaded: ' + enErr.message);
  }
}

async function logout() {
  if (supabase) await supabase.auth.signOut();

  currentUser = null;
  currentProfile = null;

  showLogin('आप लॉगआउट हो गए हैं।');
}

function closeMobileMenu() {
  $('sidebar')?.classList.remove('open');
}

async function init() {
  // Avoid login/dashboard flicker while restoring the saved session.
  $('loginView')?.classList.add('hidden');
  $('dashboardView')?.classList.add('hidden');
  $('previewPage')?.classList.add('hidden');
  $('previewDrawer')?.classList.remove('open');
  $('previewOverlay')?.classList.remove('show');

  $('loginForm')?.addEventListener('submit', doLogin);

  $('togglePassword')?.addEventListener('click', () => {
    const p = $('password');
    p.type = p.type === 'password' ? 'text' : 'password';
    $('togglePassword').textContent = p.type === 'password' ? 'Show' : 'Hide';
  });

  $('logoutBtn')?.addEventListener('click', logout);

  $('refreshBtn')?.addEventListener('click', () => renderPage(currentPage));

  // Mobile dashboard sidebar menu
  $('menuBtn')?.addEventListener('click', () => {
    if (!currentUser ||
        $('dashboardView')?.classList.contains('hidden')) return;

    $('sidebar')?.classList.toggle('open');
  });

  $('navList')?.addEventListener('click', e => {
    const b = e.target.closest('[data-page]');

    if (!b || b.classList.contains('hidden')) return;

    closeMobileMenu();
    renderPage(b.dataset.page);
  });

  if (!configured) {
    authReady = true;
    showLogin('Preview mode: Supabase configuration अभी उपलब्ध नहीं है.');
    return;
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (session) {
      currentUser = session.user;
      currentProfile = await loadProfile(session.user);
      await enterApp();
    } else {
      showLogin();
    }

  } catch (err) {
    currentUser = null;
    currentProfile = null;

    showLogin(
      err.message || 'Session restore नहीं हो सका। कृपया फिर से login करें.'
    );

  } finally {
    authReady = true;
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (!authReady || authEventBusy) return;

    if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      showLogin();
    }

    // INITIAL_SESSION / TOKEN_REFRESHED पर re-render नहीं करते।
  });
}

init().catch(err => {
  console.error('SNRD Portal initialization error:', err);
  showLogin('Portal start नहीं हो सका। कृपया page reload करें.');
});
