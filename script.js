const API_URL = 'http://localhost:5000/api';
let allMembers = [];
let checkedInUserIds = [];
let currentFilter = 'all';
let html5QrScanner = null;

const EXERCISE_LIBRARY = {
    'Chest': ['Bench Press', 'Incline Dumbbell Press', 'Chest Flyes', 'Push-ups', 'Cable Crossover'],
    'Back': ['Lat Pulldown', 'Barbell Rows', 'Deadlift', 'Pull-ups', 'Seated Cable Row'],
    'Legs': ['Barbell Squats', 'Leg Press', 'Hamstring Curls', 'Lunges', 'Calf Raises'],
    'Shoulders': ['Overhead Military Press', 'Lateral Raises', 'Front Raises', 'Face Pulls'],
    'Biceps': ['Barbell Curls', 'Hammer Curls', 'Preacher Curls', 'Incline Dumbbell Curls'],
    'Triceps': ['Triceps Pushdown', 'Skull Crushers', 'Overhead Triceps Extension'],
    'Abs/Core': ['Crunches', 'Plank Hold', 'Leg Raises', 'Ab Wheel Rollout']
};

// ================= AUTH CHECK =================
function checkAdminAuth() {
    const token = localStorage.getItem('gympilot_admin_token');
    if (!token && window.location.pathname.includes('dashboard.html')) {
        alert('⚠️ Access Denied! Please login as Admin first.');
        window.location.href = 'login.html';
    }
}

function logoutAdmin() {
    localStorage.removeItem('gympilot_admin_token');
    alert('Logged out from Admin Portal!');
    window.location.href = 'login.html';
}

// ================= THEME SWITCHER =================
function changeCyberTheme(colorTheme) {
    const orb1 = document.querySelector('.orb-1');
    const orb2 = document.querySelector('.orb-2');
    const logoSpan = document.querySelector('.brand-logo span');

    if (colorTheme === 'green') {
        if (orb1) orb1.style.background = '#10b981';
        if (orb2) orb2.style.background = '#059669';
        if (logoSpan) logoSpan.style.background = 'linear-gradient(135deg, #34d399, #10b981)';
    } else if (colorTheme === 'purple') {
        if (orb1) orb1.style.background = '#8b5cf6';
        if (orb2) orb2.style.background = '#6d28d9';
        if (logoSpan) logoSpan.style.background = 'linear-gradient(135deg, #c084fc, #8b5cf6)';
    } else {
        if (orb1) orb1.style.background = '#3b82f6';
        if (orb2) orb2.style.background = '#10b981';
        if (logoSpan) logoSpan.style.background = 'linear-gradient(135deg, #10b981, #3b82f6)';
    }
}

// ================= REGISTER MEMBER =================
async function registerUser(event) {
    if (event) event.preventDefault();

    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const plan = document.getElementById('plan')?.value || '1 Month';

    if (!name || !email) {
        alert('❌ Fill Name and Email!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, plan })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert(`🎉 Member Registered! ID: ${result.userId}`);
            const price = plan === '1 Year' ? '12,000' : plan === '3 Months' ? '3,500' : '1,500';
            generateReceipt(name, plan, price, new Date().toISOString().split('T')[0]);
            document.getElementById('registerForm')?.reset();
            if (typeof loadDashboardMembers === 'function') loadDashboardMembers();
        } else {
            alert('❌ Registration Failed: ' + result.message);
        }
    } catch (error) {
        alert('❌ Server Error!');
    }
}

// ================= RENEW MEMBERSHIP =================
function renewMembership(userId, currentName, currentPlan) {
    const modal = document.getElementById('renewModal');
    if (modal) {
        document.getElementById('renewUserId').value = userId;
        document.getElementById('renewUserName').value = currentName;
        document.getElementById('renewMemberText').innerText = `Extending plan for: ${currentName}`;
        document.getElementById('renewPlanSelect').value = currentPlan || '1 Month';
        modal.style.display = 'flex';
    }
}

function closeRenewModal() {
    document.getElementById('renewModal').style.display = 'none';
}

