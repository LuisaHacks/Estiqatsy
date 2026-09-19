// ============================================================================
// INIZIALIZZAZIONE NATIVA FULLSCREEN TELEGRAM (BLINDA LA VISTA SENZA STRISCE)
// ============================================================================
const tg = window.Telegram ? window.Telegram.WebApp : null;

if (tg) {
  try {
    tg.ready();
    tg.expand(); // Espansione standard iniziale
    
    // Attiva la modalità Fullscreen nativa di Telegram 8.0+ (elimina la barra grigia in alto)
    if (typeof tg.requestFullscreen === "function") {
      tg.requestFullscreen();
    }
    
    // Disabilita lo swipe verticale verso il basso (impedisce che l'app si chiuda come un foglio trascinabile)
    if (typeof tg.disableVerticalSwipes === "function") {
      tg.disableVerticalSwipes();
    }

    tg.setHeaderColor("#090D16");
    tg.setBackgroundColor("#090D16");
  } catch (e) {
    console.warn("Inizializzazione Telegram Fullscreen:", e);
  }
}

// ----------------------------------------------------------------------------
// 1. ROUTER VISTE & RESET AUTOMATICO FILTRI SU CAMBIO TAB
// ----------------------------------------------------------------------------
const AppRouter = {
  navigate: function(tabName) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

    // Controllo Hard-Gating (nasconde i moduli non inclusi nel piano)
    if (tabName !== "home" && tabName !== "profile" && tabName !== "gameplay") {
      if (AppState.allowedModules && !AppState.allowedModules[tabName]) {
        AppEngine.showUpgradeModal("Modulo Non Incluso", "Questa sezione non è compresa nel tuo piano di abbonamento.");
        return;
      }
    }

    // ========================================================================
    // AUTO-RESET DEI FILTRI & RICERCA SU OGNI CAMBIO TAB (Refresh Istantaneo)
    // ========================================================================
    if (tabName === "shop") {
      AppState.shop.activeCategory = "tutti";
      AppState.shop.searchQuery = "";
      const sInput = document.getElementById("shop-search-input");
      if (sInput) sInput.value = "";
      AppRenderer.renderShop();
    } else if (tabName === "recipes") {
      AppState.recipes.activeCategory = "tutti";
      AppState.recipes.searchQuery = "";
      const rInput = document.getElementById("recipes-search-input");
      if (rInput) rInput.value = "";
      AppRenderer.renderRecipes();
    } else if (tabName === "games") {
      AppState.games.activeGenre = "tutti";
      AppState.games.searchQuery = "";
      const gInput = document.getElementById("games-search-input");
      if (gInput) gInput.value = "";
      AppRenderer.renderGames();
    }

    AppState.activeTab = tabName;

    // Riporta subito la vista in cima (elimina scorrimenti strani da sotto)
    window.scrollTo({ top: 0, behavior: "instant" });

    // Switch pulito delle viste con classe di transizione
    const views = ["home", "games", "gameplay", "shop", "recipes", "profile"];
    views.forEach(v => {
      const el = document.getElementById("view-" + v);
      if (el) {
        const isTarget = (v === tabName);
        el.classList.toggle("hidden", !isTarget);
        if (isTarget) {
          el.classList.remove("app-view");
          void el.offsetWidth; // Trigger reflow per animazione fluida
          el.classList.add("app-view");
        }
      }
    });

    // Aggiornamento stato icone navigazione mobile
    document.querySelectorAll(".nav-tab").forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("text-slate-400", !isActive);
    });

    // Aggiornamento stato sidebar desktop
    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("bg-white/5", isActive);
      btn.classList.toggle("text-slate-300", !isActive);
    });

    const deskTitle = document.getElementById("desk-section-title");
    const titles = {
      home: "Dashboard Home",
      games: "Saghe Investigative & Avventure RPG",
      gameplay: "Avventura in Corso",
      shop: "Bottega & Mercato Noir",
      recipes: "Barlady & Ricettario Darsenotto",
      profile: "Profilo & Caveau Digitale"
    };
    if (deskTitle) deskTitle.textContent = titles[tabName] || "Dashboard";

    // BackButton Nativo Telegram: attivo solo se sei in partita
    if (tg && tg.BackButton) {
      if (tabName === "gameplay") {
        tg.BackButton.show();
        tg.BackButton.onClick(() => AppRouter.navigate("games"));
      } else {
        tg.BackButton.hide();
      }
    }

    if (window.lucide) lucide.createIcons();
  }
};

