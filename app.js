// ============================================================================
// PROJECT: ESTIQATSY PWA - CLIENT APPLICATION ENGINE (VERSIONE 2.7 DEFINITIVA)
// FILE: app.js
// Navigazione a Schermo Intero tra Sotto-Schermate (Zero Modali Popup),
// Clean Quotes, Card con Foto Arrotondata Solo in Alto e Bivi 2 a 2
// ============================================================================

const AppConfig = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyeCWHM9X4ycwWT7IOMwg24pySL78bJT5BRyiIR5eb0UJALWuaORzfJ2lkqLrjLv0xN/exec",
  CACHE_KEYS: {
    RECIPES: "est_cache_recipes",
    SHOP: "est_cache_shop",
    TRANSACTIONS: "est_cache_tx",
    VAULT: "est_cache_vault"
  }
};

const AppState = {
  user: null,
  allowedModules: { home: true, shop: true, games: true, recipes: true, profile: true },
  activeTab: "home",
  shop: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  recipes: { items: [], categories: [], activeCategory: "tutti", searchQuery: "" },
  games: { series: [], genres: [], activeGenre: "tutti", searchQuery: "", session: null },
  vault: []
};

// TELEGRAM FULLSCREEN
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

// ----------------------------------------------------------------------------
// 1. ROUTER VISTE: CAMBIO SCHERMATA COMPLETO (NESSUN POPUP CHE SALE DA SOTTO)
// ----------------------------------------------------------------------------
const AppRouter = {
  navigate: function(screenName) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

    // Reset automatico delle ricerche al cambio sezione principale
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

    // Elenco di tutte le schermate registrate
    const allScreens = [
      "view-home", "view-games", "view-gameplay", "view-shop", "view-recipes", "view-profile",
      "subview-series-hub", "subview-shop-detail", "subview-recipe-detail"
    ];

    let targetId = screenName;
    if (!targetId.startsWith("view-") && !targetId.startsWith("subview-")) {
      targetId = "view-" + screenName;
    }

    // Nasconde tutte le altre schermate e mostra solo quella richiesta
    allScreens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", id !== targetId);
    });

    // Riporta lo scroll dell'area centrale sempre in cima
    const scrollArea = document.getElementById("app-main-scroll");
    if (scrollArea) scrollArea.scrollTop = 0;

    // Aggiornamento stato icone navigazione mobile
    const baseTab = screenName.replace("view-", "").replace("subview-", "").split("-")[0];
    document.querySelectorAll(".nav-tab").forEach(btn => {
      const isActive = btn.dataset.tab === baseTab;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("text-slate-400", !isActive);
    });

    // Aggiornamento stato sidebar desktop
    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      const isActive = btn.dataset.tab === baseTab;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("bg-white/5", isActive);
      btn.classList.toggle("text-slate-300", !isActive);
    });

    // Gestione BackButton nativo Telegram
    if (tg && tg.BackButton) {
      if (screenName.startsWith("subview-") || screenName === "view-gameplay") {
        tg.BackButton.show();
        tg.BackButton.onClick(() => {
          if (screenName === "subview-series-hub" || screenName === "view-gameplay") AppRouter.navigate("games");
          else if (screenName === "subview-shop-detail") AppRouter.navigate("shop");
          else if (screenName === "subview-recipe-detail") AppRouter.navigate("recipes");
          else AppRouter.navigate("home");
        });
      } else {
        tg.BackButton.hide();
      }
    }

    if (window.lucide) lucide.createIcons();
  }
};

