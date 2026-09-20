import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

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
  hostId: "alex",
  fakePeople: [
    { id: "alex", name: "Alex Morgan", role: "Host", initials: "AM", hue: 200, avatarUrl: null, videos: [], currentVideoIndex: 0, cameraVisible: true, autoPlayNext: false, autoCameraOff: true, audioOn: true, needsNextOnCamera: false },
    { id: "jamie", name: "Jamie Lee", role: "", initials: "JL", hue: 280, avatarUrl: null, videos: [], currentVideoIndex: 0, cameraVisible: true, autoPlayNext: false, autoCameraOff: true, audioOn: true, needsNextOnCamera: false },
    { id: "sam", name: "Sam Rivera", role: "", initials: "SR", hue: 35, avatarUrl: null, videos: [], currentVideoIndex: 0, cameraVisible: true, autoPlayNext: false, autoCameraOff: true, audioOn: true, needsNextOnCamera: false }
  ],
  myVideos: [],
  myVideoIndex: 0,
  myAutoPlayNext: false,
  myAutoCameraOff: true,
  cameraHidden: {},
  keybinds: {},
  nextKeybinds: {},
  audioKeybinds: {},
  leaveKeybinds: {},
  myAudioOn: true,
  audioEnabled: true,
  audioPlaying: false,
  recording: false,
  myParticipantHidden: false,
  myAvatarUrl: null
};

const recordingState = {
  recorder: null,
  chunks: [],
  canvas: null,
  context: null,
  animationFrame: 0,
  audioContext: null,
  audioDestination: null,
  mediaSources: new Map(),
  ffmpeg: null,
  ffmpegLoading: false
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
  record: '<circle cx="12" cy="12" r="6"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
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

function getAvatarUrl(person) {
  if (!person) return null;
  return person.id === "me" ? (state.myAvatarUrl || null) : (person.avatarUrl || null);
}

function avatarMarkup(person, className) {
  const avatarUrl = getAvatarUrl(person);
  return avatarUrl
    ? '<img class="' + className + '" src="' + escapeHtml(avatarUrl) + '" alt="' + escapeHtml(person.name || "Participant") + ' profile picture">'
    : '';
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

function normalizeHosts() {
  if (!state.fakePeople.length) {
    state.hostId = null;
    return;
  }

  const currentHost = state.fakePeople.find(function(p) { return p.id === state.hostId; });
  if (!currentHost) state.hostId = state.fakePeople[0].id;

  state.fakePeople.forEach(function(p) {
    p.role = p.id === state.hostId ? "Host" : "";
  });
}

function isPersonAudioOn(person) {
  if (!person) return false;
  return person.id === "me" ? state.myAudioOn : person.audioOn !== false;
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
      cameraVisible: !state.cameraHidden.me,
      avatarUrl: state.myAvatarUrl,
      autoPlayNext: state.myAutoPlayNext,
      autoCameraOff: state.myAutoCameraOff,
      audioOn: state.myAudioOn,
      needsNextOnCamera: state.needsNextOnCamera
    };
  }
  return state.fakePeople.find(function(p) { return p.id === personId; }) || null;
}

function switchParticipantVideoInPlace(personId) {
  const person = getParticipant(personId);
  if (!person) return;

  const videoUrl = getCurrentVideoUrl(person);
  if (!videoUrl) {
    updateParticipantTile(personId);
    return;
  }

  const tile = document.querySelector('.participant-tile[data-person-id="' + personId + '"]');
  const currentVideo = tile && tile.querySelector("video.participant-video");

  if (!tile || !currentVideo) {
    updateParticipantTile(personId);
    return;
  }

  const nextVideo = document.createElement("video");
  nextVideo.className = "participant-video participant-video-next";
  nextVideo.dataset.personId = personId;
  nextVideo.dataset.videoUrl = videoUrl;
  nextVideo.src = videoUrl;
  nextVideo.autoplay = false;
  nextVideo.playsInline = true;
  nextVideo.muted = !state.audioEnabled || !isPersonAudioOn(person);
  nextVideo.volume = 1;

  nextVideo.style.position = "absolute";
  nextVideo.style.inset = "0";
  nextVideo.style.width = "100%";
  nextVideo.style.height = "100%";
  nextVideo.style.objectFit = "contain";
  nextVideo.style.background = "#05080d";
  nextVideo.style.opacity = "0";
  nextVideo.style.zIndex = "1";
  nextVideo.style.transition = "opacity 100ms ease";

  currentVideo.style.transition = "opacity 100ms ease";
  currentVideo.style.zIndex = "0";

  tile.insertBefore(nextVideo, tile.firstChild);

  let finished = false;
  const finish = function() {
    if (finished || nextVideo.readyState < 2) return;
    finished = true;

    nextVideo.style.opacity = "1";
    currentVideo.style.opacity = "0";

    setTimeout(function() {
      currentVideo.pause();
      currentVideo.remove();
      nextVideo.classList.remove("participant-video-next");
      nextVideo.style.position = "";
      nextVideo.style.inset = "";
      nextVideo.style.width = "";
      nextVideo.style.height = "";
      nextVideo.style.opacity = "";
      nextVideo.style.zIndex = "";
      nextVideo.style.transition = "";
    }, 120);

    updateParticipantsListOnly();
    syncAudioIndicator();
    if (state.recording) syncRecordingAudio();
  };

  nextVideo.addEventListener("loadeddata", function() {
    nextVideo.play().then(finish).catch(function() {
      finish();
    });
  }, { once: true });

  nextVideo.addEventListener("error", function() {
    nextVideo.remove();
    updateParticipantTile(personId);
  }, { once: true });

  nextVideo.load();
}

function advancePersonVideo(personId) {
  const person = getParticipant(personId);
  if (!person) return false;
  const videos = getVideos(person);
  if (videos.length < 2) return false;

  const wasVisible = isCameraVisible(person);

  if (personId === "me") {
    state.myVideoIndex = (state.myVideoIndex + 1) % videos.length;
    if (wasVisible) {
      state.cameraHidden.me = false;
      state.cameraOn = true;
    }
    state.needsNextOnCamera = false;
  } else {
    const target = state.fakePeople.find(function(p) { return p.id === personId; });
    if (!target) return false;
    target.currentVideoIndex = ((target.currentVideoIndex || 0) + 1) % target.videos.length;
    if (wasVisible) target.cameraVisible = true;
    target.needsNextOnCamera = false;
  }

  if (wasVisible) {
    switchParticipantVideoInPlace(personId);
  } else {
    updateParticipantTile(personId);
  }
  updateParticipantsListOnly();
  if (state.recording) syncRecordingAudio();
  return true;
}

