// ============================================================================
// PROJECT: ESTIQATSY BOT & WEBAPP
// FILE: audio.js (VERSIONE 6.0 - CORE & RULES2 SOUND DESIGN)
// DESCRIZIONE: Motore sonoro per Piattaforma e Motore RPG Noir.
//              - BGM & SFX CORE: Hub, Bottega, Ricette, Profilo, UI Click, Coin.
//              - BGM & SFX RULES2: Wizard, Moli, Combattimento, Dadi, Zombi, Droghe.
//              - Supporto avanzato iOS Safari (Silent Buffer Unlock) e Android.
// ============================================================================

const SoundEngine = (function() {
  let isMuted = localStorage.getItem("estiqatsy_audio_muted") === "true";
  let currentBgmKey = null;
  let currentBgmHowl = null;
  let isUnlocked = false;

  let duckTimer = null;
  let fadeTimer = null;

  const BGM_VOLUME = 0.30; // Volume d'atmosfera equilibrato per la lettura
  const SFX_VOLUME = 0.68; // Volume d'impatto per feedback tattile e dadi

  // ==========================================================================
  // 1. TRACCE MUSICALI BGM (FILE VERIFICATI SU WIKIMEDIA COMMONS)
  // ==========================================================================
  const bgmUrls = {
    // --- AMBITO A: PIATTAFORMA CORE ---
    // Dashboard & Hub Saghe: Hard Boiled (Tromba noir cupa e pioggia)
    core_hub: "https://commons.wikimedia.org/wiki/Special:FilePath/Hard_Boiled_(ISRC_USUAN1700076).mp3",
    intro: "https://commons.wikimedia.org/wiki/Special:FilePath/Hard_Boiled_(ISRC_USUAN1700076).mp3",
    
    // Bottega Syndicate & Mercato: Backbay Lounge (Smoky lounge jazz da bisca)
    core_shop: "https://commons.wikimedia.org/wiki/Special:FilePath/Backbay_Lounge_(ISRC_USUAN1700068).mp3",
    
    // Barlady & Ricettario: Airport Lounge (Jazz rilassato da cocktail bar)
    core_recipes: "https://commons.wikimedia.org/wiki/Special:FilePath/Airport_Lounge_(ISRC_USUAN1100806).mp3",

    // --- AMBITO B: MOTORE RULES2 (RPG NOIR SALMASTRO) ---
    // Wizard Creazione Eroe: Bass Walker (Groove furtivo di contrabbasso)
    rules2_wizard: "https://commons.wikimedia.org/wiki/Special:FilePath/Bass_Walker_(ISRC_USUAN1200071).mp3",
    wizard: "https://commons.wikimedia.org/wiki/Special:FilePath/Bass_Walker_(ISRC_USUAN1200071).mp3",

    // Esplorazione Moli & Capannoni: Covert Affair (Tensione investigativa)
    rules2_explore: "https://commons.wikimedia.org/wiki/Special:FilePath/Covert_Affair_(ISRC_USUAN1100795).mp3",
    exploration: "https://commons.wikimedia.org/wiki/Special:FilePath/Covert_Affair_(ISRC_USUAN1100795).mp3",

    // Padule Notturno & Snodi Cupi: Dark Walk (Miasmi salmastri e sospetto)
    rules2_ambient: "https://commons.wikimedia.org/wiki/Special:FilePath/Dark_Walk_(ISRC_USUAN1100468).mp3",

    // Duello D20 & Rissa da Banchina: Aggressor (Percussioni industriali pesanti)
    rules2_combat: "https://commons.wikimedia.org/wiki/Special:FilePath/Aggressor_(ISRC_USUAN1700051).mp3",
    combat: "https://commons.wikimedia.org/wiki/Special:FilePath/Aggressor_(ISRC_USUAN1700051).mp3",

    // Scontro col Boss / Tensione Estrema: Deadly Roulette (Suspense noir)
    rules2_boss: "https://commons.wikimedia.org/wiki/Special:FilePath/Deadly_Roulette_(ISRC_USUAN1600033).mp3",

    // Morte / Overdose / Sconfitta: Bittersweet (Tragico violoncello disilluso)
    rules2_defeat: "https://commons.wikimedia.org/wiki/Special:FilePath/Bittersweet_(ISRC_USUAN1700004).mp3",
    defeat: "https://commons.wikimedia.org/wiki/Special:FilePath/Bittersweet_(ISRC_USUAN1700004).mp3",

    // Vittoria Duello / Epilogo Capitolo: Opportunity Walks (Blues cinico e trionfale)
    rules2_victory: "https://commons.wikimedia.org/wiki/Special:FilePath/Opportunity_Walks_(ISRC_USUAN1100123).mp3",
    victory: "https://commons.wikimedia.org/wiki/Special:FilePath/Opportunity_Walks_(ISRC_USUAN1100123).mp3"
  };

  // ==========================================================================
  // 2. EFFETTI SONORI SFX (MIXKIT VERIFICATI - CORE + RULES2)
  // ==========================================================================
  const sfxUrls = {
    // --- AMBITO A: UI & INTERFACCIA PIATTAFORMA (CORE) ---
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",          // Tap pulsante UI
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",           // Ritiro / Saldo Megoin
    cash_register: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",  // Cassa Bottega & Banco Cambio
    success: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",        // Acquisto shop / fulfillment
    modal_open: "https://assets.mixkit.co/active_storage/sfx/3115/3115-preview.mp3",     // Apertura cassetto / drawer
    tab_switch: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",       // Cambio tab navigazione

    // --- AMBITO B: GAMEPLAY TATTICO & D20 (RULES2) ---
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",           // Rotolamento D20 su legno
    insert_coin: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3",    // Inizio partita a gettone
    combat_start: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",   // Stinger inizio combattimento
    hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",            // Colpo a segno standard
    crit_hit: "https://assets.mixkit.co/active_storage/sfx/1143/1143-preview.mp3",       // Colpo critico (20 naturale)
    flee: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",             // Fuga rapida tra i moli
    zombie: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",         // Necromanzia / risveglio
    drug: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3",           // Assunzione droga / reagenti
    bribe: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3",          // Corruzione con banconote
    clue_found: "https://assets.mixkit.co/active_storage/sfx/1133/1133-preview.mp3"     // Scatto foto / reperto dossier
  };

  const sfxPlayers = {};
  const bgmPlayers = {};

  // ==========================================================================
  // 3. SBLOCCO AUDIO AVANZATO PER APPLE IOS (SAFARI WEBKIT) & TELEGRAM
  // ==========================================================================
  function playSilentBuffer() {
    if (!window.Howler || !Howler.ctx) return;
    try {
      const buffer = Howler.ctx.createBuffer(1, 1, 22050);
      const source = Howler.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(Howler.ctx.destination);
      source.start(0);
      isUnlocked = true;
    } catch (e) {
      console.warn("[SoundEngine] Silent buffer fallito:", e);
    }
  }

  function unlockAudioContext() {
    if (isUnlocked) return;

    if (window.Howler && Howler.ctx) {
      if (Howler.ctx.state === "suspended") {
        Howler.ctx.resume().then(() => {
          playSilentBuffer();
          cleanupUnlockListeners();
        }).catch(() => {});
      } else {
        playSilentBuffer();
        cleanupUnlockListeners();
      }
    }
  }

  function cleanupUnlockListeners() {
    window.removeEventListener("touchstart", unlockAudioContext, true);
    window.removeEventListener("touchend", unlockAudioContext, true);
    window.removeEventListener("click", unlockAudioContext, true);
  }

  // ==========================================================================
  // 4. INIZIALIZZAZIONE & GESTIONE VISIBILITÀ MOBILE
  // ==========================================================================
  function init() {
    window.addEventListener("touchstart", unlockAudioContext, true);
    window.addEventListener("touchend", unlockAudioContext, true);
    window.addEventListener("click", unlockAudioContext, true);

    // Precarica in memoria SOLO i suoni di base UI per non intasare la banda su mobile
    const coreEssentialSfx = ["click", "coin", "insert_coin", "dice", "cash_register"];
    coreEssentialSfx.forEach(key => getOrCreateSfx(key));

    // Sospensione audio intelligente quando Telegram viene minimizzato
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (currentBgmHowl && currentBgmHowl.playing()) {
          currentBgmHowl.pause();
        }
      } else {
        if (!isMuted && currentBgmHowl && !currentBgmHowl.playing()) {
          currentBgmHowl.play();
        }
      }
    });

    updateMuteUI();
  }

  // Factory Lazy: carica l'audio solo alla prima richiesta e lo inserisce in cache
  function getOrCreateSfx(name) {
    if (sfxPlayers[name]) return sfxPlayers[name];
    if (!sfxUrls[name]) return null;

    try {
      sfxPlayers[name] = new Howl({
        src: [sfxUrls[name]],
        format: ["mp3"],
        volume: SFX_VOLUME,
        preload: true
      });
      return sfxPlayers[name];
    } catch (e) {
      console.warn("[SoundEngine] Impossibile inizializzare SFX:", name);
      return null;
    }
  }

  // ==========================================================================
  // 5. METODI PUBBLICI: CONTROLLO SFX, BGM & DUCKING
  // ==========================================================================

  function playSfx(name) {
    if (isMuted) return;
    const player = getOrCreateSfx(name);
    if (!player) return;

    try {
      player.play();
    } catch (e) {
      console.warn("[SoundEngine] Errore riproduzione SFX:", name);
    }
  }

  function playBgm(name, fadeDuration = 1000) {
    if (!bgmUrls[name]) return;
    if (currentBgmKey === name && currentBgmHowl && currentBgmHowl.playing()) return;

    // Cancella eventuali timer di dissolvenza pendenti per evitare sovrapposizioni cacofoniche
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

    currentBgmKey = name;

    // Streaming progressivo HTML5 per preservare la RAM su iOS Safari
    if (!bgmPlayers[name]) {
      bgmPlayers[name] = new Howl({
        src: [bgmUrls[name]],
        format: ["mp3"],
        html5: true,
        loop: true,
        volume: 0
      });
    }

    currentBgmHowl = bgmPlayers[name];

    if (!isMuted) {
      try {
        currentBgmHowl.play();
        currentBgmHowl.fade(0, BGM_VOLUME, fadeDuration);
      } catch (e) {
        console.warn("[SoundEngine] BGM in attesa di interazione utente:", name);
      }
    }
  }

  function stopBgm(fadeDuration = 800) {
    if (!currentBgmHowl) return;
    const howl = currentBgmHowl;
    currentBgmKey = null;
    currentBgmHowl = null;

    if (fadeTimer) clearTimeout(fadeTimer);

    howl.fade(howl.volume(), 0, fadeDuration);
    fadeTimer = setTimeout(() => {
      try { howl.stop(); } catch (e) {}
    }, fadeDuration);
  }

  // Audio Ducking Robusto: abbassa la musica durante i colpi critici o gli eventi
  function duck(targetVol = 0.08, duration = 1200) {
    if (isMuted || !currentBgmHowl || !currentBgmHowl.playing()) return;

    if (duckTimer) clearTimeout(duckTimer);

    currentBgmHowl.fade(currentBgmHowl.volume(), targetVol, 150);
    duckTimer = setTimeout(() => {
      if (!isMuted && currentBgmHowl && currentBgmHowl.playing()) {
        currentBgmHowl.fade(currentBgmHowl.volume(), BGM_VOLUME, 400);
      }
      duckTimer = null;
    }, duration);
  }

  function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem("estiqatsy_audio_muted", isMuted);

    if (window.Howler) {
      Howler.mute(isMuted);
    }

    if (!isMuted && currentBgmHowl && !currentBgmHowl.playing()) {
      currentBgmHowl.play();
      currentBgmHowl.fade(0, BGM_VOLUME, 800);
    }

    updateMuteUI();
  }

  // Sincronizzazione visiva pulsanti Mute (100% Semantica CSS)
  function updateMuteUI() {
    const badgeDesk = document.getElementById("audio-status-desk");
    if (badgeDesk) {
      badgeDesk.textContent = isMuted ? "OFF" : "ON";
      badgeDesk.classList.toggle("badge-error", isMuted);
      badgeDesk.classList.toggle("badge-success", !isMuted);
    }

    const btnMob = document.getElementById("audio-toggle-btn-mob");
    if (btnMob) {
      btnMob.classList.toggle("muted", isMuted);
    }
  }

  window.addEventListener("DOMContentLoaded", init);

  return {
    playSfx: playSfx,
    playBgm: playBgm,
    stopBgm: stopBgm,
    duck: duck,
    toggleMute: toggleMute,
    isMuted: () => isMuted,
    // Alias semantici di dominio
    playCoreBgm: (k) => playBgm(k.startsWith("core_") ? k : `core_${k}`),
    playRulesBgm: (k) => playBgm(k.startsWith("rules2_") ? k : `rules2_${k}`),
    playCoreSfx: playSfx,
    playRulesSfx: playSfx
  };
})();

window.SoundEngine = SoundEngine;
