import "./styles.css";
import { ensureAuth } from "./firebase.js";
import { subjects, units, buildQuestionBank } from "./data/seedContent.js";
import { awardActivity, getProgress, saveNavigation, upsertProfile } from "./services/progress.js";
import { startPresence, updatePresence } from "./services/presence.js";
import { watchPresence } from "./services/monitor.js";

const app = document.querySelector("#app");
const questionBank = buildQuestionBank();

const state = {
  user: null,
  profile: JSON.parse(localStorage.getItem("studentProfile") || "null"),
  studentKey: localStorage.getItem("studentKey") || "",
  subjectCode: localStorage.getItem("subjectCode") || "S22102",
  progress: null,
  currentView: "home",
  currentQuiz: [],
  answers: {},
  teacherOpen: false
};

main().catch((error) => {
  app.innerHTML = `<div class="fatal"><h1>เปิดระบบไม่สำเร็จ</h1><p>${escapeHtml(error.message)}</p></div>`;
});

async function main() {
  state.user = await ensureAuth();
  if (state.profile) {
    state.studentKey = await upsertProfile(state.user, state.profile);
    state.progress = await getProgress(state.user, state.studentKey, state.subjectCode);
    startPresence(state.user, state.studentKey, state.profile);
  }
  render();
}

function render() {
  const subject = subjects.find((item) => item.code === state.subjectCode) || subjects[1];
  app.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">${subject.title}</p>
        <h1>${subject.subtitle}</h1>
      </div>
      <div class="top-actions">
        <button class="icon-btn" data-action="teacher" title="มอนิเตอร์ครู">⚙</button>
        <button class="icon-btn" data-action="font" title="เพิ่มขนาดตัวอักษร">A</button>
      </div>
    </header>
    <main class="shell">
      ${state.profile ? renderDashboard(subject) : renderProfileForm()}
      ${state.teacherOpen ? renderTeacherMonitor() : ""}
    </main>
    <nav class="bottom-nav">
      ${navButton("home", "⌂", "หน้าแรก")}
      ${navButton("learn", "◇", "ด่านเรียน")}
      ${navButton("review", "↻", "ทบทวน")}
      ${navButton("exam", "▤", "จำลองสอบ")}
      ${navButton("progress", "▥", "ก้าวหน้า")}
    </nav>
  `;
  bindEvents();
  if (state.teacherOpen) bindTeacherMonitor();
}

function renderProfileForm() {
  return `
    <section class="panel profile-panel">
      <h2>ข้อมูลนักเรียน</h2>
      <p>กรอกครั้งเดียว ระบบจะผูกกับ Firebase Auth และจดจำด้วยรหัสนักเรียน/เลขที่/ชื่อ</p>
      <form id="profileForm" class="grid-form">
        <label>ชื่อ-สกุล<input name="fullName" required placeholder="พิมพ์ชื่อและนามสกุล"></label>
          <label>รหัสนักเรียน<input name="studentId" placeholder="ใช้จดจำเมื่อเปลี่ยนเครื่อง" required></label>
        <label>เลขที่<input name="studentNo" required inputmode="numeric"></label>
        <label>ระดับชั้น<select name="grade">${range(1, 6).map((n) => `<option>ม.${n}</option>`).join("")}</select></label>
        <label>ห้อง<select name="room">${range(1, 15).map((n) => `<option>${n}</option>`).join("")}</select></label>
        <label>รายวิชา<select name="subjectCode">${subjects.map((s) => `<option value="${s.code}" ${s.code === state.subjectCode ? "selected" : ""}>${s.title}</option>`).join("")}</select></label>
        <button class="primary" type="submit">บันทึกและเริ่มเรียน</button>
      </form>
    </section>
  `;
}

function renderDashboard(subject) {
  const progress = state.progress || {};
  const subjectUnits = units.filter((u) => u.subjectCode === state.subjectCode);
  const total = questionBank.filter((q) => q.subjectCode === state.subjectCode).length;
  const done = (progress.completedActivityIds || []).length;
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  if (state.currentView === "exam") return renderExam(subject);
  if (state.currentView === "progress") return renderProgress(percent, done, total);
  if (state.currentView === "review") return renderReview();
  return `
    <section class="hero">
      <div>
        <p class="pill">${subject.title}</p>
        <h2>เรียนต่อจากจุดล่าสุดอย่างมั่นใจ</h2>
        <p>ระบบใหม่เก็บความคืบหน้าใน Firestore และใช้ transaction กัน XP ลดหรือข้อมูลหาย</p>
      </div>
      <div class="score-card"><strong>${percent}%</strong><span>ความคืบหน้า</span></div>
      <div class="score-card"><strong>${progress.xp || 0}</strong><span>XP</span></div>
    </section>
    <section class="panel">
      <div class="section-head">
        <h2>ด่านเรียน</h2>
        <button class="ghost" data-action="quick-exam">ทดสอบด่วน 10 ข้อ</button>
      </div>
      <div class="unit-grid">
        ${subjectUnits.map((unit) => renderUnitCard(unit, progress)).join("")}
      </div>
    </section>
  `;
}

function renderUnitCard(unit, progress) {
  const completed = (progress.completedUnitIds || []).includes(unit.id);
  const current = progress.currentUnitId === unit.id;
  return `
    <article class="unit-card ${current ? "current" : ""}">
      <span class="unit-order">${String(unit.order).padStart(2, "0")}</span>
      <h3>${unit.title}</h3>
      <p>${unit.summary}</p>
      <button data-action="start-unit" data-unit="${unit.id}">${completed ? "ทบทวน" : current ? "เรียนต่อ" : "เปิดด่าน"}</button>
    </article>
  `;
}

function renderExam(subject) {
  if (!state.currentQuiz.length) {
    state.currentQuiz = pickQuestions(state.subjectCode, 10);
    state.answers = {};
  }
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2>แบบทดสอบจำลอง</h2>
          <p>${subject.title} ระบบสุ่มจากคลังสถานการณ์ curated</p>
        </div>
        <button class="ghost" data-action="new-exam">สุ่มชุดใหม่</button>
      </div>
      <div class="quiz-list">
        ${state.currentQuiz.map((q, index) => renderQuestion(q, index)).join("")}
      </div>
      <button class="primary" data-action="submit-exam">ส่งคำตอบ</button>
    </section>
  `;
}

