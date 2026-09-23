// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/app-core.js (VERSIONE 23.4 - UNIVERSAL HEADER & HIERARCHICAL ROUTER)
// LAYER 1: ARCHITETTURA A MACROSTATO, PWA FULLSCREEN, TELEGRAM LIFO BACK-STACK
// ============================================================================

const AppConfig = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyeCWHM9X4ycwWT7IOMwg24pySL78bJT5BRyiIR5eb0UJALWuaORzfJ2lkqLrjLv0xN/exec",
  CACHE_KEYS: {
    APP_STATE: "est_app_state_v23_4",
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
    if (window.SoundEngine && typeof SoundEngine.playSfx === "function") {
      SoundEngine.playSfx("click");
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

  games: { catalog: [], genres: [], activeGameKey: null, activeEpisode: 1 },
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
// 3. INTEGRAZIONE TELEGRAM SDK & GESTORE "INDIETRO" A CASCATA (LIFO)
// ----------------------------------------------------------------------------
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

// Intercettatore globale di apertura modali per aggiornare reattivamente il tasto Indietro
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype._showModalIntercepted) {
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function() {
    originalShowModal.apply(this, arguments);
    if (typeof updateTelegramBackButtonState === "function") {
      updateTelegramBackButtonState();
    }
  };
  HTMLDialogElement.prototype._showModalIntercepted = true;
}

// 🔒 FUNZIONE CHIAVE: Calcolo dello stato del tasto "Indietro" di Telegram (1° vs 2° Livello)
function updateTelegramBackButtonState() {
  if (!tg || !tg.BackButton) return;
  try {
    // 1. Modale aperta a schermo: Mostra SEMPRE il tasto per chiuderla
    const hasOpenDialog = document.querySelector("dialog[open]") !== null;
    if (hasOpenDialog) {
      tg.BackButton.show();
      return;
    }

    const currentScreen = document.body.dataset.activeScreen || "view-home";
    const currentContext = AppState.currentContext || "app";

    // 2. SCHERMATE DI 1° LIVELLO (I 5 tab primari della piattaforma)
    // Su Home, Giochi, Shop, Ricette e Profilo il tasto DEVE rimanere nascosto!
    const isLevel1Tab = (
      currentScreen === "view-home" ||
      currentScreen === "view-hub" ||
      currentScreen === "view-shop" ||
      currentScreen === "view-recipes" ||
      currentScreen === "view-profile"
    ) && currentContext === "app";

    if (isLevel1Tab) {
      tg.BackButton.hide();
      return;
    }

    // 3. SCHERMATE DI 2° LIVELLO (Schede Dettaglio, Wizard, Gameplay, Multiplayer)
    const isLevel2View = (
      currentScreen.startsWith("subview-") ||
      currentScreen === "view-wizard" ||
      currentScreen === "view-gameplay" ||
      currentScreen === "view-multiplayer" ||
      currentContext === "wizard" ||
      currentContext === "gameplay"
    );

    if (isLevel2View) {
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }
  } catch (e) {}
}

// 🔒 FUNZIONE CHIAVE: Gestore LIFO universale al tocco del tasto "Indietro" di Telegram
function handleUniversalTelegramBack() {
  safePlayClick();
  safeHaptic("selection");

  // 1. PRIORITÀ 1: Modali aperte (Chiudi la modale più recente)
  const openDialogs = Array.from(document.querySelectorAll("dialog[open]"));
  if (openDialogs.length > 0) {
    const topDialog = openDialogs[openDialogs.length - 1];
    if (topDialog && typeof topDialog.close === "function") {
      topDialog.close();
      updateTelegramBackButtonState();
      return;
    }
  }

  const currentScreen = document.body.dataset.activeScreen || "view-home";
  const currentContext = AppState.currentContext || "app";

  // 2. PRIORITÀ 2: Wizard Eroe attivo (Arretra di uno step alla volta)
  if (currentScreen === "view-wizard" || currentContext === "wizard") {
    if (window.Rules2Wizard && Rules2Wizard.state && Rules2Wizard.state.step > 1) {
      Rules2Wizard.prevStep(Rules2Wizard.state.step - 1);
      updateTelegramBackButtonState();
      return;
    } else {
      AppRouter.navigate("games");
      return;
    }
  }

  // 3. PRIORITÀ 3: Cockpit Gameplay attivo (Apre modale sospensione protetta)
  if (currentScreen === "view-gameplay" || currentContext === "gameplay") {
    if (window.Rules2Engine && typeof Rules2Engine.openAbandonModal === "function") {
      Rules2Engine.openAbandonModal();
    }
    return;
  }

  // 4. PRIORITÀ 4: Subviews e schede di dettaglio -> Ritorno al rispettivo tab genitore
  if (currentScreen === "subview-shop-detail") {
    AppRouter.navigate("shop");
    return;
  }
  if (currentScreen === "subview-recipe-detail") {
    AppRouter.navigate("recipes");
    return;
  }
  if (currentScreen === "subview-game-detail" || currentScreen === "view-multiplayer") {
    AppRouter.navigate("games");
    return;
  }

  // 5. PRIORITÀ 5: Qualsiasi altra vista fuori posto -> Ritorno alla Home
  if (currentScreen !== "view-home") {
    AppRouter.navigate("home");
    return;
  }

  updateTelegramBackButtonState();
}

// ----------------------------------------------------------------------------
// INIZIALIZZAZIONE SDK TELEGRAM CON FULLSCREEN PWA REALE
// ----------------------------------------------------------------------------
if (tg) {
  try {
    tg.ready();
    tg.expand();

    // 🔒 FULLSCREEN NATIVO TELEGRAM 8.0+: 100% altezza, nessuna chat visibile dietro
    if (typeof tg.requestFullscreen === "function") {
      tg.requestFullscreen();
    }
    if (typeof tg.disableVerticalSwipes === "function") {
      tg.disableVerticalSwipes();
    }

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

    // 🔒 Assicura che la Safe Area inferiore non scenda MAI sotto i 24px richiesti
    const updateSafeArea = () => {
      const topInset = tg.safeAreaInset?.top || tg.contentSafeAreaInset?.top || 0;
      const rawBottom = tg.safeAreaInset?.bottom || tg.contentSafeAreaInset?.bottom || 0;
      const bottomInset = Math.max(rawBottom, 24); // 🔒 Minimo 24px garantiti
      document.documentElement.style.setProperty("--tg-safe-area-inset-top", `${topInset}px`);
      document.documentElement.style.setProperty("--tg-safe-area-inset-bottom", `${bottomInset}px`);
    };

    if (typeof tg.onEvent === "function") {
      tg.onEvent("fullscreenChanged", updateSafeArea);
      tg.onEvent("safeAreaChanged", updateSafeArea);
    }

    // Registrazione univoca del listener del BackButton di Telegram
    if (tg.BackButton) {
      tg.BackButton.onClick(handleUniversalTelegramBack);
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
// 5. ROUTER DETERMINISTICO CON MACROSTATO & CONTROLLO LIVELLI
// ----------------------------------------------------------------------------
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

    let targetId = subScreenName || screenName;

    if (targetId === "games" || targetId === "view-games") {
      targetId = "view-hub";
      if (window.AppModules && typeof AppModules.renderGamesCatalog === "function") AppModules.renderGamesCatalog();
    } else if (targetId === "shop" || targetId === "view-shop") {
      targetId = "view-shop";
      if (window.AppModules && typeof AppModules.renderShop === "function") AppModules.renderShop();
    } else if (targetId === "recipes" || targetId === "view-recipes") {
      targetId = "view-recipes";
      if (window.AppModules && typeof AppModules.renderRecipes === "function") AppModules.renderRecipes();
    } else if (targetId === "profile" || targetId === "view-profile") {
      targetId = "view-profile";
      if (window.AppModules && typeof AppModules.renderProfile === "function") AppModules.renderProfile();
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

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;

    // 1. DETERMINAZIONE DEL MACROSTATO
    let macroContext = "app";
    if (targetId === "view-gameplay") {
      macroContext = "gameplay";
    } else if (targetId === "view-wizard") {
      macroContext = "wizard";
    }
    AppState.currentContext = macroContext;

    document.body.dataset.context = macroContext;
    document.body.dataset.activeScreen = targetId;

    // 2. CHIUSURA DI SICUREZZA CASSETTI E MODALI AL CAMBIO VISTA
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

    // 4. MUTUA ESCLUSIONE RIGIDA DEI 3 FOOTER (1 DI 3 ATTIVO)
    // 🔒 L'header #main-app-header rimane SEMPRE visibile e identico ovunque!
    const appFooter = document.getElementById("main-app-footer");
    const wizardFooter = document.getElementById("main-wizard-footer");
    const gameFooter = document.getElementById("main-game-cockpit-footer");

    if (appFooter) appFooter.classList.toggle("hidden", macroContext !== "app");
    if (wizardFooter) wizardFooter.classList.toggle("hidden", macroContext !== "wizard");
    if (gameFooter) gameFooter.classList.toggle("hidden", macroContext !== "gameplay");

    // 5. DETERMINAZIONE DEL TAB ATTIVO
    const matchedTab = SCREEN_TO_TAB_MAP[targetId] || SCREEN_TO_TAB_MAP[screenName] || "home";
    AppState.activeTab = matchedTab;

    document.querySelectorAll(".nav-tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === matchedTab);
    });

    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === matchedTab);
    });

    // 6. ROUTER SONORO: MIXAGGIO ASIMMETRICO
    if (window.SoundEngine && typeof SoundEngine.playTabBgm === "function") {
      if (macroContext === "app") {
        SoundEngine.playTabBgm(matchedTab);
      } else if (macroContext === "wizard") {
        SoundEngine.playBgm("bass_walker", 800, 180);
      }
    }

    // 7. Sincronizzazione dinamica del tasto Indietro Telegram
    updateTelegramBackButtonState();

    setTimeout(() => { 
      if (window.lucide && typeof lucide.createIcons === "function") {
        lucide.createIcons(); 
      }
    }, 20);
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
// 7. GESTIONE BORSELLO MEGOIN
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
// 8. APPCORE: TOAST, STORAGE & SINCRONIZZAZIONE UI COMPLETA
// ----------------------------------------------------------------------------
const AppCore = {
  toast: function(message, type = "info") {
    let container = document.getElementById("app-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "app-toast-container";
      container.style.cssText = "position:fixed;top:calc(var(--safe-top, 0px) + 52px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;width:90%;max-width:380px;";
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
          AppState.user = { ...AppState.user, ...s.user };
        }
        if (s.digitalVault) AppState.digitalVault = s.digitalVault;
      }
    } catch (e) {}
  },

  // 🔒 REGOLA: Chiusura modale al tocco sul backdrop scuro esterno
  initModalBackdropListeners: function() {
    document.addEventListener("click", function(e) {
      if (e.target && e.target.tagName === "DIALOG" && e.target.open) {
        const rect = e.target.getBoundingClientRect();
        const clickedInsideDialog = (
          rect.top <= e.clientY && e.clientY <= rect.bottom &&
          rect.left <= e.clientX && e.clientX <= rect.right
        );
        if (!clickedInsideDialog) {
          e.target.close();
          updateTelegramBackButtonState();
        }
      }
    });

    document.querySelectorAll("dialog").forEach(d => {
      d.addEventListener("close", () => {
        updateTelegramBackButtonState();
      });
    });
  },

  // 🔒 SINCRONIZZAZIONE VISIVA INTEGRALE
  syncUI: function() {
    const u = AppState.user;
    if (!u) return;
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const megoinVal = Wallet.getMegoin();
    const puntiVal = u.puntiFedelta || u.loyalty_points || 0;
    const nomeVal = u.nome || u.first_name || "Avventuriero";
    const usernameVal = u.username ? (u.username.startsWith("@") ? u.username : `@${u.username}`) : "@anonimo";
    const pianoVal = (u.piano || u.plan || "Free").toUpperCase();

    // 1. Dashboard Home
    s("home-username", nomeVal);
    s("home-rank-points", puntiVal);
    s("home-plan-badge", `PIANO ${pianoVal}`);
    s("home-megoin-card", `${megoinVal} 🪙`);
    s("home-punti-card", `${puntiVal} Pt`);

    // 2. Profilo Utente
    s("profile-card-name", nomeVal);
    s("profile-card-username", usernameVal);
    s("profile-card-plan", `PIANO ${pianoVal}`);
    s("profile-card-id", `ID: ${u.chatId || u.id || "-"}`);
    s("profile-card-megoin", `${megoinVal} 🪙`);
    s("profile-card-points", `${puntiVal} Pt`);
    s("profile-action-plan-name", `Piano: ${pianoVal}`);

    // Conteggio download digitali effettivi nel Caveau
    const vaultCount = (AppState.digitalVault && Array.isArray(AppState.digitalVault))
      ? AppState.digitalVault.length 
      : 0;
    s("profile-action-vault-count", vaultCount);
    s("home-purchases-count", vaultCount);

    // 3. Avatar Dinamico
    const avMob = document.getElementById("profile-card-avatar");
    if (avMob) {
      if (u.photo_url) {
        avMob.innerHTML = `<img src="${u.photo_url}" class="w-full h-full object-cover rounded-xl" alt="Avatar">`;
      } else {
        avMob.textContent = (nomeVal.trim().charAt(0) || "A").toUpperCase();
      }
    }

    // 4. Desktop Sidebar
    s("user-name-desk", nomeVal);
    s("user-plan-desk", `PIANO ${pianoVal}`);
    s("user-megoin-desk", `${megoinVal} 🪙`);
    s("user-points-desk", `${puntiVal} Pt`);
    const avDesk = document.getElementById("user-avatar-desk");
    if (avDesk) {
      if (u.photo_url) {
        avDesk.innerHTML = `<img src="${u.photo_url}" class="w-full h-full object-cover rounded-xl" alt="Avatar">`;
      } else {
        avDesk.textContent = (nomeVal.trim().charAt(0) || "A").toUpperCase();
      }
    }

    // 5. Rigenerazione icone vettoriali Lucide protetta
    if (window.lucide && typeof lucide.createIcons === "function") {
      lucide.createIcons();
    }
  },

  dismissLoader: function() {
    const loader = document.getElementById("app-loading");
    if (loader) {
      loader.style.pointerEvents = "none";
      loader.style.opacity = "0";
      setTimeout(() => { if (loader.parentNode) loader.remove(); }, 250);
    }
    if (window.lucide && typeof lucide.createIcons === "function") {
      lucide.createIcons();
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
window.updateTelegramBackButtonState = updateTelegramBackButtonState;

// ----------------------------------------------------------------------------
// 9. BOOTSTRAP ALL'AVVIO
// ----------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  AppCore.load();
  AppCore.initModalBackdropListeners();
  AppCore.syncUI();

  if (!AppState.activeTab || AppState.activeTab === "home") {
    AppRouter.navigate("home");
  }

  try {
    if (window.AppModules && typeof AppModules.init === "function") {
      await AppModules.init();
    }
  } catch (err) {
    console.warn("[DOMContentLoaded] Inizializzazione parziale:", err);
  } finally {
    AppCore.dismissLoader();
  }
});
