// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/app-core.js (VERSIONE 17.0 - MACROSTATE CONTEXT & DETERMINISTIC ROUTER)
// LAYER 1: ARCHITETTURA A MACROSTATO, ROUTER SPA DETERMINISTICO & TELEGRAM CORE
// ============================================================================

const AppConfig = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyeCWHM9X4ycwWT7IOMwg24pySL78bJT5BRyiIR5eb0UJALWuaORzfJ2lkqLrjLv0xN/exec",
  CACHE_KEYS: {
    APP_STATE: "est_app_state_v17",
    VAULT: "est_cache_vault",
    CONFIG: "est_admin_config"
  },
  THEME: {
    BG_COLOR: "#070A12",
    HEADER_COLOR: "#070A12"
  },
  TIMEOUT_MS: 12000
};

// ----------------------------------------------------------------------------
// 1. UTILITY AUDIO & FEEDBACK APTICO RESILIENTI
// ----------------------------------------------------------------------------
function safePlayClick() {
  try {
    if (window.SoundEngine) {
      if (typeof SoundEngine.playClick === "function") SoundEngine.playClick();
      else if (typeof SoundEngine.playSfx === "function") SoundEngine.playSfx("click");
    }
  } catch (e) {}
}

function safeHaptic(type = "selection") {
  try {
    const h = window.Telegram?.WebApp?.HapticFeedback;
    if (!h) return;
    if (type === "selection") h.selectionChanged();
    else if (type === "success") h.notificationOccurred("success");
    else if (type === "warning") h.notificationOccurred("warning");
    else if (type === "error") h.notificationOccurred("error");
    else h.impactOccurred(type);
  } catch (e) {}
}

// ----------------------------------------------------------------------------
// 2. STATO UNIFICATO DELLA PIATTAFORMA
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
    combatStats: { wins: 0, losses: 0, attack: 14, defense: 12, hacking: 10, readiness: 12, rank: "Agente Syndicate" }
  },

  // Sblocco navigazione libera
  allowedModules: { home: true, games: true, hub: true, shop: true, recipes: true, profile: true, multiplayer: true },
  plans: [],
  billingCycle: "monthly",
  activeTab: "home",
  currentContext: "app", // 'app' | 'wizard' | 'gameplay'

  shop: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  recipes: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  carousel: { timer: null, index: 0, count: 0, isPaused: false },
  digitalVault: [],
  transactions: [],

  games: { catalog: [], activeGameKey: null, activeEpisode: 1 },
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

  config: { gasWebAppUrl: AppConfig.GAS_URL, botUsername: "EstiqatsyBot" }
};

// ----------------------------------------------------------------------------
// 3. INTEGRAZIONE TELEGRAM WEBAPP SDK
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
      AppState.user.username = u.username ? `@${u.username}` : "@anonimo";
      if (u.photo_url) AppState.user.photo_url = u.photo_url;
    }

    const updateSafeArea = () => {
      const topInset = tg.safeAreaInset?.top || tg.contentSafeAreaInset?.top || 0;
      const bottomInset = tg.safeAreaInset?.bottom || tg.contentSafeAreaInset?.bottom || 0;
      document.documentElement.style.setProperty("--tg-safe-area-inset-top", `${topInset}px`);
      document.documentElement.style.setProperty("--tg-safe-area-inset-bottom", `${bottomInset}px`);
    };
    updateSafeArea();
  } catch (e) {}
}

