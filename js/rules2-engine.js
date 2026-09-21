// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2-engine.js
// LAYER 3B: COCKPIT GAMEPLAY, COMBATTIMENTO D20 & CASSETTI (DATA-DRIVEN)
// ============================================================================

const RULES2_CATEGORY_MAP = {
  "ARMA": "ARMI",         "ARMI": "ARMI",
  "VEICOLO": "VEICOLI",   "VEICOLI": "VEICOLI",
  "STRUMENTO": "STRUMENTI","STRUMENTI": "STRUMENTI",
  "INFORMAZIONE": "INFORMAZIONI", "INFORMAZIONI": "INFORMAZIONI",
  "TALISMANO": "TALISMANI","TALISMANI": "TALISMANI",
  "DROGA": "DROGHE",       "DROGHE": "DROGHE",
  "INGREDIENTE": "DROGHE", "INGREDIENTI": "DROGHE",
  "CURA": "CURE",          "CURE": "CURE"
};

function getNormalizedCategory(item) {
  if (!item) return "STRUMENTI";
  const raw = String(item.categoria || "").trim().toUpperCase();
  if (RULES2_CATEGORY_MAP[raw]) return RULES2_CATEGORY_MAP[raw];

  const name = String(item.nome || item || "").toLowerCase();
  if (name.includes("coltello") || name.includes("machete") || name.includes("lama") || name.includes("serramanico") || name.includes("fiocina") || name.includes("tubo") || name.includes("gomena") || name.includes("chiodatrice") || name.includes("mazzetta")) return "ARMI";
  if (name.includes("scooter") || name.includes("zodiac") || name.includes("bici") || name.includes("panda") || name.includes("apecar") || name.includes("ciao") || name.includes("canoa") || name.includes("barchino")) return "VEICOLI";
  if (name.includes("ponce") || name.includes("fritto") || name.includes("cecina") || name.includes("focaccia") || name.includes("cee") || name.includes("garze") || name.includes("soffocotto")) return "CURE";
  if (name.includes("danpei") || name.includes("marmolina") || name.includes("spada") || name.includes("rivotril") || name.includes("valium") || name.includes("gnugna") || name.includes("thc") || name.includes("bogotà")) return "DROGHE";
  if (name.includes("dossier") || name.includes("bolla") || name.includes("fattura") || name.includes("schema") || name.includes("registro") || name.includes("pizzino") || name.includes("foto")) return "INFORMAZIONI";
  if (name.includes("bitta") || name.includes("zanna") || name.includes("corno") || name.includes("talismano") || name.includes("feticcio")) return "TALISMANI";

  return "STRUMENTI";
}

function formatHumanEffect(rawEffect) {
  if (!rawEffect || rawEffect === "—" || rawEffect === "-") return "Nessuna proprietà speciale.";
  const tags = String(rawEffect).split(/[,|]/);
  const out = [];

  for (let t of tags) {
    const tag = t.trim();
    if (!tag || tag === "—") continue;

    if (tag === "TASTO:ZOMBI_ABILITA") out.push("🧟 <b>Necromanzia:</b> Costa 1 PV per rianimare un nemico caduto come Zombi (Danno x2).");
    else if (tag === "TASTO:ZOMBI_DROGA") out.push("🧟 <b>Risveglio Chimico:</b> Consuma 1 dose di droga idonea per rianimare uno Zombi.");
    else if (tag === "CLASSE:Destra") out.push("⚖️ <b>Orientamento Destra:</b> +1 Danno fisso vs fazioni Mazzu e Ideologi.");
    else if (tag === "CLASSE:Sinistra") out.push("⚖️ <b>Orientamento Sinistra:</b> +1 Danno fisso vs fazioni Camorristi e Burocrati.");
    else if (tag === "CLASSE:Tutti") out.push("⚖️ <b>Tratto Comune:</b> Accessibile a tutti gli schieramenti.");
    else if (tag === "PASSIVO:STAT_FORTUNA_1") out.push("🍀 <b>Buona Sorte:</b> +1 costante a tutti i tiri D20 ed Eventi.");
    else if (tag === "VULN:Mischia") out.push("💥 <b>Vulnerabile alla Mischia:</b> Subisce +2 danni da colpi ravvicinati.");
    else if (tag === "VULN:Distanza") out.push("🏹 <b>Vulnerabile a Distanza:</b> Subisce +2 danni da proiettili o petardi.");
    else if (tag.startsWith("PASSIVO:STAT_FOR_")) out.push(`🥊 <b>Forza Rinforzata:</b> +${tag.replace("PASSIVO:STAT_FOR_", "")} permanente.`);
    else if (tag.startsWith("PASSIVO:STAT_DES_")) out.push(`🤸 <b>Destrezza Agile:</b> +${tag.replace("PASSIVO:STAT_DES_", "")} permanente.`);
    else if (tag.startsWith("PASSIVO:STAT_INT_")) out.push(`🧠 <b>Intuito Fine:</b> +${tag.replace("PASSIVO:STAT_INT_", "")} permanente.`);
    else if (tag.startsWith("PASSIVO:INT_VS_")) out.push(`📂 <b>Dossier Mirato:</b> +1 INT situazionale contro la fazione ${tag.replace("PASSIVO:INT_VS_", "")}.`);
    else if (tag === "PASSIVO:PROVE" || tag === "PASSIVO:DOSSIER") out.push("📁 <b>Organigramma del Potere:</b> +1 INT permanente sull'inchiesta.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0026_S1_E0") out.push("🛡️ <b>Scudo Ricatto:</b> Riduce di 2 punti tutti i danni fisici subiti.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0017_S1_E0") out.push("🧰 <b>Scasso Industriale:</b> Sfonda porte e casseforti al 100%.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0020_S1_E0") out.push("📟 <b>Hacker Demaniale:</b> Bypassa cancelli e varchi elettronici al 100%.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0022_S1_E0") out.push("📡 <b>Schermatura Radio:</b> Blocca le chiamate di rinforzo nemiche al 100%.");
    else out.push(`⚡ <b>Proprietà:</b> ${tag.replace(/_/g, " ")}`);
  }

  return out.join("<br>");
}

