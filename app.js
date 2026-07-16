import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  addDoc, collection, deleteDoc, doc, getDocs, getFirestore, limit, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const today = new Date().toISOString().slice(0, 10);

let user = null;
let students = [];
let assignments = [];
let subjects = [{ code: "ส22101", name: "สังคมศึกษาฯ (พระพุทธ-หน้าที่)" }];
let classes = [];
let profile = { displayName: "ครูสุรเดช ธรรมประโชติ", firstName: "สุรเดช", lastName: "ธรรมประโชติ", position: "ครูผู้สอน", school: "โรงเรียนวัดไร่ขิงวิทยา", department: "สังคมศึกษา ศาสนาและวัฒนธรรม", photoUrl: "" };
let currentAttendance = {};
let currentScores = {};
let unsubscribers = [];

const views = {
  dashboard: ["ศูนย์ข้อมูลชั้นเรียน", "ภาพรวมวันนี้"],
  students: ["ทะเบียนนักเรียน", "นักเรียน ม.2"],
  attendance: ["บันทึกประจำวัน", "เช็กชื่อเข้าเรียน"],
  scores: ["ติดตามผลการเรียน", "งานและคะแนน"]
};

const refs = () => ({
  students: collection(db, "users", user.uid, "students"),
  subjects: collection(db, "users", user.uid, "subjects"),
  assignments: collection(db, "users", user.uid, "assignments"),
  attendance: collection(db, "users", user.uid, "attendance"),
  scores: collection(db, "users", user.uid, "scores"),
  classes: collection(db, "users", user.uid, "classes"),
  assistants: collection(db, "users", user.uid, "assistants"),
  profile: collection(db, "users", user.uid, "profile")
});

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = String(value);
  return node.innerHTML;
}

function toast(message, error = false) {
  const el = document.createElement("div");
  el.className = `toast ${error ? "error" : "success"}`;
  el.innerHTML = `<b>${error ? "!" : "✓"}</b><span>${escapeHtml(message)}</span>`;
  $("#toastRegion").append(el);
  setTimeout(() => el.remove(), 3300);
}

function confirmAction(title, message) {
  $("#confirmTitle").textContent = title; $("#confirmMessage").textContent = message;
  $("#confirmModal").classList.add("open");
  return new Promise((resolve) => {
    const finish = (value) => { $("#confirmModal").classList.remove("open"); resolve(value); };
    $("#confirmAccept").onclick = () => finish(true); $("#confirmCancel").onclick = () => finish(false);
  });
}

function showView(name) {
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === name));
  $$("#nav button").forEach((el) => el.classList.toggle("active", el.dataset.view === name));
  $("#pageEyebrow").textContent = views[name][0];
  $("#pageTitle").textContent = views[name][1];
  $(".sidebar").classList.remove("open");
  if (name === "attendance") loadAttendance();
  if (name === "scores") renderScores();
}

function studentsInRoom(room) {
  return students.filter((s) => String(s.room) === String(room)).sort((a, b) => Number(a.number) - Number(b.number));
}

function renderStudents() {
  const room = $("#studentRoom").value;
  const term = $("#studentSearch").value.trim().toLowerCase();
  const list = students.filter((s) => (room === "all" || String(s.room) === room) &&
    [s.name, s.studentId, s.number].some((v) => String(v || "").toLowerCase().includes(term)));
  $("#studentRows").innerHTML = list.map((s) => `<tr>
    <td>${escapeHtml(s.number)}</td><td>${escapeHtml(s.studentId)}</td>
    <td><strong>${escapeHtml(s.name)}</strong></td><td>${escapeHtml(s.grade)}/${escapeHtml(s.room)}</td>
    <td><span class="badge">กำลังศึกษา</span></td>
    <td><button class="delete-row" data-delete-student="${s.id}" aria-label="ลบนักเรียน">ลบ</button></td>
  </tr>`).join("");
  $("#studentEmpty").hidden = list.length > 0;
  renderDashboard();
}

function renderSubjects() {
  const options = subjects.map((s) => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.code)} ${escapeHtml(s.name)}</option>`).join("");
  ["#attendanceSubject", "#scoreSubject"].forEach((id) => {
    const el = $(id); const old = el.value; el.innerHTML = options; if ([...el.options].some((o) => o.value === old)) el.value = old;
  });
  const formSelect = $("#assignmentForm select[name=subject]");
  formSelect.innerHTML = subjects.map((s) => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.code)} ${escapeHtml(s.name)}</option>`).join("");
}

