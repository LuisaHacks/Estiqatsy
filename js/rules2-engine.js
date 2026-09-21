// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2-engine.js
// LAYER 3B: COCKPIT GAMEPLAY, COMBATTIMENTO D20 & GESTIONE CASSETTI (RULES 2)
// ============================================================================

const Rules2Engine = {
  // --------------------------------------------------------------------------
  // 1. LIFECYCLE HOOKS: AVVIO SESSIONE & COMUNICAZIONE WIZARD
  // --------------------------------------------------------------------------
  launchSession: function(gameKey, epNum, canContinueFree, savedHero) {
    if (typeof Rules2Wizard !== "undefined") {
      Rules2Wizard.open(gameKey, epNum, canContinueFree, savedHero);
    } else {
      console.error("[Rules2Engine] Modulo rules2-wizard.js non trovato.");
    }
  },

  executeStartGame: async function(payloadParams) {
    try {
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.playSfx("insert_coin");
        SoundEngine.playBgm("exploration");
      }

      const res = await apiCall("game_start", payloadParams);
      if (res && res.success) {
        // Inizializza sessione attiva in AppState
        AppState.activeSession.engineKey = "Rules2";
        AppState.activeSession.gameKey = payloadParams.gameKey;
        AppState.activeSession.episodio = payloadParams.episodio;
        AppState.activeSession.partitaId = res.partitaId;
        AppState.activeSession.hero = res.statoEroe;
        AppState.activeSession.currentNode = res.nodoIniziale;
        AppState.activeSession.engineState = {
          pendingVictory: null,
          backpackFilter: "ALL",
          emporioMode: "buy"
        };

        // Aggiorna saldo Megoin dell'account Syndicate
        if (res.nuovoSaldoMegoin !== undefined) {
          Wallet.setMegoin(res.nuovoSaldoMegoin);
        }
        if (typeof AppModules !== "undefined") {
          AppModules.renderProfile(AppState.user);
        }

        this.renderNode(res.nodoIniziale, res.statoEroe);
        AppRouter.navigate("view-gameplay");
      }
    } catch (err) {
      console.error("[Rules2Engine] Errore avvio partita:", err);
      alert("Impossibile avviare la sessione di gioco: " + err.message);
    }
  },

  // --------------------------------------------------------------------------
  // 2. RENDERING COCKPIT NARRATIVO & SCENE
  // --------------------------------------------------------------------------
  renderNode: function(node, hero) {
    if (node) AppState.activeSession.currentNode = node;
    if (hero) {
      AppState.activeSession.hero = hero;
      Wallet.setGold(hero.oro || 0);
    }

    const currentNode = AppState.activeSession.currentNode;
    const currentHero = AppState.activeSession.hero;
    if (!currentNode) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // Intestazione Cockpit
    const saga = AppState.games.catalog.find(g => g.gameKey === AppState.activeSession.gameKey);
    s("game-header-series", (saga ? saga.serie : "AVVENTURA NOIR").toUpperCase());
    s("game-header-episode", `Episodio ${AppState.activeSession.episodio}`);

    // HUD Eroe Superiore
    if (currentHero) {
      s("kpi-hero-name", currentHero.nomeEroe || "Avventuriero");
      s("kpi-hero-gold", currentHero.oro || 0);
      s("kpi-hero-pv-text", `${currentHero.pv || 0}/${currentHero.pvMax || 25}`);

      const pvBar = document.getElementById("kpi-hero-pv-bar");
      if (pvBar) {
        pvBar.value = currentHero.pv || 0;
        pvBar.max = currentHero.pvMax || 25;
      }

      if (currentHero.modificatori) {
        s("kpi-mod-for", (currentHero.modificatori.FORZA >= 0 ? "+" : "") + currentHero.modificatori.FORZA);
        s("kpi-mod-des", (currentHero.modificatori.DESTREZZA >= 0 ? "+" : "") + currentHero.modificatori.DESTREZZA);
        s("kpi-mod-int", (currentHero.modificatori.INTELLIGENZA >= 0 ? "+" : "") + currentHero.modificatori.INTELLIGENZA);
      }
    }

    // Inquadratura Cinema & Banner Citazione a spazio fisso (72px)
    const img = document.getElementById("scene-image");
    if (img) {
      img.src = currentNode.mediaUrl || "https://image.pollinations.ai/prompt/noir-docks-night-cinematic?width=800&height=450&nologo=true";
    }

    s("scene-type-badge", currentNode.tipo || "SNODO");
    s("scene-title", currentNode.nome || "Avventura");
    s("scene-text", currentNode.testo || "");

    const wBanner = document.getElementById("scene-watermark-banner");
    if (currentNode.citazione && currentNode.citazione !== "—" && currentNode.citazione !== "-") {
      s("scene-quote", `“${currentNode.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”`);
      s("scene-author", currentNode.autoreCitazione || "");
      if (wBanner) wBanner.classList.remove("hidden");
    } else {
      if (wBanner) wBanner.classList.add("hidden");
    }

    // Render Scelte / Azioni
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    const isCombat = (currentNode.tipo === "NEMICO" || (currentNode.id && currentNode.id.includes("NEM_")));

    // CASO 1: COMBATTIMENTO
    if (isCombat) {
      if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("combat");

      let bribeHtml = "";
      if (currentNode.corruption && currentNode.corruption.canCorrupt && currentNode.corruption.validDrugs.length > 0) {
        bribeHtml = currentNode.corruption.validDrugs.map(d => `
          <button onclick="Rules2Engine.combatBribe('${d.nome.replace(/'/g, "\\'")}')" class="btn btn-xs btn-block btn-warning font-bold text-[10px] mt-1 shadow-md">
            💊 Cedi ${d.nome} ${d.costoDosi === 0 ? '(0 dosi - Alleato)' : ''}
          </button>
        `).join("");
      }

      actBox.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <button onclick="Rules2Engine.combatAction('attack_round')" class="btn btn-sm btn-error font-black shadow-lg shadow-rose-600/30">
            ⚔️ Attacca Round
          </button>
          <button onclick="Rules2Engine.combatAction('flee')" class="btn btn-sm btn-outline border-white/20 text-xs font-bold">
            🏃 Fuggi
          </button>
        </div>
        ${bribeHtml}
      `;
      return;
    }

    // CASO 2: ENIGMA / QUIZ D'ARCHIVIO
    if (currentNode.quiz) {
      actBox.innerHTML = `
        <div class="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs">
          <div class="font-bold text-amber-300">❓ ${currentNode.quiz.domanda}</div>
          <div class="grid grid-cols-2 gap-1.5 pt-1">
            ${currentNode.quiz.opzioni.map(opz => `
              <button onclick="Rules2Engine.submitQuizAnswer('${opz.replace(/'/g, "\\'")}')" class="btn btn-xs btn-outline border-white/20 text-[10px] truncate">
                ${opz}
              </button>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    // CASO 3: BIVIO NARRATIVO STANDARD (SND_*)
    if (currentNode.choices && currentNode.choices.length > 0) {
      if (currentNode.choices.length === 2) {
        actBox.innerHTML = `
          <div class="grid grid-cols-2 gap-2">
            <button onclick="Rules2Engine.advanceToNode('${currentNode.choices[0].target}')" class="btn btn-sm btn-primary text-xs font-bold truncate shadow-md">
              ${currentNode.choices[0].testo}
            </button>
            <button onclick="Rules2Engine.advanceToNode('${currentNode.choices[1].target}')" class="btn btn-sm btn-primary text-xs font-bold truncate shadow-md">
              ${currentNode.choices[1].testo}
            </button>
          </div>
        `;
      } else {
        actBox.innerHTML = currentNode.choices.map(c => `
          <button onclick="Rules2Engine.advanceToNode('${c.target}')" class="btn btn-sm btn-block btn-primary text-xs font-bold mb-1.5 truncate shadow-md">
            ${c.testo}
          </button>
        `).join("");
      }
    } else {
      // Snodo Terminale / Epilogo
      actBox.innerHTML = `
        <button onclick="Rules2Engine.leaveGameToHub()" class="btn btn-sm btn-block btn-outline border-white/20 text-xs font-bold">
          🏁 Capitolo Concluso ➔ Torna ai Giochi
        </button>
      `;
    }
  },

  advanceToNode: async function(targetId) {
    if (!AppState.activeSession.gameKey) return;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");

    try {
      const res = await apiCall("game_node", {
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio,
        nodeId: targetId,
        partitaId: AppState.activeSession.partitaId
      });
      if (res && res.nodo) {
        this.renderNode(res.nodo, res.statoEroe);
      }
    } catch (e) {
      console.error("[Rules2Engine] Errore advanceToNode:", e);
      alert("Errore nell'avanzamento allo snodo: " + e.message);
    }
  },

  // --------------------------------------------------------------------------
  // 3. COMBATTIMENTO D20, SUSPENSE, NECROMANZIA & CORRUZIONE
  // --------------------------------------------------------------------------
  combatAction: async function(subAction) {
    if (!AppState.activeSession.gameKey) return;

    const diceModal = document.getElementById("modal-dice-suspense");
    const diceCube = document.getElementById("dice-visual-cube");
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // Attivazione animazione dado D20 per l'attacco
    if (subAction === "attack_round") {
      s("dice-roll-title", "Lancio D20 in corso...");
      s("dice-roll-result", "--");
      s("dice-roll-desc", "Tiro di dado sommato ai modificatori...");
      if (diceCube) diceCube.classList.add("dice-rolling");
      if (diceModal) diceModal.showModal();
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("dice");
    }

    try {
      const res = await apiCall("game_action", {
        subAction: subAction,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });

      if (subAction === "attack_round" && res.combatLog) {
        const log = res.combatLog;
        if (diceCube) diceCube.classList.remove("dice-rolling");
        s("dice-roll-result", `D20: ${log.d20Hero} (${log.totHero >= log.cdTarget ? 'COLPITO' : 'A VUOTO'})`);
        s("dice-roll-desc", `Totale: ${log.totHero} vs CD ${log.cdTarget}`);

        setTimeout(() => {
          if (diceModal) diceModal.close();

          if (log.isHit) {
            this.showFloatingDamage(`💥 -${log.dmgDealt} PV`, log.isCrit, false);
            if (typeof SoundEngine !== "undefined") SoundEngine.playSfx(log.isCrit ? "crit_hit" : "hit");
          } else {
            this.showFloatingDamage("💨 A vuoto", false, false);
          }

          if (log.dmgTaken > 0) {
            setTimeout(() => {
              this.showFloatingDamage(`💔 -${log.dmgTaken} PV Squadra`, false, true);
            }, 300);
          }

          if (res.status === "VICTORY") {
            if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("victory");
            if (window.confetti) confetti({ particleCount: 70, spread: 60 });

            const hero = AppState.activeSession.hero;
            const hasNecroAbl = (hero && hero.abilita && hero.abilita.includes("Necromanzia") && hero.pv > 1);
            AppState.activeSession.engineState.pendingVictory = res.nextView;

            if (hasNecroAbl && !res.victoryData?.chainInfected) {
              this.renderNecromancyPrompt(res.victoryData.enemy);
            } else {
              this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
            }
          } else if (res.status === "DEFEAT") {
            if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("defeat");
            this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
          } else {
            this.renderNode(res.nodo, res.statoEroe);
          }
        }, 750);
      } else if (res.nextView) {
        this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
      } else if (res.nodo) {
        this.renderNode(res.nodo, res.statoEroe);
      }
    } catch (e) {
      if (diceModal) diceModal.close();
      console.error("[Rules2Engine] Errore combatAction:", e);
      alert("Errore durante l'azione di combattimento: " + e.message);
    }
  },

  renderNecromancyPrompt: function(deadEnemy) {
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    actBox.innerHTML = `
      <div class="p-2.5 rounded-xl bg-purple-950/80 border border-purple-500/50 text-center space-y-2 text-xs">
        <div class="font-black text-purple-300">🧟 RIANIMAZIONE ZOMBI DISPONIBILE</div>
        <div class="text-[10px] text-slate-300">Il cadavere di ${deadEnemy ? deadEnemy.nome : 'questo nemico'} può risorgere al tuo comando (Danno x2).</div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button onclick="Rules2Engine.executeResurrectZombie('${deadEnemy ? deadEnemy.id : ''}')" class="btn btn-xs btn-secondary font-bold">
            🧟 Rianima (1 PV)
          </button>
          <button onclick="Rules2Engine.skipNecromancy()" class="btn btn-xs btn-outline border-white/20 text-slate-300">
            Avanza oltre ▶️
          </button>
        </div>
      </div>
    `;
  },

  executeResurrectZombie: async function(enemyId) {
    try {
      const res = await apiCall("game_action", {
        subAction: "resurrect_zombie",
        targetId: enemyId,
        method: "ABILITA",
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("zombie");
        this.showFloatingDamage("🧟 Risorto!", false, false);
        if (AppState.activeSession.engineState.pendingVictory) {
          this.renderNode(AppState.activeSession.engineState.pendingVictory.nodo, res.statoEroe);
          AppState.activeSession.engineState.pendingVictory = null;
        }
      }
    } catch (e) {
      alert("Rianimazione fallita: " + e.message);
      this.skipNecromancy();
    }
  },

  skipNecromancy: function() {
    if (AppState.activeSession.engineState?.pendingVictory) {
      const next = AppState.activeSession.engineState.pendingVictory;
      this.renderNode(next.nodo, next.statoEroe);
      AppState.activeSession.engineState.pendingVictory = null;
    }
  },

  combatBribe: async function(drugName) {
    if (!AppState.activeSession.gameKey) return;
    try {
      const res = await apiCall("game_action", {
        subAction: "bribe",
        drug: drugName,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("bribe");
        this.showFloatingDamage("🟡 Corrotto!", false, false);
        this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
      }
    } catch (e) {
      alert("Corruzione non riuscita: " + e.message);
    }
  },

  showFloatingDamage: function(text, isCrit, isHeroDmg) {
    const box = document.getElementById("floating-damage-box");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `floating-damage font-black text-xl md:text-2xl ${isHeroDmg ? 'text-rose-400 text-glow-rose' : (isCrit ? 'text-amber-300 text-glow-amber text-3xl' : 'text-sky-300')}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  submitQuizAnswer: function(selectedOpz) {
    const node = AppState.activeSession.currentNode;
    if (!node || !node.quiz) return;
    const isCorrect = (selectedOpz.trim().toLowerCase() === node.quiz.rispostaEsatta?.trim().toLowerCase());
    if (isCorrect) {
      this.showFloatingDamage("✅ Esatto!", false, false);
      this.advanceToNode(node.destSuccesso);
    } else {
      this.showFloatingDamage("❌ Errato!", false, true);
      this.advanceToNode(node.destFallimento);
    }
  },

  // --------------------------------------------------------------------------
  // 4. I 5 CASSETTI DEL COCKPIT DI GIOCO
  // --------------------------------------------------------------------------

  // A. ZAINO DELL'EROE
  openBackpackDrawer: function() {
    this.filterBackpack(AppState.activeSession.engineState?.backpackFilter || "ALL");
    const drawer = document.getElementById("drawer-backpack");
    if (drawer) drawer.showModal();
  },

  filterBackpack: function(cat) {
    if (!AppState.activeSession.engineState) {
      AppState.activeSession.engineState = {};
    }
    AppState.activeSession.engineState.backpackFilter = cat || "ALL";

    const tabsContainer = document.getElementById("backpack-tabs");
    if (tabsContainer) {
      tabsContainer.querySelectorAll("button").forEach(btn => {
        const btnText = btn.textContent.toUpperCase();
        const isMatch = (cat === "ALL" && btnText.includes("TUTTI")) || btnText.includes(cat);
        btn.className = `badge badge-sm ${isMatch ? 'badge-info font-black shadow' : 'badge-ghost font-bold'} cursor-pointer transition-all`;
      });
    }

    const c = document.getElementById("backpack-slots-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    let inv = h.inventario || [];
    if (inv.length === 0) {
      c.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">Il tuo zaino è vuoto.</div>`;
      return;
    }

    if (cat && cat !== "ALL") {
      inv = inv.filter(it => this._classifyItem(it) === cat);
      if (inv.length === 0) {
        c.innerHTML = `<div class="col-span-full py-6 text-center text-slate-500 text-xs">Nessun articolo per il reparto <b>${cat}</b> nello zaino.</div>`;
        return;
      }
    }

    c.innerHTML = inv.map(it => {
      const isArma = (h.armaAttiva && it.toLowerCase() === h.armaAttiva.toLowerCase());
      const isVeicolo = (h.veicoloAttivo && it.toLowerCase() === h.veicoloAttivo.toLowerCase());
      const low = it.toLowerCase();

      let btnLabel = "Usa";
      let btnClass = "btn-outline border-white/20 text-white";
      let btnAction = `Rules2Engine.useBackpackItem('${it.replace(/'/g, "\\'")}')`;

      // Riconoscimento armi completo ed esteso
      if (low.includes("remo") || low.includes("serramanico") || low.includes("fiocina") ||
          low.includes("mannaia") || low.includes("catena") || low.includes("tondino") ||
          low.includes("coltello") || low.includes("arpione") || low.includes("tubo") ||
          low.includes("piede porco") || low.includes("piede di porco") || low.includes("mazzetta")) {
        if (isArma) {
          btnLabel = "✓ In Pugno";
          btnClass = "btn-success font-black cursor-default text-white";
          btnAction = "";
        } else {
          btnLabel = "Impugna";
          btnAction = `Rules2Engine.equipItem('${it.replace(/'/g, "\\'")}', 'weapon')`;
        }
      } else if (low.includes("ciao") || low.includes("apecar") || low.includes("panda") ||
                 low.includes("monopattino") || low.includes("bici") || low.includes("barchino") ||
                 low.includes("parapendio") || low.includes("canoa") || low.includes("zodiac") || low.includes("scarabeo")) {
        if (isVeicolo) {
          btnLabel = "✓ In Uso";
          btnClass = "btn-success font-black cursor-default text-white";
          btnAction = "";
        } else {
          btnLabel = "Attiva";
          btnAction = `Rules2Engine.equipItem('${it.replace(/'/g, "\\'")}', 'vehicle')`;
        }
      }

      return `
        <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex items-center justify-between text-xs">
          <div class="overflow-hidden pr-2">
            <div class="font-bold text-white truncate">${it}</div>
            <div class="text-[9px] ${isArma || isVeicolo ? 'text-emerald-400 font-bold' : 'text-slate-400'}">
              ${isArma ? '🗡️ [ARMA ATTIVA]' : (isVeicolo ? '🛴 [VEICOLO ATTIVO]' : 'Articolo')}
            </div>
          </div>
          <button onclick="${btnAction}" class="btn btn-xs ${btnClass} text-[9px] shrink-0" ${btnAction === "" ? "disabled" : ""}>
            ${btnLabel}
          </button>
        </div>
      `;
    }).join("");
  },

  equipItem: async function(itemName, type) {
    if (!AppState.activeSession.gameKey) return;
    try {
      const res = await apiCall("game_action", {
        subAction: "equip",
        item: itemName,
        type: type,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
        AppState.activeSession.hero = res.statoEroe;
        this.renderNode(AppState.activeSession.currentNode, res.statoEroe);
        this.filterBackpack(AppState.activeSession.engineState.backpackFilter);
      }
    } catch (e) {
      alert("Impossibile equipaggiare l'oggetto: " + e.message);
    }
  },

  useBackpackItem: async function(itemName) {
    if (!AppState.activeSession.gameKey) return;
    try {
      const res = await apiCall("game_action", {
        subAction: "use_item",
        item: itemName,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("drug");
        AppState.activeSession.hero = res.statoEroe;
        this.renderNode(AppState.activeSession.currentNode, res.statoEroe);
        this.filterBackpack(AppState.activeSession.engineState.backpackFilter);
      }
    } catch (e) {
      alert("Impossibile usare l'oggetto: " + e.message);
    }
  },

  // B. EMPORIO DI CICCIO & CO. (RPG)
  openEmporioDrawer: function() {
    const h = AppState.activeSession.hero;
    const goldDisp = document.getElementById("emporio-gold-display");
    if (goldDisp) goldDisp.textContent = `${h ? h.oro : 0} 🟡`;
    this.setEmporioMode(AppState.activeSession.engineState?.emporioMode || "buy");
    const drawer = document.getElementById("drawer-emporio");
    if (drawer) drawer.showModal();
  },

  setEmporioMode: function(mode) {
    if (!AppState.activeSession.engineState) {
      AppState.activeSession.engineState = {};
    }
    AppState.activeSession.engineState.emporioMode = mode;

    const btnBuy = document.getElementById("emporio-tab-buy");
    const btnSell = document.getElementById("emporio-tab-sell");
    const container = document.getElementById("emporio-items-container");
    const h = AppState.activeSession.hero;

    if (btnBuy) btnBuy.className = `flex-1 btn btn-xs ${mode === 'buy' ? 'btn-primary' : 'btn-ghost text-slate-400'} font-bold text-[10px]`;
    if (btnSell) btnSell.className = `flex-1 btn btn-xs ${mode === 'sell' ? 'btn-primary' : 'btn-ghost text-slate-400'} font-bold text-[10px]`;

    if (mode === "sell") {
      const inv = (h && h.inventario) ? h.inventario : [];
      if (inv.length === 0) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">Nessuna refurtiva o merce da vendere nello zaino.</div>`;
        return;
      }
      container.innerHTML = inv.map(it => `
        <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex items-center justify-between text-xs">
          <span class="font-bold text-white truncate pr-2">${it}</span>
          <button onclick="Rules2Engine.sellToEmporio('${it.replace(/'/g, "\\'")}')" class="btn btn-xs btn-warning font-bold text-[9px] shrink-0">
            Vendi (+10 🟡)
          </button>
        </div>
      `).join("");
    } else {
      const saga = AppState.games.catalog.find(g => g.gameKey === AppState.activeSession.gameKey);
      const shopItems = (saga && saga.equipaggiamenti) ? saga.equipaggiamenti : [];

      if (shopItems.length === 0) {
        container.innerHTML = `<div class="col-span-full py-6 text-center text-slate-500 text-xs">Nessun articolo per l'avventura disponibile sul bancone.</div>`;
        return;
      }

      container.innerHTML = shopItems.slice(0, 16).map(item => {
        const price = Math.abs(parseInt(item.costoOro || item.costo || 15, 10)) || 15;
        const canAfford = (h && h.oro >= price);

        return `
          <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex flex-col justify-between text-xs space-y-2">
            <div>
              <div class="flex items-center justify-between">
                <span class="text-sm">${item.emoji || '📦'}</span>
                <span class="text-[10px] text-amber-300 font-mono font-bold">${price} 🟡</span>
              </div>
              <div class="font-bold text-white truncate mt-1">${item.nome}</div>
              <div class="text-[9px] text-slate-400 line-clamp-1">${item.descrizione || item.categoria || ''}</div>
            </div>
            <button onclick="Rules2Engine.buyFromEmporio('${item.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'} font-bold text-[9px]" ${!canAfford ? 'disabled' : ''}>
              ${canAfford ? 'Compra' : 'Oro Insuff.'}
            </button>
          </div>
        `;
      }).join("");
    }
  },

  buyFromEmporio: function(itemId, goldCost) {
    const hero = AppState.activeSession.hero;
    if (!hero) return;
    if (hero.oro < goldCost) {
      alert("Monete d'oro insufficienti!");
      return;
    }

    const saga = AppState.games.catalog.find(g => g.gameKey === AppState.activeSession.gameKey);
    const shopItems = (saga && saga.equipaggiamenti) ? saga.equipaggiamenti : [];
    const item = shopItems.find(i => i.id === itemId);
    if (!item) return;

    if (this._classifyItem(item.nome) === "VEICOLI") {
      const hasVehicle = (hero.inventario || []).some(x => this._classifyItem(x) === "VEICOLI");
      if (hasVehicle) {
        alert("Puoi possedere un solo Veicolo nello zaino!");
        return;
      }
    }

    hero.oro -= goldCost;
    hero.inventario.push(item.nome);
    Wallet.setGold(hero.oro);

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
    this.openEmporioDrawer();
    this.renderNode(AppState.activeSession.currentNode, hero);
  },

  sellToEmporio: function(itemName) {
    const hero = AppState.activeSession.hero;
    if (!hero) return;
    const idx = (hero.inventario || []).indexOf(itemName);
    if (idx !== -1) {
      hero.inventario.splice(idx, 1);
      hero.oro += 10;
      if (hero.armaAttiva === itemName) hero.armaAttiva = "";
      if (hero.veicoloAttivo === itemName) hero.veicoloAttivo = "";
      Wallet.setGold(hero.oro);

      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
      this.openEmporioDrawer();
      this.renderNode(AppState.activeSession.currentNode, hero);
    }
  },

  // C. BANCO DI CAMBIO VALUTA (MEGOIN ➔ ORO)
  openCambioModal: function() {
    const balEl = document.getElementById("cambio-megoin-balance");
    const currentMegoin = Wallet.getMegoin();
    if (balEl) balEl.textContent = currentMegoin;
    const modal = document.getElementById("modal-banco-cambio");
    if (modal) modal.showModal();
  },

  convertMegoinToGold: async function(megoinCost, goldEarned) {
    const currentMegoin = Wallet.getMegoin();
    if (currentMegoin < megoinCost) {
      alert("Saldo Megoin insufficiente!");
      return;
    }

    try {
      const res = await apiCall("currency_exchange", {
        megoin: megoinCost,
        gold: goldEarned,
        gameKey: AppState.activeSession.gameKey || "game1"
      });

      if (res && res.success) {
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
        if (window.confetti) confetti({ particleCount: 60, spread: 50 });

        const nuovoSaldo = res.nuovoSaldoMegoin !== undefined ? res.nuovoSaldoMegoin : (currentMegoin - megoinCost);
        Wallet.setMegoin(nuovoSaldo);

        // Se siamo durante il Wizard:
        if (typeof Rules2Wizard !== "undefined" && Rules2Wizard.state.currentGold !== undefined) {
          Rules2Wizard.state.currentGold += goldEarned;
          const wizGoldDisp = document.getElementById("wizard-shop-gold-display");
          if (wizGoldDisp) wizGoldDisp.textContent = `💰 ${Rules2Wizard.state.currentGold} 🟡`;
        }

        // Se siamo nel Gameplay attivo:
        if (AppState.activeSession.hero) {
          const nuovoOro = res.nuovoOro !== undefined ? res.nuovoOro : (AppState.activeSession.hero.oro + goldEarned);
          Wallet.setGold(nuovoOro);
          this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
        }

        if (typeof AppModules !== "undefined") {
          AppModules.renderProfile(AppState.user);
        }

        alert(`✅ Convertiti con successo ${megoinCost} 🪙 in +${goldEarned} 🟡 Oro!`);
        document.getElementById("modal-banco-cambio")?.close();
      }
    } catch (e) {
      console.error("[Rules2Engine] Errore currency_exchange:", e);
      alert("Errore nel banco di cambio valuta: " + e.message);
    }
  },

  // D. SQUADRA & ZOMBI AL SEGUITO
  openSquadDrawer: function() {
    const c = document.getElementById("squad-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    let html = "";
    const comp = h.compagni || [];
    const compData = h.compagniData || {};
    const zombies = h.zombieSquad || [];

    if (comp.length === 0 && zombies.length === 0) {
      html = `<div class="py-6 text-center text-slate-500 text-xs">Sei in solitaria. Nessun alleato o zombi presente.</div>`;
    } else {
      html += comp.map(a => {
        const d = compData[a] || {};
        const hpText = d.pv ? ` (❤️ ${d.pv}/${d.pvMax || 15} PV)` : "";
        return `<div class="p-2.5 bg-surface rounded-xl border border-white/5 font-bold text-xs flex justify-between"><span>🤝 ${a}${hpText}</span> <span class="text-emerald-400">Alleato Umano</span></div>`;
      }).join("");
      html += zombies.map(z => `
        <div class="p-2.5 bg-surface rounded-xl border border-rose-500/30 font-bold text-xs flex justify-between">
          <span>🧟 ${z.nome}</span> <span class="text-rose-400 font-bold">Danno x2 (❤️ ${z.pv}/${z.pvMax || 15})</span>
        </div>
      `).join("");
    }

    c.innerHTML = html;
    const drawer = document.getElementById("drawer-squad");
    if (drawer) drawer.showModal();
  },

  // E. DOSSIER & ORGANIGRAMMA DEL POTERE (6 FAZIONI)
  openDossierDrawer: function() {
    const c = document.getElementById("dossier-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    const inv = h.inventario || [];
    const infoItems = inv.filter(it => {
      const low = it.toLowerCase();
      return low.includes("bolla") || low.includes("cartone") || low.includes("fattura") ||
             low.includes("schema") || low.includes("registro") || low.includes("appunto") ||
             low.includes("tracce") || low.includes("file") || low.includes("foto") || low.includes("quaderno");
    });

    if (infoItems.length === 0) {
      c.innerHTML = `<div class="py-6 text-center text-slate-500 text-xs">Nessun reperto d'inchiesta raccolto finora.</div>`;
    } else {
      c.innerHTML = infoItems.map(p => {
        const low = p.toLowerCase();
        let targetFaction = "Generale";
        let isPermanent = low.includes("bolla") || low.includes("cartone") || low.includes("fattura") || low.includes("schema") || low.includes("registro");

        if (low.includes("tarik") || low.includes("lecciona")) targetFaction = "Mazzu";
        else if (low.includes("patek") || low.includes("appalti")) targetFaction = "Camorristi";
        else if (low.includes("banchina vip") || low.includes("moriconi") || low.includes("ceragioli")) targetFaction = "Burocrati";
        else if (low.includes("duccio") || low.includes("jerry") || low.includes("quaderno")) targetFaction = "Ideologi";
        else if (low.includes("elio") || low.includes("cecco")) targetFaction = "Cazzari";

        return `
          <div class="p-3 bg-surface rounded-xl border border-sky-500/30 text-xs space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-sky-400">📁 ${p}</span>
              <span class="badge badge-xs badge-info font-mono text-[8px]">${targetFaction}</span>
            </div>
            <div class="text-[10px] text-slate-300">
              ${isPermanent ? 'Reperto dell\'Organigramma: <b class="text-emerald-400">+1 INT permanente</b>' : `Reperto d'inchiesta mirato: <b class="text-amber-300">+1 INT vs ${targetFaction}</b>`}
            </div>
          </div>
        `;
      }).join("");
    }

    const drawer = document.getElementById("drawer-dossier");
    if (drawer) drawer.showModal();
  },

  // --------------------------------------------------------------------------
  // 5. CONTROLLO ABBANDONO & USCITA ALL'HUB
  // --------------------------------------------------------------------------
  openAbandonModal: function() {
    const modal = document.getElementById("modal-abandon");
    if (modal) modal.showModal();
  },

  confirmAbandon: function() {
    const modal = document.getElementById("modal-abandon");
    if (modal) modal.close();

    // Reset della sessione attiva in AppState
    AppState.activeSession.partitaId = null;
    AppState.activeSession.hero = null;
    AppState.activeSession.currentNode = null;
    AppState.activeSession.engineState = null;

    this.leaveGameToHub();
  },

  leaveGameToHub: function() {
    AppRouter.navigate("games");
  },

  // --------------------------------------------------------------------------
  // 6. HELPER INTERNO CLASSIFICAZIONE OGGETTI
  // --------------------------------------------------------------------------
  _classifyItem: function(itemName) {
    if (!itemName) return "STRUMENTI";
    const low = String(itemName).toLowerCase();

    if (low.includes("remo") || low.includes("serramanico") || low.includes("fiocina") ||
        low.includes("mannaia") || low.includes("catena") || low.includes("tondino") ||
        low.includes("coltello") || low.includes("arpione") || low.includes("tubo") ||
        low.includes("piede porco") || low.includes("piede di porco") || low.includes("mazzetta")) return "ARMI";

    if (low.includes("ciao") || low.includes("apecar") || low.includes("panda") ||
        low.includes("monopattino") || low.includes("bici") || low.includes("barchino") ||
        low.includes("parapendio") || low.includes("canoa") || low.includes("zodiac") || low.includes("scarabeo")) return "VEICOLI";

    if (low.includes("cecina") || low.includes("trabaccolara") || low.includes("fritto") ||
        low.includes("ponce") || low.includes("focaccia") || low.includes("valdostana") || low.includes("garze")) return "CURE";

    if (low.includes("thc") || low.includes("danpei") || low.includes("valium") ||
        low.includes("spada") || low.includes("gnugna") || low.includes("marmolina") ||
        low.includes("spore") || low.includes("talea") || low.includes("resina") || low.includes("solvente")) return "DROGHE";

    if (low.includes("talismano") || low.includes("dente") || low.includes("bitta") || low.includes("zanna") || low.includes("corno")) return "TALISMANI";

    return "STRUMENTI";
  }
};

// ----------------------------------------------------------------------------
// 7. REGISTRAZIONE NEL MOTORE UNIVERSALE (ENGINE REGISTRY)
// ----------------------------------------------------------------------------
if (typeof EngineRegistry !== "undefined") {
  EngineRegistry.register("Rules2", Rules2Engine);
}

// ----------------------------------------------------------------------------
// 8. ALIASING DIRETTO SU WINDOW.GAMEENGINE
// Mantiene intatta la compatibilità con tutti gli onclick inline di index.html!
// ----------------------------------------------------------------------------
window.GameEngine = window.GameEngine || {};
window.GameEngine.leaveGameToHub = () => Rules2Engine.leaveGameToHub();
window.GameEngine.openAbandonModal = () => Rules2Engine.openAbandonModal();
window.GameEngine.confirmAbandon = () => Rules2Engine.confirmAbandon();
window.GameEngine.openBackpackDrawer = () => Rules2Engine.openBackpackDrawer();
window.GameEngine.filterBackpack = (c) => Rules2Engine.filterBackpack(c);
window.GameEngine.useBackpackItem = (it) => Rules2Engine.useBackpackItem(it);
window.GameEngine.equipItem = (it, t) => Rules2Engine.equipItem(it, t);
window.GameEngine.openEmporioDrawer = () => Rules2Engine.openEmporioDrawer();
window.GameEngine.setEmporioMode = (m) => Rules2Engine.setEmporioMode(m);
window.GameEngine.buyFromEmporio = (id, p) => Rules2Engine.buyFromEmporio(id, p);
window.GameEngine.sellToEmporio = (it) => Rules2Engine.sellToEmporio(it);
window.GameEngine.openCambioModal = () => Rules2Engine.openCambioModal();
window.GameEngine.convertMegoinToGold = (m, g) => Rules2Engine.convertMegoinToGold(m, g);
window.GameEngine.openSquadDrawer = () => Rules2Engine.openSquadDrawer();
window.GameEngine.openDossierDrawer = () => Rules2Engine.openDossierDrawer();
window.GameEngine.combatAction = (act) => Rules2Engine.combatAction(act);
window.GameEngine.combatBribe = (d) => Rules2Engine.combatBribe(d);
window.GameEngine.executeResurrectZombie = (id) => Rules2Engine.executeResurrectZombie(id);
window.GameEngine.skipNecromancy = () => Rules2Engine.skipNecromancy();
window.GameEngine.submitQuizAnswer = (a) => Rules2Engine.submitQuizAnswer(a);
window.GameEngine.advanceToNode = (t) => Rules2Engine.advanceToNode(t);
