import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { Peer } from "peerjs";

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

function generateMeetingId() {
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

function normalizeMeetingId(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 9);
}

function formatMeetingId(value) {
  const digits = normalizeMeetingId(value);
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ");
}

const state = {
  page: "home",
  meetingStarted: false,
  meetingId: generateMeetingId(),
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
  pauseKeybinds: {},
  restartKeybinds: {},
  pauseAllKeybind: "p",
  clipPaused: {},
  leaveHistory: [],
  myAudioOn: true,
  audioEnabled: true,
  audioPlaying: false,
  recording: false,
  recordingBusy: false,
  recordingProgress: 0,
  recordingNumber: 0,
  recordingElapsedMs: 0,
  myParticipantHidden: false,
  myAvatarUrl: null,
  participantSearch: "",
  participantOptionsOpen: false,
  roomMode: "local",
  remoteMeetingId: "",
  savedMeetings: [],
  savedMeetingsLoading: true
};

const TUTORIAL_STORAGE_KEY = "zoom-copy-tutorial-complete";

function hasCompletedTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function markTutorialComplete() {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
  } catch (error) {}
}

function openTutorial(markCompleteOnClose) {
  const existing = document.querySelector(".tutorial-backdrop");
  if (existing) existing.remove();

  const steps = [
    {
      eyebrow: "Welcome to Zoom Copy",
      title: "A meeting sandbox",
      body: "Use this site to build a realistic meeting, test participant controls, load local video clips, and try the call interface without needing a real webcam or meeting service.",
      icon: "video"
    },
    {
      eyebrow: "Meetings",
      title: "Start with your meeting",
      body: "The Home screen is your launch point. Start or join the demo meeting, then use Participants to manage people, cameras, audio, video playlists, and keybinds.",
      icon: "users"
    },
    {
      eyebrow: "Video tools",
      title: "Turn videos into camera feeds",
      body: "Add one or more video files to yourself or a fake participant. Next follows the playlist order, which you can change with ↑ and ↓. Each clip can also be paused, restarted, or deleted.",
      icon: "play"
    },
    {
      eyebrow: "You are ready",
      title: "Explore the controls",
      body: "Use Settings for preferences, the meeting controls for camera, audio, sharing, and recording, and the Participants Options menu for global video controls.",
      icon: "settings"
    }
  ];

  let stepIndex = 0;
  const modal = document.createElement("div");
  modal.className = "tutorial-backdrop";
  modal.innerHTML =
    '<div class="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">' +
      '<button type="button" class="tutorial-close" aria-label="Close tutorial">×</button>' +
      '<div class="tutorial-progress"><div class="tutorial-progress-bar"></div></div>' +
      '<div class="tutorial-icon" id="tutorial-icon"></div>' +
      '<span class="eyebrow" id="tutorial-eyebrow"></span>' +
      '<h2 id="tutorial-title"></h2>' +
      '<p class="tutorial-body" id="tutorial-body"></p>' +
      '<div class="tutorial-dots" id="tutorial-dots"></div>' +
      '<div class="tutorial-actions"><button type="button" class="secondary tutorial-skip">Skip</button><span></span><button type="button" class="primary tutorial-next">Next</button></div>' +
    '</div>';

  document.body.appendChild(modal);

  const iconSlot = modal.querySelector("#tutorial-icon");
  const eyebrow = modal.querySelector("#tutorial-eyebrow");
  const title = modal.querySelector("#tutorial-title");
  const body = modal.querySelector("#tutorial-body");
  const dots = modal.querySelector("#tutorial-dots");
  const progressBar = modal.querySelector(".tutorial-progress-bar");
  const nextButton = modal.querySelector(".tutorial-next");

  function closeTutorial(completed) {
    if (completed || markCompleteOnClose) markTutorialComplete();
    modal.remove();
  }

  function renderTutorialStep() {
    const step = steps[stepIndex];
    iconSlot.innerHTML = icon(step.icon);
    eyebrow.textContent = step.eyebrow;
    title.textContent = step.title;
    body.textContent = step.body;
    progressBar.style.width = (((stepIndex + 1) / steps.length) * 100) + "%";
    dots.innerHTML = steps.map(function(_, index) {
      return '<button type="button" class="tutorial-dot ' + (index === stepIndex ? "active" : "") + '" data-tutorial-step="' + index + '" aria-label="Go to tutorial step ' + (index + 1) + '"></button>';
    }).join("");
    nextButton.textContent = stepIndex === steps.length - 1 ? "Get started" : "Next";

    modal.querySelectorAll("[data-tutorial-step]").forEach(function(dot) {
      dot.addEventListener("click", function() {
        stepIndex = Number(dot.dataset.tutorialStep) || 0;
        renderTutorialStep();
      });
    });
  }

  modal.querySelector(".tutorial-close").addEventListener("click", function() {
    closeTutorial(false);
  });
  modal.querySelector(".tutorial-skip").addEventListener("click", function() {
    closeTutorial(true);
  });
  nextButton.addEventListener("click", function() {
    if (stepIndex === steps.length - 1) {
      closeTutorial(true);
      return;
    }
    stepIndex += 1;
    renderTutorialStep();
  });
  modal.addEventListener("click", function(event) {
    if (event.target === modal) closeTutorial(true);
  });
  document.addEventListener("keydown", function handleTutorialEscape(event) {
    if (!document.body.contains(modal)) {
      document.removeEventListener("keydown", handleTutorialEscape);
      return;
    }
    if (event.key === "Escape") closeTutorial(true);
  });

  renderTutorialStep();
}

function showFirstTimeTutorial() {
  if (!hasCompletedTutorial()) openTutorial(true);
}

const recordingAvatarImages = new Map();

const MEETING_DB_NAME = "zoom-copy-meeting-storage";
const MEETING_DB_VERSION = 2;
const MEETING_RECORD_ID = "active";
let meetingDbPromise = null;
let meetingSaveTimer = 0;
let meetingSaveInProgress = false;
let meetingSaveQueued = false;
let restoringMeeting = false;
const meetingAssetBlobCache = new Map();

function openMeetingDb() {
  if (meetingDbPromise) return meetingDbPromise;

  if (!window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }

  meetingDbPromise = new Promise(function(resolve, reject) {
    const request = window.indexedDB.open(MEETING_DB_NAME, MEETING_DB_VERSION);

    request.onupgradeneeded = function() {
      const db = request.result;
      if (!db.objectStoreNames.contains("meetings")) {
        db.createObjectStore("meetings", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("savedMeetings")) {
        db.createObjectStore("savedMeetings", { keyPath: "id" });
      }
    };

    request.onsuccess = function() {
      const db = request.result;
      db.onversionchange = function() {
        db.close();
      };
      resolve(db);
    };

    request.onerror = function() {
      reject(request.error || new Error("Could not open meeting storage."));
    };
  });

  return meetingDbPromise;
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function capturePersistentPlaybackState() {
  const playback = {};
  document.querySelectorAll("video.participant-video[data-person-id]").forEach(function(video) {
    const personId = video.dataset.personId;
    const paused = Boolean(video.paused || state.clipPaused[personId]);
    state.clipPaused[personId] = paused;
    playback[personId] = {
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      wasPaused: paused
    };
  });
  return playback;
}

async function getMeetingAssetBlob(url) {
  if (!url || !String(url).startsWith("blob:")) return null;
  if (meetingAssetBlobCache.has(url)) return meetingAssetBlobCache.get(url);

  const promise = fetch(url).then(function(response) {
    if (!response.ok) throw new Error("Could not read local meeting media.");
    return response.blob();
  });

  meetingAssetBlobCache.set(url, promise);
  try {
    return await promise;
  } catch (error) {
    meetingAssetBlobCache.delete(url);
    throw error;
  }
}

async function persistVideoList(videos, ownerId, assets) {
  const list = Array.isArray(videos) ? videos : [];

  return Promise.all(list.map(async function(item, index) {
    const source = item || {};
    const saved = {
      name: source.name || ("Video " + (index + 1))
    };

    if (source.url && String(source.url).startsWith("blob:")) {
      const assetId = ownerId + ":video:" + index;
      const blob = await getMeetingAssetBlob(source.url);
      assets.set(assetId, blob);
      saved.assetId = assetId;
      saved.type = blob.type || "";
    } else if (source.url) {
      saved.url = source.url;
    }

    return saved;
  }));
}

async function buildSavedMeetingState() {
  const assets = new Map();

  const saved = {
    version: 1,
    meetingId: state.meetingId,
    micOn: state.micOn,
    cameraOn: state.cameraOn,
    shareOn: state.shareOn,
    participantsOpen: state.participantsOpen,
    chatOpen: state.chatOpen,
    displayName: state.displayName,
    hostId: state.hostId,
    myVideoIndex: state.myVideoIndex,
    myAutoPlayNext: state.myAutoPlayNext,
    myAutoCameraOff: state.myAutoCameraOff,
    cameraHidden: cloneValue(state.cameraHidden) || {},
    keybinds: cloneValue(state.keybinds) || {},
    nextKeybinds: cloneValue(state.nextKeybinds) || {},
    audioKeybinds: cloneValue(state.audioKeybinds) || {},
    leaveKeybinds: cloneValue(state.leaveKeybinds) || {},
    pauseKeybinds: cloneValue(state.pauseKeybinds) || {},
    restartKeybinds: cloneValue(state.restartKeybinds) || {},
    pauseAllKeybind: state.pauseAllKeybind || "p",
    clipPaused: cloneValue(state.clipPaused) || {},
    myAudioOn: state.myAudioOn,
    audioEnabled: state.audioEnabled,
    recordingNumber: state.recordingNumber,
    myParticipantHidden: state.myParticipantHidden,
    participantSearch: state.participantSearch || "",
    playback: capturePersistentPlaybackState(),
    fakePeople: [],
    myVideos: []
  };

  saved.myVideos = await persistVideoList(state.myVideos || [], "me", assets);

  if (state.myAvatarUrl && String(state.myAvatarUrl).startsWith("blob:")) {
    const avatarBlob = await getMeetingAssetBlob(state.myAvatarUrl);
    assets.set("me:avatar", avatarBlob);
    saved.myAvatarAssetId = "me:avatar";
  }

  for (const person of state.fakePeople) {
    const copy = Object.assign({}, cloneValue(person));
    copy.videos = await persistVideoList(person.videos || [], person.id, assets);

    if (person.avatarUrl && String(person.avatarUrl).startsWith("blob:")) {
      const avatarBlob = await getMeetingAssetBlob(person.avatarUrl);
      const avatarAssetId = person.id + ":avatar";
      assets.set(avatarAssetId, avatarBlob);
      copy.avatarAssetId = avatarAssetId;
      copy.avatarUrl = null;
    }

    saved.fakePeople.push(copy);
  }

  return {
    record: {
      id: MEETING_RECORD_ID,
      version: 1,
      savedAt: Date.now(),
      state: saved,
      assets: Array.from(assets.entries()).map(function(entry) {
        return {
          id: entry[0],
          blob: entry[1],
          type: entry[1] && entry[1].type || ""
        };
      })
    }
  };
}

function putMeetingRecord(record) {
  return openMeetingDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction("meetings", "readwrite");
      tx.objectStore("meetings").put(record);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error || new Error("Could not save the meeting.")); };
      tx.onabort = function() { reject(tx.error || new Error("Meeting save was aborted.")); };
    });
  });
}

async function putSavedMeetingRecord(record) {
  return openMeetingDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction("savedMeetings", "readwrite");
      tx.objectStore("savedMeetings").put(record);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error || new Error("Could not save the meeting to the library.")); };
      tx.onabort = function() { reject(tx.error || new Error("Meeting library save was aborted.")); };
    });
  });
}

function getSavedMeetingRecords() {
  return openMeetingDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction("savedMeetings", "readonly");
      const request = tx.objectStore("savedMeetings").getAll();
      request.onsuccess = function() {
        resolve(Array.isArray(request.result) ? request.result : []);
      };
      request.onerror = function() {
        reject(request.error || new Error("Could not load saved meetings."));
      };
    });
  });
}

function getSavedMeetingRecord(meetingId) {
  return openMeetingDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction("savedMeetings", "readonly");
      const request = tx.objectStore("savedMeetings").get(String(meetingId));
      request.onsuccess = function() { resolve(request.result || null); };
      request.onerror = function() {
        reject(request.error || new Error("Could not open the saved meeting."));
      };
    });
  });
}

function savedMeetingPreview(record) {
  const saved = record && record.state ? record.state : {};
  const people = Array.isArray(saved.fakePeople) ? saved.fakePeople : [];
  const myVideos = Array.isArray(saved.myVideos) ? saved.myVideos : [];
  const fakeVideoCount = people.reduce(function(total, person) {
    return total + (Array.isArray(person.videos) ? person.videos.length : 0);
  }, 0);
  return {
    id: String(saved.meetingId || record.id || ""),
    savedAt: Number(record.savedAt || Date.now()),
    participants: people.length + 1,
    videos: myVideos.length + fakeVideoCount
  };
}

