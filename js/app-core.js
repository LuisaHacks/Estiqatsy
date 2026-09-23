// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/app-core.js (VERSIONE 15.0 - UNBLOCK NAVIGATION & CRASH-PROOF ROUTER)
// LAYER 1: SPA ROUTER, STATO REALE, MEGOIN WALLET, TOAST SYSTEM & DEEP LINK
// ============================================================================

// ----------------------------------------------------------------------------
// 1. CONFIGURAZIONE & COSTANTI GLOBALI
// ----------------------------------------------------------------------------
const AppConfig = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyeCWHM9X4ycwWT7IOMwg24pySL78bJT5BRyiIR5eb0UJALWuaORzfJ2lkqLrjLv0xN/exec",
  CACHE_KEYS: {
    APP_STATE: "est_app_state_v15",
    VAULT: "est_cache_vault",
    AUDIO_MUTED: "estiqatsy_audio_muted",
    AUDIO_VOLUME: "estiqatsy_audio_volume",
    LAST_SERIES: "est_last_series",
    CONFIG: "est_admin_config"
  },
  THEME: {
    BG_COLOR: "#070A12",
    HEADER_COLOR: "#070A12"
  },
  TIMEOUT_MS: 12000
};

// Helper audio sicuro: non manda MAI in crash il codice se il metodo manca
function safePlayClick() {
  try {
    if (window.SoundEngine) {
      if (typeof SoundEngine.playClick === "function") SoundEngine.playClick();
      else if (typeof SoundEngine.playSfx === "function") SoundEngine.playSfx("click");
    }
  } catch(e) {}
}

// ----------------------------------------------------------------------------
// 2. STATO CENTRALE UNIFICATO DELLA PIATTAFORMA (APPSTATE)
// ----------------------------------------------------------------------------
const AppState = {
  user: {
    chatId: "",
    id: "",
    nome: "Avventuriero",
    first_name: "Avventuriero",
    cognome: "",
    username: "@anonimo",
    saldoMegoin: 0,
    megoin: 0,
    puntiFedelta: 0,
    loyalty_points: 0,
    piano: "Free",
    plan: "Free",
    isAdmin: false,
    prodottiAcquistati: 0,
    avatar: "⚓",
    photo_url: null,
    combatStats: {
      wins: 0,
      losses: 0,
      attack: 14,
      defense: 12,
      hacking: 10,
      readiness: 12,
      rank: "Agente Syndicate"
    }
  },

  // 🔒 Tutti i moduli aperti di default: nessuna navigazione bloccata all'avvio
  allowedModules: {
    home: true,
    games: true,
    hub: true,
    shop: true,
    recipes: true,
    profile: true,
    multiplayer: true
  },

  plans: [],
  billingCycle: "monthly",
  activeTab: "home",

  shop: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  recipes: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  carousel: { timer: null, index: 0, count: 0, isPaused: false },
  digitalVault: [],
  transactions: [],

  games: {
    catalog: [],
    activeGameKey: null,
    activeEpisode: 1
  },
  activeSeriesId: null,
  activeEpisodeId: 1,
  activeSession: {
    engineKey: "Rules2",
    gameKey: null,
    episodio: 1,
    partitaId: null,
    hero: null,
    combatRound: 1,
    combatEnemyId: null,
    currentNode: null,
    shopCatalog: [],
    engineState: null
  },
  activeGameSession: null,
  multiplayerActiveRoom: null,

  config: {
    gasWebAppUrl: AppConfig.GAS_URL,
    botUsername: "EstiqatsyBot"
  }
};

// ----------------------------------------------------------------------------
// 3. INTEGRAZIONE TELEGRAM WEBAPP SDK & SAFE-AREA HARDWARE
// ----------------------------------------------------------------------------
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

