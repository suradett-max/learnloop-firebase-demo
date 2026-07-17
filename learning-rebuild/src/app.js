import { ensureAuth } from "./firebase.js";
import { subjects, units, buildQuestionBank } from "./data/seedContent.js";
import { awardActivity, getProgress, saveNavigation, upsertProfile } from "./services/progress.js?v=firestore-cdn";
import { startPresence, updatePresence } from "./services/presence.js?v=instant-presence";
import { watchPresence } from "./services/monitor.js?v=plain-presence";

const app = document.querySelector("#app");
const questionBank = buildQuestionBank();

const LESSONS = {
  BUD_U01: {
    lead: "พระพุทธศาสนาไม่ได้แพร่ไปเพราะการท่องจำคำสอนอย่างเดียว แต่เกิดจากการเดินทาง การค้าขาย ความสัมพันธ์ระหว่างรัฐ และการปรับตัวเข้ากับวัฒนธรรมท้องถิ่น",
    points: ["การเผยแผ่สำเร็จเมื่อผู้คนเห็นประโยชน์ต่อชีวิตจริง", "วัดเป็นทั้งศูนย์รวมจิตใจ แหล่งเรียนรู้ และพื้นที่ช่วยเหลือสังคม", "การเคารพความแตกต่างทำให้ศาสนาอยู่ร่วมกับวัฒนธรรมเดิมได้"],
    mission: "อ่านสถานการณ์แล้วแยกให้ได้ว่าอะไรคือปัจจัยทางสังคม การเมือง วัฒนธรรม หรือการศึกษา"
  },
  BUD_U02: {
    lead: "ความสำคัญของพระพุทธศาสนาอยู่ที่การช่วยจัดระเบียบชีวิต สร้างวินัยทางใจ และสนับสนุนการอยู่ร่วมกันอย่างไม่เบียดเบียน",
    points: ["หลักธรรมช่วยให้ตัดสินใจอย่างมีเหตุผล", "ประเพณีและศาสนพิธีสะท้อนความกตัญญูและความร่วมมือ", "การนำหลักธรรมไปใช้ต้องดูบริบท ไม่ใช่ท่องชื่อหลักธรรมอย่างเดียว"],
    mission: "เชื่อมหลักธรรมกับพฤติกรรมจริงของคนในโรงเรียน ครอบครัว และชุมชน"
  },
  BUD_U03: {
    lead: "อริยสัจ 4 เป็นวิธีคิดแก้ปัญหาอย่างเป็นขั้นตอน เริ่มจากรู้ปัญหา หาสาเหตุ เห็นเป้าหมาย และเลือกวิธีปฏิบัติ",
    points: ["ทุกข์คือปัญหาที่ต้องรู้ให้ชัด", "สมุทัยคือสาเหตุ ไม่ใช่การโทษคนอื่น", "มรรคคือแนวทางลงมือแก้ที่ทำได้จริง"],
    mission: "เมื่อเจอสถานการณ์ ให้จับคู่ปัญหา-สาเหตุ-เป้าหมาย-วิธีแก้ให้ครบ"
  },
  BUD_U04: {
    lead: "อิทธิบาท 4 เป็นหลักธรรมแห่งความสำเร็จ ประกอบด้วยรักในสิ่งที่ทำ เพียรพยายาม เอาใจใส่ และตรวจทบทวน",
    points: ["ฉันทะทำให้เริ่มต้นด้วยใจที่อยากทำ", "วิริยะทำให้ไม่หยุดเมื่อยาก", "วิมังสาทำให้ตรวจผลและปรับวิธีเรียน"],
    mission: "ดูพฤติกรรมในสถานการณ์ว่าเข้ากับองค์ประกอบใดของอิทธิบาท 4"
  },
  BUD_U05: {
    lead: "มารยาทชาวพุทธคือการปฏิบัติอย่างสุภาพ เหมาะกับกาลเทศะ และคำนึงถึงความปลอดภัยของผู้อื่น",
    points: ["ความหวังดีต้องทำอย่างสำรวม", "เมื่อต้องแก้เหตุเฉพาะหน้า ควรแจ้งผู้ใหญ่หรือผู้รับผิดชอบ", "พิธีกรรมควรดำเนินด้วยความเคารพ ไม่วุ่นวายโดยไม่จำเป็น"],
    mission: "เลือกการกระทำที่ทั้งปลอดภัย สุภาพ และเหมาะกับสถานการณ์"
  },
  BUD_U06: {
    lead: "การบริหารจิตช่วยให้รู้ตัวก่อนตัดสินใจ ลดความหุนหัน และใช้เหตุผลตรวจสอบความคิดของตนเอง",
    points: ["สติคือการรู้ว่าตนกำลังคิด พูด หรือทำอะไร", "สมาธิช่วยให้ใจตั้งมั่นกับงาน", "โยนิโสมนสิการคือการคิดแยบคาย มองเหตุและผล"],
    mission: "แยกให้ออกว่าพฤติกรรมใดคือสติ สมาธิ หรือการคิดแบบโยนิโสมนสิการ"
  },
  HIS_U01: {
    lead: "วิธีการทางประวัติศาสตร์เป็นกระบวนการหาคำตอบจากหลักฐาน ไม่ใช่การเดาหรือเล่าเรื่องตามความเชื่อเดิม",
    points: ["เริ่มจากกำหนดหัวเรื่องหรือคำถามให้ชัด", "รวบรวมหลักฐานที่เกี่ยวข้องหลายด้าน", "ประเมินหลักฐาน วิเคราะห์ ตีความ แล้วนำเสนออย่างมีเหตุผล"],
    mission: "จำลำดับขั้นให้ได้ และอธิบายได้ว่าทำไมต้องตรวจหลักฐานก่อนสรุป"
  },
  HIS_U02: {
    lead: "หลักฐานทางประวัติศาสตร์มีหลายประเภท เช่น หลักฐานชั้นต้น ชั้นรอง ลายลักษณ์อักษร และไม่เป็นลายลักษณ์อักษร",
    points: ["หลักฐานชั้นต้นเกิดร่วมสมัยกับเหตุการณ์", "หลักฐานชั้นรองเป็นการอธิบายภายหลัง", "หลักฐานทุกชิ้นต้องตรวจผู้เขียน เวลา จุดประสงค์ และอคติ"],
    mission: "เมื่อเห็นหลักฐาน ให้บอกประเภทและประเมินความน่าเชื่อถือได้"
  },
  HIS_U03: {
    lead: "การจัดหมวดหมู่ข้อมูลช่วยให้ไม่สับสนระหว่างสาเหตุ ปัจจัย ผลกระทบ และข้อสรุป",
    points: ["ข้อมูลดิบยังไม่ใช่คำตอบ", "การจัดกลุ่มทำให้เห็นความสัมพันธ์", "ข้อสรุปที่ดีต้องอ้างอิงหลักฐานและเหตุผล"],
    mission: "อ่านข้อมูลหลายชิ้นแล้วจัดเป็นกลุ่มก่อนเขียนคำตอบ"
  },
  HIS_U04: {
    lead: "เอเชียตะวันตกเฉียงใต้มีพื้นที่แห้งแล้ง แต่บางบริเวณเจริญได้เพราะแหล่งน้ำ โอเอซิส และเส้นทางการค้า",
    points: ["แม่น้ำช่วยให้เพาะปลูกและตั้งถิ่นฐาน", "ทะเลทรายทำให้ผู้คนต้องพึ่งเส้นทางคาราวานและโอเอซิส", "ทำเลเชื่อมภูมิภาคทำให้เกิดการแลกเปลี่ยนสินค้าและวัฒนธรรม"],
    mission: "วิเคราะห์ว่าสภาพภูมิศาสตร์ส่งผลต่อวิถีชีวิตและอารยธรรมอย่างไร"
  },
  HIS_U05: {
    lead: "เมโสโปเตเมียเจริญจากลุ่มแม่น้ำไทกริสและยูเฟรติส ผู้คนพัฒนาชลประทาน เมือง กฎหมาย และอักษร",
    points: ["แม่น้ำคือฐานของการเกษตรและเมือง", "ประมวลกฎหมายฮัมมูราบีสะท้อนการจัดระเบียบสังคม", "อักษรคูนิฟอร์มช่วยบันทึกเศรษฐกิจ กฎหมาย และความรู้"],
    mission: "เชื่อมมรดกอารยธรรมกับหน้าที่ทางสังคม ไม่ตอบจากชื่อที่คุ้นอย่างเดียว"
  },
  HIS_U06: {
    lead: "อารยธรรมอิสลามมีบทบาทสำคัญในการรับ แปล พัฒนา และถ่ายทอดความรู้หลายสาขาระหว่างโลกตะวันออกกับตะวันตก",
    points: ["เมืองสำคัญเป็นศูนย์กลางการค้าและความรู้", "นักวิชาการแปลและต่อยอดวิทยาการ", "ความรู้เดินทางไปพร้อมการค้า การศึกษา และวัฒนธรรม"],
    mission: "อธิบายให้ได้ว่าเหตุใดจึงเรียกว่าเป็นสะพานเชื่อมวิทยาการ"
  },
  HIS_U07: {
    lead: "การสรุปก่อนสอบต้องเชื่อมภูมิศาสตร์ หลักฐาน และอารยธรรมเข้าด้วยกัน เพื่ออธิบายเหตุและผลทางประวัติศาสตร์",
    points: ["อย่าจำเป็นข้อ ๆ แยกกัน ให้เชื่อมความสัมพันธ์", "คำตอบที่ดีต้องมีหลักฐานและเหตุผล", "ช้อยส์ลวงมักเป็นข้อความจริงบางส่วนแต่ไม่ตอบคำถามหลัก"],
    mission: "ฝึกอ่านคำถามให้เจอคำสำคัญ เช่น สาเหตุหลัก สะท้อนมากที่สุด หรือเหมาะสมที่สุด"
  }
};