function togglePersonCamera(personId) {
  if (personId === "me") {
    const turningOn = state.cameraHidden.me || !state.cameraOn;
    if (turningOn && state.needsNextOnCamera && state.myVideos.length > 1) {
      state.myVideoIndex = (state.myVideoIndex + 1) % state.myVideos.length;
      state.needsNextOnCamera = false;
    }
    state.cameraHidden.me = !turningOn;
    state.cameraOn = turningOn;
  } else {
    const person = getParticipant(personId);
    if (!person) return;
    const target = state.fakePeople.find(function(p) { return p.id === personId; });
    const turningOn = target.cameraVisible === false;
    if (turningOn && target.needsNextOnCamera && target.videos.length > 1) {
      target.currentVideoIndex = ((target.currentVideoIndex || 0) + 1) % target.videos.length;
      target.needsNextOnCamera = false;
    }
    target.cameraVisible = turningOn;
  }

  updateParticipantTile(personId);
  updateParticipantsListOnly();
  if (state.recording) syncRecordingAudio();
}

function handleVideoEnded(personId) {
  const person = getParticipant(personId);
  if (!person) return;
  const videos = getVideos(person);
  if (!videos.length) return;

  const autoPlayNext = person.id === "me" ? state.myAutoPlayNext : person.autoPlayNext === true;

  if (autoPlayNext && videos.length > 1) {
    advancePersonVideo(personId);
    return;
  }

  const autoCameraOff = person.id === "me" ? state.myAutoCameraOff !== false : person.autoCameraOff !== false;
  if (!autoCameraOff) {
    if (personId === "me") state.needsNextOnCamera = false;
    else {
      const target = state.fakePeople.find(function(p) { return p.id === personId; });
      if (target) target.needsNextOnCamera = false;
    }
    syncAudioIndicator();
    return;
  }

  if (personId === "me") {
    state.cameraHidden.me = true;
    state.cameraOn = false;
    state.needsNextOnCamera = videos.length > 1;
  } else {
    const target = state.fakePeople.find(function(p) { return p.id === personId; });
    if (!target) return;
    target.cameraVisible = false;
    target.needsNextOnCamera = target.videos.length > 1;
  }

  updateParticipantTile(personId);
  updateParticipantsListOnly();
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

function setLeaveKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.leaveKeybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized)) return;
  Object.keys(state.leaveKeybinds).forEach(function(id) {
    if (id !== personId && state.leaveKeybinds[id] === normalized) delete state.leaveKeybinds[id];
  });
  state.leaveKeybinds[personId] = normalized;
}

const leaveSound = new Audio("./FaceTime%20End%20Call%20Sound%20Effect.mp3");
leaveSound.preload = "auto";
leaveSound.volume = 0.74;

function playLeaveSound() {
  try {
    leaveSound.pause();
    leaveSound.currentTime = 0;
  } catch (error) {}

  leaveSound.play().catch(function() {});
}

function leaveMeetingAsMe() {
  if (state.myParticipantHidden) return false;

  playLeaveSound();
  state.myParticipantHidden = true;

  const tile = document.querySelector('.participant-tile[data-person-id="me"]');
  if (tile) tile.remove();

  updateParticipantsListOnly();
  syncAudioIndicator();
  if (state.recording) syncRecordingAudio();
  return true;
}

function leavePerson(personId) {
  if (personId === "me") return leaveMeetingAsMe();

  const index = state.fakePeople.findIndex(function(p) { return p.id === personId; });
  if (index < 0) return false;

  playLeaveSound();

  const person = state.fakePeople[index];
  revokeVideos(person.videos);
  revokeBlob(person.avatarUrl);
  state.fakePeople.splice(index, 1);
  delete state.keybinds[personId];
  delete state.nextKeybinds[personId];
  delete state.audioKeybinds[personId];
  delete state.leaveKeybinds[personId];
  normalizeHosts();

  const tile = document.querySelector('.participant-tile[data-person-id="' + personId + '"]');
  if (tile) tile.remove();

  updateParticipantsListOnly();
  syncAudioIndicator();
  if (state.recording) syncRecordingAudio();
  return true;
}

function setAudioKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.audioKeybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized)) return;
  Object.keys(state.audioKeybinds).forEach(function(id) {
    if (id !== personId && state.audioKeybinds[id] === normalized) delete state.audioKeybinds[id];
  });
  state.audioKeybinds[personId] = normalized;
}

function setAudioForPerson(personId, enabled) {
  state.audioEnabled = true;
  if (personId === "me") {
    state.myAudioOn = enabled;
  } else {
    const person = getParticipant(personId);
    if (person) person.audioOn = enabled;
  }

  const video = document.querySelector('.participant-video[data-person-id="' + personId + '"]');
  if (video) {
    video.muted = !state.audioEnabled || !isPersonAudioOn(getParticipant(personId));
    video.volume = 1;
    if (!video.muted) video.play().catch(function(){});
  }
  updateParticipantTile(personId);
  updateParticipantsListOnly();
  if (state.recording) syncRecordingAudio();
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
  const media = showVideo
    ? '<video class="participant-video" data-person-id="' + person.id + '" data-video-url="' + escapeHtml(videoUrl) + '" src="' + videoUrl + '" autoplay playsinline' +
      (state.audioEnabled && isPersonAudioOn(person) ? "" : " muted") + '></video>'
    : '<div class="participant-avatar" style="--hue:' + person.hue + '">' + avatarMarkup(person, "participant-avatar-image") + '<span' + (getAvatarUrl(person) ? ' class="participant-avatar-initials"' : '') + '>' + escapeHtml(person.initials) + '</span></div>';
  const mutedBadge = !isPersonAudioOn(person) ? '<span class="muted-audio-badge">' + icon("micOff") + '<span>Muted</span></span>' : "";
  const hiddenBadge = !isCameraVisible(person) && videoCount ? '<span class="camera-hidden-badge">CAM OFF</span>' : "";
  return '<article class="participant-tile" data-person-id="' + person.id + '">' + media + '<div class="tile-scrim"></div>' + hiddenBadge + mutedBadge +
    '<div class="participant-label"><span class="status-dot"></span><span>' + escapeHtml(person.name) + '</span>' +
    (person.role ? '<em>' + escapeHtml(person.role) + '</em>' : "") + '</div>' +
    '<button class="tile-menu" data-action="edit-person" data-person-id="' + person.id + '" title="Edit participant">' + icon("more") + '</button></article>';
}

