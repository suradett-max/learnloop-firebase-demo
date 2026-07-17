export function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildStudentKey(profile) {
  const studentId = normalizeText(profile.studentId);
  const grade = normalizeText(profile.grade);
  const room = normalizeText(profile.room);
  const no = normalizeText(profile.studentNo).padStart(2, "0");
  const name = normalizeText(profile.fullName).replace(/[^\p{L}\p{N}]+/gu, "-");
  if (studentId) return `sid_${studentId}`;
  return `class_${grade}_${room}_${no}_${name}`;
}

export function buildIdentityAliases(profile) {
  const aliases = new Set();
  const key = buildStudentKey(profile);
  aliases.add(key);
  if (profile.studentId) aliases.add(`sid_${normalizeText(profile.studentId)}`);
  if (profile.grade && profile.room && profile.studentNo) {
    aliases.add(`class_${normalizeText(profile.grade)}_${normalizeText(profile.room)}_${normalizeText(profile.studentNo).padStart(2, "0")}`);
  }
  return [...aliases];
}

