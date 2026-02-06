import {
  getShowcaseProjects,
  addShowcaseProject,
  updateShowcaseProject,
  deleteShowcaseProject,
  getShowcaseCommentsByProject,
  addShowcaseComment,
  listenToShowcaseProjects,
  listenToShowcaseComments,
  uploadShowcaseDemoVideo,
  addShowcaseSuggestion,
  listenToShowcaseSuggestionsForUser,
} from "./showcase-storage.js";

function toast(type, title, message) {
  if (window.appUI && typeof window.appUI.toast === "function") {
    window.appUI.toast({ type, title, message });
    return;
  }
  // eslint-disable-next-line no-alert
  alert(`${title}\n\n${message}`);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatShortDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso || "");
  }
}

function formatDateOnly(iso) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return String(iso || "");
  }
}

function getYouTubeVideoId(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      return u.pathname.replace(/^\//, "").slice(0, 11);
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (u.pathname === "/watch") {
        return String(u.searchParams.get("v") || "").slice(0, 11);
      }
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return String(parts[embedIdx + 1]).slice(0, 11);
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return String(parts[shortsIdx + 1]).slice(0, 11);
    }
  } catch {
    // ignore
  }
  return "";
}

function getProjectPreviewImageUrl(project) {
  const p = project && typeof project === "object" ? project : {};
  const direct = String(p.imageUrl || "").trim();
  if (direct) return direct;

  const yt = getYouTubeVideoId(p.demoVideoUrl);
  if (yt) return `https://img.youtube.com/vi/${encodeURIComponent(yt)}/hqdefault.jpg`;
  return "";
}

function parseTags(input) {
  return String(input || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/\s+/g, " "));
}

