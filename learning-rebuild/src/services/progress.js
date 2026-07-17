import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { db } from "../firebase.js";
import { buildIdentityAliases, buildStudentKey } from "./identity.js";

export function emptyProgress(uid, studentKey, subjectCode = "S22102") {
  return {
    uid,
    studentKey,
    subjectCode,
    xp: 0,
    currentUnitId: subjectCode === "S22101" ? "BUD_U01" : "HIS_U01",
    currentQuestionIndex: 0,
    completedActivityIds: [],
    incorrectActivityIds: [],
    completedUnitIds: [],
    updatedAt: null
  };
}

export async function upsertProfile(user, profile) {
  const studentKey = buildStudentKey(profile);
  const aliases = buildIdentityAliases(profile);
  const canonical = await findCanonicalStudentKey(user.uid, aliases);
  const finalKey = canonical || studentKey;
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    studentKey: finalKey,
    profile,
    aliases,
    updatedAt: serverTimestamp()
  }, { merge: true });
  await setDoc(doc(db, "studentIndex", finalKey), {
    uid: user.uid,
    studentKey: finalKey,
    aliases,
    profile,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return finalKey;
}

export async function getProgress(user, studentKey, subjectCode) {
  const ref = doc(db, "users", user.uid, "progress", subjectCode);
  const snap = await getDoc(ref);
  if (snap.exists()) return { ...emptyProgress(user.uid, studentKey, subjectCode), ...snap.data() };
  const created = emptyProgress(user.uid, studentKey, subjectCode);
  await setDoc(ref, { ...created, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  return created;
}

export async function awardActivity(user, studentKey, subjectCode, activity, selectedKey, usedHint = false) {
  const progressRef = doc(db, "users", user.uid, "progress", subjectCode);
  const attemptRef = doc(collection(db, "users", user.uid, "attempts"));
  const isCorrect = selectedKey === activity.correctKey;
  const baseXp = activity.difficulty === "hard" ? 16 : 10;
  const xpGain = isCorrect ? Math.max(1, baseXp - (usedHint ? 3 : 0)) : 0;
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(progressRef);
    const current = snap.exists() ? snap.data() : emptyProgress(user.uid, studentKey, subjectCode);
    const completed = new Set(current.completedActivityIds || []);
    const incorrect = new Set(current.incorrectActivityIds || []);
    const alreadyDone = completed.has(activity.id);
    const awarded = isCorrect && !alreadyDone ? xpGain : 0;
    if (isCorrect) {
      completed.add(activity.id);
      incorrect.delete(activity.id);
    } else {
      incorrect.add(activity.id);
    }
    const next = {
      ...current,
      uid: user.uid,
      studentKey,
      subjectCode,
      currentUnitId: activity.unitId,
      xp: Math.max(Number(current.xp || 0), Number(current.xp || 0) + awarded),
      completedActivityIds: [...completed],
      incorrectActivityIds: [...incorrect],
      updatedAt: serverTimestamp()
    };
    tx.set(progressRef, next, { merge: true });
    tx.set(attemptRef, {
      uid: user.uid,
      studentKey,
      subjectCode,
      activityId: activity.id,
      unitId: activity.unitId,
      selectedKey,
      correctKey: activity.correctKey,
      isCorrect,
      xpAwarded: awarded,
      createdAt: serverTimestamp()
    });
    return { progress: { ...next, updatedAt: new Date().toISOString() }, isCorrect, xpAwarded: awarded };
  });
  return result;
}

export async function saveNavigation(user, subjectCode, patch) {
  const ref = doc(db, "users", user.uid, "progress", subjectCode);
  await setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

async function findCanonicalStudentKey(uid, aliases) {
  for (const alias of aliases) {
    const q = query(collection(db, "studentIndex"), where("aliases", "array-contains", alias), limit(1));
    const snap = await getDocs(q);
    const found = snap.docs.find((item) => item.data().uid === uid || item.data().studentKey);
    if (found) return found.data().studentKey || found.id;
  }
  return null;
}
