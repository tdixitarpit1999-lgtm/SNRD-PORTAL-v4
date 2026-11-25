import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.SNRD_CONFIG || {};
const configured = Boolean(
  cfg.supabaseUrl &&
  cfg.supabaseAnonKey &&
  !String(cfg.supabaseUrl).includes('YOUR-PROJECT') &&
  !String(cfg.supabaseAnonKey).includes('YOUR_SUPABASE')
);

const supabase = configured
  ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
  : null;

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let currentPage = 'overview';
let initializing = true;
let loginBusy = false;
let logoutBusy = false;

const titles = {
  overview: 'Dashboard',
  students: 'Students',
  teachers: 'Teachers',
  attendance: 'Attendance',
  exams: 'Exams & Results',
  fees: 'Fees',
  documents: 'Documents',
  reports: 'Reports',
  settings: 'Settings'
};

const roleLabel = {
  super_admin: 'Super Admin',
  office_admin: 'Office Admin',
  teacher: 'Teacher',
  parent: 'Parent / Family',
  student: 'Student'
};

function setVisible(el, visible) {
  if (!el) return;

  el.classList.toggle('hidden', !visible);
  el.style.display = visible ? '' : 'none';
}

function toast(msg) {
  const el = $('toast');
  if (!el) return;

  el.textContent = msg;
  el.classList.add('show');

  window.setTimeout(() => {
    el.classList.remove('show');
  }, 2800);
}

function closeMobileMenu() {
  $('sidebar')?.classList.remove('open');
}

function showLogin(msg = '') {
  currentUser = null;
  currentProfile = null;

  setVisible($('loginView'), true);
  setVisible($('dashboardView'), false);
  setVisible($('logoutBtn'), false);

  closeMobileMenu();

  setVisible($('previewPage'), false);
  $('previewDrawer')?.classList.remove('open');
  $('previewOverlay')?.classList.remove('show');

  if ($('loginMessage')) {
    $('loginMessage').textContent = msg;
  }
}

function showDashboard() {
  setVisible($('loginView'), false);
  setVisible($('dashboardView'), true);
  setVisible($('logoutBtn'), true);

  setVisible($('previewPage'), false);
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
  return `
    <article class="stat-card">
      <div class="stat-top">
        <span>${safe(label)}</span>
        <span class="stat-icon">${icon}</span>
      </div>
      <div class="stat-value">${safe(value)}</div>
      <div class="stat-caption">${safe(caption)}</div>
    </article>
  `;
}

function empty(title, desc) {
  return `<div class="empty-card"><strong>${safe(title)}</strong>${safe(desc)}</div>`;
}

async function loadProfile(user) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id,full_name,role,is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data || !data.is_active) {
    throw new Error(
      'आपका सक्रिय User Profile नहीं मिला। School Admin से संपर्क करें।'
    );
  }

  return data;
}

async function enterApp(user, profile) {
  if (!user || !profile) return;

  currentUser = user;
  currentProfile = profile;

  showDashboard();

  if ($('userName')) {
    $('userName').textContent =
      profile.full_name || user.email || 'User';
  }

  if ($('userRole')) {
    $('userRole').textContent =
      roleLabel[profile.role] || profile.role || 'User';
  }

  if ($('userInitial')) {
    $('userInitial').textContent =
      (profile.full_name || 'S').trim().charAt(0).toUpperCase();
  }

  if ($('welcomeText')) {
    $('welcomeText').textContent =
      `Welcome, ${profile.full_name || 'User'}`;
  }

  if ($('todayLabel')) {
    $('todayLabel').textContent =
      new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium'
      }).format(new Date());
  }

  applyRoleNavigation();
  await renderPage('overview');
}