const state = {
  user: null,
  profile: JSON.parse(localStorage.getItem("studentProfile") || "null"),
  studentKey: localStorage.getItem("studentKey") || "",
  subjectCode: localStorage.getItem("subjectCode") || "S22102",
  progress: null,
  currentView: "home",
  activeUnitId: "",
  currentQuiz: [],
  answers: {},
  teacherOpen: false,
  teacherPinOpen: false,
  busy: false,
  toast: null,
  lessonRead: false,
  lessonActivityIndex: 0
};

main().catch((error) => showFatal(error));

async function main() {
  state.user = await ensureAuth();
  if (state.profile) await hydrateStudent(state.profile, state.subjectCode);
  render();
}

async function hydrateStudent(profile, subjectCode) {
  state.profile = profile;
  state.subjectCode = subjectCode || profile.subjectCode || state.subjectCode;
  state.studentKey = await upsertProfile(state.user, { ...profile, subjectCode: state.subjectCode });
  state.progress = await getProgress(state.user, state.studentKey, state.subjectCode);
  state.activeUnitId = state.progress.currentUnitId || firstUnitId(state.subjectCode);
  localStorage.setItem("studentProfile", JSON.stringify({ ...profile, subjectCode: state.subjectCode }));
  localStorage.setItem("studentKey", state.studentKey);
  localStorage.setItem("subjectCode", state.subjectCode);
  startPresence(state.user, state.studentKey, state.profile);
}