function renderAssignments() {
  const subject = $("#scoreSubject").value;
  const room = $("#scoreRoom").value;
  const list = assignments.filter((a) => a.subject === subject && String(a.room) === room);
  const selected = $("#assignmentSelect").value;
  $("#assignmentSelect").innerHTML = `<option value="">เลือกงาน/ข้อสอบ</option>` + list.map((a) => `<option value="${a.id}">${escapeHtml(a.title)} (${a.maxScore} คะแนน)</option>`).join("");
  if (list.some((a) => a.id === selected)) $("#assignmentSelect").value = selected;
  $("#assignmentCards").innerHTML = list.map((a) => `<div class="assignment-card ${a.id === $("#assignmentSelect").value ? "active" : ""}"><button data-assignment="${a.id}"><strong>${escapeHtml(a.title)}</strong><small>${a.maxScore} คะแนน · ส่ง ${formatDate(a.dueDate)}</small></button><button class="delete-assignment" data-delete-assignment="${a.id}" aria-label="ลบ ${escapeHtml(a.title)}">×</button></div>`).join("");
  renderScores();
  renderDashboard();
}

function renderDashboard() {
  const present = Object.values(currentAttendance).filter((v) => v === "present").length;
  const checked = Object.keys(currentAttendance).length;
  const other = checked - present;
  const pct = checked ? Math.round((present / checked) * 100) : 0;
  $("#statStudents").textContent = students.length;
  $("#statPresent").textContent = present;
  $("#statPresentPct").textContent = `${pct}%`;
  $("#heroPresent").textContent = `${pct}%`;
  $("#statAbsent").textContent = other;
  $("#statAssignments").textContent = assignments.length;
  const statusCounts = ["present", "late", "leave", "absent"].map((key) => Object.values(currentAttendance).filter((v) => v === key).length);
  const colors = ["#35a978", "#e4ad48", "#548eb8", "#df6c5f"];
  const labels = ["มา", "สาย", "ลา", "ขาด"];
  const total = statusCounts.reduce((a, b) => a + b, 0);
  let angle = 0;
  const stops = statusCounts.map((count, i) => { const start = angle; angle += total ? count / total * 360 : 0; return `${colors[i]} ${start}deg ${angle}deg`; });
  $("#attendanceChart").innerHTML = `<div class="donut" style="background:${total ? `conic-gradient(${stops.join(",")})` : "#edf0ee"}"><strong>${pct}%</strong></div><div class="chart-legend">${labels.map((label, i) => `<span><i style="background:${colors[i]}"></i>${label} <strong>${statusCounts[i]}</strong></span>`).join("")}</div>`;
  const cards = classes.length ? classes : [...new Set(students.map((s) => String(s.room)))].map((room) => ({ room, subject: "ส22101", grade: "ม.2" }));
  $("#classOverview").innerHTML = cards.map((item) => {
    const room = item.room; const count = studentsInRoom(room).length;
    const roomChecked = studentsInRoom(room).filter((s) => currentAttendance[s.id]).length;
    const progress = count ? Math.round(roomChecked / count * 100) : 0;
    return `<div class="class-card"><header><strong>${escapeHtml(item.grade || "ม.2")}/${escapeHtml(room)}</strong><span>${count} คน</span></header><div class="progress"><i style="width:${progress}%"></i></div><span>${escapeHtml(item.subject || "")} · เช็กชื่อ ${progress}%</span></div>`;
  }).join("");
}

function renderProfile() {
  $("#profileName").textContent = profile.firstName ? `ครู${profile.firstName}` : profile.displayName;
  $("#profileRole").textContent = profile.position || "ครูผู้สอน";
  $("#profileAvatar").textContent = `${profile.firstName?.[0] || "ส"}${profile.lastName?.[0] || "ธ"}`;
  $("#profileAvatar").style.backgroundImage = profile.photoUrl ? `url("${profile.photoUrl}")` : "";
  $("#printTeacher").textContent = `( ${profile.displayName || "ครูสุรเดช ธรรมประโชติ"} )`;
  Object.entries(profile).forEach(([key, value]) => { const input = $(`#profileForm [name="${key}"]`); if (input) input.value = value || ""; });
}

