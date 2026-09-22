// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/app-core.js (VERSIONE 11.0 - PURE AGNOSTIC PLATFORM LAYER)
// LAYER 1: SISTEMA OPERATIVO CLIENT-SIDE, ROUTER SPA, STATO & MEGOIN WALLET
// NOTE: 100% DISACCOPPIATO DALLE REGOLE DI GIOCO - NESSUN RIFERIMENTO ALL'ORO
// ============================================================================

// ----------------------------------------------------------------------------
// 1. CONFIGURAZIONE & COSTANTI GLOBALI
// ----------------------------------------------------------------------------
const AppConfig = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyeCWHM9X4ycwWT7IOMwg24pySL78bJT5BRyiIR5eb0UJALWuaORzfJ2lkqLrjLv0xN/exec",
  CACHE_KEYS: {
    VAULT: "est_cache_vault",
    AUDIO_MUTED: "estiqatsy_audio_muted",
    AUDIO_VOLUME: "estiqatsy_audio_volume",
    LAST_SERIES: "est_last_series"
  },
  THEME: {
    BG_COLOR: "#090D16",
    HEADER_COLOR: "#090D16"
  },
  TIMEOUT_MS: 12000 // 12 secondi di timeout per chiamate di rete GAS
};

// ----------------------------------------------------------------------------
// 2. STATO UNIFICATO DELLA PIATTAFORMA (APPSTATE)
// ----------------------------------------------------------------------------
const AppState = {
  // Dati Utente & Account Piattaforma
  user: null,
  allowedModules: { home: true, shop: true, games: true, recipes: true, profile: true },
  plans: [],
  billingCycle: "monthly",
  activeTab: "home",

  // Moduli di Piattaforma SaaS / E-commerce Megoin / Ricette
  shop: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  recipes: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  carousel: { timer: null, index: 0, count: 0, isPaused: false },
  vault: [],

  // Catalogo Globale Saghe di Gioco
  games: {
    catalog: [],
    activeGameKey: null,
    activeEpisode: 1
  },

  // Contenitore Dati della Sessione Runtime Attiva
  activeSession: {
    engineKey: null,      // Identificativo motore (es. "Rules2")
    gameKey: null,
    episodio: 1,
    partitaId: null,
    hero: null,           // Payload eroe agnostico
    combatRound: 1,
    combatEnemyId: null,
    currentNode: null,
    shopCatalog: [],
    engineState: null
  }
};

// ----------------------------------------------------------------------------
// 3. INTEGRAZIONE TELEGRAM WEBAPP SDK & SAFE-AREA NATIVE
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

    // Propagazione safe-area hardware alle variabili CSS (SDK 7.0+)
    const updateSafeArea = () => {
      const topInset = tg.safeAreaInset?.top || tg.contentSafeAreaInset?.top || 0;
      const bottomInset = tg.safeAreaInset?.bottom || tg.contentSafeAreaInset?.bottom || 0;
      document.documentElement.style.setProperty("--tg-safe-area-inset-top", `${topInset}px`);
      document.documentElement.style.setProperty("--tg-safe-area-inset-bottom", `${bottomInset}px`);
    };

    updateSafeArea();
    if (typeof tg.onEvent === "function") {
      tg.onEvent("safeAreaChanged", updateSafeArea);
      tg.onEvent("contentSafeAreaChanged", updateSafeArea);
    }
  } catch (e) {
    console.warn("[app-core] Inizializzazione Telegram WebApp parziale:", e);
  }
}

