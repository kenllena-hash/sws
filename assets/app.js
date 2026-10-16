/* ============================================================
   SWS — Dashboard Controller (admin/resident/superadmin)
   ============================================================ */

const API = 'api/';

/* ============================================================
   TOAST
   ============================================================ */
function ensureToastContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
    }
    return c;
}

function toast(message, type = 'info', duration = 3500) {
    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<span class="toast-icon"></span><span class="toast-message">${escapeHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('hide');
        setTimeout(() => el.remove(), 240);
    }, duration);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

window.alert = function (msg) {
    const lower = String(msg).toLowerCase();
    let type = 'info';
    if (/(success|submitted|created|updated|saved|deleted|changed)/.test(lower)) type = 'success';
    else if (/(error|fail|invalid|incorrect|not found|denied|wrong)/.test(lower)) type = 'error';
    else if (/(required|please|must|warn|complete)/.test(lower)) type = 'warning';
    toast(msg, type);
};

function setBtnLoading(btn, loading, fallback = 'Save') {
    if (!btn) return;
    if (loading) {
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = '<span class="loading"></span>';
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.original || fallback;
        btn.disabled = false;
    }
}

function showTableLoading(tbody, cols = 5) {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${cols}">
        <div class="loading-center"><span class="loading"></span> Loading…</div>
    </td></tr>`;
}

/* ============================================================
   NAV
   ============================================================ */
function currentUser() {
    try { return JSON.parse(sessionStorage.getItem('sws_user') || 'null'); }
    catch (_) { return null; }
}

function nav(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);

    /* Sync sidebar active state */
    document.querySelectorAll('.dashboard .sidebar button').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.dashboard .sidebar button[data-nav="${id}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const u = currentUser();
    if (!u) return;

    if (id === 'complaints') {
        if (u.role === 'resident') loadComplaints();
        else loadAdminComplaints();
    }
    if (id === 'users') loadUsers();
    if (id === 'announcements') loadAdminAnnouncements();
    if (id === 'dashboard') {
        if (u.role === 'resident') { loadStats(); loadDashboardNotifs(); }
        else loadAdminStats();
    }
    if (id === 'profile') loadMyProfile();
}

async function logout() {
    if (!confirm('Sign out?')) return;
    const u = currentUser();
    if (u) {
        try {
            await fetch(API + 'logout.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: u.id })
            });
        } catch (_) {}
    }
    sessionStorage.removeItem('sws_user');
    location.href = 'index.html';
}

/* ============================================================
   PROFILE
   ============================================================ */
async function loadMyProfile() {
    const u = currentUser();
    if (!u) return;

    try {
        const res = await fetch(`${API}profile.php?action=get&user_id=${u.id}`);
        const d = await res.json();
        if (!d.success) return;
        const user = d.user;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
        set('profName', user.full_name);
        set('profEmail', user.email);
        set('profPhone', user.phone);
        set('profAddress', user.address);
        set('profRole', user.role.toUpperCase());
        set('profJoined', new Date(user.created_at).toLocaleDateString());

        set('profileName', user.full_name);
        set('profileEmail', user.email);
        set('profilePhone', user.phone);
        set('profileAddress', user.address);

        const av = document.getElementById('profAvatar');
        if (av) {
            const initials = (user.full_name || '?')
                .split(' ').filter(Boolean).map(n => n[0]).slice(0,2).join('').toUpperCase();
            av.textContent = initials || '?';
        }

        const fn = document.getElementById('profEditName');
        const fp = document.getElementById('profEditPhone');
        const fa = document.getElementById('profEditAddress');
        if (fn) fn.value = user.full_name || '';
        if (fp) fp.value = user.phone || '';
        if (fa) fa.value = user.address || '';
    } catch (_) {}
}

async function saveProfile(e) {
    if (e) e.preventDefault();
    const u = currentUser();
    if (!u) return;

    const btn = e && e.target ? e.target.querySelector('button[type="submit"]') : null;

    const body = {
        action: 'update',
        user_id: u.id,
        full_name: document.getElementById('profEditName').value.trim(),
        phone: document.getElementById('profEditPhone').value.trim(),
        address: document.getElementById('profEditAddress').value.trim()
    };

    if (!body.full_name || !body.phone || !body.address) {
        toast('Please complete all fields.', 'warning');
        return;
    }

    setBtnLoading(btn, true, 'Save Changes');

    try {
        const res = await fetch(API + 'profile.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const d = await res.json();
        if (d.success) {
            toast(d.message, 'success');
            const merged = Object.assign({}, u, d.user);
            sessionStorage.setItem('sws_user', JSON.stringify(merged));
            loadMyProfile();
        } else {
            toast(d.message, 'error');
        }
    } catch (_) { toast('Network error.', 'error'); }
    finally { setBtnLoading(btn, false, 'Save Changes'); }
}

async function changePassword(e) {
    if (e) e.preventDefault();
    const u = currentUser();
    if (!u) return;

    const btn = e && e.target ? e.target.querySelector('button[type="submit"]') : null;
    const currentPass = document.getElementById('profCurrentPass').value;
    const newPass     = document.getElementById('profNewPass').value;
    const confirmPass = document.getElementById('profConfirmPass').value;

    if (!currentPass || !newPass || !confirmPass) { toast('Please fill all password fields.', 'warning'); return; }
    if (newPass.length < 6) { toast('Password must be at least 6 characters.', 'warning'); return; }
    if (newPass !== confirmPass) { toast('Passwords do not match.', 'warning'); return; }

    setBtnLoading(btn, true, 'Change Password');

    try {
        const res = await fetch(API + 'change_password.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: u.id,
                current_password: currentPass,
                new_password: newPass
            })
        });
        const d = await res.json();
        if (d.success) {
            toast(d.message, 'success');
            document.getElementById('profCurrentPass').value = '';
            document.getElementById('profNewPass').value = '';
            document.getElementById('profConfirmPass').value = '';
        } else {
            toast(d.message, 'error');
        }
    } catch (_) { toast('Network error.', 'error'); }
    finally { setBtnLoading(btn, false, 'Change Password'); }
}

/* ============================================================
   RESIDENT
   ============================================================ */
async function submitComplaint() {
    const u = currentUser();
    if (!u) { toast('Login required.', 'warning'); return; }
    const btn = event && event.target ? event.target : null;
    const body = {
        user_id: u.id,
        issue_type: document.getElementById('issue').value,
        location: document.getElementById('location').value.trim(),
        description: document.getElementById('description').value.trim()
    };
    if (!body.issue_type || !body.location || !body.description) {
        toast('Please complete the form.', 'warning'); return;
    }
    setBtnLoading(btn, true, 'Submit');
    try {
        const res = await fetch(API + 'complaints.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const d = await res.json();
        if (d.success) {
            toast(d.message, 'success');
            document.getElementById('issue').value = '';
            document.getElementById('location').value = '';
            document.getElementById('description').value = '';
            setTimeout(() => nav('complaints'), 500);
        } else {
            toast(d.message, 'error');
        }
    } catch (e) { toast('Network error.', 'error'); }
    finally { setBtnLoading(btn, false, 'Submit'); }
}

async function loadComplaints() {
    const u = currentUser();
    const tb = document.getElementById('complaintsTable');
    if (!tb) return;
    showTableLoading(tb, 5);
    try {
        const res = await fetch(`${API}complaints.php?user_id=${u.id}`);
        const d = await res.json();
        tb.innerHTML = '';
        if (!d.success || !d.complaints.length) {
            tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:32px;">No complaints yet.</td></tr>';
            return;
        }
        d.complaints.forEach(c => {
            const cls = c.status === 'Pending' ? 'pending' : c.status === 'In Progress' ? 'progress' : 'resolved';
            tb.innerHTML += `<tr>
                <td><strong>${escapeHtml(c.ref_no)}</strong></td>
                <td>${escapeHtml(c.issue_type)}</td>
                <td>${escapeHtml(c.location)}</td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td><span class="status ${cls}">${c.status}</span></td>
            </tr>`;
        });
    } catch (e) {
        tb.innerHTML = '<tr><td colspan="5" class="text-center" style="color:var(--danger);padding:32px;">Failed to load.</td></tr>';
    }
}

async function loadStats() {
    const u = currentUser();
    try {
        const res = await fetch(`${API}complaints.php?user_id=${u.id}`);
        const d = await res.json();
        if (!d.success) return;
        const list = d.complaints || [];
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('statTotal', list.length);
        set('statProgress', list.filter(c => c.status === 'In Progress').length);
        set('statResolved', list.filter(c => c.status === 'Resolved').length);
    } catch (_) {}
}

async function loadAnnouncements() {
    const box = document.getElementById('announcementsList');
    if (!box) return;
    try {
        const res = await fetch(API + 'announcements.php');
        const d = await res.json();
        box.innerHTML = '';
        if (!d.success || !d.announcements.length) {
            box.innerHTML = '<p class="text-muted" style="padding:12px 0;font-size:13.5px;">No announcements yet.</p>';
            return;
        }
        d.announcements.forEach(a => {
            box.innerHTML += `<div class="notification">
                <h5>${escapeHtml(a.title)}</h5>
                <p>${escapeHtml(a.message)}</p>
                <small>${new Date(a.posted_at).toLocaleString()} · ${a.type}</small>
            </div>`;
        });
    } catch (_) {}
}

async function loadDashboardNotifs() {
    const box = document.getElementById('dashboardNotifs');
    if (!box) return;
    try {
        const res = await fetch(API + 'announcements.php');
        const d = await res.json();
        box.innerHTML = '';
        if (!d.success || !d.announcements.length) {
            box.innerHTML = '<p class="text-muted mb-0" style="font-size:13.5px;">No announcements yet.</p>';
            return;
        }
        d.announcements.slice(0, 3).forEach(a => {
            box.innerHTML += `<div class="notification">
                <h6>${escapeHtml(a.title)}</h6>
                <p class="small">${escapeHtml(a.message)}</p>
                <small>${new Date(a.posted_at).toLocaleDateString()}</small>
            </div>`;
        });
    } catch (_) {}
}

/* ============================================================
   ADMIN
   ============================================================ */
async function loadAdminStats() {
    const u = currentUser();
    try {
        const res = await fetch(`${API}admin_stats.php?user_id=${u.id}`);
        const d = await res.json();
        if (!d.success) { toast(d.message, 'error'); return; }
        const s = d.stats;
        const box = document.getElementById('statsRow');
        if (!box) return;

        const cards = [
            ['Residents',      s.residents],
            ['Complaints',     s.total_complaints],
            ['Pending',        s.pending],
            ['Resolved',       s.resolved],
            ['Announcements',  s.announcements],
            ['SMS Sent',       s.sms_sent],
            ['Admins',         s.admins],
            ['Super Admins',   s.superadmins]
        ];

        box.innerHTML = cards.map(([label, value]) => `
            <div class="col-6 col-md-3">
                <div class="stat-box">
                    <h6>${label}</h6>
                    <strong>${value}</strong>
                </div>
            </div>`).join('');
    } catch (_) {}
}

async function loadAdminComplaints() {
    const u = currentUser();
    const tb = document.getElementById('adminComplaints');
    if (!tb) return;
    showTableLoading(tb, 6);
    try {
        const res = await fetch(`${API}complaints.php?user_id=${u.id}&role=${u.role}`);
        const d = await res.json();
        tb.innerHTML = '';
        if (!d.success) { tb.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger);padding:32px;">${d.message}</td></tr>`; return; }
        if (!d.complaints.length) {
            tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:32px;">No complaints yet.</td></tr>';
            return;
        }
        d.complaints.forEach(c => {
            const cls = c.status === 'Pending' ? 'pending' : c.status === 'In Progress' ? 'progress' : 'resolved';
            tb.innerHTML += `<tr>
                <td><strong>${escapeHtml(c.ref_no)}</strong></td>
                <td>${escapeHtml(c.resident_name)}</td>
                <td>${escapeHtml(c.issue_type)}</td>
                <td>${escapeHtml(c.location)}</td>
                <td><span class="status ${cls}">${c.status}</span></td>
                <td>
                    <select class="form-select form-select-sm d-inline-block" style="width:130px;font-size:13px;" id="status-${c.id}">
                        ${['Pending','In Progress','Resolved'].map(s => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <button class="btn btn-blue" style="padding:5px 12px;font-size:12.5px;" onclick="updateComplaint(${c.id}, this)">Save</button>
                </td>
            </tr>`;
        });
    } catch (_) {
        tb.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--danger);padding:32px;">Failed to load.</td></tr>';
    }
}

