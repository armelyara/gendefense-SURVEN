/*
   GenDefense-SURVEN · core.js — business model + safe render (single source of truth)
*/
(function (root) {
  "use strict";

  /* Toxicological constants (single source) */
  var REF = Object.freeze({ JECFA: 1.6 / 7, EFSA: 1.3 / 7, EPA: 0.10 }); // µg/kg/day MeHg
  var REF_INORG = 4 / 7;                                                 // µg/kg/day Hg inorganique
  var REF_CN = 0.6;            // µg/kg/day — US EPA RfD, cyanure libre (chronique orale)
  var WHO_CN_WATER = 70;      // µg/L — valeur guide OMS, cyanure dans l'eau de boisson
  var DEFAULTS = Object.freeze({ portion: 200, meals: 7, weight: 60, waterL: 2 });

  /* Calculations */
  function doseFish(site, a) {
    a = a || DEFAULTS;
    if (site.hgFish == null) return NaN;
    return site.hgFish * (a.portion * a.meals / 7 / 1000) / a.weight;
  }
  function doseWater(site, a) {
    a = a || DEFAULTS;
    return (site.hgWater || 0) * (a.waterL || DEFAULTS.waterL) / a.weight;
  }
  /* Cyanure : contaminant distinct, voie EAU (ne bioaccumule pas dans le poisson comme le MeHg).
     cn = concentration dans l'eau (µg/L) ; jamais additionné au mercure. */
  function doseCyanide(cn, a) {
    a = a || DEFAULTS;
    return (cn || 0) * (a.waterL || DEFAULTS.waterL) / a.weight;
  }
  function hqCyanide(cn, a) { return doseCyanide(cn, a) / REF_CN; }
  function hq(site, a) { return doseFish(site, a) / REF.JECFA; }      // Reference HQ
  function hqAll(site, a) {
    var d = doseFish(site, a);
    return { JECFA: d / REF.JECFA, EFSA: d / REF.EFSA, EPA: d / REF.EPA };
  }
  function vulnerable(site) {
    var pct = (site.pctPreg || 0) + (site.pctChild || 0);
    return Math.round((site.pop || 0) * pct / 100);
  }
  function children(site) { return Math.round((site.pop || 0) * (site.pctChild || 0) / 100); }

  /* Risk Bands (single source) */
  var GROUPS = [
    { key: "enceintes", nom: "Pregnant women & fetus", desc: "Neurodevelopment · placental transfer", exBonus: 1 },
    { key: "enfants", nom: "Infants & children", desc: "Cognition · motor skills · vision · hearing", exBonus: 0 },
    { key: "orpailleurs", nom: "Orpailleurs", desc: "Elemental mercury vapors · kidney · nerves", exBonus: 0 },
    { key: "consommateurs", nom: "Gros consommateurs de poisson", desc: "Bioaccumulation du méthylmercure", exBonus: -1 }
  ];

  var BANDS = {
    faible: {
      label: "Faible", token: "--green", base: 1,
      lead: "Sous le seuil de référence : risque faible aux hypothèses actuelles. L'orpaillage en amont impose toutefois une vigilance.",
      env: ["Eau d'apparence normale ; surveiller la turbidité et la coloration liées à l'orpaillage.",
        "Bioaccumulation encore lente dans les poissons âgés.",
        "Sédiments : accumulation de mercure limitée."],
      health: {
        enceintes: "Risque faible ; maintenir une alimentation variée.",
        enfants: "Pas d'effet attendu à ce niveau ; rester attentif.",
        orpailleurs: "Limiter l'exposition aux vapeurs à la source.",
        consommateurs: "Diversifier les espèces par précaution."
      },
      agir: {
        immediat: ["Informer la population locale", "Surveiller la couleur et la turbidité de l'eau"],
        moyen: ["Établir une mesure de référence (poisson, eau)", "Sensibiliser les pêcheurs"],
        long: ["Suivi environnemental de fond", "Encadrer les pratiques d'orpaillage"]
      }
    },
    modere: {
      label: "Modéré", token: "--gold", base: 2,
      lead: "Dépassement du seuil : premiers signaux d'alerte. Une investigation complémentaire est recommandée.",
      env: ["Mercure détectable dans les sédiments.", "Début de bioaccumulation chez les poissons prédateurs.", "Eau parfois troublée en aval des sites."],
      health: {
        enceintes: "Surveiller l'exposition alimentaire — le fœtus est la cible prioritaire du seuil.",
        enfants: "Limiter les espèces les plus contaminées ; suivi du développement.",
        orpailleurs: "Protection respiratoire ; surveillance rénale conseillée.",
        consommateurs: "Réduire la fréquence des gros poissons prédateurs."
      },
      agir: {
        immediat: ["Réduire la consommation des espèces les plus contaminées", "Sécuriser l'eau de boisson"],
        moyen: ["Confirmer par des mesures poisson/eau", "Suivi des femmes enceintes et des enfants"],
        long: ["Suivre la bioaccumulation", "Réduire les rejets à la source"]
      }
    },
    eleve: {
      label: "Élevé", token: "--orange", base: 3,
      lead: "Exposition nettement au-dessus de la référence : surveillance sanitaire prioritaire.",
      env: ["Eau souvent colorée/turbide en aval de l'orpaillage.", "Poissons fréquemment au-dessus du seuil Codex 0,5 mg/kg.", "Sédiments contaminés ; méthylation active.", "Chaîne alimentaire aquatique touchée."],
      health: {
        enceintes: "Risque d'atteinte du neurodéveloppement fœtal — éviter les espèces les plus contaminées.",
        enfants: "Effets à surveiller : cognition, motricité, audition, vision.",
        orpailleurs: "Effets neurologiques et rénaux possibles (vapeurs Hg°) ; biosurveillance.",
        consommateurs: "Effets neurologiques ; risque cardiovasculaire possible."
      },
      agir: {
        immediat: ["Alerter la zone", "Réduire fortement la consommation de poisson local", "Sécuriser / traiter l'eau de boisson"],
        moyen: ["Biosurveillance volontaire (cheveux / sang)", "Suivi maternel & neurodéveloppemental", "Confirmation analytique poissons et eau"],
        long: ["Surveillance des sédiments", "Cohortes longitudinales", "Restauration progressive des sites"]
      }
    },
    urgent: {
      label: "Urgent", token: "--red", base: 4,
      lead: "Contamination très élevée : action urgente et confirmation analytique requises.",
      env: ["Contamination généralisée eau–sédiments–poissons.", "Méthylation intense ; MeHg élevé dans toute la chaîne.", "Biodiversité aquatique menacée ; sols et nappes exposés.", "Eau impropre à la consommation directe."],
      health: {
        enceintes: "Risque élevé pour le neurodéveloppement fœtal — protection immédiate.",
        enfants: "Atteintes neurodéveloppementales possibles ; éloigner des sources.",
        orpailleurs: "Atteintes neurologiques, rénales et respiratoires ; retrait de l'exposition.",
        consommateurs: "Forte exposition au méthylmercure ; arrêt des espèces à risque."
      },
      agir: {
        immediat: ["Limiter / interdire la consommation des espèces à risque", "Fournir une eau sûre", "Confirmer les mesures en urgence"],
        moyen: ["Prise en charge sanitaire des groupes exposés", "Biosurveillance élargie"],
        long: ["Dépollution des sédiments", "Restauration environnementale", "Surveillance de longue durée"]
      }
    }
  };
  var NA = { label: "n/d", token: "--faint", base: 1, lead: "Donnée manquante.", env: [], health: {}, agir: { immediat: [], moyen: [], long: [] } };

  /* Cyanure — contenu (mécanisme, effets, cas réel). Séparé du mercure. */
  var CYANIDE = {
    mech: "Le cyanure inhibe la cytochrome c oxydase : les cellules ne peuvent plus utiliser l'oxygène.",
    aigu: "maux de tête, vertiges, nausées, essoufflement ; à forte dose, atteinte cardiaque et neurologique.",
    chronique: "effets sur la thyroïde (via le thiocyanate) et le système nerveux.",
    cas: "Cavally, juin 2024 — fuite d'eau cyanurée d'une mine d'or en amont (mine d'Ity, groupe Endeavour) ; environ 185 personnes légèrement intoxiquées après consommation de l'eau et du poisson du fleuve (autorités).",
    ref: "Seuil OMS eau de boisson : 70 µg/L · dose de référence US EPA : 0,6 µg/kg/j (cyanure libre)."
  };

  function bandKey(h) {
    if (h == null || isNaN(h)) return null;
    if (h < 1) return "faible";
    if (h < 3) return "modere";
    if (h < 10) return "eleve";
    return "urgent";
  }
  function risk(h) {
    var k = bandKey(h);
    return k ? Object.assign({ k: k }, BANDS[k]) : Object.assign({ k: "faible" }, NA);
  }

  /* Colors cache */
  var _cache = {};
  function color(token) {
    if (_cache[token]) return _cache[token];
    var v = getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#888";
    _cache[token] = v; return v;
  }
  function refreshColors() { _cache = {}; }

  /* Safe DOM (anti-XSS) */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function el(tag, attrs, children) {
    var e = document.createElement(tag), k;
    if (attrs) for (k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
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
    REF: REF, REF_INORG: REF_INORG, REF_CN: REF_CN, WHO_CN_WATER: WHO_CN_WATER, DEFAULTS: DEFAULTS,
    GROUPS: GROUPS, BANDS: BANDS, CYANIDE: CYANIDE,
    doseFish: doseFish, doseWater: doseWater, doseCyanide: doseCyanide, hqCyanide: hqCyanide,
    hq: hq, hqAll: hqAll,
    vulnerable: vulnerable, children: children, bandKey: bandKey, risk: risk,
    color: color, refreshColors: refreshColors,
    esc: esc, el: el, fmt: fmt
  };
})(window);