// ----------------------------------------------------------------------------
// GESTIONE DEL PULSANTE 'INDIETRO' NATIVO DI TELEGRAM
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

  if (isSubView || isGameplayView) {
    tg.BackButton.show();
    telegramBackButtonHandler = () => {
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");

      if (targetScreenId === "subview-shop-detail") {
        AppRouter.navigate("shop");
      } else if (targetScreenId === "subview-recipe-detail") {
        AppRouter.navigate("recipes");
      } else if (targetScreenId === "subview-game-detail") {
        AppRouter.navigate("games");
      } else if (targetScreenId === "view-wizard") {
        // Sospensione del Wizard: torna alla scheda gioco preservando i dati
        AppRouter.navigate("subview-game-detail");
      } else if (targetScreenId === "view-gameplay") {
        // SOSPENSIONE MORBIDA: Sospende la partita attiva senza abbandonare!
        const currentEngine = EngineRegistry.get(AppState.activeSession.engineKey);
        if (currentEngine && typeof currentEngine.leaveGameToHub === "function") {
          currentEngine.leaveGameToHub();
        } else {
          AppRouter.navigate("games");
        }
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
// 4. REGISTRO DEI MOTORI DI GIOCO (ENGINE REGISTRY)
// ----------------------------------------------------------------------------
const EngineRegistry = {
  _engines: {},

  register: function(ruleKey, engineInstance) {
    if (!ruleKey || !engineInstance) return;
    const cleanKey = String(ruleKey).trim().toLowerCase().replace(/\s+/g, '');
    this._engines[cleanKey] = engineInstance;
    console.log(`[EngineRegistry] Motore registrato con successo: ${cleanKey}`);
  },

  get: function(ruleKey) {
    if (!ruleKey) return this._engines["rules2"] || null;
    const cleanKey = String(ruleKey).trim().toLowerCase().replace(/\s+/g, '');
    return this._engines[cleanKey] || this._engines["rules2"] || null;
  }
};

window.EngineRegistry = EngineRegistry;

// ----------------------------------------------------------------------------
// 5. ROUTER SPA (APPROUTER) - CONTROLLO ATOMICO DEI 3 FOOTER
// ----------------------------------------------------------------------------
const AppRouter = {
  navigate: function(screenName) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

    let targetId = screenName;
    if (targetId === "games" || targetId === "view-games") {
      targetId = "view-hub";
      if (typeof AppModules !== "undefined" && typeof AppModules.renderGamesCatalog === "function") {
        AppModules.renderGamesCatalog();
      }
    } else if (!targetId.startsWith("view-") && !targetId.startsWith("subview-")) {
      targetId = "view-" + screenName;
    }

    // Hard-Locking dei moduli SaaS
    const baseModule = targetId.replace("view-", "").replace("subview-", "").split("-")[0];
    if (AppState.allowedModules && AppState.allowedModules[baseModule] === false) {
      this.navigate("home");
      if (typeof AppModules !== "undefined" && typeof AppModules.openPlansCatalogModal === "function") {
        AppModules.openPlansCatalogModal();
      }
      return;
    }

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;

    // Reset viste di ricerca
    if (targetId === "view-shop" && typeof AppModules !== "undefined") {
      AppState.shop.activeCategory = "tutti";
      AppState.shop.searchQuery = "";
      const sInput = document.getElementById("shop-search-input");
      if (sInput) sInput.value = "";
      AppModules.renderShop();
    } else if (targetId === "view-recipes" && typeof AppModules !== "undefined") {
      AppState.recipes.activeCategory = "tutti";
      AppState.recipes.searchQuery = "";
      const rInput = document.getElementById("recipes-search-input");
      if (rInput) rInput.value = "";
      AppModules.renderRecipes();
    }

    const allScreens = [
      "view-home", "view-shop", "view-recipes", "view-profile",
      "subview-shop-detail", "subview-recipe-detail",
      "view-hub", "subview-game-detail", "view-wizard", "view-gameplay"
    ];

    allScreens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", id !== targetId);
    });

    // Controllo atomico Header & Switch a Tre Footer
    const isGameplay = (targetId === "view-gameplay");
    const isWizard = (targetId === "view-wizard");

    const appHeader = document.getElementById("main-app-header");
    const gameHeader = document.getElementById("main-game-header");

    const appFooter = document.getElementById("main-app-footer");
    const wizardFooter = document.getElementById("main-wizard-footer");
    const gameFooter = document.getElementById("main-game-cockpit-footer");

    // 1. Gestione Header
    if (isGameplay) {
      if (appHeader) appHeader.classList.add("hidden");
      if (gameHeader) gameHeader.classList.remove("hidden");
    } else {
      if (appHeader) appHeader.classList.remove("hidden");
      if (gameHeader) gameHeader.classList.add("hidden");
    }

    // 2. Gestione Esclusiva a Tre Footer (Mai sovrapposti)
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

    // Calcolo del Tab Attivo
    const activeTabKey = targetId.replace("view-", "").replace("subview-", "").split("-")[0];
    AppState.activeTab = (activeTabKey === "hub") ? "games" : activeTabKey;

    document.body.dataset.activeScreen = targetId;
    document.body.dataset.activeTab = AppState.activeTab;

    document.querySelectorAll(".nav-tab").forEach(btn => {
      const isCurrent = (btn.dataset.tab === AppState.activeTab);
      btn.classList.toggle("active", isCurrent);
    });

    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      const isCurrent = (btn.dataset.tab === AppState.activeTab);
      btn.classList.toggle("active", isCurrent);
    });

    setupTelegramBackButton(targetId);
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 20);
  }
};