function isValidUrl(url) {
  const s = String(url || "").trim();
  if (!s) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function getCurrentUser() {
  const name = String(localStorage.getItem("userName") || "").trim();
  const email = String(localStorage.getItem("userEmail") || "").trim();
  const employeeId = String(localStorage.getItem("employeeId") || "").trim();

  const fallbackId =
    employeeId || email || `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id: fallbackId,
    name: name || (email ? email.split("@")[0] : "Guest"),
    email,
  };
}

function isAdminUser() {
  // Matches auth.js / dashboard role sync (stores 'admin' or 'user')
  const role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
  return role === "admin";
}

function canDeleteProject(project) {
  if (isAdminUser()) return true;

  const p = project && typeof project === "object" ? project : {};
  const makerId = String(p.makerId || "").trim();
  const makerEmail = String(p.makerEmail || "").trim().toLowerCase();

  const myId = String(state.user?.id || "").trim();
  const myEmail = String(state.user?.email || "").trim().toLowerCase();

  if (makerId && myId && makerId === myId) return true;
  if (makerEmail && myEmail && makerEmail === myEmail) return true;
  return false;
}

function computeTrendingScore(p) {
  const up = Number(p.upvotes) || 0;
  const cc = Number(p.commentsCount) || 0;
  const ageHours = Math.max(1, (Date.now() - new Date(p.createdAt).getTime()) / 36e5);
  return (up * 2 + cc) / Math.pow(ageHours, 0.7);
}

function buildThreadTree(comments) {
  const byParent = new Map();
  for (const c of comments) {
    const parent = c.parentId || null;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(c);
  }

  for (const [k, arr] of byParent.entries()) {
    arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    byParent.set(k, arr);
  }

  const build = (parentId) => {
    const children = byParent.get(parentId || null) || [];
    return children.map((c) => ({ ...c, replies: build(c.id) }));
  };

  return build(null);
}

const els = {
  rootSection: document.getElementById("showcase-view"),

  browseBtn: document.getElementById("scBrowseBtn"),
  deleteBtn: document.getElementById("scDeleteProjectBtn"),
  submitBtn: document.getElementById("scSubmitBtn"),
  refreshBtn: document.getElementById("scRefreshBtn"),

  modeHome: document.getElementById("scModeHome"),
  modeSubmit: document.getElementById("scModeSubmit"),
  modeProject: document.getElementById("scModeProject"),

  searchInput: document.getElementById("scSearchInput"),
  tagBar: document.getElementById("scTagBar"),
  sortTrending: document.getElementById("scSortTrending"),
  sortNewest: document.getElementById("scSortNewest"),
  projectGrid: document.getElementById("scProjectGrid"),
  emptyState: document.getElementById("scEmptyState"),

  stepTitle: document.getElementById("scStepTitle"),
  stepDots: document.getElementById("scStepDots"),
  btnPrev: document.getElementById("scBtnPrev"),
  btnNext: document.getElementById("scBtnNext"),
  btnLaunch: document.getElementById("scBtnLaunch"),

  step1: document.getElementById("scStep1"),
  step2: document.getElementById("scStep2"),
  step3: document.getElementById("scStep3"),

  fName: document.getElementById("scFName"),
  fTagline: document.getElementById("scFTagline"),
  fTags: document.getElementById("scFTags"),
  fDescription: document.getElementById("scFDescription"),
  fImageUrl: document.getElementById("scFImageUrl"),
  fDemoUrl: document.getElementById("scFDemoUrl"),
  fDemoVideoUrl: document.getElementById("scFDemoVideoUrl"),
  fDemoVideoFile: document.getElementById("scFDemoVideoFile"),
  videoUploadStatus: document.getElementById("scVideoUploadStatus"),
  fCodeUrl: document.getElementById("scFCodeUrl"),
  fCodeSnippet: document.getElementById("scFCodeSnippet"),

  backBtn: document.getElementById("scBackBtn"),
  pTitle: document.getElementById("scPTitle"),
  pMeta: document.getElementById("scPMeta"),
  pTagline: document.getElementById("scPTagline"),
  pImage: document.getElementById("scPImage"),
  pVideo: document.getElementById("scPVideo"),
  pDescription: document.getElementById("scPDescription"),
  pTags: document.getElementById("scPTags"),
  pLinks: document.getElementById("scPLinks"),
  upvoteBtn: document.getElementById("scUpvoteBtn"),
  upvoteCount: document.getElementById("scUpvoteCount"),
  commentCount: document.getElementById("scCommentCount"),
  suggestCount: document.getElementById("scSuggestCount"),
  suggestBtn: document.getElementById("scSuggestBtn"),

  copyCodeBtn: document.getElementById("scCopyCodeBtn"),
  codeBlock: document.getElementById("scCodeBlock"),
  codeHint: document.getElementById("scCodeHint"),

  commentForm: document.getElementById("scCommentForm"),
  commentBody: document.getElementById("scCommentBody"),
  thread: document.getElementById("scThread"),
};

const state = {
  user: getCurrentUser(),
  projects: [],
  comments: [],
  activeProjectId: null,
  query: "",
  selectedTag: null,
  sortMode: "trending",
  mode: "home", // home | submit | project

  wizardStep: 0,

  initialized: false,
  unsubProjects: null,
  unsubComments: null,
};

function getMainScroller() {
  return document.querySelector(".main-content") || document.scrollingElement || document.documentElement;
}

const wizardSteps = [
  { title: "Basics" },
  { title: "Story & Media" },
  { title: "Links & Code" },
];

function showMode(mode) {
  state.mode = mode;
  els.modeHome.style.display = mode === "home" ? "block" : "none";
  els.modeSubmit.style.display = mode === "submit" ? "block" : "none";
  els.modeProject.style.display = mode === "project" ? "block" : "none";

  if (mode !== "project" && typeof state.unsubComments === "function") {
    state.unsubComments();
    state.unsubComments = null;
  }
}

function getFilteredSortedProjects() {
  const q = state.query.trim().toLowerCase();
  const tag = state.selectedTag;

  let list = [...state.projects];
  if (q) list = list.filter((p) => (p.name || "").toLowerCase().includes(q));
  if (tag) list = list.filter((p) => Array.isArray(p.tags) && p.tags.includes(tag));

  if (state.sortMode === "newest") list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else list.sort((a, b) => computeTrendingScore(b) - computeTrendingScore(a));

  return list;
}

function renderTagBar() {
  const tags = new Set();
  for (const p of state.projects) for (const t of p.tags || []) tags.add(t);
  const arr = Array.from(tags).sort((a, b) => a.localeCompare(b));

  els.tagBar.innerHTML = "";

  const all = document.createElement("button");
  all.type = "button";
  all.className = `sc-chip ${state.selectedTag ? "" : "active"}`;
  all.textContent = "All";
  all.addEventListener("click", () => {
    state.selectedTag = null;
    renderHome();
  });
  els.tagBar.appendChild(all);

  for (const t of arr) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `sc-chip ${state.selectedTag === t ? "active" : ""}`;
    b.textContent = t;
    b.addEventListener("click", () => {
      state.selectedTag = t;
      renderHome();
    });
    els.tagBar.appendChild(b);
  }
}

function renderHome() {
  renderTagBar();

  const list = getFilteredSortedProjects();
  els.projectGrid.innerHTML = "";
  els.emptyState.style.display = list.length ? "none" : "block";

  for (const p of list) {
    const card = document.createElement("article");
    card.className = "sc-card";

    const previewUrl = getProjectPreviewImageUrl(p);
    const thumb = previewUrl
      ? `<div class="sc-card-thumb"><img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(p.name)}"></div>`
      : `<div class="sc-card-thumb sc-thumb-fallback"><div>${escapeHtml((p.name || "Project").slice(0, 2).toUpperCase())}</div></div>`;

    card.innerHTML = `
      ${thumb}
      <p class="sc-card-title">${escapeHtml(p.name)}</p>
      <small class="sc-card-sub">Launched: ${escapeHtml(formatDateOnly(p.createdAt))}</small>
      <small class="sc-card-sub">Maker: ${escapeHtml(p.makerName || "Anonymous")}</small>
      ${p.tagline ? `<div class="sc-card-hook">${escapeHtml(p.tagline)}</div>` : ""}
      <div class="sc-card-meta">
        <div class="sc-counts">
          <span>Upvotes ${Number(p.upvotes) || 0}</span>
          <span>Comments ${Number(p.commentsCount) || 0}</span>
          <span>Suggestions ${Number(p.suggestionsCount) || 0}</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      void openProject(p.id);
    });

    els.projectGrid.appendChild(card);
  }
}

function upvoteKey(projectId) {
  return `showcaseUpvoted:${state.user.id}:${projectId}`;
}

async function openProject(projectId) {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) {
    toast("error", "Not found", "That project could not be found.");
    return;
  }

  state.activeProjectId = projectId;
  showMode("project");

  els.pTitle.textContent = p.name;
  els.pMeta.textContent = `by ${p.makerName || "Anonymous"} • launched ${formatShortDate(p.createdAt)}`;
  els.pTagline.textContent = p.tagline || "";
  els.pDescription.textContent = p.description || "";

  const previewUrl = getProjectPreviewImageUrl(p);
  if (previewUrl) {
    els.pImage.src = previewUrl;
    els.pImage.alt = p.name;
    els.pImage.style.display = "block";
  } else {
    els.pImage.style.display = "none";
  }

  // Keep inline video hidden; use the shared overlay player instead
  try {
    els.pVideo.pause();
  } catch {
    // ignore
  }
  els.pVideo.removeAttribute("src");
  els.pVideo.load();
  els.pVideo.style.display = "none";

  els.pTags.innerHTML = (p.tags || [])
    .map((t) => `<button type="button" class="sc-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    .join("");
  els.pTags.querySelectorAll("button[data-tag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedTag = String(btn.getAttribute("data-tag") || "");
      showMode("home");
      renderHome();
    });
  });

  const links = [];
  if (p.demoUrl) links.push(`<a class="sc-link" href="${escapeHtml(p.demoUrl)}" target="_blank" rel="noreferrer">Live demo</a>`);
  if (p.codeUrl) links.push(`<a class="sc-link" href="${escapeHtml(p.codeUrl)}" target="_blank" rel="noreferrer">Code</a>`);
  const watchBtn = p.demoVideoUrl
    ? `<button type="button" class="ghost" data-watch-demo="1" style="padding:8px 12px;">▶ Watch demo</button>`
    : "";

  const linksHtml = links.length ? links.join(" <span style='opacity:0.6'>•</span> ") : "<span style='opacity:0.7'>No links provided.</span>";
  els.pLinks.innerHTML = `${linksHtml}${watchBtn ? ` <span style='opacity:0.6'>•</span> ${watchBtn}` : ""}`;

  const watch = els.pLinks.querySelector("button[data-watch-demo]");
  if (watch) {
    watch.addEventListener("click", () => {
      if (typeof window.openUrlVideoPlayer === "function") {
        window.openUrlVideoPlayer(p.demoVideoUrl, `${p.name} — Demo`);
      } else {
        window.open(p.demoVideoUrl, "_blank", "noopener,noreferrer");
      }
    });
  }

  els.upvoteCount.textContent = String(Number(p.upvotes) || 0);
  if (els.commentCount) els.commentCount.textContent = String(Number(p.commentsCount) || 0);
  if (els.suggestCount) els.suggestCount.textContent = String(Number(p.suggestionsCount) || 0);

  const already = localStorage.getItem(upvoteKey(projectId)) === "1";
  els.upvoteBtn.disabled = false;
  els.upvoteBtn.textContent = already ? "Upvoted" : "Upvote";

  if (p.codeSnippet) {
    els.codeBlock.textContent = p.codeSnippet;
    els.copyCodeBtn.style.display = "inline-flex";
    els.codeBlock.style.display = "block";
    els.codeHint.style.display = "none";
  } else {
    els.codeBlock.textContent = "";
    els.copyCodeBtn.style.display = "none";
    els.codeBlock.style.display = "none";
    els.codeHint.style.display = "block";
  }

  state.comments = await getShowcaseCommentsByProject(projectId);
  renderThread();

  try {
    if (typeof state.unsubComments === "function") state.unsubComments();
    const unsub = listenToShowcaseComments(projectId, (comments) => {
      state.comments = comments;
      renderThread();
    });
    if (typeof unsub === "function") state.unsubComments = unsub;
  } catch {
    // ignore
  }
}

