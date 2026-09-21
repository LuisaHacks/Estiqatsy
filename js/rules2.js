// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2.js (VERSIONE 6.0 UNIFICATA: WIZARD + ENGINE + HUD 2 RIGHE)
// LAYER 3: LOGICA NARRATIVA, CREAZIONE EROE, COMBATTIMENTO D20 & CASSETTI RPG
// ============================================================================

// ----------------------------------------------------------------------------
// 1. COSTANTI E UTILITY CONDIVISE RULES2
// ----------------------------------------------------------------------------
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

function formatHumanEffect(rawEffect, faction = "") {
  if (!rawEffect || rawEffect === "—" || rawEffect === "-") return "Nessuna proprietà speciale.";
  const tags = String(rawEffect).split(/[,|]/);
  const out = [];

  for (let t of tags) {
    const tag = t.trim();
    if (!tag || tag === "—") continue;

    if (tag === "TASTO:ZOMBI_ABILITA") out.push("🧟 <b>Necromanzia Arcana:</b> Costa 1 PV per rianimare un nemico caduto come Zombi con Danno x2.");
    else if (tag === "TASTO:ZOMBI_DROGA") out.push("🧟 <b>Risveglio Chimico:</b> Consuma 1 dose di droga idonea per rianimare uno Zombi.");
    else if (tag === "CLASSE:Destra") out.push("⚖️ <b>Orientamento Destra:</b> +1 Danno fisso vs fazioni Mazzu e Ideologi.");
    else if (tag === "CLASSE:Sinistra") out.push("⚖️ <b>Orientamento Sinistra:</b> +1 Danno fisso vs fazioni Camorristi e Burocrati.");
    else if (tag === "CLASSE:Tutti") out.push("⚖️ <b>Tratto Comune:</b> Accessibile a tutti gli schieramenti.");
    else if (tag === "PASSIVO:STAT_FORTUNA_1") out.push("🍀 <b>Buona Sorte:</b> +1 costante a tutti i Tiri Salvezza D20 ed Eventi.");
    else if (tag === "VULN:Mischia") out.push("💥 <b>Vulnerabile alla Mischia:</b> Subisce +2 danni da colpi ravvicinati.");
    else if (tag === "VULN:Distanza") out.push("🏹 <b>Vulnerabile a Distanza:</b> Subisce +2 danni da proiettili o petardi.");
    else if (tag.startsWith("PASSIVO:STAT_FOR_")) out.push(`🥊 <b>Forza Rinforzata:</b> +${tag.replace("PASSIVO:STAT_FOR_", "")} permanente.`);
    else if (tag.startsWith("PASSIVO:STAT_DES_")) out.push(`🤸 <b>Destrezza Agile:</b> +${tag.replace("PASSIVO:STAT_DES_", "")} permanente.`);
    else if (tag.startsWith("PASSIVO:STAT_INT_")) out.push(`🧠 <b>Intuito Fine:</b> +${tag.replace("PASSIVO:STAT_INT_", "")} permanente.`);
    else if (tag.startsWith("PASSIVO:INT_VS_")) out.push(`📂 <b>Dossier Mirato:</b> +1 INT situazionale contro la fazione ${tag.replace("PASSIVO:INT_VS_", "")}.`);
    else if (tag === "PASSIVO:PROVE" || tag === "PASSIVO:DOSSIER") out.push("📁 <b>Organigramma del Potere:</b> +1 INT permanente nell'inchiesta.");
    else if (tag.startsWith("SINTESI:")) out.push(`⚗️ <b>Laboratorio Clandestino:</b> Sintetizza sostanze pure (${tag.replace("SINTESI:", "")}).`);
    else if (tag === "PASSIVO:OGGETTO_EQP_0026_S1_E0") out.push("🛡️ <b>Scudo Ricatto:</b> Riduce di 2 punti tutti i danni fisici subiti.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0017_S1_E0") out.push("🧰 <b>Scasso Industriale:</b> Sfonda porte e varchi sbarrati al 100%.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0020_S1_E0") out.push("📟 <b>Hacker Demaniale:</b> Bypassa cancelli elettronici al 100%.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0022_S1_E0") out.push("📡 <b>Schermatura Radio:</b> Blocca le chiamate di rinforzo al 100%.");
    else out.push(`⚡ <b>Proprietà:</b> ${tag.replace(/_/g, " ")}`);
  }

  return out.join("<br>");
}