function updateRoomOptions() {
  const rooms = [...new Set([...students.map((s) => String(s.room)), ...classes.map((c) => String(c.room))])].filter(Boolean).sort((a, b) => Number(a) - Number(b));
  const finalRooms = rooms.length ? rooms : ["8", "9", "10"];
  ["#studentRoom", "#attendanceRoom", "#scoreRoom", ".room-select"].forEach((selector) => $$(selector).forEach((el) => {
    const old = el.value; const all = el.id === "studentRoom" ? '<option value="all">ทุกห้อง</option>' : "";
    el.innerHTML = all + finalRooms.map((r) => `<option value="${r}">${r}</option>`).join("");
    if ([...el.options].some((o) => o.value === old)) el.value = old;
  }));
}

function attendanceDocId() {
  return `${$("#attendanceDate").value}_${$("#attendanceSubject").value}_${$("#attendanceRoom").value}`;
}

async function loadAttendance() {
  if (!user) return;
  const room = $("#attendanceRoom").value;
  const list = studentsInRoom(room);
  const snapshot = await getDocs(query(refs().attendance, limit(250)));
  const record = snapshot.docs.find((d) => d.id === attendanceDocId());
  currentAttendance = record?.data().statuses || {};
  list.forEach((s) => { if (!currentAttendance[s.id]) currentAttendance[s.id] = "present"; });
  $("#attendanceList").innerHTML = list.map((s) => `<div class="student-attendance" data-student="${s.id}">
    <span class="avatar">${escapeHtml(s.number)}</span><div><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.studentId)}</small></div>
    <div class="status-options">${[["present","มา"],["late","สาย"],["leave","ลา"],["absent","ขาด"]].map(([value, label]) => `<label><input type="radio" name="status-${s.id}" value="${value}" ${currentAttendance[s.id] === value ? "checked" : ""}><span>${label}</span></label>`).join("")}</div>
  </div>`).join("");
  $("#attendanceEmpty").hidden = list.length > 0;
  updateAttendanceSummary();
}

function updateAttendanceSummary() {
  const counts = { present: 0, late: 0, leave: 0, absent: 0 };
  Object.values(currentAttendance).forEach((value) => { if (counts[value] !== undefined) counts[value]++; });
  $("#attendanceSummary").textContent = `มา ${counts.present} · สาย ${counts.late} · ลา ${counts.leave} · ขาด ${counts.absent}`;
  renderDashboard();
}

function renderScores() {
  const assignmentId = $("#assignmentSelect").value;
  const assignment = assignments.find((a) => a.id === assignmentId);
  const list = studentsInRoom($("#scoreRoom").value);
  $("#scoreRows").innerHTML = assignment ? list.map((s) => {
    const value = currentScores[s.id] || {};
    return `<tr data-score-student="${s.id}"><td>${escapeHtml(s.number)}</td><td><strong>${escapeHtml(s.name)}</strong></td>
      <td><select class="status-select"><option value="pending" ${value.status === "pending" ? "selected" : ""}>ยังไม่ส่ง</option><option value="submitted" ${value.status === "submitted" ? "selected" : ""}>ส่งแล้ว</option><option value="late" ${value.status === "late" ? "selected" : ""}>ส่งช้า</option></select></td>
      <td><input class="score-input" type="number" min="0" max="${assignment.maxScore}" value="${value.score ?? ""}" placeholder="/${assignment.maxScore}"></td>
      <td><input class="note-input" value="${escapeHtml(value.note || "")}" placeholder="หมายเหตุ"></td></tr>`;
  }).join("") : "";
  $("#scoreEmpty").hidden = Boolean(assignment && list.length);
}

