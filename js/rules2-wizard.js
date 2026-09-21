// ============================================================================
// PROJECT: ESTIQATSY SYNDICATE & RPG PLATFORM
// FILE: js/rules2-wizard.js
// LAYER 3A: WIZARD CREAZIONE EROE (DATA-DRIVEN, 3D CIRCULAR & DEEP INSPECTION)
// ============================================================================

const CATEGORY_MAP = {
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
  if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw];

  const name = String(item.nome || item || "").toLowerCase();
  if (name.includes("coltello") || name.includes("machete") || name.includes("lama") || name.includes("serramanico") || name.includes("fiocina") || name.includes("tubo") || name.includes("gomena") || name.includes("chiodatrice") || name.includes("mazzetta")) return "ARMI";
  if (name.includes("scooter") || name.includes("zodiac") || name.includes("bici") || name.includes("panda") || name.includes("apecar") || name.includes("ciao") || name.includes("canoa") || name.includes("barchino")) return "VEICOLI";
  if (name.includes("ponce") || name.includes("fritto") || name.includes("cecina") || name.includes("focaccia") || name.includes("cee") || name.includes("garze") || name.includes("soffocotto")) return "CURE";
  if (name.includes("danpei") || name.includes("marmolina") || name.includes("spada") || name.includes("rivotril") || name.includes("valium") || name.includes("gnugna") || name.includes("thc") || name.includes("bogotà")) return "DROGHE";
  if (name.includes("dossier") || name.includes("bolla") || name.includes("fattura") || name.includes("schema") || name.includes("registro") || name.includes("pizzino") || name.includes("foto")) return "INFORMAZIONI";
  if (name.includes("bitta") || name.includes("zanna") || name.includes("corno") || name.includes("talismano") || name.includes("feticcio")) return "TALISMANI";

  return "STRUMENTI";
}

