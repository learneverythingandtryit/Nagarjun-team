const ADMIN_PASSWORD = "admin123"; // Change this in production

const SHIFT_TYPES = [
  {
    key: "Morning Shift3",
    label: "Morning Shift3",
    timing: "6:00 AM – 3:30 PM IST",
    emoji: "🌅",
    order: 1
  },
  {
    key: "Regular Shift (WFO)",
    label: "Regular Shift (WFO)",
    timing: "8:30 AM – 6:00 PM IST",
    emoji: "☀️",
    order: 2
  },
  {
    key: "Evening Shift2",
    label: "Evening Shift2",
    timing: "2:30 PM – 12:00 AM IST",
    order: 3
  },
  {
    key: "Evening Shift3",
    label: "Evening Shift3",
    timing: "3:30 PM – 1:00 AM IST",
    emoji: "🌃",
    order: 4
  }
];

const APPLICATIONS = [
  "RegOne",
  "Claims",
  "mSafety"
];

// --- State ---
let members = [];
let leaves = [];
let nextId = 1;
let auditLog = [];
let hariReplies = {};
let hariChatLog = [];
let shifts = {};

// --- Tab Navigation & Bot Widget ---
function handleTabSwitch() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = function () {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
      document.getElementById(this.dataset.tab).classList.add('active');
      document.getElementById('hari-bot-widget').style.display = (this.dataset.tab === "home-tab" ? "block" : "none");
    };
  });
}
handleTabSwitch();
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hari-bot-widget').style.display = "block";
});

// --- Firebase Sync ---
firebase.database().ref('members').on('value', snapshot => {
  members = snapshot.val() || [];
  renderUnityGroupPanel();
  renderCalendar();
  renderShiftDisplay();
  renderAdminShiftAssignPanel();
});
firebase.database().ref('leaves').on('value', snapshot => {
  leaves = snapshot.val() || [];
  nextId = leaves.length ? Math.max(...leaves.map(l => l.id)) + 1 : 1;
  renderCalendar();
});
firebase.database().ref('audit').on('value', snapshot => {
  auditLog = snapshot.val() || [];
  renderAuditLog();
});
firebase.database().ref('hariReplies').on('value', snapshot => {
  hariReplies = snapshot.val() || {};
  renderAdminRepliesTable();
});
firebase.database().ref('hariChatLog').on('value', snapshot => {
  hariChatLog = [];
  if (snapshot.exists()) {
    snapshot.forEach(snap => {
      let arr = snap.val();
      if (Array.isArray(arr)) arr.forEach(msg => hariChatLog.push(msg));
      else hariChatLog.push(arr);
    });
  }
  renderAdminChatLogTable();
});
firebase.database().ref('shifts').on('value', snapshot => {
  shifts = snapshot.val() || {};
  renderShiftDisplay();
  renderAdminShiftAssignPanel();
});

// --- Utility ---
function safeSet(refKey, val, actionType, actionDetail) {
  firebase.database().ref(refKey).set(val).then(() => logAudit(actionType, actionDetail));
}
function logAudit(action, detail) {
  const now = new Date();
  const entry = { action, detail, time: now.toISOString() };
  firebase.database().ref('audit').transaction(logs => {
    if (!logs) logs = [];
    logs.push(entry);
    return logs;
  });
}
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// --- Audit Log ---
function renderAuditLog() {
  const container = document.getElementById('audit-log-table');
  if (!auditLog.length) {
    container.innerHTML = "<em>No audit records yet.</em>";
    return;
  }
  container.innerHTML = `<table><thead>
    <tr><th>Action</th><th>Details</th><th>Time</th></tr>
    </thead><tbody>
    ${auditLog.slice().reverse().map(e => `<tr>
      <td>${e.action}</td>
      <td>${e.detail}</td>
      <td>${new Date(e.time).toLocaleString()}</td>
    </tr>`).join("")}
    </tbody></table>`;
}
document.addEventListener('DOMContentLoaded', () => {
  const clearAuditBtn = document.getElementById('clear-auditlog-btn');
  if (clearAuditBtn) {
    clearAuditBtn.onclick = () => {
      if (confirm("Are you sure you want to clear the entire audit log?")) {
        firebase.database().ref('audit').set([]);
        logAudit('Clear Audit Log', 'Audit log cleared by admin');
      }
    };
  }
  const clearChatBtn = document.getElementById('clear-chatlog-btn');
  if (clearChatBtn) {
    clearChatBtn.onclick = () => {
      if (confirm("Are you sure you want to clear the entire chat log?")) {
        firebase.database().ref('hariChatLog').set(null);
        logAudit('Clear Chat Log', 'Chat log cleared by admin');
      }
    };
  }
});

