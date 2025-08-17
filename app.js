// Instagram-style ConnectHub (No Storage, Image URLs only)

// --- Firebase imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp,
  collection, addDoc, query, orderBy, onSnapshot, limit, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyC2oJGAAS0yJLyN2bIquoyNJIuF2eJVU9w",
  authDomain: "socialnetwork-3572e.firebaseapp.com",
  projectId: "socialnetwork-3572e",
  storageBucket: "socialnetwork-3572e.firebasestorage.app",
  messagingSenderId: "972185002081",
  appId: "1:972185002081:web:0b91a001d3c7d3a2654a20",
};

// --- init ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ---
const authModal = document.getElementById("authModal");
const appRoot = document.getElementById("app");
const googleBtn = document.getElementById("googleBtn");
const darkModeToggle = document.getElementById("darkModeToggle");
const navAvatar = document.getElementById("navAvatar");
const userAvatar = document.getElementById("userAvatar");

const postInput = document.getElementById("postInput");
const imageUrlInput = document.getElementById("imageUrlInput");
const postBtn = document.getElementById("postBtn");
const newsFeed = document.getElementById("newsFeed");

// --- utils ---
const show = el => el.classList.remove("hidden");
const hide = el => el.classList.add("hidden");
const escapeHtml = (s) => String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

// --- auth ---
googleBtn?.addEventListener("click", async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch(e){ alert(e.code || "Login failed"); }
});

// theme
darkModeToggle?.addEventListener("click", () => {
  const html = document.documentElement;
  html.classList.toggle("dark");
  localStorage.setItem("theme", html.classList.contains("dark") ? "dark" : "light");
});
if (localStorage.getItem("theme") === "dark") document.documentElement.classList.add("dark");

// --- state ---
let feedUnsub = null;

// --- auth state ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    hide(authModal); show(appRoot);
    await ensureUserDoc(user);
    await applyProfile(user.uid);
    startFeed();
  } else {
    show(authModal); hide(appRoot);
    if (feedUnsub) { feedUnsub(); feedUnsub = null; }
  }
});

async function ensureUserDoc(user) {
  const uref = doc(db, "users", user.uid);
  const snap = await getDoc(uref);
  if (!snap.exists()) {
    await setDoc(uref, {
      displayName: user.displayName || "Anonymous",
      avatar: user.photoURL || "",
      createdAt: serverTimestamp()
    });
  }
}

async function applyProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data() || {};
  const avatar = data.avatar || "https://via.placeholder.com/100?text=U";
  userAvatar.src = avatar;
  navAvatar.src = avatar;
}

// --- create post (caption + optional imageURL) ---
postBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const caption = postInput.value.trim();
  const imageURL = imageUrlInput.value.trim();

  if (!caption && !imageURL) return;

  const uSnap = await getDoc(doc(db, "users", user.uid));
  const u = uSnap.data() || {};

  await addDoc(collection(db, "posts"), {
    uid: user.uid,
    author: u.displayName || user.displayName || "User",
    avatar: u.avatar || user.photoURL || "",
    content: caption.slice(0, 1000),
    imageURL,
    createdAt: serverTimestamp()
  });

  // reset
  postInput.value = "";
  imageUrlInput.value = "";
});

// --- feed ---
function startFeed() {
  if (feedUnsub) feedUnsub();
  const q = query(collection(db, "posts"), orderBy("createdAt","desc"), limit(50));
  feedUnsub = onSnapshot(q, (snap) => {
    newsFeed.innerHTML = "";
    snap.forEach(docSnap => {
      const p = { id: docSnap.id, ...docSnap.data() };
      newsFeed.appendChild(renderPostCard(p));
    });
  });
}

// like toggle
async function toggleLike(postId) {
  const user = auth.currentUser; if (!user) return;
  const likeRef = doc(db, "posts", postId, "likes", user.uid);
  const s = await getDoc(likeRef);
  if (s.exists()) await deleteDoc(likeRef);
  else await setDoc(likeRef, { createdAt: serverTimestamp() });
}

