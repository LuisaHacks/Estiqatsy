// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG ENGINE (VERSIONE 4.4 - SPA UNIFICATA)
// FILE: app.js (CLIENT CONTROLLER: APP, SHOP, RICETTE, WIZARD & REGOLE 2)
// ============================================================================

const AppConfig = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyeCWHM9X4ycwWT7IOMwg24pySL78bJT5BRyiIR5eb0UJALWuaORzfJ2lkqLrjLv0xN/exec",
  CACHE_KEYS: {
    VAULT: "est_cache_vault"
  }
};

const AppState = {
  user: null,
  allowedModules: { home: true, shop: true, games: true, recipes: true, profile: true },
  plans: [],
  billingCycle: "monthly", // 'monthly' | 'yearly'
  activeTab: "home",
  shop: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  recipes: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  carousel: { timer: null, index: 0, count: 0, isPaused: false },
  vault: [],

  // MOTORE DI GIOCO INTEGRATO (RULES 2)
  game: {
    seriesList: [],
    currentSeries: null,
    currentEpisodio: 1,
    session: null, // { gameKey, episodio, partitaId }
    hero: null,
    node: null,
    wizard: {
      step: 1,
      classes: [],
      abilities: [],
      chosenClass: null,
      chosenAbilities: [],
      heroName: "",
      remainingPx: 100
    },
    emporioMode: "buy", // "buy" | "sell"
    backpackFilter: "ALL"
  }
};

// INTEGRAZIONE TELEGRAM WEBAPP
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  try {
    tg.ready();
    tg.expand();
    if (typeof tg.requestFullscreen === "function") tg.requestFullscreen();
    if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
    tg.setHeaderColor("#090D16");
    tg.setBackgroundColor("#090D16");
  } catch (e) {}
}

// GESTORE TASTO INDIETRO NATIVO TELEGRAM
let backButtonHandler = null;
function setupTelegramBackButton(screenName) {
  if (!tg || !tg.BackButton) return;

  if (backButtonHandler) {
    tg.BackButton.offClick(backButtonHandler);
    backButtonHandler = null;
  }

  const isSub = (
    screenName === "subview-shop-detail" || 
    screenName === "subview-recipe-detail" || 
    screenName === "subview-game-detail"
  );
  const isGameActive = (screenName === "view-gameplay" || screenName === "view-wizard");

  if (isSub || isGameActive) {
    tg.BackButton.show();
    backButtonHandler = () => {
      if (screenName === "subview-shop-detail") AppRouter.navigate("shop");
      else if (screenName === "subview-recipe-detail") AppRouter.navigate("recipes");
      else if (screenName === "subview-game-detail") AppRouter.navigate("games");
      else if (screenName === "view-wizard") AppRouter.navigate("games");
      else if (screenName === "view-gameplay") GameEngine.openAbandonModal();
      else AppRouter.navigate("home");
    };
    tg.BackButton.onClick(backButtonHandler);
  } else {
    tg.BackButton.hide();
  }
}

// ROUTER CENTRALIZZATO A DUE MODALITÀ (APP MODE vs GAME COCKPIT MODE)
const AppRouter = {
  navigate: function(screenName) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

    // Reindirizzamento logico per il catalogo giochi
    if (screenName === "games" || screenName === "view-games") {
      screenName = "view-hub";
      GameEngine.renderGamesCatalog();
    }

    // Verifica Hard Locking del modulo
    const baseModule = screenName.replace("view-", "").replace("subview-", "").split("-")[0];
    if (AppState.allowedModules && AppState.allowedModules[baseModule] === false) {
      AppRouter.navigate("home");
      AppEngine.openPlansCatalogModal();
      return;
    }

    // Reset filtri ricerca al cambio scheda
    if (screenName === "shop") {
      AppState.shop.activeCategory = "tutti";
      AppState.shop.searchQuery = "";
      const sInput = document.getElementById("shop-search-input");
      if (sInput) sInput.value = "";
      AppRenderer.renderShop();
    } else if (screenName === "recipes") {
      AppState.recipes.activeCategory = "tutti";
      AppState.recipes.searchQuery = "";
      const rInput = document.getElementById("recipes-search-input");
      if (rInput) rInput.value = "";
      AppRenderer.renderRecipes();
    }

    const allScreens = [
      "view-home", "view-shop", "view-recipes", "view-profile",
      "subview-shop-detail", "subview-recipe-detail",
      "view-hub", "subview-game-detail", "view-wizard", "view-gameplay"
    ];

    let targetId = screenName;
    if (!targetId.startsWith("view-") && !targetId.startsWith("subview-")) {
      targetId = "view-" + screenName;
    }

    // Attivazione schermata target
    allScreens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", id !== targetId);
    });

    const scrollArea = document.getElementById("app-main-scroll");
    if (scrollArea) scrollArea.scrollTop = 0;

    // MACCHINA A STATI DELLA NAVIGAZIONE: APP MODE vs GAME COCKPIT MODE
    const isGameplay = (targetId === "view-gameplay");
    const appHeader = document.getElementById("main-app-header");
    const gameHeader = document.getElementById("main-game-header");
    const appFooter = document.getElementById("main-app-footer");
    const gameFooter = document.getElementById("main-game-cockpit-footer");

    if (isGameplay) {
      if (appHeader) appHeader.classList.add("hidden");
      if (gameHeader) gameHeader.classList.remove("hidden");
      if (appFooter) appFooter.classList.add("hidden");
      if (gameFooter) gameFooter.classList.remove("hidden");
    } else {
      if (appHeader) appHeader.classList.remove("hidden");
      if (gameHeader) gameHeader.classList.add("hidden");
      if (appFooter) appFooter.classList.remove("hidden");
      if (gameFooter) gameFooter.classList.add("hidden");
    }

    // Evidenziazione tab attivi (Mobile Footer & Desktop Sidebar)
    const baseTab = screenName.replace("view-", "").replace("subview-", "").split("-")[0];
    document.querySelectorAll(".nav-tab").forEach(btn => {
      const isActive = (btn.dataset.tab === baseTab || (baseTab === "hub" && btn.dataset.tab === "games"));
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("text-slate-400", !isActive);
    });

    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      const isActive = (btn.dataset.tab === baseTab || (baseTab === "hub" && btn.dataset.tab === "games"));
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("bg-white/5", isActive);
      btn.classList.toggle("text-slate-300", !isActive);
    });

    setupTelegramBackButton(targetId);
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 15);
  }
};

// GATEWAY CHIAMATE API REST (ZERO TRUST CON INITDATA CIFRATO)
async function apiCall(action, extraParams = {}) {
  const initData = (tg && tg.initData) ? tg.initData : "";
  let url = `${AppConfig.GAS_URL}?action=${action}&initData=${encodeURIComponent(initData)}`;
  for (let k in extraParams) {
    if (extraParams[k] !== undefined && extraParams[k] !== null) {
      url += `&${k}=${encodeURIComponent(extraParams[k])}`;
    }
  }
  const response = await fetch(url);
  const json = await response.json();
  if (!json.success && json.error) throw new Error(json.error);
  return json.data;
}