function updateParticipantTile(personId) {
  const person = getParticipant(personId);
  if (!person) return;

  const tiles = document.querySelectorAll(".participant-tile[data-person-id]");
  let currentTile = null;
  tiles.forEach(function(tile) {
    if (tile.dataset.personId === personId) currentTile = tile;
  });
  if (!currentTile) return;

  const oldVideo = currentTile.querySelector("video.participant-video");
  const oldSrc = oldVideo ? (oldVideo.currentSrc || oldVideo.src) : "";
  const oldTime = oldVideo && Number.isFinite(oldVideo.currentTime) ? oldVideo.currentTime : 0;
  const wasPaused = oldVideo ? oldVideo.paused : true;

  const wrapper = document.createElement("template");
  wrapper.innerHTML = participantTile(person).trim();
  const newTile = wrapper.content.firstElementChild;
  if (!newTile) return;

  currentTile.replaceWith(newTile);

  const newVideo = newTile.querySelector("video.participant-video");
  if (!newVideo) return;

  wireParticipantVideo(newVideo);

  const newSrc = newVideo.currentSrc || newVideo.src;
  if (oldVideo && oldSrc && newSrc === oldSrc) {
    const restore = function() {
      try {
        if (Number.isFinite(oldTime) && oldTime > 0) {
          newVideo.currentTime = Math.min(oldTime, Math.max(0, (newVideo.duration || oldTime) - 0.05));
        }
      } catch (error) {}
      if (!wasPaused) newVideo.play().catch(function(){});
    };

    if (newVideo.readyState >= 1) restore();
    else newVideo.addEventListener("loadedmetadata", restore, { once: true });
  }
}

function updateParticipantsListOnly() {
  const panel = document.querySelector(".participants-panel");
  if (!panel) return;

  const wrapper = document.createElement("template");
  wrapper.innerHTML = renderParticipants().trim();
  const newPanel = wrapper.content.firstElementChild;
  if (!newPanel) return;

  panel.replaceWith(newPanel);
  bind();
}

function renderMeeting() {
  const myPerson = {
    id: "me",
    name: state.displayName,
    role: "You",
    initials: initialsFor(state.displayName),
    hue: 145,
    videos: state.myVideos || [],
    currentVideoIndex: state.myVideoIndex,
    cameraVisible: !state.cameraHidden.me
  };
  const allPeople = (state.myParticipantHidden ? [] : [Object.assign({}, myPerson, { avatarUrl: state.myAvatarUrl })]).concat(state.fakePeople);

  const tiles = allPeople.map(participantTile).join("");
  const peopleCount = allPeople.length;
  const gridSizeClass = peopleCount <= 2 ? "people-2" : peopleCount <= 4 ? "people-4" : peopleCount <= 6 ? "people-6" : peopleCount <= 9 ? "people-9" : peopleCount <= 12 ? "people-12" : "people-many";

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
        '<div class="meeting-grid ' + gridSizeClass + '">' + tiles + '</div>' +
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
        '<button class="control-btn ' + (state.participantsOpen ? "selected " : "") + (state.audioPlaying ? "audio-playing" : "") + '" data-action="toggle-participants">' + icon("users") + '<span>Participants <b>' + allPeople.length + '</b></span></button>' +
        '<button class="control-btn ' + (state.chatOpen ? "selected" : "") + '" data-action="toggle-chat">' + icon("chat") + '<span>Chat</span></button>' +
        '<button class="control-btn ' + (state.shareOn ? "selected share" : "") + '" data-action="toggle-share">' + icon("share") + '<span>' + (state.shareOn ? "Stop Share" : "Share Screen") + '</span></button>' +
        '<button class="control-btn ' + (state.recording ? "recording-active" : "") + '" data-action="toggle-recording">' + icon(state.recording ? "stop" : "record") + '<span>' + (state.recording ? "Stop Recording" : "Record") + '</span></button>' +
        '<button class="control-btn"><span class="more-dots">•••</span><span>More</span></button>' +
      '</div>' +
      '<button class="end-call" data-page="home">' + icon("phone") + '<span>End</span></button>' +
    '</footer>' +
  '</div>';
}