function renderThread() {
  const project = state.projects.find((p) => p.id === state.activeProjectId);
  if (!project) return;

  const root = buildThreadTree(state.comments);
  els.thread.innerHTML = "";

  if (!root.length) {
    els.thread.innerHTML = "<div style='opacity:0.75'>No comments yet. Be the first to leave feedback.</div>";
    return;
  }

  const makerId = project.makerId || project.makerEmail || "";

  const renderNode = (node, depth) => {
    const wrap = document.createElement("div");
    wrap.className = depth > 0 ? "sc-comment sc-reply" : "sc-comment";

    const isMaker = makerId && (node.authorId === makerId || node.authorEmail === makerId || node.authorEmail === project.makerEmail);
    wrap.classList.add(isMaker ? "sc-by-maker" : "sc-by-user");
    const replies = node.replies || [];
    const replyCount = depth === 0 && replies.length ? `<span class="sc-reply-count">${replies.length}</span>` : "";
    const badge = isMaker ? `<span class="sc-badge">Maker</span>${replyCount}` : replyCount;

    wrap.innerHTML = `
      <div class="sc-comment-head">
        <div class="sc-comment-author">${escapeHtml(node.authorName)} ${badge}</div>
        <div class="sc-head-right">
          <div class="sc-comment-time">${escapeHtml(formatShortDate(node.createdAt))}</div>
          <button type="button" class="sc-icon-btn sc-reply-toggle" data-reply="${escapeHtml(node.id)}" title="Reply">↩</button>
        </div>
      </div>
      <div class="sc-comment-body">${escapeHtml(node.body)}</div>

      <div class="sc-replybox" data-replybox="${escapeHtml(node.id)}" style="margin-top:8px; display:none;">
        <div class="sc-input-wrap">
          <textarea rows="3" style="width:100%; border-radius:12px; padding:10px 12px;" placeholder="Write a reply..."></textarea>
          <button type="button" class="sc-send-btn" data-send="${escapeHtml(node.id)}" title="Send">➤</button>
        </div>
      </div>
    `;

    const replyBtn = wrap.querySelector("button[data-reply]");
    const replyBox = wrap.querySelector("[data-replybox]");
    const replyTa = replyBox.querySelector("textarea");
    const sendBtn = wrap.querySelector("button[data-send]");

    replyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      replyBox.style.display = replyBox.style.display === "none" ? "block" : "none";
      if (replyBox.style.display === "block") replyTa.focus();
    });

    const sendReply = async () => {
      const body = String(replyTa.value || "").trim();
      if (!body) return;
      await postComment(body, node.id);
      replyTa.value = "";
      replyBox.style.display = "none";
    };

    if (sendBtn) {
      sendBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await sendReply();
      });
    }

    replyTa.addEventListener("keydown", async (e) => {
      if (e.key === "Escape") {
        replyBox.style.display = "none";
        e.stopPropagation();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        await sendReply();
      }
    });

    // Prevent clicks inside the reply box from toggling threads
    replyBox.addEventListener("click", (e) => e.stopPropagation());

    if (replies.length) {
      const repliesWrap = document.createElement("div");
      repliesWrap.className = "sc-replies is-collapsed";
      for (const r of replies) repliesWrap.appendChild(renderNode(r, depth + 1));
      wrap.appendChild(repliesWrap);

      // Toggle replies by clicking the main message (Google Chat thread feel)
      if (depth === 0) {
        wrap.classList.add("is-thread");
        wrap.addEventListener("click", (e) => {
          const interactive = e.target.closest("button, textarea, a, input, label");
          if (interactive) return;

          const scroller = getMainScroller();
          const beforeTop = wrap.getBoundingClientRect().top;

          const nowCollapsed = repliesWrap.classList.toggle("is-collapsed");

          // After layout updates, keep the main message pinned and reveal replies below.
          requestAnimationFrame(() => {
            try {
              const afterTop = wrap.getBoundingClientRect().top;
              const delta = afterTop - beforeTop;
              if (delta !== 0 && scroller) scroller.scrollTop += delta;

              if (!nowCollapsed && scroller) {
                const repliesRect = repliesWrap.getBoundingClientRect();
                const scrollerRect = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { bottom: window.innerHeight };
                const overflow = repliesRect.bottom - scrollerRect.bottom;
                if (overflow > 0) scroller.scrollTop += overflow + 8;
              }
            } catch {
              // ignore
            }
          });
        });
      }
    }

    return wrap;
  };

  for (const n of root) {
    els.thread.appendChild(renderNode(n, 0));
  }
}

