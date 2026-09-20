
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
  fakePeople: [
    { id: "alex", name: "Alex Morgan", role: "Host", initials: "AM", hue: 200 },
    { id: "jamie", name: "Jamie Lee", role: "", initials: "JL", hue: 280 },
    { id: "sam", name: "Sam Rivera", role: "", initials: "SR", hue: 35 }
  ],
  selectedVideo: null
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

function render() {
  if (state.page === "meeting") app.innerHTML = renderMeeting();
  else if (state.page === "settings") app.innerHTML = renderSettings();
  else app.innerHTML = renderHome();
  bind();
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
  const isMe = person.id === "me";
  const showVideo = person.videoUrl && (!isMe || state.cameraOn);
  const media = showVideo
    ? '<video class="participant-video" src="' + person.videoUrl + '" autoplay muted loop playsinline></video>'
    : '<div class="participant-avatar" style="--hue:' + person.hue + '"><span>' + person.initials + '</span></div>';
  return '<article class="participant-tile">' + media + '<div class="tile-scrim"></div><div class="participant-label"><span class="status-dot"></span><span>' + person.name + '</span>' + (person.role ? '<em>' + person.role + '</em>' : "") + '</div><div class="tile-menu">' + icon("more") + '</div></article>';
}

function renderMeeting() {
  const allPeople = [{id:"me",name:"Me",role:"You",initials:"MC",hue:145,videoUrl:state.selectedVideo}].concat(state.fakePeople);
  const tiles = allPeople.map(participantTile).join("");
  return '<div class="meeting-page">' +
    '<header class="meeting-topbar"><div class="meeting-title"><span class="live-dot"></span><div><strong>Product sync</strong><span>Meeting ID: ' + state.meetingId + '</span></div></div><div class="meeting-top-actions"><button class="top-action">Security</button><button class="top-action">View</button><button class="icon-button dark">' + icon("more") + '</button></div></header>' +
    '<main class="meeting-main"><section class="meeting-stage"><div class="meeting-grid ' + (allPeople.length > 4 ? "dense" : "") + '">' + tiles + '</div><div class="meeting-empty-hint">' + (state.selectedVideo ? "Local video file is acting as your camera." : "Add a local video or fake people from Participants.") + '</div></section>' +
    (state.participantsOpen ? renderParticipants() : "") + (state.chatOpen ? renderChat() : "") + '</main>' +
    '<footer class="meeting-controls"><div class="controls-group">' +
      '<button class="control-btn ' + (state.micOn ? "" : "off") + '" data-action="toggle-mic">' + icon(state.micOn ? "mic" : "micOff") + '<span>' + (state.micOn ? "Mute" : "Unmute") + '</span></button><button class="control-caret">⌄</button>' +
      '<button class="control-btn ' + (state.cameraOn ? "" : "off") + '" data-action="toggle-camera">' + icon(state.cameraOn ? "video" : "videoOff") + '<span>' + (state.cameraOn ? "Stop Video" : "Start Video") + '</span></button><button class="control-caret">⌄</button>' +
      '<button class="control-btn" data-action="add-video">' + icon("video") + '<span>Fake Camera</span></button>' +
    '</div><div class="controls-center">' +
      '<button class="control-btn ' + (state.participantsOpen ? "selected" : "") + '" data-action="toggle-participants">' + icon("users") + '<span>Participants <b>' + allPeople.length + '</b></span></button>' +
      '<button class="control-btn ' + (state.chatOpen ? "selected" : "") + '" data-action="toggle-chat">' + icon("chat") + '<span>Chat</span></button>' +
      '<button class="control-btn ' + (state.shareOn ? "selected share" : "") + '" data-action="toggle-share">' + icon("share") + '<span>' + (state.shareOn ? "Stop Share" : "Share Screen") + '</span></button>' +
      '<button class="control-btn"><span class="more-dots">•••</span><span>More</span></button>' +
    '</div><button class="end-call" data-page="home">' + icon("phone") + '<span>End</span></button></footer></div>';
}