async function doLogin(e) {
  e.preventDefault();

  if (loginBusy) return;

  if (!supabase) {
    if ($('loginMessage')) {
      $('loginMessage').textContent =
        'Supabase configuration उपलब्ध नहीं है। School Admin से संपर्क करें।';
    }
    return;
  }

  loginBusy = true;

  const btn = $('loginSubmit');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Signing in…';
  }

  if ($('loginMessage')) {
    $('loginMessage').textContent = '';
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $('email')?.value.trim(),
      password: $('password')?.value
    });

    if (error) throw error;

    const profile = await loadProfile(data.user);

    await enterApp(data.user, profile);

  } catch (err) {
    await supabase.auth.signOut().catch(() => {});

    showLogin(err?.message || 'Login नहीं हो सका।');

  } finally {
    loginBusy = false;

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Login to Portal';
    }
  }
}

function applyRoleNavigation() {
  const role = currentProfile?.role;

  document.querySelectorAll('.nav-item').forEach(b => {
    const page = b.dataset.page;

    let allowed =
      role === 'super_admin' ||
      role === 'office_admin';

    if (role === 'teacher') {
      allowed = [
        'overview',
        'students',
        'attendance',
        'exams',
        'documents'
      ].includes(page);
    }

    if (role === 'parent') {
      allowed = [
        'overview',
        'students',
        'attendance',
        'exams',
        'fees',
        'documents'
      ].includes(page);
    }

    if (role === 'student') {
      allowed = [
        'overview',
        'attendance',
        'exams',
        'documents'
      ].includes(page);
    }

    b.classList.toggle('hidden', !allowed);
  });
}

async function renderPage(page) {
  if (!currentProfile) return;

  currentPage = titles[page] ? page : 'overview';

  if ($('pageTitle')) {
    $('pageTitle').textContent = titles[currentPage];
  }

  if ($('pageEyebrow')) {
    $('pageEyebrow').textContent =
      (currentProfile.role || '')
        .replaceAll('_', ' ')
        .toUpperCase();
  }

  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle(
      'active',
      b.dataset.page === currentPage
    );
  });

  if (currentProfile.role === 'parent') {
    return renderParent(currentPage);
  }

  if (
    currentProfile.role === 'super_admin' ||
    currentProfile.role === 'office_admin'
  ) {
    return renderAdmin(currentPage);
  }

  if ($('pageContent')) {
    $('pageContent').innerHTML = empty(
      'Dashboard access is being configured',
      'आपके Role की table permissions और संबंधित सुविधाएँ अभी तैयार की जा रही हैं।'
    );
  }
}

async function renderAdmin(page) {
  if (!$('pageContent')) return;

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
            <div class="quick-action"><b>＋</b>New Admission</div>
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
      </div>
    `;

    return;
  }

  const map = {
    students: [
      'Student Register',
      'Student list and admission workflow अभी connect/test होना बाकी है.'
    ],
    teachers: [
      'Teacher Directory',
      'Teacher profiles और staff assignments अभी configure होना बाकी है.'
    ],
    attendance: [
      'Attendance',
      'Attendance module अभी तैयार और test होना बाकी है.'
    ],
    exams: [
      'Exams & Results',
      'Exam setup और marksheet module अभी connect होना बाकी है.'
    ],
    fees: [
      'Fees',
      'Fee heads, dues, receipts और payment system अभी connect नहीं हैं.'
    ],
    documents: [
      'Documents',
      'Private document storage और access links अभी configure नहीं हैं.'
    ],
    reports: [
      'Reports',
      'Reports संबंधित modules connect होने के बाद उपलब्ध होंगे.'
    ],
    settings: [
      'Settings',
      'School settings और user management अभी तैयार किए जा रहे हैं.'
    ]
  };

  $('pageContent').innerHTML = empty(
    ...(map[page] || ['Coming soon', 'यह module अभी connect नहीं है.'])
  );
}

async function renderParent(page) {
  if (!$('pageContent')) return;

  if (page !== 'overview' && page !== 'students') {
    $('pageContent').innerHTML = empty(
      (titles[page] || page) + ' module',
      'इस module का सुरक्षित data access configure और test होना बाकी है.'
    );

    return;
  }

  const {
    data: students,
    error
  } = await supabase
    .from('students')
    .select('id,admission_number,full_name,status')
    .order('full_name');

  if (error) {
    $('pageContent').innerHTML = empty(
      'Student list could not load',
      error.message
    );

    return;
  }

  const {
    data: enrollments,
    error: enErr
  } = await supabase
    .from('enrollments')
    .select('student_id,roll_number,section_id,session_id,status');

  const byStudent = new Map(
    (enrollments || []).map(x => [x.student_id, x])
  );

  const rows = (students || []).map(s => {
    const en = byStudent.get(s.id);

    return `
      <tr>
        <td>
          <div class="student-row">
            <div class="student-photo">
              ${safe((s.full_name || '?').charAt(0))}
            </div>
            <div>
              <b>${safe(s.full_name)}</b><br>
              <small>${safe(s.admission_number || 'Admission no. pending')}</small>
            </div>
          </div>
        </td>
        <td>${safe(en?.roll_number || '—')}</td>
        <td>${safe(en?.status || s.status || '—')}</td>
      </tr>
    `;
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
      ${
        students?.length
          ? `
            <div class="table-wrap">
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
            </div>
          `
          : empty(
              'No linked children found',
              'School office has not linked a student to this family account yet.'
            )
      }
    </div>
  `;

  if (enErr) {
    toast('Enrollment detail could not be loaded: ' + enErr.message);
  }
}

