// ============================================================================
// PROJECT: ESTIQATSY PWA - CLIENT APPLICATION ENGINE (VERSIONE 3.0)
// FILE: app.js
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
  activeTab: "home",
  shop: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  recipes: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  games: { series: [], genres: [], activeGenre: "tutti", searchQuery: "", session: null },
  carousel: { timer: null, index: 0, count: 0, isPaused: false },
  hudMode: "app", // 'app' | 'game'
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

// GESTORE SICURO DEL TASTO INDIETRO TELEGRAM (PREVIENE MEMORY LEAK)
let backButtonHandler = null;
function setupTelegramBackButton(screenName) {
  if (!tg || !tg.BackButton) return;

  if (backButtonHandler) {
    tg.BackButton.offClick(backButtonHandler);
    backButtonHandler = null;
  }

  const isSub = screenName.startsWith("subview-") || screenName === "view-gameplay";
  if (isSub) {
    tg.BackButton.show();
    backButtonHandler = () => {
      if (screenName === "subview-series-hub" || screenName === "view-gameplay") {
        AppRouter.navigate("games");
      } else if (screenName === "subview-shop-detail") {
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

    // Reset filtri e ricerca al cambio di scheda principale
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
    } else if (screenName === "games") {
      AppState.games.activeGenre = "tutti";
      AppState.games.searchQuery = "";
      const gInput = document.getElementById("games-search-input");
      if (gInput) gInput.value = "";
      AppRenderer.renderGames();
    }

    // Commutazione automatica dell'HUD Mobile: Gioco vs Navigazione
    const isGameplay = (screenName === "view-gameplay");
    AppRenderer.toggleHUDMode(isGameplay ? "game" : "app");

    const allScreens = [
      "view-home", "view-games", "view-gameplay", "view-shop", "view-recipes", "view-profile",
      "subview-series-hub", "subview-shop-detail", "subview-recipe-detail"
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
      // 1. Chiamata Profilo (che include già Piani e Prodotti Acquistati in 0ms)
      const p = await apiCall("profile");
      if (p && p.user) {
        AppState.user = p.user;
        AppState.allowedModules = p.allowedModules || AppState.allowedModules;
        AppState.plans = p.plans || [];
        AppRenderer.renderProfile(p.user);
        AppRenderer.renderPlans(AppState.plans);
      }

      // 2. Caricamento parallelo dei cataloghi nella RAM del telefono
      await Promise.allSettled([
        this.fetchShop(),
        this.fetchRecipes(),
        this.fetchGames(),
        this.syncTransactions(false)
      ]);

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
        eb.textContent = err.message || "Errore di connessione al Syndicate.";
        eb.classList.remove("hidden");
        document.getElementById("loading-retry-btn").classList.remove("hidden");
      }
    }
  },

  // NAVIGAZIONE DIRETTA AL CAVEAU DAL 4° KPI DELLA HOME
  openVaultSection: function() {
    AppRouter.navigate("profile");
    setTimeout(() => {
      const el = document.getElementById("profile-vault-container-card");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  },

  // CAROSELLO SAGHE AUTOMATICO (Ogni 5s con pausa touch)
  initCarousel: function() {
    const track = document.getElementById("carousel-track");
    const dotsBox = document.getElementById("carousel-dots-container");
    const outer = document.getElementById("carousel-outer-wrapper");
    if (!track || AppState.games.series.length === 0) return;

    const list = AppState.games.series;
    AppState.carousel.count = list.length;
    AppState.carousel.index = 0;

    track.innerHTML = list.map((s) => `
      <div class="min-w-full relative h-40 md:h-52 bg-slate-900 cursor-pointer overflow-hidden flex-none" onclick="AppEngine.openSeriesHub('${s.gameKey}')">
        <img src="${s.mediaUrl}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-[#090D16] via-black/40 to-transparent"></div>
        
        <!-- TAG: PARTITA IN CORSO -->
        ${s.hasActiveGame ? `
          <span class="badge badge-sm badge-warning font-black uppercase text-[8px] absolute top-3 left-3 shadow-lg flex items-center space-x-1 animate-pulse">
            <span>🔴</span> <span>PARTITA IN CORSO (EP. ${s.activeEpisodio})</span>
          </span>
        ` : `
          <span class="badge badge-sm badge-primary font-bold uppercase text-[8px] absolute top-3 left-3 shadow-md">
            ${s.tipologia}
          </span>
        `}

        <div class="absolute bottom-3 inset-x-3 flex items-end justify-between">
          <div>
            <h3 class="font-black text-sm text-white">${s.emoji} ${s.serie}</h3>
            <p class="text-[10px] text-slate-300 mt-0.5">${s.episodes.length} Capitoli Disponibili • Motore ${s.regole}</p>
          </div>
          <button class="btn btn-xs btn-primary font-bold px-3 shadow-lg shadow-sky-600/30">Esplora</button>
        </div>
      </div>
    `).join("");

    dotsBox.innerHTML = list.map((_, i) => `
      <span class="w-2 h-1.5 rounded-full transition-all ${i === 0 ? 'bg-sky-400 w-4' : 'bg-white/20'}" id="car-dot-${i}"></span>
    `).join("");

    // Pausa automatica al tocco o passaggio del mouse
    if (outer) {
      outer.onmouseenter = () => { AppState.carousel.isPaused = true; };
      outer.onmouseleave = () => { AppState.carousel.isPaused = false; };
      outer.ontouchstart = () => { AppState.carousel.isPaused = true; };
      outer.ontouchend = () => { 
        setTimeout(() => { AppState.carousel.isPaused = false; }, 3000); 
      };
    }

    if (AppState.carousel.timer) clearInterval(AppState.carousel.timer);
    AppState.carousel.timer = setInterval(() => {
      if (AppState.carousel.isPaused || AppState.carousel.count <= 1) return;
      AppState.carousel.index = (AppState.carousel.index + 1) % AppState.carousel.count;
      AppEngine.updateCarouselPosition();
    }, 5000);
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

  // GIOCHI E AVVENTURE
  fetchGames: async function() {
    try {
      const data = await apiCall("games");
      if (data && data.series) {
        AppState.games.series = data.series;
        AppState.games.genres = data.genres || [];
        AppRenderer.renderGames();
        this.initCarousel();
      }
    } catch (e) {}
  },

  setGameGenre: function(genre) {
    AppState.games.activeGenre = genre;
    AppRenderer.renderGames();
  },

  filterGames: function() {
    const input = document.getElementById("games-search-input");
    AppState.games.searchQuery = input ? input.value.trim().toLowerCase() : "";
    AppRenderer.renderGamesCards();
  },

  openSeriesHub: function(gameKey) {
    const saga = AppState.games.series.find(s => s.gameKey === gameKey);
    if (!saga) return;

    document.getElementById("hub-serie-title").textContent = saga.serie;
    document.getElementById("hub-serie-desc").textContent = saga.descrizione || "";
    document.getElementById("hub-serie-genre").textContent = saga.tipologia || "Avventura";
    
    const rBadge = document.getElementById("hub-serie-rules");
    if (rBadge) rBadge.textContent = saga.regole || "Rules 2";

    document.getElementById("hub-serie-img").src = saga.mediaUrl;

    const qBox = document.getElementById("hub-serie-quote");
    if (saga.citazione) {
      const cleanQ = String(saga.citazione).replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
      qBox.textContent = `"${cleanQ}" ${saga.autoreCitazione ? '(' + saga.autoreCitazione + ')' : ''}`;
      qBox.classList.remove("hidden");
    } else {
      qBox.classList.add("hidden");
    }

    const hb = document.getElementById("hub-hero-box");
    if (saga.eroeSalvato && saga.eroeSalvato.nomeEroe) {
      document.getElementById("hub-hero-name").textContent = `${saga.eroeSalvato.nomeEroe} (${saga.eroeSalvato.classe})`;
      document.getElementById("hub-hero-progress").textContent = `Capitoli superati: ${saga.eroeSalvato.maxEpisodio}`;
      hb.classList.remove("hidden");
    } else {
      hb.classList.add("hidden");
    }

    const el = document.getElementById("hub-episodes-list");
    el.innerHTML = (saga.episodes || []).map(ep => {
      let btnTxt = ep.canContinueFree ? "Continua (Gratis)" : `Gioca (${ep.costoMegoin} 🪙)`;
      return `
        <div class="p-3 rounded-2xl bg-surface border border-white/5 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-white flex items-center space-x-1.5">
              <span>${ep.emoji || '▶️'} Ep. ${ep.episodio}: ${ep.titolo}</span>
              ${ep.isCompleted ? '<span class="badge badge-xs badge-success font-bold">Vinto</span>' : ''}
            </div>
            <div class="text-[10px] text-slate-400 mt-0.5">${ep.canContinueFree ? 'Avanzamento Eroe' : (ep.costoMegoin === 0 ? 'Gratis' : `${ep.costoMegoin} Megoin`)}</div>
          </div>
          <button onclick="AppEngine.startGame('${saga.gameKey}', ${ep.episodio})" class="btn btn-xs btn-primary font-bold px-3">
            ${btnTxt}
          </button>
        </div>
      `;
    }).join("");

    AppRouter.navigate("subview-series-hub");
  },

  startGame: async function(gameKey, epNum) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("dice");
    try {
      const data = await apiCall("game_start", { gameKey: gameKey, episodio: epNum });
      if (data && data.success) {
        AppState.user.saldoMegoin = data.nuovoSaldoMegoin;
        AppRenderer.renderProfile(AppState.user);
        AppState.games.session = { gameKey, episodio: epNum, partitaId: data.partitaId };
        
        AppRenderer.updateGameHUD(data.statoEroe);
        AppRenderer.renderGameNode(data.nodoIniziale, data.statoEroe);
        AppRouter.navigate("view-gameplay");
      }
    } catch (err) {
      alert("❌ " + err.message);
    }
  },

  advanceNode: async function(targetId) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("hit");
    const sess = AppState.games.session;
    if (!sess) { AppRouter.navigate("games"); return; }
    try {
      const d = await apiCall("game_node", { gameKey: sess.gameKey, episodio: sess.episodio, nodeId: targetId, partitaId: sess.partitaId });
      if (d && d.nodo) {
        if (d.nodo.tipo === "Fine" || d.nodo.id.includes("END")) {
          if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("victory");
          if (window.confetti) confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
        }
        AppRenderer.updateGameHUD(d.statoEroe);
        AppRenderer.renderGameNode(d.nodo, d.statoEroe);
      }
    } catch (e) {
      alert("Errore mossa: " + e.message);
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
      btn.onclick = () => AppEngine.showUpgradeModal(`Piano ${item.requiredPlan}`, `Riservato agli affiliati con Piano ${item.requiredPlan}.`);
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

  // RICETTE E BARLADY
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
  },

  showUpgradeModal: function(title, desc) {
    document.getElementById("upgrade-modal-title").textContent = title;
    document.getElementById("upgrade-modal-desc").textContent = desc;
    const btn = document.getElementById("upgrade-modal-action-btn");
    btn.onclick = () => {
      document.getElementById("modal-plan-upgrade").close();
      AppRouter.navigate("home");
      setTimeout(() => {
        const el = document.getElementById("home-plans-container");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 150);
    };
    document.getElementById("modal-plan-upgrade").showModal();
  }
};

const AppRenderer = {
  // COMMUTATORE MODALITÀ HUD DINAMICO (App vs Gioco)
  toggleHUDMode: function(mode) {
    const isGame = (mode === "game");
    const la = document.getElementById("hud-left-app");
    const ra = document.getElementById("hud-right-app");
    const lg = document.getElementById("hud-left-game");
    const rg = document.getElementById("hud-right-game");

    if (la) la.classList.toggle("hidden", isGame);
    if (ra) ra.classList.toggle("hidden", isGame);
    if (lg) lg.classList.toggle("hidden", !isGame);
    if (rg) rg.classList.toggle("hidden", !isGame);
  },

  updateGameHUD: function(hero) {
    if (!hero) return;
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s("hud-hero-name", hero.nomeEroe || "Eroe");
    s("hud-hero-class", hero.classe || "Avventuriero");
    s("hud-game-gold", `${hero.oro || 0} 🟡`);
    s("hud-game-px", `${hero.px || 0} 🔷`);
  },

  renderProfile: function(u) {
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    
    // HUD Mobile (Navigazione)
    s("hud-user-avatar", (u.nome || "U").charAt(0).toUpperCase());
    s("hud-user-name", u.nome);
    s("hud-user-plan", u.piano);
    s("hud-user-megoin", `${u.saldoMegoin} 🪙`);
    s("hud-user-points", `${u.puntiFedelta} ⭐`);

    // Home Banner & 4 KPI
    s("home-username", u.nome);
    s("home-rank-points", u.puntiFedelta);
    s("home-megoin-card", `${u.saldoMegoin} 🪙`);
    s("home-punti-card", `${u.puntiFedelta} Pt`);
    s("home-purchases-count", u.prodottiAcquistati || 0);

    // Sidebar Desktop
    s("user-avatar-desk", (u.nome || "U").charAt(0).toUpperCase());
    s("user-name-desk", u.nome);
    s("user-plan-desk", `PIANO ${u.piano.toUpperCase()}`);
    s("user-megoin-desk", `${u.saldoMegoin} 🪙`);
    s("user-points-desk", `${u.puntiFedelta} Pt`);

    // Scheda Profilo
    s("profile-card-avatar", (u.nome || "U").charAt(0).toUpperCase());
    s("profile-card-name", u.nome);
    s("profile-card-username", u.username);
    s("profile-card-plan", `PIANO ${u.piano.toUpperCase()}`);
    s("profile-card-id", `ID: ${u.chatId}`);
    s("profile-card-megoin", `${u.saldoMegoin} 🪙`);
  },

  // VETRINA PIANI DI ABBONAMENTO (Con tag PIANO ATTIVO)
  renderPlans: function(plans) {
    const c = document.getElementById("home-plans-container");
    if (!c || !plans || plans.length === 0) return;

    c.innerHTML = plans.map(p => `
      <div class="bg-surface/90 rounded-2xl border ${p.isAttivo ? 'border-sky-400 ring-1 ring-sky-400/50 shadow-lg shadow-sky-500/10' : 'border-white/5'} p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
        ${p.isAttivo ? `
          <div class="absolute top-2.5 right-2.5">
            <span class="badge badge-xs badge-info font-black uppercase text-[8px] py-2 px-2.5">✨ PIANO ATTIVO</span>
          </div>
        ` : ''}
        
        <div class="space-y-1">
          <h4 class="font-black text-sm text-white">${p.nome}</h4>
          <div class="text-xs font-black text-amber-300">
            ${p.prezzoMensile || 'Gratuito'} <span class="text-[10px] text-slate-400 font-normal">/mese</span>
          </div>
          <p class="text-[10px] text-slate-300 leading-relaxed pt-1">${p.descrizione || ''}</p>
        </div>

        <div class="space-y-1.5 pt-2 border-t border-white/5 text-[10px] text-slate-300">
          <div class="text-amber-400 font-bold">🪙 +${p.bonusMegoin} Megoin al mese</div>
          <div class="text-slate-400">${p.perks.giochi ? '✅ Saghe RPG Incluse' : '❌ Saghe escluse'}</div>
          <div class="text-slate-400">${p.perks.shop ? '✅ Sconti Bottega Attivi' : '❌ Prezzi standard'}</div>
        </div>

        <div class="pt-1">
          ${p.isAttivo ? `
            <button disabled class="btn btn-xs btn-outline border-white/20 w-full text-slate-400 font-bold cursor-not-allowed">
              In Uso
            </button>
          ` : `
            <button onclick="AppEngine.showUpgradeModal('${p.nome}', 'Passa a ${p.nome} per ${p.prezzoMensile || 'tariffa indicata'}.')" class="btn btn-xs btn-primary w-full font-bold shadow-md shadow-sky-600/20">
              Passa a questo Piano
            </button>
          `}
        </div>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
  },

  renderGames: function() {
    const cc = document.getElementById("games-genre-chips");
    if (cc && AppState.games.genres.length > 0) {
      const all = ["tutti", ...AppState.games.genres];
      cc.innerHTML = all.map(g => `
        <button onclick="AppEngine.setGameGenre('${g}')" class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${AppState.games.activeGenre.toLowerCase() === g.toLowerCase() ? 'bg-sky-500 text-white' : 'bg-surface text-slate-400 border border-white/5'}">
          ${g.toUpperCase()}
        </button>
      `).join("");
    }
    this.renderGamesCards();
  },

  renderGamesCards: function() {
    const grid = document.getElementById("games-gallery-container");
    if (!grid) return;
    let list = AppState.games.series;

    if (AppState.games.activeGenre !== "tutti") {
      list = list.filter(s => s.tipologia.toLowerCase() === AppState.games.activeGenre.toLowerCase());
    }
    if (AppState.games.searchQuery) {
      list = list.filter(s => s.serie.toLowerCase().includes(AppState.games.searchQuery));
    }

    const hc = document.getElementById("home-games-count");
    if (hc) hc.textContent = AppState.games.series.length;

    if (list.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 text-xs">Nessuna saga trovata.</div>`;
      return;
    }

    grid.innerHTML = list.map(s => `
      <div onclick="AppEngine.openSeriesHub('${s.gameKey}')" class="bg-surface rounded-2xl border border-white/5 flex flex-col justify-between overflow-hidden cursor-pointer group shadow-lg active:scale-[0.98] transition-transform p-0 relative">
        <div class="h-40 md:h-48 w-full bg-slate-900 relative overflow-hidden">
          <img src="${s.mediaUrl}" class="w-full h-full object-cover rounded-t-2xl rounded-b-none">
          
          ${s.hasActiveGame ? `
            <span class="badge badge-xs badge-warning font-black uppercase text-[8px] absolute top-2.5 left-2.5 shadow-lg animate-pulse">
              🔴 PARTITA ATTIVA
            </span>
          ` : `
            <span class="badge badge-xs badge-primary absolute top-2.5 left-2.5 font-bold uppercase text-[8px]">${s.tipologia}</span>
          `}
          
          <span class="badge badge-xs badge-neutral absolute top-2.5 right-2.5 font-bold uppercase text-[8px]">${s.regole}</span>
        </div>
        <div class="p-4 space-y-3">
          <div>
            <h3 class="font-black text-sm text-white">${s.emoji} ${s.serie}</h3>
            <p class="text-[10px] text-slate-400 mt-0.5">${s.episodes.length} Capitoli Disponibili</p>
          </div>
          <div class="pt-2.5 border-t border-white/5 flex items-center justify-between">
            <span class="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Esplora Saga</span>
            <span class="btn btn-xs btn-primary px-3 font-bold shadow-md shadow-sky-600/30">Apri</span>
          </div>
        </div>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
  },

  renderGameNode: function(node, hero) {
    document.getElementById("gameplay-node-title").textContent = node.nome || "Avventura";
    document.getElementById("gameplay-node-text").textContent = node.testo || "";
    document.getElementById("gameplay-node-img").src = node.mediaUrl || "https://image.pollinations.ai/prompt/noir-italian-docks-night-cinematic?width=600&height=600&nologo=true";

    const qBox = document.getElementById("gameplay-node-quote");
    if (node.citazione && node.citazione !== "—") {
      const cleanQ = String(node.citazione).replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
      qBox.textContent = `"${cleanQ}" ${node.autoreCitazione ? '(' + node.autoreCitazione + ')' : ''}`;
      qBox.classList.remove("hidden");
    } else {
      qBox.classList.add("hidden");
    }

    if (hero) {
      document.getElementById("gameplay-pv-label").textContent = `${hero.pv}/${hero.pvMax}`;
      const bar = document.getElementById("gameplay-pv-bar");
      bar.value = hero.pv;
      bar.max = hero.pvMax;
    }

    const box = document.getElementById("gameplay-choices-container");
    const isCombat = (node.tipo === "NEMICO" || (node.id && node.id.includes("NEM_")));

    if (isCombat) {
      box.innerHTML = `
        <div class="grid grid-cols-2 gap-2 mt-2">
          <button onclick="AppEngine.advanceNode('${node.destSuccesso || 'SND_001'}')" class="btn btn-error btn-md text-xs font-black">
            ⚔️ Attacca Round
          </button>
          <button onclick="AppEngine.advanceNode('${node.destFallback || 'SND_001'}')" class="btn btn-outline border-white/20 btn-md text-xs font-bold">
            🏃 Fuggi
          </button>
        </div>
      `;
      return;
    }

    if (node.choices && node.choices.length > 0) {
      if (node.choices.length === 2) {
        box.innerHTML = `
          <div class="grid grid-cols-2 gap-2 mt-2">
            <button onclick="AppEngine.advanceNode('${node.choices[0].target}')" class="btn btn-primary btn-md text-xs font-bold leading-tight">
              ${node.choices[0].testo}
            </button>
            <button onclick="AppEngine.advanceNode('${node.choices[1].target}')" class="btn btn-primary btn-md text-xs font-bold leading-tight">
              ${node.choices[1].testo}
            </button>
          </div>
        `;
      } else {
        box.innerHTML = `
          <div class="space-y-2 mt-2">
            ${node.choices.map(b => `
              <button onclick="AppEngine.advanceNode('${b.target}')" class="btn btn-block btn-md btn-primary text-xs font-bold">
                ${b.testo}
              </button>
            `).join("")}
          </div>
        `;
      }
    } else {
      box.innerHTML = `
        <button onclick="AppRouter.navigate('games')" class="btn btn-block btn-md btn-outline border-white/20 text-xs font-bold mt-2">
          🏠 Torna alle Saghe
        </button>
      `;
    }
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
        <div class="h-32 md:h-40 w-full bg-slate-900 overflow-hidden relative">
          <img src="${p.mediaUrl}" class="w-full h-full object-cover rounded-t-2xl rounded-b-none">
          <span class="badge badge-xs ${p.isDigitale ? 'badge-info' : 'badge-neutral'} absolute top-2.5 left-2.5 text-[8px] uppercase font-bold">${p.tipo || 'Fisico'}</span>
        </div>
        <div class="p-3.5 space-y-2.5">
          <div>
            <div class="text-[9px] font-bold text-sky-400 uppercase">${p.categoria}</div>
            <h4 class="font-bold text-xs text-white line-clamp-1 mt-0.5">${p.nome}</h4>
          </div>
          <div class="pt-2 border-t border-white/5 flex items-center justify-between">
            <span class="text-xs font-black text-amber-300 text-glow-amber">${p.prezzoMegoin} 🪙</span>
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
            <h4 class="font-bold text-xs text-white truncate">${r.piatto}</h4>
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
          <div class="font-bold text-white text-xs">${t.tipo}</div>
          <div class="text-[10px] text-slate-400">${t.data} • ${t.dettaglio}</div>
        </div>
        <div class="font-mono text-xs font-bold ${t.megoin.includes('+') ? 'text-emerald-400' : 'text-amber-400'}">
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
      c.innerHTML = `<div class="text-center py-4 text-slate-500">Nessun file scaricato finora.</div>`;
      return;
    }
    c.innerHTML = AppState.vault.map(v => `
      <div class="p-3 rounded-2xl bg-surface/80 border border-white/5 flex items-center justify-between">
        <div>
          <div class="font-bold text-white text-xs">${v.nome}</div>
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