async function postComment(body, parentId = null) {
  const projectId = state.activeProjectId;
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;

  const comment = {
    id: `c-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    projectId,
    parentId,
    authorName: state.user.name,
    authorEmail: state.user.email,
    authorId: state.user.id,
    body,
    createdAt: new Date().toISOString(),
  };

  const saved = await addShowcaseComment(comment);
  state.comments.push(saved);

  const nextCount = (Number(project.commentsCount) || 0) + 1;
  project.commentsCount = nextCount;
  try {
    await updateShowcaseProject(projectId, { commentsCount: nextCount });
  } catch {
    // ignore
  }

  renderThread();
}

function renderWizard() {
  els.step1.style.display = state.wizardStep === 0 ? "block" : "none";
  els.step2.style.display = state.wizardStep === 1 ? "block" : "none";
  els.step3.style.display = state.wizardStep === 2 ? "block" : "none";

  els.stepTitle.textContent = wizardSteps[state.wizardStep].title;

  els.btnPrev.disabled = state.wizardStep === 0;
  els.btnNext.style.display = state.wizardStep === 2 ? "none" : "inline-flex";
  els.btnLaunch.style.display = state.wizardStep === 2 ? "inline-flex" : "none";

  els.stepDots.innerHTML = wizardSteps
    .map((_, i) => `<span class="sc-dot ${i === state.wizardStep ? "active" : ""}"></span>`)
    .join("");
}

function validateStep(idx) {
  if (idx === 0) {
    const name = String(els.fName.value || "").trim();
    const tagline = String(els.fTagline.value || "").trim();
    if (!name) {
      toast("warning", "Missing project name", "Please enter a Project Name.");
      return false;
    }
    if (!tagline) {
      toast("warning", "Missing tagline", "Please add a one-line hook.");
      return false;
    }
    return true;
  }

  if (idx === 1) {
    const desc = String(els.fDescription.value || "").trim();
    if (desc.length < 40) {
      toast("warning", "Tell the story", "Please write a longer description (at least ~40 characters).");
      return false;
    }
    if (!isValidUrl(els.fImageUrl.value)) {
      toast("warning", "Bad image URL", "Preview image URL must be http(s), or leave it blank.");
      return false;
    }
    return true;
  }

  if (idx === 2) {
    if (!isValidUrl(els.fDemoUrl.value)) {
      toast("warning", "Bad demo URL", "Live demo URL must be http(s), or leave it blank.");
      return false;
    }
    if (!isValidUrl(els.fDemoVideoUrl.value)) {
      toast("warning", "Bad video URL", "Demo video URL must be http(s), or leave it blank.");
      return false;
    }
    if (!isValidUrl(els.fCodeUrl.value)) {
      toast("warning", "Bad code URL", "Code URL must be http(s), or leave it blank.");
      return false;
    }

    const hasCode = String(els.fCodeUrl.value || "").trim() || String(els.fCodeSnippet.value || "").trim();
    if (!hasCode) {
      toast("warning", "Add code", "Please include a Code URL or paste a Code Snippet.");
      return false;
    }

    return true;
  }

  return true;
}

function resetForm() {
  els.fName.value = "";
  els.fTagline.value = "";
  els.fTags.value = "";
  els.fDescription.value = "";
  els.fImageUrl.value = "";
  els.fDemoUrl.value = "";
  els.fDemoVideoUrl.value = "";
  els.fCodeUrl.value = "";
  els.fCodeSnippet.value = "";
  if (els.fDemoVideoFile) els.fDemoVideoFile.value = "";
  if (els.videoUploadStatus) {
    els.videoUploadStatus.textContent = "Tip: Upload uses Firebase Storage (if enabled). Keep it reasonably small.";
  }

  state.wizardStep = 0;
  renderWizard();
}

async function launchProject() {
  for (let i = 0; i < wizardSteps.length; i += 1) {
    if (!validateStep(i)) {
      state.wizardStep = i;
      renderWizard();
      return;
    }
  }

  const project = {
    id: `p-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: String(els.fName.value || "").trim(),
    tagline: String(els.fTagline.value || "").trim(),
    description: String(els.fDescription.value || "").trim(),
    demoUrl: String(els.fDemoUrl.value || "").trim(),
    demoVideoUrl: String(els.fDemoVideoUrl.value || "").trim(),
    demoVideoStoragePath: "",
    codeUrl: String(els.fCodeUrl.value || "").trim(),
    codeSnippet: String(els.fCodeSnippet.value || "").trim(),
    imageUrl: String(els.fImageUrl.value || "").trim(),
    tags: parseTags(els.fTags.value),
    makerName: state.user.name,
    makerEmail: state.user.email,
    makerId: state.user.email || state.user.id,
    createdAt: new Date().toISOString(),
    upvotes: 0,
    commentsCount: 0,
  };

  const file = els.fDemoVideoFile?.files?.[0] || null;
  if (file) {
    const maxBytes = 80 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast("warning", "Video too large", "Please upload a smaller demo video (≤ ~80MB) or use a video URL.");
      return;
    }

    if (els.videoUploadStatus) els.videoUploadStatus.textContent = "Uploading demo video…";
    try {
      const uploaded = await uploadShowcaseDemoVideo({ file, projectId: project.id, makerId: project.makerId });
      project.demoVideoUrl = uploaded.downloadUrl;
      project.demoVideoStoragePath = uploaded.storagePath;
      if (els.videoUploadStatus) els.videoUploadStatus.textContent = "Upload complete.";
    } catch (e) {
      console.error(e);
      if (els.videoUploadStatus) {
        els.videoUploadStatus.textContent = "Upload failed (Storage rules may block it). You can still launch with a video URL.";
      }
      toast("warning", "Video upload failed", "Your Firebase Storage rules may block uploads. Provide a Demo Video URL instead.");
    }
  }

  const saved = await addShowcaseProject(project);

  // Instant top-of-feed UX
  state.projects = [saved, ...state.projects.filter((p) => p.id !== saved.id)];
  state.sortMode = "newest";
  els.sortNewest.checked = true;
  state.query = "";
  els.searchInput.value = "";
  state.selectedTag = null;

  toast("success", "Launched", "Your project is now live on the feed.");
  resetForm();
  showMode("home");
  renderHome();
}