// MOTORE GENERALE APPLICATIVO
const AppEngine = {
  init: async function() {
    this.loadVault();

    try {
      // 1. Profilo e Piani Utente
      const p = await apiCall("profile");
      if (p && p.user) {
        AppState.user = p.user;
        AppState.allowedModules = p.allowedModules || AppState.allowedModules;
        AppState.plans = p.plans || [];
        AppRenderer.renderProfile(p.user);
        AppRenderer.applyHardLocking(AppState.allowedModules);
      }

      // 2. Caricamento Parallelo Moduli
      await Promise.allSettled([
        this.fetchShop(),
        this.fetchRecipes(),
        GameEngine.loadSeriesCatalog(),
        this.syncTransactions(false)
      ]);

      this.initCarousel();

      const loader = document.getElementById("app-loading");
      if (loader) {
        loader.classList.add("opacity-0");
        setTimeout(() => loader.remove(), 250);
      }

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error(err);
      const eb = document.getElementById("loading-error-box");
      if (eb) {
        eb.textContent = err.message || "Errore di connessione al server.";
        eb.classList.remove("hidden");
        document.getElementById("loading-retry-btn").classList.remove("hidden");
      }
    }
  },

  openPlansCatalogModal: function() {
    AppRenderer.renderPlansCatalog();
    const modal = document.getElementById("modal-plans-catalog");
    if (modal) modal.showModal();
  },

  setBillingCycle: function(cycle) {
    AppState.billingCycle = cycle;
    const btnM = document.getElementById("billing-toggle-monthly");
    const btnY = document.getElementById("billing-toggle-yearly");
    const isYearly = (cycle === "yearly");
    if (btnM) btnM.className = `flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${!isYearly ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400'}`;
    if (btnY) btnY.className = `flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${isYearly ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400'} flex items-center justify-center space-x-1`;
    AppRenderer.renderPlansCatalog();
  },

  openPlanModal: function(planId) {
    const plan = AppState.plans.find(p => p.id === planId) || 
                 AppState.plans.find(p => p.nome.toLowerCase() === String(planId).toLowerCase());
    if (!plan) return;

    const isYearly = (AppState.billingCycle === "yearly");
    const priceText = isYearly ? (plan.prezzoAnnuale || plan.prezzoMensile) : (plan.prezzoMensile || "€ 0,00");
    const periodText = isYearly ? "/anno" : "/mese";

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s("upgrade-modal-title", plan.nome);
    s("plan-modal-price", priceText);
    s("plan-modal-period", periodText);
    s("upgrade-modal-desc", plan.descrizione || "Nessuna descrizione disponibile.");
    
    const perksBox = document.getElementById("plan-modal-perks-list");
    if (perksBox) {
      let htmlPerks = `<div class="flex items-center space-x-2 text-amber-300 font-bold pb-1.5 border-b border-white/5"><span>🪙</span> <span>+${plan.bonusMegoin} Megoin al mese inclusi</span></div>`;
      if (plan.perks && plan.perks.length > 0) {
        htmlPerks += plan.perks.map(pk => `
          <div class="flex items-center space-x-2 ${pk.enabled ? 'text-slate-200' : 'text-slate-500'}">
            <span>${pk.enabled ? '✅' : '❌'}</span> <span>${pk.label}</span>
          </div>
        `).join("");
      }
      perksBox.innerHTML = htmlPerks;
    }

    const actBtn = document.getElementById("upgrade-modal-action-btn");
    if (actBtn) {
      if (plan.isAttivo) {
        actBtn.textContent = "Piano Attualmente in Uso";
        actBtn.disabled = true;
        actBtn.className = "btn btn-outline border-white/20 btn-sm w-full text-slate-400 font-bold cursor-not-allowed";
      } else {
        actBtn.textContent = `Attiva ${plan.nome} (${priceText}${periodText})`;
        actBtn.disabled = false;
        actBtn.className = "btn btn-primary btn-sm w-full font-bold shadow-lg shadow-sky-600/30";
        actBtn.onclick = () => alert(`Reindirizzamento checkout per ${plan.nome}...`);
      }
    }

    const detailModal = document.getElementById("modal-plan-upgrade");
    if (detailModal) detailModal.showModal();
  },

  openVaultSection: function() {
    AppRouter.navigate("profile");
    setTimeout(() => {
      const el = document.getElementById("profile-vault-container-card");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  },

  // CAROSELLO PROMOZIONALE
  initCarousel: function() {
    const track = document.getElementById("carousel-track");
    const dotsBox = document.getElementById("carousel-dots-container");
    const outer = document.getElementById("carousel-outer-wrapper");
    if (!track) return;

    const promoSlides = [
      {
        badge: "GIOCHI NOIR RPG",
        titolo: "ViareGTA & Paul Sindaco",
        sottotitolo: "Vivi le saghe noir tra i canali e la pineta a colpi di D20",
        btnText: "Gioca Ora ➔",
        action: () => { AppRouter.navigate("games"); },
        img: "https://image.pollinations.ai/prompt/noir-italian-docks-night-cinematic-libeccio-wind?width=800&height=400&nologo=true"
      },
      {
        badge: "VETRINA BOTTEGA",
        titolo: "Merci & Prodotti Esclusivi",
        sottotitolo: "Spendi i tuoi gettoni Megoin riscattando manuali e sconti",
        btnText: "Apri Shop",
        action: () => { AppRouter.navigate("shop"); },
        img: "https://image.pollinations.ai/prompt/smugglers-dockside-warehouse-bazaar-wooden-crates?width=800&height=400&nologo=true"
      },
      {
        badge: "BARLADY & COCKTAIL",
        titolo: "I Segreti della Darsena",
        sottotitolo: "Sblocca le ricette ufficiali di cocktail, antipasti e primi",
        btnText: "Ricettario",
        action: () => { AppRouter.navigate("recipes"); },
        img: "https://image.pollinations.ai/prompt/vintage-italian-cocktail-bar-amber-lighting-negroni?width=800&height=400&nologo=true"
      }
    ];

    AppState.carousel.count = promoSlides.length;
    AppState.carousel.index = 0;

    track.innerHTML = promoSlides.map((s, idx) => `
      <div class="min-w-full relative h-44 md:h-64 bg-slate-900 cursor-pointer overflow-hidden flex-none" onclick="AppEngine.handleCarouselClick(${idx})">
        <img src="${s.img}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-[#090D16] via-black/40 to-transparent"></div>
        <span class="badge badge-sm badge-primary font-bold uppercase text-[8px] md:text-[10px] absolute top-3.5 left-3.5 shadow-md">
          ${s.badge}
        </span>
        <div class="absolute bottom-4 inset-x-4 flex items-end justify-between">
          <div>
            <h3 class="font-black text-sm md:text-lg text-white">${s.titolo}</h3>
            <p class="text-[10px] md:text-xs text-slate-300 mt-0.5">${s.sottotitolo}</p>
          </div>
          <button class="btn btn-xs md:btn-sm btn-primary font-bold px-3 shadow-lg shadow-sky-600/30">${s.btnText}</button>
        </div>
      </div>
    `).join("");

    dotsBox.innerHTML = promoSlides.map((_, i) => `
      <span class="w-2 h-1.5 rounded-full transition-all ${i === 0 ? 'bg-sky-400 w-4' : 'bg-white/20'}" id="car-dot-${i}"></span>
    `).join("");

    this._currentPromoSlides = promoSlides;

    if (outer) {
      outer.onmouseenter = () => { AppState.carousel.isPaused = true; };
      outer.onmouseleave = () => { AppState.carousel.isPaused = false; };
      outer.ontouchstart = () => { AppState.carousel.isPaused = true; };
      outer.ontouchend = () => { setTimeout(() => { AppState.carousel.isPaused = false; }, 3000); };
    }

    if (AppState.carousel.timer) clearInterval(AppState.carousel.timer);
    AppState.carousel.timer = setInterval(() => {
      if (AppState.carousel.isPaused || AppState.carousel.count <= 1) return;
      AppState.carousel.index = (AppState.carousel.index + 1) % AppState.carousel.count;
      AppEngine.updateCarouselPosition();
    }, 5000);
  },

  handleCarouselClick: function(idx) {
    if (this._currentPromoSlides && this._currentPromoSlides[idx]) {
      this._currentPromoSlides[idx].action();
    }
  },

  updateCarouselPosition: function() {
    const track = document.getElementById("carousel-track");
    if (!track) return;
    const idx = AppState.carousel.index;
    track.style.transform = `translateX(-${idx * 100}%)`;

    for (let i = 0; i < AppState.carousel.count; i++) {
      const dot = document.getElementById(`car-dot-${i}`);
      if (dot) {
        dot.className = `h-1.5 rounded-full transition-all ${i === idx ? 'bg-sky-400 w-4' : 'bg-white/20 w-2'}`;
      }
    }
  },

  // SHOP E BOTTEGA
  fetchShop: async function() {
    try {
      const data = await apiCall("shop");
      if (data && data.items) {
        AppState.shop.items = data.items;
        AppState.shop.categories = data.categories || [];
        AppRenderer.renderShop();
      }
    } catch (e) {}
  },

  setShopCategory: function(cat) {
    AppState.shop.activeCategory = cat;
    AppRenderer.renderShop();
  },

  filterShop: function() {
    const input = document.getElementById("shop-search-input");
    AppState.shop.searchQuery = input ? input.value.trim().toLowerCase() : "";
    AppRenderer.renderShopProducts();
  },

  openShopDetail: function(prodId) {
    const item = AppState.shop.items.find(p => p.id === prodId);
    if (!item) return;

    document.getElementById("detail-shop-title").textContent = item.nome;
    document.getElementById("detail-shop-cat").textContent = item.categoria;
    document.getElementById("detail-shop-desc").textContent = item.descrizione || "";
    document.getElementById("detail-shop-price").textContent = `${item.prezzoMegoin} 🪙 (ca. € ${item.prezzoEuro})`;
    document.getElementById("detail-shop-img").src = item.mediaUrl;

    const sb = document.getElementById("detail-shop-stock");
    sb.textContent = item.isDigitale ? "Digitale" : (item.isEsaurito ? "Esaurito" : `${item.stock} Disp.`);

    const btn = document.getElementById("detail-shop-action-btn");
    if (item.isLocked) {
      btn.textContent = `🔒 Richiede Piano ${item.requiredPlan}`;
      btn.className = "btn btn-warning btn-sm font-bold";
      btn.onclick = () => AppEngine.openPlanModal(item.requiredPlan);
    } else {
      btn.textContent = item.prezzoMegoin === 0 ? "🎁 Riscatta Gratis" : `Acquista (${item.prezzoMegoin} 🪙)`;
      btn.className = "btn btn-primary btn-sm font-bold";
      btn.onclick = () => AppEngine.buyProduct(item.id);
    }

    AppRouter.navigate("subview-shop-detail");
  },

  buyProduct: async function(prodId) {
    try {
      const res = await apiCall("shop_buy", { id: prodId });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("coin");
        if (window.confetti) confetti({ particleCount: 80, spread: 60 });
        AppState.user.saldoMegoin = res.nuovoSaldoMegoin;
        AppState.user.prodottiAcquistati = (AppState.user.prodottiAcquistati || 0) + 1;
        AppRenderer.renderProfile(AppState.user);
        if (res.digitalDownloads) res.digitalDownloads.forEach(d => AppEngine.addVault(d.nome, d.url));
        AppEngine.showFulfillment(res.riepilogo, res.digitalDownloads);
        AppEngine.syncTransactions(true);
      }
    } catch (err) {
      alert("❌ " + err.message);
    }
  },

  // RICETTE
  fetchRecipes: async function() {
    try {
      const data = await apiCall("recipes");
      if (data && data.recipes) {
        AppState.recipes.items = data.recipes;
        AppState.recipes.categories = data.categories || [];
        AppRenderer.renderRecipes();
      }
    } catch (e) {}
  },

  setRecipeCategory: function(cat) {
    AppState.recipes.activeCategory = cat;
    AppRenderer.renderRecipes();
  },

  filterRecipes: function() {
    const input = document.getElementById("recipes-search-input");
    AppState.recipes.searchQuery = input ? input.value.trim().toLowerCase() : "";
    AppRenderer.renderRecipesCards();
  },

  openRecipeDetail: function(rowIdx) {
    const r = AppState.recipes.items.find(x => x.rowIndex === rowIdx);
    if (!r) return;

    document.getElementById("detail-recipe-title").textContent = r.piatto;
    document.getElementById("detail-recipe-cat").textContent = r.categoria;
    document.getElementById("detail-recipe-meta").textContent = `Costo: ${r.costo} • Difficoltà: ${r.difficolta} • ⏱️ ${r.tempo}`;
    document.getElementById("detail-recipe-ingredients").textContent = r.ingredienti || "Nessun ingrediente elencato.";
    document.getElementById("detail-recipe-prep").textContent = r.preparazione || "Nessuna preparazione.";
    document.getElementById("detail-recipe-img").src = r.mediaUrl;

    const rpg = document.getElementById("detail-recipe-rpg");
    if (rpg && r.rpg) {
      rpg.innerHTML = `
        <div class="p-2 rounded bg-surface"><span class="text-sky-400 font-bold block">${r.rpg.destrezza}</span>Destrezza</div>
        <div class="p-2 rounded bg-surface"><span class="text-rose-400 font-bold block">${r.rpg.forza}</span>Forza</div>
        <div class="p-2 rounded bg-surface"><span class="text-amber-400 font-bold block">${r.rpg.gusto}/10</span>Gusto</div>
      `;
    }
    AppRouter.navigate("subview-recipe-detail");
  },

  // TRANSAZIONI & CAVEAU
  syncTransactions: async function(force = false) {
    try {
      const d = await apiCall("my_transactions");
      if (d && d.transactions) AppRenderer.renderTransactions(d.transactions);
    } catch (e) {}
  },

  loadVault: function() {
    const s = localStorage.getItem(AppConfig.CACHE_KEYS.VAULT);
    if (s) { try { AppState.vault = JSON.parse(s); AppRenderer.renderVault(); } catch (e) {} }
  },

  addVault: function(nome, url) {
    AppState.vault.unshift({ nome, url, data: new Date().toLocaleDateString("it-IT") });
    localStorage.setItem(AppConfig.CACHE_KEYS.VAULT, JSON.stringify(AppState.vault));
    AppRenderer.renderVault();
  },

  showFulfillment: function(summary, downloads) {
    document.getElementById("fulfillment-summary").textContent = summary || "";
    const b = document.getElementById("fulfillment-download-box");
    if (downloads && downloads.length > 0) {
      b.innerHTML = downloads.map(d => `<a href="${d.url}" target="_blank" class="btn btn-sm btn-success w-full font-bold">📥 Scarica ${d.nome}</a>`).join("");
      b.classList.remove("hidden");
    } else {
      b.innerHTML = "";
      b.classList.add("hidden");
    }
    document.getElementById("modal-fulfillment").showModal();
  }
};

// ============================================================================
// GAME ENGINE - CONTROLLER GIOCHI NOIR RPG & REGOLE 2
// ============================================================================
const GameEngine = {
  loadSeriesCatalog: async function() {
    try {
      const gamesData = await apiCall("games");
      if (gamesData && gamesData.series) {
        AppState.game.seriesList = gamesData.series;
        const gc = document.getElementById("home-games-count");
        if (gc) gc.textContent = gamesData.series.length;
      }
    } catch (e) {
      console.warn("Errore caricamento giochi:", e);
    }
  },

  // RENDERER CATALOGO COMPLETO GIOCHI (RULES 2 & RULES 1)
  renderGamesCatalog: function() {
    const container = document.getElementById("games-catalog-container");
    const counter = document.getElementById("games-total-counter");
    if (!container) return;

    const list = AppState.game.seriesList || [];
    if (counter) counter.textContent = `${list.length} Giochi Registrati`;

    if (list.length === 0) {
      container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-xs">Nessun gioco trovato nei registri.</div>`;
      return;
    }

    container.innerHTML = list.map(saga => {
      const isRules2 = (saga.regole && saga.regole.toLowerCase().includes("rules2"));
      return `
        <div onclick="GameEngine.openGameDetail('${saga.gameKey}')" class="bg-surface/90 hover:bg-surface rounded-2xl border ${isRules2 ? 'border-sky-500/40 ring-1 ring-sky-500/20' : 'border-white/10'} p-4 flex flex-col justify-between space-y-3 cursor-pointer active:scale-[0.98] transition-all shadow-xl group">
          <div class="h-36 w-full rounded-xl overflow-hidden relative bg-black/40">
            <img src="${saga.mediaUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <span class="badge badge-xs ${isRules2 ? 'badge-primary' : 'badge-warning'} font-black uppercase text-[8px] absolute top-2.5 left-2.5 shadow">
              ${saga.regole || 'Rules 2'}
            </span>
          </div>
          <div>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-black text-white group-hover:text-sky-400 transition-colors">${saga.emoji || '🎮'} ${saga.serie}</h3>
              <span class="text-[9px] text-slate-400 font-mono">${(saga.episodes || []).length} Ep.</span>
            </div>
            <p class="text-[11px] text-slate-300 line-clamp-2 mt-1 leading-relaxed">${saga.descrizione || ''}</p>
          </div>
          <div class="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
            <span class="text-slate-400">${saga.hasActiveGame ? '⚔️ Partita in corso' : 'Pronto al lancio'}</span>
            <button class="btn btn-xs ${isRules2 ? 'btn-primary' : 'btn-outline border-white/20'} font-bold">
              Esplora Capitoli ›
            </button>
          </div>
        </div>
      `;
    }).join("");

    if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("intro");
  },

  openGameDetail: function(gameKey) {
    const saga = AppState.game.seriesList.find(s => s.gameKey === gameKey);
    if (!saga) return;

    AppState.game.currentSeries = saga;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s("hub-title", `${saga.emoji || '🎮'} ${saga.serie}`);
    s("hub-desc", saga.descrizione || "");
    s("hub-rules", saga.regole || "Rules 2");

    const img = document.getElementById("hub-image");
    if (img) img.src = saga.mediaUrl;

    if (saga.citazione) {
      s("hub-quote", `“${saga.citazione}”`);
      s("hub-author", saga.autoreCitazione || "");
    }

    const container = document.getElementById("hub-episodes-container");
    if (container) {
      container.innerHTML = (saga.episodes || []).map(ep => `
        <div class="p-3 bg-surface rounded-xl border border-white/5 flex items-center justify-between shadow-md">
          <div>
            <div class="text-xs font-bold text-white">${ep.emoji || '▶️'} Ep. ${ep.episodio}: ${ep.titolo}</div>
            <div class="text-[9px] text-slate-400 mt-0.5">
              ${ep.canContinueFree ? '⚔️ Continua con Eroe Veterano (Gratis)' : (ep.costoMegoin === 0 ? 'Gratis' : `${ep.costoMegoin} Megoin 🪙`)}
            </div>
          </div>
          <button onclick="GameEngine.startEpisode('${saga.gameKey}', ${ep.episodio}, ${!!ep.canContinueFree})" class="btn btn-xs btn-primary font-bold px-3 shadow-md">
            ${ep.canContinueFree ? 'Continua' : 'Gioca'}
          </button>
        </div>
      `).join("");
    }

    AppRouter.navigate("subview-game-detail");
  },

  startEpisode: async function(gameKey, epNum, canContinueFree) {
    AppState.game.currentEpisodio = epNum;

    // Se l'eroe è veterano ed ha diritto all'avanzamento gratuito, avvia direttamente
    if (canContinueFree) {
      if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("exploration");
      this.executeStartGame({ gameKey, episodio: epNum });
      return;
    }

    // Se è un nuovo eroe, carica il Wizard da Episodio 0
    this.openWizard(gameKey, epNum);
  },

  // WIZARD CREAZIONE PERSONAGGIO (RULES 2)
  openWizard: async function(gameKey, epNum) {
    try {
      if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("wizard");
      const wizData = await apiCall("game_wizard_data", { gameKey: gameKey });
      
      AppState.game.wizard.classes = wizData.classes || [];
      AppState.game.wizard.abilities = wizData.abilities || [];
      AppState.game.wizard.step = 1;
      AppState.game.wizard.chosenClass = wizData.classes[0] || null;
      AppState.game.wizard.chosenAbilities = [];
      AppState.game.wizard.remainingPx = 100;

      this.renderWizardStep1();
      AppRouter.navigate("view-wizard");
    } catch (e) {
      alert("Errore caricamento classi: " + e.message);
    }
  },

  renderWizardStep1: function() {
    const c = document.getElementById("wizard-classes-carousel");
    if (!c) return;

    c.innerHTML = AppState.game.wizard.classes.map(cls => {
      const isSelected = (AppState.game.wizard.chosenClass && AppState.game.wizard.chosenClass.id === cls.id);
      const isDestra = (cls.schieramento.toLowerCase() === "destra");
      return `
        <div onclick="GameEngine.wizardSelectClass('${cls.id}')" class="min-w-[240px] max-w-[260px] bg-surface p-4 rounded-2xl border ${isSelected ? 'border-sky-400 ring-2 ring-sky-400/50 shadow-xl' : 'border-white/10'} snap-center cursor-pointer flex flex-col justify-between space-y-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-2xl">${cls.emoji}</span>
              <span class="badge badge-xs ${isDestra ? 'badge-info' : 'badge-error'} font-black uppercase text-[8px]">${cls.schieramento}</span>
            </div>
            <h4 class="font-black text-sm text-white mt-1">${cls.nome}</h4>
            <div class="text-[10px] text-amber-300 font-bold mt-0.5">❤️ ${cls.pv} PV • 🟡 ${cls.oro} Oro</div>
            <div class="text-[9px] text-slate-400 font-mono mt-1">FOR: ${cls.forza} • DES: ${cls.destrezza} • INT: ${cls.intelligenza}</div>
            <p class="text-[10px] text-slate-300 line-clamp-3 mt-2">${cls.descrizione}</p>
          </div>
          <div class="pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
            <span class="text-slate-400">Arma: <b>${cls.armaIniziale ? cls.armaIniziale.nome : 'Pugni'}</b></span>
            <button class="btn btn-xs ${isSelected ? 'btn-success' : 'btn-outline border-white/20'} font-bold">
              ${isSelected ? 'Selezionata' : 'Scegli'}
            </button>
          </div>
        </div>
      `;
    }).join("");

    this.wizardShowStep(1);
  },

  wizardSelectClass: function(clsId) {
    const found = AppState.game.wizard.classes.find(c => c.id === clsId);
    if (!found) return;
    AppState.game.wizard.chosenClass = found;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.renderWizardStep1();
    this.renderWizardStep2();
    setTimeout(() => this.wizardNextStep(2), 200);
  },

  renderWizardStep2: function() {
    const grid = document.getElementById("wizard-abilities-grid");
    const budgetBadge = document.getElementById("wizard-px-budget");
    if (!grid) return;

    if (budgetBadge) budgetBadge.textContent = `✨ ${AppState.game.wizard.remainingPx} PX`;

    const userFaction = AppState.game.wizard.chosenClass ? AppState.game.wizard.chosenClass.schieramento.toLowerCase() : "destra";

    grid.innerHTML = AppState.game.wizard.abilities.map(abl => {
      const isSelected = AppState.game.wizard.chosenAbilities.includes(abl.id);
      const req = (abl.requisitoClasse || "").toLowerCase();
      const isCompatible = (req.includes("tutti") || req.includes(userFaction));

      return `
        <div onclick="${isCompatible ? `GameEngine.wizardToggleAbility('${abl.id}')` : ''}" class="p-3 rounded-xl border ${isSelected ? 'border-sky-400 bg-sky-500/10' : (isCompatible ? 'border-white/10 bg-surface/70 cursor-pointer' : 'border-white/5 bg-black/40 opacity-40 cursor-not-allowed')} flex items-center justify-between">
          <div class="overflow-hidden pr-2">
            <div class="flex items-center space-x-1.5">
              <span>${abl.emoji}</span>
              <span class="text-xs font-bold text-white truncate">${abl.nome}</span>
            </div>
            <div class="text-[9px] text-slate-400 line-clamp-1 mt-0.5">${abl.descrizione}</div>
          </div>
          <span class="badge badge-xs ${isSelected ? 'badge-primary' : 'badge-ghost'} font-bold text-[8px] shrink-0">
            ${isSelected ? 'ATTIVA' : (isCompatible ? `${abl.costoPX} PX` : '🔒')}
          </span>
        </div>
      `;
    }).join("");
  },

  wizardToggleAbility: function(ablId) {
    const idx = AppState.game.wizard.chosenAbilities.indexOf(ablId);
    if (idx !== -1) {
      AppState.game.wizard.chosenAbilities.splice(idx, 1);
      AppState.game.wizard.remainingPx += 100;
    } else {
      if (AppState.game.wizard.remainingPx >= 100) {
        AppState.game.wizard.chosenAbilities.push(ablId);
        AppState.game.wizard.remainingPx -= 100;
      } else {
        alert("Budget PX esaurito!");
        return;
      }
    }
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.renderWizardStep2();
  },

  wizardNextStep: function(stepNum) {
    AppState.game.wizard.step = stepNum;
    if (stepNum === 3) {
      const recap = document.getElementById("wizard-class-recap");
      if (recap && AppState.game.wizard.chosenClass) {
        recap.textContent = `${AppState.game.wizard.chosenClass.nome} (${AppState.game.wizard.chosenClass.schieramento})`;
      }
    }
    this.wizardShowStep(stepNum);
  },

  wizardPrevStep: function(stepNum) {
    AppState.game.wizard.step = stepNum;
    this.wizardShowStep(stepNum);
  },

  wizardShowStep: function(stepNum) {
    document.getElementById("wizard-step-class").classList.toggle("hidden", stepNum !== 1);
    document.getElementById("wizard-step-abilities").classList.toggle("hidden", stepNum !== 2);
    document.getElementById("wizard-step-name").classList.toggle("hidden", stepNum !== 3);
  },

  wizardUseTelegramName: function() {
    const input = document.getElementById("wizard-name-input");
    if (input && AppState.user) input.value = AppState.user.nome;
  },

  wizardFinalizeHero: function() {
    const input = document.getElementById("wizard-name-input");
    const heroName = (input && input.value.trim()) ? input.value.trim() : (AppState.user ? AppState.user.nome : "Avventuriero");

    this.executeStartGame({
      gameKey: AppState.game.currentSeries.gameKey,
      episodio: AppState.game.currentEpisodio,
      classId: AppState.game.wizard.chosenClass ? AppState.game.wizard.chosenClass.id : "CLS_0001_S1_E0",
      abilityIds: AppState.game.wizard.chosenAbilities.join(","),
      heroName: heroName
    });
  },

  executeStartGame: async function(payloadParams) {
    try {
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.playSfx("insert_coin");
        SoundEngine.playBgm("exploration");
      }

      const res = await apiCall("game_start", payloadParams);
      if (res && res.success) {
        AppState.game.session = {
          gameKey: payloadParams.gameKey,
          episodio: payloadParams.episodio,
          partitaId: res.partitaId
        };
        AppState.game.hero = res.statoEroe;
        AppState.user.saldoMegoin = res.nuovoSaldoMegoin;
        AppRenderer.renderProfile(AppState.user);

        this.renderNode(res.nodoIniziale, res.statoEroe);
        AppRouter.navigate("view-gameplay");
      }
    } catch (err) {
      alert("Impossibile avviare la partita: " + err.message);
    }
  },

  // RENDERING SNODO NARRATIVO (ABOVE-THE-FOLD RIGIDO)
  renderNode: function(node, hero) {
    AppState.game.node = node;
    if (hero) AppState.game.hero = hero;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // 1. Header Gioco
    s("game-header-series", (AppState.game.currentSeries ? AppState.game.currentSeries.serie : "GIOCO").toUpperCase());
    s("game-header-episode", `Episodio ${AppState.game.currentEpisodio}`);

    // 2. HUD Plancia Eroe Compatta
    if (AppState.game.hero) {
      const h = AppState.game.hero;
      s("kpi-hero-name", h.nomeEroe);
      s("kpi-hero-gold", h.oro);
      s("kpi-hero-pv-text", `${h.pv}/${h.pvMax}`);
      
      const pvBar = document.getElementById("kpi-hero-pv-bar");
      if (pvBar) {
        pvBar.value = h.pv;
        pvBar.max = h.pvMax;
      }

      if (h.modificatori) {
        s("kpi-mod-for", (h.modificatori.FORZA >= 0 ? "+" : "") + h.modificatori.FORZA);
        s("kpi-mod-des", (h.modificatori.DESTREZZA >= 0 ? "+" : "") + h.modificatori.DESTREZZA);
        s("kpi-mod-int", (h.modificatori.INTELLIGENZA >= 0 ? "+" : "") + h.modificatori.INTELLIGENZA);
      }
    }

    // 3. Inquadratura 16:9 Cinema & Copertura Anti-Watermark
    const img = document.getElementById("scene-image");
    if (img) img.src = node.mediaUrl || "https://image.pollinations.ai/prompt/noir-docks-night-cinematic?width=800&height=450&nologo=true";

    s("scene-type-badge", node.tipo || "SNODO");
    s("scene-title", node.nome || "Avventura");
    s("scene-text", node.testo || "");

    const wBanner = document.getElementById("scene-watermark-banner");
    if (node.citazione && node.citazione !== "—") {
      s("scene-quote", `“${node.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”`);
      s("scene-author", node.autoreCitazione || "");
      if (wBanner) wBanner.classList.remove("hidden");
    } else {
      if (wBanner) wBanner.classList.add("hidden");
    }

    // 4. Area Azioni Tattiche (Bivi Narrativi / Combattimento)
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    const isCombat = (node.tipo === "NEMICO" || (node.id && node.id.includes("NEM_")));

    if (isCombat) {
      if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("combat");

      const canBribe = node.corruption && node.corruption.canCorrupt;
      const bribeLabel = (node.corruption && node.corruption.validDrugs.some(d => d.costoDosi === 0))
        ? "🟡 Corrompi (Gratis)"
        : "🟡 Corrompi";

      actBox.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <button onclick="GameEngine.combatAction('attack_round')" class="btn btn-sm btn-error font-black shadow-lg shadow-rose-600/30">
            ⚔️ Attacca Round
          </button>
          <button onclick="GameEngine.combatAction('flee')" class="btn btn-sm btn-outline border-white/20 text-xs font-bold">
            🏃 Fuggi
          </button>
        </div>
        ${canBribe ? `
          <button onclick="GameEngine.combatBribe('${node.corruption.validDrugs[0].nome}')" class="btn btn-xs btn-block btn-warning font-bold text-[10px] mt-1 shadow-md">
            ${bribeLabel}
          </button>
        ` : ''}
      `;
      return;
    }

    // Gestione Quiz Enigma
    if (node.quiz) {
      actBox.innerHTML = `
        <div class="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs">
          <div class="font-bold text-amber-300">❓ ${node.quiz.domanda}</div>
          <div class="grid grid-cols-2 gap-1.5 pt-1">
            ${node.quiz.opzioni.map(opz => `
              <button onclick="GameEngine.submitQuizAnswer('${opz.replace(/'/g, "\\'")}')" class="btn btn-xs btn-outline border-white/20 text-[10px] truncate">
                ${opz}
              </button>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    // Bivi Narrativi Standard
    if (node.choices && node.choices.length > 0) {
      if (node.choices.length === 2) {
        actBox.innerHTML = `
          <div class="grid grid-cols-2 gap-2">
            <button onclick="GameEngine.advanceToNode('${node.choices[0].target}')" class="btn btn-sm btn-primary text-xs font-bold truncate shadow-md">
              ${node.choices[0].testo}
            </button>
            <button onclick="GameEngine.advanceToNode('${node.choices[1].target}')" class="btn btn-sm btn-primary text-xs font-bold truncate shadow-md">
              ${node.choices[1].testo}
            </button>
          </div>
        `;
      } else {
        actBox.innerHTML = node.choices.map(c => `
          <button onclick="GameEngine.advanceToNode('${c.target}')" class="btn btn-sm btn-block btn-primary text-xs font-bold mb-1.5 truncate shadow-md">
            ${c.testo}
          </button>
        `).join("");
      }
    } else {
      actBox.innerHTML = `
        <button onclick="GameEngine.renderSeriesHub()" class="btn btn-sm btn-block btn-outline border-white/20 text-xs font-bold">
          🏁 Capitolo Concluso ➔ Torna ai Giochi
        </button>
      `;
    }
  },

  advanceToNode: async function(targetId) {
    if (!AppState.game.session) return;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");

    try {
      const res = await apiCall("game_node", {
        gameKey: AppState.game.session.gameKey,
        episodio: AppState.game.session.episodio,
        nodeId: targetId,
        partitaId: AppState.game.session.partitaId
      });
      if (res && res.nodo) {
        this.renderNode(res.nodo, res.statoEroe);
      }
    } catch (e) {
      alert("Errore avanzamento: " + e.message);
    }
  },

  // PATTERN "CASINO SUSPENSE ROLL" PER IL COMBATTIMENTO SENZA ALERT
  combatAction: async function(subAction) {
    if (!AppState.game.session) return;

    const diceModal = document.getElementById("modal-dice-suspense");
    const diceCube = document.getElementById("dice-visual-cube");
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // 1. Avvio Immediato Animazione Dado & Suono (0 ms di latenza percepita)
    if (subAction === "attack_round") {
      s("dice-roll-title", "Lancio D20 in corso...");
      s("dice-roll-result", "--");
      s("dice-roll-desc", "Tiro di dado sommato ai modificatori...");
      if (diceCube) diceCube.classList.add("dice-rolling");
      if (diceModal) diceModal.showModal();
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("dice");
    }

    try {
      // 2. Risoluzione Server-Authoritative
      const res = await apiCall("game_action", {
        subAction: subAction,
        gameKey: AppState.game.session.gameKey,
        episodio: AppState.game.session.episodio
      });

      // 3. Risoluzione Visiva all'Arrivo dei Dati
      if (subAction === "attack_round" && res.combatLog) {
        const log = res.combatLog;
        if (diceCube) diceCube.classList.remove("dice-rolling");
        s("dice-roll-result", `D20: ${log.d20Hero} (${log.totHero >= log.cdTarget ? 'COLPITO' : 'A VUOTO'})`);
        s("dice-roll-desc", `Totale: ${log.totHero} vs CD ${log.cdTarget}`);

        setTimeout(() => {
          if (diceModal) diceModal.close();

          // Feedback Visivo Danno Fluttuante (No alert)
          if (log.isHit) {
            this.showFloatingDamage(`💥 -${log.dmgDealt} PV`, log.isCrit, false);
            if (typeof SoundEngine !== "undefined") SoundEngine.playSfx(log.isCrit ? "crit_hit" : "hit");
          } else {
            this.showFloatingDamage("💨 A vuoto", false, false);
          }

          if (log.dmgTaken > 0) {
            setTimeout(() => {
              this.showFloatingDamage(`💔 -${log.dmgTaken} PV Eroe`, false, true);
            }, 300);
          }

          // Aggiornamento Scena o Esito Duello
          if (res.status === "VICTORY") {
            if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("victory");
            if (window.confetti) confetti({ particleCount: 70, spread: 60 });
            this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
          } else if (res.status === "DEFEAT") {
            if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("defeat");
            this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
          } else {
            this.renderNode(res.nodo, res.statoEroe);
          }
        }, 750);
      } else if (res.nextView) {
        this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
      } else if (res.nodo) {
        this.renderNode(res.nodo, res.statoEroe);
      }
    } catch (e) {
      if (diceModal) diceModal.close();
      alert("Errore combattimento: " + e.message);
    }
  },

  combatBribe: async function(drugName) {
    if (!AppState.game.session) return;
    try {
      const res = await apiCall("game_action", {
        subAction: "bribe",
        drug: drugName,
        gameKey: AppState.game.session.gameKey,
        episodio: AppState.game.session.episodio
      });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("bribe");
        this.showFloatingDamage("🟡 Corrotto!", false, false);
        this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
      }
    } catch (e) {
      alert("Corruzione fallita: " + e.message);
    }
  },

  showFloatingDamage: function(text, isCrit, isHeroDmg) {
    const box = document.getElementById("floating-damage-box");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `floating-damage font-black text-xl md:text-2xl ${isHeroDmg ? 'text-rose-400 text-glow-rose' : (isCrit ? 'text-amber-300 text-glow-amber text-3xl' : 'text-sky-300')}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  submitQuizAnswer: function(selectedOpz) {
    const node = AppState.game.node;
    if (!node || !node.quiz) return;
    const isCorrect = (selectedOpz.trim().toLowerCase() === node.quiz.rispostaCorretta.trim().toLowerCase());
    if (isCorrect) {
      this.showFloatingDamage("✅ Esatto!", false, false);
      this.advanceToNode(node.destSuccesso);
    } else {
      this.showFloatingDamage("❌ Errato!", false, true);
      this.advanceToNode(node.destFallimento);
    }
  },

  // =========================================================================
  // I 5 CASSETTI TATTICI DEL COCKPIT (POPOLAMENTO REALE & FINANZA ATOMICA)
  // =========================================================================
  openBackpackDrawer: function() {
    this.filterBackpack(AppState.game.backpackFilter || "ALL");
    document.getElementById("drawer-backpack").showModal();
  },

  filterBackpack: function(cat) {
    AppState.game.backpackFilter = cat;
    const c = document.getElementById("backpack-slots-container");
    const h = AppState.game.hero;
    if (!c || !h) return;

    const inv = h.inventario || [];
    if (inv.length === 0) {
      c.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">Il tuo zaino è vuoto.</div>`;
      return;
    }

    c.innerHTML = inv.map(it => `
      <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex items-center justify-between text-xs">
        <div class="overflow-hidden pr-2">
          <div class="font-bold text-white truncate">${it}</div>
          <div class="text-[9px] text-slate-400">${it === h.armaAttiva ? '🗡️ [ARMA ATTIVA]' : (it === h.veicoloAttivo ? '🛴 [VEICOLO ATTIVO]' : 'Oggetto')}</div>
        </div>
        <button onclick="GameEngine.useBackpackItem('${it.replace(/'/g, "\\'")}')" class="btn btn-xs btn-outline border-white/20 text-[9px] shrink-0">
          Usa
        </button>
      </div>
    `).join("");
  },

  useBackpackItem: async function(itemName) {
    if (!AppState.game.session) return;
    try {
      const res = await apiCall("game_action", {
        subAction: "use_item",
        item: itemName,
        gameKey: AppState.game.session.gameKey,
        episodio: AppState.game.session.episodio
      });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("drug");
        AppState.game.hero = res.statoEroe;
        this.renderNode(AppState.game.node, res.statoEroe);
        this.filterBackpack(AppState.game.backpackFilter);
      }
    } catch (e) {
      alert("Impossibile usare l'oggetto: " + e.message);
    }
  },

  openEmporioDrawer: function() {
    const h = AppState.game.hero;
    document.getElementById("emporio-gold-display").textContent = `${h ? h.oro : 0} 🟡`;
    this.setEmporioMode(AppState.game.emporioMode || "buy");
    document.getElementById("drawer-emporio").showModal();
  },

  setEmporioMode: function(mode) {
    AppState.game.emporioMode = mode;
    const btnBuy = document.getElementById("emporio-tab-buy");
    const btnSell = document.getElementById("emporio-tab-sell");
    const container = document.getElementById("emporio-items-container");
    const h = AppState.game.hero;

    if (btnBuy) btnBuy.className = `flex-1 btn btn-xs ${mode === 'buy' ? 'btn-primary' : 'btn-ghost text-slate-400'} font-bold text-[10px]`;
    if (btnSell) btnSell.className = `flex-1 btn btn-xs ${mode === 'sell' ? 'btn-primary' : 'btn-ghost text-slate-400'} font-bold text-[10px]`;

    if (mode === "sell") {
      const inv = (h && h.inventario) ? h.inventario : [];
      if (inv.length === 0) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">Nessuna merce da vendere a Ciccio.</div>`;
        return;
      }
      container.innerHTML = inv.map(it => `
        <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex items-center justify-between text-xs">
          <span class="font-bold text-white truncate pr-2">${it}</span>
          <button onclick="GameEngine.sellToEmporio('${it.replace(/'/g, "\\'")}')" class="btn btn-xs btn-warning font-bold text-[9px] shrink-0">
            Vendi (+10 🟡)
          </button>
        </div>
      `).join("");
    } else {
      // Modalità Acquisto: Mini-Shop Responsivo (2 col mobile, 3 col tablet, 4 col desktop)
      container.innerHTML = `
        <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex flex-col justify-between text-xs space-y-2">
          <div><div class="font-bold text-white">Focaccia Unta</div><div class="text-[9px] text-amber-300">12 🟡 • Cura 16 PV</div></div>
          <button class="btn btn-xs btn-primary font-bold text-[9px]">Compra</button>
        </div>
        <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex flex-col justify-between text-xs space-y-2">
          <div><div class="font-bold text-white">Danpei Gold</div><div class="text-[9px] text-amber-300">22 🟡 • THC Puro</div></div>
          <button class="btn btn-xs btn-primary font-bold text-[9px]">Compra</button>
        </div>
        <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex flex-col justify-between text-xs space-y-2">
          <div><div class="font-bold text-white">Serramanico</div><div class="text-[9px] text-amber-300">15 🟡 • Danno 4</div></div>
          <button class="btn btn-xs btn-primary font-bold text-[9px]">Compra</button>
        </div>
        <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex flex-col justify-between text-xs space-y-2">
          <div><div class="font-bold text-white">Kit Garze</div><div class="text-[9px] text-amber-300">14 🟡 • Cura 22 PV</div></div>
          <button class="btn btn-xs btn-primary font-bold text-[9px]">Compra</button>
        </div>
      `;
    }
  },

  sellToEmporio: function(itemName) {
    if (AppState.game.hero) {
      const idx = AppState.game.hero.inventario.indexOf(itemName);
      if (idx !== -1) {
        AppState.game.hero.inventario.splice(idx, 1);
        AppState.game.hero.oro += 10; // Riacquisto al 25% medio
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
        this.openEmporioDrawer();
        this.renderNode(AppState.game.node, AppState.game.hero);
      }
    }
  },

  openCambioModal: function() {
    document.getElementById("cambio-megoin-balance").textContent = AppState.user ? AppState.user.saldoMegoin : 0;
    document.getElementById("modal-banco-cambio").showModal();
  },

  // CONVERSIONE ATOMICA SERVER-SIDE (MEGOIN ➔ ORO)
  convertMegoinToGold: async function(megoinCost, goldEarned) {
    if (!AppState.user || AppState.user.saldoMegoin < megoinCost) {
      alert("Saldo Megoin insufficiente!");
      return;
    }

    try {
      const res = await apiCall("currency_exchange", {
        megoin: megoinCost,
        gold: goldEarned,
        gameKey: AppState.game.session ? AppState.game.session.gameKey : "game1"
      });

      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
        if (window.confetti) confetti({ particleCount: 60, spread: 50 });

        AppState.user.saldoMegoin = res.nuovoSaldoMegoin;
        if (AppState.game.hero) AppState.game.hero.oro = res.nuovoOro;

        AppRenderer.renderProfile(AppState.user);
        this.renderNode(AppState.game.node, AppState.game.hero);

        document.getElementById("cambio-megoin-balance").textContent = res.nuovoSaldoMegoin;
        document.getElementById("emporio-gold-display").textContent = `${res.nuovoOro} 🟡`;
        alert(`✅ Convertiti con successo ${megoinCost} 🪙 in +${goldEarned} 🟡 Oro!`);
        document.getElementById("modal-banco-cambio").close();
      }
    } catch (e) {
      alert("Errore nel banco di cambio: " + e.message);
    }
  },

  openSquadDrawer: function() {
    const c = document.getElementById("squad-list-container");
    const h = AppState.game.hero;
    if (!c || !h) return;

    let html = "";
    const comp = h.compagni || [];
    const zombies = h.zombieSquad || [];

    if (comp.length === 0 && zombies.length === 0) {
      html = `<div class="py-6 text-center text-slate-500 text-xs">Sei in solitaria. Nessun alleato o zombi presente.</div>`;
    } else {
      html += comp.map(a => `<div class="p-2.5 bg-surface rounded-xl border border-white/5 font-bold text-xs flex justify-between"><span>🤝 ${a}</span> <span class="text-emerald-400">Alleato Umano</span></div>`).join("");
      html += zombies.map(z => `<div class="p-2.5 bg-surface rounded-xl border border-rose-500/30 font-bold text-xs flex justify-between"><span>🧟 ${z.nome}</span> <span class="text-rose-400">Danno 2x (PV: ${z.pv}/${z.pvMax})</span></div>`).join("");
    }

    c.innerHTML = html;
    document.getElementById("drawer-squad").showModal();
  },

  openDossierDrawer: function() {
    const c = document.getElementById("dossier-list-container");
    const h = AppState.game.hero;
    if (!c || !h) return;

    const inv = h.inventario || [];
    const prove = inv.filter(it => it.toLowerCase().includes("bolla") || it.toLowerCase().includes("cartone") || it.toLowerCase().includes("fattura") || it.toLowerCase().includes("schema") || it.toLowerCase().includes("registro"));

    if (prove.length === 0) {
      c.innerHTML = `<div class="py-6 text-center text-slate-500 text-xs">Nessuna prova d'inchiesta decifrata finora.</div>`;
    } else {
      c.innerHTML = prove.map(p => `
        <div class="p-3 bg-surface rounded-xl border border-sky-500/30 text-xs space-y-1">
          <div class="font-bold text-sky-400">📁 ${p}</div>
          <div class="text-[10px] text-slate-300">Reperto certificato dell'Organigramma. Fornisce <b class="text-emerald-400">+1 INT permanente</b>.</div>
        </div>
      `).join("");
    }

    document.getElementById("drawer-dossier").showModal();
  },

  openAbandonModal: function() {
    document.getElementById("modal-abandon").showModal();
  },

  confirmAbandon: function() {
    document.getElementById("modal-abandon").close();
    AppState.game.session = null;
    this.leaveGameToHub();
  },

  leaveGameToHub: function() {
    AppRouter.navigate("games");
  }
};

// RENDERER INTERFACCIA
const AppRenderer = {
  applyHardLocking: function(allowed) {
    if (!allowed) return;
    document.querySelectorAll("[data-module]").forEach(el => {
      const mod = el.dataset.module;
      const isAllowed = (allowed[mod] !== false);
      el.classList.toggle("hidden", !isAllowed);
    });
  },

  renderProfile: function(u) {
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s("home-username", u.nome);
    s("home-rank-points", u.puntiFedelta);
    s("home-plan-badge", `PIANO ${(u.piano || "Free").toUpperCase()}`);
    s("home-megoin-card", `${u.saldoMegoin} 🪙`);
    s("home-punti-card", `${u.puntiFedelta} Pt`);
    s("home-purchases-count", u.prodottiAcquistati || 0);

    s("user-avatar-desk", (u.nome || "U").charAt(0).toUpperCase());
    s("user-name-desk", u.nome);
    s("user-plan-desk", `PIANO ${(u.piano || "Free").toUpperCase()}`);
    s("user-megoin-desk", `${u.saldoMegoin} 🪙`);
    s("user-points-desk", `${u.puntiFedelta} Pt`);

    s("profile-card-avatar", (u.nome || "U").charAt(0).toUpperCase());
    s("profile-card-name", u.nome);
    s("profile-card-username", u.username);
    s("profile-card-plan", `PIANO ${(u.piano || "Free").toUpperCase()}`);
    s("profile-card-id", `ID: ${u.chatId}`);
    s("profile-card-megoin", `${u.saldoMegoin} 🪙`);
    s("profile-card-points", `${u.puntiFedelta} Pt`);

    s("profile-action-plan-name", `Piano: ${(u.piano || "Free").toUpperCase()}`);
    s("profile-action-vault-count", AppState.vault.length);
  },

  renderPlansCatalog: function() {
    const container = document.getElementById("plans-catalog-cards-container");
    if (!container || !AppState.plans || AppState.plans.length === 0) return;

    const isYearly = (AppState.billingCycle === "yearly");
    const freePlan = AppState.plans.find(p => p.nome.toLowerCase() === "free") || {
      id: "Plan_1", nome: "Free", prezzoMensile: "€ 0,00", prezzoAnnuale: "€ 0,00", bonusMegoin: 1, isAttivo: true, descrizione: "Accesso base per tutti gli avventurieri."
    };
    const paidPlans = AppState.plans.filter(p => p.nome.toLowerCase() !== "free");

    container.innerHTML = `
      <div class="hidden md:grid grid-cols-3 gap-4">
        ${paidPlans.map(p => {
          const isSilver = p.nome.toLowerCase().includes("silver");
          const price = isYearly ? p.prezzoAnnuale : p.prezzoMensile;
          const period = isYearly ? "/anno" : "/mese";
          return `
            <div onclick="AppEngine.openPlanModal('${p.id}')" class="bg-surface/90 hover:bg-surface active:scale-[0.98] transition-all rounded-2xl border ${p.isAttivo ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-xl' : (isSilver ? 'border-amber-400/60 ring-1 ring-amber-400/30' : 'border-white/10')} p-4 flex flex-col justify-between space-y-3 cursor-pointer relative group">
              ${p.isAttivo ? `<div class="absolute top-2.5 right-2.5"><span class="badge badge-xs badge-info font-black uppercase text-[8px] py-1.5 px-2">✨ ATTIVO</span></div>` : ''}
              <div class="space-y-1">
                <h4 class="font-black text-sm text-white group-hover:text-sky-400 transition-colors">${p.nome}</h4>
                <div class="text-lg font-black text-amber-300">${price} <span class="text-[10px] text-slate-400 font-normal">${period}</span></div>
              </div>
              <div class="space-y-1.5 pt-2 border-t border-white/5 text-[11px] text-slate-300">
                <div class="text-amber-400 font-bold">🪙 +${p.bonusMegoin} Megoin / mese</div>
                <div class="text-[10px] text-slate-400 line-clamp-2">${p.descrizione || ''}</div>
              </div>
              <button class="btn btn-xs ${p.isAttivo ? 'btn-outline border-white/20 text-slate-400 cursor-not-allowed' : 'btn-primary'} w-full font-bold">
                ${p.isAttivo ? 'In Uso' : 'Dettagli Piano ›'}
              </button>
            </div>
          `;
        }).join("")}
      </div>

      <div class="md:hidden bg-surface/90 rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <table class="w-full text-center border-collapse text-[10px]">
          <thead>
            <tr class="border-b border-white/10 bg-black/40">
              <th class="p-2 text-left text-[9px] font-bold uppercase text-slate-400">Piano</th>
              ${paidPlans.map(p => `
                <th onclick="AppEngine.openPlanModal('${p.id}')" class="p-2 cursor-pointer">
                  <div class="font-black text-white ${p.isAttivo ? 'text-sky-400' : ''}">${p.nome}</div>
                  <div class="text-amber-300">${isYearly ? p.prezzoAnnuale : p.prezzoMensile}</div>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr>
              <td class="p-2 text-left text-slate-300 font-semibold">🪙 Megoin</td>
              ${paidPlans.map(p => `<td class="p-2 font-bold text-amber-400">+${p.bonusMegoin}</td>`).join("")}
            </tr>
            <tr class="bg-black/30">
              <td class="p-2 text-left text-[9px] font-bold text-slate-400">Dettagli</td>
              ${paidPlans.map(p => `
                <td class="p-1.5">
                  <button onclick="AppEngine.openPlanModal('${p.id}')" class="btn btn-xs ${p.isAttivo ? 'btn-outline border-white/20' : 'btn-primary'} px-2 font-bold text-[8px]">
                    ${p.isAttivo ? 'In Uso' : 'Apri'}
                  </button>
                </td>
              `).join("")}
            </tr>
          </tbody>
        </table>
      </div>

      <div onclick="AppEngine.openPlanModal('${freePlan.id}')" class="bg-surface/60 hover:bg-surface active:scale-[0.99] transition-all p-3.5 rounded-2xl border ${freePlan.isAttivo ? 'border-sky-400/50' : 'border-white/5'} flex items-center justify-between cursor-pointer group mt-3">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-sm">⚓</div>
          <div>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-black text-white group-hover:text-sky-400 transition-colors">Piano Base (Free)</span>
              ${freePlan.isAttivo ? '<span class="badge badge-xs badge-info font-bold text-[8px] uppercase">IN USO</span>' : ''}
            </div>
            <p class="text-[10px] text-slate-400 mt-0.5">Include 1 Megoin mensile • Gratuito per sempre</p>
          </div>
        </div>
        <button class="btn btn-xs btn-ghost text-slate-400 group-hover:text-white font-bold text-[10px]">Dettagli ›</button>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  renderShop: function() {
    const sc = document.getElementById("shop-category-chips");
    if (sc && AppState.shop.categories.length > 0) {
      const all = ["tutti", ...AppState.shop.categories];
      sc.innerHTML = all.map(c => `
        <button onclick="AppEngine.setShopCategory('${c}')" class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${AppState.shop.activeCategory.toLowerCase() === c.toLowerCase() ? 'bg-sky-500 text-white' : 'bg-surface text-slate-400 border border-white/5'}">
          ${c.toUpperCase()}
        </button>
      `).join("");
    }
    this.renderShopProducts();
  },

  renderShopProducts: function() {
    const grid = document.getElementById("shop-products-grid");
    if (!grid) return;
    let list = AppState.shop.items;

    if (AppState.shop.activeCategory !== "tutti") {
      list = list.filter(p => p.categoria.toLowerCase() === AppState.shop.activeCategory.toLowerCase());
    }
    if (AppState.shop.searchQuery) {
      list = list.filter(p => p.nome.toLowerCase().includes(AppState.shop.searchQuery));
    }

    if (list.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 text-xs">Nessun articolo trovato.</div>`;
      return;
    }

    grid.innerHTML = list.map(p => `
      <div onclick="AppEngine.openShopDetail('${p.id}')" class="bg-surface rounded-2xl border border-white/5 flex flex-col justify-between overflow-hidden cursor-pointer active:scale-[0.98] transition-transform relative p-0 shadow-lg">
        ${p.isLocked ? `
          <div class="absolute inset-0 z-10 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center">
            <span class="text-xl mb-1">🔒</span>
            <span class="text-[9px] font-black text-amber-300 uppercase">Piano ${p.requiredPlan}</span>
          </div>
        ` : ''}
        <div class="h-36 md:h-44 w-full bg-slate-900 overflow-hidden relative">
          <img src="${p.mediaUrl}" class="w-full h-full object-cover">
          <span class="badge badge-xs ${p.isDigitale ? 'badge-info' : 'badge-neutral'} absolute top-2.5 left-2.5 text-[8px] uppercase font-bold">${p.tipo || 'Fisico'}</span>
        </div>
        <div class="p-3.5 space-y-2.5">
          <div>
            <div class="text-[9px] font-bold text-sky-400 uppercase">${p.categoria}</div>
            <h4 class="font-bold text-xs md:text-sm text-white line-clamp-1 mt-0.5">${p.nome}</h4>
          </div>
          <div class="pt-2 border-t border-white/5 flex items-center justify-between">
            <span class="text-xs md:text-sm font-black text-amber-300 text-glow-amber">${p.prezzoMegoin} 🪙</span>
            <span class="text-[10px] text-slate-400 font-bold">${p.isEsaurito ? 'Finito' : '€ ' + p.prezzoEuro}</span>
          </div>
        </div>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
  },

  renderRecipes: function() {
    const rc = document.getElementById("recipes-category-chips");
    if (rc && AppState.recipes.categories.length > 0) {
      const all = ["tutti", ...AppState.recipes.categories];
      rc.innerHTML = all.map(c => `
        <button onclick="AppEngine.setRecipeCategory('${c}')" class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${AppState.recipes.activeCategory.toLowerCase() === c.toLowerCase() ? 'bg-sky-500 text-white' : 'bg-surface text-slate-400 border border-white/5'}">
          ${c.toUpperCase()}
        </button>
      `).join("");
    }
    this.renderRecipesCards();
  },

  renderRecipesCards: function() {
    const grid = document.getElementById("recipes-grid");
    if (!grid) return;
    let list = AppState.recipes.items;

    if (AppState.recipes.activeCategory !== "tutti") {
      list = list.filter(r => r.categoria.toLowerCase() === AppState.recipes.activeCategory.toLowerCase());
    }
    if (AppState.recipes.searchQuery) {
      list = list.filter(r => r.piatto.toLowerCase().includes(AppState.recipes.searchQuery));
    }

    if (list.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 text-xs">Nessun piatto trovato.</div>`;
      return;
    }

    grid.innerHTML = list.map(r => `
      <div onclick="AppEngine.openRecipeDetail(${r.rowIndex})" class="bg-surface rounded-2xl border border-white/5 flex items-center justify-between p-3.5 cursor-pointer active:scale-[0.98] transition-transform shadow-lg">
        <div class="flex items-center space-x-3.5 overflow-hidden">
          <div class="w-12 h-12 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0">
            <img src="${r.mediaUrl}" class="w-full h-full object-cover">
          </div>
          <div class="overflow-hidden">
            <h4 class="font-bold text-xs md:text-sm text-white truncate">${r.piatto}</h4>
            <div class="text-[10px] text-slate-400 mt-0.5 truncate">${r.categoria} • ⏱️ ${r.tempo}</div>
          </div>
        </div>
        <span class="badge badge-sm badge-outline border-sky-400/40 text-sky-400 font-bold text-[10px] px-2.5">${r.costo}</span>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
  },

  renderTransactions: function(txs) {
    const c = document.getElementById("profile-transactions-container");
    if (!c) return;
    if (!txs || txs.length === 0) {
      c.innerHTML = `<div class="text-center py-4 text-slate-500">Nessuna transazione registrata.</div>`;
      return;
    }
    c.innerHTML = txs.map(t => `
      <div class="py-2.5 flex justify-between items-center">
        <div>
          <div class="font-bold text-white text-xs md:text-sm">${t.tipo}</div>
          <div class="text-[10px] text-slate-400">${t.data} • ${t.dettaglio}</div>
        </div>
        <div class="font-mono text-xs md:text-sm font-bold ${t.megoin.includes('+') ? 'text-emerald-400' : 'text-amber-400'}">
          ${t.megoin}
        </div>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
  },

  renderVault: function() {
    const c = document.getElementById("profile-vault-container");
    if (!c) return;
    if (AppState.vault.length === 0) {
      c.innerHTML = `<div class="text-center py-4 text-slate-500 text-xs">Nessun file scaricato finora.</div>`;
      return;
    }
    c.innerHTML = AppState.vault.map(v => `
      <div class="p-3 rounded-2xl bg-surface/80 border border-white/5 flex items-center justify-between">
        <div>
          <div class="font-bold text-white text-xs md:text-sm">${v.nome}</div>
          <div class="text-[10px] text-slate-400">${v.data}</div>
        </div>
        <a href="${v.url}" target="_blank" class="btn btn-xs btn-success font-bold px-3">Scarica</a>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
  }
};

// AVVIO APPLICAZIONE UNIFICATA
window.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
  AppEngine.init();
  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 200);
});