// render post
function renderPostCard(p) {
  const el = document.createElement("article");
  el.className = "bg-black";

  const time = p.createdAt?.toDate?.()
    ? p.createdAt.toDate().toLocaleString()
    : "Just now";

  el.innerHTML = `
    <div class="px-4">
      <div class="flex items-center gap-3 py-2">
        <img src="${escapeHtml(p.avatar || 'https://via.placeholder.com/40?text=U')}" class="w-8 h-8 rounded-full object-cover ring-1 ring-white/20" alt="">
        <div class="flex flex-col">
          <span class="text-sm font-semibold">${escapeHtml(p.author || 'User')}</span>
          <span class="text-xs text-white/50">${time}</span>
        </div>
      </div>
    </div>

    ${p.imageURL
      ? `<div><img src="${escapeHtml(p.imageURL)}" class="w-full max-h-[80vh] object-contain bg-black" alt=""></div>`
      : `<div class="px-4 pt-2"><p class="text-base">${escapeHtml(p.content || '')}</p></div>`}

    <div class="px-3 pt-2">
      <div class="flex items-center gap-4 text-2xl">
        <button class="tap likeBtn">♡</button>
        <button class="tap commentBtn">💬</button>
        <span class="flex-1"></span>
        <button class="tap">🔖</button>
      </div>
      <div class="mt-1 text-sm">
        <span class="likesCount font-semibold">0</span> likes
      </div>
      ${p.imageURL && p.content
        ? `<div class="mt-1"><span class="font-semibold">${escapeHtml(p.author || 'User')}</span> <span>${escapeHtml(p.content)}</span></div>`
        : `${!p.imageURL && p.content ? '' : ''}`
      }
      <button class="tap mt-1 text-white/50 text-sm viewComments">View comments</button>
      <div class="comments hidden mt-2 space-y-2"></div>
      <div class="addComment hidden mt-2 flex gap-2 items-center">
        <input type="text" class="commentInput flex-1 bg-transparent border border-white/20 rounded px-3 py-1 text-sm placeholder-white/40" placeholder="Add a comment...">
        <button class="sendComment text-sm px-3 py-1 rounded bg-white text-black font-semibold">Post</button>
      </div>
    </div>
  `;

  // likes
  const likeBtn = el.querySelector(".likeBtn");
  const likesCountEl = el.querySelector(".likesCount");
  const user = auth.currentUser;
  const likesUnsub = onSnapshot(collection(db, "posts", p.id, "likes"), (s) => {
    likesCountEl.textContent = String(s.size);
    if (user && s.docs.find(d => d.id === user.uid)) likeBtn.textContent = "❤️";
    else likeBtn.textContent = "♡";
  });
  likeBtn.addEventListener("click", () => toggleLike(p.id));

  // comments
  const viewBtn = el.querySelector(".viewComments");
  const commentsDiv = el.querySelector(".comments");
  const addCommentRow = el.querySelector(".addComment");
  const commentInput = el.querySelector(".commentInput");
  const sendBtn = el.querySelector(".sendComment");
  let opened = false;
  viewBtn.addEventListener("click", () => {
    if (opened) return; opened = true;
    commentsDiv.classList.remove("hidden");
    addCommentRow.classList.remove("hidden");
    const q = query(collection(db, "posts", p.id, "comments"), orderBy("createdAt","asc"), limit(50));
    onSnapshot(q, (snap) => {
      commentsDiv.innerHTML = "";
      snap.forEach(cs => {
        const c = cs.data();
        const row = document.createElement("div");
        row.className = "text-sm";
        row.innerHTML = `<span class="font-semibold">${escapeHtml(c.author || 'User')}</span> <span>${escapeHtml(c.text || '')}</span>`;
        commentsDiv.appendChild(row);
      });
    });
  });
  sendBtn.addEventListener("click", async () => {
    const text = commentInput.value.trim(); if (!text) return;
    const u = auth.currentUser; if (!u) return;
    const uSnap = await getDoc(doc(db, "users", u.uid));
    const ud = uSnap.data() || {};
    await addDoc(collection(db, "posts", p.id, "comments"), {
      uid: u.uid,
      author: ud.displayName || u.displayName || "User",
      avatar: ud.avatar || u.photoURL || "",
      text: text.slice(0,500),
      createdAt: serverTimestamp()
    });
    commentInput.value = "";
  });

  return el;
}

// --- sign out (right-click avatar) ---
navAvatar?.addEventListener("contextmenu", async (e) => {
  e.preventDefault();
  if (confirm("Logout?")) await signOut(auth);
});