async function loadScores() {
  if (!user || !$("#assignmentSelect").value) { currentScores = {}; renderScores(); return; }
  const id = $("#assignmentSelect").value;
  const snapshot = await getDocs(query(refs().scores, limit(250)));
  currentScores = snapshot.docs.find((d) => d.id === id)?.data().results || {};
  renderAssignments();
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

function parseCsv(text) {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map((line) => {
    const cells = []; let cell = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = !quoted; else if (ch === "," && !quoted) { cells.push(cell.trim()); cell = ""; } else cell += ch; }
    cells.push(cell.trim()); return cells;
  });
  if (!rows.length) return [];
  const normalized = rows[0].map((h) => h.toLowerCase().replace(/\s/g, ""));
  const aliases = { number: ["number","เลขที่","no"], studentId: ["studentid","รหัสนักเรียน","id"], name: ["name","ชื่อ-นามสกุล","ชื่อสกุล","ชื่อ"], grade: ["grade","ระดับชั้น","ชั้น"], room: ["room","ห้อง"] };
  const index = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, normalized.findIndex((h) => names.includes(h))]));
  if (index.number < 0 || index.name < 0 || index.room < 0) throw new Error("หัวตารางต้องมี number, studentId, name, grade, room");
  return rows.slice(1).map((row) => ({ number: Number(row[index.number]), studentId: row[index.studentId] || "", name: row[index.name], grade: row[index.grade] || "ม.2", room: String(row[index.room]) })).filter((s) => s.number && s.name && s.room);
}

async function importStudents(list) {
  if (!list.length) throw new Error("ไม่พบรายชื่อนักเรียนในไฟล์");
  if (list.length > 300) throw new Error("นำเข้าได้ครั้งละไม่เกิน 300 คน");
  const batch = writeBatch(db);
  list.forEach((student) => {
    const key = `${student.grade}-${student.room}-${student.studentId || student.number}`.replace(/[^\wก-๙-]/g, "-");
    batch.set(doc(refs().students, key), { ...student, updatedAt: serverTimestamp() }, { merge: true });
  });
  await batch.commit();
  toast(`นำเข้าสำเร็จ ${list.length} คน`);
}

function csvEscape(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function downloadFile(name, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([type.includes("csv") ? "\uFEFF" + content : content], { type });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  toast(`ดาวน์โหลด ${name} แล้ว`);
}

function exportData(type) {
  if (type === "students") {
    const room = $("#studentRoom").value; const list = students.filter((s) => room === "all" || String(s.room) === room);
    const rows = [["เลขที่","รหัสนักเรียน","คำนำหน้า","ชื่อ","นามสกุล","ชื่อ-นามสกุล","ระดับชั้น","ห้อง"], ...list.map((s) => [s.number,s.studentId,s.prefix,s.firstName,s.lastName,s.name,s.grade,s.room])];
    return downloadFile(`รายชื่อนักเรียน_${room === "all" ? "ทุกห้อง" : `ม2-${room}`}.csv`, rows.map((r) => r.map(csvEscape).join(",")).join("\n"));
  }
  if (type === "attendance") {
    const room = $("#attendanceRoom").value; const labels = {present:"มา",late:"สาย",leave:"ลา",absent:"ขาด"};
    const rows = [["วันที่","รหัสวิชา","ชั้น","ห้อง","เลขที่","รหัสนักเรียน","ชื่อ-นามสกุล","สถานะ"], ...studentsInRoom(room).map((s) => [$("#attendanceDate").value,$("#attendanceSubject").value,s.grade,room,s.number,s.studentId,s.name,labels[currentAttendance[s.id]] || "-"])];
    return downloadFile(`เช็กชื่อ_${$("#attendanceDate").value}_ม2-${room}.csv`, rows.map((r) => r.map(csvEscape).join(",")).join("\n"));
  }
  if (type === "scores") {
    const assignment = assignments.find((a) => a.id === $("#assignmentSelect").value); if (!assignment) return toast("กรุณาเลือกงาน/ข้อสอบก่อน", true);
    const rows = [["เลขที่","รหัสนักเรียน","ชื่อ-นามสกุล","สถานะ","คะแนน","คะแนนเต็ม","หมายเหตุ"], ...studentsInRoom($("#scoreRoom").value).map((s) => { const v=currentScores[s.id]||{}; return [s.number,s.studentId,s.name,v.status||"pending",v.score??"",assignment.maxScore,v.note||""]; })];
    return downloadFile(`คะแนน_${assignment.subject}_${assignment.title}.csv`, rows.map((r) => r.map(csvEscape).join(",")).join("\n"));
  }
  if (type === "backup") downloadFile(`ClassroomOS_backup_${today}.json`, JSON.stringify({ profile, classes, subjects, students, assignments }, null, 2), "application/json");
}

function preparePrint() {
  const active = $(".view.active").id; let title = "รายงาน Classroom OS", subtitle = "", content = "";
  if (active === "students") { title = "บัญชีรายชื่อนักเรียน"; subtitle = `ระดับชั้น ม.2 · ห้อง ${$("#studentRoom").value === "all" ? "ทุกห้อง" : $("#studentRoom").value} · ภาคเรียน 1/2569`; content = `<table><thead><tr><th>เลขที่</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>ชั้น/ห้อง</th></tr></thead><tbody>${students.filter((s)=>$("#studentRoom").value==="all"||String(s.room)===$("#studentRoom").value).map((s)=>`<tr><td>${s.number}</td><td>${escapeHtml(s.studentId)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.grade)}/${escapeHtml(s.room)}</td></tr>`).join("")}</tbody></table>`; }
  else if (active === "attendance") { title = "แบบบันทึกการมาเรียน"; subtitle = `${$("#attendanceSubject option:checked").textContent} · ม.2/${$("#attendanceRoom").value} · ${formatDate($("#attendanceDate").value)}`; const labels={present:"มา",late:"สาย",leave:"ลา",absent:"ขาด"}; content=`<table><thead><tr><th>เลขที่</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead><tbody>${studentsInRoom($("#attendanceRoom").value).map((s)=>`<tr><td>${s.number}</td><td>${s.studentId}</td><td>${escapeHtml(s.name)}</td><td>${labels[currentAttendance[s.id]]||"-"}</td><td></td></tr>`).join("")}</tbody></table>`; }
  else if (active === "scores") { const a=assignments.find((x)=>x.id===$("#assignmentSelect").value); title="แบบบันทึกคะแนน"; subtitle=a?`${a.subject} · ${a.title} · ม.2/${a.room} · คะแนนเต็ม ${a.maxScore}`:"กรุณาเลือกงาน/ข้อสอบ"; content=a?`<table><thead><tr><th>เลขที่</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>สถานะ</th><th>คะแนน</th></tr></thead><tbody>${studentsInRoom(a.room).map((s)=>{const v=currentScores[s.id]||{};return `<tr><td>${s.number}</td><td>${s.studentId}</td><td>${escapeHtml(s.name)}</td><td>${v.status||"ยังไม่ส่ง"}</td><td>${v.score??""}</td></tr>`}).join("")}</tbody></table>`:""; }
  else { title="สรุปภาพรวมชั้นเรียน"; subtitle=`ภาคเรียน 1/2569 · พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}`; content=$("#classOverview").outerHTML; }
  $("#printTitle").textContent=title; $("#printSubtitle").textContent=subtitle; $("#printContent").innerHTML=content; window.print();
}

