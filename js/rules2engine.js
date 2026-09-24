// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2engine.js (VERSIONE 34.0 - RESOLVE ITEM LOOKUP & CLEAN MODALS)
// LAYER: GAMEPLAY LOOP, D20 COMBAT, 1-2-3-4 ACTION MATRIX & TACTICAL SHEETS
// NOTE: HUMAN ITEM NAMES, CONTEXTUAL EMOJIS, ZERO STAT LOSS ON START
// ============================================================================

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

if (typeof Rules2_ResolveItemName === "undefined") {
  window.Rules2_ResolveItemName = function(idOrName, catalog = []) {
    if (!idOrName || idOrName === "—" || idOrName === "-") return "";
    const clean = String(idOrName).trim();
    const list = catalog.length > 0 ? catalog : (AppState.activeSession?.shopCatalog || []);
    const found = list.find(x => x.id === clean || x.nome?.toLowerCase() === clean.toLowerCase());
    if (found) {
      const emoji = (found.emoji && found.emoji !== "—" && found.emoji !== "-") ? found.emoji + " " : "";
      return emoji + found.nome;
    }
    return clean;
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
  } else {
    alert(msg);
  }
}

function rulesFormatMod(val) {
  const num = Number(val || 10);
  const mod = Math.floor((num - 10) / 2);
  return (mod >= 0 ? "+" : "") + mod;
}

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

  getGold: function() {
    const h = AppState.activeSession?.hero;
    return h ? (parseInt(h.oro, 10) || 0) : 0;
  },

  setGold: function(val) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    if (AppState.activeSession?.hero) {
      AppState.activeSession.hero.oro = num;
    }
    const emp = document.getElementById("emporio-gold-display");
    if (emp) emp.textContent = `${num} 🟡`;
    const sheet = document.getElementById("sheet-hero-gold");
    if (sheet) sheet.textContent = `${num} 🟡`;
    this.syncHUD();
  },

  addGold: function(amount) {
    this.setGold(this.getGold() + amount);
  },

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

    if (saga && saga.hasActiveGame && saga.activePartitaId) {
      if (activeBox) activeBox.classList.remove("hidden");
      if (insertBox) insertBox.classList.add("hidden");

      activeBox.innerHTML = `
        <h3 class="text-xs font-black text-white">${saga.serie || 'AVVENTURA'}</h3>
        <p class="text-[10.5px] text-slate-400 mt-0.5">Sessione attiva sul server (ID: ${saga.activePartitaId})</p>
        <div class="grid grid-cols-2 gap-2 pt-2">
          <button id="btn-arcade-new" class="btn btn-outline border-amber-500/40 text-amber-300 font-bold text-xs">Ricomincia (1 🪙)</button>
          <button id="btn-arcade-resume" class="btn btn-success text-slate-950 font-black text-xs">Riprendi ▶️</button>
        </div>
      `;

      document.getElementById("btn-arcade-resume").onclick = () => {
        modal.close();
        const activeFase = String(saga.activeFase || "").toUpperCase();

        if (activeFase.indexOf("WIZARD_") !== -1) {
          if (typeof Rules2Wizard !== "undefined" && typeof Rules2Wizard.resumeSession === "function") {
            Rules2Wizard.resumeSession(gameKey, saga.activeEpisodio || epNum, saga);
          } else if (typeof Rules2Wizard !== "undefined") {
            Rules2Wizard.open(gameKey, saga.activeEpisodio || epNum, false, null);
          }
          return;
        }

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
      s("arcade-coin-desc", `Prosegui l'avventura con l'Eroe veterano "${savedHero ? (savedHero.nomeEroe || savedHero.classe) : 'In Memoria'}".`);
      s("arcade-cost-badge", "GRATIS");
      const btnLaunch = document.getElementById("arcade-btn-launch");
      if (btnLaunch) {
        btnLaunch.textContent = "Continua l'Avventura 🎖️";
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
          armaAttiva: payloadParams.armaAttiva || res.statoEroe?.armaAttiva || "",
          veicoloAttivo: payloadParams.veicoloAttivo || res.statoEroe?.veicoloAttivo || "",
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
      console.error("[Rules2Engine] Errore avvio partita:", err);
      rulesNotify("Errore avvio: " + err.message, "error");
    }
  },

  syncHUD: function() {
    const hero = AppState.activeSession?.hero;
    if (!hero) return;

    const hudBox = document.getElementById("gameplay-live-hud") || document.querySelector("#view-gameplay .hud-cockpit-48px");
    if (!hudBox) return;

    const heroName = hero.nomeEroe || "Avventuriero";
    const avatar = (hero.mediaUrl && hero.mediaUrl.startsWith("http"))
      ? `<img src="${hero.mediaUrl}" class="w-full h-full object-cover rounded-full" alt="Avatar">`
      : `<span class="text-xs">👤</span>`;

    const pv = parseInt(hero.pv, 10) || 0;
    const pvMax = parseInt(hero.pvMax, 10) || 25;
    const pvPct = Math.max(0, Math.min(100, Math.round((pv / pvMax) * 100)));
    const oro = parseInt(hero.oro, 10) || 0;
    const px = parseInt(hero.px, 10) || 0;

    // Calcolo statistiche comprensive dei bonus arma attiva ed equipaggiamenti
    let effFor = Number(hero.stats?.FORZA || 10);
    let effDes = Number(hero.stats?.DESTREZZA || 10);
    let effInt = Number(hero.stats?.INTELLIGENZA || 10);

    if (hero.armaAttiva) {
      const armEnt = this._findEntityData(hero.armaAttiva);
      if (armEnt?.forza) effFor += Number(armEnt.forza);
    }
    if (hero.veicoloAttivo) {
      const vecEnt = this._findEntityData(hero.veicoloAttivo);
      if (vecEnt?.destrezza) effDes += Number(vecEnt.destrezza);
    }

    const forMod = rulesFormatMod(effFor);
    const desMod = rulesFormatMod(effDes);
    const intMod = rulesFormatMod(effInt);

    hudBox.className = "hud-cockpit-48px";
    hudBox.innerHTML = `
      <div class="flex items-center justify-between w-full min-w-0 leading-none">
        <div class="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
          <div class="w-5 h-5 rounded-full bg-slate-800 border border-sky-400/40 flex items-center justify-center text-xs overflow-hidden shrink-0">
            ${avatar}
          </div>
          <span class="text-xs font-black text-white truncate max-w-[130px]">${heroName}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0 font-mono text-[10.5px]">
          <span class="text-sky-300 font-bold whitespace-nowrap">✨ ${px} PX</span>
          <span class="text-amber-300 font-bold whitespace-nowrap">🟡 <b id="kpi-hero-gold">${oro}</b> ORO</span>
        </div>
      </div>

      <div class="flex items-center justify-between w-full pt-1 mt-0.5 border-t border-white/5 text-[9.5px] font-mono leading-none">
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-rose-400">❤️</span>
          <div class="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full ${pvPct < 30 ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-500 to-sky-400'} transition-all duration-300" style="width: ${pvPct}%;"></div>
          </div>
          <span class="text-rose-300 font-bold">${pv}/${pvMax}</span>
        </div>
        <div class="text-slate-300 tracking-tight text-right shrink-0">
          🥊 ${effFor} (${forMod}) · 🤸 ${effDes} (${desMod}) · 🧠 ${effInt} (${intMod})
        </div>
      </div>
    `;
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

    if (isDefeat) {
      if (window.SoundEngine) {
        if (typeof SoundEngine.stopHeartbeat === "function") SoundEngine.stopHeartbeat();
        SoundEngine.playError();
      }
      if (actBox) {
        actBox.className = "scene-actions-area";
        actBox.innerHTML = `
          <div class="actions-grid-2">
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

    if (isVictory) {
      if (window.SoundEngine) {
        if (typeof SoundEngine.stopHeartbeat === "function") SoundEngine.stopHeartbeat();
        SoundEngine.playVictory();
      }
      if (window.confetti) {
        try { window.confetti({ particleCount: 75, spread: 60 }); } catch (e) {}
      }
      if (actBox) {
        actBox.className = "scene-actions-area";
        actBox.innerHTML = `
          <div class="actions-grid-2">
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

    const isCombat = (currentNode.tipo === "NEMICO" || (currentNode.id && currentNode.id.includes("NEM_")));
    const isEvento = (currentNode.tipo === "EVENTO" || (currentNode.id && currentNode.id.includes("EVT_")));

    let statPlateHtml = "";
    if (isCombat) {
      statPlateHtml = `
        <span>🥊 FOR <b>${currentNode.forza || 12}</b></span>
        <span>🤸 DES <b>${currentNode.destrezza || 12}</b></span>
        <span>🎯 CD <b>${currentNode.difficolta || 12}</b></span>
      `;
    } else if (isEvento) {
      statPlateHtml = `
        <span>🎲 CD <b>${currentNode.difficolta || 11}</b></span>
        <span>🧠 Stat: <b>${(currentNode.statRichiesta || 'DES').substring(0, 3).toUpperCase()}</b></span>
        <span>💔 Rischio <b>${currentNode.danno || 4} PV</b></span>
      `;
    } else {
      // 🔒 SNODO NARRATIVO: Niente zeri ridondanti, solo dettagli d'atmosfera puliti
      const hasOro = Number(currentNode.oro) > 0;
      const hasPx = Number(currentNode.px) > 0;
      if (hasOro || hasPx) {
        statPlateHtml = `
          <span>📍 <b>Snodo</b></span>
          <span>💰 <b>+${currentNode.oro || 0} 🟡</b></span>
          <span>✨ <b>+${currentNode.px || 0} PX</b></span>
        `;
      } else {
        statPlateHtml = `
          <span>🧭 <b>Inchiesta</b></span>
          <span>📁 <b>Dossier</b></span>
          <span>📍 <b>Snodo</b></span>
        `;
      }
    }

    let cleanText = (currentNode.testo || "").replace(/\s*\([A-Z]{3,4}_\d{4}_S\d+_E\d+\)/gi, "");

    // 🔒 Risoluzione nome umano del reperto/loot (mai più OBJ_0001_S1_E1!)
    const rawLoot = currentNode.equipLoot || currentNode.lootId;
    const humanLoot = Rules2_ResolveItemName(rawLoot, AppState.activeSession.shopCatalog);

    const cardWrapper = document.getElementById("gameplay-card-stage");
    if (cardWrapper) {
      cardWrapper.innerHTML = `
        <div class="tcg-card gameplay-focal selected relative my-1">
          <div class="tcg-card-media">
            <div class="tcg-card-header">
              <h4 class="tcg-card-title truncate">${currentNode.nome || "Avventura"}</h4>
              <span class="tcg-card-faction-badge ${isCombat ? 'sinistra' : 'destra'}">${currentNode.tipo || "SNODO"}</span>
            </div>

            <img id="scene-image" src="${currentNode.mediaUrl || 'https://image.pollinations.ai/prompt/dark-rpg-investigation-scene?width=800&height=500&nologo=true'}" class="tcg-card-img" alt="Scena">
            
            ${(currentNode.citazione && currentNode.citazione !== "—" && currentNode.citazione !== "-") ? `
              <div class="tcg-card-quote-overlay">
                <div class="tcg-card-quote-text">“${currentNode.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”</div>
                ${currentNode.autoreCitazione ? `<div class="tcg-card-quote-author">${currentNode.autoreCitazione}</div>` : ''}
              </div>
            ` : ''}
          </div>

          <div class="tcg-stats-plate">
            ${statPlateHtml}
          </div>

          <p class="tcg-card-desc">${cleanText}</p>

          <div class="tcg-card-footer">
            <div class="tcg-card-loot truncate">${humanLoot || (isCombat ? '💀 Bottino' : '🧭 Inchiesta')}</div>
            <div class="tcg-card-vitals">
              ${isCombat ? `<span class="tcg-pv-badge">❤️ ${currentNode.pv || 20} PV</span>` : `<span class="tcg-gold-badge">🟡 ${currentNode.oro || 0} ORO</span>`}
            </div>
          </div>
        </div>
      `;
    }

    if (!actBox) return;
    actBox.className = "scene-actions-area";

    if (isCombat) {
      if (AppState.activeSession.combatEnemyId !== currentNode.id) {
        AppState.activeSession.combatEnemyId = currentNode.id;
        AppState.activeSession.combatRound = 1;
        if (window.SoundEngine) SoundEngine.playDice();
      }

      const hasBribe = (currentNode.corruption?.canCorrupt && currentNode.corruption.validDrugs?.length > 0);
      const bribeDrug = hasBribe ? currentNode.corruption.validDrugs[0] : null;

      if (hasBribe && bribeDrug) {
        actBox.innerHTML = `
          <div class="actions-grid-3">
            <button onclick="Rules2Engine.combatAction('attack_round')" class="scene-action-btn action-danger font-black">
              ⚔️ Attacca
            </button>
            <button onclick="Rules2Engine.combatAction('flee')" class="scene-action-btn font-bold">
              🏃 Fuggi
            </button>
            <button onclick="Rules2Engine.combatBribe('${Rules2_SafeAttr(bribeDrug.nome)}')" class="scene-action-btn border-amber-400/50 text-amber-300 font-bold" title="${Rules2_SafeAttr(bribeDrug.nome)}">
              💊 Corrompi
            </button>
          </div>
        `;
      } else {
        actBox.innerHTML = `
          <div class="actions-grid-2">
            <button onclick="Rules2Engine.combatAction('attack_round')" class="scene-action-btn action-danger font-black">
              ⚔️ Attacca
            </button>
            <button onclick="Rules2Engine.combatAction('flee')" class="scene-action-btn font-bold">
              🏃 Fuggi
            </button>
          </div>
        `;
      }
      return;
    }

    if (isEvento) {
      const statReq = currentNode.statRichiesta || "DESTREZZA";
      const shortStat = statReq.substring(0, 3).toUpperCase();
      const cdVal = currentNode.difficolta || 11;
      const bypassTool = currentNode.equipLoot || currentNode.requisitoBypass;
      const hasTool = bypassTool && (currentHero?.inventario || []).some(it => it.toLowerCase().includes(bypassTool.toLowerCase()));

      if (hasTool) {
        const humanTool = Rules2_ResolveItemName(bypassTool, AppState.activeSession.shopCatalog);
        actBox.innerHTML = `
          <div class="actions-grid-1">
            <button onclick="Rules2Engine.executeEventRoll('${currentNode.id}', '${statReq}', ${cdVal})" class="scene-action-btn border-emerald-500 text-emerald-300 font-black justify-between">
              <span>Bypassa con ${humanTool} ⚡</span>
              <span>100% Successo ›</span>
            </button>
          </div>
        `;
      } else {
        actBox.innerHTML = `
          <div class="actions-grid-2">
            <button onclick="Rules2Engine.executeEventRoll('${currentNode.id}', '${statReq}', ${cdVal})" class="scene-action-btn border-sky-400 text-sky-300 font-black">
              Tira D20 (${shortStat}) 🎲
            </button>
            <button onclick="Rules2Engine.advanceToNode('${currentNode.destFallback || currentNode.destFallimento}')" class="scene-action-btn font-bold">
              Schiva 🏃
            </button>
          </div>
        `;
      }
      return;
    }

    if (currentNode.quiz && currentNode.quiz.opzioni && currentNode.quiz.opzioni.length > 0) {
      const opz = currentNode.quiz.opzioni;
      const gridClass = (opz.length === 4) ? "actions-grid-quiz" : (opz.length === 2 ? "actions-grid-2" : "actions-grid-1");

      actBox.innerHTML = `
        <div class="${gridClass}">
          ${opz.map(o => `
            <button onclick="Rules2Engine.submitQuizAnswer('${Rules2_SafeAttr(o)}')" class="scene-action-btn font-bold text-xs truncate">
              ${o}
            </button>
          `).join("")}
        </div>
      `;
      return;
    }

    const choices = (currentNode.choices || []).filter(c => c.target);

    if (choices.length === 1) {
      actBox.innerHTML = `
        <div class="actions-grid-1">
          <button onclick="Rules2Engine.advanceToNode('${choices[0].target}')" class="scene-action-btn font-black justify-between">
            <span class="truncate">${choices[0].testo}</span>
            <span>›</span>
          </button>
        </div>
      `;
    } else if (choices.length === 2) {
      actBox.innerHTML = `
        <div class="actions-grid-2">
          ${choices.map(c => `
            <button onclick="Rules2Engine.advanceToNode('${c.target}')" class="scene-action-btn truncate">
              ${c.testo}
            </button>
          `).join("")}
        </div>
      `;
    } else if (choices.length === 3) {
      actBox.innerHTML = `
        <div class="actions-grid-3">
          ${choices.map(c => `
            <button onclick="Rules2Engine.advanceToNode('${c.target}')" class="scene-action-btn truncate" title="${Rules2_SafeAttr(c.testo)}">
              ${c.testo}
            </button>
          `).join("")}
        </div>
      `;
    } else if (choices.length >= 4) {
      actBox.innerHTML = `
        <div class="actions-grid-quiz">
          ${choices.slice(0, 4).map(c => `
            <button onclick="Rules2Engine.advanceToNode('${c.target}')" class="scene-action-btn truncate">
              ${c.testo}
            </button>
          `).join("")}
        </div>
      `;
    } else {
      actBox.innerHTML = `
        <div class="actions-grid-1">
          <button onclick="Rules2Engine.leaveGameToHub()" class="scene-action-btn justify-center font-black">
            Torna alla Libreria 🏠
          </button>
        </div>
      `;
    }
  },

  advanceToNode: async function(targetId) {
    if (!AppState.activeSession.gameKey || this._isBusy) return;
    this._setBusy(true);

    tgHaptic("selection");
    if (window.SoundEngine) SoundEngine.playClick();

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
      console.error("[Rules2Engine] Errore advanceToNode:", e);
      rulesNotify("Errore avanzamento: " + e.message, "error");
    }
  },

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
        s("dice-roll-desc", `Superato grazie all'equipaggiamento!`);
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
                this.showFloatingDamage(`💔 -${log.dmgTaken} PV`, false, true);
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

    actBox.className = "scene-actions-area";
    actBox.innerHTML = `
      <div class="actions-grid-2">
        <button onclick="Rules2Engine.executeResurrectZombie('${deadEnemy ? deadEnemy.id : ''}')" class="scene-action-btn border-purple-400 text-purple-300 font-black">
          Rianima Zombi (-1 PV) 🧟
        </button>
        <button onclick="Rules2Engine.skipNecromancy()" class="scene-action-btn text-slate-300 font-bold">
          Lascia Cadavere ›
        </button>
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
      rulesNotify("Corruzione fallita o droga non compatibile: " + e.message, "error");
    }
  },

  showFloatingDamage: function(text, isCrit, isHeroDmg) {
    let box = document.getElementById("floating-damage-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "floating-damage-box";
      box.className = "floating-damage-layer";
      const gameContainer = document.getElementById("view-gameplay");
      if (gameContainer) gameContainer.appendChild(box);
    }
    if (!box) return;

    const el = document.createElement("div");
    const colorClass = isHeroDmg ? 'text-rose-400' : (isCrit ? 'text-amber-300' : 'text-sky-300');
    el.className = `floating-fx-number ${colorClass}`;
    el.innerHTML = text;

    box.appendChild(el);
    setTimeout(() => el.remove(), 1450);
  },

  inspectCurrentEnemyDetail: function() {
    const enemy = AppState.activeSession.currentNode;
    if (!enemy) return;

    this.inspectEntityDetail({
      id: enemy.id,
      nome: enemy.nome,
      tipo: "NEMICO",
      categoria: enemy.categoria || "Bersaglio",
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

  // 🔒 MODALE FASCICOLO RIFINITA: EMOJI DEDICATE, PREZZO CONTESTUALE E ZERO TASTI DOPPI
  inspectEntityDetail: function(it) {
    if (!it) return;
    const modal = document.getElementById("modal-universal-detail");
    if (!modal) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const h = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    const cat = Rules2_ClassifyEntity(it);
    const categoryEmojis = {
      "ARMI": "🗡️",
      "VEICOLI": "🛴",
      "STRUMENTI": "🔧",
      "INFORMAZIONI": "📁",
      "TALISMANI": "📿",
      "DROGHE": "💊",
      "CURE": "🍱"
    };

    const icon = it.tipo === "NEMICO" ? "👾" : (it.emoji || categoryEmojis[cat] || "📦");
    s("uni-detail-icon", icon);
    s("uni-detail-title", it.nome);
    s("uni-detail-badge", `${(it.tipo || 'EQUIPAGGIAMENTO').toUpperCase()} • ${(it.sottocategoria || it.categoria || 'GENERALE').toUpperCase()}`);

    const bonuses = [];
    if (it.pv) bonuses.push(`❤️ PV: <b>${it.pv}</b>`);
    if (it.danno) bonuses.push(`💥 Danno: <b>${it.danno}</b>`);
    if (it.forza) bonuses.push(`🥊 FOR: <b>${it.forza}</b>`);
    if (it.destrezza) bonuses.push(`🤸 DES: <b>${it.destrezza}</b>`);
    if (it.intelligenza) bonuses.push(`🧠 INT: <b>${it.intelligenza}</b>`);

    // Mostra il listino se sei all'Emporio, altrimenti lo stato di possesso
    if (it.isFromBackpack) {
      bonuses.push(`<span class="text-emerald-400">🎒 In Dotazione</span>`);
    } else if (it.costoOro) {
      bonuses.push(`💰 Prezzo: <b class="text-amber-300">${it.costoOro} 🟡</b>`);
    }

    h("uni-detail-metrics-value", bonuses.join(" • ") || "Nessun parametro");
    s("uni-detail-lore", (it.descrizione || it.testo || "").replace(/\s*\([A-Z]{3,4}_\d{4}_S\d+_E\d+\)/gi, ""));

    const btn = document.getElementById("uni-detail-action-btn");
    if (btn) {
      if (it.isEnemyInspection) {
        btn.textContent = "Attacca ⚔️";
        btn.className = "btn btn-error btn-sm flex-1 font-black uppercase";
        btn.style.display = "block";
        btn.onclick = () => { modal.close(); this.combatAction("attack_round"); };
      } else if (cat === "ARMI") {
        btn.textContent = "Impugna 🗡️";
        btn.className = "btn btn-primary btn-sm flex-1 font-black uppercase";
        btn.style.display = "block";
        btn.onclick = () => { this.equipItem(it.nome, "weapon"); modal.close(); };
      } else if (cat === "VEICOLI") {
        btn.textContent = "Attiva Guida 🛴";
        btn.className = "btn btn-primary btn-sm flex-1 font-black uppercase";
        btn.style.display = "block";
        btn.onclick = () => { this.equipItem(it.nome, "vehicle"); modal.close(); };
      } else if (cat === "DROGHE" || cat === "CURE") {
        btn.textContent = (cat === "DROGHE") ? "Assumi 💊" : "Usa ❤️";
        btn.className = "btn btn-success btn-sm flex-1 font-black uppercase";
        btn.style.display = "block";
        btn.onclick = () => { this.useBackpackItem(it.nome); modal.close(); };
      } else {
        // 🔒 Se l'oggetto non ha azioni dirette, nascondi il tasto inferiore ridondante (c'è già la ✕ in alto)
        btn.style.display = "none";
      }
    }

    if (window.SoundEngine) SoundEngine.playClick();
    modal.showModal();
  },

  openHeroModal: function(tabName = "scheda") {
    this._activeHeroTab = tabName;
    const h = AppState.activeSession?.hero;
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
    const h = AppState.activeSession?.hero;
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
    s("sheet-hero-class", `${h.classe || "Avventuriero"} (${h.schieramentoPolitico || "Neutrale"})`);
    s("sheet-hero-gold", `${h.oro || 0} 🟡`);

    let effFor = Number(h.stats?.FORZA || 10);
    let effDes = Number(h.stats?.DESTREZZA || 10);
    let effInt = Number(h.stats?.INTELLIGENZA || 10);

    if (h.armaAttiva) {
      const armEnt = this._findEntityData(h.armaAttiva);
      if (armEnt?.forza) effFor += Number(armEnt.forza);
    }
    if (h.veicoloAttivo) {
      const vecEnt = this._findEntityData(h.veicoloAttivo);
      if (vecEnt?.destrezza) effDes += Number(vecEnt.destrezza);
    }

    s("sheet-pure-for", effFor);
    s("sheet-pure-des", effDes);
    s("sheet-pure-int", effInt);

    s("sheet-mod-for", rulesFormatMod(effFor));
    s("sheet-mod-des", rulesFormatMod(effDes));
    s("sheet-mod-int", rulesFormatMod(effInt));

    s("sheet-active-weapon", h.armaAttiva ? Rules2_ResolveItemName(h.armaAttiva, AppState.activeSession?.shopCatalog) : "Pugni nudi");
    s("sheet-active-vehicle", h.veicoloAttivo ? Rules2_ResolveItemName(h.veicoloAttivo, AppState.activeSession?.shopCatalog) : "A piedi");

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
    const h = AppState.activeSession?.hero;
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
    const h = AppState.activeSession?.hero;
    if (!c || !h) return;

    const inv = h.inventario || [];
    const infoItems = inv.filter(it => Rules2_ClassifyEntity(this._findEntityData(it)) === "INFORMAZIONI");

    if (infoItems.length === 0) {
      c.innerHTML = `<div class="p-3 text-center text-xs text-slate-500 font-mono">Nessun reperto d'inchiesta raccolto finora.</div>`;
    } else {
      c.innerHTML = infoItems.map(p => {
        const ent = this._findEntityData(p);
        const isPermanent = String(ent?.sottocategoria || "").toLowerCase().includes("prov");
        const humanName = Rules2_ResolveItemName(p, AppState.activeSession?.shopCatalog);
        return `
          <div onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${Rules2_SafeAttr(p)}'), isFromBackpack: true })" class="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between cursor-pointer">
            <div>
              <div class="font-bold text-xs text-white">${humanName}</div>
              <div class="text-[10px] text-slate-400">${isPermanent ? '+1 INT permanente sull\'organigramma' : '+1 INT situazionale'}</div>
            </div>
            <span class="badge badge-xs badge-info font-mono">${ent?.sottocategoria || ent?.categoria || 'Reperto'}</span>
          </div>
        `;
      }).join("");
    }
  },

  openAssettoModal: function() {
    const h = AppState.activeSession?.hero;
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

    const humanWeapon = h.armaAttiva ? Rules2_ResolveItemName(h.armaAttiva, AppState.activeSession?.shopCatalog) : "Pugni nudi";
    const humanVehicle = h.veicoloAttivo ? Rules2_ResolveItemName(h.veicoloAttivo, AppState.activeSession?.shopCatalog) : "A piedi";

    modal.innerHTML = `
      <div class="modal-box p-5 bg-slate-950 border border-purple-500/40 rounded-2xl max-w-md space-y-3 relative">
        <button onclick="document.getElementById('modal-cockpit-assetto').close()" class="modal-close-btn" title="Chiudi">✕</button>
        <div class="flex items-center gap-2 pr-8">
          <span class="text-2xl">🔱</span>
          <h3 class="text-sm font-black text-white uppercase">Assetto Tattico & Sintesi</h3>
        </div>

        <div class="space-y-2 pt-1 text-xs">
          <div class="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between">
            <div><span class="text-slate-400">🗡️ Arma attiva:</span> <b class="text-sky-300 ml-1 font-mono">${humanWeapon}</b></div>
            <button onclick="Rules2Engine.openHeroModal('zaino')" class="btn btn-xs btn-outline border-white/20">Cambia</button>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between">
            <div><span class="text-slate-400">🛴 Veicolo attivo:</span> <b class="text-sky-300 ml-1 font-mono">${humanVehicle}</b></div>
            <button onclick="Rules2Engine.openHeroModal('zaino')" class="btn btn-xs btn-outline border-white/20">Cambia</button>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2 mt-2">
          <div class="text-[10px] font-mono font-bold text-purple-300 uppercase">⚗️ Banco di Sintesi</div>
          ${availableRecipes.length > 0 ? availableRecipes.map(r => `
            <div class="flex items-center justify-between p-2 rounded-lg bg-black/40 text-xs">
              <span>${r.icon} <b>${r.prodName}</b> (${r.turns} turni)</span>
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
    const h = AppState.activeSession?.hero;
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
          rulesNotify(`⚗️ Avviata lavorazione di ${rec.prodName} (pronta tra ${rec.turns} turni).`, "success");
          this.openAssettoModal();
          return;
        }
      }
    }
  },

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
    const h = AppState.activeSession?.hero;

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
        const humanName = Rules2_ResolveItemName(it, AppState.activeSession?.shopCatalog);

        return `
          <div class="p-2.5 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between text-xs">
            <span class="font-bold text-white truncate pr-2">${humanName}</span>
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
    const h = AppState.activeSession?.hero;
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
      const humanName = Rules2_ResolveItemName(it, AppState.activeSession?.shopCatalog);

      return `
        <div class="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between text-xs">
          <div onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${Rules2_SafeAttr(it)}'), isFromBackpack: true })" class="cursor-pointer pr-2 truncate">
            <div class="font-bold text-white truncate">${humanName}</div>
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
    const h = AppState.activeSession?.hero;
    if (!h) return;

    if (type === "weapon") h.armaAttiva = (h.armaAttiva === itemName) ? "" : itemName;
    if (type === "vehicle") h.veicoloAttivo = (h.veicoloAttivo === itemName) ? "" : itemName;

    tgHaptic("selection");
    this.renderNode(AppState.activeSession.currentNode, h);
    rulesNotify(`Assetto aggiornato: ${Rules2_ResolveItemName(itemName, AppState.activeSession?.shopCatalog)}`, "info");

    apiCall("game_action", {
      subAction: "equip",
      item: itemName,
      type: type,
      gameKey: AppState.activeSession.gameKey,
      episodio: AppState.activeSession.episodio
    }).catch(() => {});
  },

  useBackpackItem: function(itemName) {
    const h = AppState.activeSession?.hero;
    if (!h) return;

    const ent = this._findEntityData(itemName);
    const idx = (h.inventario || []).indexOf(itemName);
    if (idx !== -1) {
      h.inventario.splice(idx, 1);
      const humanName = Rules2_ResolveItemName(itemName, AppState.activeSession?.shopCatalog);
      if (ent && ent.pv) {
        h.pv = Math.min(h.pvMax || 25, (h.pv || 0) + ent.pv);
        rulesNotify(`Hai usato ${humanName} (+${ent.pv} PV)!`, "success");
      } else {
        rulesNotify(`Hai assunto ${humanName}!`, "info");
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