// --- Teammate Unity Group Panel ---
function renderUnityGroupPanel() {
  const panel = document.getElementById('unity-group-panel');
  if (!members.length) {
    panel.innerHTML = `<span class="unity-group-label">No teammates yet. Click "Add Teammate".</span>`;
    return;
  }
  panel.innerHTML =
    `<span class="unity-group-label">Teammates:</span>` +
    `<div class="unity-group">` +
    members.map(fullname => {
      let init = getInitials(fullname);
      let isLong = init.length > 1 ? 'data-long="true"' : '';
      return `
        <div class="avatar" title="${fullname}">
          <span class="avatar-initials" ${isLong}>${init}</span>
          <span class="avatar-name" title="${fullname}">${fullname}</span>
        </div>
      `;
    }).join('') +
    `</div>`;
}

// --- Calendar/Leave ---
let calendar;
function addOneDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function renderCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  if (calendar) calendar.destroy();
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto', // or 400
    dayMaxEventRows: 5,
    eventMaxStack: 1,
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    events: leaves.map(l => ({
      id: String(l.id),
      title: l.name,
      start: l.from,
      end: addOneDay(l.to),
      display: 'block',
      color: "#000",
      textColor: "#fff",
      extendedProps: l
    })),
    eventContent: function (arg) {
      const leave = arg.event.extendedProps;
      let el = document.createElement('span');
      el.className = "event-chip";
      el.innerHTML = `
        <span class="event-title" title="${leave.reason || ''}">${arg.event.title}</span>
      `;
      return { domNodes: [el] };
    },
    eventClick: function (info) {
      const leave = info.event.extendedProps;
      showModal(`
        <h3>Edit Leave</h3>
        <form id="edit-leave-form" autocomplete="off">
          <label for="edit-name-in">Teammate</label>
          <select id="edit-name-in" required>
            ${members.map(m => `<option value="${m}" ${m === leave.name ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <label for="edit-from-in">From</label>
          <input id="edit-from-in" type="date" required value="${leave.from}"><br>
          <label for="edit-to-in">To</label>
          <input id="edit-to-in" type="date" required value="${leave.to}"><br>
          <label for="edit-reason-in">Reason</label>
          <input id="edit-reason-in" type="text" value="${leave.reason || ''}" required><br>
        <button type="submit">Save</button>
        <button type="button" class="delete-btn" id="delete-leave-btn" style="background:#fff;color:#c00;border-color:#c00;">Delete</button>
        <button class="cancel-btn" type="button" id="cancel-btn">Cancel</button>
        </form>
      `, () => {
        document.getElementById('edit-leave-form').onsubmit = function (e) {
          e.preventDefault();
          const name = document.getElementById('edit-name-in').value;
          const from = document.getElementById('edit-from-in').value;
          const to = document.getElementById('edit-to-in').value;
          const reason = document.getElementById('edit-reason-in').value.trim();
          if (!name || !from || !to || !reason) {
            alert("Please fill all fields.");
            return;
          }
          const idx = leaves.findIndex(l => l.id === leave.id);
          leaves[idx] = { ...leaves[idx], name, from, to, reason };
          safeSet('leaves', leaves, 'Edit Leave', `Edited leave for ${name} (${from} to ${to}), reason: ${reason}`);
          hideModal();
        };
        document.getElementById('delete-leave-btn').onclick = function () {
          if (confirm("Delete this leave?")) {
            const newLeaves = leaves.filter(l => l.id !== leave.id);
            safeSet('leaves', newLeaves, 'Delete Leave', `Deleted leave for ${leave.name} (${leave.from} to ${leave.to})`);
            hideModal();
          }
        };
        document.getElementById('cancel-btn').onclick = hideModal;
      });
    }
  });
  calendar.render();
}

// --- Modal ---
const modalBg = document.getElementById('modal-bg');
const modalContent = document.getElementById('modal-content');
function showModal(html, onShow) {
  modalContent.innerHTML = html;
  modalBg.style.display = 'flex';
  setTimeout(() => {
    const cancelBtn = document.getElementById('cancel-btn') || document.getElementById('cancel-new-reply');
    if (cancelBtn) cancelBtn.onclick = hideModal;
  }, 0);
  if (onShow) onShow();
}
function hideModal() { modalBg.style.display = 'none'; }
modalBg.onclick = function (e) { if (e.target === modalBg) hideModal(); };

// --- Add Leave/Member ---
document.getElementById('add-leave-btn').onclick = function () {
  if (!members.length) {
    alert("Please add at least one teammate first.");
    return;
  }
  showModal(`
    <h3>Add Leave</h3>
    <form id="leave-form" autocomplete="off">
      <label for="name-in">Teammate</label>
      <select id="name-in" required>
        ${members.map(m => `<option value="${m}">${m}</option>`).join('')}
      </select>
      <label for="from-in">From</label>
      <input id="from-in" type="date" required><br>
      <label for="to-in">To</label>
      <input id="to-in" type="date" required><br>
      <label for="reason-in">Reason</label>
      <input id="reason-in" type="text" placeholder="Reason" required><br>
      <button type="submit">Add</button>
      <button class="cancel-btn" type="button" id="cancel-btn">Cancel</button>
    </form>
  `, () => {
    document.getElementById('leave-form').onsubmit = function (e) {
      e.preventDefault();
      const name = document.getElementById('name-in').value;
      const from = document.getElementById('from-in').value;
      const to = document.getElementById('to-in').value;
      const reason = document.getElementById('reason-in').value.trim();
      if (!name || !from || !to || !reason) {
        alert("Please fill all fields.");
        return;
      }
      leaves.push({ id: nextId++, name, from, to, reason });
      safeSet('leaves', leaves, 'Add Leave', `Leave for ${name} (${from} to ${to}), reason: ${reason}`);
      hideModal();
    };
    document.getElementById('cancel-btn').onclick = hideModal;
  });
};
document.getElementById('add-member-btn').onclick = function () {
  showModal(`
    <h3>Add Teammate</h3>
    <form id="member-form" autocomplete="off">
      <label for="member-in">Full Name</label>
      <input id="member-in" type="text" required placeholder="Enter full name"><br>
      <button type="submit">Add</button>
      <button class="cancel-btn" type="button" id="cancel-btn">Cancel</button>
    </form>
  `, () => {
    document.getElementById('member-form').onsubmit = function (e) {
      e.preventDefault();
      const name = document.getElementById('member-in').value.trim();
      if (!name) return;
      if (members.includes(name)) {
        alert("Teammate already exists.");
        return;
      }
      members.push(name);
      safeSet('members', members, 'Add Member', `Added teammate: ${name}`);
      hideModal();
    };
    document.getElementById('cancel-btn').onclick = hideModal;
  });
};

// --- Hari Chatbot ---
const hariWidget = document.getElementById('hari-bot-widget');
const hariIcon = document.getElementById('hari-icon');
const hariChatbox = document.getElementById('hari-chatbox');
const hariMsgList = document.getElementById('hari-chat-messages');
const hariForm = document.getElementById('hari-chat-form');
const hariInput = document.getElementById('hari-chat-input');

hariIcon.onclick = () => {
  hariChatbox.classList.toggle('hidden');
  if (!hariChatbox.classList.contains('hidden')) hariInput.focus();
};
hariIcon.onkeydown = (e) => {
  if (e.key === "Enter" || e.key === " ") {
    hariIcon.click();
    e.preventDefault();
  }
};
document.getElementById('hari-close-btn').onclick = () => {
  hariChatbox.classList.add('hidden');
};
hariForm.onsubmit = function (e) {
  e.preventDefault();
  const query = hariInput.value.trim();
  if (!query) return;
  addHariMsg('user', query);
  hariInput.value = '';
  let bestMatch = '';
  for (let k in hariReplies) {
    if (query.toLowerCase().includes(k.toLowerCase())) {
      bestMatch = hariReplies[k];
      break;
    }
  }
  if (!bestMatch) bestMatch = "I'm not sure, but an admin can add my answer! 😊";
  addHariMsg('bot', bestMatch);
  const now = new Date();
  firebase.database().ref('hariChatLog').push({
    time: now.toISOString(),
    messages: [
      { role: "user", text: query },
      { role: "bot", text: bestMatch }
    ]
  });
};
function addHariMsg(by, text) {
  const div = document.createElement('div');
  div.className = "hari-msg " + by;
  const profile = document.createElement('span');
  profile.className = "hari-profile";
  profile.textContent = by === 'user' ? "🔮" : "🥷🏻";
  const bubble = document.createElement('span');
  bubble.className = "hari-bubble";
  bubble.textContent = text;
  if (by === 'user') {
    div.appendChild(profile);
    div.appendChild(bubble);
  } else {
    div.appendChild(profile);
    div.appendChild(bubble);
  }
  hariMsgList.appendChild(div);
  hariMsgList.scrollTop = hariMsgList.scrollHeight;
}

// --- Admin Panel: Password, Hari Replies, Chat Log, Shifts ---
const adminPanel = document.getElementById('admin-panel');
const adminLoginPanel = document.getElementById('admin-login-panel');
document.getElementById('admin-login-btn').onclick = function () {
  const pwd = document.getElementById('admin-password').value;
  if (pwd === ADMIN_PASSWORD) {
    adminLoginPanel.style.display = "none";
    adminPanel.style.display = "block";
    renderAdminRepliesTable();
    renderAdminChatLogTable();
    renderAdminShiftAssignPanel();
  } else {
    alert("Wrong password!");
  }
};

// --- Admin Hari Replies ---
function renderAdminRepliesTable() {
  const div = document.getElementById('admin-replies-table');
  const keys = Object.keys(hariReplies);
  if (!keys.length) {
    div.innerHTML = "<em>No bot replies yet. Add some!</em>";
    return;
  }
  div.innerHTML = `<table><thead>
    <tr><th>Keyword</th><th>Reply</th><th>Action</th></tr>
    </thead><tbody>
    ${keys.map(key => `<tr>
      <td><input value="${key}" data-key="${key}" class="reply-key" style="width:80px"></td>
      <td><input value="${hariReplies[key]}" data-key="${key}" class="reply-value" style="width:250px"></td>
      <td>
        <button class="edit-reply-btn" data-key="${key}">Save</button>
        <button class="delete-reply-btn" data-key="${key}">Delete</button>
      </td>
    </tr>`).join("")}
    </tbody></table>`;
  document.querySelectorAll('.edit-reply-btn').forEach(btn => {
    btn.onclick = function () {
      const key = this.dataset.key;
      const newKey = div.querySelector(`.reply-key[data-key="${key}"]`).value.trim();
      const newVal = div.querySelector(`.reply-value[data-key="${key}"]`).value.trim();
      if (!newKey || !newVal) return alert("Keyword and reply required.");
      let updated = { ...hariReplies };
      if (key !== newKey) delete updated[key];
      updated[newKey] = newVal;
      safeSet('hariReplies', updated, 'Edit Hari Reply', `Edited reply: ${key} to ${newKey}`);
    };
  });
  document.querySelectorAll('.delete-reply-btn').forEach(btn => {
    btn.onclick = function () {
      const key = this.dataset.key;
      if (!confirm("Delete this reply?")) return;
      let updated = { ...hariReplies };
      delete updated[key];
      safeSet('hariReplies', updated, 'Delete Hari Reply', `Deleted reply: ${key}`);
    };
  });
}
document.getElementById('add-reply-btn').onclick = function () {
  showModal(`
    <h3>Add New Hari Bot Reply</h3>
    <form id="add-reply-form" autocomplete="off">
      <label>Keyword:</label>
      <input id="new-reply-key" required style="width:150px;">
      <label>Reply:</label>
      <textarea id="new-reply-value" required style="width:250px;height:70px;"></textarea><br>
      <button type="submit">Add</button>
      <button type="button" id="cancel-new-reply" class="cancel-btn">Cancel</button>
    </form>
  `, () => {
    document.getElementById('add-reply-form').onsubmit = function (e) {
      e.preventDefault();
      const k = document.getElementById('new-reply-key').value.trim();
      const v = document.getElementById('new-reply-value').value.trim();
      if (!k || !v) return;
      let updated = { ...hariReplies, [k]: v };
      safeSet('hariReplies', updated, 'Add Hari Reply', `Added reply: ${k}`);
      hideModal();
    };
    document.getElementById('cancel-new-reply').onclick = hideModal;
  });
};
document.getElementById('export-replies-btn').onclick = function () {
  const arr = Object.keys(hariReplies).map(k => ({ keyword: k, reply: hariReplies[k] }));
  const csv = Papa.unparse(arr);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'hari_replies.csv'; a.click();
};
document.getElementById('import-replies-btn').onclick = function () {
  document.getElementById('import-replies-input').click();
};
document.getElementById('import-replies-input').onchange = function (ev) {
  const file = ev.target.files[0];
  if (!file) return;
  if (file.name.endsWith('.json')) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const obj = JSON.parse(e.target.result);
        safeSet('hariReplies', obj, 'Import Hari Replies', 'Imported from JSON file');
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
  } else if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
    Papa.parse(file, {
      header: true,
      complete: results => {
        let obj = {};
        results.data.forEach(row => {
          if (row.keyword && row.reply) obj[row.keyword] = row.reply;
        });
        safeSet('hariReplies', obj, 'Import Hari Replies', 'Imported from CSV/Excel file');
      }
    });
  }
};

// --- Admin Chat Log Table & Export ---
function renderAdminChatLogTable() {
  const div = document.getElementById('admin-chatlog-table');
  if (!hariChatLog.length) {
    div.innerHTML = "<em>No chat logs yet.</em>";
    return;
  }
  div.innerHTML = `<table><thead>
    <tr><th>Time</th><th>User Message</th><th>Bot Reply</th></tr>
    </thead><tbody>
    ${hariChatLog.slice().reverse().map(e => {
      if (Array.isArray(e.messages)) {
        const userMsg = (e.messages.find(m => m.role === "user") || {}).text || "";
        const botMsg = (e.messages.find(m => m.role === "bot") || {}).text || "";
        return `<tr>
          <td>${new Date(e.time).toLocaleString()}</td>
          <td>${userMsg}</td>
          <td>${botMsg}</td>
        </tr>`;
      } else {
        return `<tr>
          <td>${new Date(e.time).toLocaleString()}</td>
          <td>${e.query || ""}</td>
          <td>${e.answer || ""}</td>
        </tr>`;
      }
    }).join("")}
    </tbody></table>`;
}
document.getElementById('download-chatlog-btn').onclick = function () {
  if (!hariChatLog.length) return alert("No chat log to export.");
  const arr = hariChatLog.map(e => {
    let userMsg = "", botMsg = "";
    if (Array.isArray(e.messages)) {
      userMsg = (e.messages.find(m => m.role === "user") || {}).text || "";
      botMsg = (e.messages.find(m => m.role === "bot") || {}).text || "";
    } else {
      userMsg = e.query || "";
      botMsg = e.answer || "";
    }
    return {
      time: new Date(e.time).toLocaleString(),
      user: userMsg,
      bot: botMsg,
    };
  });
  const csv = Papa.unparse(arr);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'hari_chat_log.csv'; a.click();
};

// --- Shifts: View (Shift Management Tab) ---
function getSelectedMonthInput(inputId, fallbackMonthStr) {
  const sel = document.getElementById(inputId);
  let val = sel ? sel.value : "";
  if (!val && fallbackMonthStr) return fallbackMonthStr;
  if (!val) {
    const now = new Date();
    val = now.toISOString().slice(0, 7);
  }
  return val;
}
function renderShiftDisplay() {
  const panel = document.getElementById('shift-display-panel');
  if (!panel) return;
  const monthStr = getSelectedMonthInput("shift-month-select");
  document.getElementById("shift-month-select").value = monthStr;

  const appSel = document.getElementById("shift-app-filter");
  const appFilter = appSel ? appSel.value : "All";

  if (!members.length) {
    panel.innerHTML = "<em>No teammates yet.</em>";
    return;
  }
  const shiftMap = (shifts && shifts[monthStr]) || {};
  // Filtering and sorting
  let filtered = members
    .map(name => {
      let shiftRec = shiftMap[name];
      return { name, shiftRec };
    })
    .filter(row => {
      if (!row.shiftRec) return appFilter === "All";
      if (appFilter === "All") return true;
      return row.shiftRec.application === appFilter;
    })
    .sort((a, b) => {
      let aOrder = a.shiftRec ? (SHIFT_TYPES.find(s => s.key === a.shiftRec.type) || { order: 100 }).order : 99;
      let bOrder = b.shiftRec ? (SHIFT_TYPES.find(s => s.key === b.shiftRec.type) || { order: 100 }).order : 99;
      return aOrder - bOrder || a.name.localeCompare(b.name);
    });

  panel.innerHTML = filtered.map(({ name, shiftRec }) => {
    if (!shiftRec) {
      return `<div class="shift-card"><div class="avatar"><span class="avatar-initials">${getInitials(name)}</span></div>
      <div class="shift-info">
        <span class="shift-label">${name}</span>
        <div class="shift-row"><span class="shift-type" style="color:#c00;">No shift assigned</span></div>
      </div></div>`;
    }
    const shiftType = SHIFT_TYPES.find(s => s.key === shiftRec.type) || {};
    const emoji = shiftType.emoji || "❓";
    const timing = shiftType.timing || "";
    let mode = shiftRec.wfh ? `<span class="shift-emoji">🏠</span> <span class="shift-wfh">WFH</span>` : `<span class="shift-emoji">🏢</span> <span class="shift-wfo">WFO</span>`;
    let appLabel = shiftRec.application ? `<b>App:</b> ${shiftRec.application}` : "";
    return `<div class="shift-card">
      <div class="avatar"><span class="avatar-initials">${getInitials(name)}</span></div>
      <div class="shift-info">
        <span class="shift-label">${name}</span>
        <div class="shift-row">
          <span class="shift-emoji">${emoji}</span>
          <span class="shift-type">${shiftRec.type}</span>
          <span class="shift-timing">${timing}</span>
          ${mode}
          <span style="margin-left:12px;">${appLabel}</span>
        </div>
      </div>
    </div>`;
  }).join("");
}
document.getElementById("shift-month-select").onchange = renderShiftDisplay;
document.getElementById("shift-app-filter").onchange = renderShiftDisplay;

// --- Shifts: Admin Assign/Edit (Save All in 1 click) ---
function renderAdminShiftAssignPanel() {
  const panel = document.getElementById('admin-shift-assign-panel');
  if (!panel) return;
  const monthStr = getSelectedMonthInput("admin-shift-month-select");
  document.getElementById("admin-shift-month-select").value = monthStr;
  const shiftMap = (shifts && shifts[monthStr]) || {};

  if (!members.length) {
    panel.innerHTML = "<em>No teammates yet.</em>";
    return;
  }
  panel.innerHTML = `<table>
    <thead>
      <tr><th>Name</th><th>Shift</th><th>WFH/WFO</th><th>Application</th></tr>
    </thead>
    <tbody>
    ${members.map(name => {
      let shiftRec = shiftMap[name] || { type: "", wfh: false, application: "" };
      return `<tr data-name="${name}">
        <td>${name}</td>
        <td>
          <select class="shift-edit-select">
            <option value="">-- Select --</option>
            ${SHIFT_TYPES.map(st => `<option value="${st.key}" ${shiftRec.type === st.key ? "selected" : ""}>${st.label}</option>`).join("")}
          </select>
        </td>
        <td>
          <select class="shift-wfh-select">
            <option value="false" ${!shiftRec.wfh ? "selected" : ""}>🏢 WFO</option>
            <option value="true" ${shiftRec.wfh ? "selected" : ""}>🏠 WFH</option>
          </select>
        </td>
        <td>
          <select class="shift-app-select">
            <option value="">-- Select --</option>
            ${APPLICATIONS.map(app => `<option value="${app}" ${shiftRec.application === app ? "selected" : ""}>${app}</option>`).join("")}
          </select>
        </td>
      </tr>`;
    }).join("")}
    </tbody></table>`;
}
document.getElementById("admin-shift-month-select").onchange = renderAdminShiftAssignPanel;

document.getElementById("admin-shift-save-btn").onclick = function () {
  const monthStr = getSelectedMonthInput("admin-shift-month-select");
  if (!shifts[monthStr]) shifts[monthStr] = {};
  const panel = document.getElementById('admin-shift-assign-panel');
  Array.from(panel.querySelectorAll("tr[data-name]")).forEach(tr => {
    const name = tr.getAttribute("data-name");
    const shiftSel = tr.querySelector(".shift-edit-select");
    const wfhSel = tr.querySelector(".shift-wfh-select");
    const appSel = tr.querySelector(".shift-app-select");
    const type = shiftSel.value;
    const wfh = wfhSel.value === "true";
    const application = appSel.value;
    if (type && application) {
      shifts[monthStr][name] = { type, wfh, application };
    } else {
      delete shifts[monthStr][name]; // Remove if incomplete
    }
  });
  safeSet('shifts', shifts, 'Assign Shifts (Bulk)', `Bulk save of shifts for ${monthStr}`);
  alert("Shifts saved!");
};