async function importMigration(data) {
  if (!data?.meta || !Array.isArray(data.students) || data.meta.teacherId !== "USR-20260616-144217") throw new Error("ไฟล์ Migration ไม่ตรงกับบัญชีครูสุรเดช");
  const total = [data.students,data.subjects,data.classes,data.assignments,data.scores,data.attendance,data.assistants].reduce((n,x)=>n+(x?.length||0),1);
  if (!(await confirmAction("นำเข้าข้อมูลระบบเดิม", `พบข้อมูล ${total.toLocaleString("th-TH")} ชุด ระบบจะอัปเดตข้อมูลที่รหัสตรงกันโดยไม่สร้างรายการซ้ำ`))) return;
  const collections = [["students",data.students],["subjects",data.subjects],["classes",data.classes],["assignments",data.assignments],["scores",data.scores],["attendance",data.attendance],["assistants",data.assistants]];
  const safeDocumentId = (value) => encodeURIComponent(String(value || crypto.randomUUID()));
  const operations = [["profile","teacher",data.profile], ...collections.flatMap(([name,items]) => (items||[]).map((item)=>[name,safeDocumentId(item.id),item]))];
  for (let i=0;i<operations.length;i+=400) { const batch=writeBatch(db); operations.slice(i,i+400).forEach(([name,id,value])=>batch.set(doc(db,"users",user.uid,name,id),{...value,updatedAt:serverTimestamp()},{merge:true})); await batch.commit(); }
  toast(`ย้ายข้อมูลสำเร็จ ${total.toLocaleString("th-TH")} ชุด`); $("#profileModal").classList.remove("open");
}