// ----------------------------------------------------------------------------
// 2. MODULO WIZARD: CREAZIONE PERSONAGGIO (3D COVERFLOW & EMPOIRIO)
// ----------------------------------------------------------------------------
const Rules2Wizard = {
  state: {
    gameKey: null,
    episodio: 1,
    step: 1,
    isVeteran: false,
    classes: [],
    abilities: [],
    shopCatalog: [],
    shopCategory: "ARMI",
    activeClassIndex: 0,
    chosenClass: null,
    chosenAbilities: [],
    boughtItems: [],
    heroName: "",
    remainingPx: 100,
    startingGold: 40,
    currentGold: 40,
    _gesturesInitialized: false
  },

  open: async function(gameKey, epNum, isVeteran = false, savedHero = null) {
    try {
      if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("wizard");

      const wizData = await apiCall("game_wizard_data", { gameKey: gameKey });

      this.state.gameKey = gameKey;
      this.state.episodio = epNum;
      this.state.isVeteran = isVeteran;
      this.state.step = 1;

      this.state.classes = deduplicateEntities(wizData.classes || wizData.classi || []);
      this.state.abilities = deduplicateEntities(wizData.abilities || wizData.abilita || []);
      this.state.shopCatalog = deduplicateEntities(wizData.emporioItems || wizData.equipaggiamenti || []);

      this.state.chosenAbilities = [];
      this.state.boughtItems = [];
      this.state.activeClassIndex = 0;

      if (isVeteran && savedHero) {
        this.state.chosenClass = {
          id: savedHero.classeId || "CLS_0001_S1_E0",
          nome: savedHero.classe || savedHero.nomeEroe,
          sottocategoria: savedHero.schieramentoPolitico || "Destra",
          pv: savedHero.pvMax || 25,
          oro: savedHero.oro || 40,
          emoji: "🎖️",
          mediaUrl: savedHero.mediaUrl || "https://image.pollinations.ai/prompt/veteran-coastal-adventurer-portrait?width=800&height=450&nologo=true",
          equipLoot: savedHero.equipLoot || ""
        };
        this.state.heroName = savedHero.nomeEroe;
        this.state.remainingPx = savedHero.px || 0;
        this.state.startingGold = savedHero.oro || 40;
        this.state.currentGold = savedHero.oro || 40;

        this.renderStep2();
        this.showStep(2);
      } else {
        const firstClass = this.state.classes[0] || null;
        this.state.chosenClass = firstClass;
        this.state.remainingPx = 100;
        this.state.startingGold = firstClass ? cleanNumber(firstClass.oro, 40) : 40;
        this.state.currentGold = this.state.startingGold;

        this.renderStep1();
        this.showStep(1);
      }

      this.initKeyboardShield();
      AppRouter.navigate("view-wizard");
    } catch (err) {
      console.error("[Rules2Wizard] Errore apertura wizard:", err);
      alert("Errore caricamento wizard: " + err.message);
    }
  },

  showStep: function(stepNum) {
    this.state.step = stepNum;
    const steps = [
      { num: 1, id: "wizard-step-class", ind: "wiz-step-ind-1" },
      { num: 2, id: "wizard-step-abilities", ind: "wiz-step-ind-2" },
      { num: 3, id: "wizard-step-shop", ind: "wiz-step-ind-3" },
      { num: 4, id: "wizard-step-name", ind: "wiz-step-ind-4" }
    ];

    steps.forEach(s => {
      const el = document.getElementById(s.id);
      const ind = document.getElementById(s.ind);
      if (el) el.classList.toggle("hidden", s.num !== stepNum);
      if (ind) {
        if (s.num === stepNum) {
          ind.className = "step-active";
        } else if (s.num < stepNum) {
          ind.className = "step-completed";
        } else {
          ind.className = "step-idle";
        }
      }
    });

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;
  },

  renderStep1: function() {
    const stage = document.getElementById("wizard-classes-stage");
    const dotsBox = document.getElementById("wizard-coverflow-dots");
    if (!stage) return;

    const classes = this.state.classes || [];
    if (classes.length === 0) {
      stage.innerHTML = `<div class="empty-state-card">Nessuna classe disponibile.</div>`;
      return;
    }

    stage.innerHTML = classes.map((cls, idx) => {
      const pol = String(cls.sottocategoria || cls.schieramento || "Destra").toLowerCase();
      const isDestra = pol === "destra";

      const forMod = Math.floor(((cleanNumber(cls.forza, 10)) - 10) / 2);
      const desMod = Math.floor(((cleanNumber(cls.destrezza, 10)) - 10) / 2);
      const intMod = Math.floor(((cleanNumber(cls.intelligenza, 10)) - 10) / 2);
      const fmt = v => (v >= 0 ? "+" + v : String(v));

      const cleanQuote = String(cls.citazione || "A Viareggio non ci sono eroi: chi non colpisce per primo finisce a fondo.").replace(/^["'“”]+|["'“”]+$/g, "");
      const startingGear = cls.equipLoot || (cls.armaIniziale ? cls.armaIniziale.nome : "Pugni nudi");

      return `
        <div id="coverflow-card-${idx}" onclick="Rules2Wizard.coverflowSelectIndex(${idx})" class="coverflow-card">
          <div class="coverflow-media-frame">
            <img src="${cls.mediaUrl}" class="coverflow-img" alt="${cls.nome}">
            
            <span class="badge badge-xs ${isDestra ? 'badge-info' : 'badge-error'} coverflow-badge-faction">
              ${pol.toUpperCase()} (+1 Danno)
            </span>

            <div class="coverflow-kpi-pill">
              <span class="pill-pv">❤️ ${cls.pv} PV</span>
              <span class="pill-gold">🟡 ${cls.oro}</span>
            </div>

            <div class="watermark-cover-banner">
              <span class="quote-text">“${cleanQuote}”</span>
              <span class="quote-author">${cls.autoreCitazione || 'Darsena'}</span>
            </div>
          </div>

          <div id="coverflow-details-${idx}" class="coverflow-details-box">
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <span class="text-2xl">${cls.emoji || '🥋'}</span>
                <div>
                  <h4 class="coverflow-title">${cls.nome}</h4>
                  <div class="coverflow-sub">${isDestra ? 'Baluardo Costiero di Destra' : 'Militanza Popolare di Sinistra'}</div>
                </div>
              </div>

              <div class="coverflow-stats-row font-mono">
                <div>🥊 FOR <b>${cls.forza || 10}</b> <span class="stat-mod">(${fmt(forMod)})</span></div>
                <div>🤸 DES <b>${cls.destrezza || 10}</b> <span class="stat-mod">(${fmt(desMod)})</span></div>
                <div>🧠 INT <b>${cls.intelligenza || 10}</b> <span class="stat-mod">(${fmt(intMod)})</span></div>
              </div>

              <p class="coverflow-lore no-scrollbar">
                ${cls.testo || cls.descrizione || ''}
              </p>
            </div>

            <div class="coverflow-footer-row">
              <span class="coverflow-gear-label truncate" title="${startingGear}">
                🎒 Dotazione: <b>${startingGear}</b>
              </span>
              <button class="btn btn-xs sm:btn-sm btn-primary font-bold" id="coverflow-action-btn-${idx}">
                Seleziona
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = classes.map((_, i) => `
        <span onclick="Rules2Wizard.coverflowSelectIndex(${i})" class="coverflow-dot ${i === this.state.activeClassIndex ? 'active' : ''}"></span>
      `).join("");
    }

    this.initCoverflowGestures();
    this.updateCoverflowStage();
  },

  updateCoverflowStage: function() {
    const classes = this.state.classes || [];
    const total = classes.length;
    if (total === 0) return;

    const activeIdx = this.state.activeClassIndex;
    const isDesktop = window.innerWidth >= 768;
    const spacing = isDesktop ? 220 : 160;

    classes.forEach((cls, i) => {
      const el = document.getElementById(`coverflow-card-${i}`);
      const btn = document.getElementById(`coverflow-action-btn-${i}`);
      const detailsBox = document.getElementById(`coverflow-details-${i}`);
      if (!el) return;

      let diff = (i - activeIdx) % total;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;

      const offset = diff;
      const absOffset = Math.abs(offset);

      if (absOffset > 2 && !isDesktop) {
        el.style.display = "none";
        return;
      } else {
        el.style.display = "flex";
      }

      const isCenter = (offset === 0);
      const isDestra = String(cls.sottocategoria || cls.schieramento || "Destra").toLowerCase() === "destra";

      if (detailsBox) {
        detailsBox.style.opacity = isCenter ? "1" : "0.2";
        detailsBox.style.pointerEvents = isCenter ? "auto" : "none";
      }

      const translateX = offset * spacing;
      const rotateY = offset * (isDesktop ? -24 : -16);
      const scale = isCenter ? (isDesktop ? 1.05 : 1.02) : Math.max(0.72, 0.88 - absOffset * 0.08);
      const zIndex = 30 - Math.round(absOffset * 5);
      const opacity = isCenter ? 1 : Math.max(0.2, 0.5 - absOffset * 0.15);

      el.style.transform = `translateX(${translateX}px) translateZ(${isCenter ? 40 : -50}px) rotateY(${rotateY}deg) scale(${scale})`;
      el.style.zIndex = zIndex;
      el.style.opacity = opacity;

      el.classList.toggle("glow-destra", isCenter && isDestra);
      el.classList.toggle("glow-sinistra", isCenter && !isDestra);

      if (btn) {
        btn.textContent = isCenter ? "✓ In Uso" : "Scegli";
        btn.className = isCenter ? "btn btn-xs sm:btn-sm btn-success font-black px-3" : "btn btn-xs btn-outline border-white/20 text-slate-400 font-bold";
      }
    });

    this.state.chosenClass = classes[activeIdx];
    this.state.startingGold = classes[activeIdx] ? cleanNumber(classes[activeIdx].oro, 40) : 40;
    this.state.currentGold = this.state.startingGold;

    const dotsBox = document.getElementById("wizard-coverflow-dots");
    if (dotsBox) {
      dotsBox.querySelectorAll(".coverflow-dot").forEach((d, i) => {
        d.classList.toggle("active", i === activeIdx);
      });
    }

    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
  },

  coverflowSelectIndex: function(idx) {
    if (idx === this.state.activeClassIndex) return;
    this.state.activeClassIndex = idx;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.updateCoverflowStage();
  },

  coverflowNext: function() {
    const total = (this.state.classes || []).length;
    if (total <= 1) return;
    this.state.activeClassIndex = (this.state.activeClassIndex + 1) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.updateCoverflowStage();
  },

  coverflowPrev: function() {
    const total = (this.state.classes || []).length;
    if (total <= 1) return;
    this.state.activeClassIndex = (this.state.activeClassIndex - 1 + total) % total;
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.updateCoverflowStage();
  },

  initCoverflowGestures: function() {
    const stage = document.getElementById("wizard-classes-stage");
    if (!stage || this.state._gesturesInitialized) return;
    this.state._gesturesInitialized = true;

    let touchStartX = 0;
    stage.addEventListener("touchstart", e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    stage.addEventListener("touchend", e => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 30) {
        if (diff > 0) Rules2Wizard.coverflowNext();
        else Rules2Wizard.coverflowPrev();
      }
    }, { passive: true });

    window.addEventListener("keydown", e => {
      if (Rules2Wizard.state.step !== 1) return;
      if (e.key === "ArrowRight") Rules2Wizard.coverflowNext();
      else if (e.key === "ArrowLeft") Rules2Wizard.coverflowPrev();
    });
  },

  confirmStep1: function() {
    if (!this.state.chosenClass) {
      alert("Seleziona prima un archetipo!");
      return;
    }
    this.renderStep2();
    this.showStep(2);
  },

  renderStep2: function() {
    const grid = document.getElementById("wizard-abilities-grid");
    const budgetBadge = document.getElementById("wizard-px-budget");
    if (!grid) return;

    if (budgetBadge) budgetBadge.textContent = `✨ ${this.state.remainingPx} PX Disponibili`;
    const userFaction = String(this.state.chosenClass?.sottocategoria || "Destra").toLowerCase();

    grid.innerHTML = this.state.abilities.map(abl => {
      const isSelected = this.state.chosenAbilities.includes(abl.id);
      const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
      const isCompatible = req.includes("tutti") || req.includes(userFaction);

      return `
        <div onclick="Rules2Wizard.inspectAbilityDetail('${abl.id}')" class="wizard-ability-card ${isSelected ? 'selected' : (isCompatible ? 'compatible' : 'locked')}">
          <div class="ability-card-info">
            <div class="flex items-center space-x-2">
              <span class="text-xl">${abl.emoji || '⚡'}</span>
              <span class="ability-card-title">${abl.nome}</span>
            </div>
            <div class="ability-card-desc">
              ${abl.descrizione || abl.testo || ''}
            </div>
          </div>
          <div class="ability-card-badge-box">
            <span class="badge badge-sm ${isSelected ? 'badge-primary font-black' : (isCompatible ? 'badge-ghost' : 'badge-neutral')}">
              ${isSelected ? 'ATTIVO ✓' : (isCompatible ? `${abl.costoPX || 100} PX` : '🔒')}
            </span>
          </div>
        </div>
      `;
    }).join("");
  },

  inspectAbilityDetail: function(ablId) {
    const abl = this.state.abilities.find(a => a.id === ablId);
    if (!abl) return;

    const userFaction = String(this.state.chosenClass?.sottocategoria || "Destra").toLowerCase();
    const req = String(abl.requisitiCodificati || abl.effettoCodificato || "tutti").toLowerCase();
    const isCompatible = req.includes("tutti") || req.includes(userFaction);
    const isSelected = this.state.chosenAbilities.includes(abl.id);

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const h = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    s("uni-detail-icon", abl.emoji || "⚡");
    s("uni-detail-title", abl.nome);
    s("uni-detail-badge", `ABILITÀ • ${(req.includes("destra") ? "Destra" : (req.includes("sinistra") ? "Sinistra" : "Comune")).toUpperCase()}`);
    s("uni-detail-metrics-label", "EFFETTO BELLICO DECODIFICATO");
    h("uni-detail-metrics-value", formatHumanEffect(abl.requisitiCodificati || abl.effettoCodificato, userFaction));
    s("uni-detail-lore", abl.descrizione || abl.testo || "Nessuna nota d'archivio.");

    const mediaContainer = document.getElementById("uni-detail-media-container");
    if (mediaContainer) {
      if (abl.mediaUrl && abl.mediaUrl !== "—" && abl.mediaUrl.startsWith("http")) {
        document.getElementById("uni-detail-img").src = abl.mediaUrl;
        mediaContainer.classList.remove("hidden");
      } else {
        mediaContainer.classList.add("hidden");
      }
    }

    const btn = document.getElementById("uni-detail-action-btn");
    if (btn) {
      if (!isCompatible) {
        btn.textContent = `🔒 Riservato alle classi di ${userFaction === "destra" ? "Sinistra" : "Destra"}`;
        btn.className = "btn btn-sm btn-outline border-white/10 text-slate-500 cursor-not-allowed w-full";
        btn.onclick = null;
      } else if (isSelected) {
        btn.textContent = "Rimuovi Talento (+100 PX)";
        btn.className = "btn btn-sm btn-error font-bold w-full";
        btn.onclick = () => {
          Rules2Wizard.toggleAbility(abl.id);
          document.getElementById("modal-universal-detail")?.close();
        };
      } else {
        btn.textContent = "Attiva Talento (-100 PX)";
        btn.className = "btn btn-sm btn-primary font-bold shadow-lg shadow-sky-600/30 w-full";
        btn.onclick = () => {
          Rules2Wizard.toggleAbility(abl.id);
          document.getElementById("modal-universal-detail")?.close();
        };
      }
    }

    document.getElementById("modal-universal-detail")?.showModal();
  },

  toggleAbility: function(ablId) {
    const idx = this.state.chosenAbilities.indexOf(ablId);
    if (idx !== -1) {
      this.state.chosenAbilities.splice(idx, 1);
      this.state.remainingPx += 100;
    } else {
      if (this.state.remainingPx >= 100) {
        this.state.chosenAbilities.push(ablId);
        this.state.remainingPx -= 100;
      } else {
        alert("Punti Esperienza insufficienti!");
        return;
      }
    }
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.renderStep2();
  },

  confirmStep2: function() {
    this.filterShop(this.state.shopCategory || "ARMI");
    this.showStep(3);
  },

  filterShop: function(targetCategory) {
    this.state.shopCategory = targetCategory;

    const chipsBox = document.getElementById("wizard-shop-category-chips");
    if (chipsBox) {
      chipsBox.querySelectorAll(".rpg-category-chip").forEach(btn => {
        const isAct = btn.textContent.toUpperCase().includes(targetCategory.toUpperCase());
        btn.className = `rpg-category-chip badge ${isAct ? 'badge-info active' : 'badge-ghost'}`;
      });
    }

    const goldDisp = document.getElementById("wizard-shop-gold-display");
    if (goldDisp) goldDisp.textContent = `💰 ${this.state.currentGold} 🟡`;

    const container = document.getElementById("wizard-shop-grid");
    if (!container) return;

    const filtered = (this.state.shopCatalog || []).filter(item => {
      return getNormalizedCategory(item) === targetCategory.toUpperCase();
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state-card col-span-full">Nessun articolo per il reparto <b>${targetCategory}</b> all'Emporio.</div>`;
      this.updateBackpackSummary();
      return;
    }

    container.innerHTML = filtered.map(it => {
      const price = Math.abs(cleanNumber(it.costoOro || it.costo, 15));
      const canAfford = (this.state.currentGold >= price);

      return `
        <div class="wizard-shop-card group">
          <div onclick="Rules2Wizard.inspectItemDetail('${it.id}')" class="shop-card-clickable">
            <div class="shop-card-head">
              <span class="text-lg">${it.emoji || '📦'}</span>
              <span class="shop-card-price">${price} 🟡</span>
            </div>
            <div class="shop-card-title">${it.nome}</div>
            <div class="shop-card-desc">${it.descrizione || it.testo || ''}</div>
          </div>
          <div class="shop-card-actions">
            <button onclick="Rules2Wizard.inspectItemDetail('${it.id}')" class="btn btn-xs btn-outline border-white/10 text-slate-300">
              Dettagli
            </button>
            <button onclick="Rules2Wizard.buyItem('${it.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'}" ${!canAfford ? 'disabled' : ''}>
              ${canAfford ? 'Compra' : 'Oro Insuff.'}
            </button>
          </div>
        </div>
      `;
    }).join("");

    this.updateBackpackSummary();
  },

  inspectItemDetail: function(itemId) {
    const it = (this.state.shopCatalog || []).find(i => i.id === itemId);
    if (!it) return;

    const price = Math.abs(cleanNumber(it.costoOro || it.costo, 15));
    const canAfford = (this.state.currentGold >= price);
    const category = getNormalizedCategory(it);

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const h = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    s("uni-detail-icon", it.emoji || "📦");
    s("uni-detail-title", it.nome);
    s("uni-detail-badge", `EMPORIO • ${category} • ${it.sottocategoria || 'GENERALE'}`);
    s("uni-detail-metrics-label", "PARAMETRI & STATISTICHE");

    const bonuses = [];
    if (it.danno) bonuses.push(`💥 Danno: <b>${it.danno}</b>`);
    if (it.pv) bonuses.push(`❤️ PV: <b>${it.pv > 0 ? '+' : ''}${it.pv}</b>`);
    if (it.forza) bonuses.push(`🥊 Forza: <b>+${it.forza}</b>`);
    if (it.destrezza) bonuses.push(`🤸 Destrezza: <b>+${it.destrezza}</b>`);
    if (it.intelligenza) bonuses.push(`🧠 Intelligenza: <b>+${it.intelligenza}</b>`);
    bonuses.push(`💰 Prezzo: <b class="text-amber-300">${price} 🟡</b>`);

    h("uni-detail-metrics-value", bonuses.join(" • ") + "<br>" + formatHumanEffect(it.requisitiCodificati || it.effettoCodificato, ""));
    s("uni-detail-lore", it.descrizione || it.testo || "Nessuna nota d'archivio.");

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
      btn.textContent = canAfford ? `Acquista da Ciccio (${price} 🟡)` : `Oro Insufficiente (${price} 🟡)`;
      btn.className = `btn btn-sm ${canAfford ? 'btn-primary font-bold shadow-lg shadow-sky-600/30' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'} w-full`;
      btn.onclick = canAfford ? () => {
        Rules2Wizard.buyItem(it.id, price);
        document.getElementById("modal-universal-detail")?.close();
      } : null;
    }

    document.getElementById("modal-universal-detail")?.showModal();
  },

  buyItem: function(itemId, price) {
    if (this.state.currentGold < price) {
      alert("Monete d'oro insufficienti!");
      return;
    }

    const item = (this.state.shopCatalog || []).find(i => i.id === itemId);
    if (!item) return;

    if (getNormalizedCategory(item) === "VEICOLI") {
      const alreadyHasVehicle = this.state.boughtItems.some(x => getNormalizedCategory(x) === "VEICOLI");
      if (alreadyHasVehicle) {
        alert("Puoi possedere un solo Veicolo nello zaino!");
        return;
      }
    }

    this.state.currentGold -= price;
    this.state.boughtItems.push(item);

    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("cash_register");
    this.filterShop(this.state.shopCategory);
  },

  resetShop: function() {
    this.state.currentGold = this.state.startingGold;
    this.state.boughtItems = [];
    if (typeof SoundEngine !== "undefined") SoundEngine.playSfx("click");
    this.filterShop(this.state.shopCategory);
  },

  updateBackpackSummary: function() {
    const countEl = document.getElementById("wizard-shop-backpack-count");
    if (!countEl) return;

    const startingItem = this.state.chosenClass?.equipLoot;
    const hasStarting = (startingItem && startingItem !== "—" && startingItem !== "-");
    const total = (hasStarting ? 1 : 0) + this.state.boughtItems.length;

    countEl.innerHTML = `${total} oggetti ${hasStarting ? `<span class="text-amber-300 font-bold text-[11px]">(${startingItem})</span>` : ''}`;
  },

  renderStep4: function() {
    const cls = this.state.chosenClass;
    if (!cls) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s("wizard-class-recap", `${cls.nome} (${cls.sottocategoria || 'Destra'})`);
    s("wizard-recap-avatar", cls.emoji || "🥋");
    s("wizard-recap-classname", cls.nome);
    s("wizard-recap-faction", `${String(cls.sottocategoria || 'Destra').toUpperCase()} (+1 Danno)`);
    s("wizard-recap-pv", `❤️ ${cls.pv || 25} PV`);
    s("wizard-recap-gold", `🟡 ${this.state.currentGold} Oro`);

    const abls = this.state.chosenAbilities.map(id => {
      const a = this.state.abilities.find(x => x.id === id);
      return a ? a.nome : id;
    });
    s("wizard-recap-abilities", abls.length > 0 ? abls.join(", ") : "Nessun talento sbloccato");

    const startingItem = cls.equipLoot && cls.equipLoot !== "—" ? cls.equipLoot : "Pugni nudi";
    const bought = this.state.boughtItems.map(i => i.nome);
    const fullInv = [startingItem, ...bought].filter(Boolean);
    s("wizard-recap-inventory", fullInv.join(", "));

    const nameInput = document.getElementById("wizard-name-input");
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = this.state.isVeteran ? this.state.heroName : (AppState.user?.nome || "Avventuriero");
    }
  },

  initKeyboardShield: function() {
    const input = document.getElementById("wizard-name-input");
    if (!input || input._shieldAttached) return;
    input._shieldAttached = true;

    input.addEventListener("focus", () => {
      setTimeout(() => {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    });
  },

  useTelegramName: function() {
    const input = document.getElementById("wizard-name-input");
    if (input && AppState.user) input.value = AppState.user.nome;
  },

  finalizeHero: function() {
    const input = document.getElementById("wizard-name-input");
    const defaultName = this.state.isVeteran ? this.state.heroName : (AppState.user?.nome || "Avventuriero");
    const heroName = (input && input.value.trim()) ? input.value.trim() : defaultName;

    // Salvataggio dell'Avatar Media URL nello stato per il passaggio trasparente all'Engine
    const heroAvatarUrl = this.state.chosenClass?.mediaUrl || "";

    const payload = {
      gameKey: this.state.gameKey,
      episodio: this.state.episodio,
      classId: this.state.chosenClass?.id || "CLS_0001_S1_E0",
      abilityIds: this.state.chosenAbilities.join(","),
      boughtItems: this.state.boughtItems.map(i => i.id || i.nome).join(","),
      heroName: heroName,
      avatarUrl: heroAvatarUrl
    };

    if (typeof Rules2Engine !== "undefined" && typeof Rules2Engine.executeStartGame === "function") {
      Rules2Engine.executeStartGame(payload, heroAvatarUrl);
    } else {
      alert("Errore: motore di gioco Rules2 non caricato.");
    }
  },

  nextStep: function(stepNum) {
    this.state.step = stepNum;
    if (stepNum === 4) this.renderStep4();
    this.showStep(stepNum);
  },

  prevStep: function(stepNum) {
    if (this.state.isVeteran && stepNum === 1) return;
    this.state.step = stepNum;
    this.showStep(stepNum);
  }
};

// ----------------------------------------------------------------------------
// 3. MODULO ENGINE: GAMEPLAY, HUD A 2 RIGHE & CASSETTI RPG
// ----------------------------------------------------------------------------
const Rules2Engine = {

  launchSession: function(gameKey, epNum, canContinueFree, savedHero) {
    Rules2Wizard.open(gameKey, epNum, canContinueFree, savedHero);
  },

  executeStartGame: async function(payloadParams, avatarUrl = "") {
    try {
      if (typeof SoundEngine !== "undefined") {
        SoundEngine.playSfx("insert_coin");
        SoundEngine.playBgm("exploration");
      }

      const res = await apiCall("game_start", payloadParams);
      if (res && res.success) {
        const wizardCatalog = (Rules2Wizard.state.shopCatalog || []);
        const allGameItems = deduplicateEntities([
          ...(res.emporioItems || []),
          ...(res.equipaggiamenti || []),
          ...wizardCatalog
        ]);

        AppState.activeSession.engineKey = "Rules2";
        AppState.activeSession.gameKey = payloadParams.gameKey;
        AppState.activeSession.episodio = payloadParams.episodio;
        AppState.activeSession.partitaId = res.partitaId;

        // Trasmissione garantita dell'Avatar da Media URL
        AppState.activeSession.hero = {
          ...res.statoEroe,
          mediaUrl: avatarUrl || res.statoEroe?.mediaUrl || ""
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

        if (res.nuovoSaldoMegoin !== undefined) {
          Wallet.setMegoin(res.nuovoSaldoMegoin);
        }
        if (typeof AppModules !== "undefined") {
          AppModules.renderProfile(AppState.user);
        }

        this.renderNode(res.nodoIniziale, AppState.activeSession.hero);
        AppRouter.navigate("view-gameplay");
      }
    } catch (err) {
      console.error("[Rules2Engine] Errore avvio partita:", err);
      alert("Impossibile avviare la sessione di gioco: " + err.message);
    }
  },

  // RENDERING COCKPIT & SCENE (HUD A DUE RIGHE + AVATAR RITRATTO)
  renderNode: function(node, hero) {
    if (node) AppState.activeSession.currentNode = node;
    if (hero) {
      AppState.activeSession.hero = { ...AppState.activeSession.hero, ...hero };
      Wallet.setGold(hero.oro || 0);
    }

    const currentNode = AppState.activeSession.currentNode;
    const currentHero = AppState.activeSession.hero;
    if (!currentNode) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    const saga = AppState.games.catalog.find(g => g.gameKey === AppState.activeSession.gameKey);
    s("game-header-series", (saga ? saga.serie : "AVVENTURA NOIR").toUpperCase());
    s("game-header-episode", `Episodio ${AppState.activeSession.episodio}`);

    // GESTIONE AVATAR RITRATTO DA MEDIA URL (PARAMETRO 1)
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

      // Riga 1: Identità e Oro
      s("kpi-hero-name", currentHero.nomeEroe || "Avventuriero");
      s("kpi-hero-gold", currentHero.oro || 0);

      // Riga 2: Barra Salute (<45%) e Trittico D20 (>55%)
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

    // Inquadratura cinema & citazione diegetica
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

    // Azioni Tattiche di Scena
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    const isCombat = (currentNode.tipo === "NEMICO" || (currentNode.id && currentNode.id.includes("NEM_")));
    const isEvento = (currentNode.tipo === "EVENTO" || (currentNode.id && currentNode.id.includes("EVT_")));

    // CASO 1: COMBATTIMENTO D20
    if (isCombat) {
      if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("combat");

      if (AppState.activeSession.combatEnemyId !== currentNode.id) {
        AppState.activeSession.combatEnemyId = currentNode.id;
        AppState.activeSession.combatRound = 1;
      }
      const curRound = AppState.activeSession.combatRound || 1;

      let bribeHtml = "";
      if (currentNode.corruption && currentNode.corruption.canCorrupt && currentNode.corruption.validDrugs.length > 0) {
        bribeHtml = currentNode.corruption.validDrugs.map(d => `
          <button onclick="Rules2Engine.combatBribe('${d.nome.replace(/'/g, "\\'")}')" class="btn btn-sm btn-block btn-warning font-bold">
            💊 Cedi ${d.nome} ${d.costoDosi === 0 ? '(0 dosi)' : ''}
          </button>
        `).join("");
      }

      actBox.innerHTML = `
        <div class="combat-actions-grid">
          <button onclick="Rules2Engine.combatAction('attack_round')" class="btn btn-sm btn-error font-black btn-combat-attack">
            ⚔️ Attacca • Round ${curRound}
          </button>
          <button onclick="Rules2Engine.combatAction('flee')" class="btn btn-sm btn-outline border-white/20 btn-combat-flee">
            🏃 Fuggi
          </button>
        </div>
        ${bribeHtml}
        <div class="pt-0.5">
          <button onclick="Rules2Engine.inspectCurrentEnemyDetail()" class="btn btn-xs btn-block btn-ghost btn-inspect-enemy">
            🔍 Fascicolo Tattico Nemico (Debolezze & Stat)
          </button>
        </div>
      `;
      return;
    }

    // CASO 2: EVENTO D20
    if (isEvento) {
      const statReq = currentNode.statRichiesta || "DESTREZZA";
      const cdVal = currentNode.difficolta || 11;
      const bypassTool = currentNode.equipLoot || currentNode.requisitoBypass;
      const hasTool = bypassTool && (currentHero?.inventario || []).some(it => it.toLowerCase().includes(bypassTool.toLowerCase()));

      if (hasTool) {
        actBox.innerHTML = `
          <div class="tactical-advantage-box">
            <div class="text-[10px] font-bold text-emerald-300">🛡️ Vantaggio Tattico: possiedi ${bypassTool}!</div>
          </div>
          <button onclick="Rules2Engine.advanceToNode('${currentNode.destSuccesso}')" class="btn btn-sm btn-block btn-success font-black h-11">
            ⚡ Oltrepassa Senza Danni (${bypassTool})
          </button>
        `;
      } else {
        actBox.innerHTML = `
          <div class="combat-actions-grid">
            <button onclick="Rules2Engine.executeEventRoll('${currentNode.id}', '${statReq}', ${cdVal})" class="btn btn-sm btn-primary font-black h-11">
              🎲 Prova ${statReq} (CD ${cdVal})
            </button>
            <button onclick="Rules2Engine.advanceToNode('${currentNode.destFallback || currentNode.destFallimento}')" class="btn btn-sm btn-outline border-white/20 h-11">
              🏃 Arretra / Evita
            </button>
          </div>
        `;
      }
      return;
    }

    // CASO 3: ENIGMA / QUIZ
    if (currentNode.quiz) {
      actBox.innerHTML = `
        <div class="quiz-box">
          <div class="quiz-question">
            <span>🔐</span> <span>${currentNode.quiz.domanda}</span>
          </div>
          <div class="quiz-options-grid">
            ${currentNode.quiz.opzioni.map(opz => `
              <button onclick="Rules2Engine.submitQuizAnswer('${opz.replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline border-white/20 text-[11px] truncate">
                ${opz}
              </button>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    // CASO 4: BIVIO NARRATIVO
    const rawChoices = currentNode.choices || currentNode.parsedBivio || [];
    const choices = rawChoices.map(c => ({
      testo: c.testo || c.text || c.nome || "Avanza",
      target: c.target || c.id || c.nodo || ""
    })).filter(c => c.target !== "");

    if (choices.length > 0) {
      if (choices.length === 2) {
        actBox.innerHTML = `
          <div class="combat-actions-grid">
            <button onclick="Rules2Engine.advanceToNode('${choices[0].target}')" class="btn btn-sm btn-primary font-bold truncate h-11">
              ${choices[0].testo}
            </button>
            <button onclick="Rules2Engine.advanceToNode('${choices[1].target}')" class="btn btn-sm btn-primary font-bold truncate h-11">
              ${choices[1].testo}
            </button>
          </div>
        `;
      } else {
        actBox.innerHTML = choices.map(c => `
          <button onclick="Rules2Engine.advanceToNode('${c.target}')" class="btn btn-sm btn-block btn-primary font-bold mb-1.5 truncate h-11">
            ${c.testo}
          </button>
        `).join("");
      }
    } else {
      actBox.innerHTML = `
        <button onclick="Rules2Engine.leaveGameToHub()" class="btn btn-sm btn-block btn-outline border-white/20 font-bold h-11">
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
          if (diceModal) diceModal.close();

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
          } else if (res.status === "DEFEAT") {
            AppState.activeSession.combatRound = 1;
            AppState.activeSession.combatEnemyId = null;

            if (typeof SoundEngine !== "undefined") SoundEngine.playBgm("defeat");
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
      console.error("[Rules2Engine] Errore combatAction:", e);
      alert("Errore durante l'azione di combattimento: " + e.message);
    }
  },

  renderNecromancyPrompt: function(deadEnemy) {
    const actBox = document.getElementById("scene-actions-container");
    if (!actBox) return;

    actBox.innerHTML = `
      <div class="necromancy-prompt-box">
        <div class="font-black text-purple-300">🧟 RIANIMAZIONE ZOMBI DISPONIBILE</div>
        <div class="text-[10px] text-slate-300">Il corpo di <b>${deadEnemy ? deadEnemy.nome : 'questo nemico'}</b> giace a terra. Puoi rianimarlo come Zombi (Danno x2).</div>
        <div class="combat-actions-grid pt-1">
          <button onclick="Rules2Engine.executeResurrectZombie('${deadEnemy ? deadEnemy.id : ''}')" class="btn btn-sm btn-secondary font-bold">
            🧟 Rianima (1 PV)
          </button>
          <button onclick="Rules2Engine.skipNecromancy()" class="btn btn-sm btn-outline border-white/20 text-slate-300">
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
    el.className = `floating-damage ${isHeroDmg ? 'text-glow-rose' : (isCrit ? 'text-glow-amber' : '')}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  submitQuizAnswer: function(selectedOpz) {
    const node = AppState.activeSession.currentNode;
    if (!node || !node.quiz) return;
    const isCorrect = (selectedOpz.trim().toLowerCase() === node.quiz.rispostaCorretta?.trim().toLowerCase());
    if (isCorrect) {
      this.showFloatingDamage("✅ Risposta Esatta!", false, false);
      this.advanceToNode(node.destSuccesso);
    } else {
      this.showFloatingDamage("❌ Risposta Errata!", false, true);
      this.advanceToNode(node.destFallimento);
    }
  },

  // --------------------------------------------------------------------------
  // 4. DEEP INSPECTION UNIVERSALE & I 5 CASSETTI DEL COCKPIT
  // --------------------------------------------------------------------------

  // Ispezione Nemico (Senza consumare il turno)
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

  // Scheda Dossier Universale Centrata con Tasto "X" Unico
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

    const btn = document.getElementById("uni-detail-action-btn");
    if (btn) {
      if (it.isEnemyInspection) {
        btn.textContent = "⚔️ Torna al Duello";
        btn.className = "btn btn-primary btn-sm w-full font-bold";
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

  // 1. SCHEDA EROE (CON BANCO CAMBIO INTEGRATO)
  openHeroSheetDrawer: function() {
    const h = AppState.activeSession.hero;
    if (!h) return;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    s("sheet-hero-name", h.nomeEroe || "Avventuriero");
    s("sheet-hero-class", `${h.classe || "Avventuriero"} (${h.schieramentoPolitico || "Destra"})`);
    s("sheet-hero-gold", `${h.oro || 0} 🟡`);

    // Avatar nella scheda
    const sheetAvatarImg = document.getElementById("sheet-hero-avatar-img");
    const sheetAvatarFallback = document.getElementById("sheet-hero-avatar-fallback");
    if (sheetAvatarImg && sheetAvatarFallback) {
      if (h.mediaUrl && h.mediaUrl !== "—" && h.mediaUrl.startsWith("http")) {
        sheetAvatarImg.src = h.mediaUrl;
        sheetAvatarImg.classList.remove("hidden");
        sheetAvatarFallback.classList.add("hidden");
      } else {
        sheetAvatarImg.classList.add("hidden");
        sheetAvatarFallback.classList.remove("hidden");
      }
    }

    // Statistiche pure e modificatori D20
    const stats = h.stats || { FORZA: 10, DESTREZZA: 10, INTELLIGENZA: 10 };
    const mods = h.modificatori || { FORZA: 0, DESTREZZA: 0, INTELLIGENZA: 0 };

    s("sheet-pure-for", stats.FORZA || 10);
    s("sheet-pure-des", stats.DESTREZZA || 10);
    s("sheet-pure-int", stats.INTELLIGENZA || 10);

    s("sheet-mod-for", (mods.FORZA >= 0 ? "+" : "") + mods.FORZA);
    s("sheet-mod-des", (mods.DESTREZZA >= 0 ? "+" : "") + mods.DESTREZZA);
    s("sheet-mod-int", (mods.INTELLIGENZA >= 0 ? "+" : "") + mods.INTELLIGENZA);

    s("sheet-active-weapon", h.armaAttiva || "Pugni nudi");
    s("sheet-active-vehicle", h.veicoloAttivo || "Nessun veicolo");

    const ablsBox = document.getElementById("sheet-abilities-list");
    if (ablsBox) {
      const list = h.abilita || [];
      ablsBox.innerHTML = list.length > 0
        ? list.map(a => `<span class="badge badge-sm badge-info font-bold mr-1 mb-1">⚡ ${a}</span>`).join("")
        : "Nessun talento speciale attivo.";
    }

    document.getElementById("drawer-hero-sheet")?.showModal();
  },

  // 2. ZAINO DELL'EROE
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
      tabsContainer.querySelectorAll(".rpg-category-chip").forEach(btn => {
        const btnText = btn.textContent.toUpperCase();
        const isMatch = (cat === "ALL" && btnText.includes("TUTTI")) || btnText.includes(cat);
        btn.className = `rpg-category-chip badge ${isMatch ? 'badge-info active' : 'badge-ghost'}`;
      });
    }

    const c = document.getElementById("backpack-slots-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    let inv = h.inventario || [];
    if (inv.length === 0) {
      c.innerHTML = `<div class="empty-state-card">Il tuo zaino è vuoto.</div>`;
      return;
    }

    if (cat && cat !== "ALL") {
      inv = inv.filter(itemName => {
        const ent = this._findEntityData(itemName);
        return getNormalizedCategory(ent) === cat;
      });
      if (inv.length === 0) {
        c.innerHTML = `<div class="empty-state-card">Nessun articolo per il reparto <b>${cat}</b> nello zaino.</div>`;
        return;
      }
    }

    c.innerHTML = inv.map(it => {
      const isArma = (h.armaAttiva && it.toLowerCase() === h.armaAttiva.toLowerCase());
      const isVeicolo = (h.veicoloAttivo && it.toLowerCase() === h.veicoloAttivo.toLowerCase());
      const ent = this._findEntityData(it);
      const category = getNormalizedCategory(ent);

      return `
        <div class="backpack-slot-card">
          <div onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${it.replace(/'/g, "\\'")}'), isFromBackpack: true })" class="slot-info-clickable">
            <div class="slot-name">${it}</div>
            <div class="slot-tag ${isArma || isVeicolo ? 'active-gear' : ''}">
              ${isArma ? '🗡️ [ARMA IN PUGNO]' : (isVeicolo ? '🛴 [VEICOLO IN USO]' : category)} • Tocca per dettagli
            </div>
          </div>
          <button onclick="Rules2Engine.inspectEntityDetail({ ...Rules2Engine._findEntityData('${it.replace(/'/g, "\\'")}'), isFromBackpack: true })" class="btn btn-xs btn-outline border-white/20 text-slate-300 font-bold">
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
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
        this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
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
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
        this.renderNode(AppState.activeSession.currentNode, AppState.activeSession.hero);
        this.filterBackpack(AppState.activeSession.engineState.backpackFilter);
      }
    } catch (e) {
      alert("Impossibile usare l'oggetto: " + e.message);
    }
  },

  // 3. EMPORIO DI CICCIO (COMPRA / VENDI AL 25%)
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

    if (btnBuy) btnBuy.className = `flex-1 btn btn-xs ${mode === 'buy' ? 'btn-primary' : 'btn-ghost text-slate-400'} font-bold`;
    if (btnSell) btnSell.className = `flex-1 btn btn-xs ${mode === 'sell' ? 'btn-primary' : 'btn-ghost text-slate-400'} font-bold`;

    if (mode === "sell") {
      const inv = (h && h.inventario) ? h.inventario : [];
      if (inv.length === 0) {
        container.innerHTML = `<div class="empty-state-card col-span-full">Nessuna refurtiva nello zaino.</div>`;
        return;
      }
      container.innerHTML = inv.map(it => {
        const ent = this._findEntityData(it);
        const buyPrice = Math.abs(cleanNumber(ent?.costoOro || ent?.costo, 10));
        const sellPrice = Math.max(1, Math.ceil(buyPrice * 0.25));

        return `
          <div class="emporio-sell-row">
            <span class="font-bold text-white truncate pr-2">${it}</span>
            <button onclick="Rules2Engine.sellToEmporio('${it.replace(/'/g, "\\'")}', ${sellPrice})" class="btn btn-xs btn-warning font-bold">
              Vendi (+${sellPrice} 🟡)
            </button>
          </div>
        `;
      }).join("");
    } else {
      const emporioItems = AppState.activeSession.shopCatalog || [];

      if (emporioItems.length === 0) {
        container.innerHTML = `<div class="empty-state-card col-span-full">Nessun equipaggiamento disponibile sui banchi di Ciccio.</div>`;
        return;
      }

      container.innerHTML = emporioItems.map(item => {
        const price = Math.abs(cleanNumber(item.costoOro || item.costo, 10));
        const canAfford = (h && h.oro >= price);

        return `
          <div class="emporio-item-card group">
            <div onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${item.nome.replace(/'/g, "\\'")}'))" class="item-card-clickable">
              <div class="item-card-header">
                <span class="text-lg">${item.emoji || '📦'}</span>
                <span class="item-card-price">${price} 🟡</span>
              </div>
              <div class="item-card-name">${item.nome}</div>
              <div class="item-card-desc">${item.testo || item.descrizione || ''}</div>
            </div>
            <div class="item-card-actions">
              <button onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${item.nome.replace(/'/g, "\\'")}'))" class="btn btn-xs btn-outline border-white/10 text-slate-300">
                Dettagli
              </button>
              <button onclick="Rules2Engine.buyFromEmporio('${item.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'}" ${!canAfford ? 'disabled' : ''}>
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
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
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
        AppState.activeSession.hero = { ...AppState.activeSession.hero, ...res.statoEroe };
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

  // BANCO DI CAMBIO VALUTA (MEGOIN ➔ ORO)
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

        if (Rules2Wizard.state.currentGold !== undefined) {
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
      alert("Errore nel banco di cambio: " + e.message);
    }
  },

  // 4. SQUADRA & ZOMBI
  openSquadDrawer: function() {
    const c = document.getElementById("squad-list-container");
    const h = AppState.activeSession.hero;
    if (!c || !h) return;

    let html = "";
    const comp = h.compagni || [];
    const compData = h.compagniData || {};
    const zombies = h.zombieSquad || [];

    if (comp.length === 0 && zombies.length === 0) {
      html = `<div class="empty-state-card">Sei in solitaria. Nessun alleato presente.</div>`;
    } else {
      html += comp.map(a => {
        const d = compData[a] || {};
        const hpText = d.pv ? ` (❤️ ${d.pv}/${d.pvMax || 15} PV)` : "";
        return `<div class="squad-member-card"><span>🤝 ${a}${hpText}</span> <span class="badge-human">Alleato Umano</span></div>`;
      }).join("");
      html += zombies.map(z => `
        <div class="squad-member-card zombie">
          <span>🧟 ${z.nome}</span> <span class="badge-zombie">Danno x2 (❤️ ${z.pv}/${z.pvMax || 15})</span>
        </div>
      `).join("");
    }

    c.innerHTML = html;
    document.getElementById("drawer-squad")?.showModal();
  },

  // 5. DOSSIER & ORGANIGRAMMA DEL POTERE
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
      c.innerHTML = `<div class="empty-state-card">Nessun reperto d'inchiesta raccolto finora.</div>`;
    } else {
      c.innerHTML = infoItems.map(p => {
        const ent = this._findEntityData(p);
        const sub = String(ent?.sottocategoria || "").toLowerCase();
        const isPermanent = (sub === "prove" || sub === "prova");

        return `
          <div onclick="Rules2Engine.inspectEntityDetail(Rules2Engine._findEntityData('${p.replace(/'/g, "\\'")}'))" class="dossier-evidence-card">
            <div class="evidence-header">
              <span class="evidence-name">📁 ${p}</span>
              <span class="badge badge-xs badge-info">${ent?.categoria || 'Reperto'}</span>
            </div>
            <div class="evidence-desc">
              ${isPermanent ? 'Reperto dell\'Organigramma: <b class="text-emerald-400">+1 INT permanente</b>' : `Reperto d'inchiesta: <b class="text-amber-300">+1 INT situazionale</b>`}
            </div>
          </div>
        `;
      }).join("");
    }

    document.getElementById("drawer-dossier")?.showModal();
  },

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

// ----------------------------------------------------------------------------
// 5. ESPOSIZIONE GLOBALE & BINDING ONCLICK PER INDEX.HTML
// ----------------------------------------------------------------------------
window.Rules2Wizard = Rules2Wizard;
window.Rules2Engine = Rules2Engine;

if (typeof window.EngineRegistry !== "undefined" && typeof window.EngineRegistry.register === "function") {
  window.EngineRegistry.register("Rules2", Rules2Engine);
}

// Interfaccia unificata per gli handler onclick in index.html
window.GameEngine = {
  // Wizard
  coverflowPrev: () => Rules2Wizard.coverflowPrev(),
  coverflowNext: () => Rules2Wizard.coverflowNext(),
  wizardConfirmStep1: () => Rules2Wizard.confirmStep1(),
  wizardPrevStep: (s) => Rules2Wizard.prevStep(s),
  wizardConfirmStep2: () => Rules2Wizard.confirmStep2(),
  filterWizardShop: (c) => Rules2Wizard.filterShop(c),
  resetWizardShop: () => Rules2Wizard.resetShop(),
  wizardNextStep: (s) => Rules2Wizard.nextStep(s),
  wizardUseTelegramName: () => Rules2Wizard.useTelegramName(),
  wizardFinalizeHero: () => Rules2Wizard.finalizeHero(),

  // Cockpit 5 Sezioni
  openHeroSheetDrawer: () => Rules2Engine.openHeroSheetDrawer(),
  openBackpackDrawer: () => Rules2Engine.openBackpackDrawer(),
  openEmporioDrawer: () => Rules2Engine.openEmporioDrawer(),
  openSquadDrawer: () => Rules2Engine.openSquadDrawer(),
  openDossierDrawer: () => Rules2Engine.openDossierDrawer(),

  // Emporio & Cambio
  setEmporioMode: (m) => Rules2Engine.setEmporioMode(m),
  buyFromEmporio: (id, p) => Rules2Engine.buyFromEmporio(id, p),
  sellToEmporio: (it, g) => Rules2Engine.sellToEmporio(it, g),
  openCambioModal: () => Rules2Engine.openCambioModal(),
  convertMegoinToGold: (m, g) => Rules2Engine.convertMegoinToGold(m, g),

  // Zaino & Azioni
  filterBackpack: (c) => Rules2Engine.filterBackpack(c),
  useBackpackItem: (it) => Rules2Engine.useBackpackItem(it),
  equipItem: (it, t) => Rules2Engine.equipItem(it, t),

  // Gameplay
  combatAction: (act) => Rules2Engine.combatAction(act),
  combatBribe: (d) => Rules2Engine.combatBribe(d),
  executeResurrectZombie: (id) => Rules2Engine.executeResurrectZombie(id),
  skipNecromancy: () => Rules2Engine.skipNecromancy(),
  submitQuizAnswer: (a) => Rules2Engine.submitQuizAnswer(a),
  advanceToNode: (t) => Rules2Engine.advanceToNode(t),
  openAbandonModal: () => Rules2Engine.openAbandonModal(),
  confirmAbandon: () => Rules2Engine.confirmAbandon(),
  leaveGameToHub: () => Rules2Engine.leaveGameToHub()
};
