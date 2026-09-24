// ============================================================================
// PROJECT: ESTIQATSY BOT & RPG PLATFORM
// FILE: js/audio.js (VERSIONE 60.0 - SEAMLESS AUTOPLAY & DUAL BACKGROUND ENGINE)
// ============================================================================

const SoundEngine = (function() {
  'use strict';

  const ICONS = {
    play: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    prev: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
    next: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`,
    shuffle: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>`,
    loop: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>`,
    heartOutline: `<svg class="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
    heartFilled: `<svg class="w-4 h-4 fill-[#10B981] stroke-[#10B981] stroke-2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
    volumeOn: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
    volumeOff: `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`
  };

  const APP_NAME = "estiqatsy";
  const AUDIUS_DISCOVERY_URL = "https://discoveryprovider.audius.co/v1";

  const DEFAULT_MASTER = 0.85;
  const DEFAULT_BGM = 0.45;
  const DEFAULT_SFX = 0.90;

  const storedMute = localStorage.getItem("estiqatsy_audio_muted");
  let isMasterMuted = storedMute !== null ? storedMute === "true" : false;
  let isBgmMuted = localStorage.getItem("estiqatsy_bgm_muted") === "true";
  let isSfxMuted = localStorage.getItem("estiqatsy_sfx_muted") === "true";
  let isShuffle = localStorage.getItem("estiqatsy_audio_shuffle") === "true";
  let isLoop = localStorage.getItem("estiqatsy_audio_loop") === "true";

  let currentMasterVolume = parseFloat(localStorage.getItem("estiqatsy_master_volume")) || DEFAULT_MASTER;
  let currentBgmVolume = parseFloat(localStorage.getItem("estiqatsy_bgm_volume")) || DEFAULT_BGM;
  let currentSfxVolume = parseFloat(localStorage.getItem("estiqatsy_sfx_volume")) || DEFAULT_SFX;

  const STATIONS = {
    boombap: { id: "boombap", name: "Darsena 90s (Boom Bap)", query: "boombap", emoji: "📻" },
    chiptune: { id: "chiptune", name: "Cabinato Arcade (8-Bit)", query: "chiptune 8bit", emoji: "👾" },
    noir: { id: "noir", name: "Bisca & Molo (Dark Jazz)", query: "dark jazz noir", emoji: "🎷" },
    lofi: { id: "lofi", name: "Fosso Burlamacca (Lo-Fi)", query: "lofi hiphop instrumental", emoji: "☕" },
    favorites: { id: "favorites", name: "I Miei Preferiti", query: null, emoji: "❤️" }
  };

  const EPISODE_SOUNDTRACKS = {
    1: { id: "mgb9p", title: "The Shadow Side", artist: "DJ N47", emoji: "🎷", src: `${AUDIUS_DISCOVERY_URL}/tracks/mgb9p/stream?app_name=${APP_NAME}`, duration: 228 },
    2: { id: "ZrOYoXq", title: "Lil Classic BoomBap", artist: "Ljazz", emoji: "📻", src: `${AUDIUS_DISCOVERY_URL}/tracks/ZrOYoXq/stream?app_name=${APP_NAME}`, duration: 130 },
    3: { id: "X6M2a", title: "BOOMBAP 00", artist: "Rafa Halë", emoji: "📻", src: `${AUDIUS_DISCOVERY_URL}/tracks/X6M2a/stream?app_name=${APP_NAME}`, duration: 235 },
    4: { id: "9dk1j1k", title: "Gemkeepers Beat", artist: "Surce", emoji: "📻", src: `${AUDIUS_DISCOVERY_URL}/tracks/9dk1j1k/stream?app_name=${APP_NAME}`, duration: 249 },
    5: { id: "dago7mP", title: "h8rs Serious", artist: "Surce", emoji: "☕", src: `${AUDIUS_DISCOVERY_URL}/tracks/dago7mP/stream?app_name=${APP_NAME}`, duration: 223 },
    6: { id: "A7Nqg", title: "FREE$TYLER (Fast)", artist: "WhoIsSanchez", emoji: "👾", src: `${AUDIUS_DISCOVERY_URL}/tracks/A7Nqg/stream?app_name=${APP_NAME}`, duration: 219 },
    7: { id: "Y5wybJ7", title: "AMEN BoomBap", artist: "GMLX", emoji: "🎤", src: `${AUDIUS_DISCOVERY_URL}/tracks/Y5wybJ7/stream?app_name=${APP_NAME}`, duration: 128 },
    8: { id: "mgb9p", title: "Darsena Noir Vinyl", artist: "DJ N47", emoji: "🎷", src: `${AUDIUS_DISCOVERY_URL}/tracks/mgb9p/stream?app_name=${APP_NAME}`, duration: 228 },
    9: { id: "ZrOYoXq", title: "Clandestino 90s", artist: "Ljazz", emoji: "📻", src: `${AUDIUS_DISCOVERY_URL}/tracks/ZrOYoXq/stream?app_name=${APP_NAME}`, duration: 130 },
    10: { id: "X6M2a", title: "Rhodes del Fosso", artist: "Rafa Halë", emoji: "📻", src: `${AUDIUS_DISCOVERY_URL}/tracks/X6M2a/stream?app_name=${APP_NAME}`, duration: 235 },
    11: { id: "9dk1j1k", title: "Inchiesta Demaniale", artist: "Surce", emoji: "📻", src: `${AUDIUS_DISCOVERY_URL}/tracks/9dk1j1k/stream?app_name=${APP_NAME}`, duration: 249 },
    12: { id: "dago7mP", title: "Molo Sbarrato", artist: "Surce", emoji: "☕", src: `${AUDIUS_DISCOVERY_URL}/tracks/dago7mP/stream?app_name=${APP_NAME}`, duration: 223 },
    13: { id: "A7Nqg", title: "Frequenze VHF Beat", artist: "WhoIsSanchez", emoji: "👾", src: `${AUDIUS_DISCOVERY_URL}/tracks/A7Nqg/stream?app_name=${APP_NAME}`, duration: 219 },
    14: { id: "Y5wybJ7", title: "Tariq Duello Beat", artist: "GMLX", emoji: "🎤", src: `${AUDIUS_DISCOVERY_URL}/tracks/Y5wybJ7/stream?app_name=${APP_NAME}`, duration: 128 },
    15: { id: "mgb9p", title: "Assalto alle Banchine", artist: "DJ N47", emoji: "🎷", src: `${AUDIUS_DISCOVERY_URL}/tracks/mgb9p/stream?app_name=${APP_NAME}`, duration: 228 },
    16: { id: "ZrOYoXq", title: "Fuga tra i Cantieri", artist: "Ljazz", emoji: "📻", src: `${AUDIUS_DISCOVERY_URL}/tracks/ZrOYoXq/stream?app_name=${APP_NAME}`, duration: 130 },
    17: { id: "X6M2a", title: "Notte a Burlamacca", artist: "Rafa Halë", emoji: "📻", src: `${AUDIUS_DISCOVERY_URL}/tracks/X6M2a/stream?app_name=${APP_NAME}`, duration: 235 },
    18: { id: "9dk1j1k", title: "Resa con i Mazzu", artist: "Surce", emoji: "📻", src: `${AUDIUS_DISCOVERY_URL}/tracks/9dk1j1k/stream?app_name=${APP_NAME}`, duration: 249 },
    19: { id: "dago7mP", title: "Climax al Tramonto", artist: "Surce", emoji: "☕", src: `${AUDIUS_DISCOVERY_URL}/tracks/dago7mP/stream?app_name=${APP_NAME}`, duration: 223 },
    20: { id: "A7Nqg", title: "Epilogo del Sindaco", artist: "WhoIsSanchez", emoji: "👾", src: `${AUDIUS_DISCOVERY_URL}/tracks/A7Nqg/stream?app_name=${APP_NAME}`, duration: 219 }
  };

  let activeStationKey = "boombap";
  let playbackSource = "radio"; // "radio" (background continuato) | "game" (si spegne su lock screen)
  let playlist = [];
  let currentTrackIndex = 0;
  let currentTrack = null;
  let currentHowl = null;
  let heartbeatHowl = null;

  let progressTimer = null;
  let searchDebounceTimer = null;
  let searchResults = [];

  const sfxUrls = {
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    card_flip: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    insert_coin: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3",
    cash_register: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    victory: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    error: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    heartbeat: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",

    card_enemy: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    card_event: "https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3",
    card_enigma: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    card_helper: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    card_shop: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
    card_story: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",

    combat_hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    combat_miss: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    combat_crit: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    combat_fumble: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    combat_hurt: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",

    zombie_spectral: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",
    cure_1up: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3",
    drug_snort: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3",
    bribe_deal: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3"
  };

  const sfxPlayers = {};

  function getFavorites() {
    try {
      const raw = localStorage.getItem("estiqatsy_radio_favorites");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(favs) {
    try {
      localStorage.setItem("estiqatsy_radio_favorites", JSON.stringify(favs));
    } catch (e) {}
  }

  function isFavorite(trackId) {
    if (!trackId) return false;
    return getFavorites().some(f => String(f.id) === String(trackId));
  }

  function toggleFavorite(track) {
    if (!track) return;
    let favs = getFavorites();
    const idx = favs.findIndex(f => String(f.id) === String(track.id));
    if (idx !== -1) {
      favs.splice(idx, 1);
    } else {
      favs.unshift({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artwork: track.artwork || null,
        emoji: track.emoji || "🎵",
        src: track.src,
        duration: track.duration || 180
      });
    }
    saveFavorites(favs);
    renderModalDeck();
    if (activeStationKey === "favorites") {
      playlist = getFavorites();
      renderModalTracklist();
    }
  }

  function setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => SoundEngine.togglePlayPause());
      navigator.mediaSession.setActionHandler('pause', () => SoundEngine.togglePlayPause());
      navigator.mediaSession.setActionHandler('previoustrack', () => SoundEngine.playPrevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => SoundEngine.playNextTrack());
      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime && currentHowl) currentHowl.seek(details.seekTime);
        });
      } catch (e) {}
    }
  }

  function syncMediaSessionMetadata(track) {
    if ('mediaSession' in navigator && track) {
      const artSrc = track.artwork || "https://image.pollinations.ai/prompt/dark-noir-vintage-record-cover?width=512&height=512&nologo=true";
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || "Frequenza Clandestina",
        artist: track.artist || "Darsena Syndicate",
        album: "Estiqatsy Noir Radio",
        artwork: [
          { src: artSrc, sizes: '150x150', type: 'image/jpeg' },
          { src: artSrc, sizes: '480x480', type: 'image/jpeg' },
          { src: artSrc, sizes: '512x512', type: 'image/png' }
        ]
      });
      navigator.mediaSession.playbackState = (currentHowl && currentHowl.playing()) ? 'playing' : 'paused';
    }
  }

  function injectExpandedModal() {
    let modal = document.getElementById("modal-syndicate-radio");
    if (!modal) {
      modal = document.createElement("dialog");
      modal.id = "modal-syndicate-radio";
      modal.className = "modal modal-middle";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-box p-4 bg-[#070A12] border border-sky-400/40 rounded-2xl max-w-sm space-y-3 relative shadow-2xl">
        <button onclick="document.getElementById('modal-syndicate-radio').close()" class="modal-close-btn absolute top-3 right-3 w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white z-50 text-xs font-black">✕</button>

        <div class="flex items-center gap-2 pr-8 border-b border-white/10 pb-2">
          <span class="text-xl">🎛️</span>
          <div>
            <h3 class="font-black text-xs text-white uppercase tracking-wider">Frequenze Clandestine</h3>
            <span class="text-[9.5px] font-mono text-sky-400" id="deck-station-label">Darsena 90s (Boom Bap)</span>
          </div>
        </div>

        <div class="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 space-y-2.5">
          <div class="flex items-center justify-between gap-2.5">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <div class="w-12 h-12 rounded-xl bg-black border border-white/10 flex items-center justify-center text-2xl overflow-hidden shrink-0" id="deck-artwork-box">
                📻
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="text-xs font-black text-white truncate" id="deck-track-title">Caricamento traccia...</h4>
                <div class="text-[10px] text-slate-400 truncate mt-0.5" id="deck-track-artist">Emittente Darsena</div>
              </div>
            </div>
            <button onclick="SoundEngine.toggleCurrentFavorite()" id="deck-btn-heart" class="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition shrink-0" title="Preferiti">
              ${ICONS.heartOutline}
            </button>
          </div>

          <div class="space-y-1">
            <input type="range" id="deck-progress-bar" min="0" max="100" value="0" class="spotify-scrubber" oninput="SoundEngine.seekProgress(this.value)">
            <div class="flex justify-between text-[9px] font-mono text-slate-400">
              <span id="deck-time-current">0:00</span>
              <span id="deck-time-total">--:--</span>
            </div>
          </div>

          <div class="flex items-center justify-center gap-4 pt-1">
            <button onclick="SoundEngine.toggleShuffle()" id="deck-btn-shuffle" class="text-slate-400 hover:text-white" title="Casuale">
              ${ICONS.shuffle}
            </button>
            <button onclick="SoundEngine.playPrevTrack()" class="text-slate-300 hover:text-white" title="Precedente">
              ${ICONS.prev}
            </button>
            <button onclick="SoundEngine.togglePlayPause()" id="deck-btn-play" class="w-9 h-9 rounded-full bg-white text-slate-950 flex items-center justify-center font-black shadow-lg hover:scale-105 transition" title="Play/Pausa">
              ${ICONS.play}
            </button>
            <button onclick="SoundEngine.playNextTrack()" class="text-slate-300 hover:text-white" title="Successivo">
              ${ICONS.next}
            </button>
            <button onclick="SoundEngine.toggleLoop()" id="deck-btn-loop" class="text-slate-400 hover:text-white" title="Ripeti">
              ${ICONS.loop}
            </button>
          </div>

          <div class="flex items-center gap-2 pt-1 border-t border-white/5">
            <button onclick="SoundEngine.toggleMute()" id="deck-btn-mute" class="text-slate-400 hover:text-white shrink-0">
              ${ICONS.volumeOn}
            </button>
            <input type="range" id="deck-volume-slider" min="0" max="1" step="0.01" class="spotify-scrubber flex-1" oninput="SoundEngine.setBgmVolume(this.value)">
          </div>
        </div>

        <div class="space-y-1.5 pt-0.5">
          <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase font-bold">
            <span>Stazioni Clandestine</span>
            <button onclick="SoundEngine.playActiveStation()" class="text-sky-400 hover:underline">Riproduci Tutte ▶️</button>
          </div>
          <div class="chips-scroll-bar flex gap-1.5 overflow-x-auto py-1" id="deck-station-chips">
            ${Object.values(STATIONS).map(st => `
              <button onclick="SoundEngine.switchStation('${st.id}')" class="rpg-category-chip ${st.id === activeStationKey ? 'active' : ''}" id="chip-station-${st.id}">
                ${st.emoji} ${st.name}
              </button>
            `).join("")}
          </div>
        </div>

        <div class="space-y-1.5 pt-0.5">
          <div class="relative">
            <input type="text" id="deck-search-input" placeholder="Cerca frequenza o brano..." oninput="SoundEngine.handleSearchInput(this.value)" class="input input-xs w-full bg-slate-900 border border-white/10 text-white rounded-lg text-xs pl-7">
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">🔍</span>
          </div>
          <div class="space-y-1 max-h-36 overflow-y-auto pr-1" id="deck-tracklist-container"></div>
        </div>
      </div>
    `;
  }

  function mountMiniWidget() {
    injectExpandedModal();

    let mountEl = document.getElementById("radio-widget-mount");
    if (!mountEl) {
      const homeScreen = document.getElementById("view-home");
      if (homeScreen) {
        mountEl = document.createElement("div");
        mountEl.id = "radio-widget-mount";
        const banner = homeScreen.querySelector(".home-hero-banner");
        if (banner && banner.nextSibling) homeScreen.insertBefore(mountEl, banner.nextSibling);
        else homeScreen.prepend(mountEl);
      }
    }

    if (!mountEl) return;

    if (mountEl.querySelector(".syndicate-mini-player")) {
      updateUI();
      return;
    }

    mountEl.className = "w-full cursor-pointer";
    mountEl.onclick = () => SoundEngine.openModal();

    mountEl.innerHTML = `
      <div class="syndicate-mini-player">
        <div class="mini-player-art-box">
          <span id="mini-emoji-icon" class="text-base">📻</span>
          <img id="mini-art-img" src="" class="mini-player-art-img hidden" alt="Artwork">
          <div class="mini-eq-bars" id="mini-eq-bars">
            <span class="mini-eq-bar"></span>
            <span class="mini-eq-bar"></span>
            <span class="mini-eq-bar"></span>
            <span class="mini-eq-bar"></span>
          </div>
        </div>

        <div class="min-w-0 flex-1 pr-1 leading-tight">
          <div class="flex items-center gap-1.5">
            <span id="mini-track-title" class="text-xs font-black text-white truncate max-w-[130px] sm:max-w-xs">Caricamento frequenza...</span>
          </div>
          <div class="text-[9.5px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5 font-mono">
            <span id="mini-track-artist">Darsena Syndicate</span>
            <span class="text-slate-600">·</span>
            <span id="mini-track-time" class="text-sky-300">0:00 / --:--</span>
          </div>
        </div>

        <div class="mini-controls-cluster">
          <button onclick="event.stopPropagation(); SoundEngine.playPrevTrack()" class="mini-ctrl-btn" title="Precedente">
            ${ICONS.prev}
          </button>
          <button onclick="event.stopPropagation(); SoundEngine.togglePlayPause()" id="mini-btn-play" class="mini-ctrl-btn btn-play-highlight" title="Play/Pausa">
            ${ICONS.play}
          </button>
          <button onclick="event.stopPropagation(); SoundEngine.playNextTrack()" class="mini-ctrl-btn" title="Successivo">
            ${ICONS.next}
          </button>
        </div>
      </div>
    `;

    updateUI();
  }

  async function loadStationTracks(stationKey) {
    activeStationKey = stationKey;

    if (stationKey === "favorites") {
      playlist = getFavorites();
      if (playlist.length === 0) playlist = Object.values(EPISODE_SOUNDTRACKS).slice(0, 6);
      renderModalTracklist();
      return;
    }

    const station = STATIONS[stationKey] || STATIONS.boombap;

    try {
      const resp = await fetch(`${AUDIUS_DISCOVERY_URL}/tracks/search?query=${encodeURIComponent(station.query)}&app_name=${APP_NAME}`);
      const json = await resp.json();

      if (json?.data?.length > 0) {
        playlist = json.data.map(t => ({
          id: t.id,
          title: t.title || "Traccia Senza Titolo",
          artist: t.user?.name || "Producer Clandestino",
          artwork: (t.artwork && (t.artwork['150x150'] || t.artwork['480x480'])) || null,
          emoji: station.emoji,
          src: `${AUDIUS_DISCOVERY_URL}/tracks/${t.id}/stream?app_name=${APP_NAME}`,
          duration: t.duration || 180
        }));
      } else {
        playlist = Object.values(EPISODE_SOUNDTRACKS).slice(0, 6);
      }
    } catch (e) {
      playlist = Object.values(EPISODE_SOUNDTRACKS).slice(0, 6);
    }

    renderModalTracklist();
  }

  function formatTime(secs) {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function getEffectiveBgmVolume() {
    if (isMasterMuted || isBgmMuted) return 0;
    return currentMasterVolume * currentBgmVolume;
  }

  function getEffectiveSfxVolume() {
    if (isMasterMuted || isSfxMuted) return 0;
    return currentMasterVolume * currentSfxVolume;
  }

  function playTrackByIndex(index, source = "radio") {
    if (!playlist || playlist.length === 0) return;
    currentTrackIndex = (index + playlist.length) % playlist.length;
    const track = playlist[currentTrackIndex];
    if (!track) return;

    playbackSource = source;
    currentTrack = track;

    if (currentHowl) {
      currentHowl.stop();
      currentHowl.unload();
      currentHowl = null;
    }

    currentHowl = new Howl({
      src: [track.src],
      format: ["mp3"],
      html5: true,
      volume: getEffectiveBgmVolume(),
      loop: isLoop && !isShuffle,
      onend: function() {
        if (isShuffle) {
          playTrackByIndex(Math.floor(Math.random() * playlist.length), playbackSource);
        } else {
          playTrackByIndex(currentTrackIndex + 1, playbackSource);
        }
      }
    });

    if (!isMasterMuted && !isBgmMuted && getEffectiveBgmVolume() > 0) {
      currentHowl.play();
    }

    syncMediaSessionMetadata(track);
    startProgressTimer();
    updateUI();
  }

  function playBgm(identifier, fadeInDuration = 800, fadeOutDuration = 180) {
    unlockMobileAudio();
    if (!identifier) return;

    const clean = String(identifier).toLowerCase().trim();

    if (clean.includes("wizard") || clean.includes("bass_walker") || clean.includes("chiptune") || clean.includes("game")) {
      switchStation("chiptune");
      playTrackByIndex(0, "game");
      return;
    } else if (clean.includes("shop") || clean.includes("boombap")) {
      switchStation("boombap");
      playTrackByIndex(0, "radio");
      return;
    } else if (clean.includes("recipe") || clean.includes("lofi")) {
      switchStation("lofi");
      playTrackByIndex(0, "radio");
      return;
    } else if (clean.includes("profile") || clean.includes("noir")) {
      switchStation("noir");
      playTrackByIndex(0, "radio");
      return;
    }

    const trackIdx = playlist.findIndex(t => 
      t.id.toLowerCase() === clean || 
      (t.alias && t.alias.includes(clean))
    );

    if (trackIdx !== -1) {
      playTrackByIndex(trackIdx, "radio");
    } else {
      playTrackByIndex(0, "radio");
    }
  }

  function startProgressTimer() {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      if (currentHowl && currentHowl.playing()) {
        const seek = currentHowl.seek() || 0;
        const dur = currentTrack?.duration || currentHowl.duration() || 1;
        const pct = Math.min(100, (seek / dur) * 100);

        const scrubber = document.getElementById("deck-progress-bar");
        const timeCur = document.getElementById("deck-time-current");
        const timeTot = document.getElementById("deck-time-total");
        const miniTime = document.querySelectorAll("#mini-track-time");

        if (scrubber) scrubber.value = pct;
        if (timeCur) timeCur.textContent = formatTime(seek);
        if (timeTot) timeTot.textContent = formatTime(dur);

        miniTime.forEach(el => {
          el.textContent = `${formatTime(seek)} / ${formatTime(dur)}`;
        });
      }
    }, 400);
  }

  function updateUI() {
    const track = currentTrack || playlist[0] || EPISODE_SOUNDTRACKS[1];
    const isPlaying = Boolean(currentHowl && currentHowl.playing());
    const isMuted = isMasterMuted || isBgmMuted;

    document.querySelectorAll("#mini-track-title").forEach(el => el.textContent = track?.title || "Sintonizzazione...");
    document.querySelectorAll("#mini-track-artist").forEach(el => el.textContent = track?.artist || "Darsena Syndicate");
    document.querySelectorAll("#mini-btn-play").forEach(el => el.innerHTML = isPlaying ? ICONS.pause : ICONS.play);
    document.querySelectorAll("#mini-emoji-icon").forEach(el => el.textContent = track?.emoji || "📻");

    const artImg = document.getElementById("mini-art-img");
    const emojiIcon = document.getElementById("mini-emoji-icon");
    if (artImg && emojiIcon) {
      if (track?.artwork) {
        artImg.src = track.artwork;
        artImg.classList.remove("hidden");
        emojiIcon.classList.add("hidden");
      } else {
        artImg.classList.add("hidden");
        emojiIcon.classList.remove("hidden");
      }
    }

    document.querySelectorAll("#mini-eq-bars").forEach(eq => {
      eq.classList.toggle("animating", isPlaying && !isMuted);
    });

    renderModalDeck();
  }

  function renderModalDeck() {
    const track = currentTrack || playlist[0] || EPISODE_SOUNDTRACKS[1];
    const isPlaying = Boolean(currentHowl && currentHowl.playing());
    const isLoved = isFavorite(track?.id);

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    s("deck-track-title", track?.title || "Caricamento...");
    s("deck-track-artist", track?.artist || "Syndicate Radio");
    s("deck-station-label", STATIONS[activeStationKey]?.name || "Frequenza Libera");

    const artBox = document.getElementById("deck-artwork-box");
    if (artBox) {
      if (track?.artwork) {
        artBox.innerHTML = `<img src="${track.artwork}" class="w-full h-full object-cover" alt="Art">`;
      } else {
        artBox.textContent = track?.emoji || "📻";
      }
    }

    const btnPlay = document.getElementById("deck-btn-play");
    if (btnPlay) btnPlay.innerHTML = isPlaying ? ICONS.pause : ICONS.play;

    const btnHeart = document.getElementById("deck-btn-heart");
    if (btnHeart) {
      btnHeart.innerHTML = isLoved ? ICONS.heartFilled : ICONS.heartOutline;
      btnHeart.title = isLoved ? "Rimuovi dai Preferiti" : "Aggiungi ai Preferiti";
    }

    const btnShuffle = document.getElementById("deck-btn-shuffle");
    if (btnShuffle) btnShuffle.style.color = isShuffle ? "#38BDF8" : "";

    const btnLoop = document.getElementById("deck-btn-loop");
    if (btnLoop) btnLoop.style.color = isLoop ? "#38BDF8" : "";

    const btnMute = document.getElementById("deck-btn-mute");
    if (btnMute) btnMute.innerHTML = (isMasterMuted || isBgmMuted) ? ICONS.volumeOff : ICONS.volumeOn;

    const slider = document.getElementById("deck-volume-slider");
    if (slider) slider.value = currentBgmVolume;
  }

  function renderModalTracklist() {
    const container = document.getElementById("deck-tracklist-container");
    if (!container) return;

    const tracksToDisplay = searchResults.length > 0 ? searchResults : playlist;

    if (tracksToDisplay.length === 0) {
      container.innerHTML = `<div class="p-3 text-center text-xs text-slate-500 font-mono">Nessun brano presente in questa frequenza.</div>`;
      return;
    }

    container.innerHTML = tracksToDisplay.map((t, idx) => {
      const isCurrent = currentTrack && String(currentTrack.id) === String(t.id);
      const loved = isFavorite(t.id);

      return `
        <div onclick="SoundEngine.playTrackDirect(${idx})" class="p-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition ${isCurrent ? 'bg-sky-950/40 border border-sky-400/40' : 'bg-slate-900/60 border border-white/5 hover:border-white/20'}">
          <div class="flex items-center gap-2 min-w-0 pr-2">
            <span class="text-sm shrink-0">${t.emoji || '🎵'}</span>
            <div class="min-w-0">
              <div class="font-bold text-white truncate ${isCurrent ? 'text-sky-300' : ''}">${t.title}</div>
              <div class="text-[9.5px] text-slate-400 truncate">${t.artist}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="event.stopPropagation(); SoundEngine.toggleFavoriteByObj('${t.id}')" class="text-xs hover:scale-110 transition">
              ${loved ? ICONS.heartFilled : ICONS.heartOutline}
            </button>
            <span class="text-[9px] font-mono text-slate-500">${formatTime(t.duration)}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function unlockMobileAudio() {
    if (window.Howler && Howler.ctx && Howler.ctx.state === "suspended") {
      Howler.ctx.resume().catch(() => {});
    }
  }

  // --------------------------------------------------------------------------
  // 9. INIZIALIZZAZIONE & SBLOCCO TOUCH GLOBALE AL PRIMO TOCCO NATURALE
  // --------------------------------------------------------------------------
  function init() {
    playlist = Object.values(EPISODE_SOUNDTRACKS).slice(0, 6);
    currentTrack = playlist[0];

    setupMediaSessionHandlers();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (playbackSource === "game" || document.body.dataset.context === "gameplay") {
          if (currentHowl && currentHowl.playing()) currentHowl.pause();
        }
        if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.pause();
      } else {
        unlockMobileAudio();
        if (!isMasterMuted && !isBgmMuted && currentHowl && !currentHowl.playing()) {
          if (playbackSource === "game" || document.body.dataset.context === "gameplay") {
            currentHowl.play();
          }
        }
      }
    });

    // 🔒 SBLOCCO TOTALE AL PRIMO TOCCO NATURALE DELL'UTENTE (Ovunque tocchi l'app)
    let hasUnlocked = false;
    const globalFirstTouchUnlock = () => {
      if (hasUnlocked) return;
      hasUnlocked = true;
      unlockMobileAudio();

      if (!isMasterMuted && !isBgmMuted && (!currentHowl || !currentHowl.playing())) {
        playTrackByIndex(0, "radio");
      }

      ["touchstart", "click", "pointerdown"].forEach(evt => 
        window.removeEventListener(evt, globalFirstTouchUnlock, { capture: true })
      );
    };

    ["touchstart", "click", "pointerdown"].forEach(evt => 
      window.addEventListener(evt, globalFirstTouchUnlock, { capture: true, passive: true })
    );

    mountMiniWidget();
    setTimeout(mountMiniWidget, 100);
    setTimeout(mountMiniWidget, 450);

    loadStationTracks("boombap");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // --------------------------------------------------------------------------
  // 10. SFX PLAYER BASATO SU BUFFER
  // --------------------------------------------------------------------------
  function playSfx(name) {
    if (isMasterMuted || isSfxMuted) return;
    unlockMobileAudio();

    if (!sfxPlayers[name] && sfxUrls[name]) {
      try {
        sfxPlayers[name] = new Howl({
          src: [sfxUrls[name]],
          format: ["mp3"],
          html5: false,
          volume: getEffectiveSfxVolume()
        });
      } catch (e) {
        return;
      }
    }

    if (sfxPlayers[name]) {
      try {
        sfxPlayers[name].volume(getEffectiveSfxVolume());
        sfxPlayers[name].play();
      } catch (e) {}
    }
  }

  // --------------------------------------------------------------------------
  // 11. METODI PUBBLICI ESPORTATI PER IL GIOCO
  // --------------------------------------------------------------------------
  return {
    playClick: () => playSfx("click"),
    playCoin: () => playSfx("coin"),
    playDice: () => playSfx("dice"),
    playVictory: () => playSfx("victory"),
    playError: () => playSfx("error"),
    playSfx: (name) => playSfx(name),

    playZombie: () => playSfx("zombie_spectral"),
    playHeal1Up: () => playSfx("cure_1up"),
    playDrug: () => playSfx("drug_snort"),
    playBribe: () => playSfx("bribe_deal"),

    playCardEncounter: function(nodeOrType) {
      if (document.body.dataset.context !== "gameplay") return;
      if (!nodeOrType) return;

      const t = typeof nodeOrType === "string" ? nodeOrType.toUpperCase() : String(nodeOrType.tipo || nodeOrType.id || "").toUpperCase();

      if (t.includes("NEMICO") || t.startsWith("NEM_")) {
        playSfx("card_enemy");
      } else if (t.includes("EVENTO") || t.startsWith("EVT_")) {
        playSfx("card_event");
      } else if (t.includes("ENIGMA") || t.startsWith("ENG_")) {
        playSfx("card_enigma");
      } else if (t.includes("AIUTANTE") || t.startsWith("AIU_")) {
        playSfx("card_helper");
      } else if (t.includes("SND_0000") || t.includes("EMPORIO")) {
        playSfx("card_shop");
      } else {
        playSfx("card_story");
      }
    },

    playCombatEffect: function(effectType) {
      const e = String(effectType || "").toLowerCase();
      if (e === "hit") playSfx("combat_hit");
      else if (e === "miss") playSfx("combat_miss");
      else if (e === "crit") playSfx("combat_crit");
      else if (e === "fumble" || e === "fail") playSfx("combat_fumble");
      else if (e === "hurt") playSfx("combat_hurt");
    },

    startHeartbeat: function() {
      if (isMasterMuted || isSfxMuted) return;
      if (!heartbeatHowl) {
        heartbeatHowl = new Howl({
          src: [sfxUrls.heartbeat],
          format: ["mp3"],
          loop: true,
          volume: getEffectiveSfxVolume() * 0.5
        });
      }
      if (!heartbeatHowl.playing()) heartbeatHowl.play();
    },

    stopHeartbeat: function() {
      if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.stop();
    },

    playEpisodeBgm: function(gameKey, epNum, mood = "explore") {
      const ep = parseInt(epNum, 10) || 1;
      const soundtrack = EPISODE_SOUNDTRACKS[ep] || EPISODE_SOUNDTRACKS[1];
      playbackSource = "game";

      if (currentHowl) {
        currentHowl.stop();
        currentHowl.unload();
      }

      currentTrack = soundtrack;
      currentHowl = new Howl({
        src: [soundtrack.src],
        format: ["mp3"],
        html5: true,
        volume: getEffectiveBgmVolume(),
        loop: true
      });

      if (!isMasterMuted && !isBgmMuted) {
        currentHowl.play();
      }
      syncMediaSessionMetadata(soundtrack);
      updateUI();
    },

    playBgm,

    playTabBgm: function(tabKey) {
      const clean = String(tabKey || "home").toLowerCase();
      let targetStation = "boombap";

      if (clean.includes("game") || clean.includes("hub")) targetStation = "chiptune";
      else if (clean.includes("shop")) targetStation = "boombap";
      else if (clean.includes("recipe")) targetStation = "lofi";
      else if (clean.includes("profile")) targetStation = "noir";
      else targetStation = "boombap";

      switchStation(targetStation);

      if (!isMasterMuted && !isBgmMuted && (!currentHowl || !currentHowl.playing())) {
        playTrackByIndex(0, "radio");
      }
    },

    duck: function(volFactor = 0.25, duration = 1200) {
      if (!currentHowl || !currentHowl.playing()) return;
      const baseVol = getEffectiveBgmVolume();
      currentHowl.fade(currentHowl.volume(), baseVol * volFactor, 120);
      setTimeout(() => {
        if (currentHowl && currentHowl.playing()) currentHowl.fade(currentHowl.volume(), baseVol, 300);
      }, duration);
    },

    openModal: function() {
      injectExpandedModal();
      renderModalDeck();
      renderModalTracklist();
      document.getElementById("modal-syndicate-radio")?.showModal();
    },

    // 🔒 TOGGLE DETERMINISTICO A SINGOLO CLIC (Elimina il bug del primo tocco a vuoto)
    togglePlayPause: function() {
      unlockMobileAudio();

      if (!currentHowl) {
        playTrackByIndex(currentTrackIndex, "radio");
        return;
      }

      if (currentHowl.playing()) {
        currentHowl.pause();
      } else {
        currentHowl.play();
      }

      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = currentHowl.playing() ? 'playing' : 'paused';
      }
      updateUI();
    },

    playNextTrack: function() {
      if (isShuffle) {
        playTrackByIndex(Math.floor(Math.random() * playlist.length), playbackSource);
      } else {
        playTrackByIndex(currentTrackIndex + 1, playbackSource);
      }
    },

    playPrevTrack: function() {
      playTrackByIndex(currentTrackIndex - 1, playbackSource);
    },

    playTrackDirect: function(idx) {
      const targetList = searchResults.length > 0 ? searchResults : playlist;
      if (targetList[idx]) {
        playlist = targetList;
        playTrackByIndex(idx, "radio");
      }
    },

    playActiveStation: function() {
      playTrackByIndex(0, "radio");
    },

    switchStation,

    handleSearchInput: function(val) {
      clearTimeout(searchDebounceTimer);
      const query = String(val || "").trim();
      if (!query) {
        searchResults = [];
        renderModalTracklist();
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        try {
          const resp = await fetch(`${AUDIUS_DISCOVERY_URL}/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP_NAME}`);
          const json = await resp.json();
          if (json?.data) {
            searchResults = json.data.map(t => ({
              id: t.id,
              title: t.title || "Traccia",
              artist: t.user?.name || "Artista",
              artwork: t.artwork?.['150x150'] || null,
              emoji: "🎧",
              src: `${AUDIUS_DISCOVERY_URL}/tracks/${t.id}/stream?app_name=${APP_NAME}`,
              duration: t.duration || 180
            }));
            renderModalTracklist();
          }
        } catch (e) {}
      }, 350);
    },

    toggleCurrentFavorite: function() {
      if (currentTrack) toggleFavorite(currentTrack);
    },

    toggleFavoriteByObj: function(trackId) {
      const all = [...searchResults, ...playlist, ...Object.values(EPISODE_SOUNDTRACKS)];
      const found = all.find(t => String(t.id) === String(trackId));
      if (found) toggleFavorite(found);
    },

    seekProgress: function(pct) {
      if (!currentHowl) return;
      const dur = currentTrack?.duration || currentHowl.duration() || 1;
      const targetSecs = (dur * (parseFloat(pct) || 0)) / 100;
      currentHowl.seek(targetSecs);
    },

    toggleShuffle: function() {
      isShuffle = !isShuffle;
      localStorage.setItem("estiqatsy_audio_shuffle", isShuffle);
      renderModalDeck();
    },

    toggleLoop: function() {
      isLoop = !isLoop;
      localStorage.setItem("estiqatsy_audio_loop", isLoop);
      if (currentHowl) currentHowl.loop(isLoop);
      renderModalDeck();
    },

    toggleMute: function() {
      isMasterMuted = !isMasterMuted;
      localStorage.setItem("estiqatsy_audio_muted", isMasterMuted);
      if (currentHowl) {
        currentHowl.volume(getEffectiveBgmVolume());
      }
      updateUI();
    },

    setBgmVolume: function(val) {
      currentBgmVolume = Math.max(0, Math.min(1, parseFloat(val) || 0));
      localStorage.setItem("estiqatsy_bgm_volume", currentBgmVolume);
      if (currentHowl) currentHowl.volume(getEffectiveBgmVolume());
      updateUI();
    },

    get isPlaying() { return Boolean(currentHowl && currentHowl.playing()); },
    get isMuted() { return isMasterMuted; },
    get bgmVolume() { return currentBgmVolume; },
    getCurrentTrack: () => currentTrack || playlist[0] || EPISODE_SOUNDTRACKS[1],
    mountWidget: mountMiniWidget
  };

  function switchStation(stKey) {
    if (stKey === activeStationKey) return;
    searchResults = [];
    const input = document.getElementById("deck-search-input");
    if (input) input.value = "";
    loadStationTracks(stKey);
    document.querySelectorAll(".rpg-category-chip").forEach(c => {
      c.classList.toggle("active", c.id === `chip-station-${stKey}`);
    });
  }
})();

window.SoundEngine = SoundEngine;