let telegramBackButtonHandler = null;
function setupTelegramBackButton(targetScreenId) {
  if (!tg || !tg.BackButton) return;
  try {
    if (telegramBackButtonHandler) {
      tg.BackButton.offClick(telegramBackButtonHandler);
      telegramBackButtonHandler = null;
    }
    const isSub = targetScreenId.startsWith("subview-") || 
                  targetScreenId === "view-gameplay" || 
                  targetScreenId === "view-wizard" || 
                  targetScreenId === "view-multiplayer";

    if (isSub) {
      tg.BackButton.show();
      telegramBackButtonHandler = () => {
        safePlayClick();
        if (targetScreenId === "view-gameplay" && window.Rules2Engine && typeof Rules2Engine.openAbandonModal === "function") {
          Rules2Engine.openAbandonModal();
        } else if (targetScreenId === "view-multiplayer" || targetScreenId.includes("game")) {
          AppRouter.navigate("games");
        } else {
          AppRouter.navigate("home");
        }
      };
      tg.BackButton.onClick(telegramBackButtonHandler);
    } else {
      tg.BackButton.hide();
    }
  } catch (e) {}
}

// ----------------------------------------------------------------------------
// 4. REGISTRY MOTORI DI GIOCO
// ----------------------------------------------------------------------------
const EngineRegistry = {
  _engines: {},
  register: function(k, inst) { 
    this._engines[String(k).trim().toLowerCase().replace(/\s+/g, '')] = inst; 
  },
  get: function(k) { 
    return this._engines[String(k).trim().toLowerCase().replace(/\s+/g, '')] || this._engines["rules2"] || null; 
  }
};
window.EngineRegistry = EngineRegistry;

// ----------------------------------------------------------------------------
// 5. ROUTER DETERMINISTICO CON MACROSTATO (SINGLE SOURCE OF TRUTH)
// ----------------------------------------------------------------------------

// Mappa esplicita tra schermata e relativo Tab principale da evidenziare
const SCREEN_TO_TAB_MAP = {
  "home": "home",
  "view-home": "home",
  
  "games": "games",
  "view-hub": "games",
  "hub": "games",
  "subview-game-detail": "games",
  "multiplayer": "games",
  "view-multiplayer": "games",
  
  "shop": "shop",
  "view-shop": "shop",
  "subview-shop-detail": "shop",
  
  "recipes": "recipes",
  "view-recipes": "recipes",
  "subview-recipe-detail": "recipes",
  
  "profile": "profile",
  "view-profile": "profile",

  // Schermate speciali di gioco
  "view-wizard": "games",
  "wizard": "games",
  "view-gameplay": "games",
  "gameplay": "games"
};

const ALL_SCREENS = [
  "view-home", "view-hub", "subview-game-detail",
  "view-wizard", "view-gameplay", "view-multiplayer",
  "view-shop", "subview-shop-detail",
  "view-recipes", "subview-recipe-detail",
  "view-profile"
];