async function submitRenewal() {
    const userId = document.getElementById('renewUserId')?.value;
    const currentName = document.getElementById('renewUserName')?.value;
    const selectedPlan = document.getElementById('renewPlanSelect')?.value;

    try {
        const response = await fetch(`${API_URL}/users/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(userId), plan: selectedPlan })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            alert(`✅ Membership Extended for ${currentName}!`);
            const price = selectedPlan === '1 Year' ? '12,000' : selectedPlan === '3 Months' ? '3,500' : '1,500';
            generateReceipt(currentName, selectedPlan, price, result.start_date);
            closeRenewModal();
            loadDashboardMembers();
        } else {
            alert('❌ Renewal Failed: ' + result.message);
        }
    } catch (err) {
        alert('❌ Server Connection Error!');
    }
}

// ================= LOAD DASHBOARD & MEMBERS TABLE =================
async function loadDashboardMembers() {
    const tableBody = document.getElementById('membersTableBody');
    if (!tableBody) return;

    try {
        const attRes = await fetch(`${API_URL}/attendance/today`);
        const attData = await attRes.json();
        if (attData.success) {
            checkedInUserIds = attData.checkedInUsers || [];
            document.getElementById('todayCheckInsCount').innerText = attData.count;
        }

        const trRes = await fetch(`${API_URL}/trainers`);
        const trData = await trRes.json();
        if (trData.success) {
            document.getElementById('totalTrainersCount').innerText = trData.data.length;
        }

        const response = await fetch(`${API_URL}/users`);
        const result = await response.json();

        if (result.success && result.data) {
            allMembers = result.data;
            document.getElementById('totalMembersCount').innerText = allMembers.length;
            renderMembersTable();
            populateWorkoutMemberDropdown(allMembers);
        }
    } catch (err) {
        tableBody.innerHTML = '<tr><td colspan="9" style="color: red; text-align: center;">Failed to load server data!</td></tr>';
    }
}

function filterMembers(type) {
    currentFilter = type;
    document.getElementById('filterAllBtn').classList.remove('active');
    document.getElementById('filterActiveBtn').classList.remove('active');
    document.getElementById('filterExpiredBtn').classList.remove('active');

    if (type === 'active') document.getElementById('filterActiveBtn').classList.add('active');
    else if (type === 'expired') document.getElementById('filterExpiredBtn').classList.add('active');
    else document.getElementById('filterAllBtn').classList.add('active');

    renderMembersTable();
}

function renderMembersTable() {
    const tableBody = document.getElementById('membersTableBody');
    if (!tableBody) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const query = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

    let list = allMembers.filter(u => 
        (u.name && u.name.toLowerCase().includes(query)) || 
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.phone && u.phone.includes(query))
    );

    if (currentFilter === 'active') {
        list = list.filter(u => !u.expiry_date || u.expiry_date >= todayStr);
    } else if (currentFilter === 'expired') {
        list = list.filter(u => u.expiry_date && u.expiry_date < todayStr);
    }

    if (list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #64748b;">No matching records found.</td></tr>';
        return;
    }

    tableBody.innerHTML = '';
    list.forEach(user => {
        const isExpired = user.expiry_date && user.expiry_date < todayStr;
        const isCheckedIn = checkedInUserIds.includes(user.id);

        const statusBadge = isExpired 
            ? `<span style="background: rgba(220, 53, 69, 0.2); color: #ff6b6b; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">Expired</span>`
            : `<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">Active</span>`;

        const attendanceBtn = isCheckedIn
            ? `<span style="color: #34d399; font-weight: 700; font-size: 12px;">✔ Checked-In</span>`
            : `<button type="button" onclick="markAttendance(${user.id})" style="background: #3b82f6; color: white; border: none; padding: 5px 10px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px;">Check-In</button>`;

        const whatsappBtn = isExpired && user.phone
            ? `<button type="button" onclick="sendWhatsappReminder('${user.name}', '${user.phone}')" style="background: rgba(37, 211, 102, 0.2); color: #25D366; border: 1px solid rgba(37, 211, 102, 0.4); padding: 5px 8px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px;">💬 Reminder</button>`
            : '';

        const price = user.plan === '1 Year' ? '12,000' : user.plan === '3 Months' ? '3,500' : '1,500';

        tableBody.innerHTML += `
            <tr>
                <td>${user.id}</td>
                <td><strong>${user.name}</strong></td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td><span style="background: rgba(255, 255, 255, 0.05); padding: 4px 8px; border-radius: 6px;">${user.plan || '1 Month'}</span></td>
                <td>${user.trainer || 'None'}</td>
                <td>${user.expiry_date || 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                        ${attendanceBtn}
                        <button type="button" onclick="showMemberQrPass(${user.id}, '${user.name}')" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 5px 8px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px;">🎫 QR Pass</button>
                        <button type="button" onclick="renewMembership(${user.id}, '${user.name}', '${user.plan}')" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 5px 8px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px;">🔄 Renew</button>
                        ${whatsappBtn}
                        <button type="button" onclick="openUserWorkoutHistory(${user.id})" style="background: rgba(139, 92, 246, 0.2); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.4); padding: 5px 8px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px;">🏋️ Workout</button>
                        <button type="button" onclick="generateReceipt('${user.name}', '${user.plan || '1 Month'}', '${price}', '${user.start_date || todayStr}')" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); padding: 5px 8px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px;">📄 PDF</button>
                        <button type="button" onclick="deleteMember(${user.id})" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 5px 8px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 12px;">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// ================= QR SCANNER & DIGITAL PASS =================
function openQrScannerModal() {
    document.getElementById('qrScannerModal').style.display = 'flex';
    document.getElementById('qrScanResult').innerText = 'Initializing Camera...';

    html5QrScanner = new Html5QrcodeScanner("qrReader", { fps: 10, qrbox: { width: 220, height: 220 } });
    html5QrScanner.render((decodedText) => {
        const userId = decodedText.replace('GYMPILOT_USER_', '').trim();
        markAttendance(parseInt(userId));
        document.getElementById('qrScanResult').innerText = `Scanned User ID: ${userId}`;
        setTimeout(() => closeQrScannerModal(), 1500);
    }, (err) => {});
}

function closeQrScannerModal() {
    if (html5QrScanner) html5QrScanner.clear();
    document.getElementById('qrScannerModal').style.display = 'none';
}

function showMemberQrPass(userId, name) {
    document.getElementById('passMemberName').innerText = name;
    document.getElementById('passMemberId').innerText = `GymPilot Digital Pass (ID: ${userId})`;
    
    const qrContainer = document.getElementById('qrcodeDisplay');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: `GYMPILOT_USER_${userId}`, width: 170, height: 170 });
    
    document.getElementById('qrPassModal').style.display = 'flex';
}

function closeQrPassModal() {
    document.getElementById('qrPassModal').style.display = 'none';
}

// ================= TRAINER MANAGEMENT =================
function openTrainerModal() {
    document.getElementById('trainerModal').style.display = 'flex';
    loadTrainerList();
}

function closeTrainerModal() {
    document.getElementById('trainerModal').style.display = 'none';
}

async function loadTrainerList() {
    const listDiv = document.getElementById('trainerList');
    try {
        const res = await fetch(`${API_URL}/trainers`);
        const data = await res.json();
        if (data.success) {
            listDiv.innerHTML = data.data.map(t => `
                <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
                    <div><strong>${t.name}</strong> <span style="color: #fbbf24; font-size: 11px;">(${t.specialization})</span></div>
                    <span style="color: #94a3b8; font-size: 12px;">📞 ${t.phone || 'N/A'}</span>
                </div>
            `).join('');
        }
    } catch(e){}
}

async function addTrainer(e) {
    e.preventDefault();
    const name = document.getElementById('trName').value;
    const specialization = document.getElementById('trSpec').value;
    const phone = document.getElementById('trPhone').value;

    const res = await fetch(`${API_URL}/trainers/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, specialization, phone })
    });
    const data = await res.json();
    if (data.success) {
        alert('✅ Trainer Added!');
        loadTrainerList();
    }
}

