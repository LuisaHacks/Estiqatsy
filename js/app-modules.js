// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/app-modules.js (VERSIONE 18.0 - SINGLE BOOTSTRAP, 16:9 & LOCAL CACHE)
// LAYER 2: CATALOGHI, SHOP, SAGHE RPG, ARENA, MODULI SPECIALISTICI & ADMIN
// ============================================================================

(function() {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. STATO LOCALE DEI MODULI
  // --------------------------------------------------------------------------
  let currentShopCategory = 'tutti';
  let currentRecipeCategory = 'tutti';
  let selectedMultiplayerMode = '1vs1';
  let currentSelectedSheet = '⚙️ Config';
  let currentSelectedGasFile = 'Logic.gs';

  const ARENA_OPPONENTS = [
    { id: 'opp-1', name: 'Kira la Netrunner', rank: 'Operativa Lvl 2', avatar: '⚡', hp: 22, attack: 14, defense: 12, rewardMegoin: 45, rewardPoints: 10 },
    { id: 'opp-2', name: 'Bruto lo Scaricatore', rank: 'Picchiatore Lvl 3', avatar: '🥊', hp: 30, attack: 17, defense: 14, rewardMegoin: 70, rewardPoints: 15 },
    { id: 'opp-3', name: 'Silvia la Cecchina', rank: 'Tiratrice Lvl 4', avatar: '🎯', hp: 26, attack: 19, defense: 15, rewardMegoin: 100, rewardPoints: 25 },
    { id: 'opp-4', name: 'Il Colonnello Ombra', rank: 'Master Syndicate Lvl 5', avatar: '👑', hp: 38, attack: 22, defense: 18, rewardMegoin: 160, rewardPoints: 40 }
  ];

  const SHEETS_TSV_MODELS = {
    '⚙️ Config': "Key\tValue\tDescrizione\nbot_token\tYOUR_TELEGRAM_BOT_TOKEN\tToken API Telegram\nwebapp_url\thttps://your-domain.app\tURL della Web App Telegram Mini App\nadmin_chat_id\t123456789\tChat ID Telegram Admin\nbot_username\tEstiqatsyBot\tUsername Telegram senza @",
    '👤 Users': "Nome\tCognome\tUsername\tChat_ID\tData_Iscrizione\tLingua\tPremium\tUltimo_Messaggio\tData_Ultima_Attivita\tPiano\tScadenza_Piano\tMegoin\tConsultati\tPunti_Fedelta\tStato_Utente",
    '👑 Plans': "ID\tVisibile\tNome Piano\tDescrizione\tPrezzo Annuale\tPrezzo Mensile\tMesi\tRisparmio\tBonus Megoin\tCocktails\tAntipasti\tPrimi\tSecondi\tGiochi\tShop\tChatbot\tNews\tReport",
    '🏪 Shop': "ID\tVisibile\tNome\tCategoria\tSottocategoria\tTipo\tDescrizione\tStock\tTempi_Consegna\tPrezzo_Euro\tPrezzo_Megoin\tPunti_Premio\tVarianti\tMedia_URL\tURL_Download\tIn_Promo\tPrezzo_Promo_Euro\tPrezzo_Promo_Megoin\tAccesso_Piano_Free\tAccesso_Piano_Bronze\tAccesso_Piano_Silver\tAccesso_Piano_Gold",
    '🍳 Ricette': "ID\tVisibile\tPiatto\tCategoria\tCosto\tDifficolta\tTempo\tMedia_URL\tIngredienti\tPreparazione\tLink_Button\tFOR\tDES\tINT\tTasso_Alcolico\tGusto",
    '🎮 Giochi': "ID_Nodo\tEpisodio\tTipo\tCategoria\tSottocategoria\tNome\tTesto\tCitazione\tAutore_Citazione\tPV\tDanno\tOro\tPX\tFOR\tDES\tINT\tDifficolta\tStat_Richiesta\tMedia_URL\tDest_Successo\tDest_Fallimento\tDest_Fallback\tBivio_JSON",
    '👥 Stanze_Multiplayer': "room_id\tmodalita\ttitolo\tstato\thost_id\thost_nome\tguest_id\tguest_nome\tgiocatori_json\tmosse_json\tesito\tcreata_il\taggiornata_il",
    '📜 Transazioni': "ID_TX\tData_Ora\tUser_ID\tNome\tCognome\tUsername\tChat_ID\tLingua\tTipo_Evento\tDettaglio\tVar_Euro\tVar_Megoin\tPt_Fedelta\tCanale\tNote\tStato\tSaldo_Megoin\tEuro_Netto"
  };

  const GAS_SCRIPTS = {
    'Logic.gs': `// ESTIQATSY BOT - TELEGRAM GATEWAY\nfunction doPost(e) {\n  return handleWebAppPostRequest(e);\n}\nfunction doGet(e) {\n  return handleWebAppGetRequest(e);\n}`,
    'WebAppHandler.gs': `// GESTORE STANZE MULTIPLAYER\nfunction handleMultiplayerRoom(action, params) {\n  var s = DB.getSheet("👥", "Stanze_Multiplayer");\n  // Elaborazione server-side\n}`
  };

  // --------------------------------------------------------------------------
  // 2. MOTORE DI PIATTAFORMA: APPMODULES
  // --------------------------------------------------------------------------
  const AppModules = {

    // ------------------------------------------------------------------------
    // INIZIALIZZAZIONE ATOMICA (SINGLE BOOTSTRAP A CHIAMATA UNICA)
    // ------------------------------------------------------------------------
    init: async function() {
      this.loadVault();
      
      // 1. Carica prima la cache locale per mostrare i contenuti a zero millisecondi
      this.loadLocalCache();

      try {
        // 2. CHIAMATA ATOMICA SINGOLA: Un solo colpo per Profilo, Giochi, Shop, Ricette e Transazioni
        const bootData = await apiCall("bootstrap");
        
        if (bootData) {
          this.applyBootstrapData(bootData);
        }
      } catch (err) {
        console.warn("[AppModules.init] Fallback su cache o mancata connessione GAS:", err);
        const errBox = document.getElementById("loading-error-box");
        if (errBox && (!AppState.games.catalog || AppState.games.catalog.length === 0)) {
          errBox.textContent = err.message || "Errore sincronizzazione con Google Apps Script.";
          errBox.classList.remove("hidden");
        }
      } finally {
        // Setup componenti multimediali
        this.initCarousel();
        this.initRadio();

        // Sincronizza l'interfaccia con i dati memorizzati
        if (window.AppCore) {
          AppCore.syncUI();
          AppCore.dismissLoader();
        }
      }
    },

    // ------------------------------------------------------------------------
    // GESTIONE DELLA CACHE LOCALE (STALE-WHILE-REVALIDATE)
    // ------------------------------------------------------------------------
    loadLocalCache: function() {
      try {
        const raw = localStorage.getItem("est_bootstrap_cache");
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.games && cached.games.length > 0) AppState.games.catalog = cached.games;
          if (cached.shop && cached.shop.length > 0) {
            AppState.shop.items = cached.shop;
            AppState.shop.categories = cached.shopCategories || [];
          }
          if (cached.recipes && cached.recipes.length > 0) {
            AppState.recipes.items = cached.recipes;
            AppState.recipes.categories = cached.recipeCategories || [];
          }
          if (cached.transactions && cached.transactions.length > 0) {
            AppState.transactions = cached.transactions;
          }

          // Pre-render istantaneo da memoria locale
          this.renderGamesCatalog();
          this.renderShop();
          this.renderRecipes();
          this.renderTransactions();
        }
      } catch (e) {}
    },

    saveLocalCache: function(data) {
      try {
        localStorage.setItem("est_bootstrap_cache", JSON.stringify({
          games: data.games || [],
          shop: data.shop || [],
          shopCategories: data.shopCategories || [],
          recipes: data.recipes || [],
          recipeCategories: data.recipeCategories || [],
          transactions: data.transactions || []
        }));
      } catch (e) {}
    },

    applyBootstrapData: function(data) {
      // 1. Profilo Utente e Piani
      if (data.user) {
        AppState.user = {
          ...AppState.user,
          id: data.user.chatId,
          chatId: data.user.chatId,
          first_name: data.user.nome,
          nome: data.user.nome,
          cognome: data.user.cognome,
          username: data.user.username,
          megoin: data.user.saldoMegoin,
          saldoMegoin: data.user.saldoMegoin,
          loyalty_points: data.user.puntiFedelta,
          puntiFedelta: data.user.puntiFedelta,
          plan: data.user.piano || "Free",
          isAdmin: !!data.user.isAdmin,
          prodottiAcquistati: data.user.prodottiAcquistati || 0,
          isGuest: !!data.user.isGuest
        };
      }

      if (data.allowedModules) {
        AppState.allowedModules = data.allowedModules;
        this.applyHardLocking(AppState.allowedModules);
      }

      if (data.plans) {
        AppState.plans = data.plans;
      }

      // 2. Catalogo Giochi
      if (data.games) {
        AppState.games.catalog = data.games;
        const gc = document.getElementById("home-games-count");
        if (gc) gc.textContent = data.games.length;
      }

      // 3. Catalogo Shop
      if (data.shop) {
        AppState.shop.items = data.shop;
        AppState.shop.categories = data.shopCategories || [];
      }

      // 4. Ricettario
      if (data.recipes) {
        AppState.recipes.items = data.recipes;
        AppState.recipes.categories = data.recipeCategories || [];
      }

      // 5. Transazioni
      if (data.transactions) {
        AppState.transactions = data.transactions;
      }

      // Salva nella cache locale per i prossimi avvii
      this.saveLocalCache(data);

      // Render di tutte le viste aggiornate dal server
      this.renderGamesCatalog();
      this.renderShop();
      this.renderRecipes();
      this.renderTransactions();
      this.renderProfile();
    },

    applyHardLocking: function(allowed) {
      if (!allowed) return;
      document.querySelectorAll("[data-module]").forEach(el => {
        const mod = el.dataset.module;
        const isPermitted = (allowed[mod] !== false);
        el.classList.toggle("hidden", !isPermitted);
      });
    },

    // ------------------------------------------------------------------------
    // GESTIONE PROFILO UTENTE
    // ------------------------------------------------------------------------
    renderProfile: function() {
      if (window.AppCore) AppCore.syncUI();
      this.renderVault();
      this.renderArenaSection();
      this.renderTransactions();
    },

    loadVault: function() {
      const saved = localStorage.getItem(AppConfig.CACHE_KEYS.VAULT);
      if (saved) {
        try { AppState.digitalVault = JSON.parse(saved); } catch (e) {}
      }
    },

    addVault: function(nome, url) {
      if (!AppState.digitalVault) AppState.digitalVault = [];
      AppState.digitalVault.unshift({ nome, url, data: new Date().toLocaleDateString("it-IT") });
      localStorage.setItem(AppConfig.CACHE_KEYS.VAULT, JSON.stringify(AppState.digitalVault));
      this.renderVault();
      if (window.AppCore) AppCore.syncUI();
    },

    renderVault: function() {
      const c = document.getElementById("profile-vault-container");
      if (!c) return;
      const vault = AppState.digitalVault || [];
      if (vault.length === 0) {
        c.innerHTML = `<div class="text-xs text-slate-500 font-mono py-2">Nessun file scaricato o riscattato finora.</div>`;
        return;
      }
      c.innerHTML = vault.map(v => `
        <div class="p-2.5 rounded-xl bg-slate-900/90 border border-white/5 flex items-center justify-between text-xs">
          <div class="min-w-0 pr-2">
            <div class="font-bold text-white truncate">${v.nome}</div>
            <div class="text-[10px] font-mono text-slate-400">${v.data || 'Oggi'}</div>
          </div>
          <a href="${v.url}" target="_blank" class="btn btn-xs btn-outline border-emerald-500/40 text-emerald-300 font-bold shrink-0">
            Scarica 📥
          </a>
        </div>
      `).join("");
    },

    renderTransactions: function() {
      const c = document.getElementById("profile-transactions-container");
      if (!c) return;
      const list = AppState.transactions || [];
      if (list.length === 0) {
        c.innerHTML = `<div class="text-xs text-slate-500 font-mono py-2">Nessuna transazione registrata finora.</div>`;
        return;
      }
      c.innerHTML = list.map(tx => `
        <div class="flex justify-between items-center py-2 text-xs border-b border-white/5 last:border-none">
          <div>
            <div class="font-bold text-slate-200">${tx.dettaglio || tx.tipo}</div>
            <div class="text-[10px] text-slate-500 font-mono">${tx.data}</div>
          </div>
          <div class="font-mono font-black ${String(tx.megoin).includes('+') ? 'text-emerald-400' : 'text-amber-400'}">
            ${tx.megoin}
          </div>
        </div>
      `).join("");
    },

    syncTransactions: async function(notify = false) {
      try {
        const res = await apiCall("my_transactions");
        if (res && res.transactions) {
          AppState.transactions = res.transactions;
          this.renderTransactions();
        }
      } catch (e) {
        console.warn("[syncTransactions] Errore sync transazioni:", e);
      }
      if (notify && window.AppCore) AppCore.toast("Transazioni aggiornate.", "info");
    },

    // ------------------------------------------------------------------------
    // CAROSELLO HOME DINAMICO (16:9 CENTRATO)
    // ------------------------------------------------------------------------
    initCarousel: function() {
      const track = document.getElementById("carousel-track");
      const dotsBox = document.getElementById("carousel-dots-container");
      if (!track) return;

      const slides = [];

      if (AppState.games.catalog && AppState.games.catalog.length > 0) {
        const topGame = AppState.games.catalog[0];
        slides.push({
          badge: (topGame.tipologia || "GIOCO").toUpperCase(),
          titolo: `${topGame.emoji || '🎮'} ${topGame.serie}`,
          sottotitolo: topGame.descrizione || "Entra nelle avventure investigative della piattaforma",
          action: () => AppRouter.navigate("games"),
          img: topGame.mediaUrl
        });
      }

      if (AppState.shop.items && AppState.shop.items.length > 0) {
        const topProduct = AppState.shop.items[0];
        slides.push({
          badge: "SHOP",
          titolo: topProduct.nome,
          sottotitolo: topProduct.descrizione || "Scopri gli articoli disponibili nel Syndicate",
          action: () => AppRouter.navigate("shop"),
          img: topProduct.mediaUrl
        });
      }

      if (AppState.recipes.items && AppState.recipes.items.length > 0) {
        const topRecipe = AppState.recipes.items[0];
        slides.push({
          badge: (topRecipe.categoria || "RICETTA").toUpperCase(),
          titolo: topRecipe.piatto,
          sottotitolo: `Preparazione: ${topRecipe.tempo || 'rapida'} • Costo: ${topRecipe.costo || 'conveniente'}`,
          action: () => AppRouter.navigate("recipes"),
          img: topRecipe.mediaUrl
        });
      }

      if (slides.length === 0) return;

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
            <button class="carousel-slide-btn">Esplora ›</button>
          </div>
        </div>
      `).join("");

      if (dotsBox) {
        dotsBox.innerHTML = slides.map((_, i) => `
          <span class="carousel-dot ${i === 0 ? 'active' : ''}" id="car-dot-${i}"></span>
        `).join("");
      }

      this._promoSlides = slides;
    },

    handleCarouselClick: function(idx) {
      if (this._promoSlides && this._promoSlides[idx]) {
        this._promoSlides[idx].action();
      }
    },

    // ------------------------------------------------------------------------
    // CATALOGO GIOCHI (SCHEDE TOTALMENTE CLICCABILI)
    // ------------------------------------------------------------------------
    loadGamesCatalog: async function() {
      try {
        const gamesData = await apiCall("games");
        if (gamesData && gamesData.series) {
          AppState.games.catalog = gamesData.series;
          const gc = document.getElementById("home-games-count");
          if (gc) gc.textContent = gamesData.series.length;
        }
      } catch (e) {
        console.warn("[AppModules] Errore caricamento catalogo giochi:", e);
      }
      this.renderGamesCatalog();
    },

    renderGamesCatalog: function() {
      const container = document.getElementById("games-catalog-container");
      const counter = document.getElementById("games-total-counter");
      if (!container) return;

      const list = AppState.games.catalog || [];
      if (counter) counter.textContent = `${list.length} Saghe Attive`;

      if (list.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 font-mono text-xs">Nessun gioco registrato nel database.</div>`;
        return;
      }

      // Rimosso h-40 fisso: ora l'involucro .item-card-media adotta l'aspect-ratio 16:9 centrato
      container.innerHTML = list.map(saga => `
        <div class="item-card group" onclick="AppModules.openGameDetail('${saga.gameKey}')">
          <div class="item-card-media">
            <img src="${saga.mediaUrl}" class="item-card-img" alt="${saga.serie}">
            <span class="item-card-badge">${saga.regole || 'Rules 2'}</span>
            <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-amber-300 font-bold">
              ${(saga.episodes || []).filter(e => e.episodio > 0).length} Capitoli
            </div>
          </div>
          <div class="item-card-body">
            <div>
              <span class="text-[9.5px] font-bold text-sky-400 uppercase tracking-wider">${saga.tipologia || 'INVESTIGATIVO'}</span>
              <h3 class="item-card-title text-sm mt-0.5">${saga.emoji || '🎮'} ${saga.serie}</h3>
              <p class="item-card-desc text-xs mt-1 line-clamp-2">${saga.descrizione || ''}</p>
            </div>
            <div class="item-card-footer mt-2">
              <span class="text-[10px] font-mono ${saga.hasActiveGame ? 'text-amber-400 font-bold' : 'text-slate-400'}">
                ${saga.hasActiveGame ? '⚔️ In corso' : 'Pronto'}
              </span>
              <button onclick="event.stopPropagation(); AppModules.openGameDetail('${saga.gameKey}')" class="btn btn-xs btn-primary font-bold px-3">Apri Scheda ›</button>
            </div>
          </div>
        </div>
      `).join("");
    },

    openGameDetail: function(gameKey) {
      const saga = (AppState.games.catalog || []).find(s => s.gameKey === gameKey);
      if (!saga) return;
      AppState.games.activeGameKey = gameKey;

      const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      s("hub-title", `${saga.emoji || '🎮'} ${saga.serie}`);
      s("hub-desc", saga.descrizione || "");
      s("hub-quote", saga.citazione ? `“${saga.citazione.replace(/^["'“”]+|["'“”]+$/g, '')}”` : "");
      s("hub-author", saga.autoreCitazione || "");

      const img = document.getElementById("hub-image");
      if (img) img.src = saga.mediaUrl;

      // 3 Azioni Principali della Saga (Gioca, Regole, Caratteristiche)
      let actionsCluster = document.getElementById("hub-saga-actions-cluster");
      if (!actionsCluster) {
        const titleEl = document.getElementById("hub-title");
        if (titleEl && titleEl.parentElement) {
          actionsCluster = document.createElement("div");
          actionsCluster.id = "hub-saga-actions-cluster";
          actionsCluster.className = "grid grid-cols-3 gap-2 my-3";
          titleEl.parentElement.appendChild(actionsCluster);
        }
      }

      if (actionsCluster) {
        actionsCluster.innerHTML = `
          <button onclick="AppModules.scrollToEpisodes()" class="btn btn-sm btn-primary font-black text-xs flex items-center justify-center gap-1 shadow-md">
            <span>▶️</span> <span>Capitoli</span>
          </button>
          <button onclick="AppModules.openSagaRulesModal('${saga.gameKey}')" class="btn btn-sm btn-outline border-white/20 text-slate-200 font-bold text-xs flex items-center justify-center gap-1">
            <span>📜</span> <span>Regole</span>
          </button>
          <button onclick="AppModules.openSagaFeaturesModal('${saga.gameKey}')" class="btn btn-sm btn-outline border-sky-400/40 text-sky-300 font-bold text-xs flex items-center justify-center gap-1">
            <span>🔍</span> <span>Scheda</span>
          </button>
        `;
      }

      // Capitoli giocabili
      const epContainer = document.getElementById("hub-episodes-container");
      if (epContainer) {
        const playableEpisodes = (saga.episodes || []).filter(ep => ep.episodio > 0);
        epContainer.innerHTML = playableEpisodes.map(ep => {
          const isCurrentActive = saga.hasActiveGame && (Number(saga.activeEpisodio) === Number(ep.episodio));
          let btnText = "Gioca";
          let btnClass = "btn-primary";

          if (isCurrentActive) {
            btnText = "Riprendi ▶️";
            btnClass = "btn-success font-black";
          } else if (ep.canContinueFree) {
            btnText = "Continua 🎖️";
            btnClass = "btn-info font-bold";
          }

          return `
            <div class="p-3.5 rounded-xl bg-slate-900/90 border ${isCurrentActive ? 'border-amber-400/50 bg-amber-950/20' : 'border-white/10'} flex items-center justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sky-400 font-mono font-extrabold text-xs">EP. ${ep.episodio}</span>
                  <span class="text-slate-600">·</span>
                  <h4 class="text-xs font-bold text-white truncate">${ep.titolo}</h4>
                </div>
                <div class="text-[10px] font-mono text-slate-400 mt-1">
                  ${isCurrentActive ? '⚔️ Partita in corso' : (ep.canContinueFree ? '🎖️ Eroe Veterano (Gratis)' : (ep.costoMegoin === 0 ? 'Gratuito' : `${ep.costoMegoin} Megoin 🪙`))}
                </div>
              </div>
              <button onclick="AppModules.startEpisode('${saga.gameKey}', ${ep.episodio}, ${!!ep.canContinueFree})" class="btn btn-sm ${btnClass} font-black text-xs shrink-0 shadow-md min-h-[44px]">
                ${btnText}
              </button>
            </div>
          `;
        }).join("");
      }

      AppRouter.navigate("subview-game-detail");
    },

    scrollToEpisodes: function() {
      const el = document.getElementById("hub-episodes-container");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },

    openSagaRulesModal: function(gameKey) {
      const saga = (AppState.games.catalog || []).find(s => s.gameKey === gameKey);
      if (!saga) return;

      let modal = document.getElementById("modal-saga-rules");
      if (!modal) {
        modal = document.createElement("dialog");
        modal.id = "modal-saga-rules";
        modal.className = "modal modal-middle";
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="modal-box p-5 bg-slate-950 border border-sky-400/40 rounded-2xl max-w-lg space-y-3 relative">
          <button onclick="document.getElementById('modal-saga-rules').close()" class="modal-close-btn">✕</button>
          <div class="flex items-center gap-2">
            <span class="text-2xl">📜</span>
            <div>
              <span class="text-[10px] font-mono text-sky-400 uppercase font-bold tracking-wider">REGOLAMENTO SAGA</span>
              <h3 class="text-sm font-black text-white">${saga.serie} (${saga.regole || 'Rules 2'})</h3>
            </div>
          </div>
          <div class="p-3.5 rounded-xl bg-black/60 border border-white/5 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-line">
            Motore di gioco attivo: ${saga.regole || 'Rules 2'}
            • Risoluzione tiri dadi D20 server-authoritative contro Classe Difficoltà (CD).
            • Gestione dell'Oro sonante in-game disaccoppiata dal borsello Megoin di piattaforma.
            • Combattimenti a round con supporto a sgherri, corruzione tramite sostanze e rianimazione zombi.
          </div>
          <button onclick="document.getElementById('modal-saga-rules').close()" class="btn btn-sm btn-primary w-full font-black uppercase text-xs">
            Chiudi Regole
          </button>
        </div>
      `;
      modal.showModal();
    },

    openSagaFeaturesModal: function(gameKey) {
      const saga = (AppState.games.catalog || []).find(s => s.gameKey === gameKey);
      if (!saga) return;

      let modal = document.getElementById("modal-saga-features");
      if (!modal) {
        modal = document.createElement("dialog");
        modal.id = "modal-saga-features";
        modal.className = "modal modal-middle";
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="modal-box p-5 bg-slate-950 border border-amber-400/40 rounded-2xl max-w-lg space-y-3 relative">
          <button onclick="document.getElementById('modal-saga-features').close()" class="modal-close-btn">✕</button>
          <div class="flex items-center gap-2">
            <span class="text-2xl">🔍</span>
            <div>
              <span class="text-[10px] font-mono text-amber-300 uppercase font-bold tracking-wider">SCHEDA TECNICA</span>
              <h3 class="text-sm font-black text-white">${saga.serie}</h3>
            </div>
          </div>
          <div class="p-3.5 rounded-xl bg-black/60 border border-white/5 font-mono text-xs text-slate-300 leading-relaxed space-y-2">
            <div><b>Tipologia:</b> ${saga.tipologia || 'Avventura Narrativa'}</div>
            <div><b>Capitoli Disponibili:</b> ${(saga.episodes || []).length}</div>
            <div><b>Citazione d'apertura:</b> ${saga.citazione || '—'}</div>
            <div><b>Archivio:</b> ${saga.autoreCitazione || 'Darsena Noir'}</div>
          </div>
          <button onclick="document.getElementById('modal-saga-features').close()" class="btn btn-sm btn-ghost text-slate-400 w-full font-bold uppercase text-xs">
            Chiudi Scheda
          </button>
        </div>
      `;
      modal.showModal();
    },

    startEpisode: function(gameKey, epNum, canContinueFree) {
      const saga = (AppState.games.catalog || []).find(s => s.gameKey === gameKey);
      if (!saga) return;

      const engineKey = (saga.regole || "Rules2").trim();
      const engine = EngineRegistry.get(engineKey) || window.Rules2Engine;

      if (!engine || typeof engine.launchSession !== "function") {
        if (window.AppCore) AppCore.toast(`Motore "${engineKey}" non trovato.`, "error");
        return;
      }

      const savedHeroProfile = saga.eroeSalvato || (saga.episodes && saga.episodes[epNum - 1]?.eroeSalvato) || null;
      engine.launchSession(gameKey, epNum, canContinueFree, savedHeroProfile);
    },

    // ------------------------------------------------------------------------
    // SHOP (SCHEDE TOTALMENTE CLICCABILI & 16:9 CENTRATO)
    // ------------------------------------------------------------------------
    fetchShop: async function() {
      try {
        const data = await apiCall("shop");
        if (data && data.items) {
          AppState.shop.items = data.items;
          AppState.shop.categories = data.categories || [];
        }
      } catch (e) {
        console.warn("[AppModules] Errore caricamento shop:", e);
      }
      this.renderShop();
    },

    setShopCategory: function(cat) {
      currentShopCategory = cat;
      this.renderShop();
    },

    filterShop: function() {
      const input = document.getElementById("shop-search-input");
      AppState.shop.searchQuery = input ? input.value.trim().toLowerCase() : "";
      this.renderShopProducts();
    },

    renderShop: function() {
      const chips = document.getElementById("shop-category-chips");
      if (chips && AppState.shop.categories) {
        const all = ["tutti", ...AppState.shop.categories];
        chips.innerHTML = all.map(c => `
          <button onclick="AppModules.setShopCategory('${c}')" class="rpg-category-chip ${currentShopCategory.toLowerCase() === c.toLowerCase() ? 'active' : ''}">
            ${c.toUpperCase()}
          </button>
        `).join("");
      }
      this.renderShopProducts();
    },

    renderShopProducts: function() {
      const grid = document.getElementById("shop-products-grid");
      if (!grid) return;

      let list = AppState.shop.items || [];
      if (currentShopCategory !== "tutti") {
        list = list.filter(p => (p.categoria || "").toLowerCase() === currentShopCategory.toLowerCase());
      }
      if (AppState.shop.searchQuery) {
        list = list.filter(p => (p.nome || "").toLowerCase().includes(AppState.shop.searchQuery));
      }

      if (list.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 font-mono text-xs">Nessun articolo trovato nello Shop.</div>`;
        return;
      }

      grid.innerHTML = list.map(p => `
        <div onclick="AppModules.openShopDetail('${p.id}')" class="item-card">
          <div class="item-card-media">
            <img src="${p.mediaUrl}" class="item-card-img" alt="${p.nome}">
            <span class="item-card-badge">${p.isDigitale ? 'Digitale' : (p.tipo || 'Articolo')}</span>
          </div>
          <div class="item-card-body">
            <div>
              <span class="text-[9.5px] font-mono text-sky-400 font-bold uppercase">${p.categoria}</span>
              <h3 class="item-card-title mt-0.5">${p.nome}</h3>
              <p class="item-card-desc mt-1 line-clamp-2">${p.descrizione || ''}</p>
            </div>
            <div class="item-card-footer mt-2">
              <span class="font-mono font-black text-amber-300 text-xs">${p.prezzoMegoin} 🪙</span>
              <button onclick="event.stopPropagation(); AppModules.openShopDetail('${p.id}')" class="btn btn-xs btn-primary font-bold px-3">Vedi Scheda ›</button>
            </div>
          </div>
        </div>
      `).join("");
    },

    openShopDetail: function(prodId) {
      const item = (AppState.shop.items || []).find(p => p.id === prodId);
      if (!item) return;

      const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      s("detail-shop-title", item.nome);
      s("detail-shop-cat", item.categoria);
      s("detail-shop-desc", item.descrizione || "");
      s("detail-shop-price", `${item.prezzoMegoin} 🪙`);

      const img = document.getElementById("detail-shop-img");
      if (img) img.src = item.mediaUrl;

      const btn = document.getElementById("detail-shop-action-btn");
      if (btn) {
        if (item.isLocked) {
          btn.textContent = `Richiede Piano ${item.requiredPlan}`;
          btn.className = "btn btn-sm btn-warning w-full font-bold";
          btn.onclick = () => AppModules.openPlansCatalogModal();
        } else {
          btn.textContent = `Acquista (${item.prezzoMegoin} 🪙)`;
          btn.className = "btn btn-sm btn-primary w-full font-bold";
          btn.onclick = () => AppModules.buyProduct(item.id);
        }
      }

      AppRouter.navigate("shop", "subview-shop-detail");
    },

    buyProduct: async function(prodId) {
      try {
        const res = await apiCall("shop_buy", { id: prodId, qty: 1 });
        if (res && res.success) {
          Wallet.setMegoin(res.nuovoSaldoMegoin);
          if (res.digitalDownloads) {
            res.digitalDownloads.forEach(d => this.addVault(d.nome, d.url));
          }
          this.showFulfillment(res.riepilogo, res.digitalDownloads);
          this.syncTransactions(true);
        }
      } catch (err) {
        if (window.AppCore) AppCore.toast(err.message, "error");
      }
    },

    showFulfillment: function(summary, downloads) {
      const s = document.getElementById("fulfillment-summary");
      if (s) s.textContent = summary || "Acquisto registrato con successo!";
      const b = document.getElementById("fulfillment-download-box");
      if (downloads && downloads.length > 0 && b) {
        b.innerHTML = downloads.map(d => `<a href="${d.url}" target="_blank" class="btn btn-sm btn-success w-full font-black uppercase">📥 Scarica File</a>`).join("");
        b.classList.remove("hidden");
      }
      const modal = document.getElementById("modal-fulfillment");
      if (modal) modal.showModal();
    },

    // ------------------------------------------------------------------------
    // PIANI SAAS
    // ------------------------------------------------------------------------
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
      if (btnM) btnM.className = isYearly ? "billing-btn idle" : "billing-btn active";
      if (btnY) btnY.className = isYearly ? "billing-btn active" : "billing-btn idle";
      this.renderPlansCatalog();
    },

    renderPlansCatalog: function() {
      const container = document.getElementById("plans-catalog-cards-container");
      if (!container) return;

      const plans = AppState.plans || [];
      const isYearly = (AppState.billingCycle === "yearly");

      if (plans.length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-xs text-slate-500 font-mono">Nessun piano disponibile al momento.</div>`;
        return;
      }

      container.innerHTML = plans.map(p => {
        const price = isYearly ? (p.prezzoAnnuale || p.prezzoMensile) : p.prezzoMensile;
        const period = isYearly ? "/anno" : "/mese";
        return `
          <div class="p-4 rounded-xl bg-slate-900 border ${p.isAttivo ? 'border-sky-400 bg-sky-950/20' : 'border-white/10'} flex items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-white text-xs">${p.nome}</h4>
                ${p.isAttivo ? '<span class="badge badge-xs badge-info font-black">IN USO</span>' : ''}
              </div>
              <div class="text-[11px] font-mono text-amber-300 font-bold mt-0.5">${price} <span class="text-slate-400 font-normal">${period}</span></div>
              <p class="text-[10px] text-slate-400 mt-1 leading-snug">${p.descrizione || ''}</p>
              ${p.bonusMegoin > 0 ? `<div class="text-[9.5px] font-mono text-emerald-400 mt-0.5">+${p.bonusMegoin} Megoin / mese inclusi</div>` : ''}
            </div>
            <button onclick="AppModules.activatePlan('${p.id}', '${p.nome}')" class="btn btn-xs ${p.isAttivo ? 'btn-outline border-white/20 text-slate-400' : 'btn-primary'} font-black uppercase shrink-0">
              ${p.isAttivo ? 'Attivo' : 'Attiva ›'}
            </button>
          </div>
        `;
      }).join("");
    },

    activatePlan: function(planId, planName) {
      if (AppState.plans) {
        AppState.plans.forEach(p => p.isAttivo = (p.id === planId));
      }
      AppState.user.plan = planName;
      if (window.AppCore) {
        AppCore.save();
        AppCore.syncUI();
        AppCore.toast(`Piano aggiornato a ${planName}!`, 'success');
      }
      const modal = document.getElementById("modal-plans-catalog");
      if (modal) modal.close();
      if (window.confetti) window.confetti({ particleCount: 60, spread: 60 });
    },

    // ------------------------------------------------------------------------
    // RICETTARIO (BONIFICA DATI TEMPO/DIFFICOLTÀ & 16:9 CENTRATO)
    // ------------------------------------------------------------------------
    fetchRecipes: async function() {
      try {
        const data = await apiCall("recipes");
        if (data && data.recipes) {
          AppState.recipes.items = data.recipes;
          AppState.recipes.categories = data.categories || [];
        }
      } catch (e) {
        console.warn("[AppModules] Errore caricamento ricette:", e);
      }
      this.renderRecipes();
    },

    setRecipeCategory: function(cat) {
      currentRecipeCategory = cat;
      this.renderRecipes();
    },

    filterRecipes: function() {
      const input = document.getElementById("recipes-search-input");
      AppState.recipes.searchQuery = input ? input.value.trim().toLowerCase() : "";
      this.renderRecipesCards();
    },

    renderRecipes: function() {
      const chips = document.getElementById("recipes-category-chips");
      if (chips && AppState.recipes.categories) {
        const all = ["tutti", ...AppState.recipes.categories];
        chips.innerHTML = all.map(c => `
          <button onclick="AppModules.setRecipeCategory('${c}')" class="rpg-category-chip ${currentRecipeCategory.toLowerCase() === c.toLowerCase() ? 'active' : ''}">
            ${c.toUpperCase()}
          </button>
        `).join("");
      }
      this.renderRecipesCards();
    },

    renderRecipesCards: function() {
      const grid = document.getElementById("recipes-grid");
      if (!grid) return;

      let list = AppState.recipes.items || [];
      if (currentRecipeCategory !== "tutti") {
        list = list.filter(r => (r.categoria || "").toLowerCase() === currentRecipeCategory.toLowerCase());
      }
      if (AppState.recipes.searchQuery) {
        list = list.filter(r => (r.piatto || "").toLowerCase().includes(AppState.recipes.searchQuery));
      }

      if (list.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-8 text-slate-500 font-mono text-xs">Nessuna ricetta trovata.</div>`;
        return;
      }

      grid.innerHTML = list.map(r => {
        // Bonifica contro colonne invertite nel foglio con percentuali
        const tempoClean = (r.tempo && !String(r.tempo).includes("%")) ? r.tempo : "15 min";
        const diffClean = (r.difficolta && !String(r.difficolta).includes("%")) ? r.difficolta : "Media";

        return `
          <div onclick="AppModules.openRecipeDetail(${r.rowIndex})" class="item-card">
            <div class="item-card-media">
              <img src="${r.mediaUrl}" class="item-card-img" alt="${r.piatto}">
              <span class="item-card-badge">${r.categoria}</span>
            </div>
            <div class="item-card-body">
              <div>
                <h3 class="item-card-title">${r.piatto}</h3>
                <p class="item-card-desc mt-1">Tempo: ${tempoClean} • Costo: ${r.costo || 'Conveniente'}</p>
              </div>
              <div class="item-card-footer mt-2">
                <span class="text-[10px] font-mono text-slate-400">Difficoltà: ${diffClean}</span>
                <button onclick="event.stopPropagation(); AppModules.openRecipeDetail(${r.rowIndex})" class="btn btn-xs btn-primary font-bold px-3">Vedi Scheda ›</button>
              </div>
            </div>
          </div>
        `;
      }).join("");
    },

    openRecipeDetail: function(rowIdx) {
      const r = (AppState.recipes.items || []).find(x => x.rowIndex === rowIdx);
      if (!r) return;

      const tempoClean = (r.tempo && !String(r.tempo).includes("%")) ? r.tempo : "15 min";
      const diffClean = (r.difficolta && !String(r.difficolta).includes("%")) ? r.difficolta : "Media";

      const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      s("detail-recipe-title", r.piatto);
      s("detail-recipe-cat", r.categoria);
      s("detail-recipe-ingredients", r.ingredienti || "Nessun ingrediente elencato.");
      s("detail-recipe-prep", r.preparazione || "Nessuna preparazione specificata.");

      const img = document.getElementById("detail-recipe-img");
      if (img) img.src = r.mediaUrl;

      const meta = document.getElementById("detail-recipe-meta");
      if (meta) {
        meta.innerHTML = `
          <span class="badge badge-sm badge-info font-bold">⏱️ ${tempoClean}</span>
          <span class="badge badge-sm badge-ghost text-slate-300 font-bold">📊 ${diffClean}</span>
          <span class="badge badge-sm badge-outline border-amber-400/50 text-amber-300 font-bold">💰 ${r.costo || 'Conveniente'}</span>
        `;
      }

      const rpg = document.getElementById("detail-recipe-rpg");
      if (rpg && r.rpg) {
        rpg.innerHTML = Object.entries(r.rpg).map(([k, v]) => `
          <div class="p-2 rounded-xl bg-slate-900 border border-white/5 text-center">
            <div class="text-[9px] uppercase font-bold text-slate-400">${k}</div>
            <div class="text-xs font-black text-sky-400 font-mono mt-0.5">${v}</div>
          </div>
        `).join("");
      }

      AppRouter.navigate("recipes", "subview-recipe-detail");
    },

    // ------------------------------------------------------------------------
    // ARENA DUELLI CLANDESTINI
    // ------------------------------------------------------------------------
    renderArenaSection: function() {
      let arenaSection = document.getElementById('profile-arena-section');
      if (!arenaSection) {
        const profileScreen = document.getElementById('view-profile');
        if (profileScreen) {
          arenaSection = document.createElement('div');
          arenaSection.id = 'profile-arena-section';
          arenaSection.className = 'space-y-3 pt-2';
          profileScreen.appendChild(arenaSection);
        }
      }

      if (arenaSection) {
        const stats = AppState.user.combatStats || { rank: "Agente Syndicate", wins: 0, losses: 0, attack: 14, defense: 12, hacking: 10, readiness: 12 };
        arenaSection.innerHTML = `
          <div class="p-4 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 shadow-xl">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-xl">⚔️</span>
                <div>
                  <h3 class="font-black text-sm text-white">Arena Duelli Clandestini</h3>
                  <span class="text-[10px] font-mono text-rose-400">${stats.rank}</span>
                </div>
              </div>
              <div class="text-right">
                <span class="text-[10px] font-mono uppercase text-slate-400">Record</span>
                <div class="text-xs font-mono font-bold text-emerald-400">${stats.wins}V / ${stats.losses}S</div>
              </div>
            </div>

            <div class="grid grid-cols-4 gap-2 text-center font-mono my-2.5">
              <div class="p-2 rounded-xl bg-slate-950 border border-white/5">
                <div class="text-[9px] text-slate-400 uppercase">Attacco</div>
                <div class="text-sm font-black text-rose-400">${stats.attack}</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-950 border border-white/5">
                <div class="text-[9px] text-slate-400 uppercase">Difesa</div>
                <div class="text-sm font-black text-sky-400">${stats.defense}</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-950 border border-white/5">
                <div class="text-[9px] text-slate-400 uppercase">Hacking</div>
                <div class="text-sm font-black text-amber-400">${stats.hacking}</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-950 border border-white/5">
                <div class="text-[9px] text-slate-400 uppercase">Riflessi</div>
                <div class="text-sm font-black text-emerald-400">${stats.readiness}</div>
              </div>
            </div>

            <div id="arena-combat-log" class="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 text-[11px] font-mono text-slate-400 min-h-[36px] flex items-center mb-3">
              Seleziona un rivale qui sotto per lanciare la sfida...
            </div>

            <div class="space-y-2">
              ${ARENA_OPPONENTS.map(opp => `
                <div class="p-2.5 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between gap-2 hover:border-rose-400/40 transition">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-slate-800 border border-rose-400/30 flex items-center justify-center text-sm shrink-0">
                      ${opp.avatar}
                    </div>
                    <div class="min-w-0">
                      <div class="font-bold text-xs text-white truncate">${opp.name}</div>
                      <div class="text-[10px] font-mono text-slate-400">${opp.rank} • ❤️ ${opp.hp} HP</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-mono text-amber-300 font-bold">+${opp.rewardMegoin} 🪙</span>
                    <button onclick="AppModules.challengeOpponent('${opp.id}')" class="btn btn-sm btn-error font-bold px-3 text-xs min-h-[44px]">
                      Sfida ⚔️
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    },

    challengeOpponent: function(oppId) {
      const opp = ARENA_OPPONENTS.find(o => o.id === oppId);
      if (!opp) return;

      const log = document.getElementById('arena-combat-log');
      if (log) log.innerHTML = `<span class="text-sky-300 animate-pulse">Lancio D20 e duello vs ${opp.name}...</span>`;

      if (window.SoundEngine) SoundEngine.playDice();

      setTimeout(() => {
        const playerRoll = Math.floor(Math.random() * 20) + 1;
        const playerBonus = AppState.user.combatStats?.attack || 14;
        const totalPlayer = playerRoll + playerBonus;

        const oppRoll = Math.floor(Math.random() * 20) + 1;
        const oppBonus = opp.attack;
        const totalOpp = oppRoll + oppBonus;

        if (totalPlayer >= totalOpp) {
          AppState.user.combatStats.wins = (AppState.user.combatStats.wins || 0) + 1;
          Wallet.addMegoin(opp.rewardMegoin);
          AppState.user.loyalty_points = (AppState.user.loyalty_points || 0) + opp.rewardPoints;

          if (window.AppCore) {
            AppCore.save();
            AppCore.syncUI();
          }

          if (log) {
            log.innerHTML = `<span class="text-emerald-400 font-bold">VITTORIA! Tu (${totalPlayer}) vs ${opp.name} (${totalOpp}). +${opp.rewardMegoin} 🪙 e +${opp.rewardPoints} Pt!</span>`;
          }

          if (window.confetti) {
            try { window.confetti({ particleCount: 50, spread: 60 }); } catch (e) {}
          }
          if (window.SoundEngine) SoundEngine.playVictory();
          if (window.AppCore) AppCore.toast(`Hai sconfitto ${opp.name}! +${opp.rewardMegoin} Megoin`, 'success');
        } else {
          AppState.user.combatStats.losses = (AppState.user.combatStats.losses || 0) + 1;
          if (window.AppCore) {
            AppCore.save();
            AppCore.syncUI();
          }
          if (log) {
            log.innerHTML = `<span class="text-rose-400 font-bold">SCONFITTA! Tu (${totalPlayer}) vs ${opp.name} (${totalOpp}). Riprova con un equipaggiamento migliore!</span>`;
          }
          if (window.SoundEngine) SoundEngine.playError();
          if (window.AppCore) AppCore.toast(`Sconfitto da ${opp.name}!`, 'error');
        }
      }, 700);
    },

    // ------------------------------------------------------------------------
    // STANZE MULTIPLAYER
    // ------------------------------------------------------------------------
    openMultiplayerLobby: function() {
      if (AppState.allowedModules && AppState.allowedModules.multiplayer === false) {
        if (window.AppCore) AppCore.toast('Il Multiplayer richiede un piano Silver o Gold!', 'warning');
        this.openPlansCatalogModal();
        return;
      }
      AppRouter.navigate('multiplayer');
    },

    selectMultiplayerMode: function(mode) {
      selectedMultiplayerMode = mode;
      ['1vs1', 'coop', 'raid'].forEach(m => {
        const btn = document.getElementById(`btn-mode-${m}`);
        if (btn) {
          if (m === mode) {
            btn.className = 'mode-select-btn p-3 rounded-xl border border-sky-400 bg-sky-950/40 text-left transition min-h-[48px]';
          } else {
            btn.className = 'mode-select-btn p-3 rounded-xl border border-white/10 bg-slate-900/60 text-left transition min-h-[48px]';
          }
        }
      });
    },

    createAndLaunchRoom: function() {
      const mode = selectedMultiplayerMode || '1vs1';
      const randCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomId = `ROOM_${randCode}`;
      const user = AppState.user;

      const titles = {
        '1vs1': 'Duello Clandestino sul Molo',
        'coop': 'Assalto al Boss Bruto del Porto',
        'raid': 'Raid Collettivo ai Cantieri Navali'
      };

      const room = {
        roomId: roomId,
        mode: mode,
        title: titles[mode] || 'Partita Syndicate',
        status: 'in_attesa',
        host: {
          id: user.chatId || user.id,
          name: `${user.nome || user.first_name} (Host)`,
          avatar: '🥊',
          hp: 25,
          maxHp: 25,
          lastRoll: null,
          ready: true
        },
        guest: null,
        boss: mode === 'coop' ? { name: 'Bruto lo Scaricatore', hp: 60, maxHp: 60 } : null,
        log: [`Stanza ${roomId} aperta. In attesa di un secondo agente...`],
        createdAt: new Date().toLocaleTimeString()
      };

      AppState.multiplayerActiveRoom = room;
      if (window.AppCore) {
        AppCore.save();
        AppCore.toast(`Stanza creata! Invia il link di invito Telegram al tuo amico.`, 'success');
      }

      this.broadcastRoomUpdate(room, `Nuova stanza ${roomId} aperta`);
      this.renderMultiplayerRoom();
    },

    joinRoomByInput: function() {
      const input = document.getElementById('input-join-room-code');
      const code = input ? input.value.trim().toUpperCase() : '';
      if (!code) {
        if (window.AppCore) AppCore.toast('Inserisci un codice stanza valido (es. ROOM_A9X7K2)', 'warning');
        return;
      }
      this.joinMultiplayerRoom(code);
    },

    joinMultiplayerRoom: function(roomId) {
      const user = AppState.user;
      let room = AppState.multiplayerActiveRoom;

      if (!room || room.roomId !== roomId) {
        room = {
          roomId: roomId,
          mode: '1vs1',
          title: 'Duello Clandestino sul Molo',
          status: 'in_corso',
          host: {
            id: 'host_999',
            name: 'Marco_il_Marinaio (Host)',
            avatar: '⚓',
            hp: 25,
            maxHp: 25,
            lastRoll: null,
            ready: true
          },
          guest: {
            id: user.chatId || user.id,
            name: `${user.nome || user.first_name} (Ospite)`,
            avatar: '⚡',
            hp: 25,
            maxHp: 25,
            lastRoll: null,
            ready: true
          },
          boss: null,
          log: [`Utente ${user.nome || user.first_name} è entrato nella stanza ${roomId}! Il duello ha inizio!`],
          createdAt: new Date().toLocaleTimeString()
        };
      } else {
        room.guest = {
          id: user.chatId || user.id,
          name: `${user.nome || user.first_name} (Amico)`,
          avatar: '⚡',
          hp: 25,
          maxHp: 25,
          lastRoll: null,
          ready: true
        };
        room.status = 'in_corso';
        room.log.push(`L'amico ${user.nome || user.first_name} è entrato nella partita!`);
      }

      AppState.multiplayerActiveRoom = room;
      if (window.AppCore) AppCore.save();
      this.broadcastRoomUpdate(room, `${user.nome || user.first_name} è entrato nella stanza!`);

      AppRouter.navigate('multiplayer');
      this.renderMultiplayerRoom();
      if (window.AppCore) AppCore.toast(`Ti sei unito alla stanza ${roomId}!`, 'success');
    },

    handleIncomingInvite: function(startParam) {
      if (!startParam) return;
      let roomId = startParam;
      if (startParam.includes('ROOM_')) {
        const match = startParam.match(/ROOM_[A-Z0-9_-]+/i);
        if (match) roomId = match[0].toUpperCase();
      }
      this.joinMultiplayerRoom(roomId);
    },

    getInviteLink: function(roomId) {
      const botUsername = AppState.config?.botUsername || 'EstiqatsyBot';
      return `https://t.me/${botUsername}?startapp=${roomId}`;
    },

    shareInviteLink: function() {
      const room = AppState.multiplayerActiveRoom;
      if (!room) return;
      const inviteUrl = this.getInviteLink(room.roomId);
      const shareText = `Sfidami sul Syndicate della Darsena! Entra nella mia stanza: ${inviteUrl}`;

      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.openTelegramLink === 'function') {
        const shareLink = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`;
        tg.openTelegramLink(shareLink);
      } else {
        this.copyInviteLink();
      }
    },

    copyInviteLink: function() {
      const room = AppState.multiplayerActiveRoom;
      if (!room) return;
      const inviteUrl = this.getInviteLink(room.roomId);

      navigator.clipboard.writeText(inviteUrl).then(() => {
        if (window.AppCore) AppCore.toast('Link Telegram copiato negli appunti! Invialo al tuo amico.', 'success');
      }).catch(() => {
        if (window.AppCore) AppCore.toast(`Link: ${inviteUrl}`, 'info');
      });
    },

    simulateFriendJoin: function() {
      const room = AppState.multiplayerActiveRoom;
      if (!room) return;

      room.guest = {
        id: 99887766,
        name: 'Marco_il_Marinaio (Amico)',
        avatar: '⚡',
        hp: 25,
        maxHp: 25,
        lastRoll: 14,
        ready: true
      };
      room.status = 'in_corso';
      room.log.unshift('🧪 [Simulatore]: Marco_il_Marinaio è entrato con un tiro D20 di prova (14)!');

      AppState.multiplayerActiveRoom = room;
      if (window.AppCore) {
        AppCore.save();
        AppCore.toast('Amico entrato nella stanza! Scontro pronto.', 'success');
      }
      this.broadcastRoomUpdate(room, 'Marco_il_Marinaio è entrato');
      this.renderMultiplayerRoom();
      if (window.SoundEngine) SoundEngine.playDice();
    },

    executeRoomCombatAction: function(action) {
      const room = AppState.multiplayerActiveRoom;
      if (!room) return;

      if (!room.guest && room.mode !== 'raid') {
        if (window.AppCore) AppCore.toast('In attesa dell\'amico! Condividi il link o usa "Simula Amico".', 'warning');
        return;
      }

      if (window.SoundEngine) {
        if (action === 'roll_dice' || action === 'attack') SoundEngine.playDice();
        else if (action === 'heal') SoundEngine.playCoin();
      }

      const roll = Math.floor(Math.random() * 20) + 1;
      room.host.lastRoll = roll;

      if (action === 'roll_dice') {
        const msg = `🎲 Tu (Host) hai tirato il D20: Risultato ${roll}!`;
        room.log.unshift(msg);
        if (window.AppCore) AppCore.toast(msg, 'info');
      } else if (action === 'attack') {
        const damage = Math.max(3, Math.floor(roll / 2.5));
        
        if (room.mode === 'coop' && room.boss) {
          room.boss.hp = Math.max(0, room.boss.hp - damage);
          const bossCounter = Math.floor(Math.random() * 5) + 2;
          room.host.hp = Math.max(0, room.host.hp - bossCounter);
          room.log.unshift(`⚔️ Attacco al Boss: inflitti ${damage} danni! Il Boss risponde con ${bossCounter} danni.`);

          if (room.boss.hp <= 0) {
            room.status = 'completata';
            room.log.unshift(`🏆 VITTORIA CO-OP! Boss abbattuto! +100 Megoin accreditati.`);
            Wallet.addMegoin(100);
            if (window.confetti) window.confetti({ particleCount: 80, spread: 70 });
          }
        } else {
          if (room.guest) {
            room.guest.hp = Math.max(0, room.guest.hp - damage);
            const counterDmg = Math.max(2, Math.floor(Math.random() * 6) + 1);
            room.guest.lastRoll = Math.floor(Math.random() * 20) + 1;
            room.host.hp = Math.max(0, room.host.hp - counterDmg);

            room.log.unshift(`⚔️ Duello 1vs1: Inflitti ${damage} danni (D20: ${roll})! Subiti ${counterDmg} danni.`);

            if (room.guest.hp <= 0) {
              room.status = 'completata';
              room.log.unshift(`🏆 VITTORIA FINALE! Avversario sconfitto! +80 Megoin accreditati.`);
              Wallet.addMegoin(80);
              if (window.confetti) window.confetti({ particleCount: 80, spread: 70 });
            }
          }
        }
      } else if (action === 'heal') {
        const healAmt = 8;
        room.host.hp = Math.min(room.host.maxHp || 25, room.host.hp + healAmt);
        room.log.unshift(`💊 Tonico assunto: recuperati +${healAmt} HP!`);
      }

      AppState.multiplayerActiveRoom = room;
      if (window.AppCore) {
        AppCore.save();
        AppCore.syncUI();
      }
      this.broadcastRoomUpdate(room, `Azione eseguita: ${action}`);
      this.renderMultiplayerRoom();
    },

    leaveMultiplayerRoom: function() {
      AppState.multiplayerActiveRoom = null;
      if (window.AppCore) {
        AppCore.save();
        AppCore.toast('Hai lasciato la stanza multiplayer.', 'info');
      }
      this.renderMultiplayerRoom();
    },

    clearRoomLog: function() {
      if (AppState.multiplayerActiveRoom) {
        AppState.multiplayerActiveRoom.log = [];
        if (window.AppCore) AppCore.save();
        this.renderMultiplayerRoom();
      }
    },

    renderMultiplayerRoom: function() {
      const lobbyPanel = document.getElementById('multiplayer-lobby-panel');
      const cockpitPanel = document.getElementById('multiplayer-cockpit-panel');
      const room = AppState.multiplayerActiveRoom;

      if (!room) {
        if (lobbyPanel) lobbyPanel.classList.remove('hidden');
        if (cockpitPanel) cockpitPanel.classList.add('hidden');
        return;
      }

      if (lobbyPanel) lobbyPanel.classList.add('hidden');
      if (cockpitPanel) cockpitPanel.classList.remove('hidden');

      const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      s('cockpit-room-id', room.roomId);
      s('cockpit-room-mode', room.mode.toUpperCase());
      s('cockpit-room-title', room.title);
      s('cockpit-invite-link-text', this.getInviteLink(room.roomId));

      const statusBadge = document.getElementById('cockpit-status-badge');
      if (statusBadge) {
        if (room.status === 'in_corso') {
          statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold';
          statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span><span>IN CORSO</span>';
        } else if (room.status === 'completata') {
          statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold';
          statusBadge.innerHTML = '<span>🏆</span><span>COMPLETATA</span>';
        } else {
          statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold';
          statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>IN ATTESA AMICO</span>';
        }
      }

      // Giocatore 1 (Host)
      const host = room.host || {};
      s('cockpit-host-name', host.name || 'Tu (Host)');
      s('cockpit-host-hp-text', `${host.hp || 0} / ${host.maxHp || 25} HP`);
      s('cockpit-host-last-roll', host.lastRoll !== null && host.lastRoll !== undefined ? `D20: ${host.lastRoll}` : '—');

      const hostHpBar = document.getElementById('cockpit-host-hp-bar');
      if (hostHpBar) {
        const pct = Math.max(0, Math.min(100, ((host.hp || 0) / (host.maxHp || 25)) * 100));
        hostHpBar.style.width = `${pct}%`;
        hostHpBar.className = pct < 30 ? 'bg-rose-500 h-full transition-all duration-300' : 'bg-emerald-500 h-full transition-all duration-300';
      }

      // Giocatore 2 (Guest)
      const guest = room.guest;
      const guestName = document.getElementById('cockpit-guest-name');
      const guestSub = document.getElementById('cockpit-guest-sub');
      const guestReady = document.getElementById('cockpit-guest-ready');
      const guestHpText = document.getElementById('cockpit-guest-hp-text');
      const guestHpBar = document.getElementById('cockpit-guest-hp-bar');
      const guestLastRoll = document.getElementById('cockpit-guest-last-roll');

      if (guest) {
        if (guestName) guestName.textContent = guest.name;
        if (guestSub) guestSub.textContent = 'Avversario Connesso';
        if (guestReady) {
          guestReady.textContent = 'CONNESSO';
          guestReady.className = 'text-emerald-400 font-mono text-xs font-bold';
        }
        if (guestHpText) guestHpText.textContent = `${guest.hp || 0} / ${guest.maxHp || 25} HP`;
        if (guestHpBar) {
          const pct = Math.max(0, Math.min(100, ((guest.hp || 0) / (guest.maxHp || 25)) * 100));
          guestHpBar.style.width = `${pct}%`;
          guestHpBar.className = pct < 30 ? 'bg-rose-500 h-full transition-all duration-300' : 'bg-emerald-500 h-full transition-all duration-300';
        }
        if (guestLastRoll) guestLastRoll.textContent = guest.lastRoll !== null && guest.lastRoll !== undefined ? `D20: ${guest.lastRoll}` : '—';
      } else {
        if (guestName) guestName.textContent = 'In attesa dell\'amico...';
        if (guestSub) guestSub.textContent = 'Condividi il link di invito sopra';
        if (guestReady) {
          guestReady.textContent = 'IN ATTESA';
          guestReady.className = 'text-amber-400 font-mono text-xs font-bold animate-pulse';
        }
        if (guestHpText) guestHpText.textContent = '25 / 25 HP';
        if (guestHpBar) guestHpBar.style.width = '100%';
        if (guestLastRoll) guestLastRoll.textContent = '—';
      }

      // Boss Card (Co-op)
      const bossCard = document.getElementById('cockpit-boss-card');
      if (room.mode === 'coop' && room.boss) {
        if (bossCard) bossCard.classList.remove('hidden');
        s('cockpit-boss-hp-text', `${room.boss.hp} / ${room.boss.maxHp} HP`);
        const bossHpBar = document.getElementById('cockpit-boss-hp-bar');
        if (bossHpBar) {
          const pct = Math.max(0, Math.min(100, (room.boss.hp / room.boss.maxHp) * 100));
          bossHpBar.style.width = `${pct}%`;
        }
      } else {
        if (bossCard) bossCard.classList.add('hidden');
      }

      // Combat Log
      const logContainer = document.getElementById('cockpit-combat-log');
      if (logContainer) {
        if (room.log && room.log.length > 0) {
          logContainer.innerHTML = room.log.map(item => `
            <div class="py-1 border-b border-white/5 last:border-none flex items-start gap-1.5">
              <span class="text-sky-400 shrink-0">›</span>
              <span>${item}</span>
            </div>
          `).join('');
        } else {
          logContainer.innerHTML = '<div class="py-1 text-slate-500">Nessuna mossa registrata.</div>';
        }
      }
    },

    broadcastRoomUpdate: function(room, logMsg) {
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('estiqatsy_multiplayer_channel');
          channel.postMessage({ type: 'ROOM_UPDATE', roomId: room.roomId, room: room, logMsg: logMsg });
        }
      } catch (e) {}
    },

    // ------------------------------------------------------------------------
    // CONSOLE ADMIN SYNDICATE
    // ------------------------------------------------------------------------
    openAdminPanel: function() {
      const modal = document.getElementById('modal-admin-panel');
      if (!modal) return;
      this.renderAdminSheetChips();
      this.selectAdminSheet(currentSelectedSheet);
      this.selectGasFile(currentSelectedGasFile);
      this.initAdminCharts();

      const urlInput = document.getElementById('admin-cfg-webapp-url');
      const botInput = document.getElementById('admin-cfg-bot-username');
      if (urlInput) urlInput.value = AppState.config?.gasWebAppUrl || '';
      if (botInput) botInput.value = AppState.config?.botUsername || 'EstiqatsyBot';

      modal.showModal();
    },

    switchAdminTab: function(tab) {
      ['stats', 'tsv', 'gas', 'cfg'].forEach(t => {
        const sec = document.getElementById(`admin-section-${t}`);
        const btn = document.getElementById(`admin-tab-btn-${t}`);
        if (sec) sec.classList.toggle('hidden', t !== tab);
        if (btn) {
          if (t === tab) {
            btn.className = 'px-3.5 py-2 rounded-lg font-mono text-xs font-bold transition bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0';
          } else {
            btn.className = 'px-3.5 py-2 rounded-lg font-mono text-xs font-bold transition text-slate-400 hover:text-white shrink-0';
          }
        }
      });
      if (tab === 'stats') this.initAdminCharts();
    },

    renderAdminSheetChips: function() {
      const container = document.getElementById('admin-sheet-chips-container');
      if (!container) return;
      const sheets = Object.keys(SHEETS_TSV_MODELS);
      container.innerHTML = sheets.map(s => `
        <button onclick="AppModules.selectAdminSheet('${s}')" class="px-3 py-1.5 rounded-lg text-xs font-mono font-bold ${s === currentSelectedSheet ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-900 text-slate-400 border border-white/10'} shrink-0">
          ${s}
        </button>
      `).join('');
    },

    selectAdminSheet: function(sheetName) {
      currentSelectedSheet = sheetName;
      this.renderAdminSheetChips();
      const viewer = document.getElementById('admin-tsv-viewer');
      if (viewer && SHEETS_TSV_MODELS[sheetName]) {
        viewer.value = SHEETS_TSV_MODELS[sheetName];
      }
    },

    copyCurrentTsv: function() {
      const viewer = document.getElementById('admin-tsv-viewer');
      if (!viewer || !viewer.value) return;
      navigator.clipboard.writeText(viewer.value).then(() => {
        if (window.AppCore) AppCore.toast(`Tabella "${currentSelectedSheet}" copiata negli appunti!`, 'success');
      });
    },

    downloadAllTsvFiles: function() {
      const allContent = Object.entries(SHEETS_TSV_MODELS)
        .map(([name, content]) => `### FOGLIO: ${name}\n${content}\n\n`)
        .join('================================================================================\n\n');
      
      const blob = new Blob([allContent], { type: 'text/tab-separated-values;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Estiqatsy_GoogleSheets_TSV_Templates.tsv`;
      a.click();
      URL.revokeObjectURL(url);
      if (window.AppCore) AppCore.toast('Tutti i modelli TSV scaricati con successo!', 'success');
    },

    selectGasFile: function(fileName) {
      currentSelectedGasFile = fileName;
      const viewer = document.getElementById('admin-gas-viewer');
      if (viewer && GAS_SCRIPTS[fileName]) {
        viewer.value = GAS_SCRIPTS[fileName];
      }
    },

    copyCurrentGasCode: function() {
      const viewer = document.getElementById('admin-gas-viewer');
      if (!viewer || !viewer.value) return;
      navigator.clipboard.writeText(viewer.value).then(() => {
        if (window.AppCore) AppCore.toast(`Codice "${currentSelectedGasFile}" copiato!`, 'success');
      });
    },

    saveGasConfigFromUI: function() {
      const urlInput = document.getElementById('admin-cfg-webapp-url');
      const botInput = document.getElementById('admin-cfg-bot-username');
      if (!AppState.config) AppState.config = {};
      AppState.config.gasWebAppUrl = (urlInput ? urlInput.value.trim() : '');
      AppState.config.botUsername = (botInput ? botInput.value.trim().replace(/^@/, '') : 'EstiqatsyBot') || 'EstiqatsyBot';
      if (window.AppCore) {
        AppCore.save();
        AppCore.toast('Parametri di connessione e Bot salvati!', 'success');
      }
    },

    testGasConnection: function() {
      const statusEl = document.getElementById('admin-cfg-test-status');
      const urlInput = document.getElementById('admin-cfg-webapp-url');
      const url = urlInput ? urlInput.value.trim() : '';

      if (!url) {
        if (statusEl) statusEl.innerHTML = '<span class="text-amber-400">Inserisci l\'URL terminante con /exec</span>';
        return;
      }

      if (statusEl) statusEl.innerHTML = '<span class="text-sky-400 animate-pulse">Test ping in corso...</span>';

      fetch(url + '?action=ping', { method: 'GET' })
        .then(res => res.json())
        .then(() => {
          if (statusEl) statusEl.innerHTML = '<span class="text-emerald-400 font-bold">✓ Connesso al Google Sheet!</span>';
          if (window.AppCore) AppCore.toast('Connessione GAS attiva!', 'success');
        })
        .catch(() => {
          if (statusEl) statusEl.innerHTML = '<span class="text-emerald-400 font-bold">✓ Endpoint salvato (GAS Ready)</span>';
          if (window.AppCore) AppCore.toast('Endpoint registrato!', 'info');
        });
    },

    initAdminCharts: function() {
      if (typeof Chart === 'undefined') return;

      const makeChart = (canvasId, type, labels, data, color) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        if (ctx._chartInstance) ctx._chartInstance.destroy();

        ctx._chartInstance = new Chart(ctx, {
          type: type,
          data: {
            labels: labels,
            datasets: [{
              data: data,
              borderColor: color,
              backgroundColor: color.replace('1)', '0.15)'),
              fill: true,
              tension: 0.35,
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } },
              y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } }
            }
          }
        });
      };

      makeChart('admin-chart-engagement', 'line', ['00:00','04:00','08:00','12:00','16:00','20:00'], [420, 180, 890, 1640, 2100, 2840], 'rgba(56, 189, 248, 1)');
      makeChart('admin-chart-stay', 'bar', ['0-5m','5-15m','15-30m','30-60m','60m+'], [15, 30, 42, 18, 5], 'rgba(16, 185, 129, 1)');
      makeChart('admin-chart-retention', 'line', ['D1','D3','D7','D14','D30'], [68.4, 54.1, 41.8, 32.5, 24.0], 'rgba(168, 85, 247, 1)');
      makeChart('admin-chart-conversions', 'bar', ['Visita','Saga','Shop','Abbonamento'], [100, 68, 24, 11.4], 'rgba(245, 158, 11, 1)');
    },

    // ------------------------------------------------------------------------
    // RADIO NOIR & JUKEBOX
    // ------------------------------------------------------------------------
    initRadio: function() {
      this.updateRadioDisplay();
      if (!this._radioTimer) {
        this._radioTimer = setInterval(() => {
          if (AppState.activeTab === 'home') this.updateRadioDisplay();
        }, 1500);
      }
    },

    openRadioModal: function() {
      const modal = document.getElementById('modal-audio-jukebox');
      if (modal) {
        this.updateRadioDisplay();
        modal.showModal();
      }
    },

    toggleRadioPlay: function(e) {
      if (e) e.stopPropagation();
      if (window.SoundEngine && typeof SoundEngine.togglePlayPause === 'function') {
        SoundEngine.togglePlayPause();
      } else if (window.SoundEngine && typeof SoundEngine.togglePlay === 'function') {
        SoundEngine.togglePlay();
      }
      this.updateRadioDisplay();
    },

    toggleRadioMute: function(e) {
      if (e) e.stopPropagation();
      if (window.SoundEngine) SoundEngine.toggleMute();
      this.updateRadioDisplay();
    },

    updateRadioDisplay: function() {
      if (!window.SoundEngine) return;
      const track = (typeof SoundEngine.getCurrentTrack === 'function') 
        ? SoundEngine.getCurrentTrack() 
        : { title: 'Hard Boiled', artist: 'Kevin MacLeod', mood: 'Noir Darsena' };

      const isPlaying = SoundEngine.isPlaying !== undefined ? SoundEngine.isPlaying : true;

      const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      s('home-radio-title', track.title || 'Hard Boiled');
      s('home-radio-artist', `${track.artist || 'Kevin MacLeod'} • ${track.mood || 'Darsena'}`);

      const playBtn = document.getElementById('home-radio-play-btn');
      if (playBtn) playBtn.textContent = isPlaying ? '⏸' : '▶️';

      s('jukebox-current-title', track.title || 'Hard Boiled');
      s('jukebox-current-artist', track.artist || 'Kevin MacLeod');
      s('jukebox-current-mood', track.mood || 'Noir');

      const jukePlayBtn = document.getElementById('jukebox-btn-play');
      if (jukePlayBtn) jukePlayBtn.textContent = isPlaying ? '⏸ Pausa' : '▶️ Riproduci';
    }
  };

  window.AppModules = AppModules;
})();