function render() {
  const subject = currentSubject();
  app.innerHTML = `
    <div class="app-frame ${state.busy ? "is-busy" : ""}">
      ${renderTopbar(subject)}
      <main class="shell">
        ${state.profile ? renderMain(subject) : renderProfileForm()}
      </main>
      ${state.profile ? renderBottomNav() : ""}
      ${state.teacherOpen ? renderTeacherMonitor() : ""}
      ${state.teacherPinOpen ? renderPinModal() : ""}
      ${state.busy ? `<div class="loading-shade"><div class="loader"></div><strong>กำลังบันทึกข้อมูล</strong><span>ระบบกำลังเชื่อมต่อ Firebase</span></div>` : ""}
      <div class="toast-region">${state.toast ? `<div class="toast ${state.toast.type}">${icon("check")}<span>${state.toast.message}</span></div>` : ""}</div>
    </div>
  `;
  bindEvents();
  if (state.teacherOpen) bindTeacherMonitor();
}

function renderTopbar(subject) {
  const progress = state.progress || {};
  return `
    <header class="topbar">
      <div class="brand-block">
        <span class="brand-mark">${icon("book")}</span>
        <div>
          <p class="eyebrow">${subject.title}</p>
          <h1>${subject.subtitle}</h1>
        </div>
      </div>
      <div class="top-actions">
        <div class="mini-stat"><strong>${progress.xp || 0}</strong><span>XP</span></div>
        <button class="icon-btn" data-action="teacher" title="Teacher Monitor">${icon("settings")}</button>
        <button class="icon-btn" data-action="font" title="ปรับขนาดตัวอักษร">${icon("type")}</button>
      </div>
    </header>
  `;
}

function renderProfileForm() {
  const avatar = buildAvatarPreview("");
  return `
    <section class="panel profile-panel">
      <div class="split-head">
        <div>
          <p class="eyebrow">เริ่มต้นใช้งาน</p>
          <h2>ข้อมูลนักเรียน</h2>
          <p>กรอกข้อมูลให้ตรงทุกครั้ง โดยเฉพาะรหัสนักเรียน ระบบจะใช้จดจำความคืบหน้าแม้เปลี่ยนเครื่องหรือเปิดลิงก์ใหม่</p>
        </div>
        <span class="avatar-preview">${avatar}</span>
      </div>
      <form id="profileForm" class="grid-form">
        <label>ชื่อ-สกุล<input name="fullName" required placeholder="เช่น เด็กชายตัวอย่าง เรียนดี"></label>
        <label>รหัสนักเรียน<input name="studentId" placeholder="จำเป็นสำหรับจดจำข้ามเครื่อง" required></label>
        <label>เลขที่<input name="studentNo" required inputmode="numeric"></label>
        <label>ระดับชั้น<select name="grade">${range(1, 6).map((n) => `<option>ม.${n}</option>`).join("")}</select></label>
        <label>ห้อง<select name="room">${range(1, 15).map((n) => `<option>${n}</option>`).join("")}</select></label>
        <label>รายวิชา<select name="subjectCode">${subjects.map((s) => `<option value="${s.code}" ${s.code === state.subjectCode ? "selected" : ""}>${s.title}</option>`).join("")}</select></label>
        <button class="primary wide" type="submit">${icon("arrow")}<span>บันทึกและเริ่มเรียน</span></button>
      </form>
    </section>
  `;
}

function renderMain(subject) {
  if (state.currentView === "lesson") return renderLesson();
  if (state.currentView === "exam") return renderExam(subject);
  if (state.currentView === "progress") return renderProgress();
  if (state.currentView === "review") return renderReview();
  return renderHome(subject);
}

function renderHome(subject) {
  const progress = state.progress || {};
  const subjectUnits = units.filter((u) => u.subjectCode === state.subjectCode);
  const total = questionBank.filter((q) => q.subjectCode === state.subjectCode).length;
  const done = (progress.completedActivityIds || []).length;
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const nextUnit = subjectUnits.find((u) => u.id === (progress.currentUnitId || state.activeUnitId)) || subjectUnits[0];
  return `
    <section class="profile-hero">
      <div class="student-card">
        <div class="avatar-lg">${buildAvatarPreview(state.studentKey || state.profile?.studentId || state.profile?.fullName)}</div>
        <div>
          <p class="eyebrow">Student Profile</p>
          <h2>${escapeHtml(state.profile.fullName || "นักเรียน")}</h2>
          <span>${escapeHtml(state.profile.grade || "-")} ห้อง ${escapeHtml(state.profile.room || "-")} เลขที่ ${escapeHtml(state.profile.studentNo || "-")}</span>
        </div>
      </div>
      <div class="rank-card">
        <span>อันดับจำลอง</span>
        <strong>#${mockRank(progress.xp || 0)}</strong>
        <small>จัดจาก XP และความคืบหน้า</small>
      </div>
      <div class="rank-card accent">
        <span>สถานะ</span>
        <strong>${percent}%</strong>
        <small>เรียนแล้ว ${done}/${total} กิจกรรม</small>
      </div>
    </section>
    <section class="hero">
      <div class="hero-copy">
        <p class="pill">${subject.title}</p>
        <h2>เรียนเป็นลำดับ เข้าใจเนื้อหา แล้วค่อยตรวจความเข้าใจ</h2>
        <p>ระบบนี้จะแสดงเนื้อหาแต่ละหน่วยก่อน จากนั้นจึงมีคำถามสั้น ๆ เพื่อเก็บ XP และปลดล็อกหน่วยถัดไป</p>
        <div class="hero-actions">
          <button class="primary" data-action="open-unit" data-unit="${nextUnit.id}">${icon("play")}<span>เรียนต่อ: ${nextUnit.title}</span></button>
          <button class="ghost" data-action="exam">${icon("clipboard")}<span>จำลองสอบ</span></button>
        </div>
      </div>
      <div class="hero-meter">
        <strong>${percent}%</strong>
        <span>ความคืบหน้า</span>
        <div class="meter"><i style="width:${percent}%"></i></div>
      </div>
      <div class="hero-meter">
        <strong>${progress.xp || 0}</strong>
        <span>XP สะสม</span>
        <small>ตอบถูกครั้งแรกจึงเพิ่ม XP</small>
      </div>
    </section>
    <section class="panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Learning Path</p>
          <h2>เส้นทางบทเรียน</h2>
        </div>
        <button class="ghost" data-action="refresh-progress">${icon("refresh")}<span>โหลดความคืบหน้าล่าสุด</span></button>
      </div>
      <div class="unit-grid">${subjectUnits.map((unit) => renderUnitCard(unit, progress)).join("")}</div>
    </section>
  `;
}

