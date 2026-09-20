// ============================================================================
// PROJECT: ESTIQATSY PWA - ADVANCED SOUND ENGINE (HOWLER.JS)
// FILE: audio.js (VERSIONE 3.5 - VERIFIED AUDIO ASSETS & CROSSFADE BGM)
// ============================================================================

const SoundEngine = (function() {
  let isMuted = localStorage.getItem("estiqatsy_audio_muted") === "true";
  let currentBgmKey = null;
  let currentBgmHowl = null;
  let isUnlocked = false;

  const BGM_VOLUME = 0.35; // Volume morbido di sottofondo per non disturbare la lettura
  const SFX_VOLUME = 0.65; // Volume pieno e scattante per il feedback tattile

  // ==========================================================================
  // 1. ARCHIVIO TRACCE BGM (TUTTI LINK VERIFICATI WIKIMEDIA COMMONS CC-BY)
  // Caricate in streaming HTML5 su richiesta (non appesantiscono il boot)
  // ==========================================================================
  const bgmUrls = {
    // A. Intro / Hub Serie (Noir costiero calmo, libeccio e pianoforte)
    intro: "https://upload.wikimedia.org/wikipedia/commons/2/23/Kevin_MacLeod_-_Windswept.ogg",
    
    // B. Wizard Creazione Personaggio (Dossier e pianificazione jazz lounge)
    wizard: "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ea/Kevin_MacLeod_-_Off_to_Osaka.ogg/Kevin_MacLeod_-_Off_to_Osaka.ogg.mp3",
    
    // C. Snodi Narrativi & Esplorazione Padule (Ambient scuro e misterioso)
    exploration: "https://upload.wikimedia.org/wikipedia/commons/2/23/Kevin_MacLeod_-_Windswept.ogg",
    
    // D. Combattimento a Round (Ritmica incalzante e percussioni drammatiche)
    combat: "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/67/Kevin_MacLeod_-_Call_to_Adventure.ogg/Kevin_MacLeod_-_Call_to_Adventure.ogg.mp3",
    
    // E. Emporio di Ciccio & CO. (Jazz da bettola portuale e banchi clandestini)
    emporio: "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ea/Kevin_MacLeod_-_Off_to_Osaka.ogg/Kevin_MacLeod_-_Off_to_Osaka.ogg.mp3",
    
    // F. Morte / Sconfitta (Drone cupo e malinconico)
    defeat: "https://upload.wikimedia.org/wikipedia/commons/2/23/Kevin_MacLeod_-_Windswept.ogg",
    
    // G. Vittoria Finale Assoluta (Epilogo trionfale cinematografico)
    victory: "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d4/Kevin_MacLeod_-_Winner_Winner.ogg/Kevin_MacLeod_-_Winner_Winner.ogg.mp3"
  };

  // ==========================================================================
  // 2. ARCHIVIO EFFETTI SONORI SFX (TUTTI LINK VERIFICATI MIXKIT STOCK)
  // Buffer leggeri (<100KB) precaricati per scatto a zero millisecondi
  // ==========================================================================
  const sfxUrls = {
    // Interfaccia e Click universale
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    
    // Lancio Dado D20 su legno
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    
    // Gettoni Megoin / Insert Coin cabinato arcade
    insert_coin: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3",
    
    // Guadagno Monete d'Oro / Saldo
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    
    // Spesa Oro / Registratore di cassa Emporio
    cash_register: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
    
    // Inizio Combattimento (Impatto trailer epico)
    combat_start: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3",
    
    // Colpo a segno standard (Pugno / fendente)
    hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    
    // Colpo Critico D20 / Frantumazione d'impatto
    crit_hit: "https://assets.mixkit.co/active_storage/sfx/1143/1143-preview.mp3",
    
    // Fuga riuscita (Fruscio di scatto d'aria rapido)
    flee: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    
    // Rianimazione Zombie / Risveglio chimico
    zombie: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",
    
    // Consumo Droghe / Pozioni / Sostanze chimiche
    drug: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3",
    
    // Vittoria Duello o Prova superata
    victory: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
    
    // Morte / Collasso
    defeat: "https://assets.mixkit.co/active_storage/sfx/2303/2303-preview.mp3"
  };

  const sfxPlayers = {};
  const bgmPlayers = {};

  /**
   * Inizializzazione del motore e precaricamento degli SFX
   */
  function init() {
    // Precaricamento istantaneo degli effetti sonori
    for (let key in sfxUrls) {
      try {
        sfxPlayers[key] = new Howl({
          src: [sfxUrls[key]],
          volume: SFX_VOLUME,
          preload: true
        });
      } catch (e) {
        console.warn("SFX non inizializzato:", key);
      }
    }

    // Registrazione unlock per policy autoplay mobile
    const unlockGesture = () => {
      if (isUnlocked) return;
      if (window.Howler && Howler.ctx && Howler.ctx.state === "suspended") {
        Howler.ctx.resume().then(() => {
          isUnlocked = true;
        });
      } else {
        isUnlocked = true;
      }
      window.removeEventListener("click", unlockGesture);
      window.removeEventListener("touchstart", unlockGesture);
    };

    window.addEventListener("click", unlockGesture, { passive: true });
    window.addEventListener("touchstart", unlockGesture, { passive: true });

    // Gestione background / cambio scheda del telefono
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
   * Riproduzione di un effetto sonoro
   */
  function playSfx(name) {
    if (isMuted || !sfxPlayers[name]) return;
    try {
      sfxPlayers[name].play();
    } catch (e) {}
  }

  /**
   * Riproduzione BGM con dissolvenza incrociata automatica (Crossfade di 1 secondo)
   */
  function playBgm(name, fadeDuration = 1000) {
    if (!bgmUrls[name]) return;
    if (currentBgmKey === name && currentBgmHowl && currentBgmHowl.playing()) return;

    // Sfuma e chiude la traccia precedente se attiva
    if (currentBgmHowl) {
      const oldHowl = currentBgmHowl;
      oldHowl.fade(oldHowl.volume(), 0, fadeDuration);
      setTimeout(() => {
        try { oldHowl.stop(); } catch (e) {}
      }, fadeDuration);
    }

    currentBgmKey = name;

    // Crea l'istanza streaming HTML5 su richiesta se non già memorizzata
    if (!bgmPlayers[name]) {
      bgmPlayers[name] = new Howl({
        src: [bgmUrls[name]],
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
        console.warn("Riproduzione BGM in attesa di sblocco utente:", name);
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
   * Audio Ducking: abbassa momentaneamente la musica durante un colpo/evento cruciale
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
   * Attiva/Disattiva Audio (Mute)
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
   * Sincronizzazione visiva pulsanti Audio su Desktop e Mobile
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
