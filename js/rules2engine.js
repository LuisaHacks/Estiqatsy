// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2engine.js (VERSIONE 4.0 - STANDALONE GOLD & 3-WAY EXIT MODAL)
// LAYER: GAMEPLAY LOOP, D20 COMBAT, ASSETTO LOADOUT, CRAFTING & FORFEIT ENGINE
// NOTE: 100% DISACCOPPIATO DAL WALLET PIATTAFORMA - GESTIONE AUTONOMA DELL'ORO
// ============================================================================

// ----------------------------------------------------------------------------
// 1. UTILITY CONDIVISE & COSTANTI RICETTARIO CHIMICO
// ----------------------------------------------------------------------------
const RULES2_SYNTHESIS_RECIPES = {
  "spore duna": { toolName: "Capsulatrice Inox", toolId: "EQP_0031_S1_E0", prodName: "Psilocybe Duna", prodId: "EQP_0039_S1_E0", turns: 2, icon: "🍄" },
  "talea indoor": { toolName: "Estrattore BHO", toolId: "EQP_0023_S1_E0", prodName: "Danpei Gold", prodId: "EQP_0037_S1_E0", turns: 2, icon: "🌿" },
  "mosto padule": { toolName: "Alambicco Rame", toolId: "EQP_0024_S1_E0", prodName: "Ponce Caldo", prodId: "EQP_0038_S1_E0", turns: 1, icon: "☕" },
  "resina grezza": { toolName: "Fornello Taglio", toolId: "EQP_0030_S1_E0", prodName: "Brown Bufalina", prodId: "EQP_0042_S1_E0", turns: 3, icon: "🥄" },
  "scarto solvente": { toolName: "Fornello Taglio", toolId: "EQP_0030_S1_E0", prodName: "Puro Bogotà", prodId: "EQP_0040_S1_E0", turns: 3, icon: "💎" }
};

if (typeof Rules2_ClassifyEntity === "undefined") {
  window.Rules2_ClassifyEntity = function(item) {
    if (!item) return "STRUMENTI";
    const cat = String(item.categoria || "").toUpperCase().trim();
    const sub = String(item.sottocategoria || "").toUpperCase().trim();
    if (cat.includes("ARMA")) return "ARMI";
    if (cat.includes("VEICOLO")) return "VEICOLI";
    if (cat.includes("INFORMAZION") || sub.includes("PROV") || sub.includes("DOSSIER") || sub.includes("INDIZI")) return "INFORMAZIONI";
    if (cat.includes("TALISMAN") || sub.includes("VOODOO")) return "TALISMANI";
    if (cat.includes("DROGA") || cat.includes("INGREDIENTE")) return "DROGHE";
    if (cat.includes("CURA") || sub.includes("CIBO") || sub.includes("INFERMERIA")) return "CURE";
    return "STRUMENTI";
  };
}

if (typeof Rules2_SafeAttr === "undefined") {
  window.Rules2_SafeAttr = function(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  };
}

if (typeof tgHaptic === "undefined") {
  window.tgHaptic = function(type = "light") {
    try {
      const h = window.Telegram?.WebApp?.HapticFeedback;
      if (!h) return;
      if (type === "selection") h.selectionChanged();
      else if (type === "success") h.notificationOccurred("success");
      else if (type === "warning") h.notificationOccurred("warning");
      else if (type === "error") h.notificationOccurred("error");
      else h.impactOccurred(type);
    } catch (e) {}
  };
}

if (typeof tgAlert === "undefined") {
  window.tgAlert = function(msg) {
    if (window.Telegram?.WebApp?.showAlert) window.Telegram.WebApp.showAlert(msg);
    else alert(msg);
  };
}