// ----------------------------------------------------------------------------
// 2. CHIAMATE API VERSO GOOGLE APPS SCRIPT
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
// 3. ENGINE PRINCIPALE (LOGICA & CHIAMATE)
// ----------------------------------------------------------------------------
const AppEngine = {
  init: async function() {
    this.loadVault();
    try {
      const p = await apiCall("profile");
      if (p && p.user) {
        AppState.user = p.user;
        AppState.allowedModules = p.allowedModules || AppState.allowedModules;
        AppRenderer.renderProfile(p.user);
      }

      await Promise.allSettled([
        this.fetchShop(),
        this.fetchRecipes(),
        this.fetchGames(),
        this.syncTransactions(false)
      ]);

      const loader = document.getElementById("app-loading");
      if (loader) {
        loader.classList.add("opacity-0");
        setTimeout(() => loader.remove(), 300);
      }
    } catch (err) {
      console.error(err);
      const eb = document.getElementById("loading-error-box");
      if (eb) {
        eb.textContent = err.message || "Errore di connessione a Google Apps Script.";
        eb.classList.remove("hidden");
        document.getElementById("loading-retry-btn").classList.remove("hidden");
      }
    }
  },

  // GIOCHI
  fetchGames: async function() {
    try {
      const data = await apiCall("games");
      if (data) {
        AppState.games.series = data.series || data.games || [];
        AppState.games.genres = data.genres || [];
        AppRenderer.renderGames();
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

  openSeriesHub: async function(gameKey) {
    try {
      const data = await apiCall("game_hub", { gameKey: gameKey });
      if (data && (data.serie || data.titolo)) {
        document.getElementById("hub-serie-title").textContent = data.titolo || data.serie;
        document.getElementById("hub-serie-desc").textContent = data.descrizione || "";
        document.getElementById("hub-serie-genre").textContent = data.tipologia || "Avventura";
        document.getElementById("hub-serie-img").src = data.mediaUrl || "https://image.pollinations.ai/prompt/noir-docks-night-cinematic?width=800&height=400&nologo=true";

        const qBox = document.getElementById("hub-serie-quote");
        if (data.citazione) {
          const cleanQ = String(data.citazione).replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
          qBox.textContent = `"${cleanQ}" ${data.autoreCitazione ? '(' + data.autoreCitazione + ')' : ''}`;
          qBox.classList.remove("hidden");
        } else {
          qBox.classList.add("hidden");
        }

        const hb = document.getElementById("hub-hero-box");
        if (data.eroeSalvato && data.eroeSalvato.nomeEroe) {
          document.getElementById("hub-hero-name").textContent = `${data.eroeSalvato.nomeEroe} (${data.eroeSalvato.classe})`;
          document.getElementById("hub-hero-progress").textContent = `Capitoli superati: ${data.eroeSalvato.maxEpisodio}`;
          hb.classList.remove("hidden");
        } else {
          hb.classList.add("hidden");
        }

        const el = document.getElementById("hub-episodes-list");
        el.innerHTML = (data.episodes || []).map(ep => {
          let btnTxt = ep.canContinueFree ? "Continua (Gratis)" : `Gioca (${ep.costoMegoin} 🪙)`;
          return `
            <div class="p-3 rounded-2xl bg-surface border border-white/5 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-white flex items-center space-x-1.5">
                  <span>${ep.emoji || '▶️'} Ep. ${ep.episodio}: ${ep.titolo}</span>
                  ${ep.isCompleted ? '<span class="badge badge-xs badge-success">Vinto</span>' : ''}
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5">${ep.canContinueFree ? 'Avanzamento Eroe' : (ep.costoMegoin === 0 ? 'Gratis' : `${ep.costoMegoin} Megoin`)}</div>
              </div>
              <button onclick="AppEngine.startGame('${data.gameKey}', ${ep.episodio})" class="btn btn-xs btn-primary font-bold">
                ${btnTxt}
              </button>
            </div>
          `;
        }).join("");

        // Sostituisce la vista: nessun popup dal basso!
        AppRouter.navigate("subview-series-hub");
      }
    } catch (e) {
      alert("Errore caricamento saga: " + e.message);
    }
  },

  startGame: async function(gameKey, epNum) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("dice");
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
        AppRenderer.renderGameNode(d.nodo, d.statoEroe);
      }
    } catch (e) {
      alert("Errore mossa: " + e.message);
    }
  },

  // SHOP
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
    document.getElementById("detail-shop-price").textContent = `${item.prezzoMegoin} 🪙`;
    document.getElementById("detail-shop-img").src = item.mediaUrl || "https://image.pollinations.ai/prompt/vintage-contraband-crate?width=600&height=400&nologo=true";

    const sb = document.getElementById("detail-shop-stock");
    sb.textContent = item.isDigitale ? "Digitale" : (item.isEsaurito ? "Esaurito" : `${item.stock} Disp.`);

    const btn = document.getElementById("detail-shop-action-btn");
    if (item.isLocked) {
      btn.textContent = `🔒 Richiede Piano ${item.requiredPlan}`;
      btn.className = "btn btn-warning btn-sm font-bold";
      btn.onclick = () => AppEngine.showUpgradeModal(`Piano ${item.requiredPlan}`, `Riservato agli abbonati ${item.requiredPlan}.`);
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

  openRecipeDetail: async function(rowIdx) {
    try {
      const d = await apiCall("recipe_detail", { id: rowIdx });
      if (d && d.recipe) {
        const r = d.recipe;
        document.getElementById("detail-recipe-title").textContent = r.piatto;
        document.getElementById("detail-recipe-cat").textContent = r.categoria;
        document.getElementById("detail-recipe-meta").textContent = `Costo: ${r.costo} • Difficoltà: ${r.difficolta} • ⏱️ ${r.tempo}`;
        document.getElementById("detail-recipe-ingredients").textContent = r.ingredienti || "";
        document.getElementById("detail-recipe-prep").textContent = r.preparazione || "";
        document.getElementById("detail-recipe-img").src = r.mediaUrl || "https://image.pollinations.ai/prompt/artisan-cocktail-glass-noir?width=600&height=400&nologo=true";

        const rpg = document.getElementById("detail-recipe-rpg");
        if (rpg) {
          rpg.innerHTML = `
            <div class="p-2 rounded bg-surface"><span class="text-sky-400 font-bold block">${r.rpg.destrezza || '0%'}</span>Destrezza</div>
            <div class="p-2 rounded bg-surface"><span class="text-rose-400 font-bold block">${r.rpg.forza || '0%'}</span>Forza</div>
            <div class="p-2 rounded bg-surface"><span class="text-amber-400 font-bold block">${r.rpg.gusto || '8'}/10</span>Gusto</div>
          `;
        }
        AppRouter.navigate("subview-recipe-detail");
      }
    } catch (e) {}
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
    document.getElementById("modal-plan-upgrade").showModal();
  }
};

// ----------------------------------------------------------------------------
// 4. RENDERERS GRAFICI
// ----------------------------------------------------------------------------
const AppRenderer = {
  renderProfile: function(u) {
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s("user-megoin-mob", u.saldoMegoin);
    s("user-plan-mob", u.piano);
    s("home-username", u.nome);
    s("home-megoin-card", `${u.saldoMegoin} 🪙`);
    s("home-punti-card", `${u.puntiFedelta} Pt`);

    s("user-avatar-desk", (u.nome || "U").charAt(0).toUpperCase());
    s("user-name-desk", u.nome);
    s("user-plan-desk", `PIANO ${u.piano.toUpperCase()}`);
    s("user-megoin-desk", `${u.saldoMegoin} 🪙`);

    s("profile-card-avatar", (u.nome || "U").charAt(0).toUpperCase());
    s("profile-card-name", u.nome);
    s("profile-card-username", u.username);
    s("profile-card-plan", `PIANO ${u.piano.toUpperCase()}`);
    s("profile-card-id", `ID: ${u.chatId}`);
    s("profile-card-megoin", `${u.saldoMegoin} 🪙`);
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
      <div onclick="AppEngine.openSeriesHub('${s.gameKey}')" class="bg-surface rounded-2xl border border-white/5 flex flex-col justify-between overflow-hidden cursor-pointer group shadow-lg active:scale-[0.98] transition-transform">
        <div class="h-36 md:h-44 w-full bg-slate-900 relative overflow-hidden">
          <img src="${s.mediaUrl || 'https://image.pollinations.ai/prompt/noir-docks-night-cinematic?width=400&height=250&nologo=true'}" class="w-full h-full object-cover rounded-t-2xl rounded-b-none">
          <span class="badge badge-xs badge-primary absolute top-2 left-2 font-bold uppercase text-[8px]">${s.tipologia}</span>
        </div>
        <div class="p-3.5 space-y-2">
          <div>
            <h3 class="font-black text-sm text-white">${s.emoji} ${s.serie}</h3>
            <p class="text-[10px] text-slate-400 mt-0.5">${s.episodesCount} Capitoli Disponibili</p>
          </div>
          <div class="pt-2 border-t border-white/5 flex items-center justify-between">
            <span class="text-[9px] font-bold text-sky-400 uppercase">Apri Saga</span>
            <span class="badge badge-xs badge-info font-bold">▶️ Esplora</span>
          </div>
        </div>
      </div>
    `).join("");
  },

  renderGameNode: function(node, hero) {
    document.getElementById("gameplay-node-title").textContent = node.nome || "Avventura";
    document.getElementById("gameplay-node-text").textContent = node.testo || "";
    document.getElementById("gameplay-node-img").src = node.mediaUrl || "https://image.pollinations.ai/prompt/noir-italian-docks-night-cinematic?width=600&height=600&nologo=true";

    // PULIZIA VIRGOLETTE DOPPIE
    const qBox = document.getElementById("gameplay-node-quote");
    if (node.citazione && node.citazione !== "—") {
      const cleanQ = String(node.citazione).replace(/^["'“”«»]+|["'“”«»]+$/g, "").trim();
      qBox.textContent = `"${cleanQ}" ${node.autoreCitazione ? '(' + node.autoreCitazione + ')' : ''}`;
      qBox.classList.remove("hidden");
    } else {
      qBox.classList.add("hidden");
    }

    if (hero) {
      document.getElementById("gameplay-hero-name").textContent = hero.nomeEroe;
      document.getElementById("gameplay-hero-class").textContent = hero.classe || "Avventuriero";
      document.getElementById("gameplay-pv-label").textContent = `${hero.pv}/${hero.pvMax}`;
      const bar = document.getElementById("gameplay-pv-bar");
      bar.value = hero.pv;
      bar.max = hero.pvMax;
    }

    const box = document.getElementById("gameplay-choices-container");
    const isCombat = (node.tipo === "NEMICO" || (node.id && node.id.includes("NEM_")));

    // DUELLO: ATTACCA E FUGGI AFFIANCATI A 2 COLONNE
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

    // BIVI: A vs B AFFIANCATI A 2 COLONNE
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

    const hc = document.getElementById("home-shop-count");
    if (hc) hc.textContent = AppState.shop.items.length;

    if (list.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 text-xs">Nessun articolo trovato.</div>`;
      return;
    }

    grid.innerHTML = list.map(p => `
      <div onclick="AppEngine.openShopDetail('${p.id}')" class="bg-surface rounded-2xl border border-white/5 flex flex-col justify-between overflow-hidden cursor-pointer active:scale-[0.98] transition-transform relative">
        ${p.isLocked ? `
          <div class="absolute inset-0 z-10 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center">
            <span class="text-xl mb-1">🔒</span>
            <span class="text-[8px] font-black text-amber-300 uppercase">Piano ${p.requiredPlan}</span>
          </div>
        ` : ''}
        <div class="h-28 md:h-36 w-full bg-slate-900 overflow-hidden relative">
          <img src="${p.mediaUrl || 'https://image.pollinations.ai/prompt/vintage-contraband-crate?width=300&height=200&nologo=true'}" class="w-full h-full object-cover rounded-t-2xl rounded-b-none">
          <span class="badge badge-xs ${p.isDigitale ? 'badge-info' : 'badge-neutral'} absolute top-2 left-2 text-[8px] uppercase font-bold">${p.tipo || 'Fisico'}</span>
        </div>
        <div class="p-3 space-y-2">
          <div>
            <div class="text-[8px] font-bold text-sky-400 uppercase">${p.categoria}</div>
            <h4 class="font-bold text-xs text-white line-clamp-1 mt-0.5">${p.nome}</h4>
          </div>
          <div class="pt-2 border-t border-white/5 flex items-center justify-between">
            <span class="text-xs font-black text-amber-300 text-glow-amber">${p.prezzoMegoin} 🪙</span>
            <span class="text-[9px] text-slate-400 font-bold">${p.isEsaurito ? 'Finito' : 'Dettagli'}</span>
          </div>
        </div>
      </div>
    `).join("");
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
      <div onclick="AppEngine.openRecipeDetail(${r.rowIndex})" class="bg-surface rounded-2xl border border-white/5 flex items-center justify-between p-3 cursor-pointer active:scale-[0.98] transition-transform">
        <div class="flex items-center space-x-3 overflow-hidden">
          <div class="w-11 h-11 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0">
            <img src="${r.mediaUrl || 'https://image.pollinations.ai/prompt/artisan-cocktail-glass-noir?width=150&height=150&nologo=true'}" class="w-full h-full object-cover rounded-xl">
          </div>
          <div class="overflow-hidden">
            <h4 class="font-bold text-xs text-white truncate">${r.piatto}</h4>
            <div class="text-[9px] text-slate-400 mt-0.5 truncate">${r.categoria} • ⏱️ ${r.tempo}</div>
          </div>
        </div>
        <span class="badge badge-sm badge-outline border-sky-400/40 text-sky-400 font-bold text-[9px]">${r.costo}</span>
      </div>
    `).join("");
  },

  renderTransactions: function(txs) {
    const c = document.getElementById("profile-transactions-container");
    if (!c) return;
    if (!txs || txs.length === 0) {
      c.innerHTML = `<div class="text-center py-4 text-slate-500">Nessuna transazione.</div>`;
      return;
    }
    c.innerHTML = txs.map(t => `
      <div class="py-2 flex justify-between items-center">
        <div>
          <div class="font-bold text-white text-xs">${t.tipo}</div>
          <div class="text-[9px] text-slate-400">${t.data} • ${t.dettaglio}</div>
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
      c.innerHTML = `<div class="text-center py-4 text-slate-500">Nessun file scaricato finora.</div>`;
      return;
    }
    c.innerHTML = AppState.vault.map(v => `
      <div class="p-2.5 rounded-xl bg-surface/60 border border-white/5 flex items-center justify-between">
        <div>
          <div class="font-bold text-white text-xs">${v.nome}</div>
          <div class="text-[9px] text-slate-400">${v.data}</div>
        </div>
        <a href="${v.url}" target="_blank" class="btn btn-xs btn-success font-bold">Scarica</a>
      </div>
    `).join("");
  }
};

window.addEventListener("DOMContentLoaded", () => {
  AppEngine.init();
});