function renderUnitCard(unit, progress) {
  const completed = (progress.completedUnitIds || []).includes(unit.id);
  const current = (progress.currentUnitId || firstUnitId(state.subjectCode)) === unit.id;
  const unitQuestions = questionBank.filter((q) => q.unitId === unit.id);
  const done = unitQuestions.filter((q) => (progress.completedActivityIds || []).includes(q.id)).length;
  const pct = unitQuestions.length ? Math.round((done / unitQuestions.length) * 100) : 0;
  return `
    <article class="unit-card ${current ? "current" : ""} ${completed ? "done" : ""}">
      <span class="unit-order">${String(unit.order).padStart(2, "0")}</span>
      <div class="unit-icon">${icon(completed ? "check" : current ? "spark" : "book")}</div>
      <h3>${unit.title}</h3>
      <p>${unit.summary}</p>
      <div class="unit-progress"><i style="width:${pct}%"></i></div>
      <button data-action="open-unit" data-unit="${unit.id}">${completed ? "ทบทวนบทเรียน" : current ? "เรียนต่อ" : "เปิดบทเรียน"}</button>
    </article>
  `;
}

function renderLesson() {
  const unit = units.find((u) => u.id === state.activeUnitId) || units.find((u) => u.subjectCode === state.subjectCode);
  const lesson = getLessonModel(unit);
  const questions = lessonQuestions(unit.id);
  return `
    <section class="lesson-layout">
      <article class="panel lesson-card">
        <div class="lesson-kicker"><span>${String(unit.order).padStart(2, "0")}</span><p>${currentSubject().title}</p></div>
        <h2>${unit.title}</h2>
        <p class="lesson-lead">${lesson.lead}</p>
        <div class="concept-grid">
          ${lesson.points.map((point, index) => `<div class="concept"><b>${index + 1}</b><span>${point}</span></div>`).join("")}
        </div>
        <div class="mission">
          ${icon("target")}
          <div><strong>ภารกิจของบทนี้</strong><span>${lesson.mission}</span></div>
        </div>
        <div class="lesson-actions">
          <button class="primary" data-action="mark-read" data-unit="${unit.id}">${icon("check")}<span>อ่านจบแล้ว รับ XP การเรียนรู้</span></button>
          <span class="read-note">${state.lessonRead ? "บันทึกการอ่านแล้ว" : "อ่านเนื้อหาให้จบก่อนทำท้ายบท"}</span>
        </div>
      </article>
      <aside class="panel lesson-side">
        <h3>ขั้นตอนเรียนหน่วยนี้</h3>
        <ol>
          <li>อ่านแนวคิดหลักให้จบ</li>
          <li>ตอบตรวจสอบความเข้าใจ ${questions.length} ข้อ</li>
          <li>ดูผลและไปหน่วยถัดไป</li>
        </ol>
        <button class="primary full" data-action="start-check" data-unit="${unit.id}">${icon("clipboard")}<span>ทำแบบทดสอบท้ายบท</span></button>
        <button class="ghost full" data-action="home">${icon("home")}<span>กลับเส้นทางบทเรียน</span></button>
      </aside>
    </section>
    ${state.currentQuiz.length ? renderInlineQuiz(unit) : ""}
  `;
}

function renderInlineQuiz(unit) {
  const current = state.currentQuiz[state.lessonActivityIndex] || state.currentQuiz[0];
  const total = state.currentQuiz.length;
  return `
    <section class="panel quiz-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Chapter Quiz</p>
          <h2>แบบทดสอบท้ายบท: ${unit.title}</h2>
        </div>
        <span class="status-chip">ข้อ ${Math.min(state.lessonActivityIndex + 1, total)}/${total}</span>
      </div>
      <div class="quiz-list">${current ? renderQuestion(current, state.lessonActivityIndex) : ""}</div>
      <div class="action-row">
        <button class="ghost" data-action="clear-answers">${icon("refresh")}<span>ล้างคำตอบ</span></button>
        <button class="primary" data-action="submit-one">${icon("send")}<span>ตรวจข้อนี้</span></button>
      </div>
    </section>
  `;
}