function renderParticipants() {
  normalizeHosts();
  const safeDisplayName = escapeHtml(state.displayName);
  const myVideos = state.myVideos || [];
  const myAudioText = state.myAudioOn ? "Audio on" : "Audio off";
  return '<aside class="side-panel participants-panel"><div class="panel-header"><div><strong>Participants</strong><span>' + (state.fakePeople.length + 1) + ' in meeting</span></div><button class="panel-close" data-action="toggle-participants">×</button></div>' +
    '<div class="my-participant-card"><div class="avatar" style="--hue:145">' + avatarMarkup({ id: "me", name: state.displayName }, "avatar-image") + (state.myAvatarUrl ? '' : '<span>MC</span>') + '</div><div><strong>' + safeDisplayName + '</strong><span>You · ' + myVideos.length + ' video' + (myVideos.length === 1 ? "" : "s") + ' · ' + myAudioText + '</span></div><div class="participant-row-actions"><button class="edit-mini" data-action="edit-person" data-person-id="me">Edit</button><button class="leave-mini" data-action="leave-person" data-person-id="me">Leave</button></div></div>' +
    '<button class="add-person" data-action="add-person"><span>+</span><strong>Add fake person</strong><small>Custom name + multiple videos</small></button><div class="participant-list">' +
    state.fakePeople.map(function(p){
      const videos = getVideos(p);
      const cameraText = videos.length ? (p.cameraVisible === false ? " · Camera hidden" : " · " + videos.length + " video" + (videos.length === 1 ? "" : "s")) : " · No camera";
      const hostText = p.id === state.hostId ? "Host" : "Participant";
      return '<div class="participant-list-row"><div class="avatar" style="--hue:' + p.hue + '">' + avatarMarkup(p, "avatar-image") + (p.avatarUrl ? '' : '<span>' + escapeHtml(p.initials) + '</span>') + '</div><div><strong>' + escapeHtml(p.name) + '</strong><span>' + hostText + cameraText + (p.audioOn === false ? " · Muted" : "") + '</span></div><div class="participant-row-actions"><div class="row-icons">' + icon(p.audioOn === false ? "micOff" : "mic") + icon(videos.length && p.cameraVisible !== false ? "video" : "videoOff") + '</div><button class="edit-mini" data-action="edit-person" data-person-id="' + p.id + '">Edit</button></div></div>';
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
    ? { id: null, name: "", initials: "GU", hue: Math.floor(Math.random() * 360), avatarUrl: null, videos: [], currentVideoIndex: 0, cameraVisible: true, autoPlayNext: false, autoCameraOff: true, audioOn: true }
    : existing;
  if (!person) return;

  const videos = getVideos(person);
  const currentKey = isNew ? "" : (state.keybinds[personId] || "");
  const currentNextKey = isNew ? "" : (state.nextKeybinds[personId] || "");
  const currentAudioKey = isNew ? "" : (state.audioKeybinds[personId] || "");
  const currentLeaveKey = isNew ? "" : (state.leaveKeybinds[personId] || "");
  const autoPlayNext = isNew ? false : (isMe ? state.myAutoPlayNext : person.autoPlayNext === true);
  const autoCameraOff = isNew ? true : (isMe ? state.myAutoCameraOff !== false : person.autoCameraOff !== false);
  const currentIndex = person.id === "me" ? state.myVideoIndex : (person.currentVideoIndex || 0);

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML =
    '<form class="modal">' +
      '<button type="button" class="modal-close" data-close>×</button>' +
      '<span class="eyebrow">' + (isNew ? "Participants" : (isMe ? "Your participant" : "Fake participant")) + '</span>' +
      '<h2>' + (isNew ? "Add a fake person" : (isMe ? "Edit your meeting identity" : "Edit fake person")) + '</h2>' +
      '<p class="muted">' + (isNew ? "Add multiple video clips and camera controls." : "Change the name, video playlist, autoplay behavior, or keyboard shortcuts.") + '</p>' +
      '<label class="field-label">Display name<input name="name" required maxlength="28" value="' + escapeHtml(person.name) + '" placeholder="Taylor Kim" autofocus></label>' +
      '<label class="field-label">Profile picture<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/*"></label>' +
      '<div class="file-help">' + (getAvatarUrl(person) ? "Current profile picture is set. Choose a new image to replace it." : "Add a square or portrait image to use as this participant’s PFP.") + '</div>' +
      (!isNew && getAvatarUrl(person) ? '<label class="check-row"><input name="clearAvatar" type="checkbox"><span>Remove profile picture</span></label>' : '') +
      '<label class="field-label">Add video files<input name="video" type="file" accept="video/mp4,video/webm,video/quicktime,video/*" multiple></label>' +
      '<div class="file-help">' + (videos.length ? videos.length + " video" + (videos.length === 1 ? "" : "s") + " currently assigned. New files are added." : "Select multiple MP4 or phone videos at once.") + '</div>' +
      (videos.length ? '<div class="video-playlist">' + videos.map(function(v, i) { return '<div class="video-playlist-row"><span>' + (i + 1) + '</span><strong>' + escapeHtml(v.name || ("Video " + (i + 1))) + '</strong>' + (i === currentIndex ? '<em>Now playing</em>' : '') + '</div>'; }).join("") + '</div>' : '') +
      '<label class="field-label">Camera keybind<input name="keybind" class="keybind-input" value="' + escapeHtml(currentKey.toUpperCase()) + '" placeholder="Press a key" maxlength="1" autocomplete="off"></label>' +
      '<div class="file-help">Show or hide this person’s camera.</div>' +
      '<label class="field-label">Next video keybind<input name="nextKeybind" class="keybind-input" value="' + escapeHtml(currentNextKey.toUpperCase()) + '" placeholder="Press a key" maxlength="1" autocomplete="off"></label>' +
      '<div class="file-help">Switch to the next video without changing other participants.</div>' +
      '<label class="field-label">Audio keybind<input name="audioKeybind" class="keybind-input" value="' + escapeHtml(currentAudioKey.toUpperCase()) + '" placeholder="Press a key" maxlength="1" autocomplete="off"></label>' +
      '<div class="file-help">Toggle this person’s MP4 audio on or off.</div>' +
      '<label class="check-row autoplay-row"><input name="autoPlayNext" type="checkbox" ' + (autoPlayNext ? "checked" : "") + '><span>Auto-play the next video when this one ends</span></label>' +
      '<div class="file-help">Off: the camera stays on the last video frame. On: the camera turns off when the video ends.</div>' +
      '<label class="check-row autoplay-row"><input name="autoCameraOff" type="checkbox" ' + (autoCameraOff ? "checked" : "") + '><span>Turn camera off when video ends</span></label>' +
      '<div class="file-help">Disable this to keep the camera tile visible after a video finishes.</div>' +
      (!isNew ? '<label class="field-label">Leave keybind<input name="leaveKeybind" class="keybind-input" value="' + escapeHtml(currentLeaveKey.toUpperCase()) + '" placeholder="Press a key" maxlength="1" autocomplete="off"></label><div class="file-help">This person leaves the meeting when the key is pressed.</div>' : '') +
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
        state.needsNextOnCamera = false;
      } else {
        person.videos = [];
        person.currentVideoIndex = 0;
        person.needsNextOnCamera = false;
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
        revokeBlob(state.fakePeople[index].avatarUrl);
        state.fakePeople.splice(index, 1);
      }
      delete state.keybinds[personId];
      delete state.nextKeybinds[personId];
      delete state.audioKeybinds[personId];
      delete state.leaveKeybinds[personId];
      normalizeHosts();
      modal.remove();
      render();
    });
  }

  modal.querySelectorAll('[name="keybind"], [name="nextKeybind"], [name="audioKeybind"], [name="leaveKeybind"]').forEach(function(input) {
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
    const avatarFile = fd.get("avatar");
    const clearVideos = form.querySelector('[name="clearVideos"]').checked;
    const clearAvatarInput = form.querySelector('[name="clearAvatar"]');
    const clearAvatar = clearAvatarInput ? clearAvatarInput.checked : false;
    const hasAvatarFile = avatarFile instanceof File && avatarFile.size > 0;
    const autoPlay = form.querySelector('[name="autoPlayNext"]').checked;
    const key = String(fd.get("keybind") || "").trim();
    const nextKey = String(fd.get("nextKeybind") || "").trim();
    const audioKey = String(fd.get("audioKeybind") || "").trim();
    const leaveKey = String(fd.get("leaveKeybind") || "").trim();
    const autoCameraOff = form.querySelector('[name="autoCameraOff"]').checked;

    if (isNew) {
      const newPerson = {
        id: crypto.randomUUID(),
        name: name,
        avatarUrl: hasAvatarFile ? URL.createObjectURL(avatarFile) : null,
        role: "",
        initials: initialsFor(name),
        hue: Math.floor(Math.random() * 360),
        videos: [],
        currentVideoIndex: 0,
        cameraVisible: true,
        autoPlayNext: autoPlay,
        autoCameraOff: autoCameraOff,
        audioOn: true,
        needsNextOnCamera: false
      };
      addVideoFiles(newPerson, files);
      state.fakePeople.push(newPerson);
      normalizeHosts();
      setPersonKeybind(newPerson.id, key);
      setNextKeybind(newPerson.id, nextKey);
      setAudioKeybind(newPerson.id, audioKey);
      setLeaveKeybind(newPerson.id, leaveKey);
    } else if (isMe) {
      state.displayName = name;
      if (clearAvatar) {
        revokeBlob(state.myAvatarUrl);
        state.myAvatarUrl = null;
      } else if (hasAvatarFile) {
        revokeBlob(state.myAvatarUrl);
        state.myAvatarUrl = URL.createObjectURL(avatarFile);
      }
      state.myAutoPlayNext = autoPlay;
      state.myAutoCameraOff = autoCameraOff;
      if (clearVideos) {
        revokeVideos(state.myVideos);
        state.myVideos = [];
        state.myVideoIndex = 0;
        state.cameraOn = false;
        state.cameraHidden.me = true;
        state.needsNextOnCamera = false;
      } else {
        addVideoFiles({ id: "me" }, files);
        if (state.myVideos.length) {
          state.cameraOn = true;
          state.cameraHidden.me = false;
          state.needsNextOnCamera = false;
        }
      }
      setPersonKeybind("me", key);
      setNextKeybind("me", nextKey);
      setAudioKeybind("me", audioKey);
      setLeaveKeybind("me", leaveKey);
    } else {
      const target = state.fakePeople.find(function(p) { return p.id === personId; });
      if (!target) return;
      target.name = name;
      target.initials = initialsFor(name);
      if (clearAvatar) {
        revokeBlob(target.avatarUrl);
        target.avatarUrl = null;
      } else if (hasAvatarFile) {
        revokeBlob(target.avatarUrl);
        target.avatarUrl = URL.createObjectURL(avatarFile);
      }
      target.autoPlayNext = autoPlay;
      target.autoCameraOff = autoCameraOff;
      if (clearVideos) {
        revokeVideos(target.videos);
        target.videos = [];
        target.currentVideoIndex = 0;
        target.needsNextOnCamera = false;
      } else {
        addVideoFiles(target, files);
      }
      if (target.videos.length) target.cameraVisible = true;
      setPersonKeybind(personId, key);
      setNextKeybind(personId, nextKey);
      setAudioKeybind(personId, audioKey);
      setLeaveKeybind(personId, leaveKey);
      normalizeHosts();
    }

    modal.remove();
    render();
    if (state.recording) syncRecordingAudio();
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
    updateParticipantTile("me");
    updateParticipantsListOnly();
    if (state.recording) syncRecordingAudio();
  };
  input.click();
}

