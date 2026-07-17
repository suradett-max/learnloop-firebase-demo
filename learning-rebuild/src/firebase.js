import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const rtdb = getDatabase(app);

export async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          unsubscribe();
          resolve(user);
          return;
        }
        const credential = await signInAnonymously(auth);
        unsubscribe();
        resolve(credential.user);
      } catch (error) {
        unsubscribe();
        reject(error);
      }
    }, reject);
  });
}