async function updateComplaint(id, btn) {
    const u = currentUser();
    const status = document.getElementById(`status-${id}`).value;
    const remarks = prompt('Remarks (optional):', '') || '';
    setBtnLoading(btn, true, 'Save');
    try {
        const res = await fetch(API + 'complaints.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_status', user_id: u.id, complaint_id: id, status, remarks })
        });
        const d = await res.json();
        if (d.success) { toast(d.message, 'success'); loadAdminComplaints(); }
        else toast(d.message, 'error');
    } catch (_) { toast('Network error', 'error'); }
    finally { setBtnLoading(btn, false, 'Save'); }
}

async function postAnnouncement() {
    const u = currentUser();
    const btn = event && event.target ? event.target : null;
    const body = {
        user_id: u.id,
        title: document.getElementById('annTitle').value.trim(),
        message: document.getElementById('annMessage').value.trim(),
        type: document.getElementById('annType').value
    };
    if (!body.title || !body.message) { toast('Title and message required.', 'warning'); return; }
    setBtnLoading(btn, true, 'Post & Broadcast');
    try {
        const res = await fetch(API + 'announcements.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const d = await res.json();
        if (d.success) {
            const msg = d.message + (d.sms_sent !== undefined ? ` · ${d.sms_sent} SMS sent` : '');
            toast(msg, 'success');
            document.getElementById('annTitle').value = '';
            document.getElementById('annMessage').value = '';
            loadAdminAnnouncements();
        } else toast(d.message, 'error');
    } catch (_) { toast('Network error', 'error'); }
    finally { setBtnLoading(btn, false, 'Post & Broadcast'); }
}

async function loadAdminAnnouncements() {
    const box = document.getElementById('adminAnnList');
    if (!box) return;
    box.innerHTML = '<div class="loading-center"><span class="loading"></span> Loading…</div>';
    try {
        const res = await fetch(API + 'announcements.php');
        const d = await res.json();
        box.innerHTML = '';
        if (!d.success || !d.announcements.length) {
            box.innerHTML = '<p class="text-muted" style="font-size:13.5px;">No announcements.</p>';
            return;
        }
        d.announcements.forEach(a => {
            box.innerHTML += `<div class="notification">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                    <div style="flex:1;min-width:0;">
                        <h5>${escapeHtml(a.title)}</h5>
                        <p>${escapeHtml(a.message)}</p>
                        <small>${a.type} · ${escapeHtml(a.posted_by_name || 'System')} · ${new Date(a.posted_at).toLocaleString()}</small>
                    </div>
                    <button class="btn" style="padding:5px 10px;font-size:12px;background:var(--danger-soft);color:var(--danger);border:1px solid #fecaca;" onclick="deleteAnn(${a.id})">Delete</button>
                </div>
            </div>`;
        });
    } catch (_) {}
}

async function deleteAnn(id) {
    if (!confirm('Delete this announcement?')) return;
    const u = currentUser();
    try {
        const res = await fetch(API + 'announcements.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', user_id: u.id, id })
        });
        const d = await res.json();
        if (d.success) { toast(d.message, 'success'); loadAdminAnnouncements(); }
        else toast(d.message, 'error');
    } catch (_) {}
}

