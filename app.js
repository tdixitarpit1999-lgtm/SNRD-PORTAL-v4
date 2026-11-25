import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.SNRD_CONFIG || {};
const configured = cfg.supabaseUrl && cfg.supabaseAnonKey &&
  !cfg.supabaseUrl.includes('YOUR-PROJECT') && !cfg.supabaseAnonKey.includes('YOUR_SUPABASE');
const supabase = configured ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
const $ = (id) => document.getElementById(id);
let currentUser = null, currentProfile = null, currentPage = 'overview';
const titles = {overview:'Dashboard',students:'Students',teachers:'Teachers',attendance:'Attendance',exams:'Exams & Results',fees:'Fees',documents:'Documents',reports:'Reports',settings:'Settings'};
const roleLabel = {super_admin:'Super Admin',office_admin:'Office Admin',teacher:'Teacher',parent:'Parent / Family',student:'Student'};
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2800)}
function showLogin(msg=''){ $('loginView').classList.remove('hidden');$('dashboardView').classList.add('hidden');$('logoutBtn').classList.add('hidden');$('loginMessage').textContent=msg; }
function showDashboard(){ $('loginView').classList.add('hidden');$('dashboardView').classList.remove('hidden');$('logoutBtn').classList.remove('hidden'); }
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function setNotice(msg){$('notice').textContent=msg;$('notice').classList.remove('hidden')}
function stat(label,value,icon,caption=''){return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-caption">${caption}</div></article>`}
function empty(title,desc){return `<div class="empty-card"><strong>${title}</strong>${desc}</div>`}
async function loadProfile(user){
  const {data,error}=await supabase.from('user_profiles').select('user_id,full_name,role,is_active').eq('user_id',user.id).maybeSingle();
  if(error) throw error;
  if(!data || !data.is_active) throw new Error('आपका सक्रिय User Profile नहीं मिला। School Admin से संपर्क करें।');
  return data;
}
async function doLogin(e){
  e.preventDefault();
  if(!supabase){$('loginMessage').textContent='पहले web/config.js में Supabase Project URL और Publishable/anon key सेट करें।';return;}
  const btn=$('loginSubmit');btn.disabled=true;btn.textContent='Signing in…';$('loginMessage').textContent='';
  try{
    const {data,error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
    if(error) throw error;
    currentUser=data.user;currentProfile=await loadProfile(data.user);
    await enterApp();
  }catch(err){$('loginMessage').textContent=err.message||'Login नहीं हो सका।';}
  finally{btn.disabled=false;btn.textContent='Login to Portal';}
}
async function enterApp(){
  showDashboard();
  $('userName').textContent=currentProfile.full_name||currentUser.email;
  $('userRole').textContent=roleLabel[currentProfile.role]||currentProfile.role;
  $('userInitial').textContent=(currentProfile.full_name||'S').trim().charAt(0).toUpperCase();
  $('welcomeText').textContent=`Welcome, ${currentProfile.full_name||'User'}`;
  $('todayLabel').textContent=new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date());
  applyRoleNavigation(); await renderPage('overview');
}
function applyRoleNavigation(){
  const role=currentProfile.role;
  const items=[...document.querySelectorAll('.nav-item')];
  items.forEach(b=>{
    const page=b.dataset.page;
    let allowed=role==='super_admin'||role==='office_admin';
    if(role==='teacher') allowed=['overview','students','attendance','exams','documents'].includes(page);
    if(role==='parent') allowed=['overview','students','attendance','exams','fees','documents'].includes(page);
    if(role==='student') allowed=['overview','attendance','exams','documents'].includes(page);
    b.classList.toggle('hidden',!allowed);
  });
}
async function renderPage(page){
  currentPage=page; $('pageTitle').textContent=titles[page]||'Dashboard';
  $('pageEyebrow').textContent=(currentProfile.role||'').replace('_',' ').toUpperCase();
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  if(currentProfile.role==='parent'){ await renderParent(page); return; }
  if(currentProfile.role==='super_admin'||currentProfile.role==='office_admin'){ await renderAdmin(page); return; }
  $('pageContent').innerHTML=empty('Dashboard access is being configured','आपके Role की table permissions और संबंधित सुविधाएँ अभी तैयार की जा रही हैं।');
}
async function renderAdmin(page){
  if(page==='overview'){
    $('pageContent').innerHTML=`<div class="stats">${stat('Students','—','♙','Live count after verified data setup')}${stat('Teachers','—','♧','Teacher profiles')}${stat('Classes','PG–12','▤','English + Hindi sections')}${stat('Sections','—','▦','Admin-defined sections')}</div>
    <div class="panel-grid"><div class="panel"><h3>Quick Actions</h3><div class="quick-actions"><div class="quick-action"><b>＋</b>New Admission</div><div class="quick-action"><b>₹</b>Fee Collection</div><div class="quick-action"><b>▤</b>Mark Entry</div><div class="quick-action"><b>◷</b>Attendance</div></div></div><div class="panel"><h3>School Structure</h3><p class="muted">PG–8 English · Classes 6–8 Hindi + English · Classes 9–12 Hindi · Classes 11–12 Science / Arts</p><p class="muted">Academic Session: April–March</p></div></div>`;
    return;
  }
  const map={students:['Student Register','Student list will appear after the admin data-entry workflow is connected.'],teachers:['Teacher Directory','Teacher accounts and assignments are not yet configured.'],attendance:['Attendance','Attendance module is planned; no attendance data is being shown yet.'],exams:['Exams & Results','Exam setup and marksheet module are planned.'],fees:['Fees','Fee heads, dues, receipts and payment gateway are not yet connected.'],documents:['Documents','Private document storage and signed access links are not yet configured.'],reports:['Reports','Reports will be available after the relevant modules are connected.'],settings:['Settings','School settings and user management are being prepared.']};
  $('pageContent').innerHTML=empty(...(map[page]||['Coming soon','This module is not connected yet.']));
}
async function renderParent(page){
  if(page!=='overview'&&page!=='students'){
    $('pageContent').innerHTML=empty(titles[page]+' module','इस module का सुरक्षित data access अभी configure और test किया जाना बाकी है।');return;
  }
  const {data:students,error}=await supabase.from('students').select('id,admission_number,full_name,status').order('full_name');
  if(error){$('pageContent').innerHTML=empty('Student list could not load',safe(error.message));return;}
  const {data:enrollments,error:enErr}=await supabase.from('enrollments').select('student_id,roll_number,section_id,session_id,status');
  const byStudent=new Map((enrollments||[]).map(x=>[x.student_id,x]));
  const rows=(students||[]).map(s=>{
    const en=byStudent.get(s.id);
    return `<tr><td><div class="student-row"><div class="student-photo">${safe((s.full_name||'?').charAt(0))}</div><div><b>${safe(s.full_name)}</b><br><small>${safe(s.admission_number||'Admission no. pending')}</small></div></div></td><td>${safe(en?.roll_number||'—')}</td><td>${safe(en?.status||s.status||'—')}</td></tr>`;
  }).join('');
  $('pageContent').innerHTML=`<div class="stats">${stat('My Children',students?.length??0,'♙','Linked student profiles')}${stat('Attendance','—','◷','Attendance module pending')}${stat('Fees','—','₹','Fee module pending')}${stat('Results','—','▤','Exam module pending')}</div><div class="panel"><h3>My Children</h3>${students?.length?`<div class="table-wrap"><table><thead><tr><th>Student</th><th>Roll Number</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`:empty('No linked children found','School office has not linked a student to this family account yet.')}</div>`;
  if(enErr) toast('Enrollment detail could not be loaded: '+enErr.message);
}
async function logout(){if(supabase) await supabase.auth.signOut();currentUser=null;currentProfile=null;showLogin('आप लॉगआउट हो गए हैं।')}
async function init(){
  $('loginForm').addEventListener('submit',doLogin);
  $('togglePassword').addEventListener('click',()=>{const p=$('password');p.type=p.type==='password'?'text':'password';$('togglePassword').textContent=p.type==='password'?'Show':'Hide'});
  $('logoutBtn').addEventListener('click',logout);
  $('refreshBtn').addEventListener('click',()=>renderPage(currentPage));
  $('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
  $('navList').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){renderPage(b.dataset.page);$('sidebar').classList.remove('open')}});
  if(!configured){showLogin('Preview mode: Supabase credentials अभी configure नहीं हैं।');return;}
  const {data:{session}}=await supabase.auth.getSession();
  if(session){try{currentUser=session.user;currentProfile=await loadProfile(session.user);await enterApp()}catch(e){showLogin(e.message)}}
  supabase.auth.onAuthStateChange(async(event,session)=>{if(event==='SIGNED_OUT'){showLogin()}});
}
init();