function renderQuestion(question, index) {
  return `
    <article class="question-card">
      <h3>ข้อ ${index + 1}</h3>
      <p>${question.prompt}</p>
      <div class="choices">
        ${question.choices.map((choice) => `
          <label class="choice">
            <input type="radio" name="${question.id}" value="${choice.key}" ${state.answers[question.id] === choice.key ? "checked" : ""}>
            <span>${choice.text}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `;
}

function renderProgress(percent, done, total) {
  return `
    <section class="panel">
      <h2>ความก้าวหน้า</h2>
      <div class="meter"><span style="width:${percent}%"></span></div>
      <div class="stats">
        <article><strong>${percent}%</strong><span>สำเร็จ</span></article>
        <article><strong>${state.progress?.xp || 0}</strong><span>XP</span></article>
        <article><strong>${done}/${total}</strong><span>กิจกรรม</span></article>
      </div>
    </section>
  `;
}

function renderReview() {
  const ids = new Set(state.progress?.incorrectActivityIds || []);
  const review = questionBank.filter((q) => ids.has(q.id)).slice(0, 10);
  return `
    <section class="panel">
      <h2>ทบทวนข้อที่พลาด</h2>
      ${review.length ? review.map((q, i) => renderQuestion(q, i)).join("") : "<p>ยังไม่มีข้อที่ต้องทบทวน</p>"}
    </section>
  `;
}

function renderTeacherMonitor() {
  return `
    <aside class="monitor panel">
      <div class="section-head">
        <h2>Teacher Monitor</h2>
        <button class="ghost" data-action="close-teacher">ปิด</button>
      </div>
      <div class="filters">
        <input id="monitorName" placeholder="กรองชื่อ">
        <select id="monitorGrade"><option value="">ทุกชั้น</option>${range(1, 6).map((n) => `<option>ม.${n}</option>`).join("")}</select>
        <select id="monitorRoom"><option value="">ทุกห้อง</option>${range(1, 15).map((n) => `<option>${n}</option>`).join("")}</select>
      </div>
      <div id="monitorRows" class="monitor-rows">กำลังโหลดสถานะสด...</div>
    </aside>
  `;
}

function bindEvents() {
  app.querySelector("#profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    state.profile = data;
    state.subjectCode = data.subjectCode;
    state.studentKey = await upsertProfile(state.user, data);
    localStorage.setItem("studentProfile", JSON.stringify(data));
    localStorage.setItem("studentKey", state.studentKey);
    localStorage.setItem("subjectCode", state.subjectCode);
    state.progress = await getProgress(state.user, state.studentKey, state.subjectCode);
    startPresence(state.user, state.studentKey, data);
    render();
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset));
  });

  app.querySelectorAll("input[type=radio]").forEach((input) => {
    input.addEventListener("change", () => {
      state.answers[input.name] = input.value;
    });
  });
}

async function handleAction(action, data) {
  if (action === "teacher") {
    const pin = prompt("รหัสครู");
    if (pin !== "1234") return;
    state.teacherOpen = true;
    render();
  }
  if (action === "close-teacher") {
    state.teacherOpen = false;
    render();
  }
  if (action === "quick-exam" || action === "new-exam") {
    state.currentView = "exam";
    state.currentQuiz = pickQuestions(state.subjectCode, 10);
    state.answers = {};
    updatePresence(state.user, { currentView: "exam" });
    render();
  }
  if (action === "start-unit") {
    state.currentView = "exam";
    const unitId = data.unit;
    state.currentQuiz = pickQuestions(state.subjectCode, 5, unitId);
    state.answers = {};
    await saveNavigation(state.user, state.studentKey, state.subjectCode, { currentUnitId: unitId });
    updatePresence(state.user, { currentView: `unit:${unitId}` });
    render();
  }
  if (action === "submit-exam") {
    await submitExam();
  }
  if (["home", "learn", "review", "exam", "progress"].includes(action)) {
    state.currentView = action === "learn" ? "home" : action;
    if (action === "exam") state.currentQuiz = [];
    updatePresence(state.user, { currentView: action });
    render();
  }
}

async function submitExam() {
  const selected = state.currentQuiz.filter((q) => state.answers[q.id]);
  if (selected.length !== state.currentQuiz.length) {
    toast("ตอบให้ครบทุกข้อก่อนส่ง");
    return;
  }
  let correct = 0;
  for (const question of state.currentQuiz) {
    const result = await awardActivity(state.user, state.studentKey, state.subjectCode, question, state.answers[question.id], false);
    if (result.isCorrect) correct += 1;
    state.progress = result.progress;
  }
  toast(`ส่งแล้ว ถูก ${correct}/${state.currentQuiz.length} ข้อ`);
  state.currentView = "progress";
  state.currentQuiz = [];
  render();
}

function bindTeacherMonitor() {
  const rowsEl = app.querySelector("#monitorRows");
  const nameEl = app.querySelector("#monitorName");
  const gradeEl = app.querySelector("#monitorGrade");
  const roomEl = app.querySelector("#monitorRoom");
  let rows = [];
  const paint = () => {
    const name = nameEl.value.trim();
    const grade = gradeEl.value;
    const room = roomEl.value;
    const filtered = rows.filter((row) => {
      const profile = row.profile || {};
      return (!name || String(profile.fullName || "").includes(name))
        && (!grade || profile.grade === grade)
        && (!room || profile.room === room);
    });
    rowsEl.innerHTML = filtered.map((row) => {
      const profile = row.profile || {};
      return `<article class="monitor-row ${row.state === "online" ? "online" : "offline"}">
        <strong>${profile.fullName || "ไม่ทราบชื่อ"}</strong>
        <span>${profile.grade || "-"} / ห้อง ${profile.room || "-"} / เลขที่ ${profile.studentNo || "-"}</span>
        <span>${row.state === "online" ? "กำลังใช้งาน" : "ออกจากหน้า"} · ${row.currentView || "-"}</span>
      </article>`;
    }).join("") || "<p>ไม่พบข้อมูลตามตัวกรอง</p>";
  };
  [nameEl, gradeEl, roomEl].forEach((el) => el.addEventListener("input", paint));
  watchPresence((nextRows) => {
    rows = nextRows;
    paint();
  });
}

function pickQuestions(subjectCode, count, unitId = "") {
  const pool = questionBank.filter((q) => q.subjectCode === subjectCode && (!unitId || q.unitId === unitId));
  return shuffle(pool).slice(0, count);
}

function navButton(action, icon, label) {
  return `<button class="${state.currentView === action ? "active" : ""}" data-action="${action}"><span>${icon}</span>${label}</button>`;
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