const Rules2Engine = {
  // --------------------------------------------------------------------------
  // 1. LIFECYCLE HOOKS: AVVIO SESSIONE & COMUNICAZIONE WIZARD
  // --------------------------------------------------------------------------
  launchSession: function(gameKey, epNum, canContinueFree, savedHero) {
    const wizard = (typeof Rules2Wizard !== "undefined") ? Rules2Wizard : (window.Rules2Wizard || null);
    if (wizard && typeof wizard.open === "function") {
      wizard.open(gameKey, epNum, canContinueFree, savedHero);
    } else {
      console.error("[Rules2Engine] Modulo rules2-wizard.js non trovato o non inizializzato.");
      alert("Errore: interfaccia di creazione personaggio non disponibile.");
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
        const wizardCatalog = (typeof Rules2Wizard !== "undefined" && (Rules2Wizard.state.shopCatalog || Rules2Wizard.state.emporioCatalog))
          ? (Rules2Wizard.state.shopCatalog || Rules2Wizard.state.emporioCatalog)
          : [];

        const allGameItems = deduplicateEntities([
          ...(res.emporioItems || []),
          ...(res.equipaggiamenti || []),
          ...(res.shopItems || []),
          ...(res.oggetti || []),
          ...wizardCatalog
        ]);

        AppState.activeSession.engineKey = "Rules2";
        AppState.activeSession.gameKey = payloadParams.gameKey;
        AppState.activeSession.episodio = payloadParams.episodio;
        AppState.activeSession.partitaId = res.partitaId;
        AppState.activeSession.hero = res.statoEroe;
        AppState.activeSession.currentNode = res.nodoIniziale;
        AppState.activeSession.shopCatalog = allGameItems;
        AppState.activeSession.combatRound = 1;
        AppState.activeSession.combatEnemyId = null;
        AppState.activeSession.engineState = {
          pendingVictory: null,
          backpackFilter: "ALL",
          emporioMode: "buy"
        };

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

    const saga = AppState.games.catalog.find(g => g.gameKey === AppState.activeSession.gameKey);
    s("game-header-series", (saga ? saga.serie : "AVVENTURA NOIR").toUpperCase());
    s("game-header-episode", `Episodio ${AppState.activeSession.episodio}`);

    // Aggiornamento HUD Eroe con spaziature pulite (niente testi incollati)
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

    const img = document.getElementById("scene-image");
    if (img) {
      img.src = currentNode.mediaUrl || "https://image.pollinations.ai/prompt/noir-docks-night-cinematic?width=800&height=450&nologo=true";
    }

    s("scene-type-badge", currentNode.tipo || "SNODO");
    s("scene-title", currentNode.nome || "Avventura");

    // Pulizia rigorosa del testo narrativo (rimuove codici ID grezzi tipo OBJ_0002_S1_E1)
    let cleanText = currentNode.testo || "";
    cleanText = cleanText.replace(/\s*\([A-Z]{3,4}_\d{4}_S\d+_E\d+\)/gi, "");
    s("scene-text", cleanText);

    const wBanner = document.getElementById("scene-watermark-banner");
    if (currentNode.citazione && currentNode.citazione !== "—" && currentNode.citazione !== "-") {
      s("scene-quote", `“${currentNode.citazione.replace(/^["'“”]+|["'“”]+$/g, "")}”`);
      s("scene-author", currentNode.autoreCitazione || "");
      if (wBanner) wBanner.classList.remove("hidden");
    } else {
      if (wBanner) wBanner.classList.add("hidden");
    }

    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    const isCombat = (currentNode.tipo === "NEMICO" || (currentNode.id && currentNode.id.includes("NEM_")));
    const isEvento = (currentNode.tipo === "EVENTO" || (currentNode.id && currentNode.id.includes("EVT_")));

    // ------------------------------------------------------------------------
    // CASO 1: COMBATTIMENTO D20 (ROUND NUMERATI & SCHEDA NEMICO)
    // ------------------------------------------------------------------------
    if (isCombat) {
      if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("combat");

      // Inizializza contatore round sul nemico corrente
      if (AppState.activeSession.combatEnemyId !== currentNode.id) {
        AppState.activeSession.combatEnemyId = currentNode.id;
        AppState.activeSession.combatRound = 1;
      }
      const curRound = AppState.activeSession.combatRound || 1;

      let bribeHtml = "";
      if (currentNode.corruption && currentNode.corruption.canCorrupt && currentNode.corruption.validDrugs.length > 0) {
        bribeHtml = currentNode.corruption.validDrugs.map(d => `
          <button onclick="Rules2Engine.combatBribe('${d.nome.replace(/'/g, "\\'")}')" class="btn btn-sm btn-block btn-warning font-bold text-xs h-11 shadow-md">
            💊 Cedi ${d.nome} ${d.costoDosi === 0 ? '(0 dosi • Maestro)' : ''}
          </button>
        `).join("");
      }

      actBox.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <button onclick="Rules2Engine.combatAction('attack_round')" class="btn btn-sm btn-error font-black text-xs h-11 shadow-lg shadow-rose-600/30">
            ⚔️ Attacca • Round ${curRound}
          </button>
          <button onclick="Rules2Engine.combatAction('flee')" class="btn btn-sm btn-outline border-white/20 text-xs font-bold h-11">
            🏃 Fuggi
          </button>
        </div>
        ${bribeHtml}
        <div class="pt-0.5">
          <button onclick="Rules2Engine.inspectCurrentEnemyDetail()" class="btn btn-xs btn-block btn-ghost border border-white/10 text-slate-300 font-bold text-[10px]">
            🔍 Fascicolo Tattico Nemico (Debolezze & Stat)
          </button>
        </div>
      `;
      return;
    }

    // ------------------------------------------------------------------------
    // CASO 2: EVENTO / TRAPPOLA D20 (CON DADO SUSPENSE)
    // ------------------------------------------------------------------------
    if (isEvento) {
      const statReq = currentNode.statRichiesta || "DESTREZZA";
      const cdVal = currentNode.difficolta || 11;
      const bypassTool = currentNode.equipLoot || currentNode.requisitoBypass;

      // Verifica se l'eroe possiede lo strumento di bypass
      const hasTool = bypassTool && (currentHero?.inventario || []).some(it => it.toLowerCase().includes(bypassTool.toLowerCase()));

      if (hasTool) {
        actBox.innerHTML = `
          <div class="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-center space-y-1.5 mb-1">
            <div class="text-[10px] font-bold text-emerald-300">🛡️ Vantaggio Tattico: possiedi ${bypassTool}!</div>
          </div>
          <button onclick="Rules2Engine.advanceToNode('${currentNode.destSuccesso}')" class="btn btn-sm btn-block btn-success font-black text-xs h-11 shadow-lg shadow-emerald-600/30">
            ⚡ Oltrepassa Senza Danni (${bypassTool})
          </button>
        `;
      } else {
        actBox.innerHTML = `
          <div class="grid grid-cols-2 gap-2">
            <button onclick="Rules2Engine.executeEventRoll('${currentNode.id}', '${statReq}', ${cdVal})" class="btn btn-sm btn-primary font-black text-xs h-11 shadow-lg shadow-sky-600/30">
              🎲 Prova ${statReq} (CD ${cdVal})
            </button>
            <button onclick="Rules2Engine.advanceToNode('${currentNode.destFallback || currentNode.destFallimento}')" class="btn btn-sm btn-outline border-white/20 text-xs font-bold h-11">
              🏃 Arretra / Evita
            </button>
          </div>
        `;
      }
      return;
    }

    // ------------------------------------------------------------------------
    // CASO 3: ENIGMA / QUIZ D'ARCHIVIO
    // ------------------------------------------------------------------------
    if (currentNode.quiz) {
      actBox.innerHTML = `
        <div class="p-2.5 rounded-2xl bg-black/60 border border-white/10 space-y-2 text-xs">
          <div class="font-bold text-amber-300 flex items-center space-x-1.5">
            <span>🔐</span> <span>${currentNode.quiz.domanda}</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 pt-1">
            ${currentNode.quiz.opzioni.map(opz => `
              <button onclick="Rules2Engine.submitQuizAnswer('${opz.replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline border-white/20 text-[11px] truncate h-10">
                ${opz}
              </button>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    // ------------------------------------------------------------------------
    // CASO 4: BIVIO NARRATIVO STANDARD (SCELTE DI PERCORSO)
    // ------------------------------------------------------------------------
    const rawChoices = currentNode.choices || currentNode.parsedBivio || [];
    const choices = rawChoices.map(c => ({
      testo: c.testo || c.text || c.nome || "Avanza",
      target: c.target || c.id || c.nodo || ""
    })).filter(c => c.target !== "");

    if (choices.length > 0) {
      if (choices.length === 2) {
        actBox.innerHTML = `
          <div class="grid grid-cols-2 gap-2">
            <button onclick="Rules2Engine.advanceToNode('${choices[0].target}')" class="btn btn-sm btn-primary text-xs font-bold truncate h-11 shadow-md">
              ${choices[0].testo}
            </button>
            <button onclick="Rules2Engine.advanceToNode('${choices[1].target}')" class="btn btn-sm btn-primary text-xs font-bold truncate h-11 shadow-md">
              ${choices[1].testo}
            </button>
          </div>
        `;
      } else {
        actBox.innerHTML = choices.map(c => `
          <button onclick="Rules2Engine.advanceToNode('${c.target}')" class="btn btn-sm btn-block btn-primary text-xs font-bold mb-1.5 truncate h-11 shadow-md">
            ${c.testo}
          </button>
        `).join("");
      }
    } else {
      actBox.innerHTML = `
        <button onclick="Rules2Engine.leaveGameToHub()" class="btn btn-sm btn-block btn-outline border-white/20 text-xs font-bold h-11">
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
  // 3. ANIMATORE DADO D20 UNIVERSALE (SUSPENSE MODAL PER OGNI PROVA)
  // --------------------------------------------------------------------------
  showDiceRollSuspense: function(title, desc, durationMs, onComplete) {
    const diceModal = document.getElementById("modal-dice-suspense");
    const diceCube = document.getElementById("dice-visual-cube");
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    s("dice-roll-title", title || "Lancio D20 in corso...");
    s("dice-roll-result", "--");
    s("dice-roll-desc", desc || "Il fato decide il tuo destino...");

    if (diceCube) diceCube.classList.add("dice-rolling");
    if (diceModal) diceModal.showModal();
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("dice");

    setTimeout(() => {
      if (diceCube) diceCube.classList.remove("dice-rolling");
      if (typeof onComplete === "function") {
        onComplete(diceModal, s);
      } else {
        if (diceModal) diceModal.close();
      }
    }, durationMs || 700);
  },

  // Esecuzione Tiro Salvezza su Eventi/Trappole
  executeEventRoll: async function(nodeId, statName, cdVal) {
    const hero = AppState.activeSession.hero;
    const statMod = hero?.modificatori ? (hero.modificatori[statName] || 0) : 0;
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + statMod;
    const isSuccess = (d20 === 20) || (d20 !== 1 && total >= cdVal);

    this.showDiceRollSuspense(`Prova ${statName} vs CD ${cdVal}`, `Tiro D20 (${d20}) ${statMod >= 0 ? '+' : ''}${statMod} = ${total}`, 750, (modal, s) => {
      s("dice-roll-result", `${total} • ${isSuccess ? 'SUPERATO!' : 'FALLITO!'}`);
      s("dice-roll-desc", isSuccess ? 'Ostacolo evitato con successo!' : 'Subisci danni dall\'imprevisto!');

      setTimeout(() => {
        modal.close();
        const node = AppState.activeSession.currentNode;
        if (isSuccess) {
          this.showFloatingDamage("✅ Prova Superata!", false, false);
          this.advanceToNode(node.destSuccesso);
        } else {
          this.showFloatingDamage("❌ Fallimento!", false, true);
          this.advanceToNode(node.destFallback || node.destFallimento);
        }
      }, 650);
    });
  },

  // Esecuzione Round Combattimento (Sempre garantita la chiusura della modale!)
  combatAction: async function(subAction) {
    if (!AppState.activeSession.gameKey) return;

    const diceModal = document.getElementById("modal-dice-suspense");
    const diceCube = document.getElementById("dice-visual-cube");
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    const curRound = AppState.activeSession.combatRound || 1;

    if (subAction === "attack_round") {
      s("dice-roll-title", `Lancio D20 • Round ${curRound}`);
      s("dice-roll-result", "--");
      s("dice-roll-desc", "Tiro di attacco sommato ai modificatori...");
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

      // GARANTISCE LA CHIUSURA DELLA MODALE IN QUALSIASI ESITO
      if (subAction === "attack_round") {
        const log = res.combatLog;
        if (diceCube) diceCube.classList.remove("dice-rolling");

        if (log) {
          s("dice-roll-result", `D20 (${log.d20Hero}) = ${log.totHero} vs CD ${log.cdTarget}`);
          s("dice-roll-desc", log.isHit ? (log.isCrit ? "CRITICO! Colpo devastante!" : `COLPITO! -${log.dmgDealt} PV`) : "A VUOTO!");
        } else {
          s("dice-roll-result", res.status === "VICTORY" ? "VITTORIA!" : "FINE SCONTRO");
        }

        setTimeout(() => {
          if (diceModal) diceModal.close(); // Chiusura blindata

          if (log) {
            if (log.isHit) {
              this.showFloatingDamage(`💥 -${log.dmgDealt} PV`, log.isCrit, false);
              if (typeof SoundEngine !== "undefined") SoundEngine.playSfx(log.isCrit ? "crit_hit" : "hit");
            } else {
              this.showFloatingDamage("💨 A vuoto", false, false);
            }
            if (log.dmgTaken > 0) {
              setTimeout(() => {
                this.showFloatingDamage(`💔 -${log.dmgTaken} PV Squadra`, false, true);
              }, 250);
            }
          }

          // Gestione Vittoria
          if (res.status === "VICTORY") {
            AppState.activeSession.combatRound = 1;
            AppState.activeSession.combatEnemyId = null;

            if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("victory");
            if (window.confetti) confetti({ particleCount: 75, spread: 60 });

            const hero = AppState.activeSession.hero;
            const hasNecroAbl = (hero && hero.abilita && hero.abilita.includes("Necromanzia") && hero.pv > 1);
            AppState.activeSession.engineState.pendingVictory = res.nextView;

            if (hasNecroAbl && !res.victoryData?.chainInfected) {
              this.renderNecromancyPrompt(res.victoryData.enemy);
            } else {
              this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
            }
          }
          // Gestione Sconfitta
          else if (res.status === "DEFEAT") {
            AppState.activeSession.combatRound = 1;
            AppState.activeSession.combatEnemyId = null;

            if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("defeat");
            this.renderNode(res.nextView.nodo, res.nextView.statoEroe);
          }
          // Avanzamento al Round Successivo
          else {
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
      if (diceModal) diceModal.close(); // Chiusura di emergenza su errore
      console.error("[Rules2Engine] Errore combatAction:", e);
      alert("Errore durante l'azione di combattimento: " + e.message);
    }
  },

  renderNecromancyPrompt: function(deadEnemy) {
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    actBox.innerHTML = `
      <div class="p-2.5 rounded-2xl bg-purple-950/85 border border-purple-500/50 text-center space-y-2 text-xs shadow-xl">
        <div class="font-black text-purple-300">🧟 RIANIMAZIONE ZOMBI DISPONIBILE</div>
        <div class="text-[10px] text-slate-300">Il corpo di <b>${deadEnemy ? deadEnemy.nome : 'questo nemico'}</b> giace a terra. Puoi rianimarlo come Zombi al tuo comando (Danno x2).</div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button onclick="Rules2Engine.executeResurrectZombie('${deadEnemy ? deadEnemy.id : ''}')" class="btn btn-sm btn-secondary font-bold h-10">
            🧟 Rianima (1 PV)
          </button>
          <button onclick="Rules2Engine.skipNecromancy()" class="btn btn-sm btn-outline border-white/20 text-slate-300 h-10">
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
        if (AppState.activeSession.engineState?.pendingVictory) {
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
    const isCorrect = (selectedOpz.trim().toLowerCase() === node.quiz.rispostaCorretta?.trim().toLowerCase() || selectedOpz.trim().toLowerCase() === node.quiz.rispostaEsatta?.trim().toLowerCase());
    if (isCorrect) {
      this.showFloatingDamage("✅ Risposta Esatta!", false, false);
      this.advanceToNode(node.destSuccesso);
    } else {
      this.showFloatingDamage("❌ Risposta Errata!", false, true);
      this.advanceToNode(node.destFallimento);
    }
  },

  // --------------------------------------------------------------------------
  // 4. DEEP INSPECTION UNIVERSALE & I 5 CASSETTI
  // --------------------------------------------------------------------------

  // Ispezione Nemico in combattimento (Senza consumare round)
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

  // Scheda Dossier Universale Polimorfica
  inspectEntityDetail: function(it) {
    if (!it) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const h = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    s("uni-detail-icon", it.emoji || (it.tipo === "NEMICO" ? "👾" : "📦"));
    s("uni-detail-title", it.nome);
    s("uni-detail-badge", `${(it.tipo || 'EQUIPAGGIAMENTO').toUpperCase()} • ${(it.categoria || 'GENERALE').toUpperCase()} • ${(it.sottocategoria || '').toUpperCase()}`);
    s("uni-detail-metrics-label", it.tipo === "NEMICO" ? "PARAMETRI BELLICI & SFIDA" : "PROPRIETÀ & STATISTICHE");

    const bonuses = [];
    if (it.pv) bonuses.push(`❤️ PV: <b>${it.pv}</b>`);
    if (it.danno) bonuses.push(`💥 Danno: <b>${it.danno}</b>`);
    if (it.forza) bonuses.push(`🥊 FOR: <b>${it.forza}</b>`);
    if (it.destrezza) bonuses.push(`🤸 DES: <b>${it.destrezza}</b>`);
    if (it.intelligenza) bonuses.push(`🧠 INT: <b>${it.intelligenza}</b>`);
    if (it.difficolta) bonuses.push(`🎯 Sfida: <b>${it.statRichiesta || 'FORZA'} (CD ${it.difficolta})</b>`);
    if (it.costoOro) bonuses.push(`💰 Prezzo: <b class="text-amber-300">${it.costoOro} 🟡</b>`);

    let humanProps = formatHumanEffect(it.requisitiCodificati || it.effettoCodificato || it.debolezze || "");
    h("uni-detail-metrics-value", bonuses.join(" • ") + (humanProps ? "<br>" + humanProps : ""));

    let cleanLore = it.descrizione || it.testo || "Nessun fascicolo allegato.";
    cleanLore = cleanLore.replace(/\s*\([A-Z]{3,4}_\d{4}_S\d+_E\d+\)/gi, "");
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

    const btn = document.getElementById("uni-detail-action-btn");
    if (btn) {
      if (it.isEnemyInspection) {
        btn.textContent = "⚔️ Torna al Duello";
        btn.className = "btn btn-primary btn-sm w-full font-bold shadow-lg shadow-sky-600/30";
        btn.onclick = () => document.getElementById("modal-universal-detail")?.close();
      } else if (it.isFromBackpack) {
        const cat = getNormalizedCategory(it);
        const isArma = cat === "ARMI";
        const isVeicolo = cat === "VEICOLI";
        const isConsumabile = (cat === "CURE" || cat === "DROGHE");

        if (isConsumabile) {
          btn.textContent = (cat === "DROGHE") ? "💊 Assumi Sostanza" : "❤️ Usa Cura";
          btn.className = "btn btn-success btn-sm w-full font-bold";
          btn.onclick = () => {
            Rules2Engine.useBackpackItem(it.nome);
            document.getElementById("modal-universal-detail")?.close();
          };
        } else if (isArma) {
          btn.textContent = "🗡️ Impugna come Arma";
          btn.className = "btn btn-primary btn-sm w-full font-bold";
          btn.onclick = () => {
            Rules2Engine.equipItem(it.nome, "weapon");
            document.getElementById("modal-universal-detail")?.close();
          };
        } else if (isVeicolo) {
          btn.textContent = "🛴 Attiva come Veicolo";
          btn.className = "btn btn-primary btn-sm w-full font-bold";
          btn.onclick = () => {
            Rules2Engine.equipItem(it.nome, "vehicle");
            document.getElementById("modal-universal-detail")?.close();
          };
        } else {
          btn.textContent = "Chiudi Fascicolo";
          btn.className = "btn btn-ghost btn-sm w-full text-slate-400";
          btn.onclick = () => document.getElementById("modal-universal-detail")?.close();
        }
      } else {
        btn.textContent = "Chiudi Fascicolo";
        btn.className = "btn btn-ghost btn-sm w-full text-slate-400";
        btn.onclick = () => document.getElementById("modal-universal-detail")?.close();
      }
    }

    document.getElementById("modal-universal-detail")?.showModal();
  },

  // A. ZAINO DELL'EROE
  openBackpackDrawer: function() {
    this.filterBackpack(AppState.activeSession.engineState?.backpackFilter || "ALL");
    document.getElementById("drawer-backpack")?.showModal();
  },

  _findEntityData: function(itemName) {
    if (!itemName) return null;
    const catalog = AppState.activeSession.shopCatalog || [];
    const clean = String(itemName).trim().toLowerCase();
    const found = catalog.find(x => String(x.nome || "").trim().toLowerCase() === clean || String(x.id || "").trim().toLowerCase() === clean);
    if (found) return found;

    return { nome: itemName, categoria: getNormalizedCategory(itemName) };
  },

  filterBackpack: function(cat) {
    if (!AppState.activeSession.engineState) AppState.activeSession.engineState = {};
    AppState.activeSession.engineState.backpackFilter = cat || "ALL";

    const tabsContainer = document.getElementById("backpack-tabs");
    if (tabsContainer) {
      tabsContainer.querySelectorAll("button").forEach(btn => {
        const btnText = btn.textContent.toUpperCase();
        const isMatch = (cat === "ALL" && btnText.includes("TUTTI")) || btnText.includes(cat);
        btn.className = `rpg-category-chip badge ${isMatch ? 'badge-info font-black shadow' : 'badge-ghost'} font-bold cursor-pointer transition-all`;
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
      inv = inv.filter(itemName => {
        const ent = this._findEntityData(itemName);
        return getNormalizedCategory(ent) === cat;
      });
      if (inv.length === 0) {
        c.innerHTML = `<div class="col-span-full py-6 text-center text-slate-500 text-xs">Nessun articolo per il reparto <b>${cat}</b> nello zaino.</div>`;
        return;
      }
    }

    c.innerHTML = inv.map(it => {
      const isArma = (h.armaAttiva && it.toLowerCase() === h.armaAttiva.toLowerCase());
      const isVeicolo = (h.veicoloAttivo && it.toLowerCase() === h.veicoloAttivo.toLowerCase());
      const ent = this._findEntityData(it);
      const category = getNormalizedCategory(ent);

      return `
        <div class="p-3 bg-surface rounded-2xl border border-white/5 flex items-center justify-between text-xs shadow-md">
          <div onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${it.replace(/'/g, "\\'")}'), isFromBackpack: true })" class="overflow-hidden pr-2 cursor-pointer group flex-1">
            <div class="font-bold text-white truncate group-hover:text-sky-400 transition-colors">${it}</div>
            <div class="text-[9px] ${isArma || isVeicolo ? 'text-emerald-400 font-bold' : 'text-slate-400'}">
              ${isArma ? '🗡️ [ARMA IN PUGNO]' : (isVeicolo ? '🛴 [VEICOLO IN USO]' : category)} • Tocca per dettagli
            </div>
          </div>
          <button onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${it.replace(/'/g, "\\'")}'), isFromBackpack: true })" class="btn btn-xs btn-outline border-white/20 text-slate-300 text-[9.5px] shrink-0 font-bold">
            Fascicolo ›
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
      alert("Impossibile equipaggiare: " + e.message);
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

  // B. CASSETTO EMPORIO DI CICCIO RPG (COMPRA DAL TAB DI GIOCO & VENDI AL 25%)
  openEmporioDrawer: function() {
    const h = AppState.activeSession.hero;
    const goldDisp = document.getElementById("emporio-gold-display");
    if (goldDisp) goldDisp.textContent = `${h ? h.oro : 0} 🟡`;
    this.setEmporioMode(AppState.activeSession.engineState?.emporioMode || "buy");
    document.getElementById("drawer-emporio")?.showModal();
  },

  setEmporioMode: function(mode) {
    if (!AppState.activeSession.engineState) AppState.activeSession.engineState = {};
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
        container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">Nessuna refurtiva nello zaino.</div>`;
        return;
      }
      container.innerHTML = inv.map(it => {
        const ent = this._findEntityData(it);
        const buyPrice = Math.abs(cleanNumber(ent?.costoOro || ent?.costo, 10));
        const sellPrice = Math.max(1, Math.ceil(buyPrice * 0.25));

        return `
          <div class="p-2.5 bg-surface rounded-xl border border-white/5 flex items-center justify-between text-xs">
            <span class="font-bold text-white truncate pr-2">${it}</span>
            <button onclick="Rules2Engine.sellToEmporio('${it.replace(/'/g, "\\'")}', ${sellPrice})" class="btn btn-xs btn-warning font-bold text-[9px] shrink-0">
              Vendi (+${sellPrice} 🟡)
            </button>
          </div>
        `;
      }).join("");
    } else {
      const emporioItems = AppState.activeSession.shopCatalog || [];

      if (emporioItems.length === 0) {
        container.innerHTML = `<div class="col-span-full py-6 text-center text-slate-500 text-xs">Nessun equipaggiamento disponibile sui banchi di Ciccio.</div>`;
        return;
      }

      container.innerHTML = emporioItems.map(item => {
        const price = Math.abs(cleanNumber(item.costoOro || item.costo, 10));
        const canAfford = (h && h.oro >= price);

        return `
          <div class="p-2.5 bg-surface rounded-2xl border border-white/5 flex flex-col justify-between text-xs space-y-2 shadow-md group">
            <div onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${item.nome.replace(/'/g, "\\'")}'))" class="cursor-pointer space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-lg">${item.emoji || '📦'}</span>
                <span class="text-[10px] text-amber-300 font-mono font-bold">${price} 🟡</span>
              </div>
              <div class="font-bold text-white truncate mt-1 group-hover:text-sky-400 transition-colors">${item.nome}</div>
              <div class="text-[10px] text-slate-400 line-clamp-1">${item.testo || item.descrizione || ''}</div>
            </div>
            <div class="grid grid-cols-2 gap-1.5 pt-1">
              <button onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${item.nome.replace(/'/g, "\\'")}'))" class="btn btn-xs btn-outline border-white/10 text-slate-300 text-[9px]">
                Dettagli
              </button>
              <button onclick="Rules2Engine.buyFromEmporio('${item.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'} font-bold text-[9px]" ${!canAfford ? 'disabled' : ''}>
                ${canAfford ? 'Compra' : 'Oro Insuff.'}
              </button>
            </div>
          </div>
        `;
      }).join("");
    }
  },

  buyFromEmporio: async function(itemId, goldCost) {
    const hero = AppState.activeSession.hero;
    if (!hero || hero.oro < goldCost) {
      alert("Monete d'oro insufficienti!");
      return;
    }
    const item = (AppState.activeSession.shopCatalog || []).find(i => i.id === itemId);
    if (!item) return;

    if (getNormalizedCategory(item) === "VEICOLI") {
      const hasVehicle = (hero.inventario || []).some(x => getNormalizedCategory(this._findEntityData(x)) === "VEICOLI");
      if (hasVehicle) {
        alert("Puoi possedere un solo Veicolo nello zaino!");
        return;
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

      if (res && res.statoEroe) {
        AppState.activeSession.hero = res.statoEroe;
        Wallet.setGold(res.statoEroe.oro);
      } else {
        hero.oro -= goldCost;
        hero.inventario.push(item.nome);
        Wallet.setGold(hero.oro);
      }

      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
      this.openEmporioDrawer();
      this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
    } catch (e) {
      alert("Errore nell'acquisto: " + e.message);
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

      if (res && res.statoEroe) {
        AppState.activeSession.hero = res.statoEroe;
        Wallet.setGold(res.statoEroe.oro);
      } else {
        const hero = AppState.activeSession.hero;
        if (hero) {
          const idx = (hero.inventario || []).indexOf(itemName);
          if (idx !== -1) hero.inventario.splice(idx, 1);
          hero.oro += (fallbackGain || 10);
          if (hero.armaAttiva === itemName) hero.armaAttiva = "";
          if (hero.veicoloAttivo === itemName) hero.veicoloAttivo = "";
          Wallet.setGold(hero.oro);
        }
      }

      if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
      this.openEmporioDrawer();
      this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
    } catch (e) {
      alert("Errore nella vendita: " + e.message);
    }
  },

  // C. BANCO DI CAMBIO VALUTA (MEGOIN ➔ ORO)
  openCambioModal: function() {
    const balEl = document.getElementById("cambio-megoin-balance");
    if (balEl) balEl.textContent = Wallet.getMegoin();
    document.getElementById("modal-banco-cambio")?.showModal();
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

        if (typeof Rules2Wizard !== "undefined" && Rules2Wizard.state.currentGold !== undefined) {
          Rules2Wizard.state.currentGold += goldEarned;
          const wizGoldDisp = document.getElementById("wizard-shop-gold-display");
          if (wizGoldDisp) wizGoldDisp.textContent = `💰 ${Rules2Wizard.state.currentGold} 🟡`;
        }

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
      html = `<div class="py-6 text-center text-slate-500 text-xs">Sei in solitaria. Nessun alleato presente.</div>`;
    } else {
      html += comp.map(a => {
        const d = compData[a] || {};
        const hpText = d.pv ? ` (❤️ ${d.pv}/${d.pvMax || 15} PV)` : "";
        return `<div class="p-3 bg-surface rounded-2xl border border-white/5 font-bold text-xs flex justify-between items-center shadow-md"><span>🤝 ${a}${hpText}</span> <span class="text-emerald-400 font-bold text-[10px]">Alleato Umano</span></div>`;
      }).join("");
      html += zombies.map(z => `
        <div class="p-3 bg-surface rounded-2xl border border-rose-500/30 font-bold text-xs flex justify-between items-center shadow-md">
          <span>🧟 ${z.nome}</span> <span class="text-rose-400 font-bold text-[10px]">Danno x2 (❤️ ${z.pv}/${z.pvMax || 15})</span>
        </div>
      `).join("");
    }

    c.innerHTML = html;
    document.getElementById("drawer-squad")?.showModal();
  },

  // E. DOSSIER & ORGANIGRAMMA DEL POTERE (6 FAZIONI)
  openDossierDrawer: function() {
    const c = document.getElementById("dossier-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    const inv = h.inventario || [];
    const infoItems = inv.filter(it => {
      const ent = this._findEntityData(it);
      return getNormalizedCategory(ent) === "INFORMAZIONI";
    });

    if (infoItems.length === 0) {
      c.innerHTML = `<div class="py-6 text-center text-slate-500 text-xs">Nessun reperto d'inchiesta raccolto finora.</div>`;
    } else {
      c.innerHTML = infoItems.map(p => {
        const ent = this._findEntityData(p);
        const sub = String(ent?.sottocategoria || "").toLowerCase();
        const isPermanent = (sub === "prove" || sub === "prova");

        return `
          <div onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${p.replace(/'/g, "\\'")}'))" class="p-3 bg-surface rounded-2xl border border-sky-500/30 text-xs space-y-1 cursor-pointer hover:bg-surface/80 transition-colors shadow-md">
            <div class="flex items-center justify-between">
              <span class="font-bold text-sky-400">📁 ${p}</span>
              <span class="badge badge-xs badge-info font-mono text-[8px]">${ent?.categoria || 'Reperto'}</span>
            </div>
            <div class="text-[10.5px] text-slate-300">
              ${isPermanent ? 'Reperto dell\'Organigramma: <b class="text-emerald-400">+1 INT permanente</b>' : `Reperto d'inchiesta: <b class="text-amber-300">+1 INT situazionale</b>`}
            </div>
          </div>
        `;
      }).join("");
    }

    document.getElementById("drawer-dossier")?.showModal();
  },

  // --------------------------------------------------------------------------
  // 5. CONTROLLO ABBANDONO & USCITA ALL'HUB
  // --------------------------------------------------------------------------
  openAbandonModal: function() {
    document.getElementById("modal-abandon")?.showModal();
  },

  confirmAbandon: function() {
    document.getElementById("modal-abandon")?.close();
    AppState.activeSession.partitaId = null;
    AppState.activeSession.hero = null;
    AppState.activeSession.currentNode = null;
    AppState.activeSession.engineState = null;
    this.leaveGameToHub();
  },

  leaveGameToHub: function() {
    AppRouter.navigate("games");
  }
};

// ============================================================================
// ESPOSIZIONE GLOBALE SU WINDOW & REGISTRAZIONE NEL REGISTRY
// ============================================================================
window.Rules2Engine = Rules2Engine;

if (typeof window.EngineRegistry !== "undefined" && typeof window.EngineRegistry.register === "function") {
  window.EngineRegistry.register("Rules2", Rules2Engine);
} else if (typeof EngineRegistry !== "undefined" && typeof EngineRegistry.register === "function") {
  EngineRegistry.register("Rules2", Rules2Engine);
}

// Aliasing retrocompatibile su window.GameEngine per gli onclick in index.html
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
window.GameEngine.sellToEmporio = (it, g) => Rules2Engine.sellToEmporio(it, g);
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