if (tg) {
  try {
    tg.ready();
    tg.expand();
    if (typeof tg.requestFullscreen === "function") tg.requestFullscreen();
    if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
    tg.setHeaderColor(AppConfig.THEME.HEADER_COLOR);
    tg.setBackgroundColor(AppConfig.THEME.BG_COLOR);

    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      const u = tg.initDataUnsafe.user;
      AppState.user.id = String(u.id);
      AppState.user.chatId = String(u.id);
      AppState.user.first_name = u.first_name || "Avventuriero";
      AppState.user.nome = u.first_name || "Avventuriero";
      AppState.user.cognome = u.last_name || "";
      AppState.user.username = u.username ? `@${u.username}` : "@anonimo";
      if (u.photo_url) AppState.user.photo_url = u.photo_url;
    }

    const updateSafeArea = () => {
      const topInset = tg.safeAreaInset?.top || tg.contentSafeAreaInset?.top || 0;
      const bottomInset = tg.safeAreaInset?.bottom || tg.contentSafeAreaInset?.bottom || 0;
      const rightInset = tg.safeAreaInset?.right || tg.contentSafeAreaInset?.right || 0;
      const leftInset = tg.safeAreaInset?.left || tg.contentSafeAreaInset?.left || 0;

      document.documentElement.style.setProperty("--tg-safe-area-inset-top", `${topInset}px`);
      document.documentElement.style.setProperty("--tg-safe-area-inset-bottom", `${bottomInset}px`);
      document.documentElement.style.setProperty("--tg-safe-area-inset-right", `${rightInset}px`);
      document.documentElement.style.setProperty("--tg-safe-area-inset-left", `${leftInset}px`);
    };

    updateSafeArea();
    if (typeof tg.onEvent === "function") {
      tg.onEvent("safeAreaChanged", updateSafeArea);
      tg.onEvent("contentSafeAreaChanged", updateSafeArea);
    }
  } catch (e) {
    console.warn("[app-core] Telegram SDK init parziale:", e);
  }
}

// ----------------------------------------------------------------------------
// GESTIONE PULSANTE 'INDIETRO' NATIVO DI TELEGRAM
// ----------------------------------------------------------------------------
let telegramBackButtonHandler = null;

function setupTelegramBackButton(targetScreenId) {
  if (!tg || !tg.BackButton) return;

  if (telegramBackButtonHandler) {
    tg.BackButton.offClick(telegramBackButtonHandler);
    telegramBackButtonHandler = null;
  }

  const isSubView = (
    targetScreenId === "subview-shop-detail" ||
    targetScreenId === "subview-recipe-detail" ||
    targetScreenId === "subview-game-detail"
  );
  const isGameplayView = (targetScreenId === "view-gameplay" || targetScreenId === "view-wizard");
  const isMultiplayerView = (targetScreenId === "view-multiplayer");

  if (isSubView || isGameplayView || isMultiplayerView) {
    tg.BackButton.show();
    telegramBackButtonHandler = () => {
      safePlayClick();

      if (targetScreenId === "subview-shop-detail") {
        AppRouter.navigate("shop");
      } else if (targetScreenId === "subview-recipe-detail") {
        AppRouter.navigate("recipes");
      } else if (targetScreenId === "subview-game-detail") {
        AppRouter.navigate("games");
      } else if (targetScreenId === "view-wizard") {
        AppRouter.navigate("subview-game-detail");
      } else if (targetScreenId === "view-gameplay") {
        const engine = EngineRegistry.get(AppState.activeSession.engineKey);
        if (engine && typeof engine.openAbandonModal === "function") {
          engine.openAbandonModal();
        } else {
          AppRouter.navigate("games");
        }
      } else if (targetScreenId === "view-multiplayer") {
        AppRouter.navigate("games");
      } else {
        AppRouter.navigate("home");
      }
    };
    tg.BackButton.onClick(telegramBackButtonHandler);
  } else {
    tg.BackButton.hide();
  }
}

