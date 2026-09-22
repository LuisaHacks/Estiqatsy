// ============================================================================
// PROJECT: ESTIQATSY BOT & RPG PLATFORM
// FILE: js/audio.js (VERSIONE 8.0 - 100% MP3 UNIVERSAL & IOS IMMUNE)
// DESCRIZIONE: Motore sonoro ad alta fedeltà compatibile con iPhone, Android & Web.
//              - Zero file .ogg (100% MP3 compatibile con Apple WebKit)
//              - Inizializzazione immediata con verifica document.readyState
//              - Auto-Resume Watchdog ad ogni interazione touch
//              - Matrice colonne sonore scalabile per singolo Episodio
//              - SFX fisici, colpi secchi e feedback diegetico
// ============================================================================

const SoundEngine = (function() {
  let isMuted = localStorage.getItem("estiqatsy_audio_muted") === "true";
  let isShuffle = localStorage.getItem("estiqatsy_audio_shuffle") === "true";
  let currentBgmKey = "hard_boiled";
  let currentBgmHowl = null;
  let heartbeatHowl = null;
  let isPlayingManual = false;

  let duckTimer = null;
  let fadeTimer = null;

  const DEFAULT_BGM_VOLUME = 0.32;
  const DEFAULT_SFX_VOLUME = 0.80;
  let currentBgmVolume = parseFloat(localStorage.getItem("estiqatsy_bgm_volume")) || DEFAULT_BGM_VOLUME;

  // ==========================================================================
  // 1. CATALOGO BGM 100% MP3 (WIKIMEDIA COMMONS VERIFICATI SENZA .OGG)
  // ==========================================================================
  const playlist = [
    {
      id: "hard_boiled",
      alias: ["intro", "core_hub", "hub"],
      title: "Hard Boiled",
      artist: "Kevin MacLeod",
      mood: "Tromba Noir & Pioggia Salmastra",
      tag: "HUB NOIR",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Hard_Boiled_(ISRC_USUAN1700076).mp3"
    },
    {
      id: "bass_walker",
      alias: ["wizard", "rules2_wizard"],
      title: "Bass Walker",
      artist: "Kevin MacLeod",
      mood: "Groove Poliziottesco Anni '70",
      tag: "WIZARD",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Bass_Walker_(ISRC_USUAN1200071).mp3"
    },
    {
      id: "ep1_explore",
      alias: ["exploration", "rules2_explore", "ep1_esplorazione"],
      title: "Covert Affair",
      artist: "Kevin MacLeod",
      mood: "Infiltrazione Notturna sui Moli",
      tag: "EP1 ESPLORA",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Covert_Affair_(ISRC_USUAN1100795).mp3"
    },
    {
      id: "ep1_combat",
      alias: ["combat", "rules2_combat", "ep1_combattimento"],
      title: "Aggressor",
      artist: "Kevin MacLeod",
      mood: "Rissa da Banchina & Duello D20",
      tag: "EP1 DUELLO",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Aggressor_(ISRC_USUAN1700051).mp3"
    },
    {
      id: "ep2_explore",
      alias: ["ep2_esplorazione", "padule"],
      title: "Dark Walk",
      artist: "Kevin MacLeod",
      mood: "Tensione Cupa nel Padule",
      tag: "EP2 ESPLORA",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Dark_Walk_(ISRC_USUAN1100468).mp3"
    },
    {
      id: "deadly_roulette",
      alias: ["rules2_boss", "boss", "ep3_combattimento"],
      title: "Deadly Roulette",
      artist: "Kevin MacLeod",
      mood: "Scontro Decisivo con i Capifazione",
      tag: "BOSS FIGHT",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Deadly_Roulette_(ISRC_USUAN1600033).mp3"
    },
    {
      id: "backbay_lounge",
      alias: ["core_shop", "emporio"],
      title: "Backbay Lounge",
      artist: "Kevin MacLeod",
      mood: "Smoky Lounge Jazz da Bisca",
      tag: "EMPORIO",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Backbay_Lounge_(ISRC_USUAN1700068).mp3"
    },
    {
      id: "opportunity_walks",
      alias: ["victory", "rules2_victory"],
      title: "Opportunity Walks",
      artist: "Kevin MacLeod",
      mood: "Blues Cinico e Risolutivo",
      tag: "VITTORIA",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Opportunity_Walks_(ISRC_USUAN1100123).mp3"
    },
    {
      id: "bittersweet",
      alias: ["defeat", "rules2_defeat"],
      title: "Bittersweet",
      artist: "Kevin MacLeod",
      mood: "Disillusione e Sconfitta al Molo",
      tag: "SCONFITTA",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Bittersweet_(ISRC_USUAN1700004).mp3"
    }
  ];

  // ==========================================================================
  // 2. EFFETTI SONORI SFX 100% MP3 (ZERO .OGG - PIENA COMPATIBILITÀ IPHONE)
  // ==========================================================================
  const sfxUrls = {
    // Interfaccia & Carte
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    card_flip: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    flee: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    modal_open: "https://assets.mixkit.co/active_storage/sfx/3115/3115-preview.mp3",

    // Gettoniera, Vendita & Oro
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    insert_coin: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3",
    cash_register: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
    bribe: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3",

    // Tiri Dado & Tensione
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    shock: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",

    // Eventi Fortunati (D20=20 / Vittoria)
    lucky: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    success: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    d20_crit: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",

    // Eventi Sfortunati (D20=1 / Morte / Fumble)
    unlucky: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    sad_trombone: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    zelda_death: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    d20_fail: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",

    // Combattimento: Colpo Secco Standard vs Critico Pesante
    hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    crit_hit: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    hurt: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",

    // Consumabili, Necromanzia & Dossier
    drug: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3",
    zombie: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",
    evil_laugh: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",
    clue_found: "https://assets.mixkit.co/active_storage/sfx/1133/1133-preview.mp3",

    // Battito Cardiaco Bassa Salute (Loop Ansia)
    heartbeat: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3"
  };

  const sfxPlayers = {};
  const bgmPlayers = {};

  // ==========================================================================
  // 3. SBLOCCO AUDIO HARDWARE MOBILE & WATCHDOG TELEGRAM
  // ==========================================================================
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

    try {
      const silentAudio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      const promise = silentAudio.play();
      if (promise !== undefined) {
        promise.then(() => {
          silentAudio.pause();
          silentAudio.remove();
        }).catch(() => {});
      }
    } catch (e) {}
  }

  // ==========================================================================
  // 4. INIZIALIZZAZIONE SICURA (NO BUG DOMCONTENTLOADED)
  // ==========================================================================
  function init() {
    const unlockEvents = ["touchstart", "touchend", "pointerdown", "click"];
    unlockEvents.forEach(evtName => {
      window.addEventListener(evtName, unlockMobileAudio, { capture: true, passive: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (currentBgmHowl && currentBgmHowl.playing()) currentBgmHowl.pause();
        if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.pause();
      } else {
        wakeUpAudioContext();
        if (!isMuted && currentBgmHowl && !currentBgmHowl.playing() && isPlayingManual) {
          currentBgmHowl.play();
        }
        if (!isMuted && heartbeatHowl && !heartbeatHowl.playing()) {
          heartbeatHowl.play();
        }
      }
    });

    // Precarica i suoni di interazione frequenti
    ["click", "insert_coin", "dice", "hit", "crit_hit", "cash_register"].forEach(key => getOrCreateSfx(key));

    updateMuteUI();
  }

  // Risoluzione certa dell'inizializzazione
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
        volume: DEFAULT_SFX_VOLUME,
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

  // ==========================================================================
  // 5. RIPRODUZIONE, DUCKING & MATRICE EPISODI
  // ==========================================================================
  function playSfx(name) {
    if (isMuted) return;
    wakeUpAudioContext();
    const player = getOrCreateSfx(name);
    if (player) {
      try {
        player.play();
      } catch (e) {
        unlockMobileAudio();
      }
    }
  }

  function playEpisodeBgm(gameKey, episodeNum, mood = "explore", fadeDuration = 1000) {
    const ep = parseInt(episodeNum, 10) || 1;
    const m = String(mood).toLowerCase();
    let targetKey = "ep1_explore";

    if (ep === 1) {
      targetKey = (m === "combat" || m === "duello") ? "ep1_combat" : "ep1_explore";
    } else if (ep === 2) {
      targetKey = (m === "combat" || m === "duello") ? "deadly_roulette" : "ep2_explore";
    } else if (ep >= 3) {
      targetKey = (m === "combat" || m === "boss") ? "deadly_roulette" : "ep1_explore";
    }

    playBgm(targetKey, fadeDuration);
  }

  function playBgm(identifier, fadeDuration = 1000) {
    wakeUpAudioContext();
    const track = findTrack(identifier);
    if (!track) return;

    if (currentBgmKey === track.id && currentBgmHowl && currentBgmHowl.playing()) return;

    if (fadeTimer) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }

    if (currentBgmHowl) {
      const oldHowl = currentBgmHowl;
      oldHowl.fade(oldHowl.volume(), 0, fadeDuration);
      fadeTimer = setTimeout(() => {
        try { oldHowl.stop(); } catch (e) {}
      }, fadeDuration);
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

    if (!isMuted) {
      try {
        currentBgmHowl.play();
        currentBgmHowl.fade(0, currentBgmVolume, fadeDuration);
      } catch (e) {
        unlockMobileAudio();
      }
    }
  }

  function pauseBgm() {
    if (currentBgmHowl && currentBgmHowl.playing()) {
      currentBgmHowl.pause();
      isPlayingManual = false;
    }
  }

  function resumeBgm() {
    if (isMuted) toggleMute();
    if (currentBgmHowl && !currentBgmHowl.playing()) {
      currentBgmHowl.play();
      currentBgmHowl.fade(0, currentBgmVolume, 500);
      isPlayingManual = true;
    } else if (!currentBgmHowl) {
      playBgm(currentBgmKey || "hard_boiled");
    }
  }

  function stopBgm(fadeDuration = 800) {
    if (!currentBgmHowl) return;
    const howl = currentBgmHowl;
    currentBgmHowl = null;
    isPlayingManual = false;
    if (fadeTimer) clearTimeout(fadeTimer);
    howl.fade(howl.volume(), 0, fadeDuration);
    fadeTimer = setTimeout(() => {
      try { howl.stop(); } catch (e) {}
    }, fadeDuration);
  }

  function duck(targetVol = 0.08, duration = 1200) {
    if (isMuted || !currentBgmHowl || !currentBgmHowl.playing()) return;
    if (duckTimer) clearTimeout(duckTimer);
    currentBgmHowl.fade(currentBgmHowl.volume(), targetVol, 150);
    duckTimer = setTimeout(() => {
      if (!isMuted && currentBgmHowl && currentBgmHowl.playing()) {
        currentBgmHowl.fade(currentBgmHowl.volume(), currentBgmVolume, 400);
      }
      duckTimer = null;
    }, duration);
  }

  function startHeartbeat() {
    if (isMuted) return;
    if (!heartbeatHowl) {
      heartbeatHowl = new Howl({
        src: [sfxUrls.heartbeat],
        format: ["mp3"],
        loop: true,
        volume: 0.4
      });
    }
    if (!heartbeatHowl.playing()) heartbeatHowl.play();
  }

  function stopHeartbeat() {
    if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.stop();
  }

  function playNextTrack() {
    const curIdx = playlist.findIndex(t => t.id === currentBgmKey);
    let nextIdx;
    if (isShuffle) {
      do { nextIdx = Math.floor(Math.random() * playlist.length); } while (nextIdx === curIdx && playlist.length > 1);
    } else {
      nextIdx = (curIdx + 1) % playlist.length;
    }
    playBgm(playlist[nextIdx].id, 800);
  }

  function playPrevTrack() {
    const curIdx = playlist.findIndex(t => t.id === currentBgmKey);
    const prevIdx = (curIdx - 1 + playlist.length) % playlist.length;
    playBgm(playlist[prevIdx].id, 800);
  }

  function toggleShuffle() {
    isShuffle = !isShuffle;
    localStorage.setItem("estiqatsy_audio_shuffle", isShuffle);
    if (currentBgmHowl) currentBgmHowl.loop(!isShuffle);
  }

  function setBgmVolume(val) {
    currentBgmVolume = Math.max(0, Math.min(1, parseFloat(val) || DEFAULT_BGM_VOLUME));
    localStorage.setItem("estiqatsy_bgm_volume", currentBgmVolume);
    if (currentBgmHowl) currentBgmHowl.volume(currentBgmVolume);
  }

  function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem("estiqatsy_audio_muted", isMuted);
    if (window.Howler) Howler.mute(isMuted);
    if (!isMuted && currentBgmHowl && !currentBgmHowl.playing() && isPlayingManual) {
      currentBgmHowl.play();
      currentBgmHowl.fade(0, currentBgmVolume, 800);
    }
    updateMuteUI();
  }

  function updateMuteUI() {
    const badgeDesk = document.getElementById("audio-status-desk");
    if (badgeDesk) {
      badgeDesk.textContent = isMuted ? "OFF" : "ON";
      badgeDesk.classList.toggle("badge-error", isMuted);
      badgeDesk.classList.toggle("badge-success", !isMuted);
    }
  }

  return {
    playSfx,
    playBgm,
    playEpisodeBgm,
    pauseBgm,
    resumeBgm,
    stopBgm,
    duck,
    startHeartbeat,
    stopHeartbeat,
    playNextTrack,
    playPrevTrack,
    toggleShuffle,
    setVolume: setBgmVolume,
    toggleMute,
    isMuted: () => isMuted
  };
})();

window.SoundEngine = SoundEngine;