function wireParticipantVideo(video) {
  if (!video || video.dataset.wired === "1") return;
  video.dataset.wired = "1";
  video.volume = 1;
  video.addEventListener("ended", function() {
    handleVideoEnded(video.dataset.personId);
    syncAudioIndicator();
  });
  video.addEventListener("play", syncAudioIndicator);
  video.addEventListener("playing", syncAudioIndicator);
  video.addEventListener("pause", syncAudioIndicator);
  video.addEventListener("volumechange", syncAudioIndicator);
  video.play().then(syncAudioIndicator).catch(syncAudioIndicator);
}

function getRecordingPeople() {
  const me = {
    id: "me",
    name: state.displayName,
    initials: initialsFor(state.displayName),
    hue: 145
  };
  return (state.myParticipantHidden ? [] : [me]).concat(state.fakePeople);
}

function roundedRectPath(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawRecordingAvatar(ctx, person, x, y, w, h) {
  const gradient = ctx.createRadialGradient(x + w / 2, y + h * 0.38, 8, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  gradient.addColorStop(0, "hsl(" + person.hue + ", 65%, 44%)");
  gradient.addColorStop(1, "hsl(" + person.hue + ", 40%, 18%)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 " + Math.max(28, Math.min(w, h) * 0.15) + "px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(person.initials || "GU", x + w / 2, y + h / 2);
}

function drawRecordingLabel(ctx, person, x, y, w, h) {
  const label = String(person.name || "Guest");
  const fontSize = Math.max(16, Math.min(23, w * 0.024));
  ctx.font = "700 " + fontSize + "px system-ui, sans-serif";
  const metrics = ctx.measureText(label);
  const padX = 12;
  const boxW = metrics.width + padX * 2;
  const boxH = fontSize + 14;
  const boxY = y + h - boxH - 12;
  ctx.fillStyle = "rgba(0,0,0,.58)";
  roundedRectPath(ctx, x + 10, boxY, Math.min(boxW, w - 20), boxH, 7);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 10 + padX, boxY + boxH / 2);
}

function drawRecordingFrame() {
  const canvas = recordingState.canvas;
  const ctx = recordingState.context;
  if (!canvas || !ctx || !state.recording) return;

  const width = canvas.width;
  const height = canvas.height;
  const topBar = 52;
  const bottomBar = 68;
  const panelWidth = state.participantsOpen || state.chatOpen ? 286 : 0;
  const stageX = 0;
  const stageY = topBar;
  const stageWidth = width - panelWidth;
  const stageHeight = height - topBar - bottomBar;

  ctx.fillStyle = "#111820";
  ctx.fillRect(0, 0, width, height);

  // Meeting top bar.
  ctx.fillStyle = "#18212b";
  ctx.fillRect(0, 0, width, topBar);
  ctx.fillStyle = "#44d585";
  ctx.beginPath();
  ctx.arc(20, 22, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 14px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Product sync", 32, 17);
  ctx.fillStyle = "#95a4b4";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText("Meeting ID: " + state.meetingId, 32, 34);

  const topButtons = [
    state.audioEnabled ? "Video audio on" : "Enable video audio",
    "Security",
    "View"
  ];
  let bx = width - panelWidth - 305;
  topButtons.forEach(function(label) {
    const textWidth = ctx.measureText(label).width;
    const w = textWidth + 22;
    ctx.fillStyle = "rgba(255,255,255,.07)";
    roundedRectPath(ctx, bx, 10, w, 31, 8);
    ctx.fill();
    ctx.fillStyle = "#d5dde5";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(label, bx + 11, 25);
    bx += w + 7;
  });
  ctx.fillStyle = "rgba(255,255,255,.07)";
  roundedRectPath(ctx, width - panelWidth - 35, 10, 25, 31, 8);
  ctx.fill();
  ctx.fillStyle = "#d5dde5";
  ctx.font = "800 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("•••", width - panelWidth - 22, 25);

  // Participant stage.
  const people = getRecordingPeople();
  const columns = people.length > 4 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(people.length / columns));
  const gap = 7;
  const stagePad = 12;
  const tileWidth = (stageWidth - stagePad * 2 - gap * (columns - 1)) / columns;
  const tileHeight = (stageHeight - stagePad * 2 - gap * (rows - 1)) / rows;

  people.forEach(function(person, index) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = stageX + stagePad + col * (tileWidth + gap);
    const y = stageY + stagePad + row * (tileHeight + gap);

    ctx.save();
    roundedRectPath(ctx, x, y, tileWidth, tileHeight, 10);
    ctx.clip();

    const video = document.querySelector('video.participant-video[data-person-id="' + person.id + '"]');
    if (video && video.readyState >= 2 && !video.paused && !video.ended && video.videoWidth && video.videoHeight) {
      const sourceRatio = video.videoWidth / video.videoHeight;
      const tileRatio = tileWidth / tileHeight;
      let drawWidth = tileWidth;
      let drawHeight = tileHeight;
      let drawX = x;
      let drawY = y;
      ctx.fillStyle = "#05080d";
      ctx.fillRect(x, y, tileWidth, tileHeight);
      if (sourceRatio > tileRatio) {
        drawHeight = tileWidth / sourceRatio;
        drawY = y + (tileHeight - drawHeight) / 2;
      } else {
        drawWidth = tileHeight * sourceRatio;
        drawX = x + (tileWidth - drawWidth) / 2;
      }
      ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
    } else {
      const livePerson = getParticipant(person.id);
      drawRecordingAvatar(ctx, livePerson || person, x, y, tileWidth, tileHeight);
    }

    const gradient = ctx.createLinearGradient(0, y + tileHeight * 0.55, 0, y + tileHeight);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,.62)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, tileWidth, tileHeight);
    ctx.restore();

    // Keep the normal participant name/status visible, but do not record
    // Cam key, Next key, Audio key badges, or the Edit button.
    drawRecordingLabel(ctx, person, x, y, tileWidth, tileHeight);

    if (!isCameraVisible(getParticipant(person.id))) {
      ctx.fillStyle = "rgba(220,62,72,.82)";
      roundedRectPath(ctx, x + 10, y + 10, 58, 21, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 8px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("CAM OFF", x + 18, y + 20.5);
    }
  });

  // Side panel: show the normal participant/chat content, but omit Edit controls.
  if (panelWidth) {
    const px = stageWidth;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px, topBar, panelWidth, height - topBar - bottomBar);
    ctx.strokeStyle = "#dfe4ea";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, topBar, panelWidth, height - topBar - bottomBar);

    if (state.participantsOpen) {
      ctx.fillStyle = "#1b2632";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = "700 13px system-ui, sans-serif";
      ctx.fillText("Participants", px + 16, topBar + 23);
      ctx.fillStyle = "#8c97a3";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText((state.fakePeople.length + 1) + " in meeting", px + 16, topBar + 39);

      let py = topBar + 55;
      ctx.fillStyle = "#fafbfd";
      roundedRectPath(ctx, px + 14, py, panelWidth - 28, 50, 10);
      ctx.fill();
      ctx.strokeStyle = "#e5e9ef";
      ctx.stroke();
      ctx.fillStyle = "#1b2632";
      ctx.font = "700 11px system-ui, sans-serif";
      ctx.fillText(state.displayName, px + 60, py + 21);
      ctx.fillStyle = "#8e98a4";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText("You · " + (state.myVideos.length || 0) + " video" + (state.myVideos.length === 1 ? "" : "s") + (state.myAudioOn ? " · Audio on" : " · Audio off"), px + 60, py + 36);

      py += 60;
      ctx.fillStyle = "#f7faff";
      roundedRectPath(ctx, px + 14, py, panelWidth - 28, 45, 10);
      ctx.fill();
      ctx.strokeStyle = "#bfcad6";
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#247cdc";
      ctx.font = "800 18px system-ui, sans-serif";
      ctx.fillText("+", px + 25, py + 27);
      ctx.fillStyle = "#1b2632";
      ctx.font = "700 11px system-ui, sans-serif";
      ctx.fillText("Add fake person", px + 50, py + 20);
      ctx.fillStyle = "#8893a0";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText("Custom name + multiple videos", px + 50, py + 33);

      py += 56;
      state.fakePeople.forEach(function(person) {
        const initials = person.initials || initialsFor(person.name);
        ctx.fillStyle = "hsl(" + person.hue + ",65%,45%)";
        roundedRectPath(ctx, px + 15, py, 32, 32, 9);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, px + 31, py + 16);

        ctx.textAlign = "left";
        ctx.fillStyle = "#1b2632";
        ctx.font = "700 10px system-ui, sans-serif";
        ctx.fillText(person.name, px + 55, py + 12);
        ctx.fillStyle = "#8e98a4";
        ctx.font = "8px system-ui, sans-serif";
        const hostText = person.id === state.hostId ? "Host" : "Participant";
        const mediaText = getVideos(person).length ? (person.cameraVisible === false ? " · Camera hidden" : " · " + getVideos(person).length + " video" + (getVideos(person).length === 1 ? "" : "s")) : " · No camera";
        const audioText = person.audioOn === false ? " · Muted" : "";
        ctx.fillText(hostText + mediaText + audioText, px + 55, py + 25);
        py += 40;
      });
    } else if (state.chatOpen) {
      ctx.fillStyle = "#1b2632";
      ctx.textAlign = "left";
      ctx.font = "700 13px system-ui, sans-serif";
      ctx.fillText("Meeting Chat", px + 16, topBar + 23);
      ctx.fillStyle = "#8c97a3";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("Everyone", px + 16, topBar + 39);

      ctx.fillStyle = "#586779";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("Jamie Lee", px + 16, topBar + 78);
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("Ready when you are.", px + 16, topBar + 96);
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("Sam Rivera", px + 16, topBar + 134);
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("I added the notes to the agenda.", px + 16, topBar + 152);
      ctx.strokeStyle = "#e9edf1";
      ctx.beginPath();
      ctx.moveTo(px, height - bottomBar - 48);
      ctx.lineTo(width, height - bottomBar - 48);
      ctx.stroke();
      ctx.fillStyle = "#fbfcfe";
      ctx.fillRect(px + 12, height - bottomBar - 36, panelWidth - 92, 28);
      ctx.strokeStyle = "#dfe5eb";
      ctx.strokeRect(px + 12, height - bottomBar - 36, panelWidth - 92, 28);
      ctx.fillStyle = "#8c97a3";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText("Type a message...", px + 20, height - bottomBar - 19);
      ctx.fillStyle = "#2d8cff";
      roundedRectPath(ctx, width - 70, height - bottomBar - 36, 52, 28, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 9px system-ui, sans-serif";
      ctx.fillText("Send", width - 58, height - bottomBar - 19);
    }
  }

  // Bottom meeting controls.
  const cy = height - bottomBar;
  ctx.fillStyle = "#18212b";
  ctx.fillRect(0, cy, width, bottomBar);
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(width, cy);
  ctx.stroke();

  const controlItems = [
    {label: state.micOn ? "Mute" : "Unmute", x: 36, icon: state.micOn ? "mic" : "micOff"},
    {label: state.cameraOn ? "Stop Video" : "Start Video", x: 108, icon: state.cameraOn ? "video" : "videoOff"},
    {label: "Fake Camera", x: 184, icon: "video"},
    {label: "Participants " + people.length, x: 274, icon: "users"},
    {label: "Chat", x: 370, icon: "chat"},
    {label: state.shareOn ? "Stop Share" : "Share Screen", x: 442, icon: "share"},
    {label: state.recording ? "Stop Recording" : "Record", x: 552, icon: state.recording ? "stop" : "record"},
    {label: "More", x: 670, icon: "more"}
  ];

  controlItems.forEach(function(item) {
    const selected = item.label.indexOf("Participants") === 0 ? state.participantsOpen : (item.label === "Chat" ? state.chatOpen : false);
    if (selected) {
      ctx.fillStyle = "rgba(255,255,255,.07)";
      roundedRectPath(ctx, item.x - 18, cy + 8, 64, 48, 9);
      ctx.fill();
    }
    if (item.label === "Stop Recording") {
      ctx.fillStyle = "rgba(223,62,72,.12)";
      roundedRectPath(ctx, item.x - 18, cy + 8, 90, 48, 9);
      ctx.fill();
    }
    ctx.fillStyle = item.label === "Stop Video" || item.label === "Unmute" ? "#dce3eb" : "#dce3eb";
    ctx.font = "800 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, item.x + 14, cy + 44);
  });

  // End call.
  ctx.fillStyle = "#df3e48";
  roundedRectPath(ctx, width - 78, cy + 17, 62, 38, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("End", width - 47, cy + 37);

  recordingState.animationFrame = requestAnimationFrame(drawRecordingFrame);
}