// ----------------------------------------------------------------------------
// 4. REGISTRO MOTORI DI GIOCO
// ----------------------------------------------------------------------------
const EngineRegistry = {
  _engines: {},
  register: function(ruleKey, engineInstance) {
    if (!ruleKey || !engineInstance) return;
    const cleanKey = String(ruleKey).trim().toLowerCase().replace(/\s+/g, '');
    this._engines[cleanKey] = engineInstance;
  },
  get: function(ruleKey) {
    if (!ruleKey) return this._engines["rules2"] || null;
    const cleanKey = String(ruleKey).trim().toLowerCase().replace(/\s+/g, '');
    return this._engines[cleanKey] || this._engines["rules2"] || null;
  }
};
window.EngineRegistry = EngineRegistry;

// ----------------------------------------------------------------------------
// 5. ROUTER SPA (APPROUTER) ESENTE DA CRASH E LOOP
// ----------------------------------------------------------------------------
const AppRouter = {
  navigate: function(screenName, subScreenName = null) {
    safePlayClick();
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

    let targetId = subScreenName || screenName;

    // Normalizzazione ID schermi
    if (targetId === "games" || targetId === "view-games") {
      targetId = "view-hub";
      if (window.AppModules && typeof AppModules.renderGamesCatalog === "function") {
        AppModules.renderGamesCatalog();
      }
    } else if (targetId === "multiplayer" || targetId === "view-multiplayer") {
      targetId = "view-multiplayer";
      if (window.AppModules && typeof AppModules.renderMultiplayerRoom === "function") {
        AppModules.renderMultiplayerRoom();
      }
    } else if (targetId === "gameplay" || targetId === "view-gameplay") {
      targetId = "view-gameplay";
      if (window.Rules2Engine && typeof Rules2Engine.syncHUD === "function") {
        Rules2Engine.syncHUD();
      }
    } else if (targetId === "wizard" || targetId === "view-wizard") {
      targetId = "view-wizard";
    } else if (!targetId.startsWith("view-") && !targetId.startsWith("subview-")) {
      targetId = "view-" + targetId;
    }

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;

    // Switch di visibilità con classe .hidden
    const allScreens = [
      "view-home", "view-hub", "subview-game-detail",
      "view-wizard", "view-gameplay", "view-multiplayer",
      "view-shop", "subview-shop-detail",
      "view-recipes", "subview-recipe-detail",
      "view-profile"
    ];

    allScreens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", id !== targetId);
    });

    // Controllo Header & Footer esclusivi
    const isGameplay = (targetId === "view-gameplay");
    const isWizard = (targetId === "view-wizard");

    const appHeader = document.getElementById("main-app-header");
    const gameHeader = document.getElementById("main-game-header");

    const appFooter = document.getElementById("main-app-footer");
    const wizardFooter = document.getElementById("main-wizard-footer");
    const gameFooter = document.getElementById("main-game-cockpit-footer");

    // Header Switch
    if (isGameplay) {
      if (appHeader) appHeader.classList.add("hidden");
      if (gameHeader) gameHeader.classList.remove("hidden");
    } else {
      if (appHeader) appHeader.classList.remove("hidden");
      if (gameHeader) gameHeader.classList.add("hidden");
    }

    // Footer Switch
    if (isGameplay) {
      if (appFooter) appFooter.classList.add("hidden");
      if (wizardFooter) wizardFooter.classList.add("hidden");
      if (gameFooter) gameFooter.classList.remove("hidden");
    } else if (isWizard) {
      if (appFooter) appFooter.classList.add("hidden");
      if (wizardFooter) wizardFooter.classList.remove("hidden");
      if (gameFooter) gameFooter.classList.add("hidden");
    } else {
      if (appFooter) appFooter.classList.remove("hidden");
      if (wizardFooter) wizardFooter.classList.add("hidden");
      if (gameFooter) gameFooter.classList.add("hidden");
    }

    // Calcolo Tab Attivo
    const activeTabKey = targetId.replace("view-", "").replace("subview-", "").split("-")[0];
    AppState.activeTab = (activeTabKey === "hub") ? "games" : activeTabKey;

    document.body.dataset.activeScreen = targetId;
    document.body.dataset.activeTab = AppState.activeTab;

    // Aggiornamento classi attive sia su mobile che su desktop
    document.querySelectorAll(".nav-tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === AppState.activeTab);
    });

    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === AppState.activeTab);
    });

    setupTelegramBackButton(targetId);
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 20);
  }
};

