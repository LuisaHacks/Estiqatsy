// ============================================================================
// PROJECT: ESTIQATSY PWA - CLIENT APPLICATION ENGINE (TRANCHE 3)
// FILE: app.js
// Architettura: Omni-Module, Soft-Gating, Visual Novel Game Shell,
//               Cache Client-Side, Instant Search e Vault Digitale
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

// STATO GLOBALE REATTIVO DELLA PWA
const AppState = {
  user: null,
  allowedModules: { home: true, shop: true, games: true, recipes: true, profile: true },
  activeTab: "home",
  shop: {
    items: [],
    categories: [],
    activeCategory: "tutti",
    searchQuery: ""
  },
  recipes: {
    items: [],
    categories: [],
    activeCategory: "tutti",
    searchQuery: ""
  },
  games: {
    gallery: [],
    activeGameKey: "game1",
    activeEp: 1,
    session: null,
    searchQuery: ""
  },
  vault: [] // Prodotti digitali acquistati / sbloccati
};

// SDK TELEGRAM WEBAPP
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  try {
    tg.expand();
    tg.ready();
    tg.setHeaderColor("#090D16");
    tg.setBackgroundColor("#090D16");
  } catch (e) {}
}

// ----------------------------------------------------------------------------
// 1. ROUTER VISTE & GESTIONE ADATTIVA (MOBILE & DESKTOP)
// ----------------------------------------------------------------------------
const AppRouter = {
  navigate: function(tabName) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();

    // Controllo Hard-Gating: se il modulo non è permesso, blocca
    if (tabName !== "home" && tabName !== "profile" && tabName !== "gameplay") {
      if (AppState.allowedModules && !AppState.allowedModules[tabName]) {
        AppEngine.showUpgradeModal("Modulo Non Incluso", "Questa sezione non è compresa nel tuo piano di abbonamento.");
        return;
      }
    }

    AppState.activeTab = tabName;

    // 1. Switch Viste (Mobile e Desktop condividono lo stesso DOM responsive)
    const views = ["home", "games", "gameplay", "shop", "recipes", "profile"];
    views.forEach(v => {
      const el = document.getElementById("view-" + v);
      if (el) el.classList.toggle("hidden", v !== tabName);
    });

    // 2. Aggiornamento stato Bottoni Navigazione Mobile
    document.querySelectorAll(".nav-tab").forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("text-slate-400", !isActive);
    });

    // 3. Aggiornamento stato Sidebar Desktop
    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("bg-white/5", isActive);
      btn.classList.toggle("text-slate-300", !isActive);
    });

    // 4. Titolo Testata Desktop
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

    // 5. Gestione BackButton Nativo Telegram
    if (tg && tg.BackButton) {
      if (tabName === "gameplay") {
        tg.BackButton.show();
        tg.BackButton.onClick(() => AppRouter.navigate("games"));
      } else {
        tg.BackButton.hide();
      }
    }

    // Refresh icone Lucide
    if (window.lucide) lucide.createIcons();
  }
};

