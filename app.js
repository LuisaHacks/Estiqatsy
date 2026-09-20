// ============================================================================
// PROJECT: ESTIQATSY PWA - CLIENT APPLICATION ENGINE (VERSIONE 4.0)
// FILE: app.js (MODULO GENERALE: DASHBOARD, BOTTEGA, RICETTARIO & PIANI)
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
  vault: []
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

// GESTORE TASTO INDIETRO NATIVO TELEGRAM (SOLO PER SUBVIEW ATTIVE)
let backButtonHandler = null;
function setupTelegramBackButton(screenName) {
  if (!tg || !tg.BackButton) return;

  if (backButtonHandler) {
    tg.BackButton.offClick(backButtonHandler);
    backButtonHandler = null;
  }

  const isSub = screenName === "subview-shop-detail" || screenName === "subview-recipe-detail";
  if (isSub) {
    tg.BackButton.show();
    backButtonHandler = () => {
      if (screenName === "subview-shop-detail") {
        AppRouter.navigate("shop");
      } else if (screenName === "subview-recipe-detail") {
        AppRouter.navigate("recipes");
      } else {
        AppRouter.navigate("home");
      }
    };
    tg.BackButton.onClick(backButtonHandler);
  } else {
    tg.BackButton.hide();
  }
}

const AppRouter = {
  navigate: function(screenName) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

    // Se l'utente tocca giochi dal menu o dalla sidebar, reindirizza alla webapp RPG dedicata
    if (screenName === "games" || screenName === "view-games") {
      window.location.href = "game.html";
      return;
    }

    // Verifica Hard Locking del modulo
    const baseModule = screenName.replace("view-", "").replace("subview-", "").split("-")[0];
    if (AppState.allowedModules && AppState.allowedModules[baseModule] === false) {
      AppRouter.navigate("home");
      AppEngine.openPlansCatalogModal();
      return;
    }

    // Reset filtri di ricerca al cambio di scheda principale
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
      "subview-shop-detail", "subview-recipe-detail"
    ];

    let targetId = screenName;
    if (!targetId.startsWith("view-") && !targetId.startsWith("subview-")) {
      targetId = "view-" + screenName;
    }

    allScreens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", id !== targetId);
    });

    const scrollArea = document.getElementById("app-main-scroll");
    if (scrollArea) scrollArea.scrollTop = 0;

    const baseTab = screenName.replace("view-", "").replace("subview-", "").split("-")[0];
    document.querySelectorAll(".nav-tab").forEach(btn => {
      const isActive = btn.dataset.tab === baseTab;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("text-slate-400", !isActive);
    });

    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      const isActive = btn.dataset.tab === baseTab;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("bg-white/5", isActive);
      btn.classList.toggle("text-slate-300", !isActive);
    });

    setupTelegramBackButton(screenName);

    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 15);
  }
};

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

