// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/app-modules.js (VERSIONE 9.0 - SESSION RESILIENCE, 1-2 WORDS BTNS)
// LAYER 2: MODULI DI PIATTAFORMA AGNOSTICI, PORTALE GIOCHI, SHOP & SAAS
// NOTE: 100% DISACCOPPIATO DA TAILWIND - TEMPLATE DINAMICI A CLASSI SEMANTICHE
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

      // 2. Caricamento parallelo dei cataloghi di piattaforma
      await Promise.allSettled([
        this.loadGamesCatalog(),
        this.fetchShop(),
        this.fetchRecipes(),
        this.syncTransactions(false)
      ]);

      // 3. Slider Promozionale dinamico della Home
      this.initCarousel();

      // 4. Rimozione Loader d'avvio tramite classe semantica
      const loader = document.getElementById("app-loading");
      if (loader) {
        loader.classList.add("fade-out");
        setTimeout(() => loader.remove(), 250);
      }

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error("[AppModules.init] Errore di bootstrap:", err);
      const errBox = document.getElementById("loading-error-box");
      const retryBtn = document.getElementById("loading-retry-btn");

      if (errBox) {
        // GESTIONE INTELLIGENTE SESSION_EXPIRED (EVITA IL RELOAD LOOP)
        const isSessionExpired = err.message && (err.message.includes("SESSION_EXPIRED") || err.message.includes("UNAUTHORIZED"));
        
        if (isSessionExpired) {
          errBox.textContent = "Sessione scaduta per inattività. Chiudi e riapri la Mini App dalla chat per rinnovare il token sicuro.";
          if (retryBtn) {
            retryBtn.textContent = "Chiudi e Rinnova";
            retryBtn.onclick = () => {
              if (window.Telegram?.WebApp?.close) {
                window.Telegram.WebApp.close();
              } else {
                location.reload();
              }
            };
          }
        } else {
          errBox.textContent = err.message || "Errore di connessione al database Syndicate.";
          if (retryBtn) {
            retryBtn.textContent = "Riprova";
            retryBtn.onclick = () => location.reload();
          }
        }

        errBox.classList.remove("hidden");
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
    s("home-plan-badge", `PIANO ${(u.piano || u.plan || "Base").toUpperCase()}`);
    s("home-megoin-card", `${megoinVal} 🪙`);
    s("home-punti-card", `${u.puntiFedelta || 0} Pt`);
    s("home-purchases-count", u.prodottiAcquistati || 0);

    // Avatar Utente: Foto Telegram o Iniziale
    const tgUser = (window.tg && window.tg.initDataUnsafe && window.tg.initDataUnsafe.user) ? window.tg.initDataUnsafe.user : null;
    const photoUrl = u.photo_url || (tgUser ? tgUser.photo_url : null);

    const renderAvatarBox = (boxId) => {
      const el = document.getElementById(boxId);
      if (!el) return;
      if (photoUrl) {
        el.innerHTML = `<img src="${photoUrl}" class="avatar-img" alt="Avatar">`;
      } else {
        el.textContent = (u.nome || "U").charAt(0).toUpperCase();
      }
    };

    renderAvatarBox("user-avatar-desk");
    renderAvatarBox("profile-card-avatar");

    s("user-name-desk", u.nome || "Avventuriero");
    s("user-plan-desk", `PIANO ${(u.piano || u.plan || "Base").toUpperCase()}`);
    s("user-megoin-desk", `${megoinVal} 🪙`);
    s("user-points-desk", `${u.puntiFedelta || 0} Pt`);

    s("profile-card-name", u.nome || "Avventuriero");
    s("profile-card-username", u.username || "@anonimo");
    s("profile-card-plan", `PIANO ${(u.piano || u.plan || "Base").toUpperCase()}`);
    s("profile-card-id", `ID: ${u.chatId || "-"}`);
    s("profile-card-megoin", `${megoinVal} 🪙`);
    s("profile-card-points", `${u.puntiFedelta || 0} Pt`);

    s("profile-action-plan-name", `Piano: ${(u.piano || u.plan || "Base").toUpperCase()}`);
    s("profile-action-vault-count", AppState.vault.length);
  },

  // --------------------------------------------------------------------------
  // 2. CAROSELLO PROMOZIONALE HOME (DATA-DRIVEN)
  // --------------------------------------------------------------------------
  _currentPromoSlides: [],

  initCarousel: function() {
    const track = document.getElementById("carousel-track");
    const dotsBox = document.getElementById("carousel-dots-container");
    const outer = document.getElementById("carousel-outer-wrapper");
    if (!track) return;

    const slides = [];

    // Slide 1: Primo gioco attivo a catalogo
    if (AppState.games.catalog && AppState.games.catalog.length > 0) {
      const topGame = AppState.games.catalog[0];
      slides.push({
        badge: (topGame.tipologia || "GIOCO").toUpperCase(),
        titolo: `${topGame.emoji || '🎮'} ${topGame.serie}`,
        sottotitolo: topGame.descrizione || "Entra nelle avventure della piattaforma",
        btnText: "Gioca",
        action: () => AppRouter.navigate("games"),
        img: topGame.mediaUrl || "https://image.pollinations.ai/prompt/coastal-noir-docks-night-cinematic?width=800&height=400&nologo=true"
      });
    }

    // Slide 2: Primo articolo in vetrina nello Shop
    if (AppState.shop.items && AppState.shop.items.length > 0) {
      const topProduct = AppState.shop.items[0];
      slides.push({
        badge: "SHOP",
        titolo: topProduct.nome,
        sottotitolo: topProduct.descrizione || "Scopri gli articoli disponibili nello Shop",
        btnText: "Shop",
        action: () => AppRouter.navigate("shop"),
        img: topProduct.mediaUrl || "https://image.pollinations.ai/prompt/smugglers-dockside-warehouse-bazaar?width=800&height=400&nologo=true"
      });
    }

    // Slide 3: Prima ricetta a catalogo
    if (AppState.recipes.items && AppState.recipes.items.length > 0) {
      const topRecipe = AppState.recipes.items[0];
      slides.push({
        badge: (topRecipe.categoria || "RICETTA").toUpperCase(),
        titolo: topRecipe.piatto,
        sottotitolo: `Preparazione: ${topRecipe.tempo || 'rapida'} • Costo: ${topRecipe.costo || 'conveniente'}`,
        btnText: "Ricette",
        action: () => AppRouter.navigate("recipes"),
        img: topRecipe.mediaUrl || "https://image.pollinations.ai/prompt/vintage-cocktail-bar-amber-lighting?width=800&height=400&nologo=true"
      });
    }

    if (slides.length === 0) {
      if (outer) outer.classList.add("hidden");
      return;
    } else {
      if (outer) outer.classList.remove("hidden");
    }

    this._currentPromoSlides = slides;
    AppState.carousel.count = slides.length;
    AppState.carousel.index = 0;

    track.innerHTML = slides.map((s, idx) => `
      <div class="carousel-slide" onclick="AppModules.handleCarouselClick(${idx})">
        <img src="${s.img}" class="carousel-slide-img" alt="${s.titolo}">
        <div class="carousel-slide-overlay"></div>
        <span class="carousel-slide-badge">${s.badge}</span>
        <div class="carousel-slide-content">
          <div class="carousel-slide-text">
            <h3 class="carousel-slide-title">${s.titolo}</h3>
            <p class="carousel-slide-sub">${s.sottotitolo}</p>
          </div>
          <button class="carousel-slide-btn">${s.btnText}</button>
        </div>
      </div>
    `).join("");

    if (dotsBox) {
      dotsBox.innerHTML = slides.map((_, i) => `
        <span class="carousel-dot ${i === 0 ? 'active' : ''}" id="car-dot-${i}"></span>
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
        dot.className = `carousel-dot ${i === idx ? 'active' : ''}`;
      }
    }
  },

  // --------------------------------------------------------------------------
  // 3. CATALOGO GIOCHI RPG
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
      container.innerHTML = `<div class="empty-state-card">Nessun gioco registrato nella piattaforma.</div>`;
      return;
    }

    container.innerHTML = list.map(saga => {
      const ruleCode = saga.regole || "Rules2";
      return `
        <div onclick="AppModules.openGameDetail('${saga.gameKey}')" class="game-saga-card group">
          <div class="game-saga-media">
            <img src="${saga.mediaUrl}" class="game-saga-img" alt="${saga.serie}">
            <span class="badge badge-xs badge-primary game-saga-badge">${ruleCode}</span>
          </div>
          <div class="game-saga-body">
            <div class="game-saga-title-row">
              <h3 class="game-saga-title">${saga.emoji || '🎮'} ${saga.serie}</h3>
              <span class="game-saga-ep-count">${(saga.episodes || []).filter(ep => ep.episodio > 0).length} Ep.</span>
            </div>
            <p class="game-saga-desc">${saga.descrizione || ''}</p>
          </div>
          <div class="game-saga-footer">
            <span class="game-saga-status">${saga.hasActiveGame ? '⚔️ In corso' : 'Pronto'}</span>
            <button class="btn btn-xs btn-primary font-black uppercase">Esplora ›</button>
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
      // BONIFICA EPISODIO 0: Mostra esclusivamente capitoli giocabili (episodio > 0)
      const playableEpisodes = (saga.episodes || []).filter(ep => ep.episodio > 0);

      container.innerHTML = playableEpisodes.map(ep => `
        <div class="episode-list-item">
          <div class="episode-item-info">
            <div class="episode-item-title">${ep.emoji || '▶️'} Ep. ${ep.episodio}: ${ep.titolo}</div>
            <div class="episode-item-cost">
              ${ep.canContinueFree ? '⚔️ Eroe Veterano (Gratis)' : (ep.costoMegoin === 0 ? 'Gratis' : `${ep.costoMegoin} Megoin 🪙`)}
            </div>
          </div>
          <button onclick="AppModules.startEpisode('${saga.gameKey}', ${ep.episodio}, ${!!ep.canContinueFree})" class="btn btn-xs btn-primary font-black uppercase">
            ${ep.canContinueFree ? 'Continua' : 'Gioca'}
          </button>
        </div>
      `).join("");
    }

    AppRouter.navigate("subview-game-detail");
  },

  // --------------------------------------------------------------------------
  // AVVIO EPISODIO: RISOLUZIONE RESILIENTE DEL MOTORE
  // --------------------------------------------------------------------------
  startEpisode: function(gameKey, epNum, canContinueFree) {
    const saga = AppState.games.catalog.find(s => s.gameKey === gameKey);
    if (!saga) return;

    // Normalizzazione rigorosa: rimuove tutti gli spazi
    const rawRule = String(saga.regole || "Rules2").trim();
    const cleanRuleCode = rawRule.replace(/\s+/g, '');

    // Catena di fallback multipla per azzerare discrepanze su Telegram Mobile
    let engine = null;

    if (typeof window.EngineRegistry !== "undefined" && typeof window.EngineRegistry.get === "function") {
      engine = window.EngineRegistry.get(cleanRuleCode) || window.EngineRegistry.get(rawRule) || window.EngineRegistry.get("rules2");
    } else if (typeof EngineRegistry !== "undefined" && typeof EngineRegistry.get === "function") {
      engine = EngineRegistry.get(cleanRuleCode) || EngineRegistry.get(rawRule) || EngineRegistry.get("rules2");
    }

    if (!engine) {
      engine = window.Rules2Engine || (typeof Rules2Engine !== "undefined" ? Rules2Engine : null);
    }

    if (!engine) {
      alert(`⚠️ Motore "${cleanRuleCode}" non trovato. Verifica la connessione e riprova.`);
      console.error("[startEpisode] Impossibile trovare il motore per:", cleanRuleCode, rawRule);
      return;
    }

    AppState.activeSession.engineKey = cleanRuleCode;
    AppState.activeSession.gameKey = gameKey;
    AppState.activeSession.episodio = epNum;
    AppState.activeSession.combatRound = 1;
    AppState.activeSession.combatEnemyId = null;

    // Apertura del cabinato arcade diegetico
    if (typeof engine.launchSession === "function") {
      const savedHeroProfile = saga.eroeSalvato || (saga.episodes && saga.episodes[epNum - 1]?.eroeSalvato) || null;
      engine.launchSession(gameKey, epNum, canContinueFree, savedHeroProfile);
    } else {
      console.warn(`[AppModules] L'engine "${cleanRuleCode}" non implementa launchSession().`);
    }
  },

  // --------------------------------------------------------------------------
  // 4. SHOP E-COMMERCE (ACQUISTI IN MEGOIN 🪙)
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
        <button onclick="AppModules.setShopCategory('${c}')" class="category-chip ${AppState.shop.activeCategory.toLowerCase() === c.toLowerCase() ? 'active' : ''}">
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
      grid.innerHTML = `<div class="empty-state-card col-span-full">Nessun articolo trovato nello Shop.</div>`;
      return;
    }

    grid.innerHTML = list.map(p => `
      <div onclick="AppModules.openShopDetail('${p.id}')" class="shop-product-card">
        ${p.isLocked ? `
          <div class="locked-card-overlay">
            <span class="locked-icon">🔒</span>
            <span class="locked-label">Piano ${p.requiredPlan}</span>
          </div>
        ` : ''}
        <div class="shop-card-media">
          <img src="${p.mediaUrl}" class="shop-card-img" alt="${p.nome}">
          <span class="badge badge-xs ${p.isDigitale ? 'badge-info' : 'badge-neutral'} shop-type-badge">${p.tipo || 'Fisico'}</span>
        </div>
        <div class="shop-card-body">
          <div>
            <div class="shop-card-cat">${p.categoria}</div>
            <h4 class="shop-card-name">${p.nome}</h4>
          </div>
          <div class="shop-card-footer">
            <span class="shop-card-price-megoin">${p.prezzoMegoin} 🪙</span>
            <span class="shop-card-price-euro">${p.isEsaurito ? 'Esaurito' : '€ ' + p.prezzoEuro}</span>
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
      btn.textContent = `Piano ${item.requiredPlan}`;
      btn.className = "btn btn-warning btn-sm font-black uppercase w-full";
      btn.onclick = () => AppModules.openPlanModal(item.requiredPlan);
    } else {
      btn.textContent = item.prezzoMegoin === 0 ? "Riscatta" : "Compra";
      btn.className = "btn btn-primary btn-sm font-black uppercase w-full shadow-lg shadow-sky-600/30";
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
      b.innerHTML = downloads.map(d => `<a href="${d.url}" target="_blank" class="btn btn-sm btn-success w-full font-black uppercase">📥 Scarica</a>`).join("");
      b.classList.remove("hidden");
    } else {
      b.innerHTML = "";
      b.classList.add("hidden");
    }
    document.getElementById("modal-fulfillment").showModal();
  },

  // --------------------------------------------------------------------------
  // 5. RICETTARIO DINAMICO
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
        <button onclick="AppModules.setRecipeCategory('${c}')" class="category-chip ${AppState.recipes.activeCategory.toLowerCase() === c.toLowerCase() ? 'active' : ''}">
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
      grid.innerHTML = `<div class="empty-state-card col-span-full">Nessuna ricetta o cocktail trovato.</div>`;
      return;
    }

    grid.innerHTML = list.map(r => `
      <div onclick="AppModules.openRecipeDetail(${r.rowIndex})" class="recipe-card">
        <div class="recipe-card-content">
          <div class="recipe-card-thumb">
            <img src="${r.mediaUrl}" class="recipe-card-img" alt="${r.piatto}">
          </div>
          <div class="recipe-card-info">
            <h4 class="recipe-card-name">${r.piatto}</h4>
            <div class="recipe-card-sub">${r.categoria} • ⏱️ ${r.tempo}</div>
          </div>
        </div>
        <span class="badge badge-sm badge-outline border-sky-400/40 text-sky-400 font-bold">${r.costo}</span>
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
      const entries = Object.entries(r.rpg).filter(([_, val]) => val && val !== "—" && val !== "-");
      if (entries.length > 0) {
        rpg.innerHTML = entries.map(([key, val]) => `
          <div class="recipe-stat-box">
            <span class="recipe-stat-val">${val}</span>
            <span class="recipe-stat-label">${key}</span>
          </div>
        `).join("");
      } else {
        rpg.innerHTML = `<div class="empty-state-card col-span-full">Nessun parametro associato.</div>`;
      }
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
    const isYearly = (cycle === "yearly");
    
    const btnM = document.getElementById("billing-toggle-monthly");
    const btnY = document.getElementById("billing-toggle-yearly");

    if (btnM) {
      btnM.classList.toggle("active", !isYearly);
      btnM.classList.toggle("idle", isYearly);
    }
    if (btnY) {
      btnY.classList.toggle("active", isYearly);
      btnY.classList.toggle("idle", !isYearly);
    }

    this.renderPlansCatalog();
  },

  renderPlansCatalog: function() {
    const container = document.getElementById("plans-catalog-cards-container");
    if (!container || !AppState.plans || AppState.plans.length === 0) return;

    const isYearly = (AppState.billingCycle === "yearly");

    const isPlanFree = p => {
      const pStr = String(p.prezzoMensile || "").toLowerCase();
      return pStr.includes("0,00") || cleanNumber(p.prezzoMensile) === 0;
    };

    const freePlan = AppState.plans.find(isPlanFree) || AppState.plans[0];
    const paidPlans = AppState.plans.filter(p => p !== freePlan);
    const featuredIndex = paidPlans.length > 0 ? Math.floor(paidPlans.length / 2) : -1;

    const allPerksMap = new Map();
    AppState.plans.forEach(p => {
      (p.perks || []).forEach(pk => {
        if (!allPerksMap.has(pk.key)) {
          allPerksMap.set(pk.key, pk.label);
        }
      });
    });

    container.innerHTML = `
      <!-- Vista Desktop: Griglia Piani -->
      <div class="plans-desktop-grid">
        ${paidPlans.map((p, idx) => {
          const isFeatured = (idx === featuredIndex);
          const price = isYearly ? p.prezzoAnnuale : p.prezzoMensile;
          const period = isYearly ? "/anno" : "/mese";
          return `
            <div onclick="AppModules.openPlanModal('${p.id}')" class="plan-card ${p.isAttivo ? 'active-plan' : (isFeatured ? 'featured-plan' : '')}">
              ${p.isAttivo ? `<div class="plan-card-badge-top"><span class="badge badge-xs badge-info font-black">✨ ATTIVO</span></div>` : ''}
              ${(!p.isAttivo && isFeatured) ? `<div class="plan-card-badge-top"><span class="badge badge-xs badge-warning font-black">CONSIGLIATO</span></div>` : ''}
              <div class="space-y-1">
                <h4 class="plan-card-title">${p.nome}</h4>
                <div class="plan-card-price">${price} <span class="plan-card-period">${period}</span></div>
              </div>
              <div class="plan-card-body">
                <div class="plan-bonus-text">🪙 +${p.bonusMegoin} Megoin / mese</div>
                <div class="plan-desc-text">${p.descrizione || ''}</div>
              </div>
              <button class="btn btn-xs ${p.isAttivo ? 'btn-outline border-white/20' : 'btn-primary'} w-full font-black uppercase">
                ${p.isAttivo ? 'In Uso' : 'Dettagli ›'}
              </button>
            </div>
          `;
        }).join("")}
      </div>

      <!-- Vista Mobile: Tabella Comparativa Dinamica -->
      <div class="plans-mobile-table-wrapper">
        <table class="plans-compare-table">
          <thead>
            <tr>
              <th class="table-head-corner">Piano</th>
              ${paidPlans.map(p => `
                <th onclick="AppModules.openPlanModal('${p.id}')" class="table-head-plan">
                  <div class="table-plan-name ${p.isAttivo ? 'text-sky-400' : ''}">${p.nome}</div>
                  <div class="table-plan-price">${isYearly ? p.prezzoAnnuale : p.prezzoMensile}</div>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="table-cell-lead">🪙 Megoin</td>
              ${paidPlans.map(p => `<td class="table-cell-val font-bold text-amber-400">+${p.bonusMegoin}</td>`).join("")}
            </tr>
            ${Array.from(allPerksMap.entries()).map(([k, label]) => `
              <tr>
                <td class="table-cell-lead">${label}</td>
                ${paidPlans.map(p => {
                  const pk = (p.perks || []).find(x => x.key === k);
                  const isEnabled = pk ? pk.enabled : false;
                  return `<td class="table-cell-val">${isEnabled ? '✅' : '❌'}</td>`;
                }).join("")}
              </tr>
            `).join("")}
            <tr class="table-footer-row">
              <td class="table-cell-lead">Azione</td>
              ${paidPlans.map(p => `
                <td class="table-cell-val">
                  <button onclick="AppModules.openPlanModal('${p.id}')" class="btn btn-xs ${p.isAttivo ? 'btn-outline border-white/20' : 'btn-primary'} font-black uppercase">
                    ${p.isAttivo ? 'In Uso' : 'Apri'}
                  </button>
                </td>
              `).join("")}
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Card Piano Base / Gratuito -->
      ${freePlan ? `
        <div onclick="AppModules.openPlanModal('${freePlan.id}')" class="free-plan-card ${freePlan.isAttivo ? 'active-plan' : ''}">
          <div class="free-plan-lead">
            <div class="free-plan-icon">⚓</div>
            <div>
              <div class="flex items-center space-x-2">
                <span class="free-plan-title">${freePlan.nome}</span>
                ${freePlan.isAttivo ? '<span class="badge badge-xs badge-info font-bold">IN USO</span>' : ''}
              </div>
              <p class="free-plan-desc">${freePlan.descrizione || 'Include 1 Megoin mensile • Gratuito'}</p>
            </div>
          </div>
          <button class="btn btn-xs btn-ghost text-slate-400 font-black uppercase">Dettagli ›</button>
        </div>
      ` : ''}
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
      let htmlPerks = `<div class="plan-perk-bonus"><span>🪙</span> <span>+${plan.bonusMegoin} Megoin al mese inclusi</span></div>`;
      if (plan.perks && plan.perks.length > 0) {
        htmlPerks += plan.perks.map(pk => `
          <div class="plan-perk-row ${pk.enabled ? 'enabled' : 'disabled'}">
            <span>${pk.enabled ? '✅' : '❌'}</span> <span>${pk.label}</span>
          </div>
        `).join("");
      }
      perksBox.innerHTML = htmlPerks;
    }

    const actBtn = document.getElementById("upgrade-modal-action-btn");
    if (actBtn) {
      if (plan.isAttivo) {
        actBtn.textContent = "In Uso";
        actBtn.disabled = true;
        actBtn.className = "btn btn-outline border-white/20 btn-sm w-full text-slate-400 font-black uppercase";
      } else {
        actBtn.textContent = "Attiva";
        actBtn.disabled = false;
        actBtn.className = "btn btn-primary btn-sm w-full font-black uppercase shadow-lg shadow-sky-600/30";
        actBtn.onclick = () => alert(`Reindirizzamento per ${plan.nome}...`);
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
      c.innerHTML = `<div class="empty-state-card">Nessun file scaricato o riscattato finora.</div>`;
      return;
    }
    c.innerHTML = AppState.vault.map(v => `
      <div class="vault-item-card">
        <div>
          <div class="vault-item-title">${v.nome}</div>
          <div class="vault-item-date">${v.data}</div>
        </div>
        <a href="${v.url}" target="_blank" class="btn btn-xs btn-success font-black uppercase">Scarica</a>
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
      c.innerHTML = `<div class="empty-state-card">Nessuna transazione recente registrata.</div>`;
      return;
    }
    c.innerHTML = txs.map(t => `
      <div class="transaction-row">
        <div>
          <div class="transaction-type">${t.tipo}</div>
          <div class="transaction-desc">${t.data} • ${t.dettaglio}</div>
        </div>
        <div class="transaction-amount ${t.megoin.includes('+') ? 'income' : 'expense'}">
          ${t.megoin}
        </div>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
  }
};

window.AppModules = AppModules;