function bindEvents() {
  $$("#nav button").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  $$('[data-go]').forEach((button) => button.addEventListener("click", () => showView(button.dataset.go)));
  $("#menuButton").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  $$('[data-modal]').forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.modal}`).classList.add("open")));
  $$(".modal").forEach((modal) => { const close=$(".close",modal); if(close) close.addEventListener("click",()=>modal.classList.remove("open")); modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); }); });
  $$(".close-secondary").forEach((button)=>button.addEventListener("click",()=>button.closest(".modal").classList.remove("open")));
  $$(".print").forEach((button) => button.addEventListener("click", preparePrint));
  $("#profileButton").addEventListener("click",()=>$("#profileModal").classList.add("open"));
  $("#openExport").addEventListener("click",()=>$("#exportModal").classList.add("open"));
  $$("[data-export]").forEach((button)=>button.addEventListener("click",()=>exportData(button.dataset.export)));
  $("#studentDownload").addEventListener("click",()=>exportData("students"));
  $("#attendanceDownload").addEventListener("click",()=>exportData("attendance"));
  $("#scoreDownload").addEventListener("click",()=>exportData("scores"));
  $("#migrationButton").addEventListener("click",()=>$("#migrationInput").click());
  $("#migrationInput").addEventListener("change",async(e)=>{try{await importMigration(JSON.parse(await e.target.files[0].text()));}catch(error){toast(error.message,true)}e.target.value=""});
  $("#migrationPasteButton").addEventListener("click",async()=>{try{const raw=$("#migrationPaste").value.trim();if(!raw)throw new Error("กรุณาวางชุดข้อมูลก่อน");await importMigration(JSON.parse(raw));$("#migrationPaste").value=""}catch(error){toast(error.message,true)}});
  $("#profileForm").addEventListener("submit",async(e)=>{e.preventDefault();const form=e.currentTarget;profile=Object.fromEntries(new FormData(form));await setDoc(doc(refs().profile,"teacher"),{...profile,updatedAt:serverTimestamp()},{merge:true});renderProfile();form.closest(".modal").classList.remove("open");toast("บันทึกโปรไฟล์แล้ว")});
  $("#studentRoom").addEventListener("change", renderStudents);
  $("#studentSearch").addEventListener("input", renderStudents);
  $("#attendanceRoom").addEventListener("change", loadAttendance);
  $("#attendanceDate").addEventListener("change", loadAttendance);
  $("#attendanceSubject").addEventListener("change", loadAttendance);
  $("#loadAttendance").addEventListener("click", loadAttendance);
  $("#scoreRoom").addEventListener("change", renderAssignments);
  $("#scoreSubject").addEventListener("change", renderAssignments);
  $("#assignmentSelect").addEventListener("change", loadScores);
  $("#assignmentCards").addEventListener("click", async (e) => {
    const remove = e.target.closest("[data-delete-assignment]");
    if (remove && confirm("ลบงาน/ข้อสอบและคะแนนทั้งหมดของรายการนี้หรือไม่?")) {
      await Promise.all([deleteDoc(doc(refs().assignments, remove.dataset.deleteAssignment)), deleteDoc(doc(refs().scores, remove.dataset.deleteAssignment))]);
      $("#assignmentSelect").value = ""; currentScores = {}; toast("ลบงานและคะแนนแล้ว"); return;
    }
    const card = e.target.closest("[data-assignment]"); if (card) { $("#assignmentSelect").value = card.dataset.assignment; loadScores(); }
  });
  $("#attendanceList").addEventListener("change", (e) => { const row = e.target.closest("[data-student]"); if (row) { currentAttendance[row.dataset.student] = e.target.value; updateAttendanceSummary(); } });
  $("#studentRows").addEventListener("click", async (e) => { const button = e.target.closest("[data-delete-student]"); if (button && confirm("ยืนยันลบนักเรียนคนนี้?")) await deleteDoc(doc(refs().students, button.dataset.deleteStudent)); });

  $("#studentForm").addEventListener("submit", async (e) => { e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); data.number = Number(data.number); await addDoc(refs().students, { ...data, createdAt: serverTimestamp() }); form.reset(); form.closest(".modal").classList.remove("open"); toast("เพิ่มนักเรียนแล้ว"); });
  $("#assignmentForm").addEventListener("submit", async (e) => { e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); data.maxScore = Number(data.maxScore); await addDoc(refs().assignments, { ...data, createdAt: serverTimestamp() }); form.reset(); form.closest(".modal").classList.remove("open"); toast("สร้างงาน/ข้อสอบแล้ว"); });
  $("#subjectForm").addEventListener("submit", async (e) => { e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); await setDoc(doc(refs().subjects, data.code), { ...data, createdAt: serverTimestamp() }); form.reset(); form.closest(".modal").classList.remove("open"); toast("เพิ่มรายวิชาแล้ว"); });
  $("#saveAttendance").addEventListener("click", async () => { await setDoc(doc(refs().attendance, attendanceDocId()), { date: $("#attendanceDate").value, subject: $("#attendanceSubject").value, room: $("#attendanceRoom").value, statuses: currentAttendance, updatedAt: serverTimestamp() }); toast("บันทึกการเช็กชื่อแล้ว"); });
  $("#clearAttendance").addEventListener("click", async () => { if (confirm("ลบบันทึกการเช็กชื่อของวันที่ วิชา และห้องที่เลือกหรือไม่?")) { await deleteDoc(doc(refs().attendance, attendanceDocId())); currentAttendance = {}; studentsInRoom($("#attendanceRoom").value).forEach((s) => { currentAttendance[s.id] = "present"; }); updateAttendanceSummary(); toast("ล้างบันทึกการเช็กชื่อแล้ว"); } });
  $("#saveScores").addEventListener("click", async () => { const assignmentId = $("#assignmentSelect").value; if (!assignmentId) return toast("กรุณาเลือกงาน/ข้อสอบ", true); const results = {}; $$("[data-score-student]").forEach((row) => { results[row.dataset.scoreStudent] = { status: $(".status-select", row).value, score: $(".score-input", row).value === "" ? null : Number($(".score-input", row).value), note: $(".note-input", row).value.trim() }; }); await setDoc(doc(refs().scores, assignmentId), { assignmentId, results, updatedAt: serverTimestamp() }); currentScores = results; toast("บันทึกคะแนนทั้งหมดแล้ว"); });
  $("#csvButton").addEventListener("click", () => $("#csvInput").click());
  $("#csvInput").addEventListener("change", async (e) => { try { await importStudents(parseCsv(await e.target.files[0].text())); } catch (error) { toast(error.message, true); } e.target.value = ""; });
  $("#sheetForm").addEventListener("submit", async (e) => { e.preventDefault(); const form = e.currentTarget; try { const url = new FormData(form).get("url"); const response = await fetch(url); if (!response.ok) throw new Error("เปิด Google Sheets ไม่สำเร็จ กรุณาเผยแพร่เป็น CSV ก่อน"); await importStudents(parseCsv(await response.text())); form.closest(".modal").classList.remove("open"); } catch (error) { toast(error.message, true); } });
}

function subscribe() {
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [
    onSnapshot(query(refs().students, orderBy("number"), limit(500)), (snap) => { students = snap.docs.map((d) => ({ id: d.id, ...d.data() })); updateRoomOptions(); renderStudents(); loadAttendance(); }),
    onSnapshot(query(refs().assignments, orderBy("createdAt", "desc"), limit(100)), (snap) => { assignments = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderAssignments(); }),
    onSnapshot(query(refs().subjects, limit(30)), (snap) => { const custom = snap.docs.map((d) => ({ id: d.id, ...d.data() })); subjects = custom.length ? custom : subjects; renderSubjects(); }),
    onSnapshot(query(refs().classes, limit(50)), (snap) => { classes = snap.docs.map((d) => ({ id: d.id, ...d.data() })); updateRoomOptions(); renderDashboard(); }),
    onSnapshot(query(refs().profile, limit(1)), (snap) => { if (!snap.empty) profile = { ...profile, ...snap.docs[0].data() }; renderProfile(); })
  ];
  $("#syncStatus").classList.add("online");
  $("#syncStatus").lastChild.textContent = " เชื่อมต่อแล้ว";
}

$("#attendanceDate").value = today;
$("#todayLabel").textContent = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
$("#assignmentForm input[name=dueDate]").value = today;
const updateClock = () => { $("#clockTime").textContent = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()); };
updateClock(); setInterval(updateClock, 1000); renderProfile(); updateRoomOptions();
bindEvents();
onAuthStateChanged(auth, (account) => { if (account) { user = account; subscribe(); } });
signInAnonymously(auth).catch((error) => { console.error(error); $("#syncStatus").lastChild.textContent = " เชื่อมต่อไม่ได้"; toast("เชื่อม Firebase ไม่สำเร็จ กรุณารีเฟรชอีกครั้ง", true); });
