// ============================================================================
// PROJECT: ESTIQATSY PWA - CLIENT APPLICATION ENGINE
// FILE: app.js
// Router viste, cache localStorage, chiamate ad Apps Script e rendering UI
// ============================================================================

const AppConfig = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyeCWHM9X4ycwWT7IOMwg24pySL78bJT5BRyiIR5eb0UJALWuaORzfJ2lkqLrjLv0xN/exec",
  CACHE_TTL: 10 * 60 * 1000 // 10 minuti di cache in RAM per non disturbare Apps Script
};

// STATO GLOBALE DELL'APPLICAZIONE
const AppState = {
  user: null,
  activeTab: "home",
  shopItems: [],
  recipes: [],
  games: [],
  activeRecipeCategory: "tutti",
  activeShopCategory: "tutti"
};

// TELEGRAM WEBAPP SDK INITIALIZATION
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  try {
    tg.expand();
    tg.ready();
    tg.setHeaderColor("#0f172a");
    tg.setBackgroundColor("#0f172a");
  } catch (e) {}
}

// ----------------------------------------------------------------------------
// ROUTER & GESTIONE VISTE (REATTIVO MOBILE & DESKTOP)
// ----------------------------------------------------------------------------
const AppRouter = {
  navigate: function(tabName) {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");

    AppState.activeTab = tabName;

    // 1. Aggiorna Viste Mobile
    const mobileSections = ["home", "games", "gameplay", "shop", "recipes", "profile"];
    mobileSections.forEach(tab => {
      const el = document.getElementById("view-" + tab);
      if (el) el.classList.toggle("hidden", tab !== tabName);
    });

    // Aggiorna stato icone barra mobile
    document.querySelectorAll(".nav-tab").forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("text-slate-400", !isActive);
      btn.classList.toggle("active", isActive);
    });

    // 2. Aggiorna Viste Desktop (Sidebar & Titolo)
    document.querySelectorAll(".desk-nav-btn").forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("text-sky-400", isActive);
      btn.classList.toggle("bg-white/5", isActive);
      btn.classList.toggle("text-slate-300", !isActive);
    });

    const deskTitle = document.getElementById("desk-section-title");
    const titles = {
      home: "Dashboard Home",
      games: "Avventure RPG & Saghe",
      shop: "Vetrina Bottega & Shop",
      recipes: "Barlady & Ricettario",
      profile: "Profilo & Contabilità"
    };
    if (deskTitle) deskTitle.textContent = titles[tabName] || "Dashboard";

    // Mostra/Nascondi BackButton di Telegram quando sei dentro un gioco
    if (tg && tg.BackButton) {
      if (tabName === "gameplay") {
        tg.BackButton.show();
        tg.BackButton.onClick(() => AppRouter.navigate("games"));
      } else {
        tg.BackButton.hide();
      }
    }

    // Renderizza i contenuti per la vista Desktop
    AppRenderer.syncDesktopView(tabName);
  }
};

// ----------------------------------------------------------------------------
// BRIDGE API (CHIAMATE AD APPS SCRIPT CON FIRMA INITDATA)
// ----------------------------------------------------------------------------
async function apiCall(action, extraParams = {}) {
  const initData = (tg && tg.initData) ? tg.initData : "";
  let url = `${AppConfig.GAS_URL}?action=${action}&initData=${encodeURIComponent(initData)}`;
  
  for (let k in extraParams) {
    url += `&${k}=${encodeURIComponent(extraParams[k])}`;
  }

  const res = await fetch(url);
  const json = await res.json();
  if (!json.success && json.error) throw new Error(json.error);
  return json.data;
}