function rememberSavedMeeting(record) {
  const preview = savedMeetingPreview(record);
  if (!preview.id) return;

  const existing = state.savedMeetings.findIndex(function(item) {
    return item.id === preview.id;
  });
  if (existing >= 0) state.savedMeetings.splice(existing, 1);
  state.savedMeetings.push(preview);
  state.savedMeetings.sort(function(a, b) { return b.savedAt - a.savedAt; });
}

async function loadSavedMeetingLibrary() {
  try {
    const records = await getSavedMeetingRecords();
    state.savedMeetings = records
      .map(savedMeetingPreview)
      .filter(function(item) { return Boolean(item.id); })
      .sort(function(a, b) { return b.savedAt - a.savedAt; });
  } catch (error) {
    console.warn("Saved meeting library could not be loaded.", error);
    state.savedMeetings = [];
  } finally {
    state.savedMeetingsLoading = false;
  }
}

async function openSavedMeeting(meetingId) {
  try {
    const record = await getSavedMeetingRecord(meetingId);
    if (!record || !record.state) {
      alert("That saved meeting could not be found.");
      return false;
    }

    destroyRoomConnection();
    revokeVideos(state.myVideos || []);
    (state.fakePeople || []).forEach(function(person) {
      revokeVideos(person.videos || []);
      revokeBlob(person.avatarUrl);
    });
    revokeBlob(state.myAvatarUrl);

    restoringMeeting = true;
    try {
      restoreMeetingRecord(record);
    } finally {
      restoringMeeting = false;
    }

    state.page = "meeting";
    state.meetingStarted = true;
    state.roomMode = "local";
    state.remoteMeetingId = "";
    state.participantOptionsOpen = false;
    render();
    restorePersistedPlayback();
    startHostRoom();
    rememberSavedMeeting(record);
    return true;
  } catch (error) {
    console.error("Could not open saved meeting.", error);
    alert("The saved meeting could not be opened. Please try again.");
    return false;
  }
}

function saveMeetingState() {
  if (restoringMeeting || !state.meetingStarted) return;
  if (meetingSaveInProgress) {
    meetingSaveQueued = true;
    return;
  }

  meetingSaveInProgress = true;
  try {
    const built = await buildSavedMeetingState();
    const libraryRecord = Object.assign({}, built.record, {
      id: built.record.state.meetingId
    });
    await Promise.all([
      putMeetingRecord(built.record),
      putSavedMeetingRecord(libraryRecord)
    ]);
    rememberSavedMeeting(libraryRecord);

    if (navigator.storage && navigator.storage.persist) {
      try { await navigator.storage.persist(); } catch (error) {}
    }
  } catch (error) {
    console.warn("Could not save the meeting locally.", error);
  } finally {
    meetingSaveInProgress = false;
    if (meetingSaveQueued) {
      meetingSaveQueued = false;
      queueMeetingSave(250);
    }
  }
}

function queueMeetingSave(delay) {
  if (restoringMeeting) return;
  if (meetingSaveTimer) clearTimeout(meetingSaveTimer);

  meetingSaveTimer = setTimeout(function() {
    meetingSaveTimer = 0;
    saveMeetingState();
  }, delay == null ? 350 : Math.max(0, delay));
}

function getMeetingRecord() {
  return openMeetingDb().then(function(db) {
    return new Promise(function(resolve, reject) {
      const tx = db.transaction("meetings", "readonly");
      const request = tx.objectStore("meetings").get(MEETING_RECORD_ID);
      request.onsuccess = function() { resolve(request.result || null); };
      request.onerror = function() { reject(request.error || new Error("Could not load the saved meeting.")); };
    });
  });
}

function loadAssetUrls(record) {
  const urls = {};
  (record.assets || []).forEach(function(asset) {
    if (!asset || !asset.id || !asset.blob) return;
    try {
      urls[asset.id] = URL.createObjectURL(asset.blob);
    } catch (error) {
      console.warn("Could not restore meeting media.", error);
    }
  });
  return urls;
}

function restoreVideoAssets(videos, assetUrls) {
  return (Array.isArray(videos) ? videos : []).map(function(item) {
    const copy = Object.assign({}, item);
    if (copy.assetId) {
      copy.url = assetUrls[copy.assetId] || null;
      delete copy.assetId;
      delete copy.type;
    }
    return copy;
  }).filter(function(item) {
    return Boolean(item.url);
  });
}

function restoreMeetingRecord(record) {
  if (!record || !record.state) return false;

  const saved = record.state;
  const assetUrls = loadAssetUrls(record);

  state.meetingId = saved.meetingId || state.meetingId;
  state.micOn = saved.micOn !== false;
  state.cameraOn = saved.cameraOn !== false;
  state.shareOn = saved.shareOn === true;
  state.participantsOpen = saved.participantsOpen !== false;
  state.chatOpen = saved.chatOpen === true;
  state.displayName = saved.displayName || "Me";
  state.hostId = saved.hostId || null;
  state.myVideoIndex = Number(saved.myVideoIndex) || 0;
  state.myAutoPlayNext = saved.myAutoPlayNext === true;
  state.myAutoCameraOff = saved.myAutoCameraOff !== false;
  state.cameraHidden = saved.cameraHidden || {};
  state.keybinds = saved.keybinds && typeof saved.keybinds === "object" ? saved.keybinds : {};
  state.nextKeybinds = saved.nextKeybinds && typeof saved.nextKeybinds === "object" ? saved.nextKeybinds : {};
  state.audioKeybinds = saved.audioKeybinds && typeof saved.audioKeybinds === "object" ? saved.audioKeybinds : {};
  state.leaveKeybinds = saved.leaveKeybinds && typeof saved.leaveKeybinds === "object" ? saved.leaveKeybinds : {};
  state.pauseKeybinds = saved.pauseKeybinds && typeof saved.pauseKeybinds === "object" ? saved.pauseKeybinds : {};
  state.restartKeybinds = saved.restartKeybinds && typeof saved.restartKeybinds === "object" ? saved.restartKeybinds : {};
  state.pauseAllKeybind = typeof saved.pauseAllKeybind === "string" ? saved.pauseAllKeybind : "p";
  state.clipPaused = saved.clipPaused && typeof saved.clipPaused === "object" ? saved.clipPaused : {};
  state.myAudioOn = saved.myAudioOn !== false;
  state.audioEnabled = saved.audioEnabled !== false;
  state.recordingNumber = Number(saved.recordingNumber) || 0;
  state.myParticipantHidden = saved.myParticipantHidden === true;
  state.participantSearch = saved.participantSearch || "";

  state.myVideos = restoreVideoAssets(saved.myVideos, assetUrls);

  if (saved.myAvatarAssetId) {
    state.myAvatarUrl = assetUrls[saved.myAvatarAssetId] || null;
  } else {
    state.myAvatarUrl = saved.myAvatarUrl || null;
  }

  state.fakePeople = (Array.isArray(saved.fakePeople) ? saved.fakePeople : []).map(function(person) {
    const copy = Object.assign({}, person);
    copy.videos = restoreVideoAssets(person.videos, assetUrls);
    if (person.avatarAssetId) {
      copy.avatarUrl = assetUrls[person.avatarAssetId] || null;
    } else if (!copy.avatarUrl) {
      copy.avatarUrl = null;
    }
    delete copy.avatarAssetId;
    return copy;
  });

  state.leaveHistory = [];
  state.recording = false;
  state.recordingBusy = false;
  state.recordingProgress = 0;
  state.recordingElapsedMs = 0;

  normalizeHosts();

  state.page = "meeting";
  state.meetingStarted = true;
  state._savedPlayback = saved.playback || {};
  return true;
}

async function restoreSavedMeeting() {
  restoringMeeting = true;
  try {
    const record = await getMeetingRecord();
    return restoreMeetingRecord(record);
  } catch (error) {
    console.warn("Saved meeting could not be restored.", error);
    return false;
  } finally {
    restoringMeeting = false;
  }
}

function restorePersistedPlayback() {
  const snapshot = state._savedPlayback || {};
  delete state._savedPlayback;

  Object.keys(snapshot || {}).forEach(function(personId) {
    const saved = snapshot[personId];
    const video = document.querySelector('video.participant-video[data-person-id="' + personId + '"]');
    if (!video || !saved) return;

    const restore = function() {
      state.clipPaused[personId] = saved.wasPaused === true;
      try {
        if (Number.isFinite(saved.currentTime) && saved.currentTime > 0) {
          video.currentTime = Math.min(saved.currentTime, Math.max(0, (video.duration || saved.currentTime) - 0.05));
        }
      } catch (error) {}

      if (!saved.wasPaused) {
        video.play().catch(function(){});
      } else {
        video.pause();
      }
      updateClipControlLabels(personId);
    };

    if (video.readyState >= 1) restore();
    else video.addEventListener("loadedmetadata", restore, { once: true });
  });
}



const recordingState = {
  recorder: null,
  chunks: [],
  canvas: null,
  context: null,
  animationFrame: 0,
  audioContext: null,
  audioDestination: null,
  mediaSources: new Map(),
  leaveAudio: null,
  leaveSource: null,
  leaveGain: null,
  ffmpeg: null,
  ffmpegLoading: false,
  recordingProgress: 0,
  sourceStream: null,
  startedAt: 0,
  timer: 0
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
  restart: '<path d="M4 7v5h5"/><path d="M20 17v-5h-5"/><path d="M5.4 12a7 7 0 0 1 11.7-5L20 10"/><path d="M18.6 12a7 7 0 0 1-11.7 5L4 14"/>',
  pause: '<rect x="7" y="5" width="3" height="14" rx="1"/><rect x="14" y="5" width="3" height="14" rx="1"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
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
  const hostIsMe = state.hostId === "me";

  if (!hostIsMe && !state.fakePeople.length) {
    state.hostId = null;
  } else if (!hostIsMe) {
    const currentHost = state.fakePeople.find(function(p) { return p.id === state.hostId; });
    if (!currentHost) state.hostId = state.fakePeople[0].id;
  }

  state.fakePeople.forEach(function(p) {
    p.role = p.id === state.hostId ? "Host" : "";
  });
}

function makeHost(personId) {
  if (personId === "me") {
    state.hostId = "me";
  } else {
    const person = state.fakePeople.find(function(p) { return p.id === personId; });
    if (!person) return false;
    state.hostId = personId;
  }

  normalizeHosts();
  updateParticipantsListOnly();
  render();
  queueMeetingSave();
  return true;
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
    state.clipPaused[personId] = false;
    if (wasVisible) {
      state.cameraHidden.me = false;
      state.cameraOn = true;
    }
    state.needsNextOnCamera = false;
  } else {
    const target = state.fakePeople.find(function(p) { return p.id === personId; });
    if (!target) return false;
    target.currentVideoIndex = ((target.currentVideoIndex || 0) + 1) % target.videos.length;
    state.clipPaused[personId] = false;
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
  queueMeetingSave();
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

  state.clipPaused[personId] = true;
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
  queueMeetingSave();
}

function setPersonKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.keybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized) || normalized === "0") return;
  Object.keys(state.keybinds || {}).forEach(function(id) {
    if (id !== personId && state.keybinds[id] === normalized) delete state.keybinds[id];
  });
  state.keybinds[personId] = normalized;
}

function setNextKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.nextKeybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized) || normalized === "0") return;
  Object.keys(state.nextKeybinds || {}).forEach(function(id) {
    if (id !== personId && state.nextKeybinds[id] === normalized) delete state.nextKeybinds[id];
  });
  state.nextKeybinds[personId] = normalized;
}

function setLeaveKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.leaveKeybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized) || normalized === "0") return;
  Object.keys(state.leaveKeybinds || {}).forEach(function(id) {
    if (id !== personId && state.leaveKeybinds[id] === normalized) delete state.leaveKeybinds[id];
  });
  state.leaveKeybinds[personId] = normalized;
}

function setPauseKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.pauseKeybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized) || normalized === "0") return;
  Object.keys(state.pauseKeybinds || {}).forEach(function(id) {
    if (id !== personId && state.pauseKeybinds[id] === normalized) delete state.pauseKeybinds[id];
  });
  state.pauseKeybinds[personId] = normalized;
}

function setRestartKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.restartKeybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized) || normalized === "0") return;
  Object.keys(state.restartKeybinds || {}).forEach(function(id) {
    if (id !== personId && state.restartKeybinds[id] === normalized) delete state.restartKeybinds[id];
  });
  state.restartKeybinds[personId] = normalized;
}

function setPauseAllKeybind(key) {
  const normalized = String(key || "").trim().toLowerCase();
  state.pauseAllKeybind = /^[a-z0-9]$/i.test(normalized) && normalized !== "0" ? normalized : "";
}

const leaveSound = new Audio("./FaceTime%20End%20Call%20Sound%20Effect.mp3");
leaveSound.preload = "auto";
leaveSound.volume = 0.74;

