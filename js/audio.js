// ============================================================================
// PROJECT: ESTIQATSY BOT & RPG PLATFORM
// FILE: js/audio.js (VERSIONE 36.0 - AUDIUS RADIO & ZERO-INLINE CSS)
// DESCRIZIONE: Componente Audio Autonomo per Telegram Mini App:
//              - Grafica e classi delegate al 100% a css/core.css
//              - Auto-mounting reattivo su #radio-widget-mount
//              - Modale espansa Jukebox Deck (stile Spotify) iniettata nel DOM
//              - Stazioni Audius decentralizzate a zero pubblicità (White-Label)
//              - Gestione Preferiti salvata in localStorage
//              - Scorciatoie SFX complete per il motore RPG di gioco
// ============================================================================

const SoundEngine = (function() {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. CONFIGURAZIONI AUDIO & AUDIUS ENDPOINT
  // --------------------------------------------------------------------------
  const APP_NAME = "estiqatsy";
  const AUDIUS_DISCOVERY_URL = "https://discoveryprovider.audius.co/v1";

  const DEFAULT_MASTER = 0.85;
  const DEFAULT_BGM = 0.40;
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

  let activeStationKey = "boombap";
  let playlist = [];
  let currentTrackIndex = 0;
  let currentTrack = null;
  let currentHowl = null;
  let heartbeatHowl = null;
  let isPlayingManual = !isMasterMuted;

  let progressTimer = null;
  let searchDebounceTimer = null;
  let searchResults = [];

  // Tracce di sicurezza offline (subito pronte)
  const BOOTSTRAP_TRACKS = [
    {
      id: "mgb9p",
      title: "The Shadow Side (Vinyl Noir)",
      artist: "DJ N47",
      artwork: null,
      emoji: "🎷",
      src: "https://discoveryprovider.audius.co/v1/tracks/mgb9p/stream?app_name=estiqatsy",
      duration: 228
    },
    {
      id: "ZrOYoXq",
      title: "Lil Classic BoomBap",
      artist: "Ljazz feat. LordCinic",
      artwork: null,
      emoji: "📻",
      src: "https://discoveryprovider.audius.co/v1/tracks/ZrOYoXq/stream?app_name=estiqatsy",
      duration: 130
    },
    {
      id: "X6M2a",
      title: "BOOMBAP 00 (Vintage Rhodes)",
      artist: "Rafa Halë",
      artwork: null,
      emoji: "📻",
      src: "https://discoveryprovider.audius.co/v1/tracks/X6M2a/stream?app_name=estiqatsy",
      duration: 235
    },
    {
      id: "9dk1j1k",
      title: "Gemkeepers BoomBap",
      artist: "Surce",
      artwork: null,
      emoji: "📻",
      src: "https://discoveryprovider.audius.co/v1/tracks/9dk1j1k/stream?app_name=estiqatsy",
      duration: 249
    },
    {
      id: "dago7mP",
      title: "h8rs (Serious Dark)",
      artist: "Surce",
      artwork: null,
      emoji: "☕",
      src: "https://discoveryprovider.audius.co/v1/tracks/dago7mP/stream?app_name=estiqatsy",
      duration: 223
    },
    {
      id: "A7Nqg",
      title: "FREE$TYLER (Fast 88 BPM)",
      artist: "WhoIsSanchez",
      artwork: null,
      emoji: "👾",
      src: "https://discoveryprovider.audius.co/v1/tracks/A7Nqg/stream?app_name=estiqatsy",
      duration: 219
    }
  ];

  // Effetti sonori di gioco
  const sfxUrls = {
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    card_flip: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    insert_coin: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3",
    cash_register: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
    bribe: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3",
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    shock: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    d20_crit: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    d20_fail: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    drug: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3",
    zombie: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",
    heartbeat: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    victory: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    error: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"
  };

  const sfxPlayers = {};

  // --------------------------------------------------------------------------
  // 2. SISTEMA PREFERITI IN LOCALSTORAGE
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // 3. INIEZIONE MODALE ESPANSA (SPOTIFY DECK) NEL DOM
  // --------------------------------------------------------------------------
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
            <button onclick="SoundEngine.toggleCurrentFavorite()" id="deck-btn-heart" class="text-xl hover:scale-110 transition shrink-0" title="Aggiungi ai Preferiti">
              🤍
            </button>
          </div>

          <div class="space-y-1">
            <input type="range" id="deck-progress-bar" min="0" max="100" value="0" class="spotify-scrubber" oninput="SoundEngine.seekProgress(this.value)">
            <div class="flex justify-between text-[9px] font-mono text-slate-400">
              <span id="deck-time-current">0:00</span>
              <span id="deck-time-total">--:--</span>
            </div>
          </div>

          <div class="flex items-center justify-center gap-3 pt-1">
            <button onclick="SoundEngine.toggleShuffle()" id="deck-btn-shuffle" class="text-xs text-slate-400 hover:text-white" title="Casuale">🔀</button>
            <button onclick="SoundEngine.playPrevTrack()" class="text-base text-slate-300 hover:text-white">⏮</button>
            <button onclick="SoundEngine.togglePlayPause()" id="deck-btn-play" class="w-9 h-9 rounded-full bg-white text-slate-950 flex items-center justify-center font-black text-xs shadow-lg hover:scale-105 transition">▶️</button>
            <button onclick="SoundEngine.playNextTrack()" class="text-base text-slate-300 hover:text-white">⏭</button>
            <button onclick="SoundEngine.toggleLoop()" id="deck-btn-loop" class="text-xs text-slate-400 hover:text-white" title="Ripeti">🔁</button>
          </div>

          <div class="flex items-center gap-2 pt-1 border-t border-white/5">
            <button onclick="SoundEngine.toggleMute()" id="deck-btn-mute" class="text-xs text-slate-400 hover:text-white shrink-0">🔊</button>
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

          <div class="space-y-1 max-h-36 overflow-y-auto pr-1" id="deck-tracklist-container">
          </div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // 4. INIEZIONE & RENDERING AUTO-RIPARANTE DEL MINI-WIDGET IN HOME
  // --------------------------------------------------------------------------
  function mountMiniWidget() {
    injectExpandedModal();

    let mountEl = document.getElementById("radio-widget-mount");

    // Fallback: se per qualsiasi motivo il punto non esiste, lo inietta sotto il banner di #view-home
    if (!mountEl) {
      const homeScreen = document.getElementById("view-home");
      if (homeScreen) {
        mountEl = document.createElement("div");
        mountEl.id = "radio-widget-mount";
        const banner = homeScreen.querySelector(".home-hero-banner");
        if (banner && banner.nextSibling) {
          homeScreen.insertBefore(mountEl, banner.nextSibling);
        } else {
          homeScreen.prepend(mountEl);
        }
      }
    }

    if (!mountEl) return;

    // Se è già stato montato con successo, aggiorna solo la grafica
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
            |‹‹
          </button>
          <button onclick="event.stopPropagation(); SoundEngine.togglePlayPause()" id="mini-btn-play" class="mini-ctrl-btn btn-play-highlight" title="Play/Pausa">
            ▶
          </button>
          <button onclick="event.stopPropagation(); SoundEngine.playNextTrack()" class="mini-ctrl-btn" title="Successivo">
            ››|
          </button>
        </div>
      </div>
    `;

    updateUI();
  }

  // --------------------------------------------------------------------------
  // 5. CARICAMENTO STAZIONI AUDIUS
  // --------------------------------------------------------------------------
  async function loadStationTracks(stationKey) {
    activeStationKey = stationKey;

    if (stationKey === "favorites") {
      playlist = getFavorites();
      if (playlist.length === 0) playlist = [...BOOTSTRAP_TRACKS];
      renderModalTracklist();
      return;
    }

    const station = STATIONS[stationKey] || STATIONS.boombap;

    try {
      const resp = await fetch(`${AUDIUS_DISCOVERY_URL}/tracks/search?query=${encodeURIComponent(station.query)}&app_name=${APP_NAME}`);
      const json = await resp.json();

      if (json && json.data && json.data.length > 0) {
        playlist = json.data.map(t => ({
          id: t.id,
          title: t.title || "Traccia Senza Titolo",
          artist: (t.user && t.user.name) ? t.user.name : "Producer Clandestino",
          artwork: (t.artwork && (t.artwork['150x150'] || t.artwork['480x480'])) || null,
          emoji: station.emoji,
          src: `${AUDIUS_DISCOVERY_URL}/tracks/${t.id}/stream?app_name=${APP_NAME}`,
          duration: t.duration || 180
        }));
      } else {
        playlist = [...BOOTSTRAP_TRACKS];
      }
    } catch (e) {
      playlist = [...BOOTSTRAP_TRACKS];
    }

    renderModalTracklist();
  }

  // --------------------------------------------------------------------------
  // 6. RIPRODUZIONE AUDIO CORE (HOWLER HTML5 STREAMING)
  // --------------------------------------------------------------------------
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

  function playTrackByIndex(index) {
    if (!playlist || playlist.length === 0) return;
    currentTrackIndex = (index + playlist.length) % playlist.length;
    const track = playlist[currentTrackIndex];
    if (!track) return;

    currentTrack = track;

    if (currentHowl) {
      currentHowl.stop();
      currentHowl.unload();
      currentHowl = null;
    }

    currentHowl = new Howl({
      src: [track.src],
      format: ["mp3"],
      html5: true, // FONDAMENTALE PER I REINDIRIZZAMENTI 302 AUDIUS
      volume: getEffectiveBgmVolume(),
      loop: isLoop && !isShuffle,
      onend: function() {
        if (isShuffle) {
          playTrackByIndex(Math.floor(Math.random() * playlist.length));
        } else {
          playTrackByIndex(currentTrackIndex + 1);
        }
      }
    });

    isPlayingManual = true;

    if (!isMasterMuted && !isBgmMuted && getEffectiveBgmVolume() > 0) {
      currentHowl.play();
    }

    startProgressTimer();
    updateUI();
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
    const track = currentTrack || playlist[0] || BOOTSTRAP_TRACKS[0];
    const isPlaying = Boolean(currentHowl && currentHowl.playing());
    const isMuted = isMasterMuted || isBgmMuted;

    // Mini-Player Home & Profilo
    document.querySelectorAll("#mini-track-title").forEach(el => el.textContent = track?.title || "Sintonizzazione...");
    document.querySelectorAll("#mini-track-artist").forEach(el => el.textContent = track?.artist || "Darsena Syndicate");
    document.querySelectorAll("#mini-btn-play").forEach(el => el.textContent = isPlaying ? "||" : "▶");
    document.querySelectorAll("#mini-emoji-icon").forEach(el => el.textContent = track?.emoji || "📻");

    // Equalizzatore animato a 4 barre
    document.querySelectorAll("#mini-eq-bars").forEach(eq => {
      eq.classList.toggle("animating", isPlaying && !isMuted);
    });

    renderModalDeck();
  }

  function renderModalDeck() {
    const track = currentTrack || playlist[0] || BOOTSTRAP_TRACKS[0];
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
    if (btnPlay) btnPlay.textContent = isPlaying ? "⏸" : "▶️";

    const btnHeart = document.getElementById("deck-btn-heart");
    if (btnHeart) {
      btnHeart.textContent = isLoved ? "💚" : "🤍";
      btnHeart.title = isLoved ? "Rimuovi dai Preferiti" : "Aggiungi ai Preferiti";
    }

    const btnShuffle = document.getElementById("deck-btn-shuffle");
    if (btnShuffle) btnShuffle.style.color = isShuffle ? "#38BDF8" : "";

    const btnLoop = document.getElementById("deck-btn-loop");
    if (btnLoop) btnLoop.style.color = isLoop ? "#38BDF8" : "";

    const btnMute = document.getElementById("deck-btn-mute");
    if (btnMute) btnMute.textContent = (isMasterMuted || isBgmMuted) ? "🔇" : "🔊";

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
              ${loved ? '💚' : '🤍'}
            </button>
            <span class="text-[9px] font-mono text-slate-500">${formatTime(t.duration)}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  // --------------------------------------------------------------------------
  // 7. SBLOCCO AUDIO AUTOMATICO AL PRIMO TOCCO
  // --------------------------------------------------------------------------
  function unlockMobileAudio() {
    if (window.Howler && Howler.ctx && Howler.ctx.state === "suspended") {
      Howler.ctx.resume().catch(() => {});
    }
  }

  function init() {
    playlist = [...BOOTSTRAP_TRACKS];
    currentTrack = playlist[0];

    const unlockEvents = ["touchstart", "touchend", "pointerdown", "click"];
    const handleFirstTouch = () => {
      unlockMobileAudio();
      unlockEvents.forEach(evt => window.removeEventListener(evt, handleFirstTouch, { capture: true }));
    };
    unlockEvents.forEach(evt => window.addEventListener(evt, handleFirstTouch, { capture: true, passive: true }));

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (currentHowl && currentHowl.playing()) currentHowl.pause();
        if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.pause();
      } else {
        unlockMobileAudio();
        if (!isMasterMuted && !isBgmMuted && currentHowl && !currentHowl.playing() && isPlayingManual) {
          currentHowl.play();
        }
      }
    });

    // 🔒 TRIPLA SICUREZZA DI MONTAGGIO (Subito + DOMContentLoaded + Polling di sicurezza)
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
  // 8. SFX PLAYER (EFFETTI DI GIOCO AD ALTA REATTIVITÀ)
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
  // 9. ESPOSIZIONE PUBBLICA METODI SOUNDENGINE
  // --------------------------------------------------------------------------
  return {
    // Scorciatoie di Gioco (Rules2Engine & Rules2Wizard)
    playClick: () => playSfx("click"),
    playCoin: () => playSfx("coin"),
    playDice: () => playSfx("dice"),
    playVictory: () => playSfx("victory"),
    playError: () => playSfx("error"),
    playSfx: (name) => playSfx(name),

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

    // Cambio pagina BGM
    playTabBgm: function(tabKey) {
      const clean = String(tabKey || "home").toLowerCase();
      if (clean.includes("game") || clean.includes("hub")) this.switchStation("chiptune");
      else if (clean.includes("shop")) this.switchStation("boombap");
      else if (clean.includes("recipe")) this.switchStation("lofi");
      else if (clean.includes("profile")) this.switchStation("noir");
    },

    playEpisodeBgm: function(gameKey, epNum, mood = "explore") {
      this.switchStation(mood === "combat" ? "chiptune" : "noir");
    },

    duck: function(volFactor = 0.25, duration = 1200) {
      if (!currentHowl || !currentHowl.playing()) return;
      const baseVol = getEffectiveBgmVolume();
      currentHowl.fade(currentHowl.volume(), baseVol * volFactor, 120);
      setTimeout(() => {
        if (currentHowl && currentHowl.playing()) currentHowl.fade(currentHowl.volume(), baseVol, 300);
      }, duration);
    },

    // Controlli Jukebox & Deck Espanso
    openModal: function() {
      injectExpandedModal();
      renderModalDeck();
      renderModalTracklist();
      document.getElementById("modal-syndicate-radio")?.showModal();
    },

    togglePlayPause: function() {
      if (!currentHowl) {
        playTrackByIndex(currentTrackIndex);
        return;
      }
      if (currentHowl.playing()) {
        currentHowl.pause();
        isPlayingManual = false;
      } else {
        currentHowl.play();
        isPlayingManual = true;
      }
      updateUI();
    },

    playNextTrack: function() {
      if (isShuffle) {
        playTrackByIndex(Math.floor(Math.random() * playlist.length));
      } else {
        playTrackByIndex(currentTrackIndex + 1);
      }
    },

    playPrevTrack: function() {
      playTrackByIndex(currentTrackIndex - 1);
    },

    playTrackDirect: function(idx) {
      const targetList = searchResults.length > 0 ? searchResults : playlist;
      if (targetList[idx]) {
        playlist = targetList;
        playTrackByIndex(idx);
      }
    },

    playActiveStation: function() {
      playTrackByIndex(0);
    },

    switchStation: function(stKey) {
      if (stKey === activeStationKey) return;
      searchResults = [];
      const input = document.getElementById("deck-search-input");
      if (input) input.value = "";
      loadStationTracks(stKey);
      document.querySelectorAll(".rpg-category-chip").forEach(c => {
        c.classList.toggle("active", c.id === `chip-station-${stKey}`);
      });
    },

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
      const all = [...searchResults, ...playlist, ...BOOTSTRAP_TRACKS];
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

    // Getters
    get isPlaying() { return Boolean(currentHowl && currentHowl.playing()); },
    get isMuted() { return isMasterMuted; },
    get bgmVolume() { return currentBgmVolume; },
    getCurrentTrack: () => currentTrack || playlist[0] || BOOTSTRAP_TRACKS[0],
    mountWidget: mountMiniWidget
  };
})();

window.SoundEngine = SoundEngine;