// ================= WHATSAPP REMINDER =================
function sendWhatsappReminder(name, phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(`Hi ${name}, your GymPilot membership plan has EXPIRED. Please renew your membership to continue gym access.`);
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
}

// ================= EXPORT TO CSV =================
function exportToCSV() {
    if (allMembers.length === 0) return alert('No data to export!');

    let csvContent = "data:text/csv;charset=utf-8,ID,Name,Email,Phone,Plan,Trainer,Expiry Date\n";
    allMembers.forEach(m => {
        csvContent += `${m.id},"${m.name}","${m.email}","${m.phone || ''}","${m.plan || ''}","${m.trainer || ''}","${m.expiry_date || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GymPilot_Members_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ================= PDF RECEIPT =================
function generateReceipt(memberName, planName, amount, date) {
    const receiptHtml = `
        <div style="padding: 30px; font-family: Arial, sans-serif; background: #0f172a; color: #fff; border-radius: 12px; width: 380px; border: 2px solid #3b82f6;">
            <h2 style="color: #3b82f6; margin-bottom: 5px; text-align: center;">GymPilot Fitness</h2>
            <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-bottom: 20px;">Official Membership Invoice</p>
            <hr style="border-color: #334155; margin-bottom: 20px;">
            <p style="margin: 8px 0;"><strong>Member Name:</strong> ${memberName}</p>
            <p style="margin: 8px 0;"><strong>Plan Selected:</strong> ${planName}</p>
            <p style="margin: 8px 0;"><strong>Registration Date:</strong> ${date}</p>
            <p style="margin: 8px 0;"><strong>Payment Status:</strong> <span style="color: #34d399;">PAID</span></p>
            <hr style="border-color: #334155; margin: 20px 0;">
            <h3 style="color: #60a5fa; text-align: right;">Total Paid: ₹${amount}</h3>
        </div>
    `;

    const opt = {
        margin: 0.5,
        filename: `${memberName.replace(/\s+/g, '_')}_Invoice.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    if (typeof html2pdf !== 'undefined') html2pdf().from(receiptHtml).set(opt).save();
}

// ================= WORKOUT LOGS & UTILS =================
function openWorkoutModal() { document.getElementById('workoutModal').style.display = 'flex'; renderExerciseGuide(); updateExerciseDropdown(); }
function closeWorkoutModal() { document.getElementById('workoutModal').style.display = 'none'; }
function switchWorkoutTab(tab) {
    document.getElementById('workoutGuideSection').style.display = tab === 'guide' ? 'block' : 'none';
    document.getElementById('workoutLogSection').style.display = tab === 'log' ? 'block' : 'none';
}
function renderExerciseGuide() {
    const bp = document.getElementById('guideBodyPart')?.value || 'Chest';
    const list = EXERCISE_LIBRARY[bp] || [];
    document.getElementById('exerciseListDisplay').innerHTML = list.map(e => `<div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; text-align: center;"><strong>${e}</strong></div>`).join('');
}
function updateExerciseDropdown() {
    const bp = document.getElementById('logBodyPartSelect')?.value || 'Chest';
    document.getElementById('logExerciseSelect').innerHTML = (EXERCISE_LIBRARY[bp] || []).map(e => `<option value="${e}">${e}</option>`).join('');
}
function populateWorkoutMemberDropdown(members) {
    const s = document.getElementById('logMemberSelect');
    if (s) {
        s.innerHTML = members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        if (members.length > 0) loadUserWorkoutLogs(members[0].id);
    }
}
async function saveWorkoutLog(e) {
    e.preventDefault();
    const user_id = document.getElementById('logMemberSelect').value;
    const body_part = document.getElementById('logBodyPartSelect').value;
    const exercise_name = document.getElementById('logExerciseSelect').value;
    const sets = document.getElementById('logSets').value;
    const reps = document.getElementById('logReps').value;
    const weight_kg = document.getElementById('logWeight').value;

    const res = await fetch(`${API_URL}/workouts/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(user_id), body_part, exercise_name, sets: parseInt(sets), reps: parseInt(reps), weight_kg: parseFloat(weight_kg) })
    });
    if ((await res.json()).success) { alert('✅ Workout Logged!'); loadUserWorkoutLogs(user_id); }
}
async function loadUserWorkoutLogs(userId) {
    const res = await fetch(`${API_URL}/workouts/user/${userId}`);
    const data = await res.json();
    if (data.success) {
        document.getElementById('workoutHistoryTableBody').innerHTML = data.data.map(w => `
            <tr><td style="padding: 6px;">${w.log_date}</td><td style="padding: 6px;">${w.body_part}</td><td style="padding: 6px;"><strong>${w.exercise_name}</strong></td><td style="padding: 6px;">${w.sets}x${w.reps}</td><td style="padding: 6px; color: #34d399;">${w.weight_kg}kg</td></tr>
        `).join('');
    }
}
function openUserWorkoutHistory(u) { openWorkoutModal(); switchWorkoutTab('log'); document.getElementById('logMemberSelect').value = u; loadUserWorkoutLogs(u); }

// ================= ATTENDANCE & DELETE =================
async function markAttendance(userId) {
    const res = await fetch(`${API_URL}/attendance/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
    });
    const data = await res.json();
    alert(data.message);
    loadDashboardMembers();
}
async function deleteMember(id) {
    if (!confirm(`Delete Member ID: ${id}?`)) return;
    const res = await fetch(`${API_URL}/users/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if ((await res.json()).success) loadDashboardMembers();
}

function searchMembers() { renderMembersTable(); }
function openBmiModal() { document.getElementById('bmiModal').style.display = 'flex'; }
function closeBmiModal() { document.getElementById('bmiModal').style.display = 'none'; }
function calculateBmi() {
    const w = parseFloat(document.getElementById('bmiWeight').value);
    const h = parseFloat(document.getElementById('bmiHeight').value)/100;
    if (w && h) {
        const bmi = (w / (h * h)).toFixed(1);
        document.getElementById('bmiScore').innerText = bmi;
        document.getElementById('bmiResultBox').style.display = 'block';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    if (document.getElementById('membersTableBody')) {
        loadDashboardMembers();
    }
});