// ----------------------------------------------------------------------------
// MOTORE APPLICATIVO & CACHE LOCALE (ZERO-CHIAMATE INUTILI)
// ----------------------------------------------------------------------------
const AppEngine = {
  init: async function() {
    try {
      // 1. Profilo Utente
      const profileData = await apiCall("profile");
      if (profileData) {
        AppState.user = profileData;
        AppRenderer.renderUserProfile(profileData);
      }

      // 2. Caricamento Parallelo (con salvataggio in cache)
      this.loadRecipes();
      this.loadShop();
      this.loadGames();

      // SBLOCCA L'OVERLAY DELL'ANCORA CON DISSOLVENZA
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

  loadRecipes: async function() {
    // Prova prima la cache locale
    const cached = localStorage.getItem("est_recipes_cache");
    if (cached) {
      AppState.recipes = JSON.parse(cached);
      AppRenderer.renderRecipes(AppState.recipes);
    }
    // Poi aggiorna in background
    try {
      const data = await apiCall("recipes");
      if (data && data.recipes) {
        AppState.recipes = data.recipes;
        localStorage.setItem("est_recipes_cache", JSON.stringify(data.recipes));
        AppRenderer.renderRecipes(data.recipes);
      }
    } catch (e) {}
  },

  loadShop: async function() {
    const cached = localStorage.getItem("est_shop_cache");
    if (cached) {
      AppState.shopItems = JSON.parse(cached);
      AppRenderer.renderShop(AppState.shopItems);
    }
    try {
      const data = await apiCall("shop");
      if (data && data.items) {
        AppState.shopItems = data.items;
        localStorage.setItem("est_shop_cache", JSON.stringify(data.items));
        AppRenderer.renderShop(data.items);
      }
    } catch (e) {}
  },

  loadGames: async function() {
    try {
      const data = await apiCall("games");
      if (data && data.games) {
        AppState.games = data.games;
        AppRenderer.renderGames(data.games);
      }
    } catch (e) {}
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
        document.getElementById("modal-recipe-ingredients").textContent = r.ingredienti || "Nessun ingrediente elencato.";
        document.getElementById("modal-recipe-prep").textContent = r.preparazione || "Nessuna istruzione di preparazione.";
        document.getElementById("modal-recipe-img").src = r.mediaUrl || "https://image.pollinations.ai/prompt/artisan-cocktail-glass-vintage-darsena-bar-noir?width=600&height=400&nologo=true";

        // Parametri RPG
        const rpgBox = document.getElementById("modal-recipe-rpg");
        if (rpgBox && r.rpg) {
          rpgBox.innerHTML = `
            <div class="p-2 rounded bg-white/5"><span class="text-sky-400 font-bold block">${r.rpg.destrezza || '0%'}</span>Destrezza</div>
            <div class="p-2 rounded bg-white/5"><span class="text-rose-400 font-bold block">${r.rpg.forza || '0%'}</span>Forza</div>
            <div class="p-2 rounded bg-white/5"><span class="text-amber-400 font-bold block">${r.rpg.gusto || '8'}/10</span>Gusto</div>
          `;
        }
        document.getElementById("modal-recipe-detail").showModal();
      }
    } catch (e) {
      alert("Impossibile caricare il dettaglio: " + e.message);
    }
  },

  openShopDetail: function(prodId) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    const item = AppState.shopItems.find(p => p.id === prodId);
    if (!item) return;

    document.getElementById("modal-shop-title").textContent = item.nome;
    document.getElementById("modal-shop-cat").textContent = item.categoria;
    document.getElementById("modal-shop-desc").textContent = item.descrizione || "Nessuna descrizione disponibile.";
    document.getElementById("modal-shop-price").textContent = `${item.prezzoMegoin} 🪙 Megoin`;
    document.getElementById("modal-shop-img").src = item.mediaUrl || "https://image.pollinations.ai/prompt/vintage-contraband-crate-docks-noir?width=600&height=400&nologo=true";

    const buyBtn = document.getElementById("modal-shop-buy-btn");
    buyBtn.onclick = () => AppEngine.buyProduct(item.id);

    document.getElementById("modal-shop-detail").showModal();
  },

  buyProduct: async function(prodId) {
    try {
      const btn = document.getElementById("modal-shop-buy-btn");
      btn.disabled = true;
      btn.textContent = "Acquisto in corso...";

      const res = await apiCall("shop_buy", { id: prodId });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("coin");
        if (window.confetti) confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        
        // Aggiorna saldo a video
        AppState.user.saldoMegoin = res.nuovoSaldoMegoin;
        AppRenderer.renderUserProfile(AppState.user);
        
        document.getElementById("modal-shop-detail").close();
        alert(`🎉 Acquisto completato con successo!\nTransazione: ${res.txId}`);
      }
    } catch (err) {
      alert("❌ Errore durante l'acquisto: " + err.message);
    } finally {
      const btn = document.getElementById("modal-shop-buy-btn");
      btn.disabled = false;
      btn.textContent = "Acquista Ora";
    }
  },

  startGame: async function(gameKey, epNum) {
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("dice");
    try {
      const data = await apiCall("game_start", { gameKey: gameKey, episodio: epNum });
      if (data && data.success) {
        // Aggiorna saldo Megoin scalato
        AppState.user.saldoMegoin = data.nuovoSaldoMegoin;
        AppRenderer.renderUserProfile(AppState.user);

        // Mostra la scena
        AppRenderer.renderGameNode(data.nodoIniziale, data.statoEroe);
        AppRouter.navigate("gameplay");
      }
    } catch (err) {
      alert("Impossibile avviare la partita: " + err.message);
    }
  },

  syncProfile: async function() {
    try {
      const txData = await apiCall("my_transactions");
      const listContainer = document.getElementById("prof-transactions-list");
      if (listContainer && txData && txData.transactions) {
        if (txData.transactions.length === 0) {
          listContainer.innerHTML = "<div class='text-center py-3 text-slate-500'>Nessuna transazione registrata finora.</div>";
        } else {
          listContainer.innerHTML = txData.transactions.map(t => `
            <div class="py-2 flex justify-between items-center">
              <div>
                <div class="font-bold text-white text-xs">${t.tipo}</div>
                <div class="text-[10px] text-slate-400">${t.data} • ${t.dettaglio}</div>
              </div>
              <div class="font-bold ${t.megoin.includes('+') ? 'text-emerald-400' : 'text-amber-400'} text-xs">
                ${t.megoin}
              </div>
            </div>
          `).join("");
        }
      }
    } catch (e) {}
  }
};