// ----------------------------------------------------------------------------
// 6. APICALL POST VERSO GOOGLE APPS SCRIPT
// ----------------------------------------------------------------------------
let _isApiInProgress = false;

async function apiCall(action, extraParams = {}) {
  const isCritical = ["shop_buy", "currency_exchange", "game_start", "game_action", "game_node"].includes(action);
  if (isCritical && _isApiInProgress) {
    throw new Error("Operazione in corso. Attendi un istante...");
  }
  if (isCritical) _isApiInProgress = true;

  const endpointUrl = AppState.config?.gasWebAppUrl || AppConfig.GAS_URL;
  const initData = (tg && tg.initData) ? tg.initData : "";

  const payload = {
    action: action,
    initData: initData,
    params: extraParams,
    timestamp: Date.now()
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AppConfig.TIMEOUT_MS);

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const rawText = await response.text();

    let result;
    try {
      result = JSON.parse(rawText);
    } catch (e) {
      throw new Error("Formato risposta server non valido.");
    }

    if (!result.success && result.error) throw new Error(result.error);
    return result.data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Timeout: Il server GAS impiega troppo tempo a rispondere.");
    }
    throw err;
  } finally {
    if (isCritical) _isApiInProgress = false;
  }
}

// ----------------------------------------------------------------------------
// 7. GESTIONE CENTRALIZZATA MEGOIN
// ----------------------------------------------------------------------------
const Wallet = {
  getMegoin: function() {
    if (!AppState.user) return 0;
    return (AppState.user.saldoMegoin !== undefined) 
      ? AppState.user.saldoMegoin 
      : (AppState.user.megoin || 0);
  },
  setMegoin: function(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    if (!AppState.user) AppState.user = {};
    AppState.user.saldoMegoin = num;
    AppState.user.megoin = num;

    ["home-megoin-card", "user-megoin-desk", "profile-card-megoin", "cambio-megoin-balance", "arcade-user-balance"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = (id === "cambio-megoin-balance" || id === "arcade-user-balance") ? num : `${num} 🪙`;
    });
  },
  addMegoin: function(amount) {
    this.setMegoin(this.getMegoin() + amount);
  }
};