async function logout() {
  if (logoutBusy) return;

  logoutBusy = true;

  try {
    if (supabase) {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;
    }

    showLogin('आप लॉगआउट हो गए हैं।');

  } catch (err) {
    toast(err?.message || 'Logout नहीं हो सका।');

  } finally {
    logoutBusy = false;
  }
}

function setupEvents() {
  $('loginForm')?.addEventListener('submit', doLogin);

  $('togglePassword')?.addEventListener('click', () => {
    const p = $('password');

    if (!p) return;

    p.type = p.type === 'password' ? 'text' : 'password';

    $('togglePassword').textContent =
      p.type === 'password' ? 'Show' : 'Hide';
  });

  $('logoutBtn')?.addEventListener('click', logout);

  $('refreshBtn')?.addEventListener('click', () => {
    renderPage(currentPage);
  });

  $('menuBtn')?.addEventListener('click', () => {
    if (
      !currentUser ||
      $('dashboardView')?.classList.contains('hidden')
    ) {
      return;
    }

    $('sidebar')?.classList.toggle('open');
  });

  $('navList')?.addEventListener('click', e => {
    const b = e.target.closest('[data-page]');

    if (!b || b.classList.contains('hidden')) return;

    closeMobileMenu();
    renderPage(b.dataset.page);
  });
}

async function init() {
  // Hide both views while the saved session is checked.
  setVisible($('loginView'), false);
  setVisible($('dashboardView'), false);
  setVisible($('logoutBtn'), false);
  setVisible($('previewPage'), false);

  $('previewDrawer')?.classList.remove('open');
  $('previewOverlay')?.classList.remove('show');

  setupEvents();

  if (!configured) {
    showLogin(
      'Preview mode: Supabase configuration अभी उपलब्ध नहीं है.'
    );

    initializing = false;
    return;
  }

  try {
    const {
      data,
      error
    } = await supabase.auth.getSession();

    if (error) throw error;

    if (data?.session?.user) {
      const profile = await loadProfile(data.session.user);

      await enterApp(data.session.user, profile);

    } else {
      showLogin();
    }

  } catch (err) {
    await supabase.auth.signOut().catch(() => {});

    showLogin(
      err?.message ||
      'Session restore नहीं हो सका। कृपया फिर से login करें.'
    );

  } finally {
    initializing = false;
  }

  // Handle sign-out from another tab/device.
  supabase.auth.onAuthStateChange((event) => {
    if (initializing) return;

    if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });
}

init().catch(err => {
  console.error('SNRD Portal initialization error:', err);

  showLogin(
    'Portal start नहीं हो सका। कृपया page reload करें.'
  );
});
