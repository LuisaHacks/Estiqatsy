// ============================================================================
// PROJECT: ESTIQATSY PWA - CLIENT APPLICATION ENGINE (VERSIONE 3.6)
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
  billingCycle: "monthly", // 'monthly' | 'yearly'
  activeTab: "home",
  shop: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  recipes: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  games: { series: [], genres: [], activeGenre: "tutti", searchQuery: "", session: null },
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

// GESTORE SICURO DEL TASTO INDIETRO NATIVO TELEGRAM (PREVIENE MEMORY LEAK)
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
        if (typeof SoundEngine !== "undefined") SoundEngine.stopBgm();
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

    // Verifica Hard Locking: se il modulo non è consentito, torna a Home e apri modale piani
    const baseModule = screenName.replace("view-", "").replace("subview-", "").split("-")[0];
    if (AppState.allowedModules && AppState.allowedModules[baseModule] === false) {
      AppRouter.navigate("home");
      AppEngine.openPlansCatalogModal();
      return;
    }

    // Regia Audio sui cambi di sezione
    if (typeof SoundEngine !== "undefined") {
      if (screenName === "view-home" || screenName === "view-profile") {
        SoundEngine.stopBgm();
      } else if (screenName === "subview-series-hub") {
        SoundEngine.playBgm("intro");
      }
    }

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
      // 1. Chiamata Profilo (include Piani da 👑Plans, Prodotti Acquistati e Moduli Autorizzati)
      const p = await apiCall("profile");
      if (p && p.user) {
        AppState.user = p.user;
        AppState.allowedModules = p.allowedModules || AppState.allowedModules;
        AppState.plans = p.plans || [];
        AppRenderer.renderProfile(p.user);
        AppRenderer.applyHardLocking(AppState.allowedModules);
      }

      // 2. Caricamento asincrono parallelo in RAM
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

  // APERTURA MODALE LIVELLO 1: CATALOGO E COMPARAZIONE PIANI
  openPlansCatalogModal: function() {
    AppRenderer.renderPlansCatalog();
    const modal = document.getElementById("modal-plans-catalog");
    if (modal) modal.showModal();
  },

  // SWITCH SAAS CICLO DI FATTURAZIONE (Mensile / Annuale)
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

  // APERTURA MODALE LIVELLO 2: SCHEDA DETTAGLIATA PIANO & CHECKOUT
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
    
    // Iniezione dinamica dei vantaggi estratti dal foglio 👑Plans
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
          alert(`Reindirizzamento al checkout sicuro per il piano ${plan.nome} in corso...`);
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

  // CAROSELLO SAGHE (Ogni 5s con pausa touch)
  initCarousel: function() {
    const track = document.getElementById("carousel-track");
    const dotsBox = document.getElementById("carousel-dots-container");
    const outer = document.getElementById("carousel-outer-wrapper");
    if (!track || AppState.games.series.length === 0) return;

    const list = AppState.games.series;
    AppState.carousel.count = list.length;
    AppState.carousel.index = 0;

    track.innerHTML = list.map((s) => `
      <div class="min-w-full relative h-44 md:h-64 bg-slate-900 cursor-pointer overflow-hidden flex-none" onclick="AppEngine.openSeriesHub('${s.gameKey}')">
        <img src="${s.mediaUrl}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-[#090D16] via-black/40 to-transparent"></div>
        
        <!-- TAG: PARTITA IN CORSO -->
        ${s.hasActiveGame ? `
          <span class="badge badge-sm badge-warning font-black uppercase text-[8px] md:text-[10px] absolute top-3.5 left-3.5 shadow-lg flex items-center space-x-1 animate-pulse">
            <span>🔴</span> <span>PARTITA IN CORSO (EP. ${s.activeEpisodio})</span>
          </span>
        ` : `
          <span class="badge badge-sm badge-primary font-bold uppercase text-[8px] md:text-[10px] absolute top-3.5 left-3.5 shadow-md">
            ${s.tipologia}
          </span>
        `}

        <div class="absolute bottom-4 inset-x-4 flex items-end justify-between">
          <div>
            <h3 class="font-black text-sm md:text-lg text-white">${s.emoji} ${s.serie}</h3>
            <p class="text-[10px] md:text-xs text-slate-300 mt-0.5">${s.episodes.length} Capitoli Disponibili • Motore ${s.regole}</p>
          </div>
          <button class="btn btn-xs md:btn-sm btn-primary font-bold px-3 shadow-lg shadow-sky-600/30">Esplora</button>
        </div>
      </div>
    `).join("");

    dotsBox.innerHTML = list.map((_, i) => `
      <span class="w-2 h-1.5 rounded-full transition-all ${i === 0 ? 'bg-sky-400 w-4' : 'bg-white/20'}" id="car-dot-${i}"></span>
    `).join("");

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

  // ==========================================================================
  // GIOCHI, AVVENTURE & REGIA AUDIO BGM/SFX
  // ==========================================================================
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

    if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("intro");

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
        <div class="p-3.5 rounded-2xl bg-surface border border-white/5 flex items-center justify-between">
          <div>
            <div class="text-xs md:text-sm font-bold text-white flex items-center space-x-1.5">
              <span>${ep.emoji || '▶️'} Ep. ${ep.episodio}: ${ep.titolo}</span>
              ${ep.isCompleted ? '<span class="badge badge-xs badge-success font-bold">Vinto</span>' : ''}
            </div>
            <div class="text-[10px] md:text-xs text-slate-400 mt-0.5">${ep.canContinueFree ? 'Avanzamento Eroe' : (ep.costoMegoin === 0 ? 'Gratis' : `${ep.costoMegoin} Megoin`)}</div>
          </div>
          <button onclick="AppEngine.startGame('${saga.gameKey}', ${ep.episodio})" class="btn btn-xs md:btn-sm btn-primary font-bold px-3.5">
            ${btnTxt}
          </button>
        </div>
      `;
    }).join("");

    AppRouter.navigate("subview-series-hub");
  },

  startGame: async function(gameKey, epNum) {
    if (typeof SoundEngine !== "undefined") {
      SoundEngine.playSfx("insert_coin");
      SoundEngine.playBgm("exploration");
    }

    try {
      const data = await apiCall("game_start", { gameKey: gameKey, episodio: epNum });
      if (data && data.success) {
        AppState.user.saldoMegoin = data.nuovoSaldoMegoin;
        AppRenderer.renderProfile(AppState.user);
        AppState.games.session = { gameKey, episodio: epNum, partitaId: data.partitaId };
        
        AppRenderer.renderGameNode(data.nodoIniziale, data.statoEroe);
        AppRouter.navigate("view-gameplay");
      }
    } catch (err) {
      alert("❌ " + err.message);
    }
  },

  advanceNode: async function(targetId) {
    const sess = AppState.games.session;
    if (!sess) { AppRouter.navigate("games"); return; }

    try {
      const d = await apiCall("game_node", { gameKey: sess.gameKey, episodio: sess.episodio, nodeId: targetId, partitaId: sess.partitaId });
      if (d && d.nodo) {
        // Regia Sonora reattiva sul cambio di nodo
        if (typeof SoundEngine !== "undefined") {
          if (d.nodo.tipo === "NEMICO") {
            SoundEngine.playSfx("combat_start");
            SoundEngine.duck();
            SoundEngine.playBgm("combat");
          } else if (d.nodo.id === "SND_000") {
            SoundEngine.playBgm("emporio");
          } else if (d.nodo.tipo === "Fine" || d.nodo.id.includes("END")) {
            SoundEngine.playSfx("victory");
            SoundEngine.playBgm("victory");
            if (window.confetti) confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
          } else if (d.statoEroe && d.statoEroe.pv <= 0) {
            SoundEngine.playSfx("defeat");
            SoundEngine.playBgm("defeat");
          } else {
            SoundEngine.playSfx("click");
            SoundEngine.playBgm("exploration");
          }
        }
        AppRenderer.renderGameNode(d.nodo, d.statoEroe);
      }
    } catch (e) {
      alert("Errore mossa: " + e.message);
    }
  },

  // AZIONI DI COMBATTIMENTO E TATTICHE IN-GAME (action=game_action)
  battleAttackRound: async function(enemyId) {
    const sess = AppState.games.session;
    if (!sess) return;

    try {
      const res = await apiCall("game_action", {
        subAction: "attack",
        enemyId: enemyId,
        gameKey: sess.gameKey,
        episodio: sess.episodio
      });

      if (res && res.combatLog) {
        if (typeof SoundEngine !== "undefined") {
          if (res.combatLog.isCrit) {
            SoundEngine.playSfx("crit_hit");
            SoundEngine.duck();
          } else if (res.combatLog.isHit) {
            SoundEngine.playSfx("hit");
          } else {
            SoundEngine.playSfx("click");
          }

          if (res.combatLog.heroDead) {
            SoundEngine.playSfx("defeat");
            SoundEngine.playBgm("defeat");
          }
        }
        AppRenderer.renderCombatRoundResult(res.combatLog, res.nodo, res.statoEroe);
      } else if (res && res.nodo) {
        // Nemico abbattuto: transizione automatica allo snodo di vittoria
        if (typeof SoundEngine !== "undefined") {
          SoundEngine.playSfx("victory");
          SoundEngine.playBgm("exploration");
        }
        AppRenderer.renderGameNode(res.nodo, res.statoEroe);
      }
    } catch (e) {
      alert("Errore attacco: " + e.message);
    }
  },

  battleFlee: async function() {
    const sess = AppState.games.session;
    if (!sess) return;

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("flee");

    try {
      const res = await apiCall("game_action", {
        subAction: "flee",
        gameKey: sess.gameKey,
        episodio: sess.episodio
      });

      if (res && res.nodo) {
        // Fuga riuscita
        if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("exploration");
        AppRenderer.renderGameNode(res.nodo, res.statoEroe);
      } else if (res && res.fleeFailed) {
        alert("💨 Fuga fallita! Inciampi e subisci 3 danni d'opportunità.");
        if (res.statoEroe) AppRenderer.updateHeroVitals(res.statoEroe);
      }
    } catch (e) {
      alert("Errore fuga: " + e.message);
    }
  },

  battleBribe: async function(drugName) {
    const sess = AppState.games.session;
    if (!sess) return;

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("drug");

    try {
      const res = await apiCall("game_action", {
        subAction: "bribe",
        drug: drugName,
        gameKey: sess.gameKey,
        episodio: sess.episodio
      });

      if (res && res.nodo) {
        alert("🟡 Corruzione riuscita! La sentinella accetta la dose e si fa da parte.");
        if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("exploration");
        AppRenderer.renderGameNode(res.nodo, res.statoEroe);
      }
    } catch (e) {
      alert("Errore corruzione: " + e.message);
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
  // HARD LOCKING: NASCONDE I MODULI NON PREVISTI DAL PIANO NEL FOOTER E NELLA SIDEBAR
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

    // Home 4 KPI
    s("home-megoin-card", `${u.saldoMegoin} 🪙`);
    s("home-punti-card", `${u.puntiFedelta} Pt`);
    s("home-purchases-count", u.prodottiAcquistati || 0);

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

  // RENDERER MODALE LIVELLO 1: CATALOGO E COMPARAZIONE PIANI (Con SaaS Switch)
  renderPlansCatalog: function() {
    const container = document.getElementById("plans-catalog-cards-container");
    if (!container || !AppState.plans || AppState.plans.length === 0) return;

    const isYearly = (AppState.billingCycle === "yearly");
    const freePlan = AppState.plans.find(p => p.nome.toLowerCase() === "free") || {
      id: "Plan_1", nome: "Free", prezzoMensile: "€ 0,00", prezzoAnnuale: "€ 0,00", bonusMegoin: 1, isAttivo: true, descrizione: "Accesso base per tutti gli avventurieri."
    };
    const paidPlans = AppState.plans.filter(p => p.nome.toLowerCase() !== "free");

    container.innerHTML = `
      <!-- 1. VISTA DESKTOP: 3 COLONNE SIMMETRICHE SULLA STESSA RIGA -->
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

      <!-- 2. VISTA MOBILE (OPZIONE B): MATRICE COMPARATIVA SINTETICA -->
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
            ${isYearly ? `
              <tr class="bg-emerald-950/20">
                <td class="p-2 text-left text-emerald-400 font-semibold">🎉 Risparmio</td>
                ${paidPlans.map(p => `<td class="p-2 font-bold text-emerald-400">${p.risparmio || '0%'}</td>`).join("")}
              </tr>
            ` : ''}
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

      <!-- 3. PIANO FREE STANDALONE (FUORI CONFRONTO, SOTTO A TUTTA LARGHEZZA) -->
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
        <div class="h-44 md:h-52 w-full bg-slate-900 relative overflow-hidden">
          <img src="${s.mediaUrl}" class="w-full h-full object-cover rounded-t-2xl rounded-b-none">
          
          ${s.hasActiveGame ? `
            <span class="badge badge-xs md:badge-sm badge-warning font-black uppercase text-[8px] md:text-[9px] absolute top-3 left-3 shadow-lg animate-pulse">
              🔴 PARTITA ATTIVA
            </span>
          ` : `
            <span class="badge badge-xs md:badge-sm badge-primary absolute top-3 left-3 font-bold uppercase text-[8px] md:text-[9px]">${s.tipologia}</span>
          `}
          
          <span class="badge badge-xs md:badge-sm badge-neutral absolute top-3 right-3 font-bold uppercase text-[8px] md:text-[9px]">${s.regole}</span>
        </div>
        <div class="p-4 space-y-3">
          <div>
            <h3 class="font-black text-sm md:text-base text-white">${s.emoji} ${s.serie}</h3>
            <p class="text-[10px] md:text-xs text-slate-400 mt-0.5">${s.episodes.length} Capitoli Disponibili</p>
          </div>
          <div class="pt-2.5 border-t border-white/5 flex items-center justify-between">
            <span class="text-[10px] md:text-xs font-bold text-sky-400 uppercase tracking-wider">Esplora Saga</span>
            <span class="btn btn-xs md:btn-sm btn-primary px-3.5 font-bold shadow-md shadow-sky-600/30">Apri</span>
          </div>
        </div>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
  },

  // RENDERING VISUAL NOVEL & DUELLI (CON DOCK EROE E MODIFICATORI D20)
  renderGameNode: function(node, hero) {
    document.getElementById("gameplay-node-title").textContent = node.nome || "Avventura";
    document.getElementById("gameplay-node-text").textContent = node.testo || "";
    document.getElementById("gameplay-node-img").src = node.mediaUrl || "https://image.pollinations.ai/prompt/noir-italian-docks-night-cinematic?width=600&height=600&nologo=true";

    const badge = document.getElementById("gameplay-node-badge");
    if (badge) badge.textContent = node.tipo || "SNODO";

    const qBox = document.getElementById("gameplay-node-quote");
    if (node.citazione && node.citazione !== "—") {
      const cleanQ = String(node.citazione).replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
      qBox.textContent = `"${cleanQ}" ${node.autoreCitazione ? '(' + node.autoreCitazione + ')' : ''}`;
      qBox.classList.remove("hidden");
    } else {
      qBox.classList.add("hidden");
    }

    if (hero) {
      AppRenderer.updateHeroVitals(hero);
    }

    const box = document.getElementById("gameplay-choices-container");
    if (!box) return;

    const isCombat = (node.tipo === "NEMICO" || (node.id && node.id.includes("NEM_")));

    // SCHERMATA COMBATTIMENTO
    if (isCombat) {
      const enemyPV = node.pv || 20;
      let htmlCombat = `
        <!-- Scheda Minaccia Nemico -->
        <div class="p-3.5 rounded-2xl bg-black/40 border border-rose-500/30 space-y-2 mb-3">
          <div class="flex justify-between items-center text-xs">
            <span class="font-black text-white flex items-center space-x-1.5">
              <span>👾</span> <span>${node.nome}</span>
            </span>
            <span class="badge badge-xs badge-error font-bold">${node.categoria || 'Nemico'}</span>
          </div>
          <div class="flex justify-between text-[10px] font-mono text-slate-400">
            <span>Salute Nemico</span> <span>${enemyPV} PV</span>
          </div>
          <progress class="progress progress-error w-full h-2" value="${enemyPV}" max="${enemyPV}"></progress>
        </div>

        <!-- Plancia Azioni Tattiche di Guerra -->
        <div class="grid grid-cols-2 gap-2">
          <button onclick="AppEngine.battleAttackRound('${node.id}')" class="btn btn-error btn-md text-xs font-black shadow-lg shadow-rose-600/30">
            ⚔️ Attacca Round
          </button>
          ${!node.isBoss ? `
            <button onclick="AppEngine.battleFlee()" class="btn btn-outline border-white/20 btn-md text-xs font-bold">
              🏃 Tenta Fuga
            </button>
          ` : `
            <button disabled class="btn btn-outline border-white/10 btn-md text-xs font-bold text-slate-500 cursor-not-allowed">
              🔒 Fuga Impossibile
            </button>
          `}
        </div>
      `;

      // Corruzione Nemici Soldato (se il giocatore ha droga nello zaino)
      if (node.isSoldato && hero && hero.inventario && hero.inventario.length > 0) {
        htmlCombat += `
          <div class="pt-2">
            <button onclick="AppEngine.battleBribe('${hero.inventario[0]}')" class="btn btn-warning btn-sm w-full text-xs font-bold shadow-md">
              💊 Corrompi con ${hero.inventario[0]}
            </button>
          </div>
        `;
      }

      box.innerHTML = htmlCombat;
      return;
    }

    // ENIGMA / QUIZ A 4 RISPOSTE
    if (node.quiz) {
      box.innerHTML = `
        <div class="p-3.5 rounded-2xl bg-black/40 border border-sky-500/30 space-y-2.5 mb-3">
          <div class="text-xs font-bold text-amber-300">❓ ${node.quiz.domanda}</div>
          <div class="grid grid-cols-1 gap-2 pt-1">
            ${node.quiz.opzioni.map(opt => `
              <button onclick="AppEngine.advanceNode('${opt === node.quiz.rispostaCorretta ? (node.destSuccesso || 'SND_001') : (node.destFallimento || 'SND_010')}')" class="btn btn-sm btn-outline border-white/20 text-xs font-bold text-left justify-start">
                • ${opt}
              </button>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    // NORMALI BIVI NARRATIVI
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

  // AGGIORNAMENTO PLANCIA EROE (Salute, Oro, PX, Modificatori D20)
  updateHeroVitals: function(hero) {
    if (!hero) return;
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    
    s("gameplay-hero-name", hero.nomeEroe || "Eroe");
    s("gameplay-hero-class", hero.classe || "Avventuriero");
    s("gameplay-gold", `${hero.oro || 0} 🟡`);
    s("gameplay-px", `${hero.px || 0} ✨`);
    s("gameplay-pv-label", `${hero.pv}/${hero.pvMax}`);
    
    const bar = document.getElementById("gameplay-pv-bar");
    if (bar) {
      bar.value = hero.pv;
      bar.max = hero.pvMax;
    }

    // Aggiornamento Modificatori D20
    if (hero.stats && hero.modificatori) {
      s("gameplay-stat-for", `${hero.stats.FORZA} (${hero.modificatori.FORZA >= 0 ? '+' : ''}${hero.modificatori.FORZA})`);
      s("gameplay-stat-des", `${hero.stats.DESTREZZA} (${hero.modificatori.DESTREZZA >= 0 ? '+' : ''}${hero.modificatori.DESTREZZA})`);
      s("gameplay-stat-int", `${hero.stats.INTELLIGENZA} (${hero.modificatori.INTELLIGENZA >= 0 ? '+' : ''}${hero.modificatori.INTELLIGENZA})`);
    }
  },

  renderCombatRoundResult: function(log, node, hero) {
    if (hero) AppRenderer.updateHeroVitals(hero);
    const box = document.getElementById("gameplay-choices-container");
    if (!box) return;

    box.innerHTML = `
      <div class="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2 text-xs mb-3">
        <div class="font-bold text-amber-300">⚔️ ROUND ${log.round} - ESITO DUELLO</div>
        <div class="text-[11px] text-slate-200">
          • Tuo attacco D20 (${log.d20Hero}${log.modHero >= 0 ? '+' : ''}${log.modHero} = <b>${log.totHero}</b>): 
          ${log.isHit ? `<span class="text-emerald-400 font-bold">A SEGNO (-${log.dmgDealt} PV!)</span>` : '<span class="text-slate-400">A VUOTO!</span>'}
        </div>
        <div class="text-[11px] text-slate-200">
          • Contrattacco nemico: 
          ${log.dmgTaken > 0 ? `<span class="text-rose-400 font-bold">COLPITO (-${log.dmgTaken} PV!)</span>` : '<span class="text-emerald-400">SCHIVATO!</span>'}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button onclick="AppEngine.battleAttackRound('${node.id}')" class="btn btn-error btn-md text-xs font-black shadow-lg shadow-rose-600/30">
          ⚔️ Round Successivo
        </button>
        <button onclick="AppEngine.battleFlee()" class="btn btn-outline border-white/20 btn-md text-xs font-bold">
          🏃 Tenta Fuga
        </button>
      </div>
    `;
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
      c.innerHTML = `<div class="text-center py-4 text-slate-500">Nessun file scaricato finora.</div>`;
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
