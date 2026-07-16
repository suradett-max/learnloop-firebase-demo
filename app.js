import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getFirestore, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (selector) => document.querySelector(selector);
const ui = { form: $("#lessonForm"), title: $("#title"), minutes: $("#minutes"), category: $("#category"), filter: $("#filter"), list: $("#lessonList"), empty: $("#emptyState"), message: $("#formMessage"), submit: $("#submitButton"), status: $("#syncStatus"), total: $("#totalCount"), done: $("#doneCount"), percent: $("#progressPercent"), ring: $("#progressRing") };
let lessons = [];
let lessonsRef;

function setStatus(text, online = false) { ui.status.lastChild.textContent = ` ${text}`; ui.status.classList.toggle("online", online); }
function escapeHtml(value) { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }
function render() {
  const filtered = lessons.filter((x) => ui.filter.value === "all" || (ui.filter.value === "done" ? x.done : !x.done));
  const done = lessons.filter((x) => x.done).length;
  const percent = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  ui.total.textContent = lessons.length; ui.done.textContent = done; ui.percent.textContent = `${percent}%`; ui.ring.style.setProperty("--progress", `${percent}%`);
  ui.empty.hidden = lessons.length > 0;
  ui.list.innerHTML = filtered.map((item) => `<li class="lesson-item ${item.done ? "done" : ""}" data-id="${item.id}"><input class="check" type="checkbox" aria-label="ทำบทเรียน ${escapeHtml(item.title)} เสร็จแล้ว" ${item.done ? "checked" : ""}><div><div class="lesson-title">${escapeHtml(item.title)}</div><div class="lesson-meta">${escapeHtml(item.category)} · ${item.minutes} นาที</div></div><button class="delete" type="button" aria-label="ลบ ${escapeHtml(item.title)}">×</button></li>`).join("");
}

async function connect() {
  if (firebaseConfig.apiKey === "REPLACE_ME") { setStatus("ยังไม่ได้ตั้งค่า Firebase"); ui.submit.disabled = true; ui.message.textContent = "กำลังรอการเชื่อม Firebase"; return; }
  try {
    const app = initializeApp(firebaseConfig); const auth = getAuth(app); const db = getFirestore(app);
    onAuthStateChanged(auth, (user) => { if (!user) return; lessonsRef = collection(db, "users", user.uid, "lessons"); const q = query(lessonsRef, orderBy("createdAt", "desc"), limit(30)); onSnapshot(q, (snapshot) => { lessons = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })); render(); setStatus("ซิงก์แล้ว", true); }, (error) => { console.error("Firestore listener failed", error); setStatus("เชื่อมต่อข้อมูลไม่ได้"); }); });
    await signInAnonymously(auth);
  } catch (error) { console.error(error); setStatus("เชื่อมต่อไม่ได้"); ui.message.textContent = "โปรดลองรีเฟรชอีกครั้ง"; }
}

ui.form.addEventListener("submit", async (event) => { event.preventDefault(); if (!lessonsRef || lessons.length >= 30) { ui.message.textContent = lessons.length >= 30 ? "ครบ 30 รายการแล้ว กรุณาลบรายการเก่าก่อน" : "ยังไม่พร้อมเชื่อมต่อ"; return; } ui.submit.disabled = true; try { await addDoc(lessonsRef, { title: ui.title.value.trim(), category: ui.category.value, minutes: Number(ui.minutes.value), done: false, createdAt: serverTimestamp() }); ui.form.reset(); ui.minutes.value = 30; ui.message.textContent = ""; } catch { ui.message.textContent = "บันทึกไม่สำเร็จ โปรดลองอีกครั้ง"; } finally { ui.submit.disabled = false; } });
ui.filter.addEventListener("change", render);
ui.list.addEventListener("change", async (event) => { const row = event.target.closest(".lesson-item"); if (event.target.matches(".check") && row) await updateDoc(doc(lessonsRef, row.dataset.id), { done: event.target.checked }); });
ui.list.addEventListener("click", async (event) => { const row = event.target.closest(".lesson-item"); if (event.target.matches(".delete") && row && confirm("ลบบทเรียนนี้ใช่ไหม?")) await deleteDoc(doc(lessonsRef, row.dataset.id)); });
connect();