// ----------------------------------------------------------------------------
// 8. APPCORE: BRIDGE UI & NOTIFICHE
// ----------------------------------------------------------------------------
const AppCore = {
  toast: function(message, type = "info") {
    let container = document.getElementById("app-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "app-toast-container";
      container.style.cssText = "position:fixed;top:calc(var(--safe-top, 0px) + 56px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;width:90%;max-width:380px;";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const colors = {
      success: "border-emerald-500/50 text-emerald-300 bg-emerald-950/90",
      error: "border-rose-500/50 text-rose-300 bg-rose-950/90",
      warning: "border-amber-500/50 text-amber-300 bg-amber-950/90",
      info: "border-sky-500/50 text-sky-300 bg-slate-900/95"
    };

    toast.className = `p-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-mono font-bold flex items-center justify-between pointer-events-auto transition-all duration-300 transform translate-y-[-10px] opacity-0 ${colors[type] || colors.info}`;
    toast.innerHTML = `<span>${message}</span><span style="cursor:pointer;margin-left:8px;opacity:0.6;">✕</span>`;

    toast.onclick = () => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 200);
    };

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    if (tg && tg.HapticFeedback) {
      if (type === "success") tg.HapticFeedback.notificationOccurred("success");
      else if (type === "error") tg.HapticFeedback.notificationOccurred("error");
      else tg.HapticFeedback.impactOccurred("light");
    }

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-8px)";
        setTimeout(() => toast.remove(), 250);
      }
    }, 3000);
  },

  save: function() {
    try {
      const stateToSave = {
        user: AppState.user,
        digitalVault: AppState.digitalVault,
        activeGameSession: AppState.activeGameSession,
        multiplayerActiveRoom: AppState.multiplayerActiveRoom,
        config: AppState.config
      };
      localStorage.setItem(AppConfig.CACHE_KEYS.APP_STATE, JSON.stringify(stateToSave));
    } catch (e) {}
  },

  load: function() {
    try {
      const raw = localStorage.getItem(AppConfig.CACHE_KEYS.APP_STATE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.user) {
          AppState.user.chatId = saved.user.chatId || AppState.user.chatId;
          AppState.user.id = saved.user.id || AppState.user.id;
          AppState.user.nome = saved.user.nome || AppState.user.nome;
          AppState.user.first_name = saved.user.first_name || AppState.user.first_name;
        }
        if (saved.digitalVault) AppState.digitalVault = saved.digitalVault;
        if (saved.activeGameSession) AppState.activeGameSession = saved.activeGameSession;
        if (saved.multiplayerActiveRoom) AppState.multiplayerActiveRoom = saved.multiplayerActiveRoom;
      }
    } catch (e) {}
  },

  syncUI: function() {
    const u = AppState.user;
    if (!u) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const megoinVal = Wallet.getMegoin();
    const puntiVal = (u.puntiFedelta !== undefined) ? u.puntiFedelta : (u.loyalty_points || 0);
    const pianoVal = (u.piano || u.plan || "Free").toUpperCase();
    const nomeVal = u.nome || u.first_name || "Avventuriero";
    const chatIdVal = u.chatId || u.id || "-";

    s("home-username", nomeVal);
    s("home-rank-points", puntiVal);
    s("home-plan-badge", `PIANO ${pianoVal}`);
    s("home-megoin-card", `${megoinVal} 🪙`);
    s("home-punti-card", `${puntiVal} Pt`);
    s("home-purchases-count", u.prodottiAcquistati || 0);

    s("user-name-desk", nomeVal);
    s("user-plan-desk", `PIANO ${pianoVal}`);
    s("user-megoin-desk", `${megoinVal} 🪙`);
    s("user-points-desk", `${puntiVal} Pt`);

    s("profile-card-name", nomeVal);
    s("profile-card-username", u.username || "@anonimo");
    s("profile-card-plan", `PIANO ${pianoVal}`);
    s("profile-card-id", `ID: ${chatIdVal}`);
    s("profile-card-megoin", `${megoinVal} 🪙`);
    s("profile-card-points", `${puntiVal} Pt`);

    const renderAvatarBox = (boxId) => {
      const el = document.getElementById(boxId);
      if (!el) return;
      if (u.photo_url) {
        el.innerHTML = `<img src="${u.photo_url}" class="avatar-img" alt="Avatar">`;
      } else {
        el.textContent = nomeVal.charAt(0).toUpperCase();
      }
    };
    renderAvatarBox("user-avatar-desk");
    renderAvatarBox("profile-card-avatar");
  }
};

window.AppConfig = AppConfig;
window.AppState = AppState;
window.AppRouter = AppRouter;
window.Wallet = Wallet;
window.AppCore = AppCore;
window.apiCall = apiCall;

// ----------------------------------------------------------------------------
// 10. BOOTSTRAP APPLICAZIONE ALL'AVVIO
// ----------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  AppCore.load();
  AppCore.syncUI();

  if (window.lucide) lucide.createIcons();

  if (window.AppModules && typeof AppModules.init === "function") {
    await AppModules.init();
  }

  // Rimuove il loader con certezza assoluta all'avvio
  const loader = document.getElementById("app-loading");
  if (loader) {
    loader.classList.add("fade-out");
    setTimeout(() => loader.remove(), 250);
  }

  // Deep Link Telegram (?startapp=ROOM_ABC)
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
    const param = tg.initDataUnsafe.start_param;
    if (param.startsWith("ROOM_") && window.AppModules && typeof AppModules.handleIncomingInvite === "function") {
      setTimeout(() => AppModules.handleIncomingInvite(param), 400);
    }
  }
});
