
import "./style.css";

const app = document.querySelector("#app");

window.addEventListener("error", function (event) {
  if (!app) return;
  app.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#f6f8fb;font-family:system-ui,sans-serif;padding:24px"><div style="max-width:620px;width:100%;background:#fff;border:1px solid #e5e9ef;border-radius:18px;padding:28px;box-shadow:0 15px 40px rgba(20,32,45,.08)"><strong style="color:#df3e48">The meeting UI hit a browser error.</strong><p style="color:#718096;line-height:1.5">Refresh the page and try again. Error: ' + String(event.message || "Unknown error").replace(/[<>&]/g, "") + '</p></div></div>';
});

window.addEventListener("unhandledrejection", function (event) {
  if (!app) return;
  app.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#f6f8fb;font-family:system-ui,sans-serif;padding:24px"><div style="max-width:620px;width:100%;background:#fff;border:1px solid #e5e9ef;border-radius:18px;padding:28px;box-shadow:0 15px 40px rgba(20,32,45,.08)"><strong style="color:#df3e48">The meeting UI had an unexpected error.</strong><p style="color:#718096;line-height:1.5">Refresh the page and try again.</p></div></div>';
});

const state = {
  page: "home",
  meetingId: "846 221 904",
  micOn: true,
  cameraOn: true,
  shareOn: false,
  participantsOpen: true,
  chatOpen: false,
  displayName: "Me",
  fakePeople: [
    { id: "alex", name: "Alex Morgan", role: "Host", initials: "AM", hue: 200, videos: [], currentVideoIndex: 0, cameraVisible: true },
    { id: "jamie", name: "Jamie Lee", role: "", initials: "JL", hue: 280, videos: [], currentVideoIndex: 0, cameraVisible: true },
    { id: "sam", name: "Sam Rivera", role: "", initials: "SR", hue: 35, videos: [], currentVideoIndex: 0, cameraVisible: true }
  ],
  myVideos: [],
  myVideoIndex: 0,
  cameraHidden: {},
  keybinds: {},
  nextKeybinds: {},
  audioEnabled: false
};

const icons = {
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/><path d="M8 22h8"/>',
  micOff: '<path d="m3 3 18 18"/><path d="M9 5.1V12a3 3 0 0 0 5.2 2.1"/><path d="M19 10v2a7 7 0 0 1-11.5 5.4"/><path d="M12 19v3"/><path d="M8 22h8"/>',
  video: '<path d="M15 10l4.5-2.7A1 1 0 0 1 21 8.2v7.6a1 1 0 0 1-1.5.9L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/>',
  videoOff: '<path d="m3 3 18 18"/><path d="M10.3 6H15a2 2 0 0 1 2 2v1.3l3.5-2.1A1 1 0 0 1 22 8.1v7.8"/><path d="M6.2 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.5 9.5 0 0 1-4.2-1l-4.8 1 1-4.6a8.2 8.2 0 0 1-1-4c0-4.7 4-8.4 9-8.4s9 3.8 9 8.5Z"/>',
  share: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .3 2l.1.1-1.9 1.9-.1-.1a1.8 1.8 0 0 0-2-.3 1.8 1.8 0 0 0-1.1 1.7V20h-2.7v-.2a1.8 1.8 0 0 0-1.1-1.7 1.8 1.8 0 0 0-2 .3l-.1.1-1.9-1.9.1-.1a1.8 1.8 0 0 0 .3-2 1.8 1.8 0 0 0-1.7-1.1H5.5v-2.7h.2a1.8 1.8 0 0 0 1.7-1.1 1.8 1.8 0 0 0-.3-2L7 7.4l1.9-1.9.1.1a1.8 1.8 0 0 0 2 .3A1.8 1.8 0 0 0 12 4.2V4h2.7v.2a1.8 1.8 0 0 0 1.1 1.7 1.8 1.8 0 0 0 2-.3l.1-.1 1.9 1.9-.1.1a1.8 1.8 0 0 0-.3 2 1.8 1.8 0 0 0 1.7 1.1h.2v2.7h-.2a1.8 1.8 0 0 0-1.7 1.1Z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.5-3 19.3 19.3 0 0 1-5.9-5.9 19.6 19.6 0 0 1-3-8.6A2 2 0 0 1 4.4 2.2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.4 10a16 16 0 0 0 5.8 5.8l1.1-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2.1Z"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>'
};