// Decodifica diegetica delle proprietà (rimuove codici grezzi da database)
function formatHumanEffect(rawEffect, faction) {
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
    else if (tag.startsWith("PASSIVO:STAT_FOR_")) out.push(`🥊 <b>Forza Rinforzata:</b> +${tag.replace("PASSIVO:STAT_FOR_", "")} permanente.`);
    else if (tag.startsWith("PASSIVO:STAT_DES_")) out.push(`🤸 <b>Destrezza Agile:</b> +${tag.replace("PASSIVO:STAT_DES_", "")} permanente.`);
    else if (tag.startsWith("PASSIVO:STAT_INT_")) out.push(`🧠 <b>Intuito Fine:</b> +${tag.replace("PASSIVO:STAT_INT_", "")} permanente.`);
    else if (tag.startsWith("PASSIVO:INT_VS_")) out.push(`📂 <b>Dossier Mirato:</b> +1 INT situazionale contro la fazione ${tag.replace("PASSIVO:INT_VS_", "")}.`);
    else if (tag === "PASSIVO:PROVE" || tag === "PASSIVO:DOSSIER") out.push("📁 <b>Organigramma del Potere:</b> +1 INT permanente nell'inchiesta.");
    else if (tag.startsWith("SINTESI:")) out.push(`⚗️ <b>Laboratorio Clandestino:</b> Sintetizza sostanze pure (${tag.replace("SINTESI:", "")}).`);
    else if (tag.startsWith("PASSIVO:INGREDIENTE_")) out.push(`🧪 <b>Materia Prima Reagente:</b> Ingrediente grezzo raffinabile nel laboratorio chimico.`);
    else if (tag === "PASSIVO:OGGETTO_EQP_0026_S1_E0") out.push("🛡️ <b>Scudo Ricatto:</b> Riduce di 2 punti tutti i danni fisici subiti.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0017_S1_E0") out.push("🧰 <b>Scasso Industriale:</b> Sfonda porte e varchi sbarrati al 100%.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0020_S1_E0") out.push("📟 <b>Hacker Demaniale:</b> Bypassa parcometri e cancelli elettronici al 100%.");
    else if (tag === "PASSIVO:OGGETTO_EQP_0022_S1_E0") out.push("📡 <b>Schermatura Radio:</b> Blocca le chiamate di rinforzo nemiche al 100%.");
    else out.push(`⚡ <b>Proprietà:</b> ${tag.replace(/_/g, " ")}`);
  }

  return out.join("<br>");
}

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

  // --------------------------------------------------------------------------
  // 1. INIZIALIZZAZIONE & APERTURA WIZARD
  // --------------------------------------------------------------------------
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

      // Catalogo isolato dell'Emporio di Ciccio RPG (solo EQP/OBJ dal tab di gioco)
      const rawShop = wizData.emporioItems ||
                      wizData.equipaggiamenti ||
                      wizData.shopCatalog ||
                      wizData.shopItems ||
                      wizData.oggetti ||
                      [];
      this.state.shopCatalog = deduplicateEntities(rawShop);

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
          ind.className = "font-black text-sky-400";
        } else if (s.num < stepNum) {
          ind.className = "text-emerald-400 font-bold";
        } else {
          ind.className = "text-slate-500 font-normal";
        }
      }
    });

    const scrollContainer = document.getElementById("app-main-scroll");
    if (scrollContainer) scrollContainer.scrollTop = 0;
  },

  // --------------------------------------------------------------------------
  // 2. PASSO 1: CAROSELLO 3D AD ANELLO CONTINUO (LOOP INFINITO 360°)
  // --------------------------------------------------------------------------
  renderStep1: function() {
    const stage = document.getElementById("wizard-classes-stage");
    const dotsBox = document.getElementById("wizard-coverflow-dots");
    if (!stage) return;

    const classes = this.state.classes || [];
    if (classes.length === 0) {
      stage.innerHTML = `<div class="text-slate-500 text-xs text-center py-10">Nessuna classe disponibile.</div>`;
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
        <div id="coverflow-card-${idx}" onclick="Rules2Wizard.coverflowSelectIndex(${idx})" class="coverflow-card bg-[#0d131f] border-2 border-white/15 overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-300">
          
          <!-- 1. Artwork Cinematografico con Face-Anchoring -->
          <div class="card-media-box relative w-full h-[180px] sm:h-[210px] bg-slate-950 overflow-hidden flex-none">
            <img src="${cls.mediaUrl}" class="w-full h-full object-cover object-top" alt="${cls.nome}">
            
            <span class="badge badge-xs ${isDestra ? 'badge-info' : 'badge-error'} font-black uppercase text-[8.5px] absolute top-2.5 left-2.5 shadow-lg">
              ${pol.toUpperCase()} (+1 Danno)
            </span>

            <div class="absolute top-2.5 right-2.5 flex space-x-1.5">
              <span class="badge badge-xs bg-black/85 backdrop-blur-md text-rose-300 font-mono font-bold text-[9.5px]">❤️ ${cls.pv} PV</span>
              <span class="badge badge-xs bg-black/85 backdrop-blur-md text-amber-300 font-mono font-bold text-[9.5px]">🟡 ${cls.oro}</span>
            </div>

            <div class="watermark-cover-banner text-right flex flex-col items-end">
              <span class="text-[10px] sm:text-[11px] text-slate-100 italic leading-snug line-clamp-2 w-full">“${cleanQuote}”</span>
              <span class="text-[8.5px] font-black text-amber-400 uppercase tracking-wider mt-0.5">${cls.autoreCitazione || 'Darsena'}</span>
            </div>
          </div>

          <!-- 2. Corpo Carta: Testo Narrativo, Modificatori D20 e Dotazione -->
          <div id="coverflow-details-${idx}" class="p-3 sm:p-4 space-y-2 flex-1 flex flex-col justify-between transition-opacity duration-300">
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <span class="text-2xl">${cls.emoji || '🥋'}</span>
                <div>
                  <h4 class="font-black text-base sm:text-lg text-white leading-tight">${cls.nome}</h4>
                  <div class="text-[9.5px] font-bold text-sky-400 uppercase tracking-wider">${isDestra ? 'Baluardo Costiero di Destra' : 'Militanza Popolare di Sinistra'}</div>
                </div>
              </div>

              <!-- Trittico Modificatori D20 -->
              <div class="grid grid-cols-3 gap-1.5 py-1.5 px-2 rounded-xl bg-black/60 border border-white/10 text-center font-mono text-[10px] sm:text-[11px]">
                <div>🥊 FOR <b>${cls.forza || 10}</b> <span class="text-slate-400">(${fmt(forMod)})</span></div>
                <div>🤸 DES <b>${cls.destrezza || 10}</b> <span class="text-slate-400">(${fmt(desMod)})</span></div>
                <div>🧠 INT <b>${cls.intelligenza || 10}</b> <span class="text-slate-400">(${fmt(intMod)})</span></div>
              </div>

              <!-- Testo Narrativo Completo dell'Archetipo -->
              <p class="text-left text-xs sm:text-[13px] text-slate-200 leading-relaxed max-h-36 overflow-y-auto pr-1 no-scrollbar">
                ${cls.testo || cls.descrizione || ''}
              </p>
            </div>

            <!-- Footer Carta con Dotazione e Stato Selezione -->
            <div class="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span class="text-slate-300 truncate max-w-[170px]" title="${startingGear}">
                🎒 Dotazione: <b class="text-amber-300 font-bold">${startingGear}</b>
              </span>
              <button class="btn btn-xs sm:btn-sm btn-primary font-bold px-3 shadow" id="coverflow-action-btn-${idx}">
                Seleziona
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (dotsBox) {
      dotsBox.innerHTML = classes.map((_, i) => `
        <span onclick="Rules2Wizard.coverflowSelectIndex(${i})" class="h-1.5 rounded-full transition-all cursor-pointer ${i === this.state.activeClassIndex ? 'bg-sky-400 w-4 shadow' : 'bg-white/20 w-1.5'}"></span>
      `).join("");
    }

    this.initCoverflowGestures();
    this.updateCoverflowStage();
  },

  // Calcolo matematico ad anello continuo (Loop 360° senza muri)
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

      // Distanza circolare minima su toro unidimensionale
      let diff = (i - activeIdx) % total;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;

      const offset = diff;
      const absOffset = Math.abs(offset);

      // Nasconde le carte troppo lontane sul retro del cilindro
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

      // Alone perimetrale a 360° senza clipping
      el.classList.toggle("glow-destra", isCenter && isDestra);
      el.classList.toggle("glow-sinistra", isCenter && !isDestra);

      if (btn) {
        btn.textContent = isCenter ? "✓ In Uso" : "Scegli";
        btn.className = isCenter ? "btn btn-xs sm:btn-sm btn-success font-black px-3 shadow" : "btn btn-xs btn-outline border-white/20 text-slate-400 font-bold px-2";
      }
    });

    this.state.chosenClass = classes[activeIdx];
    this.state.startingGold = classes[activeIdx] ? cleanNumber(classes[activeIdx].oro, 40) : 40;
    this.state.currentGold = this.state.startingGold;

    const dotsBox = document.getElementById("wizard-coverflow-dots");
    if (dotsBox) {
      dotsBox.querySelectorAll("span").forEach((d, i) => {
        d.className = `h-1.5 rounded-full transition-all cursor-pointer ${i === activeIdx ? 'bg-sky-400 w-4 shadow' : 'bg-white/20 w-1.5'}`;
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

    stage.addEventListener("wheel", e => {
      if (Math.abs(e.deltaX) > 20 || Math.abs(e.deltaY) > 20) {
        if (e.deltaX > 0 || e.deltaY > 0) Rules2Wizard.coverflowNext();
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

  // --------------------------------------------------------------------------
  // 3. PASSO 2: TALENTI CLANDESTINI & DEEP INSPECTION
  // --------------------------------------------------------------------------
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
        <div onclick="Rules2Wizard.inspectAbilityDetail('${abl.id}')" class="p-3.5 rounded-2xl border ${isSelected ? 'border-sky-400 bg-sky-500/15 shadow-lg ring-1 ring-sky-400/40' : (isCompatible ? 'border-white/10 bg-surface/80 hover:bg-surface cursor-pointer active:scale-[0.99]' : 'border-white/5 bg-black/40 opacity-40 cursor-not-allowed')} flex items-center justify-between transition-all">
          <div class="overflow-hidden pr-2.5">
            <div class="flex items-center space-x-2">
              <span class="text-xl">${abl.emoji || '⚡'}</span>
              <span class="text-xs sm:text-sm font-black text-white truncate">${abl.nome}</span>
            </div>
            <div class="text-[11.5px] sm:text-xs text-slate-300 line-clamp-2 mt-1 leading-snug">
              ${abl.descrizione || abl.testo || ''}
            </div>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <span class="badge badge-sm ${isSelected ? 'badge-primary font-black' : (isCompatible ? 'badge-ghost border-white/20' : 'badge-neutral')} text-[9.5px] py-2 px-2.5">
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

  // --------------------------------------------------------------------------
  // 4. PASSO 3: MERCATO NERO DI CICCIO & DEEP INSPECTION EQUIPAGGIAMENTI
  // --------------------------------------------------------------------------
  filterShop: function(targetCategory) {
    this.state.shopCategory = targetCategory;

    const chipsBox = document.getElementById("wizard-shop-category-chips");
    if (chipsBox) {
      chipsBox.querySelectorAll("button").forEach(btn => {
        const isAct = btn.textContent.toUpperCase().includes(targetCategory.toUpperCase());
        btn.className = `rpg-category-chip badge ${isAct ? 'badge-info font-black shadow' : 'badge-ghost'} font-bold cursor-pointer transition-all`;
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
      container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 text-xs">Nessun articolo per il reparto <b>${targetCategory}</b> all'Emporio.</div>`;
      this.updateBackpackSummary();
      return;
    }

    container.innerHTML = filtered.map(it => {
      const price = Math.abs(cleanNumber(it.costoOro || it.costo, 15));
      const canAfford = (this.state.currentGold >= price);

      return `
        <div class="bg-surface/90 p-2.5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-2 text-xs shadow-md group">
          <div onclick="Rules2Wizard.inspectItemDetail('${it.id}')" class="cursor-pointer space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-lg">${it.emoji || '📦'}</span>
              <span class="font-mono text-[10px] text-amber-300 font-bold">${price} 🟡</span>
            </div>
            <div class="font-bold text-white text-xs sm:text-[13px] line-clamp-1 group-hover:text-sky-400 transition-colors">${it.nome}</div>
            <div class="text-[10px] text-slate-300 line-clamp-2 leading-snug">${it.descrizione || it.testo || ''}</div>
          </div>
          <div class="grid grid-cols-2 gap-1.5 pt-1">
            <button onclick="Rules2Wizard.inspectItemDetail('${it.id}')" class="btn btn-xs btn-outline border-white/10 text-slate-300 font-bold text-[9px]">
              Dettagli
            </button>
            <button onclick="Rules2Wizard.buyItem('${it.id}', ${price})" class="btn btn-xs ${canAfford ? 'btn-primary' : 'btn-outline border-white/10 text-slate-500 cursor-not-allowed'} font-bold text-[9px]" ${!canAfford ? 'disabled' : ''}>
              ${canAfford ? 'Compra' : 'Oro Insuff.'}
            </button>
          </div>
        </div>
      `;
    }).join("");

    this.updateBackpackSummary();
  },

  // Deep inspection per qualsiasi articolo venduto da Ciccio
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

  // --------------------------------------------------------------------------
  // 5. PASSO 4: BATTESIMO DELL'EROE & KEYBOARD SHIELD
  // --------------------------------------------------------------------------
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

    const payload = {
      gameKey: this.state.gameKey,
      episodio: this.state.episodio,
      classId: this.state.chosenClass?.id || "CLS_0001_S1_E0",
      abilityIds: this.state.chosenAbilities.join(","),
      boughtItems: this.state.boughtItems.map(i => i.id || i.nome).join(","),
      heroName: heroName
    };

    let engine = null;
    if (typeof window.EngineRegistry !== "undefined") {
      engine = window.EngineRegistry.get("Rules2");
    } else if (typeof EngineRegistry !== "undefined") {
      engine = EngineRegistry.get("Rules2");
    }
    if (!engine) {
      engine = window.Rules2Engine || (typeof Rules2Engine !== "undefined" ? Rules2Engine : null);
    }

    if (engine && typeof engine.executeStartGame === "function") {
      engine.executeStartGame(payload);
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

// ============================================================================
// ESPOSIZIONE GLOBALE SU WINDOW & BINDING ONCLICK PER INDEX.HTML
// ============================================================================
window.Rules2Wizard = Rules2Wizard;

window.GameEngine = window.GameEngine || {};
window.GameEngine.coverflowPrev = () => Rules2Wizard.coverflowPrev();
window.GameEngine.coverflowNext = () => Rules2Wizard.coverflowNext();
window.GameEngine.wizardConfirmStep1 = () => Rules2Wizard.confirmStep1();
window.GameEngine.wizardPrevStep = (step) => Rules2Wizard.prevStep(step);
window.GameEngine.wizardConfirmStep2 = () => Rules2Wizard.confirmStep2();
window.GameEngine.filterWizardShop = (cat) => Rules2Wizard.filterShop(cat);
window.GameEngine.resetWizardShop = () => Rules2Wizard.resetShop();
window.GameEngine.wizardNextStep = (step) => Rules2Wizard.nextStep(step);
window.GameEngine.wizardUseTelegramName = () => Rules2Wizard.useTelegramName();
window.GameEngine.wizardFinalizeHero = () => Rules2Wizard.finalizeHero();