function wireEvents() {
  els.browseBtn.addEventListener("click", () => {
    showMode("home");
    renderHome();
  });

  if (els.deleteBtn) {
    els.deleteBtn.addEventListener("click", async () => {
      if (!window.appUI || typeof window.appUI.select !== "function" || typeof window.appUI.confirm !== "function") {
        toast("error", "Unavailable", "The in-app dialog system is not loaded. Please refresh the page.");
        return;
      }

      const projects = Array.isArray(state.projects) ? [...state.projects] : [];
      if (!projects.length) {
        toast("info", "Nothing to delete", "No projects found.");
        return;
      }

      const admin = isAdminUser();
      const deletable = admin ? projects : projects.filter((p) => canDeleteProject(p));
      if (!deletable.length) {
        toast("info", "No permission", "You can only delete projects you uploaded.");
        return;
      }

      deletable.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const selectedId = await window.appUI.select({
        title: "Delete Project",
        message: admin
          ? "Select a project to permanently delete (admin can delete any project). This also deletes comments and suggestions."
          : "Select one of your uploaded projects to permanently delete (this also deletes its comments and suggestions).",
        placeholder: "Select a project",
        okText: "Continue",
        cancelText: "Cancel",
        type: "warning",
        options: deletable.map((p) => ({
          value: p.id,
          label: `${String(p.name || "Untitled").trim() || "Untitled"} — ${String(p.makerName || "").trim() || "Anonymous"} (${formatDateOnly(p.createdAt)})`,
        })),
      });

      if (!selectedId) return;
      const project = state.projects.find((p) => p.id === selectedId);
      const projectName = String(project?.name || "this project").trim() || "this project";

      if (!project || !canDeleteProject(project)) {
        toast("error", "Not allowed", "You can only delete projects you uploaded.");
        return;
      }

      const ok = await window.appUI.confirm({
        title: "Confirm delete",
        message: `Delete "${projectName}"? This cannot be undone.`,
        okText: "Delete",
        cancelText: "Cancel",
        type: "error",
      });

      if (!ok) return;

      try {
        await deleteShowcaseProject(selectedId);
        state.projects = state.projects.filter((p) => p.id !== selectedId);

        if (state.activeProjectId === selectedId) {
          state.activeProjectId = null;
          showMode("home");
        }

        renderHome();
        toast("success", "Deleted", `Deleted "${projectName}".`);
      } catch (e) {
        console.error(e);
        toast("error", "Delete failed", "Could not delete the project right now.");
      }
    });
  }

  els.submitBtn.addEventListener("click", () => {
    showMode("submit");
    renderWizard();
  });
  els.refreshBtn.addEventListener("click", async () => {
    try {
      state.projects = await getShowcaseProjects();
      renderHome();
      toast("success", "Refreshed", "Fetched the latest projects.");
    } catch {
      toast("error", "Refresh failed", "Could not refresh right now.");
    }
  });

  els.searchInput.addEventListener("input", () => {
    state.query = String(els.searchInput.value || "");
    renderHome();
  });

  els.sortTrending.addEventListener("change", () => {
    if (els.sortTrending.checked) {
      state.sortMode = "trending";
      renderHome();
    }
  });
  els.sortNewest.addEventListener("change", () => {
    if (els.sortNewest.checked) {
      state.sortMode = "newest";
      renderHome();
    }
  });

  els.btnPrev.addEventListener("click", () => {
    state.wizardStep = Math.max(0, state.wizardStep - 1);
    renderWizard();
  });
  els.btnNext.addEventListener("click", () => {
    if (!validateStep(state.wizardStep)) return;
    state.wizardStep = Math.min(2, state.wizardStep + 1);
    renderWizard();
  });
  els.btnLaunch.addEventListener("click", () => {
    void launchProject();
  });

  els.backBtn.addEventListener("click", () => {
    showMode("home");
    renderHome();
  });

  els.upvoteBtn.addEventListener("click", async () => {
    const projectId = state.activeProjectId;
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;

    const key = upvoteKey(projectId);
    const already = localStorage.getItem(key) === "1";

    // Toggle vote
    const current = Number(project.upvotes) || 0;
    const next = already ? Math.max(0, current - 1) : current + 1;
    project.upvotes = next;
    els.upvoteCount.textContent = String(next);
    els.upvoteBtn.textContent = already ? "Upvote" : "Upvoted";

    if (already) localStorage.removeItem(key);
    else localStorage.setItem(key, "1");

    try {
      await updateShowcaseProject(projectId, { upvotes: next });
    } catch {
      // ignore
    }
  });

  if (els.suggestBtn) {
    els.suggestBtn.addEventListener("click", async () => {
      const projectId = state.activeProjectId;
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return;

      if (!window.appUI || typeof window.appUI.prompt !== "function") {
        toast("error", "Unavailable", "The in-app dialog system is not loaded. Please refresh the page.");
        return;
      }

      const toName = await window.appUI.prompt({
        title: "Share / Suggest",
        message: "Enter the employee name to suggest this project to:",
        placeholder: "Employee name",
        okText: "Send",
        cancelText: "Cancel",
        type: "info",
      });

      const trimmed = String(toName || "").trim();
      if (!trimmed) return;

      try {
        await addShowcaseSuggestion({
          id: `s-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          projectId,
          projectName: project.name || "",
          toName: trimmed,
          toNameLower: trimmed.toLowerCase(),
          fromName: state.user.name,
          fromEmail: state.user.email,
          fromId: state.user.id,
          createdAt: new Date().toISOString(),
        });

        // bump suggestions count (denormalized on project)
        project.suggestionsCount = (Number(project.suggestionsCount) || 0) + 1;
        if (els.suggestCount) els.suggestCount.textContent = String(project.suggestionsCount);
        try {
          await updateShowcaseProject(projectId, { suggestionsCount: project.suggestionsCount });
        } catch {
          // ignore
        }

        toast("success", "Shared", `Suggested to ${trimmed}.`);
        if (state.mode === "home") renderHome();
      } catch (e) {
        console.error(e);
        toast("error", "Share failed", "Could not send suggestion right now.");
      }
    });
  }

  els.copyCodeBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(String(els.codeBlock.textContent || ""));
      toast("success", "Copied", "Code snippet copied to clipboard.");
    } catch {
      toast("error", "Copy failed", "Your browser blocked clipboard access.");
    }
  });

  els.commentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = String(els.commentBody.value || "").trim();
    if (!body) return;
    await postComment(body, null);
    els.commentBody.value = "";
  });

  // Google Chat style: Enter sends, Shift+Enter newline
  els.commentBody.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const body = String(els.commentBody.value || "").trim();
      if (!body) return;
      await postComment(body, null);
      els.commentBody.value = "";
    }
  });
}

async function initOnce() {
  if (state.initialized) return;
  state.initialized = true;

  wireEvents();
  renderWizard();

  try {
    state.projects = await getShowcaseProjects();
  } catch {
    state.projects = [];
  }

  // Realtime updates for cross-user visibility (best-effort)
  try {
    const unsub = listenToShowcaseProjects((projects) => {
      const byId = new Map(state.projects.map((p) => [p.id, p]));
      state.projects = projects.map((p) => ({ ...(byId.get(p.id) || {}), ...p }));

      if (state.mode === "home") renderHome();
      if (state.mode === "project") {
        const active = state.projects.find((x) => x.id === state.activeProjectId);
        if (active) els.upvoteCount.textContent = String(Number(active.upvotes) || 0);
      }
    });
    if (typeof unsub === "function") state.unsubProjects = unsub;
  } catch {
    // ignore
  }

  renderHome();

  // Suggestions addressed to current user (best-effort toast)
  try {
    const userName = String(localStorage.getItem("userName") || state.user.name || "").trim();
    const toKey = userName.toLowerCase();
    if (toKey) {
      const seenKey = `showcaseSuggestionsSeenAt:${toKey}`;
      const seenAt = Number(localStorage.getItem(seenKey) || 0);

      listenToShowcaseSuggestionsForUser(toKey, (suggestions) => {
        let newest = seenAt;
        for (const s of suggestions || []) {
          const ts = Date.parse(s.createdAt || "") || 0;
          if (ts > newest) {
            newest = ts;
            toast("info", "New suggestion", `${s.fromName || "Someone"} suggested: ${s.projectName || "a project"}`);
          }
        }
        if (newest > seenAt) localStorage.setItem(seenKey, String(newest));
      });
    }
  } catch {
    // ignore
  }
}

function onOpen() {
  // Ensure module state is ready when tab opened
  void initOnce();
}

// expose to dashboard switchTab
window.showcaseForum = { onOpen };

// If user hard-refreshes while already on this tab, auto-init
if (els.rootSection && els.rootSection.style.display !== "none") {
  void initOnce();
}