const AppRouter = {
  navigate: function(screenName, subScreenName = null) {
    safePlayClick();
    safeHaptic("selection");

    // Risoluzione ID vista target
    let targetId = subScreenName || screenName;

    if (targetId === "games" || targetId === "view-games") {
      targetId = "view-hub";
      if (window.AppModules && typeof AppModules.renderGamesCatalog === "function") AppModules.renderGamesCatalog();
    } else if (targetId === "multiplayer" || targetId === "view-multiplayer") {
      targetId = "view-multiplayer";
      if (window.AppModules && typeof AppModules.renderMultiplayerRoom === "function") AppModules.renderMultiplayerRoom();
    } else if (targetId === "gameplay" || targetId === "view-gameplay") {
      targetId = "view-gameplay";
      if (window.Rules2Engine && typeof Rules2Engine.syncHUD === "function") Rules2Engine.syncHUD();
    } else if (targetId === "wizard" || targetId === "view-wizard") {
      targetId = "view-wizard";
    } else if (!targetId.startsWith("view-") && !targetId.startsWith("subview-")) {
      targetId = "view-" + targetId;
    }

    // Reset dello scroll della pagina
    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;

    // 1. DETERMINAZIONE DEL MACROSTATO (Fonte Unica di Verità)
    let macroContext = "app";
    if (targetId === "view-gameplay") {
      macroContext = "gameplay";
    } else if (targetId === "view-wizard") {
      macroContext = "wizard";
    }
    AppState.currentContext = macroContext;

    // Registra il macrostato sul DOM per delegare al CSS visibilità e layout
    document.body.dataset.context = macroContext;
    document.body.dataset.activeScreen = targetId;

    // 2. CHIUSURA DI SICUREZZA DI MODALI E CASSETTI ORFANI AL CAMBIO CONTESTO
    if (macroContext === "app") {
      const drawersToClose = ["drawer-hero-sheet", "drawer-emporio", "modal-cockpit-assetto", "modal-abandon"];
      drawersToClose.forEach(dId => {
        const el = document.getElementById(dId);
        if (el && typeof el.close === "function" && el.open) el.close();
      });
    }

    // 3. ATTIVAZIONE DELLA SCHERMATA CORRENTE
    ALL_SCREENS.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle("hidden", id !== targetId);
      }
    });

    // 4. COORDINAMENTO VISIBILITÀ HEADER & FOOTER
    // (Supporta la transizione mantenendo compatibilità se il CSS non è ancora aggiornato)
    const appHeader = document.getElementById("main-app-header");
    const gameHeader = document.getElementById("main-game-header");
    const appFooter = document.getElementById("main-app-footer");
    const wizardFooter = document.getElementById("main-wizard-footer");
    const gameFooter = document.getElementById("main-game-cockpit-footer");

    if (appHeader) appHeader.classList.toggle("hidden", macroContext === "gameplay");
    if (gameHeader) gameHeader.classList.toggle("hidden", macroContext !== "gameplay");

    if (appFooter) appFooter.classList.toggle("hidden", macroContext !== "app");
    if (wizardFooter) wizardFooter.classList.toggle("hidden", macroContext !== "wizard");
    if (gameFooter) gameFooter.classList.toggle("hidden", macroContext !== "gameplay");

    // 5. DETERMINAZIONE DETERMINISTICA DEL TAB ATTIVO
    const matchedTab = SCREEN_TO_TAB_MAP[targetId] || SCREEN_TO_TAB_MAP[screenName] || "home";
    AppState.activeTab = matchedTab;

    // Sincronizzazione pulsanti Mobile
    document.querySelectorAll(".nav-tab").forEach(btn => {
      const isTarget = (btn.dataset.tab === matchedTab);
      btn.classList.toggle("active", isTarget);
    });

    // Sincronizzazione menu Desktop
    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      const isTarget = (btn.dataset.tab === matchedTab);
      btn.classList.toggle("active", isTarget);
    });

    // Setup tasto back nativo Telegram e icone
    setupTelegramBackButton(targetId);
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 15);
  }
};

// ----------------------------------------------------------------------------
// 6. COMUNICAZIONE API SERVER-AUTHORITATIVE (GOOGLE APPS SCRIPT)
// ----------------------------------------------------------------------------
let _isApiInProgress = false;
async function apiCall(action, extraParams = {}) {
  const isCritical = ["shop_buy", "currency_exchange", "game_start", "game_action", "game_node"].includes(action);
  if (isCritical && _isApiInProgress) throw new Error("Operazione in corso...");
  if (isCritical) _isApiInProgress = true;

  const endpointUrl = AppState.config?.gasWebAppUrl || AppConfig.GAS_URL;
  const initData = (tg && tg.initData) ? tg.initData : "";
  const payload = { action: action, initData: initData, params: extraParams, timestamp: Date.now() };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AppConfig.TIMEOUT_MS);

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const rawText = await response.text();
    let result = JSON.parse(rawText);
    if (!result.success && result.error) throw new Error(result.error);
    return result.data;
  } finally {
    clearTimeout(timeoutId);
    if (isCritical) _isApiInProgress = false;
  }
}