async function syncRecordingAudio() {
  if (!recordingState.audioContext || !recordingState.audioDestination) return;

  const currentVideos = Array.from(document.querySelectorAll("video.participant-video[data-person-id]"));
  const currentSet = new Set(currentVideos);

  for (const [video, source] of recordingState.mediaSources.entries()) {
    if (!currentSet.has(video)) {
      try { source.disconnect(); } catch (error) {}
      recordingState.mediaSources.delete(video);
    }
  }

  for (const video of currentVideos) {
    if (recordingState.mediaSources.has(video)) continue;
    try {
      const source = recordingState.audioContext.createMediaElementSource(video);
      source.connect(recordingState.audioDestination);
      recordingState.mediaSources.set(video, source);
    } catch (error) {}
  }

  if (recordingState.audioContext.state === "suspended") {
    try { await recordingState.audioContext.resume(); } catch (error) {}
  }
}

function updateRecordingControls() {
  document.querySelectorAll('[data-action="toggle-recording"]').forEach(function(button) {
    button.classList.toggle("recording-active", state.recording);
    button.innerHTML = icon(state.recording ? "stop" : "record") + '<span>' + (state.recording ? "Stop Recording" : "Record") + '</span>';
  });
}

async function startRecording() {
  if (state.recording || state.page !== "meeting") return;
  const hasMediaRecorder = typeof MediaRecorder !== "undefined";
  if (!hasMediaRecorder) {
    alert("This browser does not support meeting recording.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) {
    alert("Could not create the meeting recording canvas.");
    return;
  }

  recordingState.canvas = canvas;
  recordingState.context = context;
  recordingState.chunks = [];
  recordingState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  recordingState.audioDestination = recordingState.audioContext.createMediaStreamDestination();

  await syncRecordingAudio();
  try { await recordingState.audioContext.resume(); } catch (error) {}

  const canvasStream = canvas.captureStream(30);
  const stream = new MediaStream();
  const videoTrack = canvasStream.getVideoTracks()[0];
  if (videoTrack) stream.addTrack(videoTrack);
  const audioTrack = recordingState.audioDestination.stream.getAudioTracks()[0];
  if (audioTrack) stream.addTrack(audioTrack);

  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  const mimeType = mimeTypes.find(function(type) {
    return MediaRecorder.isTypeSupported(type);
  }) || "";

  try {
    recordingState.recorder = mimeType
      ? new MediaRecorder(stream, { mimeType: mimeType })
      : new MediaRecorder(stream);
  } catch (error) {
    recordingState.recorder = null;
    alert("Could not start meeting recording in this browser.");
    return;
  }

  recordingState.recorder.ondataavailable = function(event) {
    if (event.data && event.data.size) recordingState.chunks.push(event.data);
  };

  recordingState.recorder.onstop = async function() {
    const chunks = recordingState.chunks.slice();
    const sourceType = recordingState.recorder && recordingState.recorder.mimeType || mimeType || "video/webm";
    await finishRecording(chunks, sourceType);
  };

  recordingState.recorder.onerror = function() {
    state.recording = false;
    cancelAnimationFrame(recordingState.animationFrame);
    cleanupRecording();
    updateRecordingControls();
    alert("The meeting recording stopped because the browser reported an error.");
  };

  state.recording = true;
  updateRecordingControls();
  drawRecordingFrame();
  recordingState.recorder.start(1000);
  syncAudioIndicator();
}

async function stopRecording() {
  if (!state.recording || !recordingState.recorder) return;
  state.recording = false;
  updateRecordingControls();
  cancelAnimationFrame(recordingState.animationFrame);
  try {
    recordingState.recorder.stop();
  } catch (error) {
    cleanupRecording();
  }
}

async function finishRecording(chunks, sourceType) {
  const sourceBlob = new Blob(chunks, { type: sourceType || "video/webm" });
  let conversionError = null;

  try {
    const ffmpeg = await getRecordingFFmpeg();

    try { await ffmpeg.deleteFile("meeting.webm"); } catch (error) {}
    try { await ffmpeg.deleteFile("meeting.mp4"); } catch (error) {}

    await ffmpeg.writeFile("meeting.webm", await fetchFile(sourceBlob));

    // First use explicit codecs so the output is a real H.264/AAC MP4.
    try {
      await ffmpeg.exec([
        "-threads", "1",
        "-i", "meeting.webm",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "meeting.mp4"
      ]);
    } catch (firstError) {
      conversionError = firstError;
      // Some FFmpeg builds choose their compiled-in MP4 codecs more reliably
      // when no explicit encoder is forced, so retry with FFmpeg defaults.
      try { await ffmpeg.deleteFile("meeting.mp4"); } catch (error) {}
      await ffmpeg.exec([
        "-threads", "1",
        "-i", "meeting.webm",
        "-movflags", "+faststart",
        "meeting.mp4"
      ]);
    }

    const data = await ffmpeg.readFile("meeting.mp4");
    if (!data || !data.length) throw new Error("FFmpeg produced an empty MP4 file.");

    const mp4Blob = new Blob([data], { type: "video/mp4" });
    const url = URL.createObjectURL(mp4Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zoom-copy-meeting-" + new Date().toISOString().replace(/[:.]/g, "-") + ".mp4";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);

    try { await ffmpeg.deleteFile("meeting.webm"); } catch (error) {}
    try { await ffmpeg.deleteFile("meeting.mp4"); } catch (error) {}
  } catch (error) {
    console.error("Meeting recording conversion failed", error, conversionError);
    const fallbackUrl = URL.createObjectURL(sourceBlob);
    const link = document.createElement("a");
    link.href = fallbackUrl;
    link.download = "zoom-copy-meeting-recording.webm";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function() { URL.revokeObjectURL(fallbackUrl); }, 60000);

    const detail = error && error.message ? " " + error.message : "";
    alert("MP4 conversion failed." + detail + " The WebM recording was saved instead.");
  } finally {
    cleanupRecording();
    updateRecordingControls();
    syncAudioIndicator();
  }
}

async function getRecordingFFmpeg() {
  if (recordingState.ffmpeg) return recordingState.ffmpeg;
  if (recordingState.ffmpegLoading) {
    while (recordingState.ffmpegLoading && !recordingState.ffmpeg) {
      await new Promise(function(resolve) { setTimeout(resolve, 100); });
    }
    if (recordingState.ffmpeg) return recordingState.ffmpeg;
  }

  recordingState.ffmpegLoading = true;
  try {
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", function(event) {
      console.debug("[FFmpeg]", event.message);
    });
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(baseURL + "/ffmpeg-core.js", "text/javascript"),
      wasmURL: await toBlobURL(baseURL + "/ffmpeg-core.wasm", "application/wasm")
    });
    recordingState.ffmpeg = ffmpeg;
    return ffmpeg;
  } finally {
    recordingState.ffmpegLoading = false;
  }
}