function renderParticipants() {
  return '<aside class="side-panel participants-panel"><div class="panel-header"><div><strong>Participants</strong><span>' + (state.fakePeople.length + 1) + ' in meeting</span></div><button class="panel-close" data-action="toggle-participants">×</button></div>' +
    '<button class="add-person" data-action="add-person"><span>+</span><strong>Add fake person</strong><small>Custom name + optional video</small></button><div class="participant-list">' +
    '<div class="participant-list-row"><div class="avatar">MC</div><div><strong>Me</strong><span>Host · You</span></div><div class="row-icons">' + icon(state.micOn ? "mic" : "micOff") + icon(state.cameraOn ? "video" : "videoOff") + '</div></div>' +
    state.fakePeople.map(function(p){ return '<div class="participant-list-row"><div class="avatar" style="--hue:' + p.hue + '">' + p.initials + '</div><div><strong>' + p.name + '</strong><span>' + (p.role || "Participant") + (p.videoUrl ? " · Video file" : "") + '</span></div><div class="row-icons">' + icon("mic") + icon(p.videoUrl ? "video" : "videoOff") + '</div></div>'; }).join("") +
    '</div></aside>';
}

function renderChat() {
  return '<aside class="side-panel chat-panel"><div class="panel-header"><div><strong>Meeting Chat</strong><span>Everyone</span></div><button class="panel-close" data-action="toggle-chat">×</button></div><div class="chat-messages">' +
    '<div class="chat-msg"><strong>Jamie Lee</strong><p>Ready when you are.</p></div><div class="chat-msg"><strong>Sam Rivera</strong><p>I added the notes to the agenda.</p></div></div><div class="chat-input"><input placeholder="Type a message..."><button>Send</button></div></aside>';
}

function openAddPerson() {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML =
    '<form class="modal"><button type="button" class="modal-close" data-close>×</button><span class="eyebrow">Participants</span><h2>Add a fake person</h2><p class="muted">Create a local participant and optionally assign a video file to act as their camera feed.</p>' +
    '<label class="field-label">Name<input name="name" required maxlength="28" placeholder="Taylor Kim" autofocus></label>' +
    '<label class="field-label">Video file<input name="video" type="file" accept="video/*"></label><div class="file-help">MP4, WebM, MOV and other browser-supported video formats work best.</div>' +
    '<div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary" type="submit">Add person</button></div></form>';
  document.body.appendChild(modal);

  modal.querySelectorAll("[data-close]").forEach(function(b){ b.addEventListener("click", function(){ modal.remove(); }); });
  modal.addEventListener("click", function(e){ if (e.target === modal) modal.remove(); });
  modal.querySelector("form").addEventListener("submit", function(e){
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "Guest").trim();
    const file = fd.get("video");
    const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(function(x){ return x[0].toUpperCase(); }).join("") || "GU";
    const person = { id: crypto.randomUUID(), name: name, role: "", initials: initials, hue: Math.floor(Math.random()*360) };
    if (file instanceof File && file.size) person.videoUrl = URL.createObjectURL(file);
    state.fakePeople.push(person);
    modal.remove();
    render();
  });
}

function openFakeCameraPicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/*";
  input.onchange = function() {
    const file = input.files && input.files[0];
    if (!file) return;
    if (state.selectedVideo) URL.revokeObjectURL(state.selectedVideo);
    state.selectedVideo = URL.createObjectURL(file);
    state.cameraOn = true;
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
      if (a === "add-person") { openAddPerson(); return; }
      if (a === "add-video") { openFakeCameraPicker(); return; }
      if (a === "contacts") { alert("Contacts is a demo placeholder."); return; }
      render();
    });
  });
  document.querySelectorAll("video.participant-video").forEach(function(v){ v.play().catch(function(){}); });
}

render();
