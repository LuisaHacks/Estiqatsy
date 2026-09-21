// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/app-modules.js
// LAYER 2: MODULI DI PIATTAFORMA, PORTALE GIOCHI, E-COMMERCE & SERVIZI SAAS
// ============================================================================

const AppModules = {

  // --------------------------------------------------------------------------
  // 1. BOOTSTRAP & INIZIALIZZAZIONE PIATTAFORMA
  // --------------------------------------------------------------------------
  init: async function() {
    this.loadVault();

    try {
      // 1. Profilo Utente, Permessi Moduli & Piani SaaS
      const profileData = await apiCall("profile");
      if (profileData && profileData.user) {
        AppState.user = profileData.user;
        AppState.allowedModules = profileData.allowedModules || AppState.allowedModules;
        AppState.plans = profileData.plans || [];
        this.renderProfile(profileData.user);
        this.applyHardLocking(AppState.allowedModules);
      }

      // 2. Caricamento parallelo dei cataloghi
      await Promise.allSettled([
        this.loadGamesCatalog(),
        this.fetchShop(),
        this.fetchRecipes(),
        this.syncTransactions(false)
      ]);

      // 3. Slider Promozionale della Home
      this.initCarousel();

      // 4. Rimozione Loader d'avvio
      const loader = document.getElementById("app-loading");
      if (loader) {
        loader.classList.add("opacity-0");
        setTimeout(() => loader.remove(), 250);
      }

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error("[AppModules.init] Errore di bootstrap:", err);
      const errBox = document.getElementById("loading-error-box");
      if (errBox) {
        errBox.textContent = err.message || "Errore di connessione al database Syndicate.";
        errBox.classList.remove("hidden");
        const retryBtn = document.getElementById("loading-retry-btn");
        if (retryBtn) retryBtn.classList.remove("hidden");
      }
    }
  },

  applyHardLocking: function(allowed) {
    if (!allowed) return;
    document.querySelectorAll("[data-module]").forEach(el => {
      const mod = el.dataset.module;
      const isPermitted = (allowed[mod] !== false);
      el.classList.toggle("hidden", !isPermitted);
    });
  },

  renderProfile: function(u) {
    if (!u) return;
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const megoinVal = Wallet.getMegoin();

    s("home-username", u.nome || "Avventuriero");
    s("home-rank-points", u.puntiFedelta || 0);
    s("home-plan-badge", `PIANO ${(u.piano || u.plan || "Free").toUpperCase()}`);
    s("home-megoin-card", `${megoinVal} 🪙`);
    s("home-punti-card", `${u.puntiFedelta || 0} Pt`);
    s("home-purchases-count", u.prodottiAcquistati || 0);

    s("user-avatar-desk", (u.nome || "U").charAt(0).toUpperCase());
    s("user-name-desk", u.nome || "Avventuriero");
    s("user-plan-desk", `PIANO ${(u.piano || u.plan || "Free").toUpperCase()}`);
    s("user-megoin-desk", `${megoinVal} 🪙`);
    s("user-points-desk", `${u.puntiFedelta || 0} Pt`);

    s("profile-card-avatar", (u.nome || "U").charAt(0).toUpperCase());
    s("profile-card-name", u.nome || "Avventuriero");
    s("profile-card-username", u.username || "@anonimo");
    s("profile-card-plan", `PIANO ${(u.piano || u.plan || "Free").toUpperCase()}`);
    s("profile-card-id", `ID: ${u.chatId || "-"}`);
    s("profile-card-megoin", `${megoinVal} 🪙`);
    s("profile-card-points", `${u.puntiFedelta || 0} Pt`);

    s("profile-action-plan-name", `Piano: ${(u.piano || u.plan || "Free").toUpperCase()}`);
    s("profile-action-vault-count", AppState.vault.length);
  },

  // --------------------------------------------------------------------------
  // 2. CAROSELLO PROMOZIONALE HOME
  // --------------------------------------------------------------------------
  _currentPromoSlides: [],

  initCarousel: function() {
    const track = document.getElementById("carousel-track");
    const dotsBox = document.getElementById("carousel-dots-container");
    const outer = document.getElementById("carousel-outer-wrapper");
    if (!track) return;

    this._currentPromoSlides = [
      {
        badge: "GIOCHI NOIR RPG",
        titolo: "Paul Sindaco & ViareGTA",
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

    AppState.carousel.count = this._currentPromoSlides.length;
    AppState.carousel.index = 0;

    track.innerHTML = this._currentPromoSlides.map((s, idx) => `
      <div class="min-w-full relative h-44 md:h-64 bg-slate-900 cursor-pointer overflow-hidden flex-none" onclick="AppModules.handleCarouselClick(${idx})">
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

    if (dotsBox) {
      dotsBox.innerHTML = this._currentPromoSlides.map((_, i) => `
        <span class="w-2 h-1.5 rounded-full transition-all ${i === 0 ? 'bg-sky-400 w-4' : 'bg-white/20'}" id="car-dot-${i}"></span>
      `).join("");
    }

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
      AppModules.updateCarouselPosition();
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

  // --------------------------------------------------------------------------
  // 3. PORTALE & CATALOGO GIOCHI (AGNOSTICO MULTI-ENGINE)
  // --------------------------------------------------------------------------
  loadGamesCatalog: async function() {
    try {
      const gamesData = await apiCall("games");
      if (gamesData && gamesData.series) {
        AppState.games.catalog = deduplicateEntities(gamesData.series);
        const gc = document.getElementById("home-games-count");
        if (gc) gc.textContent = AppState.games.catalog.length;
      }
    } catch (e) {
      console.warn("[AppModules] Errore caricamento catalogo giochi:", e);
    }
  },

  renderGamesCatalog: function() {
    const container = document.getElementById("games-catalog-container");
    const counter = document.getElementById("games-total-counter");
    if (!container) return;

    const list = AppState.games.catalog || [];
    if (counter) counter.textContent = `${list.length} Saghe Disponibili`;

    if (list.length === 0) {
      container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-xs">Nessun gioco registrato nel Syndicate.</div>`;
      return;
    }

    container.innerHTML = list.map(saga => {
      const ruleCode = saga.regole || "Rules2";
      const isRules2 = ruleCode.toLowerCase().includes("rules2");

      return `
        <div onclick="AppModules.openGameDetail('${saga.gameKey}')" class="bg-surface/90 hover:bg-surface rounded-2xl border ${isRules2 ? 'border-sky-500/40 ring-1 ring-sky-500/20' : 'border-white/10'} p-4 flex flex-col justify-between space-y-3 cursor-pointer active:scale-[0.98] transition-all shadow-xl group">
          <div class="h-36 w-full rounded-xl overflow-hidden relative bg-black/40">
            <img src="${saga.mediaUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <span class="badge badge-xs ${isRules2 ? 'badge-primary' : 'badge-warning'} font-black uppercase text-[8px] absolute top-2.5 left-2.5 shadow">
              ${ruleCode}
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
    const saga = AppState.games.catalog.find(s => s.gameKey === gameKey);
    if (!saga) return;

    AppState.games.activeGameKey = gameKey;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s("hub-title", `${saga.emoji || '🎮'} ${saga.serie}`);
    s("hub-desc", saga.descrizione || "");

    const img = document.getElementById("hub-image");
    if (img) img.src = saga.mediaUrl;

    if (saga.citazione) {
      s("hub-quote", `“${saga.citazione.replace(/^["'“”]+|["'“”]+$/g, '')}”`);
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
          <button onclick="AppModules.startEpisode('${saga.gameKey}', ${ep.episodio}, ${!!ep.canContinueFree})" class="btn btn-xs btn-primary font-bold px-3 shadow-md">
            ${ep.canContinueFree ? 'Continua Veterano' : 'Gioca'}
          </button>
        </div>
      `).join("");
    }

    AppRouter.navigate("subview-game-detail");
  },

  // PASSAGGIO DI CONSEGNE DAL MODULO AL MOTORE SPECIFICO (ENGINE REGISTRY)
  startEpisode: function(gameKey, epNum, canContinueFree) {
    const saga = AppState.games.catalog.find(s => s.gameKey === gameKey);
    if (!saga) return;

    const ruleEngineKey = saga.regole || "Rules2";
    const engine = EngineRegistry.get(ruleEngineKey);

    if (!engine) {
      alert(`⚠️ Motore di gioco "${ruleEngineKey}" non trovato o non ancora caricato.`);
      return;
    }

    // Registra la sessione attiva su AppState
    AppState.activeSession.engineKey = ruleEngineKey;
    AppState.activeSession.gameKey = gameKey;
    AppState.activeSession.episodio = epNum;

    // Se l'engine dispone del metodo di avvio sessione, gli passa il controllo
    if (typeof engine.launchSession === "function") {
      engine.launchSession(gameKey, epNum, canContinueFree, saga.eroeSalvato || null);
    } else {
      console.warn(`[AppModules] L'engine "${ruleEngineKey}" non implementa launchSession().`);
    }
  },

  // --------------------------------------------------------------------------
  // 4. BOTTEGA E-COMMERCE (ACQUISTI IN MEGOIN)
  // --------------------------------------------------------------------------
  fetchShop: async function() {
    try {
      const data = await apiCall("shop");
      if (data && data.items) {
        AppState.shop.items = deduplicateEntities(data.items);
        AppState.shop.categories = data.categories || [];
        this.renderShop();
      }
    } catch (e) {
      console.warn("[AppModules] Errore caricamento shop:", e);
    }
  },

  setShopCategory: function(cat) {
    AppState.shop.activeCategory = cat;
    this.renderShop();
  },

  filterShop: function() {
    const input = document.getElementById("shop-search-input");
    AppState.shop.searchQuery = input ? input.value.trim().toLowerCase() : "";
    this.renderShopProducts();
  },

  renderShop: function() {
    const sc = document.getElementById("shop-category-chips");
    if (sc && AppState.shop.categories.length > 0) {
      const all = ["tutti", ...AppState.shop.categories];
      sc.innerHTML = all.map(c => `
        <button onclick="AppModules.setShopCategory('${c}')" class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${AppState.shop.activeCategory.toLowerCase() === c.toLowerCase() ? 'bg-sky-500 text-white' : 'bg-surface text-slate-400 border border-white/5'}">
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
      grid.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 text-xs">Nessun articolo trovato nella bottega.</div>`;
      return;
    }

    grid.innerHTML = list.map(p => `
      <div onclick="AppModules.openShopDetail('${p.id}')" class="bg-surface rounded-2xl border border-white/5 flex flex-col justify-between overflow-hidden cursor-pointer active:scale-[0.98] transition-transform relative p-0 shadow-lg">
        ${p.isLocked ? `
          <div class="absolute inset-0 z-10 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center">
            <span class="text-xl mb-1">🔒</span>
            <span class="text-[9px] font-black text-amber-300 uppercase">Richiede Piano ${p.requiredPlan}</span>
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
            <span class="text-[10px] text-slate-400 font-bold">${p.isEsaurito ? 'Esaurito' : '€ ' + p.prezzoEuro}</span>
          </div>
        </div>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
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
      btn.onclick = () => AppModules.openPlanModal(item.requiredPlan);
    } else {
      btn.textContent = item.prezzoMegoin === 0 ? "🎁 Riscatta Gratis" : `Acquista (${item.prezzoMegoin} 🪙)`;
      btn.className = "btn btn-primary btn-sm font-bold shadow-lg shadow-sky-600/30";
      btn.onclick = () => AppModules.buyProduct(item.id);
    }

    AppRouter.navigate("subview-shop-detail");
  },

  buyProduct: async function(prodId) {
    try {
      const res = await apiCall("shop_buy", { id: prodId });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("coin");
        if (window.confetti) confetti({ particleCount: 80, spread: 60 });

        Wallet.setMegoin(res.nuovoSaldoMegoin);
        if (AppState.user) {
          AppState.user.prodottiAcquistati = (AppState.user.prodottiAcquistati || 0) + 1;
        }

        this.renderProfile(AppState.user);
        if (res.digitalDownloads) {
          res.digitalDownloads.forEach(d => this.addVault(d.nome, d.url));
        }

        this.showFulfillment(res.riepilogo, res.digitalDownloads);
        this.syncTransactions(true);
      }
    } catch (err) {
      alert("❌ " + err.message);
    }
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

  // --------------------------------------------------------------------------
  // 5. BARLADY & RICETTARIO
  // --------------------------------------------------------------------------
  fetchRecipes: async function() {
    try {
      const data = await apiCall("recipes");
      if (data && data.recipes) {
        AppState.recipes.items = deduplicateEntities(data.recipes);
        AppState.recipes.categories = data.categories || [];
        this.renderRecipes();
      }
    } catch (e) {
      console.warn("[AppModules] Errore ricette:", e);
    }
  },

  setRecipeCategory: function(cat) {
    AppState.recipes.activeCategory = cat;
    this.renderRecipes();
  },

  filterRecipes: function() {
    const input = document.getElementById("recipes-search-input");
    AppState.recipes.searchQuery = input ? input.value.trim().toLowerCase() : "";
    this.renderRecipesCards();
  },

  renderRecipes: function() {
    const rc = document.getElementById("recipes-category-chips");
    if (rc && AppState.recipes.categories.length > 0) {
      const all = ["tutti", ...AppState.recipes.categories];
      rc.innerHTML = all.map(c => `
        <button onclick="AppModules.setRecipeCategory('${c}')" class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${AppState.recipes.activeCategory.toLowerCase() === c.toLowerCase() ? 'bg-sky-500 text-white' : 'bg-surface text-slate-400 border border-white/5'}">
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
      grid.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 text-xs">Nessuna ricetta o cocktail trovato.</div>`;
      return;
    }

    grid.innerHTML = list.map(r => `
      <div onclick="AppModules.openRecipeDetail(${r.rowIndex})" class="bg-surface rounded-2xl border border-white/5 flex items-center justify-between p-3.5 cursor-pointer active:scale-[0.98] transition-transform shadow-lg">
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

  // --------------------------------------------------------------------------
  // 6. PIANI SAAS & ABBONAMENTI
  // --------------------------------------------------------------------------
  openPlansCatalogModal: function() {
    this.renderPlansCatalog();
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
    this.renderPlansCatalog();
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
            <div onclick="AppModules.openPlanModal('${p.id}')" class="bg-surface/90 hover:bg-surface active:scale-[0.98] transition-all rounded-2xl border ${p.isAttivo ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-xl' : (isSilver ? 'border-amber-400/60 ring-1 ring-amber-400/30' : 'border-white/10')} p-4 flex flex-col justify-between space-y-3 cursor-pointer relative group">
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
                <th onclick="AppModules.openPlanModal('${p.id}')" class="p-2 cursor-pointer">
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
                  <button onclick="AppModules.openPlanModal('${p.id}')" class="btn btn-xs ${p.isAttivo ? 'btn-outline border-white/20' : 'btn-primary'} px-2 font-bold text-[8px]">
                    ${p.isAttivo ? 'In Uso' : 'Apri'}
                  </button>
                </td>
              `).join("")}
            </tr>
          </tbody>
        </table>
      </div>

      <div onclick="AppModules.openPlanModal('${freePlan.id}')" class="bg-surface/60 hover:bg-surface active:scale-[0.99] transition-all p-3.5 rounded-2xl border ${freePlan.isAttivo ? 'border-sky-400/50' : 'border-white/5'} flex items-center justify-between cursor-pointer group mt-3">
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
        actBtn.onclick = () => alert(`Reindirizzamento al checkout sicuro per ${plan.nome}...`);
      }
    }

    const detailModal = document.getElementById("modal-plan-upgrade");
    if (detailModal) detailModal.showModal();
  },

  // --------------------------------------------------------------------------
  // 7. CAVEAU DIGITALE & TRANSAZIONI
  // --------------------------------------------------------------------------
  loadVault: function() {
    const saved = localStorage.getItem(AppConfig.CACHE_KEYS.VAULT);
    if (saved) {
      try {
        AppState.vault = JSON.parse(saved);
        this.renderVault();
      } catch (e) {}
    }
  },

  addVault: function(nome, url) {
    AppState.vault.unshift({ nome, url, data: new Date().toLocaleDateString("it-IT") });
    localStorage.setItem(AppConfig.CACHE_KEYS.VAULT, JSON.stringify(AppState.vault));
    this.renderVault();
  },

  renderVault: function() {
    const c = document.getElementById("profile-vault-container");
    if (!c) return;
    if (AppState.vault.length === 0) {
      c.innerHTML = `<div class="text-center py-4 text-slate-500 text-xs">Nessun file scaricato o riscattato finora.</div>`;
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
  },

  openVaultSection: function() {
    AppRouter.navigate("profile");
    setTimeout(() => {
      const el = document.getElementById("profile-vault-container-card");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  },

  syncTransactions: async function(force = false) {
    try {
      const d = await apiCall("my_transactions");
      if (d && d.transactions) this.renderTransactions(d.transactions);
    } catch (e) {
      console.warn("[AppModules] Errore sync transazioni:", e);
    }
  },

  renderTransactions: function(txs) {
    const c = document.getElementById("profile-transactions-container");
    if (!c) return;
    if (!txs || txs.length === 0) {
      c.innerHTML = `<div class="text-center py-4 text-slate-500 text-xs">Nessuna transazione recente registrata.</div>`;
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
  }
};