function cleanupRecording() {
  if (recordingState.animationFrame) {
    cancelAnimationFrame(recordingState.animationFrame);
    recordingState.animationFrame = 0;
  }
  if (recordingState.recorder && recordingState.recorder.state !== "inactive") {
    try { recordingState.recorder.stop(); } catch (error) {}
  }
  recordingState.mediaSources.forEach(function(source) {
    try { source.disconnect(); } catch (error) {}
  });
  recordingState.mediaSources.clear();
  if (recordingState.audioContext) {
    try { recordingState.audioContext.close(); } catch (error) {}
  }
  recordingState.recorder = null;
  recordingState.audioContext = null;
  recordingState.audioDestination = null;
  recordingState.canvas = null;
  recordingState.context = null;
  recordingState.chunks = [];
}

function syncAudioIndicator() {
  const playing = Array.from(document.querySelectorAll("video.participant-video")).some(function(video) {
    return state.audioEnabled && !video.muted && !video.paused && !video.ended && Number.isFinite(video.currentTime);
  });
  state.audioPlaying = playing;
  document.querySelectorAll('[data-action="toggle-participants"]').forEach(function(button) {
    button.classList.toggle("audio-playing", playing);
  });
}

function bind() {
  document.querySelectorAll("[data-page]").forEach(function(el){
    el.addEventListener("click", function(){ state.page = el.dataset.page; render(); });
  });
  document.querySelectorAll("[data-action]").forEach(function(el){
    el.addEventListener("click", function(){
      const a = el.dataset.action;
      if (a === "toggle-mic") state.micOn = !state.micOn;
      if (a === "toggle-camera") {
        state.cameraOn = !state.cameraOn;
        state.cameraHidden.me = !state.cameraOn;
        updateParticipantTile("me");
        updateParticipantsListOnly();
        if (state.recording) syncRecordingAudio();
        return;
      }
      if (a === "toggle-participants") state.participantsOpen = !state.participantsOpen;
      if (a === "toggle-chat") state.chatOpen = !state.chatOpen;
      if (a === "toggle-share") state.shareOn = !state.shareOn;
      if (a === "toggle-recording") {
        if (state.recording) {
          stopRecording();
        } else {
          startRecording();
        }
        return;
      }
      if (a === "toggle-audio") {
        state.audioEnabled = !state.audioEnabled;
        document.querySelectorAll("video.participant-video").forEach(function(v) {
          const person = getParticipant(v.dataset.personId);
          v.muted = !state.audioEnabled || !isPersonAudioOn(person);
          v.volume = 1;
          if (!v.muted) v.play().catch(function(){});
        });
        render();
        if (state.recording) syncRecordingAudio();
        return;
      }
      if (a === "add-person") { openAddPerson(); return; }
      if (a === "edit-person") { openParticipantEditor(el.dataset.personId); return; }
      if (a === "leave-person") { leavePerson(el.dataset.personId); return; }
      if (a === "add-video") { openFakeCameraPicker(); return; }
      if (a === "toggle-person-audio") {
        const personId = el.dataset.personId;
        setAudioForPerson(personId, !isPersonAudioOn(getParticipant(personId)));
        return;
      }
      if (a === "contacts") { alert("Contacts is a demo placeholder."); return; }
      render();
    });
  });
  document.querySelectorAll("video.participant-video").forEach(function(v) {
    wireParticipantVideo(v);
  });
  syncAudioIndicator();
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
    return;
  }

  const nextPersonId = Object.keys(state.nextKeybinds).find(function(id) {
    return state.nextKeybinds[id] === key;
  });
  if (nextPersonId) {
    e.preventDefault();
    advancePersonVideo(nextPersonId);
    return;
  }

  const leavePersonId = Object.keys(state.leaveKeybinds).find(function(id) {
    return state.leaveKeybinds[id] === key;
  });
  if (leavePersonId) {
    e.preventDefault();
    leavePerson(leavePersonId);
    return;
  }

  const audioPersonId = Object.keys(state.audioKeybinds).find(function(id) {
    return state.audioKeybinds[id] === key;
  });
  if (audioPersonId) {
    e.preventDefault();
    setAudioForPerson(audioPersonId, !isPersonAudioOn(getParticipant(audioPersonId)));
  }
});

normalizeHosts();
render();
