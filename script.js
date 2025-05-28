// --- Global state ---
let members = [];
let leaves = [];
let nextId = 1;

// --- Firebase Realtime Sync ---

// Listen for member changes
db.ref('members').on('value', snapshot => {
  members = snapshot.val() || [];
  renderMemberListPanel();
  renderCalendar();
});

// Listen for leave changes
db.ref('leaves').on('value', snapshot => {
  leaves = snapshot.val() || [];
  // Recalculate nextId
  nextId = leaves.length ? Math.max(...leaves.map(l => l.id)) + 1 : 1;
  renderCalendar();
});

// --- Member List Panel (no delete symbol as requested) ---
function renderMemberListPanel() {
  const panel = document.getElementById('member-list-panel');
  if (!members.length) {
    panel.innerHTML = `<span class="member-list-label">No teammates yet. Click "Add Teammate".</span>`;
    return;
  }
  panel.innerHTML = `<span class="member-list-label">Teammates:</span> ` +
    members.map((m) => `
      <span class="member-chip">${m}</span>
    `).join('');
}

// --- Calendar ---
let calendar;
function renderCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (calendar) calendar.destroy();
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 470,
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    events: leaves.map(l => ({
      id: String(l.id),
      title: l.name + ": " + l.reason,
      start: l.from,
      end: new Date(new Date(l.to).setDate(new Date(l.to).getDate() + 1))
      color: stringToColor(l.name),
      extendedProps: l
    })),
    eventContent: function(arg) {
      let leave = arg.event.extendedProps;
      let el = document.createElement('span');
      el.innerHTML = `
        ${arg.event.title}
        <button class="delete-btn" onclick="deleteLeave(${leave.id})">x</button>
      `;
      return { domNodes: [el] };
    }
  });
  calendar.render();
}

// --- Delete Leave ---
window.deleteLeave = function(id) {
  if (confirm("Delete this leave?")) {
    leaves = leaves.filter(l => l.id !== id);
    db.ref('leaves').set(leaves);
    // No need to call renderCalendar, listener will update UI
  }
};

// --- Modal Logic ---
const modalBg = document.getElementById('modal-bg');
const modalContent = document.getElementById('modal-content');
function showModal(html, onShow) {
  modalContent.innerHTML = html;
  modalBg.style.display = 'flex';
  if (onShow) onShow();
}
function hideModal() {
  modalBg.style.display = 'none';
}
modalBg.onclick = function(e) {
  if (e.target === modalBg) hideModal();
};

// --- Add Leave Modal ---
document.getElementById('add-leave-btn').onclick = function() {
  if (members.length === 0) {
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
    document.getElementById('leave-form').onsubmit = function(e) {
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
      db.ref('leaves').set(leaves);
      hideModal();
      // Listener will update UI
    };
    document.getElementById('cancel-btn').onclick = hideModal;
  });
};

// --- Add Member Modal ---
document.getElementById('add-member-btn').onclick = function() {
  showModal(`
    <h3>Add Teammate</h3>
    <form id="member-form" autocomplete="off">
      <label for="member-in">Name</label>
      <input id="member-in" type="text" required placeholder="Enter teammate name"><br>
      <button type="submit">Add</button>
      <button class="cancel-btn" type="button" id="cancel-btn">Cancel</button>
    </form>
  `, () => {
    document.getElementById('member-form').onsubmit = function(e) {
      e.preventDefault();
      const name = document.getElementById('member-in').value.trim();
      if (!name) return;
      if (members.includes(name)) {
        alert("Teammate already exists.");
        return;
      }
      members.push(name);
      db.ref('members').set(members);
      hideModal();
      // Listener will update UI
    };
    document.getElementById('cancel-btn').onclick = hideModal;
  });
};

// --- Utility: String to pretty color ---
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  let color = '#';
  for (let i = 0; i < 3; i++)
    color += ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)).slice(-2);
  return color;
}