// ----------------------------------------------------------------------------
// 7. GESTIONE BORSALE MEGOIN (DISACCOPPIATO DALL'ORO IN-GAME)
// ----------------------------------------------------------------------------
const Wallet = {
  getMegoin: function() { 
    return AppState.user?.saldoMegoin || AppState.user?.megoin || 0; 
  },
  setMegoin: function(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    if (!AppState.user) AppState.user = {};
    AppState.user.saldoMegoin = num;
    AppState.user.megoin = num;
    
    ["home-megoin-card", "user-megoin-desk", "profile-card-megoin", "cambio-megoin-balance", "arcade-user-balance"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = (id.includes("balance")) ? num : `${num} 🪙`;
    });
  },
  addMegoin: function(amt) { 
    this.setMegoin(this.getMegoin() + amt); 
  }
};

// ----------------------------------------------------------------------------
// 8. APPCORE: TOAST, STORAGE & SINCRONIZZAZIONE UI
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
      info: "border-sky-500/50 text-sky-300 bg-slate-900/95",
      warning: "border-amber-500/50 text-amber-300 bg-amber-950/90"
    };
    toast.className = `p-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-mono font-bold flex items-center justify-between pointer-events-auto ${colors[type] || colors.info}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  },

  save: function() {
    try { 
      localStorage.setItem(AppConfig.CACHE_KEYS.APP_STATE, JSON.stringify({ 
        user: AppState.user, 
        digitalVault: AppState.digitalVault 
      })); 
    } catch (e) {}
  },

  load: function() {
    try {
      const raw = localStorage.getItem(AppConfig.CACHE_KEYS.APP_STATE);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.user) {
          AppState.user.chatId = s.user.chatId || AppState.user.chatId;
          AppState.user.nome = s.user.nome || AppState.user.nome;
        }
        if (s.digitalVault) AppState.digitalVault = s.digitalVault;
      }
    } catch (e) {}
  },

  syncUI: function() {
    const u = AppState.user;
    if (!u) return;
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const megoinVal = Wallet.getMegoin();
    const puntiVal = u.puntiFedelta || u.loyalty_points || 0;
    const nomeVal = u.nome || u.first_name || "Avventuriero";

    s("home-username", nomeVal);
    s("home-rank-points", puntiVal);
    s("home-plan-badge", `PIANO ${(u.piano || u.plan || "Free").toUpperCase()}`);
    s("home-megoin-card", `${megoinVal} 🪙`);
    s("home-punti-card", `${puntiVal} Pt`);
    s("profile-card-name", nomeVal);
    s("profile-card-megoin", `${megoinVal} 🪙`);
    s("profile-card-points", `${puntiVal} Pt`);
    s("profile-card-plan", `PIANO ${(u.piano || u.plan || "Free").toUpperCase()}`);
    s("profile-card-id", `ID: ${u.chatId || u.id || "-"}`);
    
    // UI Desktop
    s("user-name-desk", nomeVal);
    s("user-plan-desk", `PIANO ${(u.piano || u.plan || "Free").toUpperCase()}`);
    s("user-megoin-desk", `${megoinVal} 🪙`);
    s("user-points-desk", `${puntiVal} Pt`);
  },

  // Rimozione sicura del loader
  dismissLoader: function() {
    const loader = document.getElementById("app-loading");
    if (loader) {
      loader.style.pointerEvents = "none";
      loader.style.opacity = "0";
      setTimeout(() => { if (loader.parentNode) loader.remove(); }, 250);
    }
  }
};

// Esportazione Globale
window.AppConfig = AppConfig;
window.AppState = AppState;
window.AppRouter = AppRouter;
window.Wallet = Wallet;
window.AppCore = AppCore;
window.apiCall = apiCall;

// ----------------------------------------------------------------------------
// 9. BOOTSTRAP ALL'AVVIO
// ----------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  AppCore.load();
  AppCore.syncUI();
  if (window.lucide) lucide.createIcons();

  try {
    if (window.AppModules && typeof AppModules.init === "function") {
      await AppModules.init();
    }
  } catch (err) {
    console.warn("[DOMContentLoaded] Inizializzazione parziale:", err);
  } finally {
    // Sblocco garantito: il loader non bloccherà MAI i tap sul footer
    AppCore.dismissLoader();
  }

  // Avvio garantito sulla Home
  AppRouter.navigate("home");
});
