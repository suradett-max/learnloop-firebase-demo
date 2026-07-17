import { onValue, ref } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { rtdb } from "../firebase.js";

export function watchPresence(callback, onError) {
  return onValue(ref(rtdb, "presence"), (snapshot) => {
    const rows = [];
    snapshot.forEach((child) => rows.push({ id: child.key, ...child.val() }));
    callback(rows.sort((a, b) => String(b.lastChanged || "").localeCompare(String(a.lastChanged || ""))));
  }, (error) => {
    if (onError) onError(error);
  });
}