// ----------------------------------------------------------------------------
// 2. MOTORE RUNTIME RULES2
// ----------------------------------------------------------------------------
const Rules2Engine = {
  _isBusy: false,
  _activeHeroTab: "scheda",

  _setBusy: function(flag) {
    this._isBusy = flag;
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;
    const btns = actBox.querySelectorAll("button");
    btns.forEach(b => {
      if (flag) {
        b.setAttribute("disabled", "true");
        b.classList.add("opacity-50", "pointer-events-none");
      } else {
        b.removeAttribute("disabled");
        b.classList.remove("opacity-50", "pointer-events-none");
      }
    });
  },

  // --------------------------------------------------------------------------
  // GESTIONE AUTONOMA ORO DI GIOCO (DISACCOPPIATA DALLA PIATTAFORMA)
  // --------------------------------------------------------------------------
  getGold: function() {
    const h = AppState.activeSession?.hero;
    return h ? (parseInt(h.oro, 10) || 0) : 0;
  },

  setGold: function(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    if (AppState.activeSession?.hero) {
      AppState.activeSession.hero.oro = num;
    }
    const kpi = document.getElementById("kpi-hero-gold");
    if (kpi) kpi.textContent = num;
    const emp = document.getElementById("emporio-gold-display");
    if (emp) emp.textContent = `${num} 🟡`;
    const sheet = document.getElementById("sheet-hero-gold");
    if (sheet) sheet.textContent = `${num} 🟡`;
    const wiz = document.getElementById("wizard-shop-gold-display");
    if (wiz) wiz.textContent = `💰 ${num} 🟡`;
  },

  addGold: function(amount) {
    this.setGold(this.getGold() + amount);
  },

  // --------------------------------------------------------------------------
  // FLUSSO CABINATO: RILEVAMENTO SESSIONE ATTIVA vs NUOVA PARTITA
  // --------------------------------------------------------------------------
  launchSession: function(gameKey, epNum, canContinueFree, savedHero) {
    const saga = (AppState.games.catalog || []).find(g => g.gameKey === gameKey);
    const modal = document.getElementById("modal-insert-megoin");
    if (!modal) {
      if (typeof Rules2Wizard !== "undefined") {
        return Rules2Wizard.open(gameKey, epNum, canContinueFree, savedHero);
      }
      return;
    }

    const activeBox = document.getElementById("arcade-active-game-box");
    const insertBox = document.getElementById("arcade-insert-coin-box");

    // SE C'È UNA PARTITA ATTIVA E NON ABBANDONATA: Mostra opzione Riprendi o Sovrascrivi
    if (saga && saga.hasActiveGame && saga.activePartitaId) {
      if (activeBox) activeBox.classList.remove("hidden");
      if (insertBox) insertBox.classList.add("hidden");

      activeBox.innerHTML = `
        <h3 class="arcade-title">${saga.serie || 'AVVENTURA'}</h3>
        <p class="arcade-subtitle">Sessione attiva salvata (ID: ${saga.activePartitaId})</p>
        <div class="arcade-actions-50-50">
          <button id="btn-arcade-new" class="btn btn-outline border-amber-500/40 text-amber-300">Ricomincia (1 🪙)</button>
          <button id="btn-arcade-resume" class="btn btn-success text-slate-950 font-black">Riprendi ▶️</button>
        </div>
      `;

      document.getElementById("btn-arcade-resume").onclick = () => {
        modal.close();
        const activeFase = saga.activeFase || saga.fase || (saga.statoPartita && saga.statoPartita.fase) || "IN_GIOCO";

        // SE SOSPESA DURANTE IL WIZARD: Riprende dallo Step esatto
        if (activeFase.startsWith("WIZARD_")) {
          if (typeof Rules2Wizard !== "undefined") {
            Rules2Wizard.resumeSession(gameKey, saga.activeEpisodio || epNum, saga);
          }
        } else {
          // SE IN GIOCO: Ripristina e naviga allo snodo narrativo attivo
          AppState.activeSession.engineKey = "Rules2";
          AppState.activeSession.gameKey = gameKey;
          AppState.activeSession.episodio = saga.activeEpisodio || epNum;
          AppState.activeSession.partitaId = saga.activePartitaId;
          AppState.activeSession.combatRound = 1;
          AppState.activeSession.combatEnemyId = null;

          AppRouter.navigate("view-gameplay");
          this.advanceToNode(saga.activeNode || `SND_0001_S1_E${saga.activeEpisodio || epNum}`);
        }
      };

      document.getElementById("btn-arcade-new").onclick = () => {
        if (activeBox) activeBox.classList.add("hidden");
        if (insertBox) insertBox.classList.remove("hidden");
        this._setupArcadeCoinScreen(gameKey, epNum, canContinueFree, savedHero, modal);
      };
    } else {
      // PARTITA ABBANDONATA O NUOVA: Mostra ESCLUSIVAMENTE "Inserisci 1 🪙 e Gioca"
      if (activeBox) activeBox.classList.add("hidden");
      if (insertBox) insertBox.classList.remove("hidden");
      this._setupArcadeCoinScreen(gameKey, epNum, canContinueFree, savedHero, modal);
    }

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    modal.showModal();
  },

  _setupArcadeCoinScreen: function(gameKey, epNum, canContinueFree, savedHero, modal) {
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const userBalance = Wallet.getMegoin();

    s("arcade-user-balance", userBalance);

    if (canContinueFree || (savedHero && epNum > 1)) {
      s("arcade-coin-title", "VETERANO");
      s("arcade-coin-desc", `Prosegui con l'Eroe veterano "${savedHero ? (savedHero.nomeEroe || savedHero.classe) : 'In Memoria'}".`);
      s("arcade-cost-badge", "GRATIS");
      const btnLaunch = document.getElementById("arcade-btn-launch");
      if (btnLaunch) {
        btnLaunch.textContent = "Continua 🎖️";
        btnLaunch.onclick = () => {
          modal.close();
          if (typeof Rules2Wizard !== "undefined") {
            Rules2Wizard.open(gameKey, epNum, true, savedHero);
          }
        };
      }
    } else {
      s("arcade-coin-title", "INSERT MEGOIN");
      s("arcade-coin-desc", "1 Megoin per creare e lanciare un nuovo eroe.");
      s("arcade-cost-badge", "1 🪙");
      const btnLaunch = document.getElementById("arcade-btn-launch");
      if (btnLaunch) {
        btnLaunch.textContent = "Inserisci 1 🪙 e Gioca";
        btnLaunch.onclick = () => {
          if (userBalance < 1) {
            tgHaptic("error");
            if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
            return tgAlert("⚠️ Megoin insufficienti!");
          }
          modal.close();
          if (typeof Rules2Wizard !== "undefined") {
            Rules2Wizard.open(gameKey, epNum, false, null);
          }
        };
      }
    }
  },

  executeStartGame: async function(payloadParams, avatarUrl = "") {
    try {
      tgHaptic("success");
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.playSfx("insert_coin");
        SoundEngine.playEpisodeBgm(payloadParams.gameKey, payloadParams.episodio, "explore");
      }

      const res = await apiCall("game_start", payloadParams);
      if (res && res.success) {
        const wizardCatalog = (typeof Rules2Wizard !== "undefined" && Rules2Wizard.state.shopCatalog) || [];
        const allGameItems = typeof deduplicateEntities === "function" ? deduplicateEntities([
          ...(res.emporioItems || []),
          ...(res.equipaggiamenti || []),
          ...wizardCatalog
        ]) : (res.emporioItems || []);

        AppState.activeSession.engineKey = "Rules2";
        AppState.activeSession.gameKey = payloadParams.gameKey;
        AppState.activeSession.episodio = payloadParams.episodio;
        AppState.activeSession.partitaId = res.partitaId;

        AppState.activeSession.hero = {
          ...res.statoEroe,
          mediaUrl: avatarUrl || res.statoEroe?.mediaUrl || "",
          armaAttiva: res.statoEroe?.armaAttiva || "",
          veicoloAttivo: res.statoEroe?.veicoloAttivo || "",
          sostanzaAttiva: "",
          talismanoAttivo: "",
          sintesiInCorso: res.statoEroe?.sintesiInCorso || []
        };

        AppState.activeSession.currentNode = res.nodoIniziale;
        AppState.activeSession.shopCatalog = allGameItems;
        AppState.activeSession.combatRound = 1;
        AppState.activeSession.combatEnemyId = null;
        AppState.activeSession.engineState = {
          pendingVictory: null,
          backpackFilter: "ALL",
          emporioMode: "buy"
        };

        const saga = (AppState.games.catalog || []).find(g => g.gameKey === payloadParams.gameKey);
        if (saga) {
          saga.hasActiveGame = true;
          saga.activePartitaId = res.partitaId;
          saga.activeEpisodio = payloadParams.episodio;
        }

        if (res.nuovoSaldoMegoin !== undefined) {
          Wallet.setMegoin(res.nuovoSaldoMegoin);
        }
        if (typeof AppModules !== "undefined" && typeof AppModules.renderProfile === "function") {
          AppModules.renderProfile(AppState.user);
        }

        this.renderNode(res.nodoIniziale, AppState.activeSession.hero);
        AppRouter.navigate("view-gameplay");
      }
    } catch (err) {
      console.error("[Rules2Engine] Errore avvio partita:", err);
      tgAlert("Errore avvio: " + err.message);
    }
  },

  renderNode: function(node, hero) {
    this._setBusy(false);

    if (node) AppState.activeSession.currentNode = node;
    if (hero) {
      AppState.activeSession.hero = { ...AppState.activeSession.hero, ...hero };
      this.setGold(hero.oro || 0);
    }

    const currentNode = AppState.activeSession.currentNode;
    const currentHero = AppState.activeSession.hero;
    if (!currentNode) return;

    // Monitor Cardiaco Bassa Salute (PV <= 25%)
    if (currentHero && currentHero.pvMax) {
      const pvRatio = (currentHero.pv || 0) / currentHero.pvMax;
      if (pvRatio <= 0.25 && currentHero.pv > 0) {
        if (typeof SoundEngine !== "undefined") SoundEngine.startHeartbeat();
      } else {
        if (typeof SoundEngine !== "undefined") SoundEngine.stopHeartbeat();
      }
    }

    const isDefeat = (currentHero && currentHero.pv <= 0) || (currentNode.categoria === "Fine" && currentNode.sottocategoria === "morte");
    const isVictory = (String(currentNode.id).includes("SND_END") || currentNode.sottocategoria === "gancio" || currentNode.sottocategoria === "conclusione");
    const actBox = document.getElementById("scene-actions-container");

    // 1. ESITO MORTE: 50/50 [ Riprova (1 🪙) ] [ Esci ]
    if (isDefeat) {
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.stopHeartbeat();
        SoundEngine.playSfx("zelda_death");
        SoundEngine.playBgm("defeat");
      }
      if (actBox) {
        actBox.innerHTML = `
          <div class="arcade-actions-50-50">
            <button onclick="Rules2Engine.launchSession('${AppState.activeSession.gameKey}', ${AppState.activeSession.episodio}, false, null)" class="btn btn-warning font-black">
              Riprova (1 🪙) 🔄
            </button>
            <button onclick="Rules2Engine.confirmAbandon()" class="btn btn-outline border-white/20 text-white font-bold">
              Esci 🚪
            </button>
          </div>
        `;
      }
      return;
    }

    // 2. ESITO VITTORIA: 50/50 [ Rigioca Ep. ] [ Episodio Succ. › ]
    if (isVictory) {
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.stopHeartbeat();
        SoundEngine.playSfx("lucky");
        SoundEngine.playBgm("victory");
      }
      if (actBox) {
        actBox.innerHTML = `
          <div class="arcade-actions-50-50">
            <button onclick="if(typeof Rules2Wizard !== 'undefined') Rules2Wizard.open('${AppState.activeSession.gameKey}', ${AppState.activeSession.episodio}, false, null)" class="btn btn-outline border-emerald-400 text-emerald-300 font-bold">
              Rigioca Ep. ${AppState.activeSession.episodio} 🔄
            </button>
            <button onclick="if(typeof Rules2Wizard !== 'undefined') Rules2Wizard.open('${AppState.activeSession.gameKey}', ${AppState.activeSession.episodio + 1}, true, AppState.activeSession.hero)" class="btn btn-success text-slate-950 font-black">
              Episodio ${AppState.activeSession.episodio + 1} ›
            </button>
          </div>
        `;
      }
      return;
    }

    // Header & Info di Gioco
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const saga = (AppState.games.catalog || []).find(g => g.gameKey === AppState.activeSession.gameKey);
    s("game-header-series", (saga ? saga.serie : "AVVENTURA NOIR").toUpperCase());
    s("game-header-episode", `Episodio ${AppState.activeSession.episodio}`);

    if (currentHero) {
      const avatarImg = document.getElementById("kpi-hero-avatar-img");
      const avatarFallback = document.getElementById("kpi-hero-avatar-fallback");
      const media = currentHero.mediaUrl;

      if (avatarImg && avatarFallback) {
        if (media && media !== "—" && media.startsWith("http")) {
          avatarImg.src = media;
          avatarImg.classList.remove("hidden");
          avatarFallback.classList.add("hidden");
        } else {
          avatarImg.classList.add("hidden");
          avatarFallback.classList.remove("hidden");
        }
      }

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

    const img = document.getElementById("scene-image");
    if (img) {
      img.src = currentNode.mediaUrl || "https://image.pollinations.ai/prompt/noir-docks-night-cinematic?width=800&height=450&nologo=true";
    }

    s("scene-type-badge", currentNode.tipo || "SNODO");
    s("scene-title", currentNode.nome || "Avventura");

    let cleanText = (currentNode.testo || "").replace(/\s*\([A-Z]{3,4}_\d{4}_S\d+_E\d+\)/gi, "");
    s("scene-text", cleanText);

    const wBanner = document.getElementById("scene-watermark-banner");
    if (currentNode.citazione && currentNode.citazione !== "—" && currentNode.citazione !== "-") {
      s("scene-quote", `“${currentNode.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”`);
      s("scene-author", currentNode.autoreCitazione || "");
      if (wBanner) wBanner.classList.remove("hidden");
    } else {
      if (wBanner) wBanner.classList.add("hidden");
    }

    if (!actBox) return;

    const isCombat = (currentNode.tipo === "NEMICO" || (currentNode.id && currentNode.id.includes("NEM_")));
    const isBoss = isCombat && (String(currentNode.id).includes("BOSS") || String(currentNode.sottocategoria || "").toUpperCase().includes("BOSS"));
    const isEvento = (currentNode.tipo === "EVENTO" || (currentNode.id && currentNode.id.includes("EVT_")));

    // CASO 1: COMBATTIMENTO
    if (isCombat) {
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.playEpisodeBgm(AppState.activeSession.gameKey, AppState.activeSession.episodio, isBoss ? "boss" : "combat");
      }

      if (AppState.activeSession.combatEnemyId !== currentNode.id) {
        AppState.activeSession.combatEnemyId = currentNode.id;
        AppState.activeSession.combatRound = 1;
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx(isBoss ? "shock" : "hit");
      }

      let bribeHtml = "";
      if (currentNode.corruption?.canCorrupt && currentNode.corruption.validDrugs?.length > 0) {
        bribeHtml = currentNode.corruption.validDrugs.map(d => `
          <button onclick="Rules2Engine.combatBribe('${Rules2_SafeAttr(d.nome)}')" class="btn btn-sm btn-block btn-warning font-black uppercase">
            Offri ${Rules2_SafeAttr(d.nome.split(" ")[0])} 💊
          </button>
        `).join("");
      }

      actBox.innerHTML = `
        <div class="combat-actions-grid">
          <button onclick="Rules2Engine.combatAction('attack_round')" class="btn btn-sm btn-error font-black btn-combat-attack">
            ⚔️ Attacca
          </button>
          <button onclick="Rules2Engine.combatAction('flee')" class="btn btn-sm btn-outline border-white/20 btn-combat-flee">
            Fuggi 🏃
          </button>
        </div>
        ${bribeHtml}
        <div class="pt-0.5">
          <button onclick="Rules2Engine.inspectCurrentEnemyDetail()" class="btn btn-xs btn-block btn-ghost btn-inspect-enemy font-black">
            Fascicolo 🔍
          </button>
        </div>
      `;
      return;
    }

    if (typeof SoundEngine !== "undefined") {
      SoundEngine.playEpisodeBgm(AppState.activeSession.gameKey, AppState.activeSession.episodio, "explore");
    }

    // CASO 2: EVENTO D20
    if (isEvento) {
      const statReq = currentNode.statRichiesta || "DESTREZZA";
      const shortStat = statReq.substring(0, 3).toUpperCase();
      const cdVal = currentNode.difficolta || 11;
      const bypassTool = currentNode.equipLoot || currentNode.requisitoBypass;
      const hasTool = bypassTool && (currentHero?.inventario || []).some(it => it.toLowerCase().includes(bypassTool.toLowerCase()));

      if (hasTool) {
        actBox.innerHTML = `
          <div class="tactical-advantage-box">
            <div class="text-[10px] font-bold text-emerald-300">🛡️ Vantaggio Tattico: possiedi ${bypassTool}!</div>
          </div>
          <button onclick="Rules2Engine.advanceToNode('${currentNode.destSuccesso}')" class="btn btn-sm btn-block btn-success font-black h-11 uppercase">
            Bypassa ⚡
          </button>
        `;
      } else {
        actBox.innerHTML = `
          <div class="combat-actions-grid">
            <button onclick="Rules2Engine.executeEventRoll('${currentNode.id}', '${statReq}', ${cdVal})" class="btn btn-sm btn-primary font-black h-11 uppercase">
              Tira D20 (${shortStat}) 🎲
            </button>
            <button onclick="Rules2Engine.advanceToNode('${currentNode.destFallback || currentNode.destFallimento}')" class="btn btn-sm btn-outline border-white/20 h-11 font-black uppercase">
              Schiva 🏃
            </button>
          </div>
        `;
      }
      return;
    }

    // CASO 3: ENIGMA
    if (currentNode.quiz) {
      actBox.innerHTML = `
        <div class="quiz-box">
          <div class="quiz-question">
            <span>🔐</span> <span>${currentNode.quiz.domanda}</span>
          </div>
          <div class="quiz-options-grid">
            ${currentNode.quiz.opzioni.map(opz => `
              <button onclick="Rules2Engine.submitQuizAnswer('${Rules2_SafeAttr(opz)}')" class="btn btn-sm btn-outline border-white/20 text-[11px] font-bold truncate">
                ${opz}
              </button>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    // CASO 4: BIVIO NARRATIVO STANDARD
    const choices = (currentNode.choices || currentNode.parsedBivio || []).map(c => ({
      testo: c.testo || c.text || "Avanza",
      target: c.target || c.id || ""
    })).filter(c => c.target);

    if (choices.length > 0) {
      if (choices.length === 2) {
        actBox.innerHTML = `
          <div class="combat-actions-grid">
            <button onclick="Rules2Engine.advanceToNode('${choices[0].target}')" class="btn btn-sm btn-primary font-black truncate h-11 uppercase">
              ${choices[0].testo}
            </button>
            <button onclick="Rules2Engine.advanceToNode('${choices[1].target}')" class="btn btn-sm btn-primary font-black truncate h-11 uppercase">
              ${choices[1].testo}
            </button>
          </div>
        `;
      } else {
        actBox.innerHTML = choices.map(c => `
          <button onclick="Rules2Engine.advanceToNode('${c.target}')" class="btn btn-sm btn-block btn-primary font-black mb-1.5 truncate h-11 uppercase">
            ${c.testo}
          </button>
        `).join("");
      }
    } else {
      actBox.innerHTML = `
        <button onclick="Rules2Engine.leaveGameToHub()" class="btn btn-sm btn-block btn-outline border-white/20 font-black h-11 uppercase">
          Torna all'Hub 🏠
        </button>
      `;
    }
  },

  advanceToNode: async function(targetId) {
    if (!AppState.activeSession.gameKey || this._isBusy) return;
    this._setBusy(true);

    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("card_flip");

    // Lavorazione sintesi chimica ad ogni snodo
    const h = AppState.activeSession.hero;
    if (h && h.sintesiInCorso && h.sintesiInCorso.length > 0) {
      const stillCrafting = [];
      for (let sc of h.sintesiInCorso) {
        sc.turniMancanti -= 1;
        if (sc.turniMancanti <= 0) {
          h.inventario = h.inventario || [];
          h.inventario.push(sc.prodotto);
          tgAlert(`⚗️ Sintesi completata: 1 dose di ${sc.icon || '💊'} ${sc.prodotto} aggiunta allo zaino!`);
        } else {
          stillCrafting.push(sc);
        }
      }
      h.sintesiInCorso = stillCrafting;
    }

    try {
      const res = await apiCall("game_node", {
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio,
        nodeId: targetId,
        partitaId: AppState.activeSession.partitaId
      });
      if (res?.nodo) {
        this.renderNode(res.nodo, res.statoEroe);
      } else {
        this._setBusy(false);
      }
    } catch (e) {
      this._setBusy(false);
      console.error("[Rules2Engine] Errore advanceToNode:", e);
      tgAlert("Errore avanzamento: " + e.message);
    }
  },

  showDiceRollSuspense: function(title, desc, durationMs, onComplete) {
    const diceModal = document.getElementById("modal-dice-suspense");
    const diceCube = document.getElementById("dice-visual-cube");
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    s("dice-roll-title", title || "Lancio D20...");
    s("dice-roll-result", "--");
    s("dice-roll-desc", desc || "Il fato decide...");

    if (diceCube) diceCube.classList.add("dice-rolling");
    if (diceModal) diceModal.showModal();

    if (typeof SoundEngine !== "undefined") {
      SoundEngine.duck(0.08, (durationMs || 700) + 400);
      SoundEngine.playSfx("dice");
    }

    setTimeout(() => {
      if (diceCube) diceCube.classList.remove("dice-rolling");
      if (typeof onComplete === "function") {
        onComplete(diceModal, s);
      } else {
        if (diceModal) diceModal.close();
      }
    }, durationMs || 700);
  },

  // RISOLUZIONE EVENTO D20: DETERMINISMO ANTI-LOOP (MAI RIPETERE SE FALLITO)
  executeEventRoll: async function(nodeId, statName, cdVal) {
    if (this._isBusy) return;
    this._setBusy(true);

    const hero = AppState.activeSession.hero;
    const statMod = hero?.modificatori ? (hero.modificatori[statName] || 0) : 0;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + statMod;
    const isSuccess = (d20 === 20) || (d20 !== 1 && total >= cdVal);

    this.showDiceRollSuspense(`Prova ${statName} vs CD ${cdVal}`, `D20 (${d20}) ${statMod >= 0 ? '+' : ''}${statMod} = ${total}`, 750, (modal, s) => {
      s("dice-roll-result", `${total} • ${isSuccess ? 'SUPERATO!' : 'FALLITO!'}`);
      s("dice-roll-desc", isSuccess ? 'Ostacolo superato!' : 'Danni subiti!');

      if (typeof SoundEngine !== "undefined") {
        if (isSuccess) SoundEngine.playSfx(d20 === 20 ? "lucky" : "success");
        else SoundEngine.playSfx(d20 === 1 ? "unlucky" : "hurt");
      }

      setTimeout(() => {
        modal.close();
        const node = AppState.activeSession.currentNode;
        if (isSuccess) {
          tgHaptic("success");
          this.showFloatingDamage(d20 === 20 ? "🌟 CRITICO!" : "✅ Superato!", d20 === 20, false);
          this.advanceToNode(node.destSuccesso);
        } else {
          tgHaptic("error");
          this.showFloatingDamage(d20 === 1 ? "💀 FUMBLE!" : "❌ Fallito!", false, true);
          // Deterministico: se fallito avanza rigidamente verso fallback
          const targetFail = node.destFallback || node.destFallimento || `SND_0001_S1_E${AppState.activeSession.episodio}`;
          this.advanceToNode(targetFail);
        }
      }, 650);
    });
  },

  combatAction: async function(subAction) {
    if (!AppState.activeSession.gameKey || this._isBusy) return;
    this._setBusy(true);

    const diceModal = document.getElementById("modal-dice-suspense");
    const diceCube = document.getElementById("dice-visual-cube");
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const curRound = AppState.activeSession.combatRound || 1;

    if (subAction === "attack_round") {
      s("dice-roll-title", `Attacco • Round ${curRound}`);
      s("dice-roll-result", "--");
      s("dice-roll-desc", "Tiro di attacco...");
      if (diceCube) diceCube.classList.add("dice-rolling");
      if (diceModal) diceModal.showModal();

      if (typeof SoundEngine !== "undefined") {
        SoundEngine.duck(0.08, 900);
        SoundEngine.playSfx("dice");
      }
    } else if (subAction === "flee") {
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("flee");
    }

    try {
      const res = await apiCall("game_action", {
        subAction: subAction,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });

      if (subAction === "attack_round") {
        const log = res.combatLog;
        if (diceCube) diceCube.classList.remove("dice-rolling");

        if (log) {
          s("dice-roll-result", `D20 (${log.d20Hero}) = ${log.totHero} vs CD ${log.cdTarget}`);
          s("dice-roll-desc", log.isHit ? (log.isCrit ? "CRITICO!" : `COLPITO! -${log.dmgDealt} PV`) : "A VUOTO!");
        } else {
          s("dice-roll-result", res.status === "VICTORY" ? "VITTORIA!" : "FINE SCONTRO");
        }

        setTimeout(() => {
          if (diceModal) diceModal.close();

          if (log) {
            if (log.isHit) {
              tgHaptic(log.isCrit ? "success" : "light");
              this.showFloatingDamage(`💥 -${log.dmgDealt} PV`, log.isCrit, false);
              if (typeof SoundEngine !== "undefined") SoundEngine.playSfx(log.isCrit ? "crit_hit" : "hit");
            } else {
              this.showFloatingDamage("💨 A vuoto", false, false);
              if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("flee");
            }

            if (log.dmgTaken > 0) {
              setTimeout(() => {
                tgHaptic("error");
                this.showFloatingDamage(`💔 -${log.dmgTaken} PV Squadra`, false, true);
                if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("hurt");
              }, 250);
            }
          }

          if (res.status === "VICTORY") {
            AppState.activeSession.combatRound = 1;
            AppState.activeSession.combatEnemyId = null;

            if (typeof SoundEngine !== "undefined") {
              SoundEngine.stopHeartbeat();
              SoundEngine.playSfx("lucky");
              SoundEngine.playBgm("victory");
            }
            if (window.confetti) confetti({ particleCount: 75, spread: 60 });

            const hero = AppState.activeSession.hero;
            const hasNecroAbl = (hero?.abilita?.includes("Necromanzia") && hero.pv > 1);
            AppState.activeSession.engineState.pendingVictory = res.nextView;

            if (hasNecroAbl && !res.victoryData?.chainInfected) {
              this.renderNecromancyPrompt(res.victoryData.enemy);
            } else {
              this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
            }
          } else if (res.status === "DEFEAT") {
            AppState.activeSession.combatRound = 1;
            AppState.activeSession.combatEnemyId = null;

            if (typeof SoundEngine !== "undefined") {
              SoundEngine.stopHeartbeat();
              SoundEngine.playSfx("zelda_death");
              SoundEngine.playBgm("defeat");
            }
            this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
          } else {
            AppState.activeSession.combatRound = (log ? log.round + 1 : curRound + 1);
            this.renderNode(res.nodo, res.statoEroe);
          }
        }, 700);
      } else {
        if (diceModal) diceModal.close();
        if (res.nextView) this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
        else if (res.nodo) this.renderNode(res.nodo, res.statoEroe);
      }
    } catch (e) {
      if (diceModal) diceModal.close();
      this._setBusy(false);
      console.error("[Rules2Engine] Errore combatAction:", e);
      tgAlert("Errore azione: " + e.message);
    }
  },

  renderNecromancyPrompt: function(deadEnemy) {
    this._setBusy(false);
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("evil_laugh");

    actBox.innerHTML = `
      <div class="necromancy-prompt-box">
        <div class="font-black text-purple-300">🧟 RIANIMAZIONE DISPONIBILE</div>
        <div class="text-[10px] text-slate-300">Rianima <b>${deadEnemy ? deadEnemy.nome : 'nemico'}</b> come Zombi (Danno x2).</div>
        <div class="combat-actions-grid pt-1">
          <button onclick="Rules2Engine.executeResurrectZombie('${deadEnemy ? deadEnemy.id : ''}')" class="btn btn-sm btn-secondary font-black uppercase">
            Rianima (-1 PV) 🧟
          </button>
          <button onclick="Rules2Engine.skipNecromancy()" class="btn btn-sm btn-outline border-white/20 text-slate-300 font-bold uppercase">
            Lascia Cadavere ›
          </button>
        </div>
      </div>
    `;
  },

  executeResurrectZombie: async function(enemyId) {
    if (this._isBusy) return;
    this._setBusy(true);

    try {
      const res = await apiCall("game_action", {
        subAction: "resurrect_zombie",
        targetId: enemyId,
        method: "ABILITA",
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res?.success) {
        tgHaptic("success");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("zombie");
        this.showFloatingDamage("🧟 Risorto!", false, false);
        if (AppState.activeSession.engineState?.pendingVictory) {
          this.renderNode(AppState.activeSession.engineState.pendingVictory.nodo, res.statoEroe);
          AppState.activeSession.engineState.pendingVictory = null;
        }
      }
    } catch (e) {
      tgAlert("Rianimazione fallita: " + e.message);
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
    if (!AppState.activeSession.gameKey || this._isBusy) return;
    this._setBusy(true);

    try {
      const res = await apiCall("game_action", {
        subAction: "bribe",
        drug: drugName,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });
      if (res?.success) {
        tgHaptic("success");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("bribe");
        this.showFloatingDamage("🟡 Corrotto!", false, false);
        this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
      }
    } catch (e) {
      this._setBusy(false);
      tgAlert("Corruzione fallita: " + e.message);
    }
  },

  showFloatingDamage: function(text, isCrit, isHeroDmg) {
    const box = document.getElementById("floating-damage-box");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `floating-damage ${isHeroDmg ? 'text-glow-rose' : (isCrit ? 'text-glow-amber' : '')}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  submitQuizAnswer: function(selectedOpz) {
    if (this._isBusy) return;
    const node = AppState.activeSession.currentNode;
    if (!node?.quiz) return;

    this._setBusy(true);
    const isCorrect = (selectedOpz.trim().toLowerCase() === node.quiz.rispostaCorretta?.trim().toLowerCase());
    if (isCorrect) {
      tgHaptic("success");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("lucky");
      this.showFloatingDamage("✅ Esatto!", false, false);
      this.advanceToNode(node.destSuccesso);
    } else {
      tgHaptic("error");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
      this.showFloatingDamage("❌ Errato!", false, true);
      this.advanceToNode(node.destFallimento);
    }
  },

  // --------------------------------------------------------------------------
  // 3. FASCICOLO APPROFONDITO UNIVERSALE (SCHEDA MONUMENTALE CENTRATA GLASSMORPHISM)
  // --------------------------------------------------------------------------
  inspectCurrentEnemyDetail: function() {
    const enemy = AppState.activeSession.currentNode;
    if (!enemy) return;

    this.inspectEntityDetail({
      id: enemy.id,
      nome: enemy.nome,
      tipo: "NEMICO",
      categoria: enemy.categoria || "Mazzu",
      sottocategoria: enemy.sottocategoria || "Soldato",
      pv: enemy.pv,
      danno: enemy.danno,
      forza: enemy.forza,
      destrezza: enemy.destrezza,
      intelligenza: enemy.intelligenza,
      difficolta: enemy.difficolta,
      statRichiesta: enemy.statRichiesta,
      debolezze: enemy.debolezze,
      descrizione: enemy.testo,
      citazione: enemy.citazione,
      autoreCitazione: enemy.autoreCitazione,
      mediaUrl: enemy.mediaUrl,
      isEnemyInspection: true
    });
  },

  inspectEntityDetail: function(it) {
    if (!it) return;

    const modal = document.getElementById("modal-universal-detail");
    if (!modal) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const h = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    s("uni-detail-icon", it.emoji || (it.tipo === "NEMICO" ? "👾" : "📦"));
    s("uni-detail-title", it.nome);
    s("uni-detail-badge", `${(it.tipo || 'EQUIPAGGIAMENTO').toUpperCase()} • ${(it.categoria || 'GENERALE').toUpperCase()}`);
    s("uni-detail-metrics-label", it.tipo === "NEMICO" ? "PARAMETRI BELLICI" : "PARAMETRI");

    const bonuses = [];
    if (it.pv) bonuses.push(`❤️ PV: <b>${it.pv}</b>`);
    if (it.danno) bonuses.push(`💥 Danno: <b>${it.danno}</b>`);
    if (it.forza) bonuses.push(`🥊 FOR: <b>${it.forza}</b>`);
    if (it.destrezza) bonuses.push(`🤸 DES: <b>${it.destrezza}</b>`);
    if (it.intelligenza) bonuses.push(`🧠 INT: <b>${it.intelligenza}</b>`);
    if (it.difficolta) bonuses.push(`🎯 Sfida: <b>${it.statRichiesta || 'FORZA'} (CD ${it.difficolta})</b>`);
    if (it.costoOro) bonuses.push(`💰 Prezzo: <b class="text-amber-300">${it.costoOro} 🟡</b>`);

    let humanProps = typeof Rules2_FormatHumanEffect === "function" ? Rules2_FormatHumanEffect(it.requisitiCodificati || it.effettoCodificato || it.debolezze || "") : "";
    h("uni-detail-metrics-value", bonuses.join(" • ") + (humanProps ? "<br>" + humanProps : ""));

    let cleanLore = (it.descrizione || it.testo || "Nessun fascicolo allegato.").replace(/\s*\([A-Z]{3,4}_\d{4}_S\d+_E\d+\)/gi, "");
    s("uni-detail-lore", cleanLore);

    const mediaContainer = document.getElementById("uni-detail-media-container");
    if (mediaContainer) {
      if (it.mediaUrl && it.mediaUrl !== "—" && it.mediaUrl.startsWith("http")) {
        document.getElementById("uni-detail-img").src = it.mediaUrl;
        mediaContainer.classList.remove("hidden");
      } else {
        mediaContainer.classList.add("hidden");
      }
    }

    // TASTO AZIONE CONTESTUALE COLLEGATO ALL'ASSETTO
    const btn = document.getElementById("uni-detail-action-btn");
    if (btn) {
      const cat = Rules2_ClassifyEntity(it);
      if (it.isEnemyInspection) {
        btn.textContent = "Attacca ⚔️";
        btn.className = "btn btn-error btn-sm flex-1 font-black uppercase";
        btn.onclick = () => {
          modal.close();
          this.combatAction("attack_round");
        };
      } else if (cat === "ARMI") {
        btn.textContent = "Impugna 🗡️";
        btn.className = "btn btn-primary btn-sm flex-1 font-black uppercase";
        btn.onclick = () => {
          this.equipItem(it.nome, "weapon");
          modal.close();
        };
      } else if (cat === "VEICOLI") {
        btn.textContent = "Guida 🛴";
        btn.className = "btn btn-primary btn-sm flex-1 font-black uppercase";
        btn.onclick = () => {
          this.equipItem(it.nome, "vehicle");
          modal.close();
        };
      } else if (cat === "DROGHE" || cat === "CURE") {
        btn.textContent = (cat === "DROGHE") ? "Assumi 💊" : "Usa ❤️";
        btn.className = "btn btn-success btn-sm flex-1 font-black uppercase";
        btn.onclick = () => {
          this.useBackpackItem(it.nome);
          modal.close();
        };
      } else {
        btn.textContent = "Chiudi ✕";
        btn.className = "btn btn-ghost btn-sm flex-1 text-slate-400 font-bold uppercase";
        btn.onclick = () => modal.close();
      }
    }

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    modal.showModal();
  },

  // --------------------------------------------------------------------------
  // 4. I 4 PILASTRI TATTICI DEL COCKPIT FOOTER
  // --------------------------------------------------------------------------

  // 1. PILASTRO EROE: MODALE A 4 TAB (Scheda, Zaino, Squadra, Dossier)
  openHeroModal: function(tabName = "scheda") {
    this._activeHeroTab = tabName;
    const h = AppState.activeSession.hero;
    if (!h) return;

    const modal = document.getElementById("drawer-hero-sheet");
    if (!modal) return;

    this.renderHeroModalContent();
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    modal.showModal();
  },

  setHeroModalTab: function(tab) {
    this._activeHeroTab = tab;
    this.renderHeroModalContent();
    tgHaptic("selection");
  },

  renderHeroModalContent: function() {
    const h = AppState.activeSession.hero;
    const tab = this._activeHeroTab || "scheda";
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // Attivazione visiva delle tab e pannelli
    const tabKeys = ["scheda", "zaino", "squadra", "dossier"];
    tabKeys.forEach(t => {
      const btn = document.getElementById(`hero-tab-btn-${t}`);
      const panel = document.getElementById(`hero-tab-content-${t}`);
      const isActive = (t === tab);
      if (btn) {
        btn.className = `btn btn-xs flex-1 font-bold ${isActive ? 'btn-primary' : 'btn-ghost text-slate-400'}`;
      }
      if (panel) {
        panel.classList.toggle("hidden", !isActive);
      }
    });

    // Dati Scheda Eroe
    s("sheet-hero-name", h.nomeEroe || "Avventuriero");
    s("sheet-hero-class", `${h.classe || "Avventuriero"} (${h.schieramentoPolitico || "Destra"})`);
    s("sheet-hero-gold", `${h.oro || 0} 🟡`);

    const avatarImg = document.getElementById("sheet-hero-avatar-img");
    const avatarFallback = document.getElementById("sheet-hero-avatar-fallback");
    if (avatarImg && avatarFallback) {
      if (h.mediaUrl && h.mediaUrl !== "—" && h.mediaUrl.startsWith("http")) {
        avatarImg.src = h.mediaUrl;
        avatarImg.classList.remove("hidden");
        avatarFallback.classList.add("hidden");
      } else {
        avatarImg.classList.add("hidden");
        avatarFallback.classList.remove("hidden");
      }
    }

    const stats = h.stats || { FORZA: 10, DESTREZZA: 10, INTELLIGENZA: 10 };
    const mods = h.modificatori || { FORZA: 0, DESTREZZA: 0, INTELLIGENZA: 0 };

    s("sheet-pure-for", stats.FORZA || 10);
    s("sheet-pure-des", stats.DESTREZZA || 10);
    s("sheet-pure-int", stats.INTELLIGENZA || 10);

    s("sheet-mod-for", (mods.FORZA >= 0 ? "+" : "") + mods.FORZA);
    s("sheet-mod-des", (mods.DESTREZZA >= 0 ? "+" : "") + mods.DESTREZZA);
    s("sheet-mod-int", (mods.INTELLIGENZA >= 0 ? "+" : "") + mods.INTELLIGENZA);

    s("sheet-active-weapon", h.armaAttiva || "Pugni nudi");
    s("sheet-active-vehicle", h.veicoloAttivo || "A piedi");

    const ablsBox = document.getElementById("sheet-abilities-list");
    if (ablsBox) {
      const list = h.abilita || [];
      ablsBox.innerHTML = list.length > 0
        ? list.map(a => `<span class="badge badge-sm badge-info font-bold mr-1 mb-1">⚡ ${a}</span>`).join("")
        : "Nessuna abilità attiva.";
    }

    // Seleziona sotto-sezioni al cambio tab
    if (tab === "zaino") {
      this.filterBackpack(AppState.activeSession.engineState?.backpackFilter || "ALL");
    } else if (tab === "squadra") {
      this.renderSquadSubView();
    } else if (tab === "dossier") {
      this.renderDossierSubView();
    }
  },

  renderSquadSubView: function() {
    const c = document.getElementById("squad-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    let html = "";
    const comp = h.compagni || [];
    const compData = h.compagniData || {};
    const zombies = h.zombieSquad || [];

    if (comp.length === 0 && zombies.length === 0) {
      html = `<div class="empty-state-card">In solitaria. Nessun alleato al seguito.</div>`;
    } else {
      html += comp.map(a => {
        const d = compData[a] || {};
        const hpText = d.pv ? ` (❤️ ${d.pv}/${d.pvMax || 15} PV)` : "";
        return `<div class="squad-member-card"><span>🤝 ${a}${hpText}</span> <span class="badge-human">Alleato</span></div>`;
      }).join("");
      html += zombies.map(z => `
        <div class="squad-member-card zombie">
          <span>🧟 ${z.nome}</span> <span class="badge-zombie">Danno x2 (❤️ ${z.pv}/${z.pvMax || 15})</span>
        </div>
      `).join("");
    }
    c.innerHTML = html;
  },

  renderDossierSubView: function() {
    const c = document.getElementById("dossier-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    const inv = h.inventario || [];
    const infoItems = inv.filter(it => {
      const ent = this._findEntityData(it);
      return Rules2_ClassifyEntity(ent) === "INFORMAZIONI";
    });

    if (infoItems.length === 0) {
      c.innerHTML = `<div class="empty-state-card">Nessun reperto d'inchiesta raccolto finora.</div>`;
    } else {
      c.innerHTML = infoItems.map(p => {
        const ent = this._findEntityData(p);
        const sub = String(ent?.sottocategoria || "").toLowerCase();
        const isPermanent = (sub === "prove" || sub === "prova");

        return `
          <div onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${Rules2_SafeAttr(p)}'))" class="dossier-evidence-card">
            <div class="evidence-header">
              <span class="evidence-name">📁 ${p}</span>
              <span class="badge badge-xs badge-info">${ent?.categoria || 'Reperto'}</span>
            </div>
            <div class="evidence-desc">
              ${isPermanent ? 'Organigramma: <b class="text-emerald-400">+1 INT permanente</b>' : `Inchiesta: <b class="text-amber-300">+1 INT situazionale</b>`}
            </div>
          </div>
        `;
      }).join("");
    }
  },

  // 2. PILASTRO ASSETTO: PLANCIA OPERATIVA & BANCO DI SINTESI CLANDESTINA
  openAssettoModal: function() {
    const h = AppState.activeSession.hero;
    if (!h) return;

    let modal = document.getElementById("modal-cockpit-assetto");
    if (!modal) {
      modal = document.createElement("dialog");
      modal.id = "modal-cockpit-assetto";
      modal.className = "modal modal-middle";
      document.body.appendChild(modal);
    }

    const inv = h.inventario || [];

    const availableRecipes = [];
    for (let ingrKey in RULES2_SYNTHESIS_RECIPES) {
      const rec = RULES2_SYNTHESIS_RECIPES[ingrKey];
      const hasTool = inv.some(i => i.toLowerCase().includes(rec.toolName.toLowerCase()));
      const hasIngr = inv.some(i => i.toLowerCase().includes(ingrKey.toLowerCase()));
      if (hasTool && hasIngr) {
        availableRecipes.push(rec);
      }
    }

    const activeSyntheses = h.sintesiInCorso || [];

    modal.innerHTML = `
      <div class="modal-box drawer-standard-box">
        <div class="drawer-header-row">
          <div class="flex items-center space-x-2">
            <span class="text-lg">🔱</span>
            <h3 class="drawer-title">Assetto Tattico & Sintesi</h3>
          </div>
          <button onclick="document.getElementById('modal-cockpit-assetto').close()" class="btn btn-xs btn-circle btn-ghost">✕</button>
        </div>

        <div class="space-y-2">
          <div class="text-[9.5px] font-bold text-sky-400 uppercase tracking-wider">Dotazione Operativa del Turno</div>
          
          <div class="assetto-slot-card">
            <div>
              <span class="text-xs font-bold text-white">🗡️ Arma in pugno:</span>
              <span class="text-xs text-sky-300 ml-1 font-mono">${h.armaAttiva || 'Pugni nudi'}</span>
            </div>
            <button onclick="Rules2Engine.openHeroModal('zaino')" class="btn btn-xs btn-outline border-white/20">Cambia</button>
          </div>

          <div class="assetto-slot-card">
            <div>
              <span class="text-xs font-bold text-white">🛴 Veicolo attivo:</span>
              <span class="text-xs text-sky-300 ml-1 font-mono">${h.veicoloAttivo || 'A piedi'}</span>
            </div>
            <button onclick="Rules2Engine.openHeroModal('zaino')" class="btn btn-xs btn-outline border-white/20">Cambia</button>
          </div>
        </div>

        <div class="assetto-crafting-box mt-2">
          <div class="text-[9.5px] font-bold text-purple-300 uppercase tracking-wider">⚗️ Banco di Sintesi Clandestina</div>
          
          ${activeSyntheses.length > 0 ? `
            <div class="space-y-1 py-1">
              ${activeSyntheses.map(s => `
                <div class="text-[11px] text-slate-300 flex justify-between">
                  <span>⏳ Distillazione <b>${s.prodotto}</b></span>
                  <span class="font-mono text-amber-300">${s.turniMancanti} snodi</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${availableRecipes.length > 0 ? `
            <div class="space-y-1.5 pt-1">
              ${availableRecipes.map(r => `
                <div class="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <div class="text-[11px] text-white">
                    <span>${r.icon}</span> <b>${r.prodName}</b> (${r.turns} snodi)
                  </div>
                  <button onclick="Rules2Engine.startSynthesis('${r.prodName}', '${r.toolName}')" class="btn btn-xs btn-secondary font-black uppercase">
                    Distilla
                  </button>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="text-[10.5px] text-slate-400 italic">Nessuna combinazione reagente/strumento pronta nello zaino.</p>
          `}
        </div>

        <button onclick="document.getElementById('modal-cockpit-assetto').close()" class="btn btn-sm btn-ghost text-slate-400 font-bold uppercase mt-2">
          Chiudi ✕
        </button>
      </div>
    `;

    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    modal.showModal();
  },

  startSynthesis: function(prodName, toolName) {
    const h = AppState.activeSession.hero;
    if (!h) return;

    for (let ingrKey in RULES2_SYNTHESIS_RECIPES) {
      const rec = RULES2_SYNTHESIS_RECIPES[ingrKey];
      if (rec.prodName === prodName) {
        const idx = (h.inventario || []).findIndex(i => i.toLowerCase().includes(ingrKey.toLowerCase()));
        if (idx !== -1) {
          h.inventario.splice(idx, 1);
          h.sintesiInCorso = h.sintesiInCorso || [];
          h.sintesiInCorso.push({
            prodotto: rec.prodName,
            turniMancanti: rec.turns,
            icon: rec.icon
          });
          tgHaptic("success");
          if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("drug");
          tgAlert(`⚗️ Avviata lavorazione di ${rec.prodName} (pronta tra ${rec.turns} snodi).`);
          this.openAssettoModal();
          return;
        }
      }
    }
  },

  // 3. PILASTRO EMPORIO DI CICCIO (Acquisto, Vendita, Cambio)
  openEmporioDrawer: function() {
    const goldDisp = document.getElementById("emporio-gold-display");
    if (goldDisp) goldDisp.textContent = `${this.getGold()} 🟡`;
    this.setEmporioMode(AppState.activeSession.engineState?.emporioMode || "buy");
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("drawer-emporio")?.showModal();
  },

  setEmporioMode: function(mode) {
    if (!AppState.activeSession.engineState) AppState.activeSession.engineState = {};
    AppState.activeSession.engineState.emporioMode = mode;

    const btnBuy = document.getElementById("emporio-tab-buy");
    const btnSell = document.getElementById("emporio-tab-sell");
    const container = document.getElementById("emporio-items-container");
    const h = AppState.activeSession.hero;

    if (btnBuy) btnBuy.className = `flex-1 btn btn-xs ${mode === 'buy' ? 'btn-primary font-black uppercase' : 'btn-ghost text-slate-400 font-bold uppercase'}`;
    if (btnSell) btnSell.className = `flex-1 btn btn-xs ${mode === 'sell' ? 'btn-primary font-black uppercase' : 'btn-ghost text-slate-400 font-bold uppercase'}`;

    if (mode === "sell") {
      const inv = h?.inventario || [];
      if (inv.length === 0) {
        container.innerHTML = `<div class="empty-state-card col-span-full">Zaino vuoto.</div>`;
        return;
      }
      container.innerHTML = inv.map(it => {
        const ent = this._findEntityData(it);
        const buyPrice = Math.abs(Number(ent?.costoOro || ent?.costo || 10));
        const sellPrice = Math.max(1, Math.ceil(buyPrice * 0.25));

        return `
          <div class="emporio-sell-row">
            <span class="font-bold text-white truncate pr-2">${it}</span>
            <button onclick="Rules2Engine.sellToEmporio('${Rules2_SafeAttr(it)}', ${sellPrice})" class="btn btn-xs btn-warning font-black uppercase">
              Vendi (+${sellPrice} 🟡)
            </button>
          </div>
        `;
      }).join("");
    } else {
      const emporioItems = AppState.activeSession.shopCatalog || [];
      if (emporioItems.length === 0) {
        container.innerHTML = `<div class="empty-state-card col-span-full">Banchi vuoti.</div>`;
        return;
      }

      container.innerHTML = emporioItems.map(item => {
        const price = Math.abs(Number(item.costoOro || item.costo || 10));
        const canAfford = (this.getGold() >= price);

        return `
          <div class="emporio-item-card group">
            <div onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${Rules2_SafeAttr(item.nome)}'))" class="item-card-clickable">
              <div class="item-card-header">
                <span class="text-lg">${item.emoji || '📦'}</span>
                <span class="item-card-price">${price} 🟡</span>
              </div>
              <div class="item-card-name">${item.nome}</div>
              <div class="item-card-desc">${item.testo || item.descrizione || ''}</div>
            </div>
            <div class="item-card-actions">
              <button onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${Rules2_SafeAttr(item.nome)}'))" class="btn btn-xs btn-outline border-white/10 text-slate-300">
                Fascicolo
              </button>
              <button onclick="Rules2Engine.buyFromEmporio('${item.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary font-bold' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'}" ${!canAfford ? 'disabled' : ''}>
                ${canAfford ? 'Compra' : 'Oro Insuff.'}
              </button>
            </div>
          </div>
        `;
      }).join("");
    }
  },

  buyFromEmporio: async function(itemId, goldCost) {
    if (this.getGold() < goldCost) {
      tgHaptic("error");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
      return tgAlert("Oro insufficiente!");
    }
    const item = (AppState.activeSession.shopCatalog || []).find(i => i.id === itemId);
    if (!item) return;

    const hero = AppState.activeSession.hero;
    if (Rules2_ClassifyEntity(item) === "VEICOLI") {
      const hasVehicle = (hero?.inventario || []).some(x => Rules2_ClassifyEntity(this._findEntityData(x)) === "VEICOLI");
      if (hasVehicle) {
        tgHaptic("warning");
        if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
        return tgAlert("Massimo 1 Veicolo consentito!");
      }
    }

    try {
      const res = await apiCall("game_action", {
        subAction: "buy_emporio",
        itemId: itemId,
        cost: goldCost,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });

      if (res?.statoEroe) {
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
        this.setGold(res.statoEroe.oro);
      } else {
        this.setGold(this.getGold() - goldCost);
        if (hero) hero.inventario.push(item.nome);
      }

      tgHaptic("success");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
      this.openEmporioDrawer();
      this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
    } catch (e) {
      tgAlert("Errore: " + e.message);
    }
  },

  sellToEmporio: async function(itemName, fallbackGain) {
    try {
      const res = await apiCall("game_action", {
        subAction: "sell_emporio",
        itemName: itemName,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });

      if (res?.statoEroe) {
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
        this.setGold(res.statoEroe.oro);
      } else {
        const hero = AppState.activeSession.hero;
        if (hero) {
          const idx = (hero.inventario || []).indexOf(itemName);
          if (idx !== -1) hero.inventario.splice(idx, 1);
          this.setGold(this.getGold() + (fallbackGain || 10));
          if (hero.armaAttiva === itemName) hero.armaAttiva = "";
          if (hero.veicoloAttivo === itemName) hero.veicoloAttivo = "";
        }
      }

      tgHaptic("success");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
      this.openEmporioDrawer();
      this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
    } catch (e) {
      tgAlert("Errore: " + e.message);
    }
  },

  openCambioModal: function() {
    const balEl = document.getElementById("cambio-megoin-balance");
    if (balEl) balEl.textContent = Wallet.getMegoin();
    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");
    document.getElementById("modal-banco-cambio")?.showModal();
  },

  convertMegoinToGold: async function(megoinCost, goldEarned) {
    const currentMegoin = Wallet.getMegoin();
    if (currentMegoin < megoinCost) {
      tgHaptic("error");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("unlucky");
      return tgAlert("Megoin insufficienti!");
    }

    try {
      const res = await apiCall("currency_exchange", {
        megoin: megoinCost,
        gold: goldEarned,
        gameKey: AppState.activeSession.gameKey || "game1"
      });

      if (res?.success) {
        tgHaptic("success");
        if (typeof SoundEngine !== "undefined") {
          SoundEngine.playSfx("cash_register");
          SoundEngine.playSfx("lucky");
        }
        if (window.confetti) confetti({ particleCount: 60, spread: 50 });

        const nuovoSaldo = res.nuovoSaldoMegoin !== undefined ? res.nuovoSaldoMegoin : (currentMegoin - megoinCost);
        Wallet.setMegoin(nuovoSaldo);

        const nuovoOro = res.nuovoOro !== undefined ? res.nuovoOro : (this.getGold() + goldEarned);
        this.setGold(nuovoOro);

        if (AppState.activeSession.hero) {
          this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
        }

        if (typeof AppModules !== "undefined" && typeof AppModules.renderProfile === "function") {
          AppModules.renderProfile(AppState.user);
        }

        tgAlert(`Convertiti ${megoinCost} 🪙 in +${goldEarned} 🟡 Oro!`);
        document.getElementById("modal-banco-cambio")?.close();
      }
    } catch (e) {
      tgAlert("Errore: " + e.message);
    }
  },

  // --------------------------------------------------------------------------
  // 4. PILASTRO ESCI: MODALE TRIPARTITA (SOSPENDI vs ABBANDONA vs ANNULLA)
  // --------------------------------------------------------------------------
  openAbandonModal: function() {
    tgHaptic("warning");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("modal_open");

    const modal = document.getElementById("modal-abandon");
    if (!modal) return;

    const heroName = AppState.activeSession.hero?.nomeEroe || AppState.user?.nome || "Avventuriero";

    modal.innerHTML = `
      <div class="modal-box abandon-modal-box">
        <button onclick="document.getElementById('modal-abandon').close()" class="modal-close-btn">✕</button>
        <span class="text-3xl">🚪</span>
        <h3 class="text-sm font-black text-white uppercase">Gestione Sessione</h3>
        <p class="text-[11px] text-slate-300 leading-relaxed">
          Hey <b>${heroName}</b>, come desideri procedere con la tua partita?
        </p>
        
        <div class="space-y-2 pt-2 text-left">
          <!-- 1. SOSPENDI ED ESCI ALL'APP (PARTITA SALVATA) -->
          <button onclick="Rules2Engine.suspendAndExitToApp()" class="btn btn-sm btn-primary w-full font-black text-xs uppercase shadow-md flex items-center justify-between">
            <span>⏸️ Sospendi e Vai all'App</span>
            <span class="badge badge-xs badge-ghost text-[8px]">SALVA</span>
          </button>
          <div class="text-[9.5px] text-slate-400 px-1 -mt-1 mb-2">
            La partita viene salvata e potrai riprenderla dal catalogo in qualsiasi momento.
          </div>

          <!-- 2. ABBANDONA DEFINITIVAMENTE (PARTITA CHIUSA) -->
          <button onclick="Rules2Engine.confirmAbandon()" class="btn btn-sm btn-error w-full font-black text-xs uppercase shadow-lg flex items-center justify-between">
            <span>🛑 Abbandona Definitivamente</span>
            <span class="badge badge-xs bg-black/40 text-[8px]">CHIUDI</span>
          </button>
          <div class="text-[9.5px] text-rose-300/80 px-1 -mt-1">
            La partita viene chiusa e archiviata. Non potrai più riprenderla.
          </div>
        </div>

        <!-- 3. ANNULLA / TORNA AL GIOCO -->
        <button onclick="document.getElementById('modal-abandon').close()" class="btn btn-sm btn-ghost w-full text-xs text-slate-400 font-bold uppercase mt-3">
          Continua l'Avventura ›
        </button>
      </div>
    `;

    modal.showModal();
  },

  suspendAndExitToApp: function() {
    document.getElementById("modal-abandon")?.close();
    this.leaveGameToHub();
  },

  confirmAbandon: async function() {
    document.getElementById("modal-abandon")?.close();

    const gKey = AppState.activeSession.gameKey;
    const ep = AppState.activeSession.episodio;
    const pId = AppState.activeSession.partitaId;

    try {
      if (gKey && pId) {
        await apiCall("game_action", {
          subAction: "abandon",
          gameKey: gKey,
          episodio: ep,
          partitaId: pId
        });
      }
    } catch (e) {
      console.warn("[confirmAbandon] Errore notifica server:", e);
    }

    // CANCELLAZIONE STATO PARTITA ATTIVA: MAI PIÙ TASTO RIPRENDI
    const saga = (AppState.games.catalog || []).find(g => g.gameKey === gKey);
    if (saga) {
      saga.hasActiveGame = false;
      saga.activePartitaId = null;
    }

    AppState.activeSession.partitaId = null;
    AppState.activeSession.hero = null;
    AppState.activeSession.currentNode = null;
    AppState.activeSession.engineState = null;

    if (typeof SoundEngine !== "undefined") SoundEngine.stopHeartbeat();
    this.leaveGameToHub();
  },

  // Sospensione Sessione
  leaveGameToHub: function() {
    if (typeof SoundEngine !== "undefined") {
      SoundEngine.stopHeartbeat();
      SoundEngine.playBgm("hub");
    }
    AppRouter.navigate("games");
  },

  // --------------------------------------------------------------------------
  // UTILITY INVENTARIO ED EQUIPAGGIAMENTO
  // --------------------------------------------------------------------------
  _findEntityData: function(itemName) {
    if (!itemName) return null;
    const catalog = AppState.activeSession.shopCatalog || [];
    const clean = String(itemName).trim().toLowerCase();
    const found = catalog.find(x => String(x.nome || "").trim().toLowerCase() === clean || String(x.id || "").trim().toLowerCase() === clean);
    if (found) return found;
    return { nome: itemName, categoria: Rules2_ClassifyEntity({ nome: itemName }) };
  },

  filterBackpack: function(cat) {
    if (!AppState.activeSession.engineState) AppState.activeSession.engineState = {};
    AppState.activeSession.engineState.backpackFilter = cat || "ALL";

    const c = document.getElementById("backpack-slots-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    let inv = h.inventario || [];
    if (inv.length === 0) {
      c.innerHTML = `<div class="empty-state-card">Zaino vuoto.</div>`;
      return;
    }

    if (cat && cat !== "ALL") {
      inv = inv.filter(itemName => {
        const ent = this._findEntityData(itemName);
        return Rules2_ClassifyEntity(ent) === cat;
      });
      if (inv.length === 0) {
        c.innerHTML = `<div class="empty-state-card">Nessun articolo per <b>${cat}</b>.</div>`;
        return;
      }
    }

    c.innerHTML = inv.map(it => {
      const isArma = (h.armaAttiva && it.toLowerCase() === h.armaAttiva.toLowerCase());
      const isVeicolo = (h.veicoloAttivo && it.toLowerCase() === h.veicoloAttivo.toLowerCase());
      const ent = this._findEntityData(it);
      const category = Rules2_ClassifyEntity(ent);

      return `
        <div class="backpack-slot-card">
          <div onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${Rules2_SafeAttr(it)}'), isFromBackpack: true })" class="slot-info-clickable">
            <div class="slot-name">${it}</div>
            <div class="slot-tag ${isArma || isVeicolo ? 'active-gear' : ''}">
              ${isArma ? '🗡️ [IN PUGNO]' : (isVeicolo ? '🛴 [IN USO]' : category)}
            </div>
          </div>
          <button onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${Rules2_SafeAttr(it)}'), isFromBackpack: true })" class="btn btn-xs btn-outline border-white/20 text-slate-300 font-bold">
            Fascicolo
          </button>
        </div>
      `;
    }).join("");
  },

  equipItem: function(itemName, type) {
    const h = AppState.activeSession.hero;
    if (!h) return;

    if (type === "weapon") h.armaAttiva = itemName;
    if (type === "vehicle") h.veicoloAttivo = itemName;

    tgHaptic("selection");
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.renderNode(AppState.activeSession.currentNode, h);
    tgAlert(`Equipaggiato: ${itemName}`);
  },

  useBackpackItem: function(itemName) {
    const h = AppState.activeSession.hero;
    if (!h) return;

    const ent = this._findEntityData(itemName);
    const idx = (h.inventario || []).indexOf(itemName);
    if (idx !== -1) {
      h.inventario.splice(idx, 1);
      if (ent.pv) {
        h.pv = Math.min(h.pvMax || 25, (h.pv || 0) + ent.pv);
        tgAlert(`Hai usato ${itemName} (+${ent.pv} PV)!`);
      } else {
        tgAlert(`Hai assunto ${itemName}!`);
      }
      tgHaptic("success");
      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("drug");
      this.renderNode(AppState.activeSession.currentNode, h);
    }
  }
};

// ----------------------------------------------------------------------------
// 5. REGISTRAZIONE MOTORE & PROXY GLOBALI
// ----------------------------------------------------------------------------
window.Rules2Engine = Rules2Engine;

if (typeof window.EngineRegistry !== "undefined" && typeof window.EngineRegistry.register === "function") {
  window.EngineRegistry.register("Rules2", Rules2Engine);
  window.EngineRegistry.register("rules2", Rules2Engine);
  window.EngineRegistry.register("Rules 2", Rules2Engine);
}

if (typeof window.GameEngine === "undefined") window.GameEngine = {};
Object.assign(window.GameEngine, {
  openHeroModal: (tab) => Rules2Engine.openHeroModal(tab),
  openAssettoModal: () => Rules2Engine.openAssettoModal(),
  openHeroSheetDrawer: () => Rules2Engine.openHeroModal("scheda"),
  openBackpackDrawer: () => Rules2Engine.openHeroModal("zaino"),
  openSquadDrawer: () => Rules2Engine.openHeroModal("squadra"),
  openDossierDrawer: () => Rules2Engine.openHeroModal("dossier"),
  openEmporioDrawer: () => Rules2Engine.openEmporioDrawer(),
  openAbandonModal: () => Rules2Engine.openAbandonModal(),
  confirmAbandon: () => Rules2Engine.confirmAbandon(),
  leaveGameToHub: () => Rules2Engine.leaveGameToHub(),

  setEmporioMode: (m) => Rules2Engine.setEmporioMode(m),
  buyFromEmporio: (id, p) => Rules2Engine.buyFromEmporio(id, p),
  sellToEmporio: (it, g) => Rules2Engine.sellToEmporio(it, g),
  openCambioModal: () => Rules2Engine.openCambioModal(),
  convertMegoinToGold: (m, g) => Rules2Engine.convertMegoinToGold(m, g),

  filterBackpack: (c) => Rules2Engine.filterBackpack(c),
  useBackpackItem: (it) => Rules2Engine.useBackpackItem(it),
  equipItem: (it, t) => Rules2Engine.equipItem(it, t),

  combatAction: (act) => Rules2Engine.combatAction(act),
  combatBribe: (d) => Rules2Engine.combatBribe(d),
  executeResurrectZombie: (id) => Rules2Engine.executeResurrectZombie(id),
  skipNecromancy: () => Rules2Engine.skipNecromancy(),
  submitQuizAnswer: (a) => Rules2Engine.submitQuizAnswer(a),
  advanceToNode: (t) => Rules2Engine.advanceToNode(t)
});
