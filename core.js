/* ============================================================
   GenDefense · core.js — modèle métier + rendu sûr (single source of truth)
   Zéro dépendance. Chargé avant app.js :  window.GD = { ... }
   Objectif : supprimer la logique dupliquée (CQ/AGIR/EXGROUPS), centraliser
   les seuils, mettre en cache les couleurs de thème, et rendre le DOM SANS
   innerHTML (anti-XSS).
   ============================================================ */
(function (root) {
  "use strict";

  /* ---------- 1. Constantes toxicologiques (source unique) ---------- */
  var REF = Object.freeze({ JECFA: 1.6 / 7, EFSA: 1.3 / 7, EPA: 0.10 }); // µg/kg/j MeHg
  var REF_INORG = 4 / 7;                                                 // µg/kg/j Hg inorganique
  var DEFAULTS = Object.freeze({ portion: 200, meals: 7, weight: 60, waterL: 2 });

  /* ---------- 2. Calculs (purs, testables) ---------- */
  function doseFish(site, a) {
    a = a || DEFAULTS;
    if (site.hgFish == null) return NaN;
    return site.hgFish * (a.portion * a.meals / 7 / 1000) / a.weight;
  }
  function doseWater(site, a) {
    a = a || DEFAULTS;
    return (site.hgWater || 0) * (a.waterL || DEFAULTS.waterL) / a.weight;
  }
  function hq(site, a) { return doseFish(site, a) / REF.JECFA; }      // HQ de référence (JECFA)
  function hqAll(site, a) {
    var d = doseFish(site, a);
    return { JECFA: d / REF.JECFA, EFSA: d / REF.EFSA, EPA: d / REF.EPA };
  }
  function vulnerable(site) {
    var pct = (site.pctPreg || 0) + (site.pctChild || 0);
    return Math.round((site.pop || 0) * pct / 100);
  }
  function children(site) { return Math.round((site.pop || 0) * (site.pctChild || 0) / 100); }

  /* ---------- 3. Bandes de risque : SOURCE UNIQUE ----------
     Remplace les 3 structures parallèles (CQ, AGIR, BAND_BASE/EXGROUPS).
     Ajouter/traduire une bande = éditer UNIQUEMENT ici. */
  var GROUPS = [
    { key: "enceintes",    nom: "Femmes enceintes & fœtus",     desc: "Neurodéveloppement · transfert placentaire",       exBonus: 1 },
    { key: "enfants",      nom: "Nourrissons & enfants",         desc: "Cognition · motricité · vision · audition",         exBonus: 0 },
    { key: "orpailleurs",  nom: "Orpailleurs",                   desc: "Vapeurs de mercure élémentaire · rein · nerfs",     exBonus: 0 },
    { key: "consommateurs",nom: "Gros consommateurs de poisson", desc: "Bioaccumulation du méthylmercure",                  exBonus: -1 }
  ];

  var BANDS = {
    faible: {
      label: "Faible", token: "--green", base: 1,
      lead: "Sous le seuil de référence : risque faible aux hypothèses actuelles. L'orpaillage en amont impose toutefois une vigilance.",
      env: ["Eau d'apparence normale ; surveiller la turbidité et la coloration liées à l'orpaillage.",
            "Bioaccumulation encore lente dans les poissons âgés.",
            "Sédiments : accumulation de mercure limitée."],
      health: { enceintes: "Risque faible ; maintenir une alimentation variée.",
                enfants: "Pas d'effet attendu à ce niveau ; rester attentif.",
                orpailleurs: "Limiter l'exposition aux vapeurs à la source.",
                consommateurs: "Diversifier les espèces par précaution." },
      agir: { immediat: ["Informer la population locale", "Surveiller la couleur et la turbidité de l'eau"],
              moyen: ["Établir une mesure de référence (poisson, eau)", "Sensibiliser les pêcheurs"],
              long: ["Suivi environnemental de fond", "Encadrer les pratiques d'orpaillage"] }
    },
    modere: {
      label: "Modéré", token: "--gold", base: 2,
      lead: "Dépassement du seuil : premiers signaux d'alerte. Une investigation complémentaire est recommandée.",
      env: ["Mercure détectable dans les sédiments.", "Début de bioaccumulation chez les poissons prédateurs.", "Eau parfois troublée en aval des sites."],
      health: { enceintes: "Surveiller l'exposition alimentaire — le fœtus est la cible prioritaire du seuil.",
                enfants: "Limiter les espèces les plus contaminées ; suivi du développement.",
                orpailleurs: "Protection respiratoire ; surveillance rénale conseillée.",
                consommateurs: "Réduire la fréquence des gros poissons prédateurs." },
      agir: { immediat: ["Réduire la consommation des espèces les plus contaminées", "Sécuriser l'eau de boisson"],
              moyen: ["Confirmer par des mesures poisson/eau", "Suivi des femmes enceintes et des enfants"],
              long: ["Suivre la bioaccumulation", "Réduire les rejets à la source"] }
    },
    eleve: {
      label: "Élevé", token: "--orange", base: 3,
      lead: "Exposition nettement au-dessus de la référence : surveillance sanitaire prioritaire.",
      env: ["Eau souvent colorée/turbide en aval de l'orpaillage.", "Poissons fréquemment au-dessus du seuil Codex 0,5 mg/kg.", "Sédiments contaminés ; méthylation active.", "Chaîne alimentaire aquatique touchée."],
      health: { enceintes: "Risque d'atteinte du neurodéveloppement fœtal — éviter les espèces les plus contaminées.",
                enfants: "Effets à surveiller : cognition, motricité, audition, vision.",
                orpailleurs: "Effets neurologiques et rénaux possibles (vapeurs Hg°) ; biosurveillance.",
                consommateurs: "Effets neurologiques ; risque cardiovasculaire possible." },
      agir: { immediat: ["Alerter la zone", "Réduire fortement la consommation de poisson local", "Sécuriser / traiter l'eau de boisson"],
              moyen: ["Biosurveillance volontaire (cheveux / sang)", "Suivi maternel & neurodéveloppemental", "Confirmation analytique poissons et eau"],
              long: ["Surveillance des sédiments", "Cohortes longitudinales", "Restauration progressive des sites"] }
    },
    urgent: {
      label: "Urgent", token: "--red", base: 4,
      lead: "Contamination très élevée : action urgente et confirmation analytique requises.",
      env: ["Contamination généralisée eau–sédiments–poissons.", "Méthylation intense ; MeHg élevé dans toute la chaîne.", "Biodiversité aquatique menacée ; sols et nappes exposés.", "Eau impropre à la consommation directe."],
      health: { enceintes: "Risque élevé pour le neurodéveloppement fœtal — protection immédiate.",
                enfants: "Atteintes neurodéveloppementales possibles ; éloigner des sources.",
                orpailleurs: "Atteintes neurologiques, rénales et respiratoires ; retrait de l'exposition.",
                consommateurs: "Forte exposition au méthylmercure ; arrêt des espèces à risque." },
      agir: { immediat: ["Limiter / interdire la consommation des espèces à risque", "Fournir une eau sûre", "Confirmer les mesures en urgence"],
              moyen: ["Prise en charge sanitaire des groupes exposés", "Biosurveillance élargie"],
              long: ["Dépollution des sédiments", "Restauration environnementale", "Surveillance de longue durée"] }
    }
  };
  var NA = { label: "n/d", token: "--faint", base: 1, lead: "Donnée manquante.", env: [], health: {}, agir: { immediat: [], moyen: [], long: [] } };

  function bandKey(h) {
    if (h == null || isNaN(h)) return null;
    if (h < 1) return "faible";
    if (h < 3) return "modere";
    if (h < 10) return "eleve";
    return "urgent";
  }
  function risk(h) {                              // remplace tier() ; renvoie la bande complète
    var k = bandKey(h);
    return k ? Object.assign({ k: k }, BANDS[k]) : Object.assign({ k: "faible" }, NA);
  }

  /* ---------- 4. Cache des couleurs de thème (perf) ----------
     getComputedStyle() est coûteux ; on le lit UNE fois par token et on
     rafraîchit au changement de thème. Remplace cget() appelé en boucle. */
  var _cache = {};
  function color(token) {
    if (_cache[token]) return _cache[token];
    var v = getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#888";
    _cache[token] = v; return v;
  }
  function refreshColors() { _cache = {}; }        // à appeler sur toggle de thème

  /* ---------- 5. Rendu DOM sûr (anti-XSS) ----------
     esc() pour toute donnée interpolée ; el() construit des nœuds réels
     (textContent), jamais innerHTML avec des données non fiables. */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function el(tag, attrs, children) {
    var e = document.createElement(tag), k;
    if (attrs) for (k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];        // texte = toujours sûr
      else if (k === "style") e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (children != null) [].concat(children).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function fmt(n, d) {
    return (n == null || isNaN(n)) ? "—"
      : n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  root.GD = {
    REF: REF, REF_INORG: REF_INORG, DEFAULTS: DEFAULTS,
    GROUPS: GROUPS, BANDS: BANDS,
    doseFish: doseFish, doseWater: doseWater, hq: hq, hqAll: hqAll,
    vulnerable: vulnerable, children: children, bandKey: bandKey, risk: risk,
    color: color, refreshColors: refreshColors,
    esc: esc, el: el, fmt: fmt
  };
})(window);