// ----------------------------------------------------------------------------
// 2. CLIENT API APPS SCRIPT
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 3. ENGINE CENTRALE (LOGICA & CHIAMATE)
// ----------------------------------------------------------------------------
const AppEngine = {
  init: async function() {
    this.loadVaultFromStorage();

    try {
      // 1. Profilo Utente
      const profilePayload = await apiCall("profile");
      if (profilePayload && profilePayload.user) {
        AppState.user = profilePayload.user;
        AppState.allowedModules = profilePayload.allowedModules || AppState.allowedModules;
        AppRenderer.renderProfile(profilePayload.user);
        this.applyHardGating(AppState.allowedModules);
      }

      // 2. Caricamento Parallelo Cataloghi
      await Promise.allSettled([
        this.fetchShop(),
        this.fetchRecipes(),
        this.fetchGames(),
        this.syncTransactions(false)
      ]);

      const loader = document.getElementById("app-loading");
      if (loader) {
        loader.classList.add("opacity-0");
        setTimeout(() => loader.remove(), 350);
      }

    } catch (err) {
      console.error("Errore avvio PWA:", err);
      const errBox = document.getElementById("loading-error-box");
      if (errBox) {
        errBox.textContent = err.message || "Errore di connessione a Google Apps Script";
        errBox.classList.remove("hidden");
        document.getElementById("loading-retry-btn").classList.remove("hidden");
      }
    }
  },

  applyHardGating: function(modules) {
    ["shop", "games", "recipes"].forEach(mod => {
      if (!modules[mod]) {
        document.querySelectorAll(`[data-tab="${mod}"]`).forEach(btn => btn.classList.add("hidden"));
        const sec = document.getElementById(`view-${mod}`);
        if (sec) sec.classList.add("hidden");
      }
    });
  },

  // ==========================================================================
  // GIOCHI, GENERI & SERIE HUB
  // ==========================================================================
  fetchGames: async function() {
    try {
      const data = await apiCall("games");
      if (data) {
        // Supporta sia data.series che data.games per retro-compatibilità immediata
        AppState.games.series = data.series || data.games || [];
        AppState.games.genres = data.genres || [];
        AppRenderer.renderGames();
      }
    } catch (e) {
      console.warn("Games fetch fallback error:", e);
    }
  },

  setGameGenre: function(genre) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    AppState.games.activeGenre = genre;
    AppRenderer.renderGames();
  },

  filterGames: function() {
    const input = document.getElementById("games-search-input");
    AppState.games.searchQuery = input ? input.value.trim().toLowerCase() : "";
    AppRenderer.renderGamesCards();
  },

  openSeriesHub: async function(gameKey) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    try {
      const data = await apiCall("game_hub", { gameKey: gameKey });
      if (data && data.serie) {
        AppState.games.activeSeries = data;
        
        document.getElementById("hub-serie-title").textContent = data.titolo || data.serie;
        document.getElementById("hub-serie-desc").textContent = data.descrizione || "Esplora i capitoli di questa saga.";
        document.getElementById("hub-serie-genre").textContent = data.tipologia || "Avventura";
        document.getElementById("hub-serie-rules").textContent = data.regole || "Rules 2";
        document.getElementById("hub-serie-img").src = data.mediaUrl || "https://image.pollinations.ai/prompt/noir-italian-docks-night-cinematic?width=600&height=300&nologo=true";

        const quoteBox = document.getElementById("hub-serie-quote");
        if (data.citazione) {
          quoteBox.textContent = `"${data.citazione}" ${data.autoreCitazione ? '(' + data.autoreCitazione + ')' : ''}`;
          quoteBox.classList.remove("hidden");
        } else {
          quoteBox.classList.add("hidden");
        }

        const heroBox = document.getElementById("hub-hero-box");
        if (data.eroeSalvato && data.eroeSalvato.nomeEroe) {
          document.getElementById("hub-hero-name").textContent = `${data.eroeSalvato.nomeEroe} (${data.eroeSalvato.classe})`;
          document.getElementById("hub-hero-progress").textContent = `Episodi vinti: ${data.eroeSalvato.maxEpisodio}`;
          heroBox.classList.remove("hidden");
        } else {
          heroBox.classList.add("hidden");
        }

        // Render Episodi
        const epContainer = document.getElementById("hub-episodes-list");
        epContainer.innerHTML = data.episodes.map(ep => {
          let btnLabel = ep.canContinueFree ? "⚔️ Continua (Gratis)" : `▶️ Gioca (${ep.costoMegoin} 🪙)`;
          let statusBadge = ep.isCompleted ? '<span class="badge badge-xs badge-success">Completato</span>' : '';

          return `
            <div class="p-3 rounded-xl bg-surface/70 border border-white/5 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-white flex items-center space-x-1.5">
                  <span>${ep.emoji || '▶️'} Ep. ${ep.episodio}: ${ep.titolo}</span>
                  ${statusBadge}
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5">${ep.canContinueFree ? 'Avanzamento con Eroe' : (ep.costoMegoin === 0 ? 'Gratuito' : `Costo: ${ep.costoMegoin} Megoin`)}</div>
              </div>
              <button onclick="document.getElementById('modal-series-hub').close(); AppEngine.startGame('${data.gameKey}', ${ep.episodio})" class="btn btn-xs btn-primary font-bold shadow-md shadow-sky-600/20">
                ${btnLabel}
              </button>
            </div>
          `;
        }).join("");

        document.getElementById("modal-series-hub").showModal();
      }
    } catch (e) {
      alert("Impossibile aprire la saga: " + e.message);
    }
  },

  startGame: async function(gameKey, epNum) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("dice");
    try {
      const data = await apiCall("game_start", { gameKey: gameKey, episodio: epNum });
      if (data && data.success) {
        AppState.user.saldoMegoin = data.nuovoSaldoMegoin;
        AppRenderer.renderProfile(AppState.user);

        AppState.games.session = {
          gameKey: gameKey,
          episodio: epNum,
          partitaId: data.partitaId,
          engine: data.engine
        };

        AppRenderer.renderGameNode(data.nodoIniziale, data.statoEroe);
        AppRouter.navigate("gameplay");
      }
    } catch (err) {
      alert("❌ Impossibile avviare la partita: " + err.message);
    }
  },

  advanceNode: async function(targetNodeId) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("hit");
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");

    const sess = AppState.games.session;
    if (!sess) {
      AppRouter.navigate("games");
      return;
    }

    try {
      const data = await apiCall("game_node", {
        gameKey: sess.gameKey,
        episodio: sess.episodio,
        nodeId: targetNodeId,
        partitaId: sess.partitaId
      });

      if (data && data.nodo) {
        if (data.nodo.tipo === "Fine" || data.nodo.id.includes("END")) {
          if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("victory");
          if (window.confetti) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }
        AppRenderer.renderGameNode(data.nodo, data.statoEroe);
      }
    } catch (err) {
      alert("Errore avanzamento avventura: " + err.message);
    }
  },

  // ==========================================================================
  // SHOP
  // ==========================================================================
  fetchShop: async function() {
    const cached = localStorage.getItem(AppConfig.CACHE_KEYS.SHOP);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        AppState.shop.items = parsed.items || [];
        AppState.shop.categories = parsed.categories || [];
        AppRenderer.renderShop();
      } catch (e) {}
    }
    try {
      const data = await apiCall("shop");
      if (data && data.items) {
        AppState.shop.items = data.items;
        AppState.shop.categories = data.categories || [];
        localStorage.setItem(AppConfig.CACHE_KEYS.SHOP, JSON.stringify(data));
        AppRenderer.renderShop();
      }
    } catch (e) {}
  },

  setShopCategory: function(cat) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    AppState.shop.activeCategory = cat;
    AppRenderer.renderShop();
  },

  filterShop: function() {
    const input = document.getElementById("shop-search-input");
    AppState.shop.searchQuery = input ? input.value.trim().toLowerCase() : "";
    AppRenderer.renderShopProducts();
  },

  openShopDetail: function(prodId) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    const item = AppState.shop.items.find(p => p.id === prodId);
    if (!item) return;

    document.getElementById("modal-shop-title").textContent = item.nome;
    document.getElementById("modal-shop-cat").textContent = item.categoria;
    document.getElementById("modal-shop-desc").textContent = item.descrizione || "Nessuna descrizione.";
    document.getElementById("modal-shop-price").textContent = `${item.prezzoMegoin} 🪙 Megoin`;
    document.getElementById("modal-shop-img").src = item.mediaUrl || "https://image.pollinations.ai/prompt/vintage-contraband-crate-docks-noir?width=600&height=400&nologo=true";

    const btn = document.getElementById("modal-shop-action-btn");
    if (item.isLocked) {
      btn.textContent = `🔒 Sblocca con ${item.requiredPlan}`;
      btn.className = "btn btn-warning btn-sm px-5 font-bold shadow-lg shadow-amber-600/30";
      btn.onclick = () => {
        document.getElementById("modal-shop-detail").close();
        AppEngine.showUpgradeModal(`Piano ${item.requiredPlan} Richiesto`, `L'articolo "${item.nome}" è riservato agli abbonati di livello ${item.requiredPlan}.`);
      };
    } else if (item.isEsaurito) {
      btn.textContent = "❌ Esaurito";
      btn.className = "btn btn-disabled btn-sm px-5 font-bold";
      btn.onclick = null;
    } else {
      btn.textContent = item.prezzoMegoin === 0 ? "🎁 Riscatta Gratis" : `🛒 Acquista (${item.prezzoMegoin} 🪙)`;
      btn.className = "btn btn-primary btn-sm px-5 font-bold shadow-lg shadow-sky-600/30";
      btn.onclick = () => AppEngine.buyProduct(item.id);
    }

    document.getElementById("modal-shop-detail").showModal();
  },

  buyProduct: async function(prodId) {
    const btn = document.getElementById("modal-shop-action-btn");
    btn.disabled = true;
    btn.textContent = "Elaborazione transazione...";

    try {
      const res = await apiCall("shop_buy", { id: prodId });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("coin");
        if (window.confetti) confetti({ particleCount: 90, spread: 60, origin: { y: 0.7 } });
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");

        AppState.user.saldoMegoin = res.nuovoSaldoMegoin;
        AppRenderer.renderProfile(AppState.user);

        if (res.digitalDownloads && res.digitalDownloads.length > 0) {
          res.digitalDownloads.forEach(d => AppEngine.addVaultItem(d.nome, d.url));
        }

        document.getElementById("modal-shop-detail").close();
        AppEngine.showFulfillmentModal(res.riepilogo, res.digitalDownloads);
        AppEngine.syncTransactions(true);
      }
    } catch (err) {
      alert("❌ Acquisto fallito: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Acquista Ora";
    }
  },

  // ==========================================================================
  // RICETTE
  // ==========================================================================
  fetchRecipes: async function() {
    const cached = localStorage.getItem(AppConfig.CACHE_KEYS.RECIPES);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        AppState.recipes.items = parsed.recipes || [];
        AppState.recipes.categories = parsed.categories || [];
        AppRenderer.renderRecipes();
      } catch (e) {}
    }
    try {
      const data = await apiCall("recipes");
      if (data && data.recipes) {
        AppState.recipes.items = data.recipes;
        AppState.recipes.categories = data.categories || [];
        localStorage.setItem(AppConfig.CACHE_KEYS.RECIPES, JSON.stringify(data));
        AppRenderer.renderRecipes();
      }
    } catch (e) {}
  },

  setRecipeCategory: function(cat) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    AppState.recipes.activeCategory = cat;
    AppRenderer.renderRecipes();
  },

  filterRecipes: function() {
    const input = document.getElementById("recipes-search-input");
    AppState.recipes.searchQuery = input ? input.value.trim().toLowerCase() : "";
    AppRenderer.renderRecipesCards();
  },

  openRecipeDetail: async function(rowIndex) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    try {
      const data = await apiCall("recipe_detail", { id: rowIndex });
      if (data && data.recipe) {
        const r = data.recipe;
        document.getElementById("modal-recipe-title").textContent = r.piatto;
        document.getElementById("modal-recipe-cat").textContent = r.categoria;
        document.getElementById("modal-recipe-meta").textContent = `Costo: ${r.costo} • Difficoltà: ${r.difficolta} • ⏱️ ${r.tempo}`;
        document.getElementById("modal-recipe-ingredients").textContent = r.ingredienti || "Nessun ingrediente.";
        document.getElementById("modal-recipe-prep").textContent = r.preparazione || "Nessuna preparazione.";
        document.getElementById("modal-recipe-img").src = r.mediaUrl || "https://image.pollinations.ai/prompt/artisan-cocktail-glass-vintage-darsena-bar-noir?width=600&height=400&nologo=true";

        const rpgBox = document.getElementById("modal-recipe-rpg");
        if (rpgBox && r.rpg) {
          rpgBox.innerHTML = `
            <div class="p-2 rounded-lg bg-surface"><span class="text-sky-400 font-bold block">${r.rpg.destrezza || '0%'}</span>Destrezza</div>
            <div class="p-2 rounded-lg bg-surface"><span class="text-rose-400 font-bold block">${r.rpg.forza || '0%'}</span>Forza</div>
            <div class="p-2 rounded-lg bg-surface"><span class="text-amber-400 font-bold block">${r.rpg.gusto || '8'}/10</span>Gusto</div>
          `;
        }
        document.getElementById("modal-recipe-detail").showModal();
      }
    } catch (e) {
      alert("Impossibile aprire la ricetta: " + e.message);
    }
  },

  // ==========================================================================
  // TRANSAZIONI & CAVEAU
  // ==========================================================================
  syncTransactions: async function(force = false) {
    const cached = localStorage.getItem(AppConfig.CACHE_KEYS.TRANSACTIONS);
    if (!force && cached) {
      try {
        AppRenderer.renderTransactions(JSON.parse(cached));
        return;
      } catch (e) {}
    }
    try {
      const data = await apiCall("my_transactions");
      if (data && data.transactions) {
        localStorage.setItem(AppConfig.CACHE_KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
        AppRenderer.renderTransactions(data.transactions);
      }
    } catch (e) {}
  },

  loadVaultFromStorage: function() {
    const saved = localStorage.getItem(AppConfig.CACHE_KEYS.VAULT);
    if (saved) {
      try {
        AppState.vault = JSON.parse(saved);
        AppRenderer.renderVault();
      } catch (e) {}
    }
  },

  addVaultItem: function(nome, url) {
    if (!AppState.vault.some(v => v.nome === nome)) {
      AppState.vault.unshift({ nome: nome, url: url, data: new Date().toLocaleDateString("it-IT") });
      localStorage.setItem(AppConfig.CACHE_KEYS.VAULT, JSON.stringify(AppState.vault));
      AppRenderer.renderVault();
    }
  },

  showFulfillmentModal: function(summary, downloads) {
    document.getElementById("fulfillment-summary").textContent = summary || "Acquisto registrato.";
    const box = document.getElementById("fulfillment-download-box");
    if (downloads && downloads.length > 0) {
      box.innerHTML = downloads.map(d => `
        <a href="${d.url}" target="_blank" class="btn btn-sm btn-success w-full text-xs font-bold shadow-lg">
          📥 Scarica: ${d.nome}
        </a>
      `).join("");
      box.classList.remove("hidden");
    } else {
      box.innerHTML = "";
      box.classList.add("hidden");
    }
    document.getElementById("modal-fulfillment").showModal();
  },

  showUpgradeModal: function(title, desc) {
    document.getElementById("upgrade-modal-title").textContent = title;
    document.getElementById("upgrade-modal-desc").textContent = desc;
    document.getElementById("modal-plan-upgrade").showModal();
  }
};