// ----------------------------------------------------------------------------
// 2. CLIENT API DI RETE (CHIAMATE AD APPS SCRIPT)
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
// 3. ENGINE CENTRALE (LOGICA, CACHE & DISPATCHING)
// ----------------------------------------------------------------------------
const AppEngine = {
  init: async function() {
    this.loadVaultFromStorage();

    try {
      // 1. Profilo Utente & Permessi Macro Moduli (Hard Gating)
      const profilePayload = await apiCall("profile");
      if (profilePayload && profilePayload.user) {
        AppState.user = profilePayload.user;
        AppState.allowedModules = profilePayload.allowedModules || AppState.allowedModules;
        AppRenderer.renderProfile(profilePayload.user);
        this.applyHardGating(AppState.allowedModules);
      }

      // 2. Caricamento Parallelo Cataloghi (Shop, Ricette, Giochi, Transazioni)
      await Promise.allSettled([
        this.fetchShop(),
        this.fetchRecipes(),
        this.fetchGames(),
        this.syncTransactions(false)
      ]);

      // Rimuovi loader con dissolvenza
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

  // Applica Hard-Gating nascondendo i moduli non previsti dal piano
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
  // SHOP & COMMERCE
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
    } catch (e) {
      console.warn("Shop fetch fallback:", e);
    }
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

  openShopDetail: async function(prodId) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    const item = AppState.shop.items.find(p => p.id === prodId);
    if (!item) return;

    document.getElementById("modal-shop-title").textContent = item.nome;
    document.getElementById("modal-shop-cat").textContent = item.categoria;
    document.getElementById("modal-shop-desc").textContent = item.descrizione || "Nessuna descrizione disponibile.";
    document.getElementById("modal-shop-price").textContent = `${item.prezzoMegoin} 🪙 Megoin`;
    document.getElementById("modal-shop-img").src = item.mediaUrl || "https://image.pollinations.ai/prompt/vintage-contraband-crate-docks-noir?width=600&height=400&nologo=true";

    // Stock badge
    const stockBadge = document.getElementById("modal-shop-stock");
    if (item.isDigitale) {
      stockBadge.textContent = "Digitale (Immediato)";
      stockBadge.className = "badge badge-sm badge-info absolute top-3 right-3 font-bold";
    } else if (item.isEsaurito) {
      stockBadge.textContent = "Esaurito";
      stockBadge.className = "badge badge-sm badge-error absolute top-3 right-3 font-bold";
    } else {
      stockBadge.textContent = `${item.stock} Disp.`;
      stockBadge.className = "badge badge-sm badge-success absolute top-3 right-3 font-bold";
    }

    // Varianti
    const varBox = document.getElementById("modal-shop-variants-box");
    const varContainer = document.getElementById("modal-shop-variants");
    if (item.varianti && item.varianti.length > 0) {
      varContainer.innerHTML = item.varianti.map((v, i) => `
        <span class="badge badge-sm ${i === 0 ? 'badge-primary' : 'badge-outline'} cursor-pointer">${v}</span>
      `).join("");
      varBox.classList.remove("hidden");
    } else {
      varBox.classList.add("hidden");
    }

    // Tasto di Azione (Soft-Gating o Acquisto)
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

        // Aggiorna saldo utente
        AppState.user.saldoMegoin = res.nuovoSaldoMegoin;
        AppRenderer.renderProfile(AppState.user);

        // Se prodotto digitale con download, salva nel Vault del profilo
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
  // RICETTE & COCKTAILS
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
    } catch (e) {
      console.warn("Recipes fetch fallback:", e);
    }
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
        document.getElementById("modal-recipe-ingredients").textContent = r.ingredienti || "Nessun ingrediente specificato.";
        document.getElementById("modal-recipe-prep").textContent = r.preparazione || "Nessuna preparazione specificata.";
        document.getElementById("modal-recipe-img").src = r.mediaUrl || "https://image.pollinations.ai/prompt/artisan-cocktail-glass-vintage-darsena-bar-noir?width=600&height=400&nologo=true";

        // Parametri RPG
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
  // GIOCHI, NARRATIVA & GAME SHELL
  // ==========================================================================
  fetchGames: async function() {
    try {
      const data = await apiCall("games");
      if (data && data.games) {
        AppState.games.gallery = data.games;
        AppRenderer.renderGames();
      }
    } catch (e) {
      console.warn("Games fetch error:", e);
    }
  },

  filterGames: function() {
    const input = document.getElementById("games-search-input");
    AppState.games.searchQuery = input ? input.value.trim().toLowerCase() : "";
    AppRenderer.renderGames();
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

  // RISOLUZIONE BIVIO: Navigazione fluida tra nodi di gioco
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
        // Se vittoria finale o checkpoint ricompense
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
  // TRANSAZIONI & CAVEAU DIGITALE (VAULT)
  // ==========================================================================
  syncTransactions: async function(force = false) {
    const cached = localStorage.getItem(AppConfig.CACHE_KEYS.TRANSACTIONS);
    if (!force && cached) {
      try {
        const txs = JSON.parse(cached);
        AppRenderer.renderTransactions(txs);
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

  // Modali di Sistema
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
// 4. RENDERERS GRAFICI (OMNI-MODULE DESIGN REATTIVO)
// ----------------------------------------------------------------------------
const AppRenderer = {
  renderProfile: function(u) {
    // Header & Mobile Bar
    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setT("user-megoin-mob", u.saldoMegoin);
    setT("user-plan-mob", u.piano);
    setT("home-username", u.nome);
    setT("home-megoin-card", `${u.saldoMegoin} 🪙`);
    setT("home-punti-card", `${u.puntiFedelta} Pt`);

    // Desktop Header
    setT("user-avatar-desk", (u.nome || "U").charAt(0).toUpperCase());
    setT("user-name-desk", u.nome);
    setT("user-plan-desk", `PIANO ${u.piano.toUpperCase()}`);
    setT("user-megoin-desk", `${u.saldoMegoin} 🪙`);
    setT("desk-header-megoin", `${u.saldoMegoin} Megoin 🪙`);
    setT("shop-user-balance", `${u.saldoMegoin} 🪙`);

    // Scheda Apple Wallet Profilo
    setT("profile-card-avatar", (u.nome || "U").charAt(0).toUpperCase());
    setT("profile-card-name", u.nome);
    setT("profile-card-username", u.username);
    setT("profile-card-plan", `PIANO ${u.piano.toUpperCase()}`);
    setT("profile-card-id", `ID: ${u.chatId}`);
    setT("profile-card-megoin", `${u.saldoMegoin} 🪙 Megoin`);
  },

  renderShop: function() {
    // Categorie Chips Dinamiche
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
    
    // Filtro categoria
    if (AppState.shop.activeCategory !== "tutti") {
      items = items.filter(p => p.categoria.toLowerCase() === AppState.shop.activeCategory.toLowerCase());
    }

    // Filtro ricerca
    if (AppState.shop.searchQuery) {
      items = items.filter(p => 
        p.nome.toLowerCase().includes(AppState.shop.searchQuery) ||
        (p.descrizione && p.descrizione.toLowerCase().includes(AppState.shop.searchQuery))
      );
    }

    const homeShopCount = document.getElementById("home-shop-count");
    if (homeShopCount) homeShopCount.textContent = AppState.shop.items.length;

    if (items.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500 text-xs">Nessun articolo trovato per questa ricerca.</div>`;
      return;
    }

    grid.innerHTML = items.map(p => `
      <div onclick="AppEngine.openShopDetail('${p.id}')" class="glass-panel p-3 rounded-2xl border border-white/5 flex flex-col justify-between active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group">
        <!-- Badge Soft-Gating se bloccato -->
        ${p.isLocked ? `
          <div class="absolute inset-0 z-10 badge-soft-lock flex flex-col items-center justify-center p-3 text-center">
            <span class="text-xl mb-1">🔒</span>
            <span class="text-[9px] font-black text-amber-300 uppercase tracking-wider">Riservato a ${p.requiredPlan}</span>
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

  renderGames: function() {
    const c = document.getElementById("games-gallery-container");
    if (!c) return;

    let games = AppState.games.gallery;
    if (AppState.games.searchQuery) {
      games = games.filter(g => 
        g.titolo.toLowerCase().includes(AppState.games.searchQuery) ||
        g.serie.toLowerCase().includes(AppState.games.searchQuery)
      );
    }

    const homeGamesCount = document.getElementById("home-games-count");
    if (homeGamesCount) homeGamesCount.textContent = AppState.games.gallery.length;

    if (games.length === 0) {
      c.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500 text-xs">Nessuna saga trovata.</div>`;
      return;
    }

    c.innerHTML = games.map(g => `
      <div class="glass-panel p-5 rounded-3xl border border-white/10 space-y-4 shadow-xl">
        <div class="flex justify-between items-start">
          <div>
            <span class="badge badge-xs badge-secondary font-bold uppercase text-[8px]">${g.tipologia || 'Avventura'}</span>
            <h3 class="text-base font-black text-white mt-1">${g.titolo}</h3>
          </div>
          <span class="text-[10px] font-mono text-slate-400">${g.episodi.length} Capitoli</span>
        </div>
        <div class="space-y-2">
          ${g.episodi.map(ep => `
            <button onclick="AppEngine.startGame('${g.gameKey}', ${ep.numero})" class="w-full py-2.5 px-3.5 rounded-xl bg-surface/70 hover:bg-sky-600/20 border border-white/5 flex items-center justify-between text-xs text-slate-200 active:scale-[0.98] transition-all">
              <span class="truncate pr-2">${ep.emoji || '▶️'} Ep. ${ep.numero}: <b>${ep.titolo}</b></span>
              <span class="text-[10px] font-bold text-amber-400 font-mono flex-shrink-0">${ep.costoMegoin} 🪙</span>
            </button>
          `).join("")}
        </div>
      </div>
    `).join("");
  },

  renderGameNode: function(node, hero) {
    document.getElementById("gameplay-node-title").textContent = node.nome;
    document.getElementById("gameplay-node-text").textContent = node.testo;
    document.getElementById("gameplay-node-img").src = node.mediaUrl || "https://image.pollinations.ai/prompt/noir-italian-docks-night-cinematic?width=800&height=400&nologo=true";
    document.getElementById("gameplay-node-badge").textContent = node.tipo || "SNODO";

    const q = document.getElementById("gameplay-node-quote");
    if (node.citazione) {
      q.textContent = `"${node.citazione}" ${node.autoreCitazione ? '(' + node.autoreCitazione + ')' : ''}`;
      q.classList.remove("hidden");
    } else {
      q.classList.add("hidden");
    }

    if (hero) {
      document.getElementById("gameplay-hero-name").textContent = hero.nomeEroe;
      document.getElementById("gameplay-hero-class").textContent = hero.classe || "Avventuriero";
      document.getElementById("gameplay-pv-label").textContent = `${hero.pv}/${hero.pvMax} PV`;
      const bar = document.getElementById("gameplay-pv-bar");
      bar.value = hero.pv;
      bar.max = hero.pvMax;
    }

    // Rendering scelte a bivi
    const choicesBox = document.getElementById("gameplay-choices-container");
    if (node.parsedBivio && node.parsedBivio.length > 0) {
      choicesBox.innerHTML = node.parsedBivio.map(b => `
        <button onclick="AppEngine.advanceNode('${b.target}')" class="btn btn-block btn-md btn-primary text-xs font-bold shadow-lg shadow-sky-600/20 active:scale-[0.98] transition-all">
          ${b.testo}
        </button>
      `).join("");
    } else {
      choicesBox.innerHTML = `
        <button onclick="AppRouter.navigate('games')" class="btn btn-block btn-md btn-outline border-white/20 text-xs font-bold">
          🏠 Torna alla Galleria Saghe
        </button>
      `;
    }
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
        <a href="${v.url}" target="_blank" class="btn btn-xs btn-success font-bold">
          📥 Scarica
        </a>
      </div>
    `).join("");
  }
};

// ============================================================================
// INIZIALIZZAZIONE AUTOMATICA
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  AppEngine.init();
});
