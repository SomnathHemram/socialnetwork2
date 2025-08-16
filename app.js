// app.js (refactored with code quality improvements)

// =============================
// 1) Firebase SDK imports
// =============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, query, orderBy, onSnapshot, limit
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

// =============================
// 2) Firebase Config
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyC2oJGAAS0yJLyN2bIquoyNJIuF2eJVU9w",
  authDomain: "socialnetwork-3572e.firebaseapp.com",
  projectId: "socialnetwork-3572e",
  storageBucket: "socialnetwork-3572e.firebasestorage.app",
  messagingSenderId: "972185002081",
  appId: "1:972185002081:web:0b91a001d3c7d3a2654a20",
};

// Init Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// =============================
// 3) DOM Elements
// =============================
const authModal = document.getElementById("authModal");
const appRoot = document.getElementById("app");
const googleBtn = document.getElementById("googleBtn");
const logoutBtn = document.getElementById("logoutBtn");
const postBtn = document.getElementById("postBtn");
const postInput = document.getElementById("postInput");
const newsFeed = document.getElementById("newsFeed");
const editProfileBtn = document.getElementById("editProfileBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
const darkModeToggle = document.getElementById("darkModeToggle");

const userAvatar = document.getElementById("userAvatar");
const navAvatar = document.getElementById("navAvatar");
const userName = document.getElementById("userName");
const bioDisplay = document.getElementById("bioDisplay");

const profileModal = document.getElementById("profileModal");
const avatarFile = document.getElementById("avatarFile");
const avatarInput = document.getElementById("avatarInput");
const bioInput = document.getElementById("bioInput");

// =============================
// 4) Utilities
// =============================
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) { return escapeHtml(str).replaceAll("`", "&#x60;"); }

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

// =============================
// 5) Auth Handlers
// =============================
googleBtn?.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Login failed", err);
    alert("Login failed. Please try again.");
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout failed", err);
  }
});

// =============================
// 6) App State
// =============================
let feedUnsub = null;

// =============================
// 7) Auth State Listener
// =============================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    hide(authModal);
    show(appRoot);

    await ensureUserDoc(user);
    await applyProfile(user.uid);
    startFeed();
    await migrateLocalPosts(user);
  } else {
    hide(appRoot);
    show(authModal);
    if (feedUnsub) { feedUnsub(); feedUnsub = null; }
  }
});

// =============================
// 8) Profile Management
// =============================
async function ensureUserDoc(user) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      displayName: user.displayName || "Anonymous",
      avatar: user.photoURL || "",
      bio: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

async function applyProfile(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const data = snap.data() || {};

  userName.textContent = data.displayName || "User";
  const avatar = data.avatar || "https://via.placeholder.com/100?text=User";
  userAvatar.src = avatar;
  navAvatar.src = avatar;

  if (data.bio) {
    bioDisplay.innerHTML = `<p>${escapeHtml(data.bio)}</p>`;
    show(bioDisplay);
  } else hide(bioDisplay);
}

editProfileBtn?.addEventListener("click", async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data() || {};
  avatarInput.value = data.avatar || "";
  bioInput.value = data.bio || "";
  avatarFile.value = "";
  show(profileModal);
});

cancelProfileBtn?.addEventListener("click", () => hide(profileModal));

saveProfileBtn?.addEventListener("click", async () => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    let avatarUrl = avatarInput.value.trim();
    if (avatarFile.files?.[0]) {
      const fileRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(fileRef, avatarFile.files[0]);
      avatarUrl = await getDownloadURL(fileRef);
    }

    await updateDoc(doc(db, "users", user.uid), {
      avatar: avatarUrl,
      bio: bioInput.value.slice(0, 300),
      updatedAt: serverTimestamp()
    });

    await applyProfile(user.uid);
    hide(profileModal);
  } catch (err) {
    console.error("Profile update failed", err);
    alert("Could not update profile.");
  }
});

// =============================
// 9) Posts: Add + Render
// =============================
postBtn?.addEventListener("click", async () => {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const text = postInput.value.trim();
    if (!text) return;

    const uSnap = await getDoc(doc(db, "users", user.uid));
    const u = uSnap.data() || {};

    await addDoc(collection(db, "posts"), {
      uid: user.uid,
      author: u.displayName || user.displayName || "User",
      avatar: u.avatar || user.photoURL || "",
      content: text.slice(0, 1000),
      createdAt: serverTimestamp()
    });

    postInput.value = "";
  } catch (err) {
    console.error("Failed to add post", err);
  }
});

function createPostCard(p) {
  const time = p.createdAt?.toDate?.() ? p.createdAt.toDate().toLocaleString() : "Just now";
  const el = document.createElement("div");
  el.className = "p-4 bg-white dark:bg-gray-700 rounded-xl shadow transition transform hover:scale-[1.01]";
  el.innerHTML = `
    <div class="flex items-start gap-3">
      <img src="${escapeAttr(p.avatar || 'https://via.placeholder.com/40?text=U')}"
           class="w-10 h-10 rounded-full object-cover border border-white" alt="Avatar"/>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <strong>${escapeHtml(p.author || 'User')}</strong>
          <small class="text-sm text-gray-400">${time}</small>
        </div>
        <p class="mt-2 whitespace-pre-wrap break-words">${escapeHtml(p.content || '')}</p>
      </div>
    </div>`;
  return el;
}

function startFeed() {
  if (feedUnsub) feedUnsub();
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(100));
  feedUnsub = onSnapshot(q, (snap) => {
    newsFeed.innerHTML = "";
    snap.forEach(docSnap => {
      const p = docSnap.data();
      newsFeed.appendChild(createPostCard(p));
    });
  });
}

// =============================
// 10) Migration from LocalStorage
// =============================
async function migrateLocalPosts(user) {
  try {
    const migratedKey = `migratedPosts_${user.uid}`;
    if (localStorage.getItem(migratedKey)) return;

    const old = JSON.parse(localStorage.getItem("connecthubPosts") || "[]");
    if (!old.length) {
      localStorage.setItem(migratedKey, "1");
      return;
    }

    const uSnap = await getDoc(doc(db, "users", user.uid));
    const u = uSnap.data() || {};
    for (const post of old.slice(0, 200)) {
      await addDoc(collection(db, "posts"), {
        uid: user.uid,
        author: u.displayName || user.displayName || post.user || "User",
        avatar: u.avatar || user.photoURL || "",
        content: String(post.content || "").slice(0, 1000),
        createdAt: serverTimestamp()
      });
    }
    localStorage.setItem(migratedKey, "1");
  } catch (e) {
    console.warn("Migration skipped:", e);
  }
}

// =============================
// 11) Dark Mode Toggle
// =============================
darkModeToggle?.addEventListener("click", () => {
  const html = document.documentElement;
  html.classList.toggle("dark");
  localStorage.setItem("theme", html.classList.contains("dark") ? "dark" : "light");
});

// Load theme preference
(function () {
  if (localStorage.getItem("theme") === "dark") {
    document.documentElement.classList.add("dark");
  }
})();
