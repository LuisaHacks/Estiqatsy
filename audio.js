// ============================================================================
// PROJECT: ESTIQATSY PWA - SOUND ENGINE (HOWLER.JS)
// FILE: audio.js
// Gestione audio multicanale: SFX (dadi, monete, click) e BGM Ambient
// ============================================================================

const SoundEngine = (function() {
  let isMuted = localStorage.getItem("estiqatsy_audio_muted") === "true";
  let bgm = null;

  // Effetti Sonori via CDN (Audio leggeri e istantanei royalty-free)
  const sfxUrls = {
    click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    dice: "https://assets.mixkit.co/active_storage/sfx/1070/1070-preview.mp3",
    coin: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    victory: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
    hit: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"
  };

  const sfxPlayers = {};

  // Precaricamento SFX
  function init() {
    for (let key in sfxUrls) {
      try {
        sfxPlayers[key] = new Howl({
          src: [sfxUrls[key]],
          volume: 0.5,
          html5: true
        });
      } catch (e) {
        console.warn("Audio non disponibile:", key);
      }
    }
    updateMuteUI();
  }

  function playSfx(name) {
    if (isMuted || !sfxPlayers[name]) return;
    try {
      sfxPlayers[name].play();
    } catch (e) {}
  }

  function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem("estiqatsy_audio_muted", isMuted);
    if (window.Howler) {
      Howler.mute(isMuted);
    }
    updateMuteUI();
  }

  function updateMuteUI() {
    const badgeDesk = document.getElementById("audio-status-desk");
    if (badgeDesk) {
      badgeDesk.textContent = isMuted ? "OFF" : "ON";
      badgeDesk.className = isMuted ? "badge badge-xs badge-error font-bold text-[9px]" : "badge badge-xs badge-success font-bold text-[9px]";
    }
  }

  window.addEventListener("DOMContentLoaded", init);

  return {
    playSfx: playSfx,
    toggleMute: toggleMute,
    isMuted: () => isMuted
  };
})();