// ----------------------------------------------------------------------------
// RENDERER GRAFICO (DOM BUILDER PER MOBILE E DESKTOP)
// ----------------------------------------------------------------------------
const AppRenderer = {
  renderUserProfile: function(u) {
    document.getElementById("user-megoin-mob").textContent = u.saldoMegoin;
    document.getElementById("user-plan-badge-mob").textContent = u.piano.toUpperCase();
    document.getElementById("home-username").textContent = u.nome;
    document.getElementById("home-punti").textContent = u.puntiFedelta + " Pt";
    
    // Desktop Header
    const dAvatar = document.getElementById("user-avatar-desk");
    const dName = document.getElementById("user-name-desk");
    const dPlan = document.getElementById("user-plan-badge-desk");
    const dMegoin = document.getElementById("user-megoin-desk");
    if (dAvatar) dAvatar.textContent = (u.nome || "U").charAt(0).toUpperCase();
    if (dName) dName.textContent = u.nome;
    if (dPlan) dPlan.textContent = "PIANO " + u.piano.toUpperCase();
    if (dMegoin) dMegoin.textContent = u.saldoMegoin + " 🪙";

    // Scheda Profilo
    const pName = document.getElementById("prof-name");
    const pUser = document.getElementById("prof-username");
    const pPlan = document.getElementById("prof-plan");
    const pId = document.getElementById("prof-id");
    if (pName) pName.textContent = u.nome;
    if (pUser) pUser.textContent = u.username;
    if (pPlan) pPlan.textContent = u.piano.toUpperCase();
    if (pId) pId.textContent = "ID: " + u.chatId;

    document.getElementById("shop-balance-pill").textContent = `Saldo: ${u.saldoMegoin} 🪙`;
  },

  renderRecipes: function(list) {
    const c = document.getElementById("recipes-list-mob");
    if (!c) return;
    c.innerHTML = list.map(r => `
      <div onclick="AppEngine.openRecipeDetail(${r.rowIndex})" class="glass-card p-3 rounded-xl flex items-center justify-between border border-white/5 active:scale-95 transition-transform cursor-pointer">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
            <img src="${r.mediaUrl || 'https://image.pollinations.ai/prompt/artisan-cocktail-glass-vintage-darsena-bar-noir?width=100&height=100&nologo=true'}" class="w-full h-full object-cover">
          </div>
          <div>
            <h4 class="font-bold text-xs text-white">${r.piatto}</h4>
            <span class="text-[10px] text-slate-400">${r.categoria} • ⏱️ ${r.tempo}</span>
          </div>
        </div>
        <span class="text-xs font-bold text-sky-400">${r.costo}</span>
      </div>
    `).join("");
  },

  renderShop: function(items) {
    const c = document.getElementById("shop-grid-mob");
    if (!c) return;
    c.innerHTML = items.map(p => `
      <div onclick="AppEngine.openShopDetail('${p.id}')" class="glass-card p-2.5 rounded-xl border border-white/5 flex flex-col justify-between active:scale-95 transition-transform cursor-pointer">
        <div class="h-24 w-full rounded-lg bg-slate-800 overflow-hidden mb-2">
          <img src="${p.mediaUrl || 'https://image.pollinations.ai/prompt/vintage-contraband-crate-docks-noir?width=200&height=200&nologo=true'}" class="w-full h-full object-cover">
        </div>
        <div>
          <div class="text-[9px] text-sky-400 font-bold uppercase">${p.categoria}</div>
          <h4 class="font-bold text-xs text-white line-clamp-1">${p.nome}</h4>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-xs font-black text-amber-300">${p.prezzoMegoin} 🪙</span>
          <span class="badge badge-xs badge-primary font-bold">Dettagli</span>
        </div>
      </div>
    `).join("");
  },

  renderGames: function(games) {
    const c = document.getElementById("games-list-container");
    if (!c) return;
    c.innerHTML = games.map(g => `
      <div class="glass-card p-4 rounded-2xl border border-white/10 space-y-3">
        <div class="flex justify-between items-center">
          <div>
            <span class="badge badge-sm badge-secondary text-[9px] font-bold uppercase">${g.tipologia || 'Avventura'}</span>
            <h3 class="text-sm font-black text-white mt-1">${g.titolo}</h3>
          </div>
          <span class="text-xs text-slate-400">${g.episodi.length} Episodi</span>
        </div>
        <div class="space-y-1.5 pt-1">
          ${g.episodi.map(ep => `
            <button onclick="AppEngine.startGame('${g.gameKey}', ${ep.numero})" class="w-full py-2 px-3 rounded-xl bg-slate-900/60 hover:bg-sky-600/20 border border-white/5 flex items-center justify-between text-xs text-slate-200 active:scale-95 transition-all">
              <span>${ep.emoji || '▶️'} Ep. ${ep.numero}: <b>${ep.titolo}</b></span>
              <span class="text-[10px] font-bold text-amber-400">1 🪙</span>
            </button>
          `).join("")}
        </div>
      </div>
    `).join("");
  },

  renderGameNode: function(node, hero) {
    document.getElementById("gameplay-node-title").textContent = node.nome;
    document.getElementById("gameplay-node-text").textContent = node.testo;
    document.getElementById("gameplay-node-img").src = node.mediaUrl || "https://image.pollinations.ai/prompt/noir-italian-docks-night-cinematic?width=600&height=300&nologo=true";
    
    const quoteEl = document.getElementById("gameplay-node-quote");
    if (node.citazione) {
      quoteEl.textContent = `"${node.citazione}" ${node.autoreCitazione ? '(' + node.autoreCitazione + ')' : ''}`;
      quoteEl.classList.remove("hidden");
    } else {
      quoteEl.classList.add("hidden");
    }

    if (hero) {
      document.getElementById("gameplay-hero-name").textContent = hero.nomeEroe;
      document.getElementById("gameplay-hero-class").textContent = hero.classe || "Avventuriero";
      document.getElementById("gameplay-pv-label").textContent = `${hero.pv}/${hero.pvMax}`;
      const bar = document.getElementById("gameplay-pv-bar");
      bar.value = hero.pv;
      bar.max = hero.pvMax;
    }

    // Pulsanti di Scelta Bivio
    const choiceBox = document.getElementById("gameplay-choices-container");
    if (node.parsedBivio && node.parsedBivio.length > 0) {
      choiceBox.innerHTML = node.parsedBivio.map(b => `
        <button onclick="AppEngine.advanceNode('${b.target}')" class="btn btn-block btn-sm btn-primary text-xs font-bold shadow-lg shadow-sky-600/20">
          ${b.testo}
        </button>
      `).join("");
    } else {
      choiceBox.innerHTML = `
        <button onclick="AppRouter.navigate('games')" class="btn btn-block btn-sm btn-outline text-xs font-bold">
          🏠 Torna alla Lista Episodi
        </button>
      `;
    }
  },

  syncDesktopView: function(tabName) {
    const dArea = document.getElementById("desktop-content-area");
    if (!dArea) return;
    
    // Su Desktop clona il contenuto della vista attiva adattandolo alla griglia a più colonne
    const activeSection = document.getElementById("view-" + tabName);
    if (activeSection) {
      dArea.innerHTML = activeSection.innerHTML;
    }
  }
};

// AVVIO ALL'APERTURA DELLA PAGINA
window.addEventListener("DOMContentLoaded", () => {
  AppEngine.init();
});
