// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2engine.js (VERSIONE 14.0 - FULL GAS REST & NATIVE HUD ALIGNED)
// LAYER: GAMEPLAY LOOP, D20 COMBAT, ASSETTO TATTICO, CRAFTING & FORFEIT ENGINE
// NOTE: 100% DISACCOPPIATO DAL WALLET PIATTAFORMA - GESTIONE AUTONOMA DELL'ORO 🟡
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

function rulesNotify(msg, type = "info") {
  if (window.AppCore && typeof AppCore.toast === "function") {
    AppCore.toast(msg, type);
  } else if (window.Telegram?.WebApp?.showAlert) {
    window.Telegram.WebApp.showAlert(msg);
  } else {
    alert(msg);
  }
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
  // GESTIONE AUTONOMA ORO DI GIOCO (DISACCOPPIATA DAL WALLET MEGOIN)
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
    if (wiz) wiz.innerHTML = `💰 <b>${num}</b> 🟡`;
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

    // Se c'è una partita attiva su GAS: opzione Riprendi o Ricomincia
    if (saga && saga.hasActiveGame && saga.activePartitaId) {
      if (activeBox) activeBox.classList.remove("hidden");
      if (insertBox) insertBox.classList.add("hidden");

      activeBox.innerHTML = `
        <h3 class="arcade-title">${saga.serie || 'AVVENTURA'}</h3>
        <p class="arcade-subtitle">Sessione attiva sul server (ID: ${saga.activePartitaId})</p>
        <div class="grid grid-cols-2 gap-2 pt-2">
          <button id="btn-arcade-new" class="btn btn-outline border-amber-500/40 text-amber-300 font-bold text-xs">Ricomincia (1 🪙)</button>
          <button id="btn-arcade-resume" class="btn btn-success text-slate-950 font-black text-xs">Riprendi ▶️</button>
        </div>
      `;

      document.getElementById("btn-arcade-resume").onclick = () => {
        modal.close();
        const activeFase = String(saga.activeFase || "").toUpperCase();

        // Se era sospesa durante il Wizard, riprende dallo step salvato su GAS
        if (activeFase.indexOf("WIZARD_") !== -1) {
          if (typeof Rules2Wizard !== "undefined") {
            Rules2Wizard.resumeSession(gameKey, saga.activeEpisodio || epNum, saga);
          }
          return;
        }

        // Se in gioco, naviga allo snodo attivo
        AppState.activeSession.engineKey = "Rules2";
        AppState.activeSession.gameKey = gameKey;
        AppState.activeSession.episodio = saga.activeEpisodio || epNum;
        AppState.activeSession.partitaId = saga.activePartitaId;
        AppState.activeSession.combatRound = 1;
        AppState.activeSession.combatEnemyId = null;

        AppRouter.navigate("view-gameplay");
        const resumeNode = saga.activeNode || `SND_0001_S1_E${saga.activeEpisodio || epNum}`;
        this.advanceToNode(resumeNode);
      };

      document.getElementById("btn-arcade-new").onclick = () => {
        if (activeBox) activeBox.classList.add("hidden");
        if (insertBox) insertBox.classList.remove("hidden");
        this._setupArcadeCoinScreen(gameKey, epNum, canContinueFree, savedHero, modal);
      };
    } else {
      if (activeBox) activeBox.classList.add("hidden");
      if (insertBox) insertBox.classList.remove("hidden");
      this._setupArcadeCoinScreen(gameKey, epNum, canContinueFree, savedHero, modal);
    }

    if (window.SoundEngine) SoundEngine.playClick();
    modal.showModal();
  },

  _setupArcadeCoinScreen: function(gameKey, epNum, canContinueFree, savedHero, modal) {
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const userBalance = Wallet.getMegoin();

    s("arcade-user-balance", userBalance);

    if (canContinueFree || (savedHero && epNum > 1)) {
      s("arcade-coin-title", "EROE VETERANO");
      s("arcade-coin-desc", `Prosegui con l'Eroe veterano "${savedHero ? (savedHero.nomeEroe || savedHero.classe) : 'In Memoria'}".`);
      s("arcade-cost-badge", "GRATIS");
      const btnLaunch = document.getElementById("arcade-btn-launch");
      if (btnLaunch) {
        btnLaunch.textContent = "Continua l'Inchiesta 🎖️";
        btnLaunch.onclick = () => {
          modal.close();
          if (typeof Rules2Wizard !== "undefined") {
            Rules2Wizard.open(gameKey, epNum, true, savedHero);
          }
        };
      }
    } else {
      s("arcade-coin-title", "INSERISCI GETTONE");
      s("arcade-coin-desc", "1 Megoin per creare e lanciare un nuovo eroe.");
      s("arcade-cost-badge", "1 🪙");
      const btnLaunch = document.getElementById("arcade-btn-launch");
      if (btnLaunch) {
        btnLaunch.textContent = "Inserisci 1 🪙 e Gioca";
        btnLaunch.onclick = () => {
          if (userBalance < 1) {
            tgHaptic("error");
            if (window.SoundEngine) SoundEngine.playError();
            return rulesNotify("Saldo Megoin insufficiente per avviare la sessione!", "error");
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
      if (window.SoundEngine) {
        SoundEngine.playCoin();
        if (typeof SoundEngine.playEpisodeBgm === "function") {
          SoundEngine.playEpisodeBgm(payloadParams.gameKey, payloadParams.episodio, "explore");
        }
      }

      // Chiamata Server-Authoritative: avvio atomico su Modulo_WebApp.gs
      const res = await apiCall("game_start", payloadParams);
      if (res && res.success) {
        const wizardCatalog = (typeof Rules2Wizard !== "undefined" && Rules2Wizard.state.shopCatalog) || [];
        const allGameItems = [
          ...(res.emporioItems || []),
          ...wizardCatalog
        ];

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
          saga.activeFase = "IN_GIOCO";
          saga.activeNode = res.nodoIniziale?.id;
          saga.statoEroe = res.statoEroe;
        }

        if (res.nuovoSaldoMegoin !== undefined) {
          Wallet.setMegoin(res.nuovoSaldoMegoin);
        }
        if (window.AppCore) AppCore.syncUI();

        this.renderNode(res.nodoIniziale, AppState.activeSession.hero);
        AppRouter.navigate("view-gameplay");
      }
    } catch (err) {
      console.error("[Rules2Engine] Errore avvio partita su GAS:", err);
      rulesNotify("Errore avvio: " + err.message, "error");
    }
  },

  syncHUD: function() {
    const hero = AppState.activeSession?.hero;
    if (!hero) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const saga = (AppState.games.catalog || []).find(g => g.gameKey === AppState.activeSession.gameKey);

    s("game-header-series", (saga ? saga.serie : "AVVENTURA NOIR").toUpperCase());
    s("game-header-episode", `Episodio ${AppState.activeSession.episodio}`);

    const avatarImg = document.getElementById("kpi-hero-avatar-img");
    const avatarFallback = document.getElementById("kpi-hero-avatar-fallback");
    const media = hero.mediaUrl;

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

    s("kpi-hero-name", hero.nomeEroe || "Avventuriero");
    s("kpi-hero-gold", hero.oro || 0);
    s("kpi-hero-pv-text", `${hero.pv || 0}/${hero.pvMax || 25}`);

    const pvBar = document.getElementById("kpi-hero-pv-bar");
    if (pvBar) {
      pvBar.value = hero.pv || 0;
      pvBar.max = hero.pvMax || 25;
    }

    if (hero.modificatori) {
      s("kpi-mod-for", (hero.modificatori.FORZA >= 0 ? "+" : "") + hero.modificatori.FORZA);
      s("kpi-mod-des", (hero.modificatori.DESTREZZA >= 0 ? "+" : "") + hero.modificatori.DESTREZZA);
      s("kpi-mod-int", (hero.modificatori.INTELLIGENZA >= 0 ? "+" : "") + hero.modificatori.INTELLIGENZA);
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

    this.syncHUD();

    // Monitor Cardiaco Bassa Salute (PV <= 25%)
    if (currentHero && currentHero.pvMax) {
      const pvRatio = (currentHero.pv || 0) / currentHero.pvMax;
      if (pvRatio <= 0.25 && currentHero.pv > 0) {
        if (window.SoundEngine && typeof SoundEngine.startHeartbeat === "function") SoundEngine.startHeartbeat();
      } else {
        if (window.SoundEngine && typeof SoundEngine.stopHeartbeat === "function") SoundEngine.stopHeartbeat();
      }
    }

    const isDefeat = (currentHero && currentHero.pv <= 0) || (currentNode.categoria === "Fine" && currentNode.sottocategoria === "morte");
    const isVictory = (String(currentNode.id).includes("SND_END") || currentNode.sottocategoria === "gancio" || currentNode.sottocategoria === "conclusione");
    const actBox = document.getElementById("scene-actions-container");

    // 1. ESITO MORTE
    if (isDefeat) {
      if (window.SoundEngine) {
        if (typeof SoundEngine.stopHeartbeat === "function") SoundEngine.stopHeartbeat();
        SoundEngine.playError();
      }
      if (actBox) {
        actBox.innerHTML = `
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button onclick="Rules2Engine.launchSession('${AppState.activeSession.gameKey}', ${AppState.activeSession.episodio}, false, null)" class="scene-action-btn action-danger font-black justify-center">
              Riprova (1 🪙) 🔄
            </button>
            <button onclick="Rules2Engine.confirmAbandon()" class="scene-action-btn font-bold justify-center">
              Esci 🚪
            </button>
          </div>
        `;
      }
      return;
    }

    // 2. ESITO VITTORIA
    if (isVictory) {
      if (window.SoundEngine) {
        if (typeof SoundEngine.stopHeartbeat === "function") SoundEngine.stopHeartbeat();
        SoundEngine.playVictory();
      }
      if (window.confetti) {
        try { window.confetti({ particleCount: 75, spread: 60 }); } catch (e) {}
      }
      if (actBox) {
        actBox.innerHTML = `
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button onclick="Rules2Engine.launchSession('${AppState.activeSession.gameKey}', ${AppState.activeSession.episodio}, false, null)" class="scene-action-btn font-bold justify-center">
              Rigioca Ep. ${AppState.activeSession.episodio} 🔄
            </button>
            <button onclick="Rules2Engine.launchSession('${AppState.activeSession.gameKey}', ${AppState.activeSession.episodio + 1}, true, AppState.activeSession.hero)" class="scene-action-btn font-black text-emerald-300 justify-center">
              Episodio ${AppState.activeSession.episodio + 1} ›
            </button>
          </div>
        `;
      }
      return;
    }

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

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

    // CASO 1: COMBATTIMENTO D20
    if (isCombat) {
      if (AppState.activeSession.combatEnemyId !== currentNode.id) {
        AppState.activeSession.combatEnemyId = currentNode.id;
        AppState.activeSession.combatRound = 1;
        if (window.SoundEngine) SoundEngine.playDice();
      }

      let bribeHtml = "";
      if (currentNode.corruption?.canCorrupt && currentNode.corruption.validDrugs?.length > 0) {
        bribeHtml = currentNode.corruption.validDrugs.map(d => `
          <button onclick="Rules2Engine.combatBribe('${Rules2_SafeAttr(d.nome)}')" class="scene-action-btn border-amber-400/40 text-amber-300">
            <span>Offri ${Rules2_SafeAttr(d.nome.split(" ")[0])} 💊</span>
            <span class="text-[10px] font-mono uppercase">Corrompi</span>
          </button>
        `).join("");
      }

      actBox.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <button onclick="Rules2Engine.combatAction('attack_round')" class="scene-action-btn action-danger font-black justify-center">
            ⚔️ Attacca
          </button>
          <button onclick="Rules2Engine.combatAction('flee')" class="scene-action-btn font-bold justify-center">
            Fuggi 🏃
          </button>
        </div>
        ${bribeHtml}
        <button onclick="Rules2Engine.inspectCurrentEnemyDetail()" class="scene-action-btn text-slate-300 justify-center text-xs">
          Fascicolo Nemico 🔍
        </button>
      `;
      return;
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
          <div class="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 mb-1">
            🛡️ Vantaggio Tattico: possiedi ${bypassTool}!
          </div>
          <button onclick="Rules2Engine.executeEventRoll('${currentNode.id}', '${statReq}', ${cdVal})" class="scene-action-btn border-emerald-500 text-emerald-300 font-black">
            <span>Bypassa con ${bypassTool} ⚡</span>
            <span>100% Successo</span>
          </button>
        `;
      } else {
        actBox.innerHTML = `
          <div class="grid grid-cols-2 gap-2">
            <button onclick="Rules2Engine.executeEventRoll('${currentNode.id}', '${statReq}', ${cdVal})" class="scene-action-btn border-sky-400 text-sky-300 font-black justify-center">
              Tira D20 (${shortStat}) 🎲
            </button>
            <button onclick="Rules2Engine.advanceToNode('${currentNode.destFallback || currentNode.destFallimento}')" class="scene-action-btn font-bold justify-center">
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
        <div class="p-3 bg-slate-900 rounded-xl border border-white/10 space-y-2">
          <div class="text-xs font-bold text-sky-300">🔐 ${currentNode.quiz.domanda}</div>
          <div class="grid grid-cols-2 gap-2 pt-1">
            ${currentNode.quiz.opzioni.map(opz => `
              <button onclick="Rules2Engine.submitQuizAnswer('${Rules2_SafeAttr(opz)}')" class="scene-action-btn text-xs font-bold truncate">
                ${opz}
              </button>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    // CASO 4: BIVIO NARRATIVO STANDARD (DAL NODO GAS)
    const choices = (currentNode.choices || []).filter(c => c.target);

    if (choices.length > 0) {
      actBox.innerHTML = choices.map(c => `
        <button onclick="Rules2Engine.advanceToNode('${c.target}')" class="scene-action-btn">
          <span class="truncate">${c.testo}</span>
          <span>›</span>
        </button>
      `).join("");
    } else {
      actBox.innerHTML = `
        <button onclick="Rules2Engine.leaveGameToHub()" class="scene-action-btn justify-center font-black">
          Torna all'Hub 🏠
        </button>
      `;
    }
  },

  advanceToNode: async function(targetId) {
    if (!AppState.activeSession.gameKey || this._isBusy) return;
    this._setBusy(true);

    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();

    // Progressione lavorazione sintesi chimica ad ogni snodo
    const h = AppState.activeSession.hero;
    if (h && h.sintesiInCorso && h.sintesiInCorso.length > 0) {
      const stillCrafting = [];
      for (let sc of h.sintesiInCorso) {
        sc.turniMancanti -= 1;
        if (sc.turniMancanti <= 0) {
          h.inventario = h.inventario || [];
          h.inventario.push(sc.prodotto);
          rulesNotify(`⚗️ Sintesi completata: 1 dose di ${sc.icon || '💊'} ${sc.prodotto} pronta nello zaino!`, "success");
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
      console.error("[Rules2Engine] Errore advanceToNode su GAS:", e);
      rulesNotify("Errore avanzamento: " + e.message, "error");
    }
  },

  // 🎯 RISOLUZIONE EVENTO D20 SERVER-AUTHORITATIVE
  executeEventRoll: async function(nodeId, statName, cdVal) {
    if (this._isBusy) return;
    this._setBusy(true);

    const diceModal = document.getElementById("modal-dice-suspense");
    const diceCube = document.getElementById("dice-visual-cube");
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    s("dice-roll-title", `Prova ${statName} vs CD ${cdVal}`);
    s("dice-roll-result", "--");
    s("dice-roll-desc", "Verifica tiro sul server...");

    if (diceCube) diceCube.classList.add("dice-rolling");
    if (diceModal) diceModal.showModal();

    if (window.SoundEngine) SoundEngine.playDice();

    try {
      const res = await apiCall("game_action", {
        subAction: "event_roll",
        nodeId: nodeId,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });

      if (diceCube) diceCube.classList.remove("dice-rolling");

      const r = res.rollResult || {};
      const isSuccess = res.passed;
      const isBypassed = r.bypassed;
      const isCrit = (r.d20 === 20);
      const isFail = (r.d20 === 1);

      if (isBypassed) {
        s("dice-roll-result", "⚡ BYPASS");
        s("dice-roll-desc", `Superato grazie a ${r.itemId || r.allyId || 'equipaggiamento'}!`);
      } else {
        s("dice-roll-result", `${r.tot || '--'} (CD ${r.cdD20 || cdVal})`);
        s("dice-roll-desc", isSuccess ? "PROVA SUPERATA!" : `FALLITO! (-${res.dmgTaken || 0} PV)`);
      }

      if (window.SoundEngine) {
        if (isSuccess) SoundEngine.playVictory();
        else SoundEngine.playError();
      }

      setTimeout(() => {
        if (diceModal) diceModal.close();

        if (isSuccess) {
          tgHaptic("success");
          this.showFloatingDamage(isCrit ? "🌟 CRITICO!" : "✅ Superato!", isCrit, false);
        } else {
          tgHaptic("error");
          this.showFloatingDamage(isFail ? "💀 FUMBLE!" : `💔 -${res.dmgTaken || 0} PV`, false, true);
        }

        if (res.nextView) {
          this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
        }
      }, 700);

    } catch (e) {
      if (diceModal) diceModal.close();
      this._setBusy(false);
      console.error("[Rules2Engine] Errore executeEventRoll:", e);
      rulesNotify("Errore prova evento: " + e.message, "error");
    }
  },

  // 🎯 RISOLUZIONE ENIGMA SERVER-AUTHORITATIVE
  submitQuizAnswer: async function(selectedOpz) {
    if (this._isBusy) return;
    const node = AppState.activeSession.currentNode;
    if (!node?.quiz) return;

    this._setBusy(true);

    try {
      const res = await apiCall("game_action", {
        subAction: "quiz_answer",
        nodeId: node.id,
        answer: selectedOpz,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      });

      if (res?.correct) {
        tgHaptic("success");
        if (window.SoundEngine) SoundEngine.playVictory();
        this.showFloatingDamage("✅ Esatto!", false, false);
      } else {
        tgHaptic("error");
        if (window.SoundEngine) SoundEngine.playError();
        this.showFloatingDamage(`❌ Errato! -${res.dmgTaken || 4} PV`, false, true);
      }

      setTimeout(() => {
        if (res?.nextView) {
          this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
        }
      }, 600);

    } catch (e) {
      this._setBusy(false);
      console.error("[Rules2Engine] Errore submitQuizAnswer:", e);
      rulesNotify("Errore verifica risposta: " + e.message, "error");
    }
  },

  // 🎯 RISOLUZIONE COMBATTIMENTO ROUND D20
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
      s("dice-roll-desc", "Tiro di attacco D20...");
      if (diceCube) diceCube.classList.add("dice-rolling");
      if (diceModal) diceModal.showModal();

      if (window.SoundEngine) SoundEngine.playDice();
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
          s("dice-roll-result", `${log.totHero} (CD ${log.cdTarget})`);
          s("dice-roll-desc", log.isHit ? (log.isCrit ? "COLPO CRITICO!" : `COLPITO! -${log.dmgDealt} PV`) : "COLPO A VUOTO!");
        } else {
          s("dice-roll-result", res.status === "VICTORY" ? "VITTORIA!" : "FINE");
        }

        setTimeout(() => {
          if (diceModal) diceModal.close();

          if (log) {
            if (log.isHit) {
              tgHaptic(log.isCrit ? "success" : "light");
              this.showFloatingDamage(`💥 -${log.dmgDealt} PV`, log.isCrit, false);
            } else {
              this.showFloatingDamage("💨 A vuoto", false, false);
            }

            if (log.dmgTaken > 0) {
              setTimeout(() => {
                tgHaptic("error");
                this.showFloatingDamage(`💔 -${log.dmgTaken} PV Squadra`, false, true);
                if (window.SoundEngine) SoundEngine.playError();
              }, 250);
            }
          }

          if (res.status === "VICTORY") {
            AppState.activeSession.combatRound = 1;
            AppState.activeSession.combatEnemyId = null;

            if (window.SoundEngine) {
              if (typeof SoundEngine.stopHeartbeat === "function") SoundEngine.stopHeartbeat();
              SoundEngine.playVictory();
            }
            if (window.confetti) {
              try { window.confetti({ particleCount: 75, spread: 60 }); } catch (e) {}
            }

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
            if (window.SoundEngine) SoundEngine.playError();
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
      rulesNotify("Errore azione: " + e.message, "error");
    }
  },

  renderNecromancyPrompt: function(deadEnemy) {
    this._setBusy(false);
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    actBox.innerHTML = `
      <div class="p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2">
        <div class="font-black text-purple-300 text-xs">🧟 RIANIMAZIONE DISPONIBILE</div>
        <div class="text-[11px] text-slate-300">Rianima <b>${deadEnemy ? deadEnemy.nome : 'nemico'}</b> come Zombi (Danno x2).</div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button onclick="Rules2Engine.executeResurrectZombie('${deadEnemy ? deadEnemy.id : ''}')" class="scene-action-btn border-purple-400 text-purple-300 font-black justify-center">
            Rianima (-1 PV) 🧟
          </button>
          <button onclick="Rules2Engine.skipNecromancy()" class="scene-action-btn text-slate-300 font-bold justify-center">
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
        this.showFloatingDamage("🧟 Risorto!", false, false);
        if (AppState.activeSession.engineState?.pendingVictory) {
          this.renderNode(AppState.activeSession.engineState.pendingVictory.nodo, res.statoEroe);
          AppState.activeSession.engineState.pendingVictory = null;
        }
      }
    } catch (e) {
      rulesNotify("Rianimazione fallita: " + e.message, "warning");
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
        this.showFloatingDamage("🟡 Corrotto!", false, false);
        this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
      }
    } catch (e) {
      this._setBusy(false);
      rulesNotify("Corruzione fallita: " + e.message, "error");
    }
  },

  showFloatingDamage: function(text, isCrit, isHeroDmg) {
    const box = document.getElementById("floating-damage-box");
    if (!box) return;
    const el = document.createElement("div");
    el.className = `floating-damage ${isHeroDmg ? 'text-rose-400' : (isCrit ? 'text-amber-400' : 'text-sky-400')}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  // --------------------------------------------------------------------------
  // 3. FASCICOLO APPROFONDITO UNIVERSALE
  // --------------------------------------------------------------------------
  inspectCurrentEnemyDetail: function() {
    const enemy = AppState.activeSession.currentNode;
    if (!enemy) return;

    this.inspectEntityDetail({
      id: enemy.id,
      nome: enemy.nome,
      tipo: "NEMICO",
      categoria: enemy.categoria || "Mazzu",
      pv: enemy.pv,
      danno: enemy.danno,
      forza: enemy.forza,
      destrezza: enemy.destrezza,
      intelligenza: enemy.intelligenza,
      difficolta: enemy.difficolta,
      statRichiesta: enemy.statRichiesta,
      descrizione: enemy.testo,
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

    s("uni-detail-icon", it.tipo === "NEMICO" ? "👾" : "📦");
    s("uni-detail-title", it.nome);
    s("uni-detail-badge", `${(it.tipo || 'EQUIPAGGIAMENTO').toUpperCase()} • ${(it.categoria || 'GENERALE').toUpperCase()}`);

    const bonuses = [];
    if (it.pv) bonuses.push(`❤️ PV: <b>${it.pv}</b>`);
    if (it.danno) bonuses.push(`💥 Danno: <b>${it.danno}</b>`);
    if (it.forza) bonuses.push(`🥊 FOR: <b>${it.forza}</b>`);
    if (it.destrezza) bonuses.push(`🤸 DES: <b>${it.destrezza}</b>`);
    if (it.intelligenza) bonuses.push(`🧠 INT: <b>${it.intelligenza}</b>`);
    if (it.costoOro) bonuses.push(`💰 Prezzo: <b class="text-amber-300">${it.costoOro} 🟡</b>`);

    h("uni-detail-metrics-value", bonuses.join(" • ") || "Nessun parametro");
    s("uni-detail-lore", (it.descrizione || it.testo || "Nessun fascicolo allegato.").replace(/\s*\([A-Z]{3,4}_\d{4}_S\d+_E\d+\)/gi, ""));

    const btn = document.getElementById("uni-detail-action-btn");
    if (btn) {
      const cat = Rules2_ClassifyEntity(it);
      if (it.isEnemyInspection) {
        btn.textContent = "Attacca ⚔️";
        btn.className = "btn btn-error btn-sm flex-1 font-black uppercase";
        btn.onclick = () => { modal.close(); this.combatAction("attack_round"); };
      } else if (cat === "ARMI") {
        btn.textContent = "Impugna 🗡️";
        btn.className = "btn btn-primary btn-sm flex-1 font-black uppercase";
        btn.onclick = () => { this.equipItem(it.nome, "weapon"); modal.close(); };
      } else if (cat === "VEICOLI") {
        btn.textContent = "Guida 🛴";
        btn.className = "btn btn-primary btn-sm flex-1 font-black uppercase";
        btn.onclick = () => { this.equipItem(it.nome, "vehicle"); modal.close(); };
      } else if (cat === "DROGHE" || cat === "CURE") {
        btn.textContent = (cat === "DROGHE") ? "Assumi 💊" : "Usa ❤️";
        btn.className = "btn btn-success btn-sm flex-1 font-black uppercase";
        btn.onclick = () => { this.useBackpackItem(it.nome); modal.close(); };
      } else {
        btn.textContent = "Chiudi ✕";
        btn.className = "btn btn-ghost btn-sm flex-1 text-slate-400 font-bold uppercase";
        btn.onclick = () => modal.close();
      }
    }

    if (window.SoundEngine) SoundEngine.playClick();
    modal.showModal();
  },

  // --------------------------------------------------------------------------
  // 4. PILASTRI TATTICI DEL COCKPIT (FOOTER RULES2)
  // --------------------------------------------------------------------------

  // 1. SCHEDA EROE A 4 TAB
  openHeroModal: function(tabName = "scheda") {
    this._activeHeroTab = tabName;
    const h = AppState.activeSession.hero;
    if (!h) return;

    const modal = document.getElementById("drawer-hero-sheet");
    if (!modal) return;

    this.renderHeroModalContent();
    tgHaptic("selection");
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

    ["scheda", "zaino", "squadra", "dossier"].forEach(t => {
      const btn = document.getElementById(`hero-tab-btn-${t}`);
      const panel = document.getElementById(`hero-tab-content-${t}`);
      const isActive = (t === tab);
      if (btn) btn.className = `btn btn-xs flex-1 font-bold ${isActive ? 'btn-primary' : 'btn-ghost text-slate-400'}`;
      if (panel) panel.classList.toggle("hidden", !isActive);
    });

    s("sheet-hero-name", h.nomeEroe || "Avventuriero");
    s("sheet-hero-class", `${h.classe || "Avventuriero"} (${h.schieramentoPolitico || "Destra"})`);
    s("sheet-hero-gold", `${h.oro || 0} 🟡`);

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
        : "Nessun talento attivo.";
    }

    if (tab === "zaino") this.filterBackpack(AppState.activeSession.engineState?.backpackFilter || "ALL");
    else if (tab === "squadra") this.renderSquadSubView();
    else if (tab === "dossier") this.renderDossierSubView();
  },

  renderSquadSubView: function() {
    const c = document.getElementById("squad-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    let html = "";
    const comp = h.compagni || [];
    const zombies = h.zombieSquad || [];

    if (comp.length === 0 && zombies.length === 0) {
      html = `<div class="p-3 text-center text-xs text-slate-500 font-mono">In solitaria. Nessun alleato al seguito.</div>`;
    } else {
      html += comp.map(a => `<div class="p-2.5 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between text-xs"><span>🤝 ${a}</span> <span class="badge badge-xs badge-info">Alleato</span></div>`).join("");
      html += zombies.map(z => `<div class="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-between text-xs text-purple-300"><span>🧟 ${z.nome}</span> <span class="badge badge-xs badge-secondary">Danno x2</span></div>`).join("");
    }
    c.innerHTML = html;
  },

  renderDossierSubView: function() {
    const c = document.getElementById("dossier-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    const inv = h.inventario || [];
    const infoItems = inv.filter(it => Rules2_ClassifyEntity(this._findEntityData(it)) === "INFORMAZIONI");

    if (infoItems.length === 0) {
      c.innerHTML = `<div class="p-3 text-center text-xs text-slate-500 font-mono">Nessun reperto d'inchiesta raccolto finora.</div>`;
    } else {
      c.innerHTML = infoItems.map(p => {
        const ent = this._findEntityData(p);
        const isPermanent = String(ent?.sottocategoria || "").toLowerCase().includes("prov");
        return `
          <div onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${Rules2_SafeAttr(p)}'))" class="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between cursor-pointer">
            <div>
              <div class="font-bold text-xs text-white">📁 ${p}</div>
              <div class="text-[10px] text-slate-400">${isPermanent ? '+1 INT permanente sull\'organigramma' : '+1 INT situazionale'}</div>
            </div>
            <span class="badge badge-xs badge-info font-mono">${ent?.categoria || 'Reperto'}</span>
          </div>
        `;
      }).join("");
    }
  },

  // 2. ASSETTO TATTICO & SINTESI
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
      if (hasTool && hasIngr) availableRecipes.push(rec);
    }

    modal.innerHTML = `
      <div class="modal-box p-5 bg-slate-950 border border-purple-500/40 rounded-2xl max-w-md space-y-3 relative">
        <button onclick="document.getElementById('modal-cockpit-assetto').close()" class="modal-close-btn">✕</button>
        <div class="flex items-center gap-2">
          <span class="text-2xl">🔱</span>
          <h3 class="text-sm font-black text-white uppercase">Assetto Tattico & Sintesi</h3>
        </div>

        <div class="space-y-2 pt-1 text-xs">
          <div class="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between">
            <div><span class="text-slate-400">🗡️ Arma in pugno:</span> <b class="text-sky-300 ml-1 font-mono">${h.armaAttiva || 'Pugni nudi'}</b></div>
            <button onclick="Rules2Engine.openHeroModal('zaino')" class="btn btn-xs btn-outline border-white/20">Cambia</button>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between">
            <div><span class="text-slate-400">🛴 Veicolo attivo:</span> <b class="text-sky-300 ml-1 font-mono">${h.veicoloAttivo || 'A piedi'}</b></div>
            <button onclick="Rules2Engine.openHeroModal('zaino')" class="btn btn-xs btn-outline border-white/20">Cambia</button>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2 mt-2">
          <div class="text-[10px] font-mono font-bold text-purple-300 uppercase">⚗️ Banco di Sintesi Clandestina</div>
          ${availableRecipes.length > 0 ? availableRecipes.map(r => `
            <div class="flex items-center justify-between p-2 rounded-lg bg-black/40 text-xs">
              <span>${r.icon} <b>${r.prodName}</b> (${r.turns} snodi)</span>
              <button onclick="Rules2Engine.startSynthesis('${r.prodName}', '${r.toolName}')" class="btn btn-xs btn-secondary font-black">Distilla</button>
            </div>
          `).join("") : '<div class="text-[11px] text-slate-400 italic">Nessun reagente combinabile nello zaino.</div>'}
        </div>
      </div>
    `;

    tgHaptic("selection");
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
          h.sintesiInCorso.push({ prodotto: rec.prodName, turniMancanti: rec.turns, icon: rec.icon });
          tgHaptic("success");
          rulesNotify(`⚗️ Avviata lavorazione di ${rec.prodName} (pronta tra ${rec.turns} snodi).`, "success");
          this.openAssettoModal();
          return;
        }
      }
    }
  },

  // 3. EMPORIO DI CICCIO (ACQUISTO, VENDITA, CAMBIO)
  openEmporioDrawer: function() {
    const goldDisp = document.getElementById("emporio-gold-display");
    if (goldDisp) goldDisp.textContent = `${this.getGold()} 🟡`;
    this.setEmporioMode(AppState.activeSession.engineState?.emporioMode || "buy");
    tgHaptic("selection");
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

    if (!container) return;

    if (mode === "sell") {
      const inv = h?.inventario || [];
      if (inv.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-slate-500 font-mono col-span-full">Zaino vuoto.</div>`;
        return;
      }
      container.innerHTML = inv.map(it => {
        const ent = this._findEntityData(it);
        const buyPrice = Math.abs(Number(ent?.costoOro || ent?.costo || 10));
        const sellPrice = Math.max(1, Math.ceil(buyPrice * 0.25));

        return `
          <div class="p-2.5 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between text-xs">
            <span class="font-bold text-white truncate pr-2">${it}</span>
            <button onclick="Rules2Engine.sellToEmporio('${Rules2_SafeAttr(it)}', ${sellPrice})" class="btn btn-xs btn-warning font-black uppercase shrink-0">
              Vendi (+${sellPrice} 🟡)
            </button>
          </div>
        `;
      }).join("");
    } else {
      const emporioItems = AppState.activeSession.shopCatalog || [];
      if (emporioItems.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-slate-500 font-mono col-span-full">Banchi vuoti.</div>`;
        return;
      }

      container.innerHTML = emporioItems.map(item => {
        const price = Math.abs(Number(item.costoOro || item.costo || 10));
        const canAfford = (this.getGold() >= price);

        return `
          <div class="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between gap-2">
            <div class="min-w-0 pr-2">
              <div class="font-bold text-xs text-white truncate">${item.emoji || '📦'} ${item.nome}</div>
              <div class="text-[10px] text-amber-300 font-mono">${price} 🟡</div>
            </div>
            <button onclick="Rules2Engine.buyFromEmporio('${item.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary font-bold' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'} shrink-0" ${!canAfford ? 'disabled' : ''}>
              ${canAfford ? 'Compra' : 'Oro Insuff.'}
            </button>
          </div>
        `;
      }).join("");
    }
  },

  buyFromEmporio: async function(itemId, goldCost) {
    if (this.getGold() < goldCost) {
      tgHaptic("error");
      return rulesNotify("Monete d'oro insufficienti!", "error");
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
      }

      tgHaptic("success");
      if (window.SoundEngine) SoundEngine.playCoin();
      this.openEmporioDrawer();
      this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
    } catch (e) {
      rulesNotify("Errore acquisto emporio: " + e.message, "error");
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
        }
      }

      tgHaptic("success");
      if (window.SoundEngine) SoundEngine.playCoin();
      this.openEmporioDrawer();
      this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
    } catch (e) {
      rulesNotify("Errore vendita: " + e.message, "error");
    }
  },

  openCambioModal: function() {
    const balEl = document.getElementById("cambio-megoin-balance");
    if (balEl) balEl.textContent = Wallet.getMegoin();
    tgHaptic("selection");
    document.getElementById("modal-banco-cambio")?.showModal();
  },

  convertMegoinToGold: async function(megoinCost, goldEarned) {
    const currentMegoin = Wallet.getMegoin();
    if (currentMegoin < megoinCost) {
      tgHaptic("error");
      return rulesNotify("Megoin insufficienti per il cambio!", "error");
    }

    try {
      const res = await apiCall("currency_exchange", {
        megoin: megoinCost,
        gold: goldEarned,
        gameKey: AppState.activeSession.gameKey || "game1"
      });

      if (res?.success) {
        tgHaptic("success");
        if (window.SoundEngine) SoundEngine.playCoin();

        const nuovoSaldo = res.nuovoSaldoMegoin !== undefined ? res.nuovoSaldoMegoin : (currentMegoin - megoinCost);
        Wallet.setMegoin(nuovoSaldo);

        const nuovoOro = res.nuovoOro !== undefined ? res.nuovoOro : (this.getGold() + goldEarned);
        this.setGold(nuovoOro);

        if (AppState.activeSession.hero) {
          this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
        }
        if (window.AppCore) AppCore.syncUI();

        rulesNotify(`Convertiti ${megoinCost} 🪙 in +${goldEarned} 🟡 Oro!`, "success");
        document.getElementById("modal-banco-cambio")?.close();
      }
    } catch (e) {
      rulesNotify("Errore cambio valuta: " + e.message, "error");
    }
  },

  // 4. ESCI / GESTIONE ABBANDONO SESSIONE
  openAbandonModal: function() {
    tgHaptic("warning");
    const modal = document.getElementById("modal-abandon");
    if (modal) modal.showModal();
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
      console.warn("[confirmAbandon] Errore archiviazione partita:", e);
    }

    const saga = (AppState.games.catalog || []).find(g => g.gameKey === gKey);
    if (saga) {
      saga.hasActiveGame = false;
      saga.activePartitaId = null;
      saga.activeFase = null;
      saga.activeNode = null;
    }

    AppState.activeSession.partitaId = null;
    AppState.activeSession.hero = null;
    AppState.activeSession.currentNode = null;
    AppState.activeSession.engineState = null;

    if (window.SoundEngine && typeof SoundEngine.stopHeartbeat === "function") SoundEngine.stopHeartbeat();
    this.leaveGameToHub();
  },

  leaveGameToHub: function() {
    if (window.SoundEngine && typeof SoundEngine.stopHeartbeat === "function") SoundEngine.stopHeartbeat();
    AppRouter.navigate("games");
  },

  // --------------------------------------------------------------------------
  // UTILITY INVENTARIO & ASSETTO
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
      c.innerHTML = `<div class="p-3 text-center text-xs text-slate-500 font-mono">Zaino vuoto.</div>`;
      return;
    }

    if (cat && cat !== "ALL") {
      inv = inv.filter(itemName => Rules2_ClassifyEntity(this._findEntityData(itemName)) === cat);
      if (inv.length === 0) {
        c.innerHTML = `<div class="p-3 text-center text-xs text-slate-500 font-mono">Nessun articolo per <b>${cat}</b>.</div>`;
        return;
      }
    }

    c.innerHTML = inv.map(it => {
      const isArma = (h.armaAttiva && it.toLowerCase() === h.armaAttiva.toLowerCase());
      const isVeicolo = (h.veicoloAttivo && it.toLowerCase() === h.veicoloAttivo.toLowerCase());
      const ent = this._findEntityData(it);
      const category = Rules2_ClassifyEntity(ent);

      return `
        <div class="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between text-xs">
          <div onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${Rules2_SafeAttr(it)}'), isFromBackpack: true })" class="cursor-pointer pr-2 truncate">
            <div class="font-bold text-white truncate">${it}</div>
            <div class="text-[10px] ${isArma || isVeicolo ? 'text-amber-300 font-bold' : 'text-slate-400'}">
              ${isArma ? '🗡️ [IN PUGNO]' : (isVeicolo ? '🛴 [IN GUIDA]' : category)}
            </div>
          </div>
          <button onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${Rules2_SafeAttr(it)}'), isFromBackpack: true })" class="btn btn-xs btn-outline border-white/20 text-slate-300 font-bold shrink-0">
            Fascicolo
          </button>
        </div>
      `;
    }).join("");
  },

  equipItem: function(itemName, type) {
    const h = AppState.activeSession.hero;
    if (!h) return;

    if (type === "weapon") h.armaAttiva = (h.armaAttiva === itemName) ? "" : itemName;
    if (type === "vehicle") h.veicoloAttivo = (h.veicoloAttivo === itemName) ? "" : itemName;

    tgHaptic("selection");
    this.renderNode(AppState.activeSession.currentNode, h);
    rulesNotify(`Assetto aggiornato: ${itemName}`, "info");

    apiCall("game_action", {
      subAction: "equip",
      item: itemName,
      type: type,
      gameKey: AppState.activeSession.gameKey,
      episodio: AppState.activeSession.episodio
    }).catch(() => {});
  },

  useBackpackItem: function(itemName) {
    const h = AppState.activeSession.hero;
    if (!h) return;

    const ent = this._findEntityData(itemName);
    const idx = (h.inventario || []).indexOf(itemName);
    if (idx !== -1) {
      h.inventario.splice(idx, 1);
      if (ent && ent.pv) {
        h.pv = Math.min(h.pvMax || 25, (h.pv || 0) + ent.pv);
        rulesNotify(`Hai usato ${itemName} (+${ent.pv} PV)!`, "success");
      } else {
        rulesNotify(`Hai assunto ${itemName}!`, "info");
      }
      tgHaptic("success");
      this.renderNode(AppState.activeSession.currentNode, h);

      apiCall("game_action", {
        subAction: "use_item",
        item: itemName,
        gameKey: AppState.activeSession.gameKey,
        episodio: AppState.activeSession.episodio
      }).catch(() => {});
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