function icon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + "</svg>";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initialsFor(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(function(x) { return x[0].toUpperCase(); })
    .join("") || "GU";
}

function revokeBlob(url) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function getVideos(person) {
  if (!person) return [];
  if (person.id === "me") return state.myVideos || [];
  if (Array.isArray(person.videos)) return person.videos;
  if (person.videoUrl) return [{ url: person.videoUrl, name: "Video" }];
  return [];
}

function getCurrentVideoUrl(person) {
  const videos = getVideos(person);
  if (!videos.length) return null;
  const rawIndex = person.id === "me" ? state.myVideoIndex : (person.currentVideoIndex || 0);
  const index = Math.max(0, Math.min(rawIndex, videos.length - 1));
  return videos[index]?.url || null;
}

function isCameraVisible(person) {
  if (!person) return false;
  if (person.id === "me") return !state.cameraHidden.me && state.cameraOn;
  return person.cameraVisible !== false;
}

function getParticipant(personId) {
  if (personId === "me") {
    return {
      id: "me",
      name: state.displayName,
      initials: initialsFor(state.displayName),
      hue: 145,
      videos: state.myVideos || [],
      currentVideoIndex: state.myVideoIndex,
      cameraVisible: !state.cameraHidden.me
    };
  }
  return state.fakePeople.find(function(p) { return p.id === personId; }) || null;
}

function togglePersonCamera(personId) {
  if (personId === "me") {
    state.cameraHidden.me = !state.cameraHidden.me;
    state.cameraOn = !state.cameraHidden.me;
    return;
  }
  const person = getParticipant(personId);
  if (!person) return;
  person.cameraVisible = person.cameraVisible === false;
}

function advancePersonVideo(personId) {
  if (personId === "me") {
    if (!state.myVideos || state.myVideos.length < 2) return;
    state.myVideoIndex = (state.myVideoIndex + 1) % state.myVideos.length;
    state.cameraHidden.me = false;
    state.cameraOn = true;
    return;
  }
  const person = getParticipant(personId);
  if (!person || !Array.isArray(person.videos) || person.videos.length < 2) return;
  person.currentVideoIndex = ((person.currentVideoIndex || 0) + 1) % person.videos.length;
  person.cameraVisible = true;
}

function setPersonKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.keybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized)) return;
  Object.keys(state.keybinds).forEach(function(id) {
    if (id !== personId && state.keybinds[id] === normalized) delete state.keybinds[id];
  });
  state.keybinds[personId] = normalized;
}

function setNextKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.nextKeybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized)) return;
  Object.keys(state.nextKeybinds).forEach(function(id) {
    if (id !== personId && state.nextKeybinds[id] === normalized) delete state.nextKeybinds[id];
  });
  state.nextKeybinds[personId] = normalized;
}