// ----------------------------------------------------------------------------
// 4. RENDERERS GRAFICI
// ----------------------------------------------------------------------------
const AppRenderer = {
  renderProfile: function(u) {
    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT("user-megoin-mob", u.saldoMegoin);
    setT("user-plan-mob", u.piano);
    setT("home-username", u.nome);
    setT("home-megoin-card", `${u.saldoMegoin} 🪙`);
    setT("home-punti-card", `${u.puntiFedelta} Pt`);

    setT("user-avatar-desk", (u.nome || "U").charAt(0).toUpperCase());
    setT("user-name-desk", u.nome);
    setT("user-plan-desk", `PIANO ${u.piano.toUpperCase()}`);
    setT("user-megoin-desk", `${u.saldoMegoin} 🪙`);
    setT("desk-header-megoin", `${u.saldoMegoin} Megoin 🪙`);
    setT("shop-user-balance", `${u.saldoMegoin} 🪙`);

    setT("profile-card-avatar", (u.nome || "U").charAt(0).toUpperCase());
    setT("profile-card-name", u.nome);
    setT("profile-card-username", u.username);
    setT("profile-card-plan", `PIANO ${u.piano.toUpperCase()}`);
    setT("profile-card-id", `ID: ${u.chatId}`);
    setT("profile-card-megoin", `${u.saldoMegoin} 🪙 Megoin`);
  },

  renderGames: function() {
    const chipContainer = document.getElementById("games-genre-chips");
    if (chipContainer && AppState.games.genres.length > 0) {
      const allGenres = ["tutti", ...AppState.games.genres];
      chipContainer.innerHTML = allGenres.map(g => {
        const isAct = AppState.games.activeGenre.toLowerCase() === g.toLowerCase();
        return `
          <button onclick="AppEngine.setGameGenre('${g}')" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${isAct ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'bg-surface border border-white/5 text-slate-400 hover:text-white'}">
            ${g.toUpperCase()}
          </button>
        `;
      }).join("");
    }

    this.renderGamesCards();
  },

  renderGamesCards: function() {
    const grid = document.getElementById("games-gallery-container");
    if (!grid) return;

    let series = AppState.games.series;

    if (AppState.games.activeGenre !== "tutti") {
      series = series.filter(s => s.tipologia.toLowerCase() === AppState.games.activeGenre.toLowerCase());
    }

    if (AppState.games.searchQuery) {
      series = series.filter(s => 
        s.serie.toLowerCase().includes(AppState.games.searchQuery) ||
        s.tipologia.toLowerCase().includes(AppState.games.searchQuery)
      );
    }

    const homeCount = document.getElementById("home-games-count");
    if (homeCount) homeCount.textContent = AppState.games.series.length;

    if (series.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500 text-xs">Nessuna saga trovata.</div>`;
      return;
    }

    grid.innerHTML = series.map(s => `
      <div onclick="AppEngine.openSeriesHub('${s.gameKey}')" class="glass-panel p-4 rounded-3xl border border-white/5 flex flex-col justify-between active:scale-[0.98] transition-all cursor-pointer group shadow-xl">
        <div class="h-32 md:h-44 w-full rounded-2xl bg-surface overflow-hidden relative mb-3">
          <img src="${s.mediaUrl || 'https://image.pollinations.ai/prompt/noir-italian-docks-night-cinematic?width=400&height=250&nologo=true'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          <span class="badge badge-xs badge-primary absolute top-3 left-3 font-bold uppercase text-[9px]">${s.tipologia}</span>
          <span class="badge badge-xs badge-neutral absolute top-3 right-3 font-bold uppercase text-[9px]">${s.regole}</span>
        </div>
        <div>
          <h3 class="font-black text-sm md:text-base text-white line-clamp-1">${s.emoji} ${s.serie}</h3>
          <p class="text-[11px] text-slate-400 mt-1">${s.episodesCount} Capitoli Narrativi</p>
        </div>
        <div class="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between">
          <span class="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Esplora Saga</span>
          <span class="badge badge-xs badge-info font-bold">Apri</span>
        </div>
      </div>
    `).join("");
  },

  renderGameNode: function(node, hero) {
    document.getElementById("gameplay-node-title").textContent = node.nome;
    document.getElementById("gameplay-node-text").textContent = node.testo;
    document.getElementById("gameplay-node-img").src = node.mediaUrl || "https://image.pollinations.ai/prompt/noir-italian-docks-night-cinematic?width=600&height=600&nologo=true";
    document.getElementById("gameplay-node-badge").textContent = node.tipo || "SNODO";

    // Citazione diegetica sovrimpressa nel fondino al 10% in basso all'immagine
    const qBox = document.getElementById("gameplay-node-quote");
    if (node.citazione && node.citazione !== "—") {
      qBox.textContent = `"${node.citazione}" ${node.autoreCitazione ? '(' + node.autoreCitazione + ')' : ''}`;
      qBox.classList.remove("hidden");
    } else {
      qBox.classList.add("hidden");
    }

    if (hero) {
      document.getElementById("gameplay-hero-name").textContent = hero.nomeEroe;
      document.getElementById("gameplay-hero-class").textContent = hero.classe || "Avventuriero";
      document.getElementById("gameplay-pv-label").textContent = `${hero.pv}/${hero.pvMax} PV`;
      const bar = document.getElementById("gameplay-pv-bar");
      bar.value = hero.pv;
      bar.max = hero.pvMax;
    }

    const choicesBox = document.getElementById("gameplay-choices-container");
    const isCombat = (node.tipo === "NEMICO" || (node.id && node.id.includes("NEM_")));

    // CASO A: SCHERMATA DI COMBATTIMENTO (Attacca e Fuggi AFFIANCATI)
    if (isCombat) {
      choicesBox.innerHTML = `
        <div class="grid grid-cols-2 gap-2.5">
          <button onclick="AppEngine.advanceNode('${node.destSuccesso || 'SND_001'}')" class="btn btn-error btn-md text-xs font-black shadow-lg shadow-rose-600/30">
            ⚔️ Attacca Round
          </button>
          <button onclick="AppEngine.advanceNode('${node.destFallback || 'SND_001'}')" class="btn btn-outline border-white/20 btn-md text-xs font-bold">
            🏃 Fuggi
          </button>
        </div>
      `;
      return;
    }

    // CASO B: BIVI E SCELTE NARRATIVE (A vs B AFFIANCATI)
    if (node.choices && node.choices.length > 0) {
      if (node.choices.length === 2) {
        // Scelta A vs B affiancata su 2 colonne
        choicesBox.innerHTML = `
          <div class="grid grid-cols-2 gap-2.5">
            <button onclick="AppEngine.advanceNode('${node.choices[0].target}')" class="btn btn-primary btn-md text-xs font-bold shadow-lg shadow-sky-600/20 leading-tight">
              ${node.choices[0].testo}
            </button>
            <button onclick="AppEngine.advanceNode('${node.choices[1].target}')" class="btn btn-primary btn-md text-xs font-bold shadow-lg shadow-sky-600/20 leading-tight">
              ${node.choices[1].testo}
            </button>
          </div>
        `;
      } else {
        // Singola scelta o bivi multipli
        choicesBox.innerHTML = `
          <div class="space-y-2">
            ${node.choices.map(b => `
              <button onclick="AppEngine.advanceNode('${b.target}')" class="btn btn-block btn-md btn-primary text-xs font-bold shadow-lg shadow-sky-600/20">
                ${b.testo}
              </button>
            `).join("")}
          </div>
        `;
      }
    } else {
      choicesBox.innerHTML = `
        <button onclick="AppRouter.navigate('games')" class="btn btn-block btn-md btn-outline border-white/20 text-xs font-bold">
          🏠 Torna alla Galleria Saghe
        </button>
      `;
    }
  },
  
  renderShop: function() {
    const chipContainer = document.getElementById("shop-category-chips");
    if (chipContainer && AppState.shop.categories.length > 0) {
      const allCats = ["tutti", ...AppState.shop.categories];
      chipContainer.innerHTML = allCats.map(c => {
        const isAct = AppState.shop.activeCategory.toLowerCase() === c.toLowerCase();
        return `
          <button onclick="AppEngine.setShopCategory('${c}')" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${isAct ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'bg-surface border border-white/5 text-slate-400 hover:text-white'}">
            ${c.toUpperCase()}
          </button>
        `;
      }).join("");
    }
    this.renderShopProducts();
  },

  renderShopProducts: function() {
    const grid = document.getElementById("shop-products-grid");
    if (!grid) return;

    let items = AppState.shop.items;
    if (AppState.shop.activeCategory !== "tutti") {
      items = items.filter(p => p.categoria.toLowerCase() === AppState.shop.activeCategory.toLowerCase());
    }
    if (AppState.shop.searchQuery) {
      items = items.filter(p => 
        p.nome.toLowerCase().includes(AppState.shop.searchQuery) ||
        (p.descrizione && p.descrizione.toLowerCase().includes(AppState.shop.searchQuery))
      );
    }

    const homeShopCount = document.getElementById("home-shop-count");
    if (homeShopCount) homeShopCount.textContent = AppState.shop.items.length;

    if (items.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500 text-xs">Nessun articolo trovato.</div>`;
      return;
    }

    grid.innerHTML = items.map(p => `
      <div onclick="AppEngine.openShopDetail('${p.id}')" class="glass-panel p-3 rounded-2xl border border-white/5 flex flex-col justify-between active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group">
        ${p.isLocked ? `
          <div class="absolute inset-0 z-10 badge-soft-lock flex flex-col items-center justify-center p-3 text-center">
            <span class="text-xl mb-1">🔒</span>
            <span class="text-[9px] font-black text-amber-300 uppercase tracking-wider">Piano ${p.requiredPlan}</span>
          </div>
        ` : ''}

        <div class="h-28 md:h-36 w-full rounded-xl bg-surface overflow-hidden relative mb-2.5">
          <img src="${p.mediaUrl || 'https://image.pollinations.ai/prompt/vintage-contraband-crate-docks-noir?width=400&height=300&nologo=true'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          <span class="badge badge-xs ${p.isDigitale ? 'badge-info' : 'badge-neutral'} absolute top-2 left-2 font-bold uppercase text-[8px]">${p.tipo || 'Fisico'}</span>
        </div>
        <div>
          <div class="text-[9px] font-bold text-sky-400 uppercase tracking-wider truncate">${p.categoria}</div>
          <h4 class="font-bold text-xs text-white line-clamp-1 mt-0.5">${p.nome}</h4>
        </div>
        <div class="mt-3 flex items-center justify-between pt-2 border-t border-white/5">
          <span class="text-xs font-black text-amber-300 text-glow-amber">${p.prezzoMegoin} 🪙</span>
          <span class="text-[10px] text-slate-400 font-bold">${p.isEsaurito ? '❌ Finito' : (p.prezzoEuro !== '0' ? `€ ${p.prezzoEuro}` : 'Gratis')}</span>
        </div>
      </div>
    `).join("");
  },

  renderRecipes: function() {
    const chipContainer = document.getElementById("recipes-category-chips");
    if (chipContainer && AppState.recipes.categories.length > 0) {
      const allCats = ["tutti", ...AppState.recipes.categories];
      chipContainer.innerHTML = allCats.map(c => {
        const isAct = AppState.recipes.activeCategory.toLowerCase() === c.toLowerCase();
        return `
          <button onclick="AppEngine.setRecipeCategory('${c}')" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${isAct ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'bg-surface border border-white/5 text-slate-400 hover:text-white'}">
            ${c.toUpperCase()}
          </button>
        `;
      }).join("");
    }
    this.renderRecipesCards();
  },

  renderRecipesCards: function() {
    const grid = document.getElementById("recipes-grid");
    if (!grid) return;

    let items = AppState.recipes.items;
    if (AppState.recipes.activeCategory !== "tutti") {
      items = items.filter(r => r.categoria.toLowerCase() === AppState.recipes.activeCategory.toLowerCase());
    }
    if (AppState.recipes.searchQuery) {
      items = items.filter(r => 
        r.piatto.toLowerCase().includes(AppState.recipes.searchQuery) ||
        r.categoria.toLowerCase().includes(AppState.recipes.searchQuery)
      );
    }

    if (items.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500 text-xs">Nessuna ricetta o cocktail trovato.</div>`;
      return;
    }

    grid.innerHTML = items.map(r => `
      <div onclick="AppEngine.openRecipeDetail(${r.rowIndex})" class="glass-panel p-3.5 rounded-2xl border border-white/5 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group">
        <div class="flex items-center space-x-3.5 overflow-hidden">
          <div class="w-12 h-12 rounded-xl bg-surface overflow-hidden flex-shrink-0">
            <img src="${r.mediaUrl || 'https://image.pollinations.ai/prompt/artisan-cocktail-glass-vintage-darsena-bar-noir?width=150&height=150&nologo=true'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
          </div>
          <div class="overflow-hidden">
            <h4 class="font-bold text-xs text-white truncate">${r.piatto}</h4>
            <div class="text-[10px] text-slate-400 mt-0.5 truncate">${r.categoria} • ⏱️ ${r.tempo}</div>
          </div>
        </div>
        <span class="badge badge-sm badge-outline border-sky-400/40 text-sky-400 font-bold text-[10px]">${r.costo}</span>
      </div>
    `).join("");
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
  },

  renderVault: function() {
    const c = document.getElementById("profile-vault-container");
    if (!c) return;

    if (AppState.vault.length === 0) {
      c.innerHTML = `<div class="text-center py-4 text-slate-500">Nessun file digitale acquistato finora.</div>`;
      return;
    }

    c.innerHTML = AppState.vault.map(v => `
      <div class="p-3 rounded-xl bg-surface/60 border border-white/5 flex items-center justify-between">
        <div>
          <div class="font-bold text-white text-xs">${v.nome}</div>
          <div class="text-[10px] text-slate-400">Sbloccato il ${v.data}</div>
        </div>
        <a href="${v.url}" target="_blank" class="btn btn-xs btn-success font-bold shadow-md">
          📥 Scarica
        </a>
      </div>
    `).join("");
  }
};

window.addEventListener("DOMContentLoaded", () => {
  AppEngine.init();
});