// ----------------------------------------------------------------------------
// 6. COMUNICAZIONE API BACKEND (APICALL) CON TIMEOUT E DEBOUNCE
// ----------------------------------------------------------------------------
let _isApiInProgress = false;

async function apiCall(action, extraParams = {}) {
  const isCritical = ["shop_buy", "currency_exchange", "game_start", "game_action"].includes(action);
  if (isCritical && _isApiInProgress) {
    console.warn(`[apiCall] Richiesta "${action}" bloccata: operazione già in corso.`);
    throw new Error("Operazione in corso. Attendi un istante...");
  }

  if (isCritical) _isApiInProgress = true;

  const initData = (tg && tg.initData) ? tg.initData : "";
  let url = `${AppConfig.GAS_URL}?action=${encodeURIComponent(action)}&initData=${encodeURIComponent(initData)}`;

  for (let param in extraParams) {
    if (extraParams[param] !== undefined && extraParams[param] !== null) {
      url += `&${encodeURIComponent(param)}=${encodeURIComponent(extraParams[param])}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AppConfig.TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Errore di rete HTTP: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success && result.error) {
      throw new Error(result.error);
    }
    return result.data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      console.error(`[API Timeout] Azione "${action}" scaduta dopo ${AppConfig.TIMEOUT_MS}ms.`);
      throw new Error("Il server impiega troppo tempo a rispondere. Verifica la connessione e riprova.");
    }
    console.error(`[API Error] Azione "${action}":`, err);
    throw err;
  } finally {
    if (isCritical) _isApiInProgress = false;
  }
}

// ----------------------------------------------------------------------------
// 7. GESTIONE CENTRALIZZATA MEGOIN (WALLET DI PIATTAFORMA)
// Gestisce ESCLUSIVAMENTE la valuta di piattaforma. Nessuna logica di gioco.
// ----------------------------------------------------------------------------
const Wallet = {
  getMegoin: function() {
    if (!AppState.user) return 0;
    return (AppState.user.saldoMegoin !== undefined) ? AppState.user.saldoMegoin : (AppState.user.megoin || 0);
  },

  setMegoin: function(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    if (!AppState.user) AppState.user = {};
    AppState.user.saldoMegoin = num;
    AppState.user.megoin = num;

    ["home-megoin-card", "user-megoin-desk", "profile-card-megoin", "cambio-megoin-balance"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = (id === "cambio-megoin-balance") ? num : `${num} 🪙`;
    });
  },

  addMegoin: function(amount) {
    this.setMegoin(this.getMegoin() + amount);
  }
};

// ----------------------------------------------------------------------------
// 8. UTILITY CONDIVISE
// ----------------------------------------------------------------------------
function deduplicateEntities(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.filter(item => {
    if (!item) return false;
    const key = String(item.id || item.nome || item.name || JSON.stringify(item)).toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanNumber(v, defaultVal = 0) {
  if (v === null || v === undefined || v === "" || v === "—" || v === "-") return defaultVal;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? defaultVal : n;
}

// ----------------------------------------------------------------------------
// 9. ESPOSIZIONE GLOBALE SU WINDOW
// ----------------------------------------------------------------------------
window.AppConfig = AppConfig;
window.AppState = AppState;
window.AppRouter = AppRouter;
window.Wallet = Wallet;
window.apiCall = apiCall;
window.deduplicateEntities = deduplicateEntities;
window.cleanNumber = cleanNumber;

// ----------------------------------------------------------------------------
// 10. BOOTSTRAP DELL'APPLICAZIONE ALL'AVVIO
// ----------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();

  if (typeof AppModules !== "undefined" && typeof AppModules.init === "function") {
    AppModules.init();
  } else {
    console.log("[app-core] In attesa del caricamento dei moduli di piattaforma...");
  }
});
