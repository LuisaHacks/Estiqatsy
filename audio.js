// ============================================================================
// PROJECT: ESTIQATSY BOT & RPG PLATFORM
// FILE: js/audio.js (VERSIONE 7.0 - MULTI-EPISODE MATRIX & IOS BULLETPROOF)
// DESCRIZIONE: Motore sonoro per Core Hub, Cabinati Arcade & Rules2 RPG.
//              - Doppio sblocco audio sincrono per iOS Safari & Telegram WebApp
//              - Matrice musicale scalabile per singolo Episodio (Noir & 8-bit)
//              - Campionamento arcade secco: D20 Lucky/Unlucky, Zelda, Colpi duri
//              - Monitor del battito cardiaco (PV < 25%) e Ducking cinematografico
// ============================================================================

const SoundEngine = (function() {
  let isMuted = localStorage.getItem("estiqatsy_audio_muted") === "true";
  let isShuffle = localStorage.getItem("estiqatsy_audio_shuffle") === "true";
  let currentBgmKey = "hard_boiled";
  let currentBgmHowl = null;
  let heartbeatHowl = null;
  let isUnlocked = false;
  let isPlayingManual = false;

  let duckTimer = null;
  let fadeTimer = null;

  const DEFAULT_BGM_VOLUME = 0.30;
  const DEFAULT_SFX_VOLUME = 0.75;
  let currentBgmVolume = parseFloat(localStorage.getItem("estiqatsy_bgm_volume")) || DEFAULT_BGM_VOLUME;

  // ==========================================================================
  // 1. CATALOGO BRANI BGM (DIFFERENZIATI PER EPISODIO & SALA GIOCHI)
  // ==========================================================================
  const playlist = [
    // --- TEMI UNIVERSALI CABINATO & HUB ---
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
      id: "chiptune_arcade",
      alias: ["arcade_cabinet", "retro_hub"],
      title: "Chiptune2 (NES Core)",
      artist: "Mysid",
      mood: "Puro Cabinato 8-Bit Anni '80",
      tag: "ARCADE 8-BIT",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Chiptune2.ogg"
    },

    // --- EPISODIO 1: LA NOTTE DEI MOLI (INFILTRAZIONE & DARSENA) ---
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

    // --- EPISODIO 2: IL PADULE DELLE OMBRE (TENSIONE & PALUDE) ---
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
      id: "ep2_suspense",
      alias: ["ep2_combattimento", "horror_suspense"],
      title: "Horror Suspense",
      artist: "Rafael Krux",
      mood: "Brivido Notturno & Agguato",
      tag: "EP2 TENSIONE",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Rafael_Krux_-_Horror_Suspense.ogg"
    },

    // --- EPISODIO 3: IL CAVEAU SOTTERRANEO (DUNGEON 8-BIT & BOSS) ---
    {
      id: "ep3_dungeon",
      alias: ["ep3_esplorazione", "roguelike"],
      title: "Pixel Dungeon Roguelike",
      artist: "Watabou",
      mood: "Esplorazione Sotterranea 8-Bit",
      tag: "EP3 DUNGEON",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Pixel_Dungeon_soundtrack.ogg"
    },
    {
      id: "deadly_roulette",
      alias: ["rules2_boss", "boss", "ep3_combattimento"],
      title: "Deadly Roulette",
      artist: "Kevin MacLeod",
      mood: "Scontro con i Capifazione",
      tag: "BOSS FIGHT",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/Deadly_Roulette_(ISRC_USUAN1600033).mp3"
    },

    // --- EPISODIO SEGRETO: AVVENTURA RETRO ---
    {
      id: "retro_story",
      alias: ["secret_level", "chiptune_story"],
      title: "An 8 Bit Story",
      artist: "James Magnus",
      mood: "Epopea Elettronica Sintetizzata",
      tag: "CHIPTUNE EPIC",
      src: "https://commons.wikimedia.org/wiki/Special:FilePath/An_8_Bit_Story.ogg"
    },

    // --- TRANSIZIONI & FINALI ---
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
  // 2. EFFETTI SONORI SFX VERIFICATI (COLPO SECCO, ZELDA & FORTUNA/SFORTUNA)
  // ==========================================================================
  const sfxUrls = {
    // Navigazione & Tattica
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    card_flip: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    flee: "https://assets.mixkit.co/active_storage/sfx/166/166-preview.mp3",
    modal_open: "https://assets.mixkit.co/active_storage/sfx/3115/3115-preview.mp3",

    // Economia & Cabinato
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    insert_coin: "https://assets.mixkit.co/active_storage/sfx/2602/2602-preview.mp3",
    cash_register: "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
    bribe: "https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3",

    // Dadi & Sospensione
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    shock: "https://commons.wikimedia.org/wiki/Special:FilePath/Dun_dun_duuun!.ogg",

    // Eventi Fortunati vs Sfortunati (8-Bit & Iconic)
    lucky: "https://commons.wikimedia.org/wiki/Special:FilePath/Typical_introduction_piece_to_a_video_game_-_Bertrof.ogg",
    success: "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    d20_crit: "https://commons.wikimedia.org/wiki/Special:FilePath/Typical_introduction_piece_to_a_video_game_-_Bertrof.ogg",
    
    unlucky: "https://commons.wikimedia.org/wiki/Special:FilePath/Sad_Trombone-Joe_Lamb-665429450.ogg",
    sad_trombone: "https://commons.wikimedia.org/wiki/Special:FilePath/Sad_Trombone-Joe_Lamb-665429450.ogg",
    zelda_death: "https://commons.wikimedia.org/wiki/Special:FilePath/The_Legend_of_Zelda_-_Death_sound.ogg",
    d20_fail: "https://commons.wikimedia.org/wiki/Special:FilePath/Sad_Trombone-Joe_Lamb-665429450.ogg",

    // Combattimento Secco & Danni
    hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    crit_hit: "https://assets.mixkit.co/active_storage/sfx/2908/2908-preview.mp3", // Colpo secco contundente confermato
    hurt: "https://commons.wikimedia.org/wiki/Special:FilePath/Hurt2.wav",

    // Occulto, Droghe & Dossier
    drug: "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3", // Ingoio / pozione confermato
    zombie: "https://assets.mixkit.co/active_storage/sfx/2608/2608-preview.mp3",
    evil_laugh: "https://commons.wikimedia.org/wiki/Special:FilePath/Evil_laugh.ogg",
    clue_found: "https://assets.mixkit.co/active_storage/sfx/1133/1133-preview.mp3",

    // Allarme Ansia Battito Cardiaco
    heartbeat: "https://commons.wikimedia.org/wiki/Special:FilePath/Heart_beats_sounds_-_Glaneur_de_sons.ogg"
  };

  const sfxPlayers = {};
  const bgmPlayers = {};

  // ==========================================================================
  // 3. MOTORE SBLOCCO IOS BULLETPROOF & TELEGRAM LIFECYCLE
  // ==========================================================================
  function unlockEngine() {
    if (isUnlocked) return;

    // 1. Sblocco WebAudio Context
    if (window.Howler && Howler.ctx) {
      if (Howler.ctx.state === "suspended") {
        Howler.ctx.resume().then(() => {
          triggerSilentBuffer();
        }).catch(() => {});
      } else {
        triggerSilentBuffer();
      }
    }

    // 2. Priming HTML5 Audio sincrono su iOS
    try {
      const dummy = new Audio();
      dummy.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      const p = dummy.play();
      if (p !== undefined) {
        p.then(() => {
          dummy.pause();
          dummy.remove();
        }).catch(() => {});
      }
    } catch (e) {}

    isUnlocked = true;
    cleanupListeners();
  }

  function triggerSilentBuffer() {
    if (!Howler.ctx) return;
    try {
      const buffer = Howler.ctx.createBuffer(1, 1, 22050);
      const source = Howler.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(Howler.ctx.destination);
      source.start(0);
    } catch (e) {}
  }

  function cleanupListeners() {
    window.removeEventListener("touchstart", unlockEngine, true);
    window.removeEventListener("touchend", unlockEngine, true);
    window.removeEventListener("click", unlockEngine, true);
  }

  // ==========================================================================
  // 4. INIZIALIZZAZIONE & STATE OBSERVER TELEGRAM
  // ==========================================================================
  function init() {
    window.addEventListener("touchstart", unlockEngine, true);
    window.addEventListener("touchend", unlockEngine, true);
    window.addEventListener("click", unlockEngine, true);

    // Watchdog per ripristino audio quando la Telegram WebApp torna in primo piano
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (currentBgmHowl && currentBgmHowl.playing()) currentBgmHowl.pause();
        if (heartbeatHowl && heartbeatHowl.playing()) heartbeatHowl.pause();
      } else {
        if (window.Howler && Howler.ctx && Howler.ctx.state === "suspended") {
          Howler.ctx.resume().catch(() => {});
        }
        if (!isMuted && currentBgmHowl && !currentBgmHowl.playing() && isPlayingManual) {
          currentBgmHowl.play();
        }
        if (!isMuted && heartbeatHowl && !heartbeatHowl.playing()) {
          heartbeatHowl.play();
        }
      }
    });

    // Precarica i suoni tattici frequenti
    ["click", "insert_coin", "dice", "hit", "crit_hit", "cash_register"].forEach(k => getOrCreateSfx(k));

    populatePlaylistDOM();
    updateMuteUI();
  }

  function getOrCreateSfx(name) {
    if (sfxPlayers[name]) return sfxPlayers[name];
    if (!sfxUrls[name]) return null;

    try {
      sfxPlayers[name] = new Howl({
        src: [sfxUrls[name]],
        format: ["mp3", "ogg", "wav"],
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
    const player = getOrCreateSfx(name);
    if (player) {
      try { 
        player.play(); 
      } catch (e) {
        // Se Safari blocca la riproduzione, forza lo sblocco immediato
        unlockEngine();
      }
    }
  }

  // Risolve automaticamente la traccia in base all'episodio in corso
  function playEpisodeBgm(gameKey, episodeNum, mood = "explore", fadeDuration = 1000) {
    const ep = parseInt(episodeNum, 10) || 1;
    const m = String(mood).toLowerCase();

    let targetKey = "ep1_explore";

    if (ep === 1) {
      targetKey = (m === "combat" || m === "duello") ? "ep1_combat" : "ep1_explore";
    } else if (ep === 2) {
      targetKey = (m === "combat" || m === "duello") ? "ep2_suspense" : "ep2_explore";
    } else if (ep >= 3) {
      targetKey = (m === "combat" || m === "boss") ? "deadly_roulette" : "ep3_dungeon";
    }

    playBgm(targetKey, fadeDuration);
  }

  function playBgm(identifier, fadeDuration = 1000) {
    const track = findTrack(identifier);
    if (!track) return;

    if (currentBgmKey === track.id && currentBgmHowl && currentBgmHowl.playing()) {
      return;
    }

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
        format: ["mp3", "ogg"],
        html5: false, // Disattivato per garantire la riproduzione continua su iOS via WebAudio
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
        unlockEngine();
      }
    }

    updateJukeboxUI();
  }

  function pauseBgm() {
    if (currentBgmHowl && currentBgmHowl.playing()) {
      currentBgmHowl.pause();
      isPlayingManual = false;
    }
    updateJukeboxUI();
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
    updateJukeboxUI();
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

    updateJukeboxUI();
  }

  // Audio Ducking cinematografico (abbassa la musica per far risaltare il dado o il colpo)
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

  // Monitor Battito Cardiaco (Allarme Salute < 25%)
  function startHeartbeat() {
    if (isMuted) return;
    if (!heartbeatHowl) {
      heartbeatHowl = new Howl({
        src: [sfxUrls.heartbeat],
        format: ["ogg", "mp3"],
        loop: true,
        volume: 0.45
      });
    }
    if (!heartbeatHowl.playing()) {
      heartbeatHowl.play();
    }
  }

  function stopHeartbeat() {
    if (heartbeatHowl && heartbeatHowl.playing()) {
      heartbeatHowl.stop();
    }
  }

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
    if (currentBgmHowl) {
      currentBgmHowl.loop(!isShuffle);
    }
    updateJukeboxUI();
  }

  function setBgmVolume(val) {
    currentBgmVolume = Math.max(0, Math.min(1, parseFloat(val) || DEFAULT_BGM_VOLUME));
    localStorage.setItem("estiqatsy_bgm_volume", currentBgmVolume);
    if (currentBgmHowl) {
      currentBgmHowl.volume(currentBgmVolume);
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem("estiqatsy_audio_muted", isMuted);

    if (window.Howler) {
      Howler.mute(isMuted);
    }

    if (!isMuted && currentBgmHowl && !currentBgmHowl.playing() && isPlayingManual) {
      currentBgmHowl.play();
      currentBgmHowl.fade(0, currentBgmVolume, 800);
    }

    updateMuteUI();
    updateJukeboxUI();
  }

  // ==========================================================================
  // 6. UI MODALE JUKEBOX & BINDING
  // ==========================================================================
  function openJukeboxModal() {
    playSfx("modal_open");
    updateJukeboxUI();
    const modal = document.getElementById("modal-audio-jukebox");
    if (modal) modal.showModal();
  }

  function closeJukeboxModal() {
    const modal = document.getElementById("modal-audio-jukebox");
    if (modal) modal.close();
  }

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

  function updateJukeboxUI() {
    const currentTrack = findTrack(currentBgmKey);
    const isPlaying = currentBgmHowl && currentBgmHowl.playing() && !isMuted;

    const titleEl = document.getElementById("jukebox-current-title");
    const artistEl = document.getElementById("jukebox-current-artist");
    const moodEl = document.getElementById("jukebox-current-mood");
    const tagEl = document.getElementById("jukebox-current-tag");
    const playBtn = document.getElementById("jukebox-btn-play");
    const shuffleBtn = document.getElementById("jukebox-btn-shuffle");
    const muteBtn = document.getElementById("jukebox-btn-mute");
    const barsContainer = document.getElementById("jukebox-eq-bars");

    if (titleEl) titleEl.textContent = currentTrack.title;
    if (artistEl) artistEl.textContent = currentTrack.artist;
    if (moodEl) moodEl.textContent = currentTrack.mood;
    if (tagEl) tagEl.textContent = currentTrack.tag;

    if (playBtn) {
      playBtn.textContent = isPlaying ? "⏸ Pausa" : "▶️ Play";
      playBtn.className = `btn btn-sm ${isPlaying ? 'btn-primary' : 'btn-outline border-white/20'} font-bold flex-1`;
    }

    if (shuffleBtn) {
      shuffleBtn.className = `btn btn-sm btn-circle ${isShuffle ? 'btn-warning' : 'btn-ghost text-slate-400'}`;
      shuffleBtn.title = isShuffle ? "Shuffle Attivo" : "Shuffle Disattivato";
    }

    if (muteBtn) {
      muteBtn.textContent = isMuted ? "🔇 Muto (OFF)" : "🔊 Audio (ON)";
      muteBtn.className = `btn btn-xs ${isMuted ? 'btn-error' : 'btn-success'} font-bold`;
    }

    if (barsContainer) {
      barsContainer.classList.toggle("animated", isPlaying);
    }

    document.querySelectorAll(".jukebox-track-item").forEach(item => {
      const id = item.dataset.trackId;
      const isCurrent = (id === currentTrack.id);
      item.classList.toggle("active", isCurrent);
      const icon = item.querySelector(".track-play-icon");
      if (icon) icon.textContent = (isCurrent && isPlaying) ? "🔊" : "🎵";
    });
  }

  function populatePlaylistDOM() {
    const container = document.getElementById("jukebox-playlist-items");
    if (!container) return;

    container.innerHTML = playlist.map(t => `
      <div onclick="SoundEngine.playBgm('${t.id}')" class="jukebox-track-item" data-track-id="${t.id}">
        <div class="flex items-center space-x-2 min-w-0">
          <span class="track-play-icon">🎵</span>
          <div class="min-w-0">
            <div class="track-item-title truncate">${t.title}</div>
            <div class="track-item-sub truncate">${t.mood}</div>
          </div>
        </div>
        <span class="track-item-tag">${t.tag}</span>
      </div>
    `).join("");
  }

  function togglePlayPause() {
    if (currentBgmHowl && currentBgmHowl.playing()) {
      pauseBgm();
    } else {
      resumeBgm();
    }
  }

  window.addEventListener("DOMContentLoaded", init);

  return {
    playSfx: playSfx,
    playCoreSfx: playSfx,
    playRulesSfx: playSfx,
    playBgm: playBgm,
    playEpisodeBgm: playEpisodeBgm,
    playCoreBgm: (k) => playBgm(k),
    playRulesBgm: (k) => playBgm(k),
    pauseBgm: pauseBgm,
    resumeBgm: resumeBgm,
    stopBgm: stopBgm,
    duck: duck,
    startHeartbeat: startHeartbeat,
    stopHeartbeat: stopHeartbeat,
    openJukeboxModal: openJukeboxModal,
    openPlayerModal: openJukeboxModal,
    closeJukeboxModal: closeJukeboxModal,
    togglePlayPause: togglePlayPause,
    playNextTrack: playNextTrack,
    playPrevTrack: playPrevTrack,
    toggleShuffle: toggleShuffle,
    setVolume: setBgmVolume,
    toggleMute: toggleMute,
    isMuted: () => isMuted
  };
})();

window.SoundEngine = SoundEngine;