/* ============================================================
   SUPER ADMIN
   ============================================================ */
async function loadUsers() {
    const u = currentUser();
    const tb = document.getElementById('usersTable');
    if (!tb) return;
    showTableLoading(tb, 5);
    try {
        const res = await fetch(`${API}admin_users.php?user_id=${u.id}`);
        const d = await res.json();
        tb.innerHTML = '';
        if (!d.success) { tb.innerHTML = `<tr><td colspan="5" class="text-center" style="color:var(--danger);padding:32px;">${d.message}</td></tr>`; return; }
        d.users.forEach(x => {
            const roleCls = `role-${x.role}`;
            tb.innerHTML += `<tr>
                <td><strong>${escapeHtml(x.full_name)}</strong><br><small class="text-muted">${escapeHtml(x.email)}</small></td>
                <td>${escapeHtml(x.email)}</td>
                <td><span class="badge-role ${roleCls}">${x.role}</span></td>
                <td>${x.is_active == 1 ? '<span style="color:var(--success);">Active</span>' : '<span style="color:var(--ink-4);">Inactive</span>'}</td>
                <td>
                    <select class="form-select form-select-sm d-inline-block" style="width:120px;font-size:12.5px;" id="role-${x.id}">
                        ${['resident','admin','superadmin'].map(r => `<option ${r === x.role ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                    <button class="btn btn-blue" style="padding:5px 10px;font-size:12px;" onclick="changeRole(${x.id}, this)">Set</button>
                    <button class="btn" style="padding:5px 10px;font-size:12px;background:var(--warning-soft);color:var(--warning);border:1px solid #fcd34d;" onclick="toggleActive(${x.id}, this)">Toggle</button>
                    <button class="btn" style="padding:5px 10px;font-size:12px;background:var(--danger-soft);color:var(--danger);border:1px solid #fecaca;" onclick="deleteUser(${x.id})">Delete</button>
                </td>
            </tr>`;
        });
    } catch (_) {}
}

async function changeRole(id, btn) {
    const u = currentUser();
    const role = document.getElementById(`role-${id}`).value;
    setBtnLoading(btn, true, 'Set');
    try {
        const res = await fetch(API + 'admin_users.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_role', user_id: u.id, target_id: id, role })
        });
        const d = await res.json();
        if (d.success) { toast(d.message, 'success'); loadUsers(); }
        else toast(d.message, 'error');
    } catch (_) {}
    finally { setBtnLoading(btn, false, 'Set'); }
}

async function toggleActive(id, btn) {
    const u = currentUser();
    setBtnLoading(btn, true, 'Toggle');
    try {
        const res = await fetch(API + 'admin_users.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle_active', user_id: u.id, target_id: id })
        });
        const d = await res.json();
        if (d.success) { toast(d.message, 'success'); loadUsers(); }
        else toast(d.message, 'error');
    } catch (_) {}
    finally { setBtnLoading(btn, false, 'Toggle'); }
}

async function deleteUser(id) {
    if (!confirm('Delete this user permanently?')) return;
    const u = currentUser();
    try {
        const res = await fetch(API + 'admin_users.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', user_id: u.id, target_id: id })
        });
        const d = await res.json();
        if (d.success) { toast(d.message, 'success'); loadUsers(); }
        else toast(d.message, 'error');
    } catch (_) {}
}

async function createUser() {
    const u = currentUser();
    const btn = event && event.target ? event.target : null;
    const body = {
        action: 'create', user_id: u.id,
        full_name: document.getElementById('cuName').value.trim(),
        email: document.getElementById('cuEmail').value.trim(),
        phone: document.getElementById('cuPhone').value.trim(),
        address: document.getElementById('cuAddress').value.trim(),
        password: document.getElementById('cuPassword').value,
        role: document.getElementById('cuRole').value
    };
    setBtnLoading(btn, true, 'Create User');
    try {
        const res = await fetch(API + 'admin_users.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const d = await res.json();
        if (d.success) {
            toast(d.message, 'success');
            ['cuName','cuEmail','cuPhone','cuAddress','cuPassword'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            setTimeout(() => { nav('users'); loadUsers(); }, 400);
        } else toast(d.message, 'error');
    } catch (_) {}
    finally { setBtnLoading(btn, false, 'Create User'); }
}

async function loadAllComplaintsSA() {
    const u = currentUser();
    const tb = document.getElementById('saComplaints');
    if (!tb) return;
    showTableLoading(tb, 5);
    try {
        const res = await fetch(`${API}complaints.php?user_id=${u.id}&role=superadmin`);
        const d = await res.json();
        tb.innerHTML = '';
        if (!d.success) return;
        if (!d.complaints.length) {
            tb.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:32px;">No complaints yet.</td></tr>';
            return;
        }
        d.complaints.forEach(c => {
            const cls = c.status === 'Pending' ? 'pending' : c.status === 'In Progress' ? 'progress' : 'resolved';
            tb.innerHTML += `<tr>
                <td><strong>${escapeHtml(c.ref_no)}</strong></td>
                <td>${escapeHtml(c.resident_name)}</td>
                <td>${escapeHtml(c.issue_type)}</td>
                <td><span class="status ${cls}">${c.status}</span></td>
                <td>
                    <select class="form-select form-select-sm d-inline-block" style="width:130px;font-size:13px;" id="sa-status-${c.id}">
                        ${['Pending','In Progress','Resolved'].map(s => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <button class="btn btn-blue" style="padding:5px 12px;font-size:12.5px;" onclick="updateComplaintSA(${c.id}, this)">Save</button>
                </td>
            </tr>`;
        });
    } catch (_) {}
}

async function updateComplaintSA(id, btn) {
    const u = currentUser();
    const status = document.getElementById(`sa-status-${id}`).value;
    const remarks = prompt('Remarks (optional):', '') || '';
    setBtnLoading(btn, true, 'Save');
    try {
        const res = await fetch(API + 'complaints.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_status', user_id: u.id, complaint_id: id, status, remarks })
        });
        const d = await res.json();
        if (d.success) { toast(d.message, 'success'); loadAllComplaintsSA(); }
        else toast(d.message, 'error');
    } catch (_) {}
    finally { setBtnLoading(btn, false, 'Save'); }
}

async function postSuperAnnouncement() {
    const u = currentUser();
    const btn = event && event.target ? event.target : null;
    const body = {
        user_id: u.id,
        title: document.getElementById('saAnnTitle').value.trim(),
        message: document.getElementById('saAnnMessage').value.trim(),
        type: document.getElementById('saAnnType').value
    };
    if (!body.title || !body.message) { toast('Title and message required.', 'warning'); return; }
    setBtnLoading(btn, true, 'Post & Broadcast');
    try {
        const res = await fetch(API + 'announcements.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const d = await res.json();
        if (d.success) {
            const msg = d.message + (d.sms_sent !== undefined ? ` · ${d.sms_sent} SMS sent` : '');
            toast(msg, 'success');
            document.getElementById('saAnnTitle').value = '';
            document.getElementById('saAnnMessage').value = '';
        } else toast(d.message, 'error');
    } catch (_) {}
    finally { setBtnLoading(btn, false, 'Post & Broadcast'); }
}