import { ref, onDisconnect, onValue, serverTimestamp, set, update } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { rtdb } from "../firebase.js";

export function startPresence(user, studentKey, profile) {
  const statusRef = ref(rtdb, `presence/${user.uid}`);
  const connectedRef = ref(rtdb, ".info/connected");
  set(statusRef, {
    uid: user.uid,
    studentKey,
    profile,
    state: "online",
    currentView: "home",
    lastChanged: serverTimestamp()
  });
  const unsubscribe = onValue(connectedRef, (snapshot) => {
    if (!snapshot.val()) return;
    onDisconnect(statusRef).set({
      uid: user.uid,
      studentKey,
      profile,
      state: "offline",
      lastChanged: serverTimestamp()
    });
    set(statusRef, {
      uid: user.uid,
      studentKey,
      profile,
      state: "online",
      currentView: "home",
      lastChanged: serverTimestamp()
    });
  });
  return () => unsubscribe();
}

export function updatePresence(user, patch) {
  return update(ref(rtdb, `presence/${user.uid}`), {
    ...patch,
    lastChanged: serverTimestamp()
  });
}
