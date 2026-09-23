// ============================================================================
// PROJECT: ESTIQATSY BOT & RPG PLATFORM
// FILE: js/audio.js (VERSIONE 10.0 - ASYMMETRIC CROSS-FADE & 3-CHANNEL MIXER)
// DESCRIZIONE: Motore sonoro ad alta fedeltà con gestione a 3 canali:
//              - Canale 1: Volume Generale (Master)
//              - Canale 2: Musica di Sottofondo (BGM con 5 colonne sonore)
//              - Canale 3: Effetti Sonori (SFX & Battito Cardiaco)
//              - Mixaggio Asimmetrico: Fade-Out rapido (180ms) e Fade-In morbido (800ms)
//              - Silenzioso al primo avvio (Safe Autoplay) con sblocco hardware al tocco
//              - Controller Jukebox & Deck Spotify con playlist selezionabile
// ============================================================================

const SoundEngine = (function() {
  'use strict';

  // --------------------------------------------------------------------------
  // STATO PERSISTENTE & IMPOSTAZIONI PREDEFINITE
  // --------------------------------------------------------------------------
  // Default: Silenzioso al primo avvio se l'utente non ha mai espresso preferenze
  const storedMute = localStorage.getItem("estiqatsy_audio_muted");
  let isMasterMuted = storedMute !== null ? storedMute === "true" : true;

  let isBgmMuted = localStorage.getItem("estiqatsy_bgm_muted") === "true";
  let isSfxMuted = localStorage.getItem("estiqatsy_sfx_muted") === "true";
  let isShuffle = localStorage.getItem("estiqatsy_audio_shuffle") === "true";

  // Volumi a 3 Canali Indipendenti
  const DEFAULT_MASTER_VOLUME = 0.80;
  const DEFAULT_BGM_VOLUME = 0.35;
  const DEFAULT_SFX_VOLUME = 0.85;

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
  // 1. CATALOGO BGM: 5 COLONNE SONORE TAB + ATMOSFERE DI GIOCO (100% MP3)
  // --------------------------------------------------------------------------
  const playlist = [
    // --- 5 TRACCE D'AMBIENTE PER LE 5 PAGINE PRINCIPALI ---
    {
      id: "hard_boiled",
      alias: ["home", "view-home", "intro"],
      title: "Hard Boiled",
      artist: "Kevin MacLeod",
      mood: "Tromba Noir & Pioggia Salmastra",
      tag: "HOME NOIR",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Hard_Boiled_(ISRC_USUAN1700076).mp3"
    },
    {
      id: "bass_walker",
      alias: ["games", "view-hub", "hub", "giochi"],
      title: "Bass Walker",
      artist: "Kevin MacLeod",
      mood: "Groove Poliziottesco & Tensione",
      tag: "SALA GIOCHI",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Bass_Walker_(ISRC_USUAN1200071).mp3"
    },
    {
      id: "backbay_lounge",
      alias: ["shop", "view-shop", "mercato", "emporio"],
      title: "Backbay Lounge",
      artist: "Kevin MacLeod",
      mood: "Smoky Jazz da Bisca Clandestina",
      tag: "MERCATO",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Backbay_Lounge_(ISRC_USUAN1700068).mp3"
    },
    {
      id: "opportunity_walks",
      alias: ["recipes", "view-recipes", "ricette", "barlady"],
      title: "Opportunity Walks",
      artist: "Kevin MacLeod",
      mood: "Warm Lounge Blues da Bancone",
      tag: "RICETTARIO",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Opportunity_Walks_(ISRC_USUAN1100123).mp3"
    },
    {
      id: "dark_walk",
      alias: ["profile", "view-profile", "profilo", "dossier"],
      title: "Dark Walk",
      artist: "Kevin MacLeod",
      mood: "Tema Investigativo Cupo & Solenne",
      tag: "HUB AGENTE",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Dark_Walk_(ISRC_USUAN1100468).mp3"
    },

    // --- TRACCE DI GAMEPLAY & COMBATTIMENTO RPG ---
    {
      id: "ep1_explore",
      alias: ["exploration", "rules2_explore", "ep1_esplorazione"],
      title: "Covert Affair",
      artist: "Kevin MacLeod",
      mood: "Infiltrazione Notturna sui Moli",
      tag: "EPISODIO ESPLORA",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Covert_Affair_(ISRC_USUAN1100795).mp3"
    },
    {
      id: "ep1_combat",
      alias: ["combat", "rules2_combat", "ep1_combattimento"],
      title: "Aggressor",
      artist: "Kevin MacLeod",
      mood: "Rissa da Banchina & Duello D20",
      tag: "EPISODIO DUELLO",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Aggressor_(ISRC_USUAN1700051).mp3"
    },
    {
      id: "deadly_roulette",
      alias: ["rules2_boss", "boss", "boss_fight"],
      title: "Deadly Roulette",
      artist: "Kevin MacLeod",
      mood: "Scontro Mortale con il Boss",
      tag: "BOSS FIGHT",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Deadly_Roulette_(ISRC_USUAN1600033).mp3"
    },
    {
      id: "bittersweet",
      alias: ["defeat", "rules2_defeat", "morte"],
      title: "Bittersweet",
      artist: "Kevin MacLeod",
      mood: "Disillusione & Sconfitta al Molo",
      tag: "GAME OVER",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Bittersweet_(ISRC_USUAN1700004).mp3"
    }
  ];

  // --------------------------------------------------------------------------
  // 2. EFFETTI SONORI SFX (CANALE INDIPENDENTE 100% MP3)
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
    heartbeat: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3"
  };

  const sfxPlayers = {};
  const bgmPlayers = {};

  // --------------------------------------------------------------------------
  // 3. SBLOCCO AUDIO HARDWARE MOBILE & AUTOPLAY POLICY
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
  }

  function init() {
    const unlockEvents = ["touchstart", "touchend", "pointerdown", "click"];
    unlockEvents.forEach(evtName => {
      window.addEventListener(evtName, unlockMobileAudio, { capture: true, passive: true });
    });

    // Gestione cambio visibilità scheda (Pausa quando l'app va in background)
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

    // Precarica i suoni di sistema frequenti
    ["click", "coin", "dice", "hit"].forEach(key => getOrCreateSfx(key));

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
  // 4. CALCOLO VOLUMI EFFETTIVI
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
  // 5. RIPRODUZIONE BGM: MIXAGGIO ASIMMETRICO (FADE-OUT 180ms, FADE-IN 800ms)
  // --------------------------------------------------------------------------
  function playTabBgm(tabKey) {
    const cleanTab = String(tabKey || "home").toLowerCase().replace("view-", "");
    const track = findTrack(cleanTab);
    if (!track) return;

    // Fade-out rapido (180ms) per azzerare subito la musica precedente
    // Fade-in morbido (800ms) per far salire la traccia del nuovo tab
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

    // Se la traccia è già attiva e in riproduzione, non interromperla
    if (currentBgmKey === track.id && currentBgmHowl && currentBgmHowl.playing()) return;

    // 🔒 1. FADE-OUT VELOCE (180ms): Cancella la scena acustica precedente
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
        html5: false,
        loop: !isShuffle,
        volume: 0,
        onend: function() {
          if (isShuffle) playNextTrack();
        }
      });
    }

    currentBgmHowl = bgmPlayers[track.id];
    isPlayingManual = true;

    // 🔒 2. FADE-IN MORBIDO (800ms): Solleva delicatamente la nuova traccia
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
  // 6. RIPRODUZIONE EFFETTI SONORI SFX
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
  // 7. CONTROLLI RADIO & PLAYLIST (SPOTIFY DECK)
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
  // 8. MIXER A 3 CANALI: MASTER, BGM & SFX
  // --------------------------------------------------------------------------
  function setMasterVolume(val) {
    currentMasterVolume = Math.max(0, Math.min(1, parseFloat(val) || 0));
    localStorage.setItem("estiqatsy_master_volume", currentMasterVolume);
    
    // Aggiorna la musica in esecuzione
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

  // Tasto Unico Muto (Spegne/Accende tutti e 3 i canali)
  function toggleMasterMute() {
    isMasterMuted = !isMasterMuted;
    localStorage.setItem("estiqatsy_audio_muted", isMasterMuted);

    if (isMasterMuted) {
      // Fade-out istantaneo verso il silenzio
      if (currentBgmHowl && currentBgmHowl.playing()) {
        currentBgmHowl.fade(currentBgmHowl.volume(), 0, 150);
      }
      if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.pause();
    } else {
      // Sblocco e ripresa con dissolvenza morbida
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
  // 9. ESPOSIZIONE PUBBLICA SOUNDENGINE
  // --------------------------------------------------------------------------
  return {
    // SFX
    playSfx,
    startHeartbeat,
    stopHeartbeat,

    // BGM & Matrice Pagine / Episodi
    playBgm,
    playTabBgm,
    playEpisodeBgm,
    pauseBgm,
    resumeBgm,
    togglePlayPause,
    duck,

    // Playlist Jukebox Spotify
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

    // Getters di Stato Reattivi
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