const AppEngine = {
  init: async function() {
    this.loadVault();

    try {
      // 1. Chiamata Profilo (include Piani da 👑Plans e Moduli Autorizzati)
      const p = await apiCall("profile");
      if (p && p.user) {
        AppState.user = p.user;
        AppState.allowedModules = p.allowedModules || AppState.allowedModules;
        AppState.plans = p.plans || [];
        AppRenderer.renderProfile(p.user);
        AppRenderer.applyHardLocking(AppState.allowedModules);
      }

      // 2. Caricamento rapido parallelo solo dei moduli dell'App Generale
      await Promise.allSettled([
        this.fetchShop(),
        this.fetchRecipes(),
        this.syncTransactions(false)
      ]);

      // Avvia il carosello promozionale
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

  // APERTURA MODALE COMPARAZIONE PIANI (LIVELLO 1)
  openPlansCatalogModal: function() {
    AppRenderer.renderPlansCatalog();
    const modal = document.getElementById("modal-plans-catalog");
    if (modal) modal.showModal();
  },

  // SWITCH CICLO FATTURAZIONE (Mensile / Annuale)
  setBillingCycle: function(cycle) {
    AppState.billingCycle = cycle;
    const btnM = document.getElementById("billing-toggle-monthly");
    const btnY = document.getElementById("billing-toggle-yearly");

    const isYearly = (cycle === "yearly");
    if (btnM) {
      btnM.className = `flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${!isYearly ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400'}`;
    }
    if (btnY) {
      btnY.className = `flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${isYearly ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400'} flex items-center justify-center space-x-1`;
    }

    AppRenderer.renderPlansCatalog();
  },

  // APERTURA MODALE DETTAGLIO PIANO & CHECKOUT (LIVELLO 2)
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
    
    // Iniezione dinamica dei vantaggi
    const perksBox = document.getElementById("plan-modal-perks-list");
    if (perksBox) {
      let htmlPerks = `
        <div class="flex items-center space-x-2 text-amber-300 font-bold pb-1.5 border-b border-white/5">
          <span>🪙</span> <span>+${plan.bonusMegoin} Megoin al mese inclusi</span>
        </div>
      `;

      if (plan.perks && plan.perks.length > 0) {
        htmlPerks += plan.perks.map(pk => `
          <div class="flex items-center space-x-2 ${pk.enabled ? 'text-slate-200' : 'text-slate-500'}">
            <span>${pk.enabled ? '✅' : '❌'}</span>
            <span>${pk.label}</span>
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
        actBtn.onclick = () => {
          alert(`Reindirizzamento al checkout per il piano ${plan.nome} in corso...`);
        };
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

  // CAROSELLO IN EVIDENZA (PROMUOVE GIOCHI, BOTTEGA E RICETTE)
  initCarousel: function() {
    const track = document.getElementById("carousel-track");
    const dotsBox = document.getElementById("carousel-dots-container");
    const outer = document.getElementById("carousel-outer-wrapper");
    if (!track) return;

    // Slide promozionali stabili con reindirizzamenti coerenti
    const promoSlides = [
      {
        badge: "AVVENTURE RPG",
        titolo: "ViareGTA & Paul Sindaco",
        sottotitolo: "Vivi le saghe noir tra i canali e la pineta a colpi di D20",
        btnText: "Gioca Ora ➔",
        action: () => { window.location.href = "game.html"; },
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

const AppRenderer = {
  // HARD LOCKING (NASCONDE I MODULI NON PREVISTI DAL PIANO)
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
    
    // Home Banner
    s("home-username", u.nome);
    s("home-rank-points", u.puntiFedelta);
    s("home-plan-badge", `PIANO ${(u.piano || "Free").toUpperCase()}`);

    // Home KPI
    s("home-megoin-card", `${u.saldoMegoin} 🪙`);
    s("home-punti-card", `${u.puntiFedelta} Pt`);
    s("home-purchases-count", u.prodottiAcquistati || 0);

    const gc = document.getElementById("home-games-count");
    if (gc) gc.textContent = "ATTIVE ➔";

    // Sidebar Desktop
    s("user-avatar-desk", (u.nome || "U").charAt(0).toUpperCase());
    s("user-name-desk", u.nome);
    s("user-plan-desk", `PIANO ${(u.piano || "Free").toUpperCase()}`);
    s("user-megoin-desk", `${u.saldoMegoin} 🪙`);
    s("user-points-desk", `${u.puntiFedelta} Pt`);

    // Scheda Profilo
    s("profile-card-avatar", (u.nome || "U").charAt(0).toUpperCase());
    s("profile-card-name", u.nome);
    s("profile-card-username", u.username);
    s("profile-card-plan", `PIANO ${(u.piano || "Free").toUpperCase()}`);
    s("profile-card-id", `ID: ${u.chatId}`);
    s("profile-card-megoin", `${u.saldoMegoin} 🪙`);
    s("profile-card-points", `${u.puntiFedelta} Pt`);

    // Azioni Profilo
    s("profile-action-plan-name", `Piano: ${(u.piano || "Free").toUpperCase()}`);
    s("profile-action-vault-count", AppState.vault.length);
  },

  // RENDERER CATALOGO PIANI (CON RIMOZIONE DELLA RIGA "RISPARMIO" SU MOBILE)
  renderPlansCatalog: function() {
    const container = document.getElementById("plans-catalog-cards-container");
    if (!container || !AppState.plans || AppState.plans.length === 0) return;

    const isYearly = (AppState.billingCycle === "yearly");
    const freePlan = AppState.plans.find(p => p.nome.toLowerCase() === "free") || {
      id: "Plan_1", nome: "Free", prezzoMensile: "€ 0,00", prezzoAnnuale: "€ 0,00", bonusMegoin: 1, isAttivo: true, descrizione: "Accesso base per tutti gli avventurieri."
    };
    const paidPlans = AppState.plans.filter(p => p.nome.toLowerCase() !== "free");

    container.innerHTML = `
      <!-- 1. VISTA DESKTOP: 3 COLONNE SIMMETRICHE -->
      <div class="hidden md:grid grid-cols-3 gap-4">
        ${paidPlans.map(p => {
          const isSilver = p.nome.toLowerCase().includes("silver");
          const price = isYearly ? p.prezzoAnnuale : p.prezzoMensile;
          const period = isYearly ? "/anno" : "/mese";
          return `
            <div onclick="AppEngine.openPlanModal('${p.id}')" class="bg-surface/90 hover:bg-surface active:scale-[0.98] transition-all rounded-2xl border ${p.isAttivo ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-xl' : (isSilver ? 'border-amber-400/60 ring-1 ring-amber-400/30' : 'border-white/10')} p-4 flex flex-col justify-between space-y-3 cursor-pointer relative group">
              ${p.isAttivo ? `
                <div class="absolute top-2.5 right-2.5">
                  <span class="badge badge-xs badge-info font-black uppercase text-[8px] py-1.5 px-2">✨ ATTIVO</span>
                </div>
              ` : (isSilver ? `
                <div class="absolute top-2.5 right-2.5">
                  <span class="badge badge-xs badge-warning font-black uppercase text-[8px] py-1.5 px-2">⭐ CONSIGLIATO</span>
                </div>
              ` : '')}
              
              <div class="space-y-1">
                <h4 class="font-black text-sm text-white group-hover:text-sky-400 transition-colors">${p.nome}</h4>
                <div class="text-lg font-black text-amber-300">
                  ${price} <span class="text-[10px] text-slate-400 font-normal">${period}</span>
                </div>
                ${isYearly && p.risparmio ? `
                  <div class="text-[10px] text-emerald-400 font-bold">Risparmi ${p.risparmio} (${p.risparmi})</div>
                ` : ''}
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

      <!-- 2. VISTA MOBILE: MATRICE SINTETICA (SENZA RIGA RIDONDANTE DEL RISPARMIO) -->
      <div class="md:hidden bg-surface/90 rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <table class="w-full text-center border-collapse">
          <thead>
            <tr class="border-b border-white/10 bg-black/40">
              <th class="p-2 text-left text-[9px] font-bold uppercase text-slate-400">Piano</th>
              ${paidPlans.map(p => {
                const price = isYearly ? p.prezzoAnnuale : p.prezzoMensile;
                return `
                  <th onclick="AppEngine.openPlanModal('${p.id}')" class="p-2 cursor-pointer">
                    <div class="text-xs font-black text-white ${p.isAttivo ? 'text-sky-400' : ''}">${p.nome}</div>
                    <div class="text-[10px] font-bold text-amber-300">${price}</div>
                    ${p.isAttivo ? '<span class="badge badge-xs badge-info text-[7px] font-bold">ATTIVO</span>' : ''}
                  </th>
                `;
              }).join("")}
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-[10px]">
            <tr>
              <td class="p-2 text-left text-slate-300 font-semibold">🪙 Megoin / mese</td>
              ${paidPlans.map(p => `<td class="p-2 font-bold text-amber-400">+${p.bonusMegoin}</td>`).join("")}
            </tr>
            <tr>
              <td class="p-2 text-left text-slate-300 font-semibold">🎮 Saghe RPG</td>
              ${paidPlans.map(p => {
                const has = p.perks ? p.perks.some(x => x.key.includes("game") && x.enabled) : true;
                return `<td class="p-2">${has ? '✅' : '❌'}</td>`;
              }).join("")}
            </tr>
            <tr>
              <td class="p-2 text-left text-slate-300 font-semibold">🏪 Sconti Bottega</td>
              ${paidPlans.map(p => {
                const has = p.perks ? p.perks.some(x => x.key.includes("shop") && x.enabled) : true;
                return `<td class="p-2">${has ? '✅' : '❌'}</td>`;
              }).join("")}
            </tr>
            <!-- NOTA: La riga "Risparmio" è stata eliminata per alleggerire la visualizzazione mobile -->
            <tr class="bg-black/30">
              <td class="p-2 text-left text-[9px] font-bold text-slate-400">Dettagli</td>
              ${paidPlans.map(p => `
                <td class="p-1.5">
                  <button onclick="AppEngine.openPlanModal('${p.id}')" class="btn btn-xs ${p.isAttivo ? 'btn-outline border-white/20 text-slate-400' : 'btn-primary'} px-2 font-bold text-[8px]">
                    ${p.isAttivo ? 'In Uso' : 'Apri'}
                  </button>
                </td>
              `).join("")}
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3. PIANO FREE STANDALONE -->
      <div onclick="AppEngine.openPlanModal('${freePlan.id}')" class="bg-surface/60 hover:bg-surface active:scale-[0.99] transition-all p-3.5 rounded-2xl border ${freePlan.isAttivo ? 'border-sky-400/50' : 'border-white/5'} flex items-center justify-between cursor-pointer group">
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
          <img src="${p.mediaUrl}" class="w-full h-full object-cover rounded-t-2xl rounded-b-none">
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

// AVVIO APPLICAZIONE
window.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
  AppEngine.init();
  setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 200);
});