// V4: usable menu and module previews while backend login is not connected.
const previewModules = [
 ['overview','Dashboard','School overview and quick actions'],['students','Students','Student register and admission'],['teachers','Teachers','Teacher directory and staff'],['classes','Classes & Sections','Medium, class and section structure'],['attendance','Attendance','Daily attendance preview'],['exams','Exams & Results','Exam schedule and results'],['fees','Fees','Fee structure and collection'],['documents','Documents','Admit cards, marksheets and uploads'],['reports','Reports','School reports'],['settings','Settings','Portal settings']
];
function previewModulePage(key){
 const names=Object.fromEntries(previewModules.map(x=>[x[0],x[1]]));
 const page=$('previewPage');
 const content=key==='overview'?`<div class="preview-grid">${previewModules.slice(1).map(m=>`<button class="preview-tile" data-preview-page="${m[0]}">▦ ${m[1]}<small>${m[2]}</small></button>`).join('')}</div><div class="preview-card"><h3>School Structure</h3><p>PG–5 English Medium · Classes 6–8 Hindi + English · 9–12 Hindi · 11–12 Science / Arts</p><p>Academic Session: 2026–27</p></div>`:`<div class="preview-card"><h3>${names[key]||'Module'}</h3><p>This is a visual preview only. Real school data and actions will be connected after secure backend testing.</p><div class="preview-grid"><button class="preview-tile" data-preview-page="overview">← Dashboard<small>Return to overview</small></button><button class="preview-tile" data-preview-page="${key}">＋ ${names[key]}<small>Module preview</small></button></div></div>`;
 page.innerHTML=`<button class="preview-back" id="previewBack">← Back to Login</button><h2>${names[key]||'Dashboard'}</h2>${content}<p class="prototype-note">SNRD PORTAL · Preview Mode · No real student data</p>`;
 $('loginView').classList.add('hidden');$('dashboardView').classList.add('hidden');page.classList.remove('hidden');
 page.querySelectorAll('[data-preview-page]').forEach(b=>b.addEventListener('click',()=>previewModulePage(b.dataset.previewPage)));
 $('previewBack').addEventListener('click',()=>{page.classList.add('hidden');$('loginView').classList.remove('hidden')});
}
function openPreviewMenu(){
 const drawer=$('previewDrawer'),overlay=$('previewOverlay');
 $('previewMenuItems').innerHTML=previewModules.map(m=>`<button data-preview-page="${m[0]}">${m[1]}</button>`).join('');
 drawer.classList.add('open');overlay.classList.add('show');
 $('previewMenuItems').querySelectorAll('[data-preview-page]').forEach(b=>b.addEventListener('click',()=>{drawer.classList.remove('open');overlay.classList.remove('show');previewModulePage(b.dataset.previewPage)}));
}
$('menuBtn')?.addEventListener('click',()=>{if($('loginView').classList.contains('hidden')){$('sidebar')?.classList.toggle('open')}else openPreviewMenu()});
$('previewOverlay')?.addEventListener('click',()=>{$('previewDrawer').classList.remove('open');$('previewOverlay').classList.remove('show')});
