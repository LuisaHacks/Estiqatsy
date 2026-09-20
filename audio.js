// ============================================================================
// PROJECT: ESTIQATSY PWA - ADVANCED SOUND ENGINE (HOWLER.JS)
// FILE: audio.js (VERSIONE 3.6 - FULL MP3, IOS UNLOCK & CROSSFADE BGM)
// ============================================================================

const SoundEngine = (function() {
  let isMuted = localStorage.getItem("estiqatsy_audio_muted") === "true";
  let currentBgmKey = null;
  let currentBgmHowl = null;
  let isUnlocked = false;

  const BGM_VOLUME = 0.35; // Volume d'atmosfera non invasivo durante la lettura
  const SFX_VOLUME = 0.65; // Volume scattante per il feedback tattile

  // ==========================================================================
  // 1. TRACCE MUSICALI BGM (TUTTI FILE .MP3 VERIFICATI SU WIKIMEDIA COMMONS)
  // Formato MP3 nativo 100% compatibile con iOS Safari, Android e WebKit
  // ==========================================================================
  const bgmUrls = {
    // A. Intro / Hub Serie / Schede Info (Film Noir Detective Jazz)
    intro: "https://commons.wikimedia.org/wiki/Special:FilePath/Hard_Boiled_(ISRC_USUAN1700076).mp3",
    
    // B. Wizard Creazione Personaggio (Pulsazione investigativa / Dossier)
    wizard: "https://commons.wikimedia.org/wiki/Special:FilePath/Crypto_(ISRC_USUAN1600013).mp3",
    
    // C. Snodi Narrativi & Esplorazione Costiera (Dark Ambient notturno salmastro)
    exploration: "https://commons.wikimedia.org/wiki/Special:FilePath/Chill_Wave_(ISRC_USUAN1600048).mp3",
    
    // D. Combattimento a Round / Duello Nemico (Ritmica orchestrale incalzante)
    combat: "https://commons.wikimedia.org/wiki/Special:FilePath/Danger_Storm_(ISRC_USUAN1500065).mp3",
    
    // E. Emporio Ciccio & CO. (Sleazy Lounge Jazz da bettola portuale)
    emporio: "https://commons.wikimedia.org/wiki/Special:FilePath/Backbay_Lounge_(ISRC_USUAN1700068).mp3",
    
    // F. Morte / Sconfitta / Game Over (Tragico e cupo)
    defeat: "https://commons.wikimedia.org/wiki/Special:FilePath/Bittersweet_(ISRC_USUAN1700004).mp3",
    
    // G. Vittoria Finale Assoluta (Trionfo ed epilogo)
    victory: "https://commons.wikimedia.org/wiki/Special:FilePath/Cheery_Monday_(ISRC_USUAN1700065).mp3"
  };

  // ==========================================================================
  // 2. EFFETTI SONORI SFX (TUTTI MP3 LEGGERI PRECARICATI A ZERO LATENZA)
  // ==========================================================================
  const sfxUrls = {
    // Interfaccia universale
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    
    // Lancio Dado D20 su legno
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    
    // Inserimento Gettone Megoin (Arcade Insert Coin)
    insert_coin: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3",
    
    // Guadagno Monete d'Oro / Saldo
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    
    // Registratore Cassa / Acquisti e Vendite Emporio
    cash_register: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
    
    // Allarme Ingresso Combattimento (Stinger trailer drammatico)
    combat_start: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    
    // Colpo a Segno standard (Pugno / lama)
    hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    
    // Colpo Critico (20 Naturale) / Frantumazione d'urto
    crit_hit: "https://assets.mixkit.co/active_storage/sfx/1143/1143-preview.mp3",
    
    // Fuga Riuscita (Fruscio d'aria rapido)
    flee: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    
    // Rianimazione Zombie / Risveglio chimico
    zombie: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",
    
    // Cessione Droga / Corruzione
    bribe: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3",
    
    // Consumo Droghe o Provviste
    drug: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3",
    
    // Vittoria Duello
    victory: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
    
    // Sconfitta / Collasso
    defeat: "https://assets.mixkit.co/active_storage/sfx/2303/2303-preview.mp3"
  };

  const sfxPlayers = {};
  const bgmPlayers = {};

  /**
   * Sblocco forzato dell'AudioContext di Safari/WebKit al primo tocco
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

    // Rimuove i listener di sblocco una volta attivato
    window.removeEventListener("touchstart", unlockAudioContext, true);
    window.removeEventListener("touchend", unlockAudioContext, true);
    window.removeEventListener("click", unlockAudioContext, true);
  }

  /**
   * Inizializzazione motore e precaricamento SFX
   */
  function init() {
    // Registra lo sblocco immediato su qualsiasi interazione mobile
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
        console.warn("SFX non inizializzato:", key);
      }
    }

    // Gestione background: mette in pausa se Telegram viene minimizzato
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
   * Riproduzione di un effetto sonoro istantaneo
   */
  function playSfx(name) {
    if (isMuted || !sfxPlayers[name]) return;
    try {
      sfxPlayers[name].play();
    } catch (e) {
      console.warn("Errore riproduzione SFX:", name, e);
    }
  }

  /**
   * Riproduzione BGM con dissolvenza incrociata automatica (Crossfade)
   */
  function playBgm(name, fadeDuration = 1000) {
    if (!bgmUrls[name]) return;
    if (currentBgmKey === name && currentBgmHowl && currentBgmHowl.playing()) return;

    // Se un brano è già attivo, sfuma a zero e fermalo
    if (currentBgmHowl) {
      const oldHowl = currentBgmHowl;
      oldHowl.fade(oldHowl.volume(), 0, fadeDuration);
      setTimeout(() => {
        try { oldHowl.stop(); } catch (e) {}
      }, fadeDuration);
    }

    currentBgmKey = name;

    // Istanzia il brano in streaming HTML5 MP3 su richiesta
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
        console.warn("Riproduzione BGM in attesa di tocco utente:", name);
      }
    }
  }

  /**
   * Ferma la musica di sottofondo con fade-out
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
   * Audio Ducking: abbassa momentaneamente la musica durante un colpo cruciale
   */
  function duck(targetVol = 0.12, duration = 1200) {
    if (isMuted || !currentBgmHowl || !currentBgmHowl.playing()) return;
    currentBgmHowl.fade(currentBgmHowl.volume(), targetVol, 200);
    setTimeout(() => {
      if (!isMuted && currentBgmHowl && currentBgmHowl.playing()) {
        currentBgmHowl.fade(currentBgmHowl.volume(), BGM_VOLUME, 500);
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
      badgeDesk.className = isMuted ? "badge badge-xs badge-error font-bold text-[9px]" : "badge badge-xs badge-success font-bold text-[9px]";
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
