// ============================================================================
// PROJECT: ESTIQATSY BOT & WEBAPP
// FILE: audio.js (VERSIONE 4.0 - CINEMA NOIR, TACTICAL SOUND DESIGN & HOWLER.JS)
// DESCRIZIONE: Motore sonoro avanzato per WebApp e RPG Engine.
//              Musiche BGM noir/poliziottesco, SFX diegetici specifici per ogni azione,
//              Audio Ducking sui colpi critici, sblocco iOS Safari e crossfade fluido.
// ============================================================================

const SoundEngine = (function() {
  let isMuted = localStorage.getItem("estiqatsy_audio_muted") === "true";
  let currentBgmKey = null;
  let currentBgmHowl = null;
  let isUnlocked = false;

  const BGM_VOLUME = 0.32; // Volume d'atmosfera per non disturbare la lettura
  const SFX_VOLUME = 0.70; // Volume d'impatto per feedback tattile e dadi

  // ==========================================================================
  // 1. TRACCE MUSICALI BGM (COERENZA NARRATIVA NOIR SALMASTRO & POLIZIOTTESCO)
  // File MP3 verificati, stabili e compatibili con iOS WebKit / Android / Desktop
  // ==========================================================================
  const bgmUrls = {
    // A. Intro / Hub Serie / Banchina (Hard-Boiled Detective Jazz: tromba cupa e pioggia)
    intro: "https://commons.wikimedia.org/wiki/Special:FilePath/Hard_Boiled_(ISRC_USUAN1700076).mp3",
    
    // B. Wizard Creazione Eroe (Poliziottesco anni '70: contrabbasso furtivo e groove da strada)
    wizard: "https://commons.wikimedia.org/wiki/Special:FilePath/Bass_Walker_(ISRC_USUAN1100720).mp3",
    
    // C. Esplorazione & Snodi Padule (Dark Coastal Ambient: vento cupo, miasmi e tensione salmastra)
    exploration: "https://commons.wikimedia.org/wiki/Special:FilePath/Ossuary_1_-_A_Beginning_(ISRC_USUAN1500045).mp3",
    
    // D. Duello & Combattimento (Ritmica industriale e percussioni grezze da rissa da banchina)
    combat: "https://commons.wikimedia.org/wiki/Special:FilePath/Volatile_Reaction_(ISRC_USUAN1400039).mp3",
    
    // E. Emporio Ciccio & CO. (Smoky Lounge Jazz da bisca e ricettatore portuale clandestino)
    emporio: "https://commons.wikimedia.org/wiki/Special:FilePath/Backbay_Lounge_(ISRC_USUAN1700068).mp3",
    
    // F. Morte / Overdose / Sconfitta (Tragico e disilluso: violoncello e desolazione)
    defeat: "https://commons.wikimedia.org/wiki/Special:FilePath/Bittersweet_(ISRC_USUAN1700004).mp3",
    
    // G. Vittoria / Epilogo Capitolo (Groove blues/jazz cinico e trionfale, non infantile)
    victory: "https://commons.wikimedia.org/wiki/Special:FilePath/Opportunity_Walks_(ISRC_USUAN1100588).mp3"
  };

  // ==========================================================================
  // 2. EFFETTI SONORI SFX (DISTINZIONE DIEGETICA PER OGNI AZIONE DI GIOCO)
  // ==========================================================================
  const sfxUrls = {
    // Interfaccia e Navigazione
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    
    // Tiro del Dado D20 (Rimbalzo pesante su legno/pietra)
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    
    // Inserimento Gettone Megoin (Arcade Coin Drop)
    insert_coin: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3",
    
    // Guadagno Monete d'Oro / Saldo
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    
    // Banco di Cambio / Cassa Emporio
    cash_register: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
    
    // Allarme Ingresso Combattimento (Stinger drammatico)
    combat_start: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    
    // Colpo a Segno Standard (Lama / cricchetto / impatto)
    hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    
    // Colpo Critico (20 Naturale: impatto devastante con riverbero)
    crit_hit: "https://assets.mixkit.co/active_storage/sfx/1143/1143-preview.mp3",
    
    // Fuga Riuscita tra i rovi (Scatto rapido e fruscio)
    flee: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    
    // Rianimazione Zombie / Risveglio chimico (Tono viscerale oscuro)
    zombie: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",
    
    // Cessione Droga / Inalazione sostanze (Accendino/fruscio chimico)
    drug: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3",

    // Corruzione / Mazzetta (Fruscio di carta moneta e metallo)
    bribe: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3",
    
    // Reperto Trovato / Prova Dossier acquisita
    clue_found: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",

    // Vittoria Scontro
    victory: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
    
    // Sconfitta / Collasso
    defeat: "https://assets.mixkit.co/active_storage/sfx/2303/2303-preview.mp3"
  };

  const sfxPlayers = {};
  const bgmPlayers = {};

  /**
   * Sblocco forzato AudioContext per iOS Safari & Telegram WebApp al primo tocco
   */
  function unlockAudioContext() {
    if (isUnlocked) return;
    
    if (window.Howler && Howler.ctx) {
      if (Howler.ctx.state === "suspended") {
        Howler.ctx.resume().then(() => {
          isUnlocked = true;
        });
      } else {
        isUnlocked = true;
      }
    }

    window.removeEventListener("touchstart", unlockAudioContext, true);
    window.removeEventListener("touchend", unlockAudioContext, true);
    window.removeEventListener("click", unlockAudioContext, true);
  }

  /**
   * Inizializzazione motore e precaricamento SFX
   */
  function init() {
    window.addEventListener("touchstart", unlockAudioContext, true);
    window.addEventListener("touchend", unlockAudioContext, true);
    window.addEventListener("click", unlockAudioContext, true);

    // Precarica gli SFX leggeri in memoria
    for (let key in sfxUrls) {
      try {
        sfxPlayers[key] = new Howl({
          src: [sfxUrls[key]],
          format: ["mp3"],
          volume: SFX_VOLUME,
          preload: true
        });
      } catch (e) {
        console.warn("SFX warning:", key);
      }
    }

    // Gestione background: sospende l'audio se Telegram viene minimizzato
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

  /**
   * Riproduzione di un effetto sonoro con gestione di sicurezza
   */
  function playSfx(name) {
    if (isMuted || !sfxPlayers[name]) return;
    try {
      sfxPlayers[name].play();
    } catch (e) {
      console.warn("Errore SFX:", name);
    }
  }

  /**
   * Riproduzione BGM con dissolvenza incrociata automatica (Crossfade)
   */
  function playBgm(name, fadeDuration = 1000) {
    if (!bgmUrls[name]) return;
    if (currentBgmKey === name && currentBgmHowl && currentBgmHowl.playing()) return;

    // Se c'è già una musica in corso, sfumala ed arrestala
    if (currentBgmHowl) {
      const oldHowl = currentBgmHowl;
      oldHowl.fade(oldHowl.volume(), 0, fadeDuration);
      setTimeout(() => {
        try { oldHowl.stop(); } catch (e) {}
      }, fadeDuration);
    }

    currentBgmKey = name;

    // Caricamento in streaming HTML5 solo quando il brano viene richiesto (salva RAM su iOS)
    if (!bgmPlayers[name]) {
      bgmPlayers[name] = new Howl({
        src: [bgmUrls[name]],
        format: ["mp3"],
        html5: true, // Streaming progressivo indispensabile su mobile
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
        console.warn("BGM in attesa di interazione utente:", name);
      }
    }
  }

  /**
   * Ferma la musica di sottofondo con fade-out morbido
   */
  function stopBgm(fadeDuration = 800) {
    if (!currentBgmHowl) return;
    const howl = currentBgmHowl;
    currentBgmKey = null;
    currentBgmHowl = null;

    howl.fade(howl.volume(), 0, fadeDuration);
    setTimeout(() => {
      try { howl.stop(); } catch (e) {}
    }, fadeDuration);
  }

  /**
   * Audio Ducking: abbassa momentaneamente la musica durante un colpo critico o evento
   */
  function duck(targetVol = 0.08, duration = 1200) {
    if (isMuted || !currentBgmHowl || !currentBgmHowl.playing()) return;
    currentBgmHowl.fade(currentBgmHowl.volume(), targetVol, 150);
    setTimeout(() => {
      if (!isMuted && currentBgmHowl && currentBgmHowl.playing()) {
        currentBgmHowl.fade(currentBgmHowl.volume(), BGM_VOLUME, 450);
      }
    }, duration);
  }

  /**
   * Attiva / Disattiva Audio Globale (Mute)
   */
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

  /**
   * Sincronizzazione visiva dei pulsanti Audio Desktop e Mobile
   */
  function updateMuteUI() {
    const badgeDesk = document.getElementById("audio-status-desk");
    if (badgeDesk) {
      badgeDesk.textContent = isMuted ? "OFF" : "ON";
      badgeDesk.className = isMuted 
        ? "badge badge-xs badge-error font-bold text-[9px]" 
        : "badge badge-xs badge-success font-bold text-[9px]";
    }

    const btnMob = document.getElementById("audio-toggle-btn-mob");
    if (btnMob) {
      btnMob.classList.toggle("text-slate-500", isMuted);
      btnMob.classList.toggle("text-sky-400", !isMuted);
    }
  }

  window.addEventListener("DOMContentLoaded", init);

  return {
    playSfx: playSfx,
    playBgm: playBgm,
    stopBgm: stopBgm,
    duck: duck,
    toggleMute: toggleMute,
    isMuted: () => isMuted
  };
})();
