// ============================================================================
// PROJECT: ESTIQATSY BOT & RPG PLATFORM
// FILE: js/audio.js (VERSIONE 20.0 - AUDIUS BGM STREAMING & LOW-LATENCY SFX)
// DESCRIZIONE: Motore sonoro per Telegram Mini App:
//              - BGM: Streaming decentralizzato Audius (Boom Bap, Rhodes & Vinyl Noir)
//              - SFX: Effetti di gioco ad alta fedeltà con fallback nativo
//              - Sblocco automatico WebKit/Telegram al primo tocco
//              - Aliasing completo per playClick, playCoin, playDice, playVictory, playError
// ============================================================================

const SoundEngine = (function() {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. STATO PERSISTENTE & IMPOSTAZIONI PREDEFINITE
  // --------------------------------------------------------------------------
  // Default: Attivo (false) per consentire la riproduzione non appena l'utente tocca lo schermo
  const storedMute = localStorage.getItem("estiqatsy_audio_muted");
  let isMasterMuted = storedMute !== null ? storedMute === "true" : false;

  let isBgmMuted = localStorage.getItem("estiqatsy_bgm_muted") === "true";
  let isSfxMuted = localStorage.getItem("estiqatsy_sfx_muted") === "true";
  let isShuffle = localStorage.getItem("estiqatsy_audio_shuffle") === "true";

  // Volumi a 3 Canali
  const DEFAULT_MASTER_VOLUME = 0.85;
  const DEFAULT_BGM_VOLUME = 0.40;
  const DEFAULT_SFX_VOLUME = 0.90;

  let currentMasterVolume = parseFloat(localStorage.getItem("estiqatsy_master_volume")) || DEFAULT_MASTER_VOLUME;
  let currentBgmVolume = parseFloat(localStorage.getItem("estiqatsy_bgm_volume")) || DEFAULT_BGM_VOLUME;
  let currentSfxVolume = parseFloat(localStorage.getItem("estiqatsy_sfx_volume")) || DEFAULT_SFX_VOLUME;

  let currentBgmKey = "hard_boiled";
  let currentBgmHowl = null;
  let heartbeatHowl = null;
  let isPlayingManual = !isMasterMuted;

  let fadeOutTimer = null;
  let duckTimer = null;

  // --------------------------------------------------------------------------
  // 2. CATALOGO BGM AUDIUS (STREAMING VERIFICATO A ZERO ANNUNCI)
  // --------------------------------------------------------------------------
  const playlist = [
    // --- COLONNE SONORE DELLE PAGINE PRINCIPALI (BOOM BAP & VINYL NOIR) ---
    {
      id: "hard_boiled",
      alias: ["home", "view-home", "intro"],
      title: "The Shadow Side (Vinyl Noir)",
      artist: "DJ N47",
      mood: "Campionamenti Vinile Anni '30, Scratch & Basso Cupo",
      tag: "HOME NOIR",
      src: "https://discoveryprovider.audius.co/v1/tracks/mgb9p/stream?app_name=estiqatsy"
    },
    {
      id: "bass_walker",
      alias: ["games", "view-hub", "hub", "giochi", "view-wizard", "wizard"],
      title: "Lil Classic BoomBap",
      artist: "Ljazz (feat. LordCinic)",
      mood: "Jazz-Hop 90s, Rullante Secco & Banchina",
      tag: "SALA GIOCHI",
      src: "https://discoveryprovider.audius.co/v1/tracks/ZrOYoXq/stream?app_name=estiqatsy"
    },
    {
      id: "backbay_lounge",
      alias: ["shop", "view-shop", "mercato", "emporio"],
      title: "BOOMBAP 00 (Rhodes Vintage)",
      artist: "Rafa Halë",
      mood: "Piano Rhodes Rilassato da Bisca Clandestina",
      tag: "MERCATO",
      src: "https://discoveryprovider.audius.co/v1/tracks/X6M2a/stream?app_name=estiqatsy"
    },
    {
      id: "opportunity_walks",
      alias: ["recipes", "view-recipes", "ricette", "barlady"],
      title: "Gemkeepers BoomBap",
      artist: "Surce",
      mood: "Old School Hip-Hop Ritmico da Bancone",
      tag: "RICETTARIO",
      src: "https://discoveryprovider.audius.co/v1/tracks/9dk1j1k/stream?app_name=estiqatsy"
    },
    {
      id: "dark_walk",
      alias: ["profile", "view-profile", "profilo", "dossier"],
      title: "h8rs (Serious Dark)",
      artist: "Surce",
      mood: "Basso Scuro & Organigramma del Potere",
      tag: "HUB AGENTE",
      src: "https://discoveryprovider.audius.co/v1/tracks/dago7mP/stream?app_name=estiqatsy"
    },

    // --- TRACCE DI GAMEPLAY & COMBATTIMENTO RPG ---
    {
      id: "ep1_explore",
      alias: ["exploration", "rules2_explore", "ep1_esplorazione"],
      title: "The Shadow Side (Inchiesta)",
      artist: "DJ N47",
      mood: "Infiltrazione Notturna sui Moli",
      tag: "INCHIESTA",
      src: "https://discoveryprovider.audius.co/v1/tracks/mgb9p/stream?app_name=estiqatsy"
    },
    {
      id: "ep1_combat",
      alias: ["combat", "rules2_combat", "ep1_combattimento"],
      title: "FREE$TYLER (Fast 88 BPM)",
      artist: "WhoIsSanchez",
      mood: "Rissa da Banchina & Duello D20",
      tag: "DUELLO D20",
      src: "https://discoveryprovider.audius.co/v1/tracks/A7Nqg/stream?app_name=estiqatsy"
    },
    {
      id: "deadly_roulette",
      alias: ["rules2_boss", "boss", "boss_fight"],
      title: "FREE$TYLER (Boss Fight)",
      artist: "WhoIsSanchez",
      mood: "Scontro Mortale con il Boss",
      tag: "BOSS FIGHT",
      src: "https://discoveryprovider.audius.co/v1/tracks/A7Nqg/stream?app_name=estiqatsy"
    },
    {
      id: "bittersweet",
      alias: ["defeat", "rules2_defeat", "morte"],
      title: "BOOMBAP 00 (Game Over)",
      artist: "Rafa Halë",
      mood: "Disillusione & Sconfitta al Molo",
      tag: "GAME OVER",
      src: "https://discoveryprovider.audius.co/v1/tracks/X6M2a/stream?app_name=estiqatsy"
    }
  ];

  // --------------------------------------------------------------------------
  // 3. EFFETTI SONORI SFX DI GIOCO (CANALE AD ALTA REATTIVITÀ)
  // --------------------------------------------------------------------------
  const sfxUrls = {
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    card_flip: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    modal_open: "https://assets.mixkit.co/active_storage/sfx/3115/3115-preview.mp3",
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    insert_coin: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3",
    cash_register: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
    bribe: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3",
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    shock: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    lucky: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    success: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    d20_crit: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    unlucky: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    d20_fail: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    crit_hit: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    drug: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3",
    zombie: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",
    heartbeat: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    victory: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    error: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"
  };

  const sfxPlayers = {};
  const bgmPlayers = {};

  // --------------------------------------------------------------------------
  // 4. SBLOCCO AUDIO HARDWARE MOBILE & AUTOPLAY POLICY
  // --------------------------------------------------------------------------
  function wakeUpAudioContext() {
    if (window.Howler && Howler.ctx) {
      if (Howler.ctx.state === "suspended" || Howler.ctx.state === "interrupted") {
        Howler.ctx.resume().catch(() => {});
      }
    }
  }

  function unlockMobileAudio() {
    wakeUpAudioContext();

    if (window.Howler && Howler.ctx) {
      try {
        const buffer = Howler.ctx.createBuffer(1, 1, 22050);
        const source = Howler.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(Howler.ctx.destination);
        source.start(0);
      } catch (e) {}
    }

    // Se l'audio non è mutato e non sta suonando nulla, avvia il brano di default
    if (!isMasterMuted && !isBgmMuted && (!currentBgmHowl || !currentBgmHowl.playing())) {
      playBgm(currentBgmKey || "hard_boiled");
    }
  }

  function init() {
    const unlockEvents = ["touchstart", "touchend", "pointerdown", "click"];
    const handleFirstTouch = () => {
      unlockMobileAudio();
      unlockEvents.forEach(evt => window.removeEventListener(evt, handleFirstTouch, { capture: true }));
    };

    unlockEvents.forEach(evtName => {
      window.addEventListener(evtName, handleFirstTouch, { capture: true, passive: true });
    });

    // Gestione cambio visibilità scheda (sospende l'audio quando l'app va in background)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (currentBgmHowl && currentBgmHowl.playing()) currentBgmHowl.pause();
        if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.pause();
      } else {
        wakeUpAudioContext();
        if (!isMasterMuted && !isBgmMuted && currentBgmHowl && !currentBgmHowl.playing() && isPlayingManual) {
          currentBgmHowl.play();
        }
        if (!isMasterMuted && !isSfxMuted && heartbeatHowl && !heartbeatHowl.playing()) {
          heartbeatHowl.play();
        }
      }
    });

    // Precarica i campioni più frequenti
    ["click", "coin", "dice", "hit", "victory", "error"].forEach(key => getOrCreateSfx(key));

    updateMuteUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function getOrCreateSfx(name) {
    if (sfxPlayers[name]) return sfxPlayers[name];
    if (!sfxUrls[name]) return null;

    try {
      sfxPlayers[name] = new Howl({
        src: [sfxUrls[name]],
        format: ["mp3"],
        html5: false, // SFX leggeri in memoria
        volume: getEffectiveSfxVolume(),
        preload: true
      });
      return sfxPlayers[name];
    } catch (e) {
      return null;
    }
  }

  function findTrack(identifier) {
    if (!identifier) return playlist[0];
    const clean = String(identifier).trim().toLowerCase();
    return playlist.find(t => 
      t.id.toLowerCase() === clean || 
      (t.alias && t.alias.map(a => a.toLowerCase()).includes(clean))
    ) || playlist[0];
  }

  // --------------------------------------------------------------------------
  // 5. CALCOLO VOLUMI EFFETTIVI
  // --------------------------------------------------------------------------
  function getEffectiveBgmVolume() {
    if (isMasterMuted || isBgmMuted) return 0;
    return currentMasterVolume * currentBgmVolume;
  }

  function getEffectiveSfxVolume() {
    if (isMasterMuted || isSfxMuted) return 0;
    return currentMasterVolume * currentSfxVolume;
  }

  // --------------------------------------------------------------------------
  // 6. RIPRODUZIONE BGM AUDIUS (STREAMING HTML5 CON CROSS-FADE ASIMMETRICO)
  // --------------------------------------------------------------------------
  function playTabBgm(tabKey) {
    const cleanTab = String(tabKey || "home").toLowerCase().replace("view-", "");
    const track = findTrack(cleanTab);
    if (!track) return;
    playBgm(track.id, 800, 180);
  }

  function playEpisodeBgm(gameKey, episodeNum, mood = "explore") {
    const ep = parseInt(episodeNum, 10) || 1;
    const m = String(mood).toLowerCase();
    let targetKey = "ep1_explore";

    if (ep === 1) {
      targetKey = (m === "combat" || m === "duello") ? "ep1_combat" : "ep1_explore";
    } else if (ep >= 2) {
      targetKey = (m === "combat" || m === "boss") ? "deadly_roulette" : "ep1_explore";
    }

    playBgm(targetKey, 700, 200);
  }

  function playBgm(identifier, fadeInDuration = 800, fadeOutDuration = 180) {
    wakeUpAudioContext();
    const track = findTrack(identifier);
    if (!track) return;

    if (currentBgmKey === track.id && currentBgmHowl && currentBgmHowl.playing()) return;

    // Fade-out rapido (180ms) per azzerare la traccia precedente
    if (fadeOutTimer) {
      clearTimeout(fadeOutTimer);
      fadeOutTimer = null;
    }

    if (currentBgmHowl && currentBgmHowl.playing()) {
      const oldHowl = currentBgmHowl;
      oldHowl.fade(oldHowl.volume(), 0, fadeOutDuration);
      fadeOutTimer = setTimeout(() => {
        try { oldHowl.stop(); } catch (e) {}
      }, fadeOutDuration + 20);
    }

    currentBgmKey = track.id;

    if (!bgmPlayers[track.id]) {
      bgmPlayers[track.id] = new Howl({
        src: [track.src],
        format: ["mp3"],
        html5: true, // FONDAMENTALE PER I FLUSSI STREAMING AUDIUS
        loop: !isShuffle,
        volume: 0,
        onend: function() {
          if (isShuffle) playNextTrack();
        }
      });
    }

    currentBgmHowl = bgmPlayers[track.id];
    isPlayingManual = true;

    const targetVolume = getEffectiveBgmVolume();

    if (!isMasterMuted && !isBgmMuted && targetVolume > 0) {
      try {
        currentBgmHowl.volume(0);
        currentBgmHowl.play();
        currentBgmHowl.fade(0, targetVolume, fadeInDuration);
      } catch (e) {
        unlockMobileAudio();
      }
    }

    notifyAppModules();
  }

  function pauseBgm() {
    if (currentBgmHowl && currentBgmHowl.playing()) {
      currentBgmHowl.pause();
      isPlayingManual = false;
      notifyAppModules();
    }
  }

  function resumeBgm() {
    if (isMasterMuted) toggleMasterMute();

    if (currentBgmHowl && !currentBgmHowl.playing()) {
      currentBgmHowl.play();
      currentBgmHowl.fade(0, getEffectiveBgmVolume(), 600);
      isPlayingManual = true;
    } else if (!currentBgmHowl) {
      playBgm(currentBgmKey || "hard_boiled", 700, 150);
    }
    notifyAppModules();
  }

  function togglePlayPause() {
    if (currentBgmHowl && currentBgmHowl.playing()) {
      pauseBgm();
    } else {
      resumeBgm();
    }
  }

  function duck(targetVolFactor = 0.25, duration = 1200) {
    if (isMasterMuted || isBgmMuted || !currentBgmHowl || !currentBgmHowl.playing()) return;
    if (duckTimer) clearTimeout(duckTimer);

    const baseVol = getEffectiveBgmVolume();
    currentBgmHowl.fade(currentBgmHowl.volume(), baseVol * targetVolFactor, 120);

    duckTimer = setTimeout(() => {
      if (!isMasterMuted && !isBgmMuted && currentBgmHowl && currentBgmHowl.playing()) {
        currentBgmHowl.fade(currentBgmHowl.volume(), baseVol, 350);
      }
      duckTimer = null;
    }, duration);
  }

  // --------------------------------------------------------------------------
  // 7. EFFETTI SONORI SFX
  // --------------------------------------------------------------------------
  function playSfx(name) {
    if (isMasterMuted || isSfxMuted) return;
    wakeUpAudioContext();
    const player = getOrCreateSfx(name);
    if (player) {
      try {
        player.volume(getEffectiveSfxVolume());
        player.play();
      } catch (e) {
        unlockMobileAudio();
      }
    }
  }

  function startHeartbeat() {
    if (isMasterMuted || isSfxMuted) return;
    if (!heartbeatHowl) {
      heartbeatHowl = new Howl({
        src: [sfxUrls.heartbeat],
        format: ["mp3"],
        html5: false,
        loop: true,
        volume: getEffectiveSfxVolume() * 0.5
      });
    }
    if (!heartbeatHowl.playing()) heartbeatHowl.play();
  }

  function stopHeartbeat() {
    if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.stop();
  }

  // --------------------------------------------------------------------------
  // 8. CONTROLLI RADIO & PLAYLIST SPOTIFY DECK
  // --------------------------------------------------------------------------
  function playNextTrack() {
    const curIdx = playlist.findIndex(t => t.id === currentBgmKey);
    let nextIdx;
    if (isShuffle) {
      do { 
        nextIdx = Math.floor(Math.random() * playlist.length); 
      } while (nextIdx === curIdx && playlist.length > 1);
    } else {
      nextIdx = (curIdx + 1) % playlist.length;
    }
    playBgm(playlist[nextIdx].id, 700, 180);
  }

  function playPrevTrack() {
    const curIdx = playlist.findIndex(t => t.id === currentBgmKey);
    const prevIdx = (curIdx - 1 + playlist.length) % playlist.length;
    playBgm(playlist[prevIdx].id, 700, 180);
  }

  function toggleShuffle() {
    isShuffle = !isShuffle;
    localStorage.setItem("estiqatsy_audio_shuffle", isShuffle);
    if (currentBgmHowl) currentBgmHowl.loop(!isShuffle);
    notifyAppModules();
  }

  // --------------------------------------------------------------------------
  // 9. MIXER A 3 CANALI: MASTER, BGM & SFX
  // --------------------------------------------------------------------------
  function setMasterVolume(val) {
    currentMasterVolume = Math.max(0, Math.min(1, parseFloat(val) || 0));
    localStorage.setItem("estiqatsy_master_volume", currentMasterVolume);
    
    if (currentBgmHowl && currentBgmHowl.playing()) {
      currentBgmHowl.volume(getEffectiveBgmVolume());
    }
    notifyAppModules();
  }

  function setBgmVolume(val) {
    currentBgmVolume = Math.max(0, Math.min(1, parseFloat(val) || 0));
    localStorage.setItem("estiqatsy_bgm_volume", currentBgmVolume);
    
    if (currentBgmHowl && currentBgmHowl.playing()) {
      currentBgmHowl.volume(getEffectiveBgmVolume());
    }
    notifyAppModules();
  }

  function setSfxVolume(val) {
    currentSfxVolume = Math.max(0, Math.min(1, parseFloat(val) || 0));
    localStorage.setItem("estiqatsy_sfx_volume", currentSfxVolume);
    
    for (let k in sfxPlayers) {
      if (sfxPlayers[k]) sfxPlayers[k].volume(getEffectiveSfxVolume());
    }
  }

  function toggleMasterMute() {
    isMasterMuted = !isMasterMuted;
    localStorage.setItem("estiqatsy_audio_muted", isMasterMuted);

    if (isMasterMuted) {
      if (currentBgmHowl && currentBgmHowl.playing()) {
        currentBgmHowl.fade(currentBgmHowl.volume(), 0, 150);
      }
      if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.pause();
    } else {
      wakeUpAudioContext();
      if (!isBgmMuted) {
        if (currentBgmHowl && !currentBgmHowl.playing()) {
          currentBgmHowl.volume(0);
          currentBgmHowl.play();
          currentBgmHowl.fade(0, getEffectiveBgmVolume(), 700);
        } else if (!currentBgmHowl) {
          playBgm(currentBgmKey || "hard_boiled", 700, 150);
        }
      }
    }

    updateMuteUI();
    notifyAppModules();
  }

  function toggleBgm() {
    isBgmMuted = !isBgmMuted;
    localStorage.setItem("estiqatsy_bgm_muted", isBgmMuted);

    if (isBgmMuted) {
      if (currentBgmHowl && currentBgmHowl.playing()) currentBgmHowl.fade(currentBgmHowl.volume(), 0, 150);
    } else {
      if (!isMasterMuted && currentBgmHowl && isPlayingManual) {
        currentBgmHowl.play();
        currentBgmHowl.fade(0, getEffectiveBgmVolume(), 600);
      }
    }
    notifyAppModules();
  }

  function toggleSfx() {
    isSfxMuted = !isSfxMuted;
    localStorage.setItem("estiqatsy_sfx_muted", isSfxMuted);
    if (isSfxMuted && heartbeatHowl && heartbeatHowl.playing()) {
      heartbeatHowl.stop();
    }
    notifyAppModules();
  }

  function updateMuteUI() {
    const badgeDesk = document.getElementById("audio-status-desk");
    if (badgeDesk) {
      badgeDesk.textContent = isMasterMuted ? "OFF" : "ON";
      badgeDesk.classList.toggle("badge-error", isMasterMuted);
      badgeDesk.classList.toggle("badge-success", !isMasterMuted);
    }
  }

  function notifyAppModules() {
    if (typeof AppModules !== "undefined" && typeof AppModules.updateRadioDisplay === "function") {
      AppModules.updateRadioDisplay();
    }
  }

  // --------------------------------------------------------------------------
  // 10. ESPOSIZIONE PUBBLICA CON TUTTE LE SCORCIATOIE DI GIOCO RICHIESTE
  // --------------------------------------------------------------------------
  return {
    // Scorciatoie SFX usate direttamente da Rules2Engine & Rules2Wizard
    playClick: () => playSfx("click"),
    playCoin: () => playSfx("coin"),
    playDice: () => playSfx("dice"),
    playVictory: () => playSfx("victory"),
    playError: () => playSfx("error"),

    // Canale SFX generico
    playSfx,
    startHeartbeat,
    stopHeartbeat,

    // BGM & Matrice Pagine / Episodi Audius
    playBgm,
    playTabBgm,
    playEpisodeBgm,
    pauseBgm,
    resumeBgm,
    togglePlayPause,
    duck,

    // Jukebox Audius Deck
    playNextTrack,
    playPrevTrack,
    toggleShuffle,
    getCurrentTrack: () => findTrack(currentBgmKey),
    getPlaylist: () => [...playlist],

    // Mixer a 3 Canali
    toggleMute: toggleMasterMute,
    toggleBgm,
    toggleSfx,
    setMasterVolume,
    setBgmVolume,
    setSfxVolume,

    // Getters Reattivi
    get isPlaying() { return Boolean(currentBgmHowl && currentBgmHowl.playing()); },
    get isMuted() { return isMasterMuted; },
    get isBgmMuted() { return isBgmMuted; },
    get isSfxMuted() { return isSfxMuted; },
    get masterVolume() { return currentMasterVolume; },
    get bgmVolume() { return currentBgmVolume; },
    get sfxVolume() { return currentSfxVolume; }
  };
})();

window.SoundEngine = SoundEngine;
