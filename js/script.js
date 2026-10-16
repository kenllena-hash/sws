/* ============================================================
   SWS — Front-End Controller (index.html only)
   ============================================================ */

let currentUser = null;

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
    if (/(success|submitted|created|updated|saved|deleted|changed|welcome)/.test(lower)) type = 'success';
    else if (/(error|fail|invalid|incorrect|not found|denied|wrong)/.test(lower)) type = 'error';
    else if (/(required|please|must|warn|complete)/.test(lower)) type = 'warning';
    toast(msg, type);
};

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
    const saved = sessionStorage.getItem('sws_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            if (currentUser && currentUser.id) applyLoggedInUI();
        } catch (_) { sessionStorage.removeItem('sws_user'); }
    }

    // If we came from register.html via "Back to Register" link
    if (sessionStorage.getItem('openAgreement') === '1') {
        sessionStorage.removeItem('openAgreement');
        showPage('agreement');
    }
});

/* ============================================================
   NAVIGATION
   ============================================================ */
function showPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(pageId);
    if (target) target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================
   UI HELPERS
   ============================================================ */
function applyLoggedInUI() {
    const pub = document.getElementById("publicNav");
    const priv = document.getElementById("privateNav");
    if (pub) pub.style.display = "none";
    if (priv) priv.style.display = "block";
    const nameEl = document.getElementById("welcomeUser");
    if (nameEl && currentUser) {
        const first = (currentUser.full_name || "").split(" ")[0];
        nameEl.textContent = "Hi, " + (first || "there");
    }
}

function applyLoggedOutUI() {
    const pub = document.getElementById("publicNav");
    const priv = document.getElementById("privateNav");
    if (pub) pub.style.display = "block";
    if (priv) priv.style.display = "none";
}

/* ============================================================
   LOGOUT (from home page)
   ============================================================ */
function confirmLogout() {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
        <div class="confirm-box">
            <h3>Sign out</h3>
            <p>Are you sure you want to end your session?</p>
            <div class="confirm-actions">
                <button class="btn" id="confirmNo" style="background:var(--mist);color:var(--ink);border:1px solid var(--line);">Cancel</button>
                <button class="btn btn-blue" id="confirmYes">Sign out</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector("#confirmYes").onclick = () => { overlay.remove(); logout(); };
    overlay.querySelector("#confirmNo").onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
    });
}

function logout() {
    const u = currentUser;
    if (u) {
        try {
            fetch("api/logout.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: u.id })
            }).catch(() => {});
        } catch (_) {}
    }
    currentUser = null;
    sessionStorage.removeItem("sws_user");
    applyLoggedOutUI();
    toast("Signed out.", "info", 1800);
}