function revokeVideos(videos) {
  (videos || []).forEach(function(item) {
    if (item && item.url && item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
  });
}

function addVideoFiles(target, files) {
  const selected = Array.from(files || []).filter(function(file) {
    return file instanceof File && file.size;
  });
  const additions = selected.map(function(file) {
    return { url: URL.createObjectURL(file), name: file.name };
  });
  if (target.id === "me") {
    state.myVideos = (state.myVideos || []).concat(additions);
  } else {
    target.videos = (Array.isArray(target.videos) ? target.videos : []).concat(additions);
  }
}

function captureVideoState() {
  const snapshot = {};
  document.querySelectorAll("video.participant-video[data-person-id]").forEach(function(video) {
    const personId = video.dataset.personId;
    snapshot[personId] = {
      src: video.currentSrc || video.src,
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      wasPaused: video.paused
    };
  });
  return snapshot;
}

function restoreVideoState(snapshot) {
  document.querySelectorAll("video.participant-video[data-person-id]").forEach(function(video) {
    const saved = snapshot[video.dataset.personId];
    if (!saved) return;

    const restore = function() {
      if ((video.currentSrc || video.src) !== saved.src) return;
      try {
        if (Number.isFinite(saved.currentTime) && saved.currentTime > 0) {
          video.currentTime = Math.min(saved.currentTime, Math.max(0, (video.duration || saved.currentTime) - 0.05));
        }
      } catch (error) {}

      if (!saved.wasPaused) {
        video.play().catch(function(){});
      }
    };

    if (video.readyState >= 1) restore();
    else video.addEventListener("loadedmetadata", restore, { once: true });
  });
}

function render() {
  const videoState = state.page === "meeting" ? captureVideoState() : {};
  if (state.page === "meeting") app.innerHTML = renderMeeting();
  else if (state.page === "settings") app.innerHTML = renderSettings();
  else app.innerHTML = renderHome();
  bind();
  if (state.page === "meeting") restoreVideoState(videoState);
}

function shell(content, active) {
  return '<div class="app-shell">' +
    '<aside class="sidebar">' +
      '<div class="brand"><span class="brand-mark">Z</span><span>Zoom Copy</span></div>' +
      '<nav class="nav">' +
        '<button class="nav-item ' + (active === "home" ? "active" : "") + '" data-page="home">' + icon("home") + '<span>Home</span></button>' +
        '<button class="nav-item ' + (active === "meeting" ? "active" : "") + '" data-page="meeting">' + icon("users") + '<span>Meetings</span></button>' +
        '<button class="nav-item" data-action="contacts">' + icon("users") + '<span>Contacts</span></button>' +
        '<button class="nav-item ' + (active === "settings" ? "active" : "") + '" data-page="settings">' + icon("settings") + '<span>Settings</span></button>' +
      '</nav>' +
      '<div class="sidebar-bottom"><div class="profile-chip"><div class="avatar small">MC</div><div><strong>My account</strong><span>Available</span></div><span class="chevron">⌄</span></div></div>' +
    '</aside><main class="page">' + content + '</main></div>';
}

function renderHome() {
  const content =
    '<header class="topbar"><div><span class="eyebrow">Meet smarter</span><h1>Good evening</h1></div><button class="icon-button" title="Settings" data-page="settings">' + icon("settings") + '</button></header>' +
    '<section class="hero-grid">' +
      '<article class="hero-card"><div class="hero-copy"><span class="pill">Your meeting space</span><h2>Meet, present, and test fake cameras in one place.</h2><p>Build a meeting with realistic participant tiles, local video files, and familiar call controls.</p><div class="hero-actions"><button class="primary" data-page="meeting">Start a meeting</button><button class="secondary" data-page="meeting">Join a meeting</button></div></div>' +
        '<div class="hero-visual"><div class="mini-window"><div class="mini-top"><span></span><span></span><span></span><b>Team standup</b><small>12:41</small></div><div class="mini-grid"><div class="mini-tile tile-a"><span>AM</span></div><div class="mini-tile tile-b"><span>JL</span></div><div class="mini-tile tile-c"><span>SR</span></div><div class="mini-tile tile-d"><span>MC</span></div></div></div></div>' +
      '</article>' +
      '<div class="quick-column"><button class="quick-card" data-page="meeting"><div class="quick-icon blue">' + icon("video") + '</div><div><strong>New meeting</strong><span>Start instantly</span></div><b>›</b></button><button class="quick-card" data-page="meeting"><div class="quick-icon green">' + icon("users") + '</div><div><strong>Fake participants</strong><span>Add people to your call</span></div><b>›</b></button><div class="tip-card"><span class="tip-label">SIMULATED CAMERA</span><strong>Upload a video file and use it as a meeting camera tile.</strong><p>Your file stays local to this browser session.</p></div></div>' +
    '</section>' +
    '<section class="section"><div class="section-heading"><div><span class="eyebrow">Recent</span><h3>Meetings</h3></div><button class="text-button" data-page="meeting">View all</button></div><div class="meeting-list">' +
      '<div class="meeting-row"><div class="meeting-icon">' + icon("video") + '</div><div><strong>Product sync</strong><span>Today · 14 participants</span></div><span class="meeting-id">846 221 904</span><button class="join-small" data-page="meeting">Join</button></div>' +
      '<div class="meeting-row"><div class="meeting-icon">' + icon("chat") + '</div><div><strong>Design review</strong><span>Yesterday · 6 participants</span></div><span class="meeting-id">532 118 227</span><button class="join-small" data-page="meeting">Join</button></div>' +
    '</div></section>';
  return shell(content, "home");
}

function renderSettings() {
  const content =
    '<header class="topbar"><div><span class="eyebrow">Preferences</span><h1>Settings</h1></div></header>' +
    '<section class="settings-layout"><div class="settings-nav"><button class="settings-nav-item active">General</button><button class="settings-nav-item">Video</button><button class="settings-nav-item">Audio</button><button class="settings-nav-item">Meeting</button></div>' +
    '<div class="settings-panel"><h2>General</h2><p class="muted">Tune the demo meeting experience.</p>' +
    '<label class="setting-row"><span><strong>Open meetings in the demo room</strong><small>Skip the home screen when starting a meeting.</small></span><input type="checkbox" checked></label>' +
    '<label class="setting-row"><span><strong>Remember fake participants</strong><small>Keep custom people for this browser tab.</small></span><input type="checkbox" checked></label>' +
    '<div class="setting-note"><strong>Simulated camera</strong><p>Video files are rendered as local meeting feeds. They are not installed as an operating-system webcam device.</p></div></div></section>';
  return shell(content, "settings");
}

function participantTile(person) {
  const videoUrl = getCurrentVideoUrl(person);
  const videoCount = getVideos(person).length;
  const showVideo = Boolean(videoUrl && isCameraVisible(person));
  const keybind = state.keybinds[person.id];
  const nextKey = state.nextKeybinds[person.id];
  const media = showVideo
    ? '<video class="participant-video" data-person-id="' + person.id + '" data-video-url="' + escapeHtml(videoUrl) + '" src="' + videoUrl + '" autoplay playsinline' +
      (videoCount === 1 ? " loop" : "") +
      (state.audioEnabled ? "" : " muted") + '></video>'
    : '<div class="participant-avatar" style="--hue:' + person.hue + '"><span>' + escapeHtml(person.initials) + '</span></div>';
  const keyBadge = keybind ? '<span class="keybind-badge">Cam ' + escapeHtml(keybind.toUpperCase()) + '</span>' : "";
  const nextBadge = nextKey ? '<span class="next-key-badge">Next ' + escapeHtml(nextKey.toUpperCase()) + '</span>' : "";
  const hiddenBadge = !isCameraVisible(person) && getVideos(person).length ? '<span class="camera-hidden-badge">CAM OFF</span>' : "";
  return '<article class="participant-tile">' + media + '<div class="tile-scrim"></div>' + hiddenBadge +
    '<div class="participant-label"><span class="status-dot"></span><span>' + escapeHtml(person.name) + '</span>' +
    (person.role ? '<em>' + escapeHtml(person.role) + '</em>' : "") + '</div>' + keyBadge + nextBadge +
    '<button class="tile-menu" data-action="edit-person" data-person-id="' + person.id + '" title="Edit participant">' + icon("more") + '</button></article>';
}

function renderMeeting() {
  const allPeople = [
    {
      id: "me",
      name: state.displayName,
      role: "You",
      initials: initialsFor(state.displayName),
      hue: 145,
      videos: state.myVideos || [],
      currentVideoIndex: state.myVideoIndex,
      cameraVisible: !state.cameraHidden.me
    }
  ].concat(state.fakePeople);

  const tiles = allPeople.map(participantTile).join("");

  return '<div class="meeting-page">' +
    '<header class="meeting-topbar">' +
      '<div class="meeting-title"><span class="live-dot"></span><div><strong>Product sync</strong><span>Meeting ID: ' + state.meetingId + '</span></div></div>' +
      '<div class="meeting-top-actions">' +
        '<button class="top-action" data-action="toggle-audio">' + (state.audioEnabled ? "Video audio on" : "Enable video audio") + '</button>' +
        '<button class="top-action">Security</button>' +
        '<button class="top-action">View</button>' +
        '<button class="icon-button dark">' + icon("more") + '</button>' +
      '</div>' +
    '</header>' +
    '<main class="meeting-main">' +
      '<section class="meeting-stage">' +
        '<div class="meeting-grid ' + (allPeople.length > 4 ? "dense" : "") + '">' + tiles + '</div>' +
      '</section>' +
      (state.participantsOpen ? renderParticipants() : "") +
      (state.chatOpen ? renderChat() : "") +
    '</main>' +
    '<footer class="meeting-controls">' +
      '<div class="controls-group">' +
        '<button class="control-btn ' + (state.micOn ? "" : "off") + '" data-action="toggle-mic">' + icon(state.micOn ? "mic" : "micOff") + '<span>' + (state.micOn ? "Mute" : "Unmute") + '</span></button>' +
        '<button class="control-caret">⌄</button>' +
        '<button class="control-btn ' + (state.cameraOn ? "" : "off") + '" data-action="toggle-camera">' + icon(state.cameraOn ? "video" : "videoOff") + '<span>' + (state.cameraOn ? "Stop Video" : "Start Video") + '</span></button>' +
        '<button class="control-caret">⌄</button>' +
        '<button class="control-btn" data-action="add-video">' + icon("video") + '<span>Fake Camera</span></button>' +
      '</div>' +
      '<div class="controls-center">' +
        '<button class="control-btn ' + (state.participantsOpen ? "selected" : "") + '" data-action="toggle-participants">' + icon("users") + '<span>Participants <b>' + allPeople.length + '</b></span></button>' +
        '<button class="control-btn ' + (state.chatOpen ? "selected" : "") + '" data-action="toggle-chat">' + icon("chat") + '<span>Chat</span></button>' +
        '<button class="control-btn ' + (state.shareOn ? "selected share" : "") + '" data-action="toggle-share">' + icon("share") + '<span>' + (state.shareOn ? "Stop Share" : "Share Screen") + '</span></button>' +
        '<button class="control-btn"><span class="more-dots">•••</span><span>More</span></button>' +
      '</div>' +
      '<button class="end-call" data-page="home">' + icon("phone") + '<span>End</span></button>' +
    '</footer>' +
  '</div>';
}

function renderParticipants() {
  const safeDisplayName = escapeHtml(state.displayName);
  const myVideos = state.myVideos || [];
  return '<aside class="side-panel participants-panel"><div class="panel-header"><div><strong>Participants</strong><span>' + (state.fakePeople.length + 1) + ' in meeting</span></div><button class="panel-close" data-action="toggle-participants">×</button></div>' +
    '<div class="my-participant-card"><div class="avatar">MC</div><div><strong>' + safeDisplayName + '</strong><span>Host · You · ' + myVideos.length + ' video' + (myVideos.length === 1 ? "" : "s") + '</span></div><button class="edit-mini" data-action="edit-person" data-person-id="me">Edit</button></div>' +
    '<button class="add-person" data-action="add-person"><span>+</span><strong>Add fake person</strong><small>Custom name + multiple videos</small></button><div class="participant-list">' +
    state.fakePeople.map(function(p){
      const videos = getVideos(p);
      const cameraText = videos.length ? (p.cameraVisible === false ? " · Camera hidden" : " · " + videos.length + " video" + (videos.length === 1 ? "" : "s")) : " · No camera";
      const keyText = state.keybinds[p.id] ? " · Cam " + state.keybinds[p.id].toUpperCase() : "";
      const nextText = state.nextKeybinds[p.id] ? " · Next " + state.nextKeybinds[p.id].toUpperCase() : "";
      return '<div class="participant-list-row"><div class="avatar" style="--hue:' + p.hue + '">' + escapeHtml(p.initials) + '</div><div><strong>' + escapeHtml(p.name) + '</strong><span>' + (p.role || "Participant") + cameraText + keyText + nextText + '</span></div><div class="participant-row-actions"><div class="row-icons">' + icon("mic") + icon(videos.length && p.cameraVisible !== false ? "video" : "videoOff") + '</div><button class="edit-mini" data-action="edit-person" data-person-id="' + p.id + '">Edit</button></div></div>';
    }).join("") +
    '</div></aside>';
}

function renderChat() {
  return '<aside class="side-panel chat-panel"><div class="panel-header"><div><strong>Meeting Chat</strong><span>Everyone</span></div><button class="panel-close" data-action="toggle-chat">×</button></div><div class="chat-messages">' +
    '<div class="chat-msg"><strong>Jamie Lee</strong><p>Ready when you are.</p></div><div class="chat-msg"><strong>Sam Rivera</strong><p>I added the notes to the agenda.</p></div></div><div class="chat-input"><input placeholder="Type a message..."><button>Send</button></div></aside>';
}

function openAddPerson() {
  openParticipantEditor(null);
}

function openParticipantEditor(personId) {
  const isNew = personId === null;
  const isMe = personId === "me";
  const existing = !isNew && getParticipant(personId);
  const person = isNew
    ? { id: null, name: "", initials: "GU", hue: Math.floor(Math.random() * 360), videos: [], currentVideoIndex: 0, cameraVisible: true }
    : existing;
  if (!person) return;

  const videos = getVideos(person);
  const currentKey = isNew ? "" : (state.keybinds[personId] || "");
  const currentNextKey = isNew ? "" : (state.nextKeybinds[personId] || "");
  const currentIndex = person.id === "me" ? state.myVideoIndex : (person.currentVideoIndex || 0);

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML =
    '<form class="modal">' +
      '<button type="button" class="modal-close" data-close>×</button>' +
      '<span class="eyebrow">' + (isNew ? "Participants" : (isMe ? "Your participant" : "Fake participant")) + '</span>' +
      '<h2>' + (isNew ? "Add a fake person" : (isMe ? "Edit your meeting identity" : "Edit fake person")) + '</h2>' +
      '<p class="muted">' + (isNew ? "Add multiple video clips and two keyboard shortcuts." : "Change the name, video playlist, or keyboard shortcuts.") + '</p>' +
      '<label class="field-label">Display name<input name="name" required maxlength="28" value="' + escapeHtml(person.name) + '" placeholder="Taylor Kim" autofocus></label>' +
      '<label class="field-label">Add video files<input name="video" type="file" accept="video/mp4,video/webm,video/quicktime,video/*" multiple></label>' +
      '<div class="file-help">' + (videos.length ? videos.length + " video" + (videos.length === 1 ? "" : "s") + " currently assigned. New files are added." : "Select multiple MP4 or phone videos at once.") + '</div>' +
      (videos.length ? '<div class="video-playlist">' + videos.map(function(v, i) { return '<div class="video-playlist-row"><span>' + (i + 1) + '</span><strong>' + escapeHtml(v.name || ("Video " + (i + 1))) + '</strong>' + (i === currentIndex ? '<em>Now playing</em>' : '') + '</div>'; }).join("") + '</div>' : '') +
      '<label class="field-label">Camera keybind<input name="keybind" class="keybind-input" value="' + escapeHtml(currentKey.toUpperCase()) + '" placeholder="Press a key" maxlength="1" autocomplete="off"></label>' +
      '<div class="file-help">Show or hide this person’s camera.</div>' +
      '<label class="field-label">Next video keybind<input name="nextKeybind" class="keybind-input" value="' + escapeHtml(currentNextKey.toUpperCase()) + '" placeholder="Press a key" maxlength="1" autocomplete="off"></label>' +
      '<div class="file-help">Switch to the next video. The playlist wraps back to the first clip.</div>' +
      '<div class="editor-actions-row"><label class="check-row"><input name="clearVideos" type="checkbox"><span>Remove all videos</span></label>' +
      (!isNew && videos.length > 1 ? '<button type="button" class="secondary" data-next-video>Play next now</button>' : '') +
      '</div>' +
      '<div class="modal-actions">' +
        ((!isNew && !isMe) ? '<button type="button" class="danger-secondary" data-remove>Remove person</button>' : '') +
        (!isNew && videos.length ? '<button type="button" class="danger-secondary" data-clear-video>Clear videos</button>' : '') +
        '<span class="modal-spacer"></span><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">' + (isNew ? "Add person" : "Save changes") + '</button>' +
      '</div>' +
    '</form>';

  document.body.appendChild(modal);
  const form = modal.querySelector("form");

  modal.querySelectorAll("[data-close]").forEach(function(b) { b.addEventListener("click", function() { modal.remove(); }); });
  modal.addEventListener("click", function(e) { if (e.target === modal) modal.remove(); });

  const nextButton = modal.querySelector("[data-next-video]");
  if (nextButton) {
    nextButton.addEventListener("click", function() {
      advancePersonVideo(personId);
      modal.remove();
      render();
    });
  }

  const clearButton = modal.querySelector("[data-clear-video]");
  if (clearButton) {
    clearButton.addEventListener("click", function() {
      revokeVideos(getVideos(person));
      if (isMe) {
        state.myVideos = [];
        state.myVideoIndex = 0;
        state.cameraOn = false;
        state.cameraHidden.me = true;
      } else {
        person.videos = [];
        person.currentVideoIndex = 0;
      }
      modal.remove();
      render();
    });
  }

  const removeButton = modal.querySelector("[data-remove]");
  if (removeButton) {
    removeButton.addEventListener("click", function() {
      const index = state.fakePeople.findIndex(function(p) { return p.id === personId; });
      if (index >= 0) {
        revokeVideos(state.fakePeople[index].videos);
        state.fakePeople.splice(index, 1);
      }
      delete state.keybinds[personId];
      delete state.nextKeybinds[personId];
      modal.remove();
      render();
    });
  }

  modal.querySelectorAll('[name="keybind"], [name="nextKeybind"]').forEach(function(input) {
    input.addEventListener("keydown", function(e) {
      if (["Tab", "Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "Escape") {
        input.value = "";
        return;
      }
      if (/^[a-z0-9]$/i.test(e.key)) input.value = e.key.toUpperCase();
    });
    input.addEventListener("focus", function() { input.select(); });
  });

  form.addEventListener("submit", function(e) {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim() || "Guest";
    const files = fd.getAll("video");
    const clearVideos = form.querySelector('[name="clearVideos"]').checked;
    const key = String(fd.get("keybind") || "").trim();
    const nextKey = String(fd.get("nextKeybind") || "").trim();

    if (isNew) {
      const newPerson = {
        id: crypto.randomUUID(),
        name: name,
        role: "",
        initials: initialsFor(name),
        hue: Math.floor(Math.random() * 360),
        videos: [],
        currentVideoIndex: 0,
        cameraVisible: true
      };
      addVideoFiles(newPerson, files);
      state.fakePeople.push(newPerson);
      setPersonKeybind(newPerson.id, key);
      setNextKeybind(newPerson.id, nextKey);
    } else if (isMe) {
      state.displayName = name;
      if (clearVideos) {
        revokeVideos(state.myVideos);
        state.myVideos = [];
        state.myVideoIndex = 0;
        state.cameraOn = false;
        state.cameraHidden.me = true;
      } else {
        addVideoFiles({ id: "me" }, files);
        if (state.myVideos.length) {
          state.cameraOn = true;
          state.cameraHidden.me = false;
        }
      }
      setPersonKeybind("me", key);
      setNextKeybind("me", nextKey);
    } else {
      const target = state.fakePeople.find(function(p) { return p.id === personId; });
      if (!target) return;
      target.name = name;
      target.initials = initialsFor(name);
      if (clearVideos) {
        revokeVideos(target.videos);
        target.videos = [];
        target.currentVideoIndex = 0;
      } else {
        addVideoFiles(target, files);
      }
      if (target.videos.length) target.cameraVisible = true;
      setPersonKeybind(personId, key);
      setNextKeybind(personId, nextKey);
    }

    modal.remove();
    render();
  });

  const nameInput = form.querySelector('[name="name"]');
  nameInput.focus();
  nameInput.select();
}

function openFakeCameraPicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/mp4,video/webm,video/quicktime,video/*";
  input.multiple = true;
  input.onchange = function() {
    const files = input.files && Array.from(input.files);
    if (!files || !files.length) return;
    addVideoFiles({ id: "me" }, files);
    state.myVideoIndex = state.myVideos.length ? state.myVideoIndex % state.myVideos.length : 0;
    state.cameraOn = true;
    state.cameraHidden.me = false;
    render();
  };
  input.click();
}

function bind() {
  document.querySelectorAll("[data-page]").forEach(function(el){
    el.addEventListener("click", function(){ state.page = el.dataset.page; render(); });
  });
  document.querySelectorAll("[data-action]").forEach(function(el){
    el.addEventListener("click", function(){
      const a = el.dataset.action;
      if (a === "toggle-mic") state.micOn = !state.micOn;
      if (a === "toggle-camera") state.cameraOn = !state.cameraOn;
      if (a === "toggle-participants") state.participantsOpen = !state.participantsOpen;
      if (a === "toggle-chat") state.chatOpen = !state.chatOpen;
      if (a === "toggle-share") state.shareOn = !state.shareOn;
      if (a === "toggle-audio") {
        state.audioEnabled = !state.audioEnabled;
        document.querySelectorAll("video.participant-video").forEach(function(v) {
          v.muted = !state.audioEnabled;
          v.volume = 1;
          if (state.audioEnabled) v.play().catch(function(){});
        });
        render();
        if (state.audioEnabled) {
          document.querySelectorAll("video.participant-video").forEach(function(v) {
            v.muted = false;
            v.volume = 1;
            v.play().catch(function(){});
          });
        }
        return;
      }
      if (a === "add-person") { openAddPerson(); return; }
      if (a === "edit-person") { openParticipantEditor(el.dataset.personId); return; }
      if (a === "add-video") { openFakeCameraPicker(); return; }
      if (a === "contacts") { alert("Contacts is a demo placeholder."); return; }
      render();
    });
  });
  document.querySelectorAll("video.participant-video").forEach(function(v){
    v.volume = 1;
    v.addEventListener("ended", function() {
      const personId = v.dataset.personId;
      const person = getParticipant(personId);
      if (!person) return;
      if (getVideos(person).length > 1) {
        advancePersonVideo(personId);
        render();
      }
    });
    v.play().catch(function(){});
  });
}


window.addEventListener("keydown", function(e) {
  if (state.page !== "meeting") return;
  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || e.isComposing) return;
  const key = String(e.key || "").toLowerCase();
  if (!/^[a-z0-9]$/.test(key)) return;

  const cameraPersonId = Object.keys(state.keybinds).find(function(id) {
    return state.keybinds[id] === key;
  });
  if (cameraPersonId) {
    e.preventDefault();
    togglePersonCamera(cameraPersonId);
    render();
    return;
  }

  const nextPersonId = Object.keys(state.nextKeybinds).find(function(id) {
    return state.nextKeybinds[id] === key;
  });
  if (nextPersonId) {
    e.preventDefault();
    advancePersonVideo(nextPersonId);
    render();
  }
});

render();