function renderExam(subject) {
  if (!state.currentQuiz.length) {
    state.currentQuiz = pickQuestions(state.subjectCode, 10);
    state.answers = {};
  }
  return `
    <section class="panel quiz-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Exam Simulation</p>
          <h2>จำลองข้อสอบ</h2>
          <p>${subject.title} สุ่มจากคลังสถานการณ์เพื่อฝึกอ่านคำถามและแยกช้อยส์ลวง</p>
        </div>
        <button class="ghost" data-action="new-exam">${icon("refresh")}<span>สุ่มชุดใหม่</span></button>
      </div>
      <div class="quiz-list">${state.currentQuiz.map((q, index) => renderQuestion(q, index)).join("")}</div>
      <div class="action-row">
        <button class="ghost" data-action="home">${icon("home")}<span>พักไว้ก่อน</span></button>
        <button class="primary" data-action="submit-exam">${icon("send")}<span>ส่งคำตอบ</span></button>
      </div>
    </section>
  `;
}

function renderQuestion(question, index) {
  return `
    <article class="question-card">
      <div class="question-head"><span>ข้อ ${index + 1}</span><b>${question.difficulty === "hard" ? "ยาก" : "กลาง"}</b></div>
      <p>${question.prompt}</p>
      <div class="choices">
        ${question.choices.map((choice) => `
          <label class="choice ${state.answers[question.id] === choice.key ? "selected" : ""}">
            <input type="radio" name="${question.id}" value="${choice.key}" ${state.answers[question.id] === choice.key ? "checked" : ""}>
            <span class="choice-key">${choice.key}</span>
            <span>${choice.text}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `;
}

function renderProgress() {
  const progress = state.progress || {};
  const total = questionBank.filter((q) => q.subjectCode === state.subjectCode).length;
  const done = (progress.completedActivityIds || []).length;
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const nextUnit = units.find((u) => u.id === (progress.currentUnitId || firstUnitId(state.subjectCode)));
  return `
    <section class="panel progress-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Progress</p>
          <h2>ความก้าวหน้าของฉัน</h2>
        </div>
        <button class="ghost" data-action="refresh-progress">${icon("refresh")}<span>ซิงก์ล่าสุด</span></button>
      </div>
      <div class="meter big"><i style="width:${percent}%"></i></div>
      <div class="stats">
        <article><strong>${percent}%</strong><span>สำเร็จ</span></article>
        <article><strong>${progress.xp || 0}</strong><span>XP</span></article>
        <article><strong>${done}/${total}</strong><span>กิจกรรมที่ผ่าน</span></article>
      </div>
      <div class="next-box">
        <div>${icon("target")}<span>ขั้นต่อไป: ${nextUnit ? nextUnit.title : "ทบทวนและจำลองสอบ"}</span></div>
        ${nextUnit ? `<button class="primary" data-action="open-unit" data-unit="${nextUnit.id}">${icon("arrow")}<span>ไปบทเรียนถัดไป</span></button>` : ""}
      </div>
      ${renderLeaderboard("ภาพรวมอันดับห้อง", true)}
    </section>
  `;
}

function renderReview() {
  const ids = new Set(state.progress?.incorrectActivityIds || []);
  const review = questionBank.filter((q) => ids.has(q.id)).slice(0, 8);
  return `
    <section class="panel quiz-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Review</p>
          <h2>ทบทวนข้อที่พลาด</h2>
          <p>ระบบจะดึงข้อที่เคยตอบผิดมาให้ซ้อมใหม่</p>
        </div>
      </div>
      ${review.length ? `<div class="quiz-list">${review.map((q, i) => renderQuestion(q, i)).join("")}</div><button class="primary" data-action="submit-exam">${icon("send")}<span>ส่งคำตอบทบทวน</span></button>` : `<div class="empty-state">${icon("check")}<h3>ยังไม่มีข้อที่ต้องทบทวน</h3><p>เมื่อมีข้อที่ตอบผิด ระบบจะนำมาไว้ตรงนี้ให้ฝึกซ้ำ</p></div>`}
    </section>
  `;
}

function renderTeacherMonitor() {
  return `
    <aside class="monitor-backdrop">
      <section class="monitor panel">
        <div class="section-head monitor-head">
          <div>
            <p class="eyebrow">Live Classroom</p>
            <h2>Teacher Monitor</h2>
            <p>ติดตามสถานะนักเรียนแบบเรียลไทม์ กรองรายห้องได้ทันที</p>
          </div>
          <button class="icon-btn" data-action="close-teacher" title="ปิด">${icon("close")}</button>
        </div>
        <div class="monitor-summary" id="monitorSummary"></div>
        ${renderLeaderboard("Leaderboard สดในห้อง", false)}
        <div class="filters">
          <input id="monitorName" placeholder="ค้นหาชื่อ">
          <select id="monitorGrade"><option value="">ทุกชั้น</option>${range(1, 6).map((n) => `<option>ม.${n}</option>`).join("")}</select>
          <select id="monitorRoom"><option value="">ทุกห้อง</option>${range(1, 15).map((n) => `<option>${n}</option>`).join("")}</select>
        </div>
        <div id="monitorRows" class="monitor-rows">กำลังโหลดสถานะสด...</div>
      </section>
    </aside>
  `;
}

function renderPinModal() {
  return `
    <div class="modal-backdrop">
      <form id="pinForm" class="modal-card">
        <div class="modal-icon">${icon("settings")}</div>
        <h2>Teacher Monitor</h2>
        <p>กรอกรหัสครูเพื่อเปิดหน้าติดตามนักเรียน</p>
        <input name="pin" inputmode="numeric" placeholder="รหัสครู" autofocus>
        <div class="action-row">
          <button class="ghost" type="button" data-action="cancel-pin">ยกเลิก</button>
          <button class="primary" type="submit">เข้าสู่หน้าครู</button>
        </div>
      </form>
    </div>
  `;
}

function renderBottomNav() {
  return `
    <nav class="bottom-nav">
      ${navButton("home", "home", "หน้าแรก")}
      ${navButton("lesson", "book", "บทเรียน")}
      ${navButton("review", "refresh", "ทบทวน")}
      ${navButton("exam", "clipboard", "จำลองสอบ")}
      ${navButton("progress", "target", "ก้าวหน้า")}
    </nav>
  `;
}

function bindEvents() {
  app.querySelector("#profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await withBusy("กำลังเข้าสู่บทเรียน", async () => {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      await hydrateStudent(data, data.subjectCode);
      state.currentView = "home";
      notify("บันทึกข้อมูลแล้ว พร้อมเริ่มเรียน", "success");
    });
  });

  app.querySelector("#pinForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const pin = new FormData(event.currentTarget).get("pin");
    if (pin !== "1234") {
      notify("รหัสครูไม่ถูกต้อง", "error");
      return;
    }
    state.teacherPinOpen = false;
    state.teacherOpen = true;
    notify("เปิด Teacher Monitor แล้ว", "success");
    render();
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset));
  });

  app.querySelectorAll("input[type=radio]").forEach((input) => {
    input.addEventListener("change", () => {
      state.answers[input.name] = input.value;
      input.closest(".choices")?.querySelectorAll(".choice").forEach((el) => el.classList.remove("selected"));
      input.closest(".choice")?.classList.add("selected");
    });
  });
}

async function handleAction(action, data) {
  if (state.busy) return;
  if (action === "teacher") {
    state.teacherPinOpen = true;
    render();
    return;
  }
  if (action === "cancel-pin") {
    state.teacherPinOpen = false;
    render();
    return;
  }
  if (action === "close-teacher") {
    state.teacherOpen = false;
    render();
    return;
  }
  if (action === "font") {
    document.body.classList.toggle("large-text");
    notify("ปรับขนาดตัวอักษรแล้ว", "success");
    return;
  }
  if (action === "open-unit") {
    state.activeUnitId = data.unit || state.activeUnitId || firstUnitId(state.subjectCode);
    state.currentView = "lesson";
    state.currentQuiz = [];
    state.answers = {};
    await withBusy("กำลังเปิดบทเรียน", async () => {
      await saveNavigation(state.user, state.studentKey, state.subjectCode, { currentUnitId: state.activeUnitId });
      await updatePresence(state.user, { currentView: `lesson:${state.activeUnitId}` });
    });
    notify("เปิดบทเรียนแล้ว อ่านเนื้อหาแล้วกดตรวจสอบความเข้าใจได้เลย", "success");
    return;
  }
  if (action === "start-check") {
    state.activeUnitId = data.unit || state.activeUnitId;
    state.currentQuiz = lessonQuestions(state.activeUnitId);
    state.answers = {};
    state.lessonActivityIndex = 0;
    notify("เริ่มแบบทดสอบท้ายบท ตรวจทีละข้อ มีคำอธิบายและ XP", "success");
    render();
    return;
  }
  if (action === "mark-read") {
    await awardReadXp(data.unit || state.activeUnitId);
    return;
  }
  if (action === "clear-answers") {
    state.answers = {};
    notify("ล้างคำตอบแล้ว", "success");
    render();
    return;
  }
  if (action === "submit-check" || action === "submit-exam") {
    await submitQuiz(action === "submit-check");
    return;
  }
  if (action === "submit-one") {
    await submitOneLessonQuestion();
    return;
  }
  if (action === "new-exam") {
    state.currentView = "exam";
    state.currentQuiz = pickQuestions(state.subjectCode, 10);
    state.answers = {};
    notify("สุ่มชุดข้อสอบใหม่แล้ว", "success");
    render();
    return;
  }
  if (action === "refresh-progress") {
    await withBusy("กำลังซิงก์ความคืบหน้า", async () => {
      state.progress = await getProgress(state.user, state.studentKey, state.subjectCode);
      notify("โหลดความคืบหน้าล่าสุดแล้ว", "success");
    });
    return;
  }
  if (["home", "lesson", "review", "exam", "progress"].includes(action)) {
    state.currentView = action;
    if (action === "lesson") state.activeUnitId = state.progress?.currentUnitId || firstUnitId(state.subjectCode);
    if (action === "exam") {
      state.currentQuiz = pickQuestions(state.subjectCode, 10);
      state.answers = {};
    }
    await updatePresence(state.user, { currentView: action });
    render();
  }
}

async function awardReadXp(unitId) {
  if (!unitId) return;
  const readActivity = {
    id: `${unitId}_READ`,
    unitId,
    subjectCode: state.subjectCode,
    difficulty: "read",
    correctKey: "READ"
  };
  await withBusy("กำลังบันทึกการอ่าน", async () => {
    const result = await awardActivity(state.user, state.studentKey, state.subjectCode, readActivity, "READ", false);
    state.progress = result.progress;
    state.lessonRead = true;
    notify(`บันทึกการอ่านแล้ว +${result.xpAwarded || 0} XP`, "success");
  });
}

async function submitOneLessonQuestion() {
  const question = state.currentQuiz[state.lessonActivityIndex];
  if (!question) return;
  if (!state.answers[question.id]) {
    notify("เลือกคำตอบก่อนตรวจข้อนี้", "error");
    return;
  }
  await withBusy("กำลังตรวจคำตอบ", async () => {
    const result = await awardActivity(state.user, state.studentKey, state.subjectCode, question, state.answers[question.id], false);
    state.progress = result.progress;
    notify(result.isCorrect ? `ถูกต้อง +${result.xpAwarded || 0} XP` : "ยังไม่ถูก ระบบเก็บไว้ให้ทบทวน", result.isCorrect ? "success" : "error");
    state.lessonActivityIndex += 1;
    if (state.lessonActivityIndex >= state.currentQuiz.length) {
      await completeCurrentUnit();
      state.currentQuiz = [];
      state.answers = {};
      state.currentView = "progress";
    }
  });
}

async function submitQuiz(isLessonCheck) {
  const selected = state.currentQuiz.filter((q) => state.answers[q.id]);
  if (!state.currentQuiz.length) {
    notify("ยังไม่มีชุดคำถาม กรุณาเปิดบทเรียนหรือสุ่มข้อสอบก่อน", "error");
    return;
  }
  if (selected.length !== state.currentQuiz.length) {
    notify(`ตอบให้ครบก่อนส่ง ตอนนี้ตอบแล้ว ${selected.length}/${state.currentQuiz.length} ข้อ`, "error");
    return;
  }
  await withBusy("กำลังตรวจคำตอบ", async () => {
    let correct = 0;
    for (const question of state.currentQuiz) {
      const result = await awardActivity(state.user, state.studentKey, state.subjectCode, question, state.answers[question.id], false);
      if (result.isCorrect) correct += 1;
      state.progress = result.progress;
    }
    if (isLessonCheck) await completeCurrentUnit();
    state.currentQuiz = [];
    state.answers = {};
    state.currentView = "progress";
    notify(`ส่งแล้ว ถูก ${correct}/${selected.length} ข้อ ระบบบันทึก XP ให้แล้ว`, correct ? "success" : "error");
  });
}

async function completeCurrentUnit() {
  const subjectUnits = units.filter((u) => u.subjectCode === state.subjectCode);
  const currentIndex = subjectUnits.findIndex((u) => u.id === state.activeUnitId);
  const next = subjectUnits[currentIndex + 1];
  const completed = new Set(state.progress?.completedUnitIds || []);
  completed.add(state.activeUnitId);
  state.progress = {
    ...state.progress,
    completedUnitIds: [...completed],
    currentUnitId: next?.id || state.activeUnitId
  };
  await saveNavigation(state.user, state.studentKey, state.subjectCode, {
    completedUnitIds: [...completed],
    currentUnitId: next?.id || state.activeUnitId
  });
}

function bindTeacherMonitor() {
  const rowsEl = app.querySelector("#monitorRows");
  const summaryEl = app.querySelector("#monitorSummary");
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
    const online = filtered.filter((row) => row.state === "online").length;
    summaryEl.innerHTML = `
      <article><strong>${filtered.length}</strong><span>ตามตัวกรอง</span></article>
      <article><strong>${online}</strong><span>กำลังใช้งาน</span></article>
      <article><strong>${filtered.length - online}</strong><span>ออกจากหน้า/นิ่ง</span></article>
    `;
    rowsEl.innerHTML = filtered.map((row) => {
      const profile = row.profile || {};
      return `<article class="monitor-row ${row.state === "online" ? "online" : "offline"}">
        <div><strong>${profile.fullName || "ไม่ทราบชื่อ"}</strong><span>${profile.grade || "-"} ห้อง ${profile.room || "-"} เลขที่ ${profile.studentNo || "-"}</span></div>
        <span class="status-dot">${row.state === "online" ? "กำลังใช้งาน" : "ออกจากหน้า"}</span>
        <span>${formatView(row.currentView)}</span>
      </article>`;
    }).join("") || `<div class="empty-state">${icon("search")}<h3>ไม่พบข้อมูลตามตัวกรอง</h3><p>เมื่อนักเรียนเปิดบทเรียน สถานะจะขึ้นอัตโนมัติ</p></div>`;
  };
  [nameEl, gradeEl, roomEl].forEach((el) => el.addEventListener("input", paint));
  watchPresence((nextRows) => {
    rows = nextRows;
    paint();
  }, (error) => {
    rowsEl.innerHTML = `<div class="empty-state">${icon("search")}<h3>โหลดสถานะสดไม่สำเร็จ</h3><p>${escapeHtml(error.message || "Realtime Database ไม่ตอบสนอง")}</p></div>`;
  });
  window.setTimeout(() => {
    if (!rows.length && rowsEl.textContent.includes("กำลังโหลด")) {
      rows = state.profile ? [{
        id: state.user.uid,
        uid: state.user.uid,
        studentKey: state.studentKey,
        profile: state.profile,
        state: "online",
        currentView: state.currentView
      }] : [];
      paint();
      notify("Realtime Monitor ยังรอข้อมูลสดอยู่ จึงแสดง session ปัจจุบันก่อน", "info");
    }
  }, 4000);
}

async function withBusy(message, task) {
  state.busy = true;
  state.toast = { message, type: "info" };
  render();
  try {
    await task();
  } catch (error) {
    notify(error.message || "ทำรายการไม่สำเร็จ", "error");
    return;
  } finally {
    state.busy = false;
    render();
  }
}

function notify(message, type = "success") {
  state.toast = { message, type };
  render();
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => {
    state.toast = null;
    render();
  }, 2600);
}

function lessonQuestions(unitId) {
  return pickQuestions(state.subjectCode, 3, unitId);
}

function getLessonModel(unit) {
  if (LESSONS[unit.id]) return LESSONS[unit.id];
  const items = Array.isArray(unit.items) ? unit.items : String(unit.summary || "").split(/\s*\/\s*/).filter(Boolean);
  return {
    lead: unit.indicator || unit.summary || "อ่านเนื้อหา จับประเด็นสำคัญ แล้วตอบท้ายบทเพื่อสะสม XP",
    points: items.slice(0, 5),
    mission: "อธิบายประเด็นสำคัญด้วยภาษาของตนเอง และเลือกคำตอบที่ตรงกับหลักฐาน/หลักธรรมมากที่สุด"
  };
}

function buildAvatarPreview(seed = "") {
  const id = hash(seed || "student");
  const colors = ["#5b4bff", "#19b4c6", "#ff6a21", "#16a34a", "#d946ef", "#f59e0b"];
  const c1 = colors[id % colors.length];
  const c2 = colors[(id + 2) % colors.length];
  const face = ["M9 11h.01 M15 11h.01 M9 15c2 1.6 4 1.6 6 0", "M8 14c2 2 6 2 8 0 M9 10h.01 M15 10h.01", "M8.5 14.5c2.2 1 4.8 1 7 0 M9 11h.01 M15 11h.01"][id % 3];
  return `<svg class="avatar-svg" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="g${id}" x1="0" x2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <circle cx="32" cy="32" r="30" fill="url(#g${id})"/>
    <circle cx="32" cy="30" r="15" fill="rgba(255,255,255,.82)"/>
    <path d="${face}" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>
    <path d="M18 53c4-9 24-9 28 0" fill="rgba(255,255,255,.82)"/>
  </svg>`;
}

function renderLeaderboard(title, compact) {
  const rows = buildMockLeaderboard();
  return `<section class="${compact ? "leaderboard compact" : "leaderboard"}">
    <div class="section-head"><div><p class="eyebrow">Ranking</p><h2>${title}</h2></div><span class="status-chip">XP / Progress</span></div>
    <div class="podium">
      ${rows.slice(0, 3).map((r, i) => `<article class="podium-card rank-${i + 1}"><b>#${i + 1}</b><div class="avatar-sm">${buildAvatarPreview(r.key)}</div><strong>${escapeHtml(r.name)}</strong><span>${r.xp} XP</span></article>`).join("")}
    </div>
    <div class="rank-list">${rows.slice(3, 8).map((r, i) => `<article><b>${i + 4}</b><div class="avatar-xs">${buildAvatarPreview(r.key)}</div><span>${escapeHtml(r.name)}</span><strong>${r.xp}</strong></article>`).join("")}</div>
  </section>`;
}

function buildMockLeaderboard() {
  const me = {
    key: state.studentKey || "me",
    name: state.profile?.fullName || "นักเรียนของฉัน",
    xp: Number(state.progress?.xp || 0)
  };
  const base = [
    { key: "seed1", name: "นักเรียนตัวอย่าง 1", xp: 180 },
    { key: "seed2", name: "นักเรียนตัวอย่าง 2", xp: 140 },
    { key: "seed3", name: "นักเรียนตัวอย่าง 3", xp: 105 },
    { key: "seed4", name: "นักเรียนตัวอย่าง 4", xp: 84 },
    { key: "seed5", name: "นักเรียนตัวอย่าง 5", xp: 62 },
    { key: "seed6", name: "นักเรียนตัวอย่าง 6", xp: 34 },
    me
  ];
  return base.sort((a, b) => b.xp - a.xp);
}

function mockRank(xp) {
  if (xp >= 180) return 1;
  if (xp >= 140) return 2;
  if (xp >= 105) return 3;
  if (xp >= 62) return 4;
  if (xp >= 34) return 5;
  return 6;
}

function hash(value) {
  return [...String(value)].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

function pickQuestions(subjectCode, count, unitId = "") {
  const pool = questionBank.filter((q) => q.subjectCode === subjectCode && (!unitId || q.unitId === unitId));
  return shuffle(pool).slice(0, count);
}

function currentSubject() {
  return subjects.find((item) => item.code === state.subjectCode) || subjects[1];
}

function firstUnitId(subjectCode) {
  return units.find((u) => u.subjectCode === subjectCode)?.id || "HIS_U01";
}

function navButton(action, iconName, label) {
  return `<button class="${state.currentView === action ? "active" : ""}" data-action="${action}">${icon(iconName)}<span>${label}</span></button>`;
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function formatView(value = "-") {
  if (value.startsWith("lesson:")) return `กำลังเรียน ${value.replace("lesson:", "")}`;
  if (value.startsWith("unit:")) return `ทำกิจกรรม ${value.replace("unit:", "")}`;
  const map = { home: "หน้าแรก", lesson: "บทเรียน", review: "ทบทวน", exam: "จำลองสอบ", progress: "ดูความก้าวหน้า" };
  return map[value] || value || "-";
}

function showFatal(error) {
  app.innerHTML = `<div class="fatal"><h1>เปิดระบบไม่สำเร็จ</h1><p>${escapeHtml(error.message)}</p></div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function icon(name) {
  const icons = {
    book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z M4 5.5v16 M8 7h8 M8 11h8",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z M19 12h2 M3 12h2 M12 3v2 M12 19v2 M17 5l-1.4 1.4 M8.4 17.6L7 19 M7 5l1.4 1.4 M15.6 17.6L17 19",
    type: "M4 6h16 M8 6v12 M16 6v12 M6 18h4 M14 18h4",
    user: "M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    play: "M8 5v14l11-7z",
    clipboard: "M9 4h6l1 2h3v15H5V6h3z M9 11h6 M9 15h6",
    refresh: "M20 12a8 8 0 0 1-14 5 M4 12a8 8 0 0 1 14-5 M18 3v4h-4 M6 21v-4h4",
    check: "M20 6L9 17l-5-5",
    spark: "M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8z",
    target: "M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10a5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2a1 1 0 0 0 0 2z",
    send: "M4 12l16-8-5 16-3-7z",
    close: "M6 6l12 12 M18 6L6 18",
    home: "M4 11l8-7 8 7v9H6v-6h12",
    search: "M11 18a7 7 0 1 1 5-2l4 4"
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${icons[name] || icons.book}"/></svg>`;
}