function setupRecordingLeaveSound() {
  if (!recordingState.audioContext || !recordingState.audioDestination || recordingState.leaveAudio) return;

  try {
    const audio = new Audio("./FaceTime%20End%20Call%20Sound%20Effect.mp3");
    audio.preload = "auto";
    audio.volume = 0.74;

    const source = recordingState.audioContext.createMediaElementSource(audio);
    const gain = recordingState.audioContext.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(recordingState.audioDestination);
    gain.connect(recordingState.audioContext.destination);

    recordingState.leaveAudio = audio;
    recordingState.leaveSource = source;
    recordingState.leaveGain = gain;
  } catch (error) {
    console.warn("Could not attach the leave sound to the recording.", error);
  }
}

function playLeaveSound() {
  const audio = state.recording && recordingState.leaveAudio ? recordingState.leaveAudio : leaveSound;

  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (error) {}

  audio.play().catch(function() {});
}

function leaveMeetingAsMe() {
  if (state.myParticipantHidden) return false;

  state.leaveHistory.push({
    type: "me",
    displayName: state.displayName,
    myVideos: state.myVideos,
    myVideoIndex: state.myVideoIndex,
    myAutoPlayNext: state.myAutoPlayNext,
    myAutoCameraOff: state.myAutoCameraOff,
    myAudioOn: state.myAudioOn,
    myParticipantHidden: state.myParticipantHidden,
    cameraHiddenMe: state.cameraHidden.me,
    cameraOn: state.cameraOn,
    needsNextOnCamera: state.needsNextOnCamera,
    myAvatarUrl: state.myAvatarUrl,
    keybinds: {
      camera: state.keybinds.me || "",
      next: state.nextKeybinds.me || "",
      audio: state.audioKeybinds.me || "",
      leave: state.leaveKeybinds.me || "",
      pause: state.pauseKeybinds.me || "",
      restart: state.restartKeybinds.me || ""
    }
  });
  if (state.leaveHistory.length > 50) state.leaveHistory.shift();

  playLeaveSound();
  state.myParticipantHidden = true;

  const tile = document.querySelector('.participant-tile[data-person-id="me"]');
  if (tile) tile.remove();

  updateParticipantsListOnly();
  syncAudioIndicator();
  if (state.recording) syncRecordingAudio();
  queueMeetingSave();
  return true;
}

function leavePerson(personId) {
  if (personId === "me") return leaveMeetingAsMe();

  const index = state.fakePeople.findIndex(function(p) { return p.id === personId; });
  if (index < 0) return false;

  playLeaveSound();

  const person = state.fakePeople[index];
  state.leaveHistory.push({
    type: "fake",
    person: person,
    hostIdBeforeLeave: state.hostId,
    keybinds: {
      camera: state.keybinds[personId] || "",
      next: state.nextKeybinds[personId] || "",
      audio: state.audioKeybinds[personId] || "",
      leave: state.leaveKeybinds[personId] || "",
      pause: state.pauseKeybinds[personId] || "",
      restart: state.restartKeybinds[personId] || ""
    }
  });
  if (state.leaveHistory.length > 50) state.leaveHistory.shift();

  // Keep the participant's local blob URLs alive so undo can restore the
  // exact same videos/profile picture.
  state.fakePeople.splice(index, 1);
  delete state.keybinds[personId];
  delete state.nextKeybinds[personId];
  delete state.audioKeybinds[personId];
  delete state.leaveKeybinds[personId];
  delete state.pauseKeybinds[personId];
  delete state.restartKeybinds[personId];
  delete state.clipPaused[personId];
  normalizeHosts();

  const tile = document.querySelector('.participant-tile[data-person-id="' + personId + '"]');
  if (tile) tile.remove();

  updateParticipantsListOnly();
  syncAudioIndicator();
  if (state.recording) syncRecordingAudio();
  queueMeetingSave();
  return true;
}

function undoLastLeave() {
  const snapshot = state.leaveHistory.pop();
  if (!snapshot) return false;

  if (snapshot.type === "me") {
    state.displayName = snapshot.displayName;
    state.myVideos = snapshot.myVideos || [];
    state.myVideoIndex = snapshot.myVideoIndex || 0;
    state.myAutoPlayNext = snapshot.myAutoPlayNext;
    state.myAutoCameraOff = snapshot.myAutoCameraOff;
    state.myAudioOn = snapshot.myAudioOn;
    state.myParticipantHidden = snapshot.myParticipantHidden;
    state.cameraHidden.me = snapshot.cameraHiddenMe;
    state.cameraOn = snapshot.cameraOn;
    state.needsNextOnCamera = snapshot.needsNextOnCamera;
    state.myAvatarUrl = snapshot.myAvatarUrl;

    setPersonKeybind("me", snapshot.keybinds.camera);
    setNextKeybind("me", snapshot.keybinds.next);
    setAudioKeybind("me", snapshot.keybinds.audio);
    setLeaveKeybind("me", snapshot.keybinds.leave);
    setPauseKeybind("me", snapshot.keybinds.pause);
    setRestartKeybind("me", snapshot.keybinds.restart);
  } else if (snapshot.type === "fake" && snapshot.person) {
    if (!state.fakePeople.some(function(p) { return p.id === snapshot.person.id; })) {
      state.fakePeople.push(snapshot.person);
    }

    if (state.fakePeople.some(function(p) { return p.id === snapshot.person.id; })) {
      setPersonKeybind(snapshot.person.id, snapshot.keybinds.camera);
      setNextKeybind(snapshot.person.id, snapshot.keybinds.next);
      setAudioKeybind(snapshot.person.id, snapshot.keybinds.audio);
      setLeaveKeybind(snapshot.person.id, snapshot.keybinds.leave);
      setPauseKeybind(snapshot.person.id, snapshot.keybinds.pause);
      setRestartKeybind(snapshot.person.id, snapshot.keybinds.restart);
    }

    if (snapshot.hostIdBeforeLeave === snapshot.person.id) {
      state.hostId = snapshot.person.id;
    }
    normalizeHosts();
  }

  render();
  if (state.recording) syncRecordingAudio();
  return true;
}

function joinBackParticipant(personId) {
  if (personId === "me") {
    // Your participant data remains in state after leaving. Joining back only
    // needs to make the existing participant visible again, so it also works
    // after a tab reload where leaveHistory is intentionally not persisted.
    state.myParticipantHidden = false;
    if (!state.cameraHidden) state.cameraHidden = {};
    normalizeHosts();

    render();
    if (state.recording) syncRecordingAudio();
    queueMeetingSave();
    return true;
  }

  let snapshotIndex = -1;

  for (let i = state.leaveHistory.length - 1; i >= 0; i -= 1) {
    if (state.leaveHistory[i] && state.leaveHistory[i].type === "fake") {
      if (state.leaveHistory[i].person?.id === personId) {
        snapshotIndex = i;
        break;
      }
    }
  }

  if (snapshotIndex < 0) return false;

  const snapshot = state.leaveHistory.splice(snapshotIndex, 1)[0];
  const person = snapshot.person;
  if (!person) return false;

  if (!state.fakePeople.some(function(p) { return p.id === person.id; })) {
    state.fakePeople.push(person);
  }

  setPersonKeybind(person.id, snapshot.keybinds?.camera);
  setNextKeybind(person.id, snapshot.keybinds?.next);
  setAudioKeybind(person.id, snapshot.keybinds?.audio);
  setLeaveKeybind(person.id, snapshot.keybinds?.leave);
  setPauseKeybind(person.id, snapshot.keybinds?.pause);
  setRestartKeybind(person.id, snapshot.keybinds?.restart);

  if (snapshot.hostIdBeforeLeave === person.id) {
    state.hostId = person.id;
  }
  normalizeHosts();

  render();
  if (state.recording) syncRecordingAudio();
  queueMeetingSave();
  return true;
}
function setAudioKeybind(personId, key) {
  const normalized = String(key || "").trim().toLowerCase();
  delete state.audioKeybinds[personId];
  if (!/^[a-z0-9]$/i.test(normalized) || normalized === "0") return;
  Object.keys(state.audioKeybinds || {}).forEach(function(id) {
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
  queueMeetingSave();
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
  queueMeetingSave();

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

let roomPeer = null;
let roomStream = null;
let roomCanvas = null;
let roomCanvasContext = null;
let roomDrawTimer = 0;
let roomPeerGeneration = 0;
const watchAvatarImages = new Map();

function destroyRoomConnection() {
  roomPeerGeneration += 1;
  if (roomDrawTimer) {
    clearTimeout(roomDrawTimer);
    roomDrawTimer = 0;
  }
  if (roomPeer) {
    try { roomPeer.destroy(); } catch (error) {}
  }
  roomPeer = null;
  if (roomStream) {
    roomStream.getTracks().forEach(function(track) {
      try { track.stop(); } catch (error) {}
    });
  }
  roomStream = null;
  roomCanvas = null;
  roomCanvasContext = null;
  state.roomMode = "local";
  state.remoteMeetingId = "";
}

function createWatchCanvasStream() {
  if (roomStream) return roomStream;
  roomCanvas = document.createElement("canvas");
  roomCanvas.width = 1280;
  roomCanvas.height = 720;
  roomCanvasContext = roomCanvas.getContext("2d", { alpha: false });
  roomStream = roomCanvas.captureStream(15);
  drawWatchFrame();
  return roomStream;
}

function getWatchPeople() {
  const me = {
    id: "me",
    name: state.displayName,
    initials: initialsFor(state.displayName),
    hue: 145,
    avatarUrl: state.myAvatarUrl || null
  };
  const fakePeople = (state.fakePeople || []).map(function(person) {
    return {
      id: person.id,
      name: person.name,
      initials: person.initials || initialsFor(person.name),
      hue: person.hue,
      avatarUrl: person.avatarUrl || null
    };
  });
  return (state.myParticipantHidden ? [] : [me]).concat(fakePeople);
}

function getWatchAvatarImage(person) {
  const url = person && person.avatarUrl ? String(person.avatarUrl) : "";
  if (!url) return null;

  let entry = watchAvatarImages.get(person.id);
  if (!entry || entry.url !== url) {
    const image = new Image();
    entry = { url: url, image: image, ready: false };
    image.onload = function() {
      entry.ready = true;
    };
    image.onerror = function() {
      entry.ready = false;
    };
    watchAvatarImages.set(person.id, entry);
    image.src = url;
  }

  return entry.ready ? entry.image : null;
}

function drawWatchAvatar(ctx, person, centerX, centerY, size) {
  const image = getWatchAvatarImage(person);
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image) {
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.drawImage(image, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = "hsl(" + (person.hue || 145) + " 38% 30%)";
    ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 " + Math.max(14, Math.round(size * 0.34)) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(person.initials || initialsFor(person.name), centerX, centerY);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, size / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
}

function drawWatchFrame() {
  if (!roomCanvasContext || !roomCanvas) return;
  const ctx = roomCanvasContext;
  const width = roomCanvas.width;
  const height = roomCanvas.height;

  ctx.fillStyle = "#0b1118";
  ctx.fillRect(0, 0, width, height);

  const people = getWatchPeople();
  const count = Math.max(1, people.length);
  const columns = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
  const rows = Math.ceil(count / columns);
  const gap = 10;
  const topBar = 58;
  const tileWidth = (width - gap * (columns + 1)) / columns;
  const tileHeight = (height - topBar - gap * (rows + 1)) / rows;

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText("Zoom Copy", 22, 35);
  ctx.fillStyle = "#9fb0c0";
  ctx.font = "500 13px system-ui, sans-serif";
  ctx.fillText("Meeting ID: " + formatMeetingId(state.meetingId), 136, 35);
  ctx.fillStyle = "#35c76f";
  ctx.beginPath();
  ctx.arc(width - 55, 29, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c8d3de";
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillText("LIVE", width - 42, 33);

  people.forEach(function(person, index) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = gap + column * (tileWidth + gap);
    const y = topBar + gap + row * (tileHeight + gap);

    ctx.fillStyle = "#111a24";
    ctx.fillRect(x, y, tileWidth, tileHeight);

    const tile = document.querySelector('.participant-tile[data-person-id="' + person.id + '"]');
    const video = tile && tile.querySelector("video.participant-video");
    const canDrawVideo = video && video.readyState >= 2 && !video.ended && video.videoWidth > 0 && video.videoHeight > 0;

    if (canDrawVideo) {
      const scale = Math.min(tileWidth / video.videoWidth, tileHeight / video.videoHeight);
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;
      ctx.drawImage(video, x + (tileWidth - drawWidth) / 2, y + (tileHeight - drawHeight) / 2, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = "hsl(" + (person.hue || 145) + " 38% 22%)";
      ctx.fillRect(x, y, tileWidth, tileHeight);
      drawWatchAvatar(ctx, person, x + tileWidth / 2, y + tileHeight / 2 - 8, Math.min(112, tileHeight * 0.44));
    }

    ctx.fillStyle = "rgba(0,0,0,.68)";
    ctx.fillRect(x, y + tileHeight - 40, tileWidth, 40);
    drawWatchAvatar(ctx, person, x + 25, y + tileHeight - 20, 27);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.fillText(person.name || "Participant", x + 46, y + tileHeight - 15);
  });

  if (people.length === 0) {
    ctx.fillStyle = "#a8b5c2";
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No participants are currently visible", width / 2, height / 2);
    ctx.textAlign = "start";
  }

  if (roomCanvas) {
    roomDrawTimer = setTimeout(drawWatchFrame, 66);
  }
}

function startHostRoom() {
  if (roomPeer && !roomPeer.destroyed && state.roomMode === "host" && state.remoteMeetingId === "") return;

  destroyRoomConnection();
  state.roomMode = "host";
  state.remoteMeetingId = "";

  const generation = ++roomPeerGeneration;
  const startPeer = function() {
    if (generation !== roomPeerGeneration || state.roomMode !== "host") return;
    const peerId = normalizeMeetingId(state.meetingId);
    roomPeer = new Peer(peerId, { host: "0.peerjs.com", port: 443, secure: true, debug: 1 });

    roomPeer.on("open", function() {
      createWatchCanvasStream();
    });

    roomPeer.on("call", function(call) {
      if (state.roomMode !== "host") return;
      const stream = createWatchCanvasStream();
      try {
        call.answer(stream);
        call.on("error", function(error) {
          console.warn("Remote watch connection failed.", error);
        });
      } catch (error) {
        console.warn("Could not answer remote watcher.", error);
      }
    });

    roomPeer.on("error", function(error) {
      console.warn("Meeting room connection error:", error);
      if (error && error.type === "unavailable-id" && generation === roomPeerGeneration) {
        try { roomPeer.destroy(); } catch (destroyError) {}
        roomPeer = null;
        state.meetingId = generateMeetingId();
        render();
        startHostRoom();
      }
    });

    roomPeer.on("disconnected", function() {
      if (state.roomMode === "host" && roomPeer && !roomPeer.destroyed) {
        try { roomPeer.reconnect(); } catch (error) {}
      }
    });
  };

  startPeer();
}

function renderRemoteMeeting() {
  return '<div class="remote-meeting-page">' +
    '<header class="meeting-topbar"><div class="meeting-title"><span class="live-dot"></span><div><strong>Watching live meeting</strong><span>Meeting ID: ' + escapeHtml(formatMeetingId(state.remoteMeetingId)) + '</span></div></div><div class="meeting-top-actions"><span class="remote-live-badge" data-remote-status>Connecting…</span><button class="top-action" data-action="leave-remote-meeting">Leave</button></div></header>' +
    '<main class="remote-meeting-main"><div class="remote-video-shell"><video id="remote-meeting-video" class="remote-meeting-video" autoplay playsinline></video><div class="remote-video-message" data-remote-message>Connecting to the host…</div></div><div class="remote-watch-note">You are watching another user’s simulated meeting live. Their uploaded videos stay on their device and are streamed directly to you.</div></main>' +
  '</div>';
}

function joinRemoteMeeting(meetingId) {
  const id = normalizeMeetingId(meetingId);
  if (id.length !== 9) {
    alert("Enter the 9-digit meeting ID.");
    return false;
  }

  if (state.roomMode === "host" && normalizeMeetingId(state.meetingId) === id) {
    alert("You are already hosting this meeting.");
    return false;
  }

  destroyRoomConnection();
  state.roomMode = "watcher";
  state.remoteMeetingId = id;
  state.page = "meeting";
  state.meetingStarted = false;
  state.participantsOpen = false;
  state.chatOpen = false;
  render();

  roomPeer = new Peer(undefined, { host: "0.peerjs.com", port: 443, secure: true, debug: 1 });

  const showStatus = function(status, message, error) {
    const statusEl = document.querySelector("[data-remote-status]");
    const messageEl = document.querySelector("[data-remote-message]");
    if (statusEl) statusEl.textContent = status;
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.classList.toggle("error", Boolean(error));
    }
  };

  roomPeer.on("open", function() {
    showStatus("Connecting", "Waiting for the host to answer…");
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const placeholder = canvas.captureStream(1);
    const call = roomPeer.call(id, placeholder);
    placeholder.getTracks().forEach(function(track) {
      try { track.stop(); } catch (error) {}
    });

    if (!call) {
      showStatus("Offline", "That meeting could not be reached.", true);
      return;
    }

    call.on("stream", function(stream) {
      const video = document.querySelector("#remote-meeting-video");
      if (!video) return;
      video.srcObject = stream;
      video.play().catch(function() {});
      showStatus("LIVE", "You are watching the host’s fake meeting.", false);
    });
    call.on("close", function() {
      showStatus("Ended", "The host ended the meeting or disconnected.", true);
    });
    call.on("error", function(error) {
      console.warn("Remote meeting call failed.", error);
      showStatus("Offline", "Could not connect to that meeting ID.", true);
    });
  });

  roomPeer.on("error", function(error) {
    console.warn("Watcher room connection error:", error);
    showStatus("Offline", error && error.type === "peer-unavailable" ? "No live meeting is using that ID." : "Could not connect to that meeting.", true);
  });
  return true;
}

function openJoinMeetingDialog() {
  const existing = document.querySelector(".join-meeting-backdrop");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.className = "tutorial-backdrop join-meeting-backdrop";
  modal.innerHTML = '<form class="tutorial-card join-meeting-card"><button type="button" class="tutorial-close join-meeting-close">×</button><div class="tutorial-icon">' + icon("video") + '</div><span class="eyebrow">Join a meeting</span><h2>Enter a meeting ID</h2><p class="tutorial-body">Enter the 9-digit ID shared by another user to watch their simulated meeting live.</p><label class="field-label">Meeting ID<input name="meetingId" inputmode="numeric" autocomplete="off" maxlength="11" placeholder="123 456 789" required></label><p class="join-meeting-error" data-join-error></p><div class="tutorial-actions"><button type="button" class="secondary join-meeting-close">Cancel</button><span></span><button type="submit" class="primary">Join</button></div></form>';
  document.body.appendChild(modal);
  const form = modal.querySelector("form");
  const input = form.querySelector('[name="meetingId"]');
  const error = form.querySelector("[data-join-error]");

  modal.querySelectorAll(".join-meeting-close").forEach(function(button) {
    button.addEventListener("click", function() { modal.remove(); });
  });
  modal.addEventListener("click", function(event) {
    if (event.target === modal) modal.remove();
  });
  form.addEventListener("submit", function(event) {
    event.preventDefault();
    const id = normalizeMeetingId(input.value);
    if (id.length !== 9) {
      error.textContent = "Meeting IDs are 9 digits.";
      return;
    }
    modal.remove();
    joinRemoteMeeting(id);
  });
  input.addEventListener("input", function() {
    const digits = normalizeMeetingId(input.value);
    input.value = formatMeetingId(digits);
    error.textContent = "";
  });
  input.focus();
}

function render() {
  if (state.page === "meeting" && state.roomMode === "watcher") {
    app.innerHTML = renderRemoteMeeting();
    bind();
    return;
  }
  if (state.page === "meeting") state.meetingStarted = true;
  const videoState = state.page === "meeting" ? captureVideoState() : {};
  if (state.page === "meeting") app.innerHTML = renderMeeting();
  else if (state.page === "settings") app.innerHTML = renderSettings();
  else app.innerHTML = renderHome();
  bind();
  if (state.page === "meeting") restoreVideoState(videoState);
  queueMeetingSave();
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
      '<div class="sidebar-bottom"><button class="profile-chip" data-page="settings"><div class="avatar small">MC</div><div><strong>My account</strong><span>Available</span></div><span class="chevron">⌄</span></button></div>' +
    '</aside><main class="page">' + content + '</main></div>';
}

function renderHome() {
  const content =
    '<header class="topbar"><div><span class="eyebrow">Meet smarter</span><h1>Good evening</h1></div><button class="icon-button" title="Settings" data-page="settings">' + icon("settings") + '</button></header>' +
    '<section class="hero-grid">' +
      '<article class="hero-card"><div class="hero-copy"><span class="pill">Your meeting space</span><h2>Meet, present, and test fake cameras in one place.</h2><p>Build a meeting with realistic participant tiles, local video files, and familiar call controls.</p><div class="hero-actions"><button class="primary" data-action="start-meeting">Start a meeting</button><button class="secondary" data-action="join-meeting">Join a meeting</button></div></div>' +
        '<div class="hero-visual"><div class="mini-window"><div class="mini-top"><span></span><span></span><span></span><b>Team standup</b><small>12:41</small></div><div class="mini-grid"><div class="mini-tile tile-a"><span>AM</span></div><div class="mini-tile tile-b"><span>JL</span></div><div class="mini-tile tile-c"><span>SR</span></div><div class="mini-tile tile-d"><span>MC</span></div></div></div></div>' +
      '</article>' +
      '<div class="quick-column"><button class="quick-card" data-action="start-meeting"><div class="quick-icon blue">' + icon("video") + '</div><div><strong>New meeting</strong><span>Start instantly</span></div><b>›</b></button><button class="quick-card" data-action="open-participants"><div class="quick-icon green">' + icon("users") + '</div><div><strong>Fake participants</strong><span>Add people to your call</span></div><b>›</b></button><div class="tip-card"><span class="tip-label">SIMULATED CAMERA</span><strong>Upload a video file and use it as a meeting camera tile.</strong><p>Your file stays local to this browser session.</p></div></div>' +
    '</section>' +
    '<section class="section"><div class="section-heading"><div><span class="eyebrow">Saved</span><h3>Meetings</h3></div><button class="text-button" data-action="start-meeting">New meeting</button></div><div class="meeting-list">' +
      (state.savedMeetingsLoading ? '<div class="saved-empty"><strong>Loading saved meetings…</strong></div>' :
        state.savedMeetings.length ? state.savedMeetings.map(function(meeting) {
          const savedDate = meeting.savedAt ? new Date(meeting.savedAt).toLocaleString() : "Saved locally";
          const videoText = meeting.videos ? meeting.videos + " video" + (meeting.videos === 1 ? "" : "s") : "No videos";
          return '<div class="meeting-row saved-meeting-row"><div class="meeting-icon">' + icon("video") + '</div><div><strong>Meeting ' + escapeHtml(formatMeetingId(meeting.id)) + '</strong><span>' + escapeHtml(meeting.participants + " participant" + (meeting.participants === 1 ? "" : "s")) + " · " + escapeHtml(videoText) + " · Last saved " + escapeHtml(savedDate) + '</span></div><span class="meeting-id">' + escapeHtml(formatMeetingId(meeting.id)) + '</span><button class="join-small" data-action="open-saved-meeting" data-meeting-id="' + escapeHtml(meeting.id) + '">Open</button></div>';
        }).join("") :
        '<div class="saved-empty"><strong>No saved meetings yet</strong><span>Your meetings will automatically be saved here and stay available on this browser.</span></div>') +
    '</div></section>';
  return shell(content, "home");
}

function renderSettings() {
  const content =
    '<header class="topbar"><div><span class="eyebrow">Preferences</span><h1>Settings</h1></div><button class="secondary settings-help-button" data-action="open-tutorial">Open tutorial</button></header>' +
    '<section class="settings-layout"><div class="settings-nav"><button class="settings-nav-item active">General</button><button class="settings-nav-item">Video</button><button class="settings-nav-item">Audio</button><button class="settings-nav-item">Meeting</button></div>' +
    '<div class="settings-panel"><h2>General</h2><p class="muted">Tune the demo meeting experience.</p>' +
    '<label class="setting-row"><span><strong>Open meetings in the demo room</strong><small>Skip the home screen when starting a meeting.</small></span><input type="checkbox" checked></label>' +
    '<label class="setting-row"><span><strong>Remember fake participants</strong><small>Keep custom people for this browser tab.</small></span><input type="checkbox" checked></label>' +
    '<div class="setting-note"><strong>Simulated camera</strong><p>Video files are rendered as local meeting feeds. They are not installed as an operating-system webcam device.</p></div></div></section>';
  return shell(content, "settings");
}

function updateClipControlLabels(personId) {
  const tile = document.querySelector('.participant-tile[data-person-id="' + personId + '"]');
  if (!tile) return;
  const video = tile.querySelector("video.participant-video");
  const paused = state.clipPaused[personId] === true || !video || video.paused;
  tile.querySelectorAll('[data-action="toggle-clip"][data-person-id="' + personId + '"]').forEach(function(button) {
    button.innerHTML = icon(paused ? "play" : "pause") + '<span>' + (paused ? "Play clip" : "Pause clip") + '</span>';
  });
}

function getParticipantVideoElement(personId) {
  const tile = document.querySelector('.participant-tile[data-person-id="' + personId + '"]');
  return tile && tile.querySelector("video.participant-video");
}

function ensureParticipantCameraVisible(personId) {
  const person = getParticipant(personId);
  if (!person) return false;

  if (personId === "me") {
    state.myParticipantHidden = false;
    state.cameraHidden.me = false;
    state.cameraOn = true;
  } else {
    person.cameraVisible = true;
  }

  return true;
}

function restartPersonClip(personId) {
  const person = getParticipant(personId);
  if (!person || !getCurrentVideoUrl(person)) return false;

  state.clipPaused[personId] = false;
  ensureParticipantCameraVisible(personId);
  render();

  const video = getParticipantVideoElement(personId);
  if (!video) return false;

  const start = function() {
    try { video.currentTime = 0; } catch (error) {}
    video.play().catch(function() {});
    updateClipControlLabels(personId);
    syncAudioIndicator();
    queueMeetingSave();
  };

  if (video.readyState >= 1) start();
  else video.addEventListener("loadedmetadata", start, { once: true });
  return true;
}

function togglePersonClip(personId) {
  const person = getParticipant(personId);
  if (!person || !getCurrentVideoUrl(person)) return false;

  const video = getParticipantVideoElement(personId);

  if (!video) {
    if (state.myParticipantHidden && personId === "me") {
      state.myParticipantHidden = false;
      render();
      return togglePersonClip(personId);
    }
    state.clipPaused[personId] = true;
    queueMeetingSave();
    return true;
  }

  if (video.ended) {
    try { video.currentTime = 0; } catch (error) {}
    state.clipPaused[personId] = false;
    video.play().catch(function() {});
  } else if (video.paused || state.clipPaused[personId]) {
    state.clipPaused[personId] = false;
    video.play().catch(function() {});
  } else {
    state.clipPaused[personId] = true;
    video.pause();
  }

  updateClipControlLabels(personId);
  syncAudioIndicator();
  queueMeetingSave();
  return true;
}

function restartAllClips() {
  const people = getRecordingPeople();
  const peopleWithVideos = people.filter(function(person) {
    return getVideos(person).length;
  });
  if (!peopleWithVideos.length) return false;

  peopleWithVideos.forEach(function(person) {
    state.clipPaused[person.id] = false;
    if (person.id === "me") {
      state.cameraHidden.me = false;
      state.cameraOn = true;
      state.needsNextOnCamera = false;
    } else {
      person.cameraVisible = true;
      person.needsNextOnCamera = false;
    }
  });

  render();

  document.querySelectorAll("video.participant-video[data-person-id]").forEach(function(video) {
    const personId = video.dataset.personId;
    try { video.currentTime = 0; } catch (error) {}
    state.clipPaused[personId] = false;
    video.play().catch(function() {});
    updateClipControlLabels(personId);
  });

  syncAudioIndicator();
  if (state.recording) syncRecordingAudio();
  queueMeetingSave();
  return true;
}

function togglePauseAllVideos() {
  const videos = Array.from(document.querySelectorAll("video.participant-video[data-person-id]"));
  if (!videos.length) return false;

  const hasPlayingVideo = videos.some(function(video) {
    return !video.paused && !video.ended;
  });

  if (hasPlayingVideo) {
    getRecordingPeople().forEach(function(person) {
      if (getVideos(person).length) state.clipPaused[person.id] = true;
    });

    videos.forEach(function(video) {
      state.clipPaused[video.dataset.personId] = true;
      try { video.pause(); } catch (error) {}
      updateClipControlLabels(video.dataset.personId);
    });
  } else {
    videos.forEach(function(video) {
      const personId = video.dataset.personId;
      state.clipPaused[personId] = false;
      if (video.ended) {
        try { video.currentTime = 0; } catch (error) {}
      }
      video.play().catch(function() {});
      updateClipControlLabels(personId);
    });
  }

  syncAudioIndicator();
  queueMeetingSave();
  return true;
}


function participantTile(person) {
  const videoUrl = getCurrentVideoUrl(person);
  const videoCount = getVideos(person).length;
  const showVideo = Boolean(videoUrl && isCameraVisible(person));
  const media = showVideo
    ? '<video class="participant-video" data-person-id="' + person.id + '" data-video-url="' + escapeHtml(videoUrl) + '" src="' + videoUrl + '"' + (state.clipPaused[person.id] ? '' : ' autoplay') + ' playsinline' +
      (state.audioEnabled && isPersonAudioOn(person) ? "" : " muted") + '></video>'
    : '<div class="participant-avatar" style="--hue:' + person.hue + '">' + avatarMarkup(person, "participant-avatar-image") + '<span' + (getAvatarUrl(person) ? ' class="participant-avatar-initials"' : '') + '>' + escapeHtml(person.initials) + '</span></div>';

  const cameraKey = state.keybinds[person.id] || "—";
  const nextKey = state.nextKeybinds[person.id] || "—";
  const audioKey = state.audioKeybinds[person.id] || "—";
  const leaveKey = state.leaveKeybinds[person.id] || "—";
  const pauseKey = state.pauseKeybinds[person.id] || "—";
  const restartKey = state.restartKeybinds[person.id] || "—";
  const keybindBadges =
    '<span class="keybind-badge">Cam:' + escapeHtml(cameraKey.toUpperCase()) + '</span>' +
    '<span class="next-key-badge">Next:' + escapeHtml(nextKey.toUpperCase()) + '</span>' +
    '<span class="audio-key-badge">Audio:' + escapeHtml(audioKey.toUpperCase()) + '</span>' +
    '<span class="leave-key-badge">Leave:' + escapeHtml(leaveKey.toUpperCase()) + '</span>' +
    '<span class="pause-key-badge">Pause:' + escapeHtml(pauseKey.toUpperCase()) + '</span>' +
    '<span class="restart-key-badge">Restart:' + escapeHtml(restartKey.toUpperCase()) + '</span>';

  const mutedBadge = !isPersonAudioOn(person) ? '<span class="muted-audio-badge">' + icon("micOff") + '<span>Muted</span></span>' : "";
  const hiddenBadge = !isCameraVisible(person) && videoCount ? '<span class="camera-hidden-badge">CAM OFF</span>' : "";
  return '<article class="participant-tile" data-person-id="' + person.id + '">' + media + '<div class="tile-scrim"></div>' + keybindBadges + hiddenBadge + mutedBadge +
    '<div class="participant-label"><span class="status-dot"></span><span>' + escapeHtml(person.name) + '</span>' +
    (person.role ? '<em>' + escapeHtml(person.role) + '</em>' : "") + '</div>' +
    (videoCount ? '<div class="clip-controls">' +
      '<button class="clip-control" data-action="restart-clip" data-person-id="' + person.id + '" title="Restart clip">' + icon("restart") + '<span>Restart</span></button>' +
      '<button class="clip-control" data-action="toggle-clip" data-person-id="' + person.id + '" title="Pause clip">' + icon("pause") + '<span>Pause clip</span></button>' +
    '</div>' : '') +
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
    role: "",
    initials: initialsFor(state.displayName),
    hue: 145,
    role: state.hostId === "me" ? "Host" : "",
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
      '<button class="end-call" data-action="end-meeting">' + icon("phone") + '<span>End</span></button>' +
    '</footer>' +
  '</div>';
}

function renderParticipants() {
  normalizeHosts();
  const safeDisplayName = escapeHtml(state.displayName);
  const myVideos = state.myVideos || [];
  const myAudioText = state.myAudioOn ? "Audio on" : "Audio off";
  return '<aside class="side-panel participants-panel"><div class="panel-header"><div><strong>Participants</strong><span>' + (state.fakePeople.length + 1) + ' in meeting</span></div><div class="panel-header-actions"><button class="panel-option-toggle" data-action="toggle-participant-options" aria-expanded="' + (state.participantOptionsOpen ? "true" : "false") + '">Options</button><button class="panel-close" data-action="toggle-participants">×</button></div></div>' +
    '<div class="my-participant-card"><div class="avatar" style="--hue:145">' + avatarMarkup({ id: "me", name: state.displayName }, "avatar-image") + (state.myAvatarUrl ? '' : '<span>MC</span>') + '</div><div><strong>' + safeDisplayName + '</strong><span>' + (state.hostId === "me" ? "Host" : "Participant") + '</span></div><div class="participant-row-actions">' + (state.hostId !== "me" ? '<button class="host-mini" data-action="make-host" data-person-id="me">Make Host</button>' : '<span class="host-status">Host</span>') + '<button class="edit-mini" data-action="edit-person" data-person-id="me">Edit</button>' + (state.myParticipantHidden ? '<button class="join-mini" data-action="join-back" data-person-id="me">Join Back</button>' : '<button class="leave-mini" data-action="leave-person" data-person-id="me">Leave</button>') + '</div></div>' +
    '<button class="add-person" data-action="add-person"><span>+</span><strong>Add fake person</strong><small>Custom name + multiple videos</small></button>' +
    (state.participantOptionsOpen ? '<div class="participant-options"><div class="participant-options-title"><strong>Participant options</strong><button class="options-close" data-action="toggle-participant-options">Done</button></div>' +
      '<div class="global-video-shortcut"><div><strong>Pause / resume all videos</strong><small>Toggle every active clip with one key.</small></div><input class="global-keybind-input" data-pause-all-keybind value="' + escapeHtml((state.pauseAllKeybind || "").toUpperCase()) + '" placeholder="P" maxlength="1" autocomplete="off" aria-label="Pause all videos keybind"></div>' +
      '<div class="global-video-shortcut"><div><strong>Restart all clips</strong><small>Press / to restart every active clip.</small></div><span class="global-key-static">/</span></div>' +
      (state.leaveHistory.length ? '<button class="join-back-button" data-action="join-back"><span>↩</span><strong>Join Back</strong><small>Restore the last person who left with the same setup</small></button>' : '') +
      '<div class="file-help leave-undo-help">Press <strong>0</strong> to bring back the last person who left with the same videos, profile picture, settings, and keybinds.</div></div>' : '') +
    '<label class="participant-search"><span class="participant-search-icon">⌕</span><input type="search" data-participant-search placeholder="Search participants" value="' + escapeHtml(state.participantSearch || "") + '" autocomplete="off"></label>' +
    '<div class="participant-list">' +
    state.fakePeople.filter(function(p){ return !state.participantSearch || p.name.toLowerCase().includes(state.participantSearch.toLowerCase()); }).map(function(p){
      const videos = getVideos(p);
      const cameraText = videos.length ? (p.cameraVisible === false ? " · Camera hidden" : " · " + videos.length + " video" + (videos.length === 1 ? "" : "s")) : " · No camera";
      const hostText = p.id === state.hostId ? "Host" : "Participant";
      return '<div class="participant-list-row"><div class="avatar" style="--hue:' + p.hue + '">' + avatarMarkup(p, "avatar-image") + (p.avatarUrl ? '' : '<span>' + escapeHtml(p.initials) + '</span>') + '</div><div><strong>' + escapeHtml(p.name) + '</strong><span>' + hostText + cameraText + (p.audioOn === false ? " · Muted" : "") + '</span></div><div class="participant-row-actions"><div class="row-icons">' + icon(p.audioOn === false ? "micOff" : "mic") + icon(videos.length && p.cameraVisible !== false ? "video" : "videoOff") + '</div>' + (p.id !== state.hostId ? '<button class="host-mini" data-action="make-host" data-person-id="' + p.id + '">Make Host</button>' : '<span class="host-status">Host</span>') + '<button class="edit-mini" data-action="edit-person" data-person-id="' + p.id + '">Edit</button></div></div>';
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

function renderVideoPlaylist(person) {
  const videos = getVideos(person);
  const currentIndex = person.id === "me" ? state.myVideoIndex : (person.currentVideoIndex || 0);
  if (!videos.length) return "";

  return videos.map(function(v, i) {
    const isFirst = i === 0;
    const isLast = i === videos.length - 1;
    return '<div class="video-playlist-row">' +
      '<span class="video-playlist-number">' + (i + 1) + '</span>' +
      '<strong>' + escapeHtml(v.name || ("Video " + (i + 1))) + '</strong>' +
      (i === currentIndex ? '<em>Now playing</em>' : '') +
      '<div class="video-order-actions">' +
        '<button type="button" class="video-order-button" data-move-video="up" data-video-index="' + i + '"' + (isFirst ? ' disabled' : '') + ' aria-label="Move video up">↑</button>' +
        '<button type="button" class="video-order-button" data-move-video="down" data-video-index="' + i + '"' + (isLast ? ' disabled' : '') + ' aria-label="Move video down">↓</button>' +
        '<button type="button" class="video-delete-button" data-delete-video="' + i + '" aria-label="Delete video">Delete</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

function reorderParticipantVideo(personId, fromIndex, direction) {
  const person = getParticipant(personId);
  if (!person) return false;

  const videos = person.id === "me" ? state.myVideos : person.videos;
  if (!Array.isArray(videos) || videos.length < 2) return false;

  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  if (fromIndex < 0 || fromIndex >= videos.length || toIndex < 0 || toIndex >= videos.length) return false;

  const movedVideo = videos[fromIndex];
  videos[fromIndex] = videos[toIndex];
  videos[toIndex] = movedVideo;

  const currentIndex = person.id === "me" ? state.myVideoIndex : (person.currentVideoIndex || 0);
  if (currentIndex === fromIndex) {
    if (person.id === "me") state.myVideoIndex = toIndex;
    else person.currentVideoIndex = toIndex;
  } else if (fromIndex < currentIndex && currentIndex <= toIndex) {
    if (person.id === "me") state.myVideoIndex = currentIndex - 1;
    else person.currentVideoIndex = currentIndex - 1;
  } else if (toIndex <= currentIndex && currentIndex < fromIndex) {
    if (person.id === "me") state.myVideoIndex = currentIndex + 1;
    else person.currentVideoIndex = currentIndex + 1;
  }

  queueMeetingSave();
  return true;
}

function deleteParticipantVideo(personId, videoIndex) {
  const person = getParticipant(personId);
  if (!person) return false;

  const videos = person.id === "me" ? state.myVideos : person.videos;
  if (!Array.isArray(videos) || videoIndex < 0 || videoIndex >= videos.length) return false;

  const currentIndex = person.id === "me" ? state.myVideoIndex : (person.currentVideoIndex || 0);
  const removed = videos.splice(videoIndex, 1)[0];
  if (removed && removed.url) revokeBlob(removed.url);

  if (!videos.length) {
    if (person.id === "me") {
      state.myVideoIndex = 0;
      state.cameraOn = false;
      state.cameraHidden.me = true;
      state.needsNextOnCamera = false;
    } else {
      person.currentVideoIndex = 0;
      person.cameraVisible = false;
      person.needsNextOnCamera = false;
    }
    state.clipPaused[person.id] = false;
  } else {
    const nextIndex = videoIndex < currentIndex
      ? currentIndex - 1
      : Math.min(currentIndex, videos.length - 1);

    if (person.id === "me") state.myVideoIndex = nextIndex;
    else person.currentVideoIndex = nextIndex;

    if (videoIndex === currentIndex) {
      state.clipPaused[person.id] = false;
    }
  }

  queueMeetingSave();
  return true;
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
  const currentPauseKey = isNew ? "" : (state.pauseKeybinds[personId] || "");
  const currentRestartKey = isNew ? "" : (state.restartKeybinds[personId] || "");
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
      (videos.length ? '<div class="video-playlist-help">Imported order is used by Next. Use ↑ and ↓ to change the order.</div><div class="video-playlist">' + renderVideoPlaylist(person) + '</div>' : '') +
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
      '<label class="field-label">Pause / Play clip keybind<input name="pauseKeybind" class="keybind-input" value="' + escapeHtml(currentPauseKey.toUpperCase()) + '" placeholder="Press a key" maxlength="1" autocomplete="off"></label>' +
      '<div class="file-help">Toggle this person’s clip between Pause and Play with one key.</div>' +
      '<label class="field-label">Restart clip keybind<input name="restartKeybind" class="keybind-input" value="' + escapeHtml(currentRestartKey.toUpperCase()) + '" placeholder="Press a key" maxlength="1" autocomplete="off"></label>' +
      '<div class="file-help">Restart this person’s current clip from the beginning.</div>' +
      '<label class="field-label">Leave keybind<input name="leaveKeybind" class="keybind-input" value="' + escapeHtml(currentLeaveKey.toUpperCase()) + '" placeholder="Press a key" maxlength="1" autocomplete="off"></label>' +
      '<div class="file-help">This person leaves the meeting when the key is pressed. Press 0 to undo the last leave.</div>' +
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
  const submitButton = form.querySelector('button[type="submit"]');
  let modalClosed = false;
  let saving = false;

  function closeModal() {
    if (modalClosed) return;
    modalClosed = true;
    modal.remove();
  }

  modal.querySelectorAll("[data-close]").forEach(function(b) {
    b.addEventListener("click", function(e) {
      e.preventDefault();
      closeModal();
    });
  });

  modal.addEventListener("click", function(e) {
    if (e.target === modal) closeModal();
  });

  const nextButton = modal.querySelector("[data-next-video]");
  if (nextButton) {
    nextButton.addEventListener("click", function() {
      advancePersonVideo(personId);
      closeModal();
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
      closeModal();
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
      delete state.pauseKeybinds[personId];
      normalizeHosts();
      closeModal();
      render();
    });
  }

  modal.querySelectorAll('[name="keybind"], [name="nextKeybind"], [name="audioKeybind"], [name="pauseKeybind"], [name="restartKeybind"], [name="leaveKeybind"]').forEach(function(input) {
    input.addEventListener("keydown", function(e) {
      if (["Tab", "Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "Escape") {
        input.value = "";
        return;
      }
      if (/^[a-z0-9]$/i.test(e.key) && e.key !== "0") input.value = e.key.toUpperCase();
    });
    input.addEventListener("focus", function() { input.select(); });
  });

  form.addEventListener("submit", function(e) {
    e.preventDefault();
    if (modalClosed || saving) return;

    saving = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent || "";
      submitButton.textContent = isNew ? "Adding…" : "Saving…";
    }

    try {
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
      const pauseKey = String(fd.get("pauseKeybind") || "").trim();
      const restartKey = String(fd.get("restartKeybind") || "").trim();
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
        setPauseKeybind(newPerson.id, pauseKey);
        setRestartKeybind(newPerson.id, restartKey);
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
        setPauseKeybind("me", pauseKey);
        setRestartKeybind("me", restartKey);
      } else {
        const target = state.fakePeople.find(function(p) { return p.id === personId; });
        if (!target) throw new Error("This participant no longer exists.");

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
        setPauseKeybind(personId, pauseKey);
        setRestartKeybind(personId, restartKey);
        normalizeHosts();
      }

      closeModal();
      render();
      if (state.recording) syncRecordingAudio();
    } catch (error) {
      console.error("Participant editor save failed", error);
      closeModal();
      alert("The participant could not be saved. Please try again.");
    } finally {
      saving = false;
    }
  });

  function refreshVideoPlaylist() {
    const playlist = modal.querySelector(".video-playlist");
    const updatedPerson = getParticipant(personId);
    if (playlist && updatedPerson) {
      playlist.innerHTML = renderVideoPlaylist(updatedPerson);
      wireVideoOrderButtons();
    }
  }

  function wireVideoOrderButtons() {
    modal.querySelectorAll("[data-move-video]").forEach(function(button) {
      button.addEventListener("click", function handleMoveClick() {
        const fromIndex = Number(button.dataset.videoIndex);
        const direction = button.dataset.moveVideo;
        if (!Number.isInteger(fromIndex)) return;
        if (!reorderParticipantVideo(personId, fromIndex, direction)) return;
        refreshVideoPlaylist();
      });
    });

    modal.querySelectorAll("[data-delete-video]").forEach(function(button) {
      button.addEventListener("click", function handleDeleteClick() {
        const videoIndex = Number(button.dataset.deleteVideo);
        if (!Number.isInteger(videoIndex)) return;
        if (!deleteParticipantVideo(personId, videoIndex)) return;
        refreshVideoPlaylist();
      });
    });
  }
  wireVideoOrderButtons();

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
  video.addEventListener("play", function() {
    syncAudioIndicator();
    updateClipControlLabels(video.dataset.personId);
  });
  video.addEventListener("playing", function() {
    syncAudioIndicator();
    updateClipControlLabels(video.dataset.personId);
  });
  video.addEventListener("pause", function() {
    syncAudioIndicator();
    updateClipControlLabels(video.dataset.personId);
  });
  video.addEventListener("volumechange", syncAudioIndicator);
  if (state.clipPaused[video.dataset.personId]) {
    video.pause();
    updateClipControlLabels(video.dataset.personId);
    syncAudioIndicator();
  } else {
    video.play().then(syncAudioIndicator).catch(syncAudioIndicator);
  }
}

function getRecordingPeople() {
  const me = {
    id: "me",
    name: state.displayName,
    initials: initialsFor(state.displayName),
    hue: 145,
    avatarUrl: state.myAvatarUrl
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

function getRecordingAvatarImage(person) {
  const url = getAvatarUrl(person);
  if (!url) return null;

  let entry = recordingAvatarImages.get(person.id);
  if (!entry || entry.url !== url) {
    const image = new Image();
    entry = { url: url, image: image, ready: false };
    recordingAvatarImages.set(person.id, entry);
    image.onload = function() {
      entry.ready = true;
      entry.failed = false;
    };
    image.onerror = function() {
      entry.ready = false;
      entry.failed = true;
    };
    image.src = url;
  }

  if (!entry || entry.failed || !entry.ready || !entry.image || !entry.image.complete || !entry.image.naturalWidth || !entry.image.naturalHeight) {
    return null;
  }

  return entry.image;
}

function safeDrawRecordingAvatarImage(ctx, image, x, y, width, height) {
  if (!ctx || !image || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;
  try {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const boxRatio = width / height;
    let drawWidth = width;
    let drawHeight = height;
    let drawX = x;
    let drawY = y;

    if (sourceRatio > boxRatio) {
      drawHeight = width / sourceRatio;
      drawY = y + (height - drawHeight) / 2;
    } else {
      drawWidth = height * sourceRatio;
      drawX = x + (width - drawWidth) / 2;
    }

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    return true;
  } catch (error) {
    console.warn("Participant PFP could not be drawn into the recording. Falling back to initials.", error);
    return false;
  }
}

function drawRecordingAvatar(ctx, person, x, y, w, h) {
  const gradient = ctx.createRadialGradient(x + w / 2, y + h * 0.38, 8, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  gradient.addColorStop(0, "hsl(" + person.hue + ", 65%, 44%)");
  gradient.addColorStop(1, "hsl(" + person.hue + ", 40%, 18%)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);

  const avatarImage = getRecordingAvatarImage(person);
  if (avatarImage) {
    const diameter = Math.max(48, Math.min(76, Math.min(w, h) * 0.22));
    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2);
    ctx.clip();
    const drewAvatar = safeDrawRecordingAvatarImage(
      ctx,
      avatarImage,
      cx - diameter / 2,
      cy - diameter / 2,
      diameter,
      diameter
    );
    ctx.restore();

    if (!drewAvatar) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 " + Math.max(28, Math.min(w, h) * 0.15) + "px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(person.initials || "GU", cx, cy);
      return;
    }

    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 " + Math.max(28, Math.min(w, h) * 0.15) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(person.initials || "GU", x + w / 2, y + h / 2);
  }
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

function drawRecordingControlIcon(ctx, name, centerX, centerY, size, color) {
  const s = Math.max(1, size / 24);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(s, s);
  ctx.strokeStyle = color || "#dce3eb";
  ctx.fillStyle = color || "#dce3eb";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  if (name === "mic") {
    ctx.moveTo(12, 2);
    ctx.arc(12, 5, 3, 0, Math.PI * 2);
    ctx.moveTo(9, 5);
    ctx.lineTo(9, 12);
    ctx.arc(12, 12, 3, Math.PI, 0, true);
    ctx.moveTo(15, 5);
    ctx.lineTo(15, 12);
    ctx.moveTo(5, 10);
    ctx.lineTo(5, 12);
    ctx.arc(12, 12, 7, Math.PI, 0, false);
    ctx.moveTo(12, 19);
    ctx.lineTo(12, 22);
    ctx.moveTo(8, 22);
    ctx.lineTo(16, 22);
    ctx.stroke();
  } else if (name === "micOff") {
    ctx.moveTo(4, 4);
    ctx.lineTo(20, 20);
    ctx.moveTo(9, 5);
    ctx.lineTo(9, 11);
    ctx.arc(12, 12, 3, Math.PI, 0, true);
    ctx.moveTo(15, 5);
    ctx.lineTo(15, 12);
    ctx.moveTo(5, 10);
    ctx.lineTo(5, 12);
    ctx.arc(12, 12, 7, Math.PI, 0, false);
    ctx.moveTo(12, 19);
    ctx.lineTo(12, 22);
    ctx.moveTo(8, 22);
    ctx.lineTo(16, 22);
    ctx.stroke();
  } else if (name === "video" || name === "videoOff") {
    ctx.rect(3, 6, 12, 12);
    ctx.moveTo(15, 10);
    ctx.lineTo(20, 7);
    ctx.arc(20, 9.5, 2.5, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(15, 15);
    ctx.stroke();
    if (name === "videoOff") {
      ctx.moveTo(4, 4);
      ctx.lineTo(20, 20);
      ctx.stroke();
    }
  } else if (name === "users") {
    ctx.arc(9, 7, 4, 0, Math.PI * 2);
    ctx.moveTo(2, 21);
    ctx.lineTo(2, 19);
    ctx.arc(6, 19, 4, Math.PI, 0, false);
    ctx.moveTo(16, 4);
    ctx.arc(17, 7, 3, 0, Math.PI * 2);
    ctx.moveTo(16, 14);
    ctx.arc(18, 19, 4, Math.PI, 0, false);
    ctx.stroke();
  } else if (name === "chat") {
    ctx.moveTo(21, 11.5);
    ctx.arc(12, 11.5, 9, 0, Math.PI * 2);
    ctx.moveTo(5, 18);
    ctx.lineTo(4, 22);
    ctx.lineTo(9, 19);
    ctx.stroke();
  } else if (name === "share") {
    ctx.moveTo(12, 3);
    ctx.lineTo(12, 15);
    ctx.moveTo(7, 8);
    ctx.lineTo(12, 3);
    ctx.lineTo(17, 8);
    ctx.moveTo(5, 12);
    ctx.lineTo(5, 19);
    ctx.arc(7, 19, 2, Math.PI, Math.PI / 2, true);
    ctx.lineTo(17, 21);
    ctx.arc(19, 19, 2, Math.PI / 2, 0, true);
    ctx.lineTo(19, 12);
    ctx.stroke();
  } else if (name === "record") {
    ctx.beginPath();
    ctx.arc(12, 12, 6, 0, Math.PI * 2);
    ctx.stroke();
  } else if (name === "more") {
    ctx.beginPath();
    ctx.arc(5, 12, 1.2, 0, Math.PI * 2);
    ctx.arc(12, 12, 1.2, 0, Math.PI * 2);
    ctx.arc(19, 12, 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (name === "phone") {
    ctx.moveTo(7, 4);
    ctx.lineTo(10, 7);
    ctx.lineTo(8, 9);
    ctx.arc(14, 15, 5, Math.PI, 1.5 * Math.PI, false);
    ctx.lineTo(15, 16);
    ctx.lineTo(18, 14);
    ctx.lineTo(21, 17);
    ctx.arc(19, 19, 3, -Math.PI / 2, 0, false);
    ctx.stroke();
  }
  ctx.restore();
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
    if (video && video.readyState >= 2 && !video.ended && video.videoWidth && video.videoHeight) {
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
      ctx.fillText(state.fakePeople.length + " in meeting", px + 16, topBar + 39);

      let py = topBar + 55;

      if (!state.myParticipantHidden) {
        const me = {
          id: "me",
          name: state.displayName,
          initials: initialsFor(state.displayName),
          hue: 145,
          avatarUrl: state.myAvatarUrl
        };
        let meAvatar = getRecordingAvatarImage(me);

        ctx.fillStyle = "hsl(145,65%,45%)";
        roundedRectPath(ctx, px + 15, py, 32, 32, 9);
        ctx.fill();

        if (meAvatar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(px + 31, py + 16, 15, 0, Math.PI * 2);
          ctx.clip();
          const drewMeAvatar = safeDrawRecordingAvatarImage(ctx, meAvatar, px + 16, py + 1, 30, 30);
          ctx.restore();
          if (!drewMeAvatar) meAvatar = null;
        }
        if (!meAvatar) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "800 10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(me.initials, px + 31, py + 16);
        }

        ctx.textAlign = "left";
        ctx.fillStyle = "#1b2632";
        ctx.font = "700 10px system-ui, sans-serif";
        ctx.fillText(me.name, px + 55, py + 11);
        ctx.fillStyle = "#8e98a4";
        ctx.font = "8px system-ui, sans-serif";
        ctx.fillText("Participant", px + 55, py + 24);
        py += 40;
      }

      state.fakePeople.forEach(function(person) {
        const initials = person.initials || initialsFor(person.name);
        ctx.fillStyle = "hsl(" + person.hue + ",65%,45%)";
        roundedRectPath(ctx, px + 15, py, 32, 32, 9);
        ctx.fill();

        const recordingAvatar = getRecordingAvatarImage(person);
        if (recordingAvatar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(px + 31, py + 16, 15, 0, Math.PI * 2);
          ctx.clip();
          const drewPersonAvatar = safeDrawRecordingAvatarImage(ctx, recordingAvatar, px + 16, py + 1, 30, 30);
          ctx.restore();
          if (!drewPersonAvatar) recordingAvatar = null;
        }
        if (!recordingAvatar) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "800 10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(initials, px + 31, py + 16);
        }

        ctx.textAlign = "left";
        ctx.fillStyle = "#1b2632";
        ctx.font = "700 10px system-ui, sans-serif";
        ctx.fillText(person.name, px + 55, py + 12);
        ctx.fillStyle = "#8e98a4";
        ctx.font = "8px system-ui, sans-serif";
        const hostText = person.id === state.hostId ? "Host" : "Participant";
        const videoText = getVideos(person).length ? (person.cameraVisible === false ? " · Camera hidden" : " · " + getVideos(person).length + " video" + (getVideos(person).length === 1 ? "" : "s")) : "";
        const audioText = person.audioOn === false ? " · Muted" : "";
        ctx.fillText(hostText + videoText + audioText, px + 55, py + 25);
        py += 40;
      });

      // The recorded Participants panel includes Me by name and role, but
      // does not include the Add fake person control.
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
    {label: "Participants " + people.length, x: 202, icon: "users"},
    {label: "Chat", x: 298, icon: "chat"},
    {label: state.shareOn ? "Stop Share" : "Share Screen", x: 394, icon: "share"},
    // Keep the recording control visually neutral in the exported video.
    {label: "Record", x: 506, icon: "record"},
    {label: "More", x: 618, icon: "more"}
  ];

  controlItems.forEach(function(item) {
    const selected = item.label.indexOf("Participants") === 0 ? state.participantsOpen : (item.label === "Chat" ? state.chatOpen : false);
    if (selected) {
      ctx.fillStyle = "rgba(255,255,255,.07)";
      roundedRectPath(ctx, item.x - 18, cy + 6, 64, 50, 9);
      ctx.fill();
    }

    drawRecordingControlIcon(ctx, item.icon, item.x + 14, cy + 20, 19, "#dce3eb");

    ctx.fillStyle = "#dce3eb";
    ctx.font = "800 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, item.x + 14, cy + 45);
  });

  // End call.
  ctx.fillStyle = "#df3e48";
  roundedRectPath(ctx, width - 78, cy + 17, 62, 38, 8);
  ctx.fill();
  drawRecordingControlIcon(ctx, "phone", width - 56, cy + 29, 15, "#ffffff");
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 8px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("End", width - 45, cy + 37);

  recordingState.animationFrame = requestAnimationFrame(drawRecordingFrame);
}

async function syncRecordingAudio() {
  if (!recordingState.audioContext || !recordingState.audioDestination) return;

  const currentVideos = Array.from(document.querySelectorAll("video.participant-video[data-person-id]"));
  const currentSet = new Set(currentVideos);

  for (const [video, entry] of recordingState.mediaSources.entries()) {
    if (!currentSet.has(video)) {
      try { entry.gain.disconnect(); } catch (error) {}
      try { entry.source.disconnect(); } catch (error) {}
      recordingState.mediaSources.delete(video);
    }
  }

  for (const video of currentVideos) {
    let entry = recordingState.mediaSources.get(video);

    if (!entry) {
      try {
        if (typeof video.captureStream !== "function" && typeof video.mozCaptureStream !== "function") {
          continue;
        }

        const captureStream = (video.captureStream || video.mozCaptureStream).call(video);
        const audioTracks = captureStream.getAudioTracks();
        if (!audioTracks.length) continue;

        const stream = new MediaStream(audioTracks);
        const source = recordingState.audioContext.createMediaStreamSource(stream);
        const gain = recordingState.audioContext.createGain();
        source.connect(gain);
        gain.connect(recordingState.audioDestination);

        entry = { stream: stream, source: source, gain: gain };
        recordingState.mediaSources.set(video, entry);
      } catch (error) {
        console.warn("Could not attach participant audio to recording.", error);
        continue;
      }
    }

    entry.gain.gain.value = state.audioEnabled && isPersonAudioOn(getParticipant(video.dataset.personId)) ? 1 : 0;
  }

  if (recordingState.audioContext.state === "suspended") {
    try { await recordingState.audioContext.resume(); } catch (error) {}
  }
}

function formatRecordingTime(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = function(value) { return String(value).padStart(2, "0"); };
  return hours > 0 ? hours + ":" + pad(minutes) + ":" + pad(seconds) : pad(minutes) + ":" + pad(seconds);
}

function startRecordingTimer() {
  if (recordingState.timer) clearInterval(recordingState.timer);
  recordingState.startedAt = Date.now();
  state.recordingElapsedMs = 0;

  recordingState.timer = setInterval(function() {
    if (!state.recording || !recordingState.startedAt) return;
    state.recordingElapsedMs = Date.now() - recordingState.startedAt;
    updateRecordingControls();
  }, 250);
}

function stopRecordingTimer() {
  if (recordingState.timer) {
    clearInterval(recordingState.timer);
    recordingState.timer = 0;
  }
}

function updateRecordingControls() {
  document.querySelectorAll('[data-action="toggle-recording"]').forEach(function(button) {
    const processing = state.recordingBusy && !state.recording;
    button.classList.toggle("recording-active", state.recording);
    button.classList.toggle("recording-processing", processing);
    button.disabled = processing;
    button.setAttribute("aria-busy", processing ? "true" : "false");

    let label = "Record";
    let buttonIcon = "record";
    let runtime = "";
    if (state.recording) {
      label = "Stop Recording";
      buttonIcon = "stop";
      runtime = '<small class="recording-runtime">' + formatRecordingTime(state.recordingElapsedMs) + '</small>';
    } else if (processing) {
      const percent = Math.max(0, Math.min(100, Math.round(state.recordingProgress || 0)));
      label = percent ? "MP4 " + percent + "%" : "Making MP4…";
      buttonIcon = "record";
    }

    button.innerHTML = icon(buttonIcon) + "<span>" + label + "</span>" + runtime;
  });
}

async function startRecording() {
  if (state.recording || state.recordingBusy || state.page !== "meeting") return;

  if (typeof MediaRecorder === "undefined") {
    alert("This browser does not support meeting recording.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;

  const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!context) {
    alert("Could not create the meeting recording canvas.");
    return;
  }

  recordingState.canvas = canvas;
  recordingState.context = context;
  recordingState.chunks = [];
  recordingState.recordingProgress = 0;
  state.recordingProgress = 0;
  state.recordingNumber += 1;
  state.recordingElapsedMs = 0;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    recordingState.audioContext = new AudioContextClass();
    recordingState.audioDestination = recordingState.audioContext.createMediaStreamDestination();

    setupRecordingLeaveSound();
    await syncRecordingAudio();
    try { await recordingState.audioContext.resume(); } catch (error) {}
  }

  const canvasStream = canvas.captureStream(30);
  const stream = new MediaStream();
  recordingState.sourceStream = stream;

  const videoTrack = canvasStream.getVideoTracks()[0];
  if (videoTrack) stream.addTrack(videoTrack);

  if (recordingState.audioDestination) {
    const audioTrack = recordingState.audioDestination.stream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);
  }

  const directMp4Types = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4"
  ];
  const webmTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  const directMp4Type = directMp4Types.find(function(type) {
    return MediaRecorder.isTypeSupported(type);
  });
  const webmType = webmTypes.find(function(type) {
    return MediaRecorder.isTypeSupported(type);
  });
  const mimeType = directMp4Type || webmType || "";

  try {
    recordingState.recorder = mimeType
      ? new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: 6_000_000,
          audioBitsPerSecond: 128_000
        })
      : new MediaRecorder(stream, {
          videoBitsPerSecond: 6_000_000,
          audioBitsPerSecond: 128_000
        });
  } catch (error) {
    recordingState.recorder = null;
    cleanupRecording();
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

  recordingState.recorder.onerror = function(event) {
    console.error("Meeting recorder error", event.error || event);
    state.recording = false;
    stopRecordingTimer();
    state.recordingBusy = false;
    cancelAnimationFrame(recordingState.animationFrame);
    cleanupRecording();
    updateRecordingControls();
    alert("The meeting recording stopped because the browser reported an error.");
  };

  state.recording = true;
  state.recordingBusy = false;
  startRecordingTimer();
  updateRecordingControls();
  drawRecordingFrame();

  try {
    recordingState.recorder.start(750);
  } catch (error) {
    state.recording = false;
    cleanupRecording();
    updateRecordingControls();
    alert("Could not start the meeting recording.");
    return;
  }

  getRecordingFFmpeg().catch(function(error) {
    console.warn("FFmpeg warm-up failed; conversion will retry at stop.", error);
  });

  syncAudioIndicator();
}

async function stopRecording() {
  if (!state.recording || !recordingState.recorder) return;

  state.recording = false;
  stopRecordingTimer();
  state.recordingBusy = true;
  state.recordingProgress = 0;
  updateRecordingControls();
  cancelAnimationFrame(recordingState.animationFrame);

  try {
    recordingState.recorder.stop();
  } catch (error) {
    state.recordingBusy = false;
    cleanupRecording();
    updateRecordingControls();
  }
}

async function finishRecording(chunks, sourceType) {
  const normalizedType = String(sourceType || "video/webm").toLowerCase();
  const isDirectMp4 = normalizedType.indexOf("video/mp4") === 0;
  const sourceBlob = new Blob(chunks, { type: normalizedType });

  try {
    if (isDirectMp4) {
      downloadRecordingFile(sourceBlob, "mp4");
      return;
    }

    const ffmpeg = await getRecordingFFmpeg();
    state.recordingProgress = 8;
    updateRecordingControls();

    try { await ffmpeg.deleteFile("meeting.webm"); } catch (error) {}
    try { await ffmpeg.deleteFile("meeting.mp4"); } catch (error) {}

    await ffmpeg.writeFile("meeting.webm", await fetchFile(sourceBlob));
    state.recordingProgress = 20;
    updateRecordingControls();

    let converted = false;
    let firstError = null;

    try {
      await ffmpeg.exec([
        "-threads", "1",
        "-i", "meeting.webm",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-f", "mp4",
        "meeting.mp4"
      ]);
      converted = true;
    } catch (error) {
      firstError = error;
      try { await ffmpeg.deleteFile("meeting.mp4"); } catch (error) {}
    }

    if (!converted) {
      try {
        await ffmpeg.exec([
          "-threads", "1",
          "-i", "meeting.webm",
          "-c:v", "mpeg4",
          "-q:v", "5",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          "-f", "mp4",
          "meeting.mp4"
        ]);
        converted = true;
      } catch (error) {
        console.error("Primary MP4 encoder failed", firstError, error);
      }
    }

    if (!converted) {
      throw new Error("The bundled FFmpeg encoder could not create an MP4.");
    }

    const data = await ffmpeg.readFile("meeting.mp4");
    const byteLength = data && data.byteLength != null ? data.byteLength : data.length;
    if (!data || !byteLength) throw new Error("FFmpeg produced an empty MP4 file.");

    state.recordingProgress = 96;
    updateRecordingControls();

    const mp4Blob = new Blob([data.buffer || data], { type: "video/mp4" });
    downloadRecordingFile(mp4Blob, "mp4");

    try { await ffmpeg.deleteFile("meeting.webm"); } catch (error) {}
    try { await ffmpeg.deleteFile("meeting.mp4"); } catch (error) {}
  } catch (error) {
    console.error("Meeting MP4 conversion failed", error);
    alert("The recording could not be converted to MP4. No WebM file was downloaded.");
  } finally {
    state.recordingBusy = false;
    state.recordingProgress = 0;
    recordingState.recordingProgress = 0;
    cleanupRecording();
    updateRecordingControls();
    syncAudioIndicator();
  }
}

function downloadRecordingFile(blob, extension) {
  if (!blob || !blob.size) throw new Error("The recording file is empty.");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const recordingNumber = Math.max(1, Number(state.recordingNumber) || 1);
  link.download = "zoom-copy-meeting-recording-" + recordingNumber + "-" + new Date().toISOString().replace(/[:.]/g, "-") + "." + extension;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
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
    ffmpeg.on("progress", function(event) {
      if (!state.recordingBusy) return;
      const progress = Number(event && event.progress);
      if (!Number.isFinite(progress)) return;
      state.recordingProgress = Math.max(20, Math.min(94, Math.round(20 + progress * 74)));
      recordingState.recordingProgress = state.recordingProgress;
      updateRecordingControls();
    });

    await ffmpeg.load({
      coreURL: "./ffmpeg/ffmpeg-core.js",
      wasmURL: "./ffmpeg/ffmpeg-core.wasm"
    });

    recordingState.ffmpeg = ffmpeg;
    return ffmpeg;
  } finally {
    recordingState.ffmpegLoading = false;
  }
}

function cleanupRecording() {
  stopRecordingTimer();
  if (recordingState.animationFrame) {
    cancelAnimationFrame(recordingState.animationFrame);
    recordingState.animationFrame = 0;
  }
  if (recordingState.recorder && recordingState.recorder.state !== "inactive") {
    try { recordingState.recorder.stop(); } catch (error) {}
  }
  recordingState.mediaSources.forEach(function(entry) {
    try { entry.gain.disconnect(); } catch (error) {}
    try { entry.source.disconnect(); } catch (error) {}
    if (entry.stream) {
      entry.stream.getTracks().forEach(function(track) {
        try { track.stop(); } catch (error) {}
      });
    }
  });
  recordingState.mediaSources.clear();
  recordingAvatarImages.clear();

  if (recordingState.leaveAudio) {
    try { recordingState.leaveAudio.pause(); } catch (error) {}
    try { recordingState.leaveAudio.currentTime = 0; } catch (error) {}
  }
  if (recordingState.leaveGain) {
    try { recordingState.leaveGain.disconnect(); } catch (error) {}
  }
  if (recordingState.leaveSource) {
    try { recordingState.leaveSource.disconnect(); } catch (error) {}
  }
  recordingState.leaveAudio = null;
  recordingState.leaveGain = null;
  recordingState.leaveSource = null;

  if (recordingState.audioContext) {
    try { recordingState.audioContext.close(); } catch (error) {}
  }

  if (recordingState.sourceStream) {
    recordingState.sourceStream.getTracks().forEach(function(track) {
      try { track.stop(); } catch (error) {}
    });
  }

  recordingState.recorder = null;
  recordingState.audioContext = null;
  recordingState.audioDestination = null;
  recordingState.sourceStream = null;
  recordingState.canvas = null;
  recordingState.context = null;
  recordingState.chunks = [];
  recordingState.recordingProgress = 0;
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
      if (a === "open-saved-meeting") {
        openSavedMeeting(el.dataset.meetingId);
        return;
      }
      if (a === "start-meeting") {
        destroyRoomConnection();
        state.meetingId = generateMeetingId();
        while (state.savedMeetings.some(function(meeting) { return meeting.id === state.meetingId; })) {
          state.meetingId = generateMeetingId();
        }
        state.page = "meeting";
        state.meetingStarted = true;
        state.chatOpen = false;
        state.participantsOpen = true;
        render();
        startHostRoom();
        queueMeetingSave();
        return;
      }
      if (a === "join-meeting") {
        openJoinMeetingDialog();
        return;
      }
      if (a === "leave-remote-meeting") {
        destroyRoomConnection();
        state.page = "home";
        state.meetingStarted = false;
        render();
        return;
      }
      if (a === "open-participants") {
        if (state.roomMode === "watcher") return;
        if (state.page !== "meeting") {
          destroyRoomConnection();
          state.meetingId = generateMeetingId();
          state.page = "meeting";
          state.meetingStarted = true;
          state.participantsOpen = true;
          state.chatOpen = false;
          render();
          startHostRoom();
          queueMeetingSave();
        } else {
          state.participantsOpen = true;
          render();
        }
        return;
      }
      if (a === "open-tutorial") {
        openTutorial(false);
        return;
      }
      if (a === "end-meeting") {
        destroyRoomConnection();
        state.page = "home";
        state.meetingStarted = false;
        render();
        return;
      }
      if (a === "toggle-mic") state.micOn = !state.micOn;
      if (a === "toggle-camera") {
        state.cameraOn = !state.cameraOn;
        state.cameraHidden.me = !state.cameraOn;
        updateParticipantTile("me");
        updateParticipantsListOnly();
        if (state.recording) syncRecordingAudio();
        queueMeetingSave();
        return;
      }
      if (a === "toggle-participants") state.participantsOpen = !state.participantsOpen;
      if (a === "toggle-participant-options") { state.participantOptionsOpen = !state.participantOptionsOpen; render(); return; }
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
      if (a === "make-host") { makeHost(el.dataset.personId); return; }
      if (a === "join-back") { 
        if (el.dataset.personId === "me") joinBackParticipant("me");
        else undoLastLeave();
        return;
      }
      if (a === "restart-clip") { restartPersonClip(el.dataset.personId); return; }
      if (a === "toggle-clip") { togglePersonClip(el.dataset.personId); return; }
      if (a === "leave-person") { leavePerson(el.dataset.personId); return; }
      if (a === "add-video") { openFakeCameraPicker(); return; }
      if (a === "toggle-person-audio") {
        const personId = el.dataset.personId;
        setAudioForPerson(personId, !isPersonAudioOn(getParticipant(personId)));
        return;
      }
      if (a === "contacts") {
        const existingContacts = document.querySelector(".contacts-modal-backdrop");
        if (existingContacts) existingContacts.remove();
        const contactsModal = document.createElement("div");
        contactsModal.className = "tutorial-backdrop contacts-modal-backdrop";
        contactsModal.innerHTML = '<div class="tutorial-card contacts-card" role="dialog" aria-modal="true"><button type="button" class="tutorial-close contacts-close" aria-label="Close contacts">×</button><div class="tutorial-icon">' + icon("users") + '</div><span class="eyebrow">Contacts</span><h2>Your contacts</h2><p class="tutorial-body">This demo does not connect to a real contacts service yet. Start a meeting or add fake participants to build your test room.</p><div class="tutorial-actions"><span></span><button type="button" class="secondary contacts-close-button">Close</button><button type="button" class="primary contacts-meeting">Go to meeting</button></div></div>';
        document.body.appendChild(contactsModal);
        contactsModal.querySelectorAll(".contacts-close, .contacts-close-button").forEach(function(button) {
          button.addEventListener("click", function() { contactsModal.remove(); });
        });
        contactsModal.querySelector(".contacts-meeting").addEventListener("click", function() {
          contactsModal.remove();
          state.page = "meeting";
          state.meetingStarted = true;
          state.participantsOpen = true;
          render();
        });
        return;
      }
      render();
    });
  });
  document.querySelectorAll("video.participant-video").forEach(function(v) {
    wireParticipantVideo(v);
  });

  const pauseAllInput = document.querySelector("[data-pause-all-keybind]");
  if (pauseAllInput) {
    pauseAllInput.addEventListener("keydown", function(e) {
      if (["Tab", "Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "Escape") {
        setPauseAllKeybind("");
        pauseAllInput.value = "";
        queueMeetingSave();
        return;
      }
      if (/^[a-z0-9]$/i.test(e.key) && e.key !== "0") {
        setPauseAllKeybind(e.key);
        pauseAllInput.value = e.key.toUpperCase();
        queueMeetingSave();
      }
    });
    pauseAllInput.addEventListener("focus", function() { pauseAllInput.select(); });
  }

  const participantSearch = document.querySelector("[data-participant-search]");
  if (participantSearch) {
    participantSearch.addEventListener("input", function() {
      state.participantSearch = participantSearch.value;
      const list = document.querySelector(".participant-list");
      if (!list) return;
      const wrapper = document.createElement("template");
      wrapper.innerHTML = renderParticipants().trim();
      const newPanel = wrapper.content.firstElementChild;
      if (!newPanel) return;
      const currentPanel = document.querySelector(".participants-panel");
      if (currentPanel) currentPanel.replaceWith(newPanel);
      bind();
      const newSearch = document.querySelector("[data-participant-search]");
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
      }
    });
  }

  syncAudioIndicator();
}


window.addEventListener("keydown", function(e) {
  if (state.page !== "meeting") return;
  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || e.isComposing) return;
  const key = String(e.key || "").toLowerCase();

  if (key === "/") {
    e.preventDefault();
    restartAllClips();
    return;
  }

  if (!/^[a-z0-9]$/.test(key)) return;

  if (key === "0") {
    e.preventDefault();
    undoLastLeave();
    return;
  }

  const cameraPersonId = Object.keys(state.keybinds || {}).find(function(id) {
    return state.keybinds[id] === key;
  });
  if (cameraPersonId) {
    e.preventDefault();
    togglePersonCamera(cameraPersonId);
    return;
  }

  const nextPersonId = Object.keys(state.nextKeybinds || {}).find(function(id) {
    return state.nextKeybinds[id] === key;
  });
  if (nextPersonId) {
    e.preventDefault();
    advancePersonVideo(nextPersonId);
    return;
  }

  const leavePersonId = Object.keys(state.leaveKeybinds || {}).find(function(id) {
    return state.leaveKeybinds[id] === key;
  });
  if (leavePersonId) {
    e.preventDefault();
    leavePerson(leavePersonId);
    return;
  }

  if (state.pauseAllKeybind && state.pauseAllKeybind === key) {
    e.preventDefault();
    togglePauseAllVideos();
    return;
  }

  const restartPersonId = Object.keys(state.restartKeybinds || {}).find(function(id) {
    return state.restartKeybinds[id] === key;
  });
  if (restartPersonId) {
    e.preventDefault();
    restartPersonClip(restartPersonId);
    return;
  }

  const pausePersonId = Object.keys(state.pauseKeybinds || {}).find(function(id) {
    return state.pauseKeybinds[id] === key;
  });
  if (pausePersonId) {
    e.preventDefault();
    togglePersonClip(pausePersonId);
    return;
  }

  const audioPersonId = Object.keys(state.audioKeybinds || {}).find(function(id) {
    return state.audioKeybinds[id] === key;
  });
  if (audioPersonId) {
    e.preventDefault();
    setAudioForPerson(audioPersonId, !isPersonAudioOn(getParticipant(audioPersonId)));
  }
});

async function bootMeetingApp() {
  await loadSavedMeetingLibrary();
  const restored = await restoreSavedMeeting();
  normalizeHosts();
  render();
  if (restored) {
    restorePersistedPlayback();
    startHostRoom();
  }
  showFirstTimeTutorial();
}

window.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") queueMeetingSave(0);
});

window.addEventListener("pagehide", function() {
  queueMeetingSave(0);
});

setInterval(function() {
  queueMeetingSave();
}, 5000);

bootMeetingApp();
