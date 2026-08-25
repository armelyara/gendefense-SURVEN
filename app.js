/* GenDefense-SURVEN — logique applicative */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var NS = "http://www.w3.org/2000/svg";
  function mk(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function fmt(n, d) { return (n == null || isNaN(n)) ? "—" : n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }); }

  var REF = { JECFA: 1.6 / 7, EFSA: 1.3 / 7, EPA: 0.10 };   // µg/kg/j MeHg
  var REF_INORG = 4 / 7;                             // µg/kg/j Hg inorganic
  var WATER_L = 2;                                 // liters/day (hypothesis)

  var SITES = (window.MS_SITES || []).slice();
  var GEO = window.MS_GEO || { civ: [], neighbors: {}, bbox: [-8.6, 4.3, -2.5, 10.5] };
  var TOX = window.MS_TOX || { nodes: [], edges: [], pathways: {}, enrich: [], hubs: [] };

  var A = { portion: 200, meals: 7, weight: 60 };       // exposure hypothesis 
  var sel = 0;                                      // selected site
  var scen = "statuquo";

  function tier(hq) {
    if (hq == null || isNaN(hq)) return { k: "faible", label: "n/d", v: "--faint" };
    if (hq < 1) return { k: "faible", label: "Faible", v: "--green" };
    if (hq < 3) return { k: "modere", label: "Modéré", v: "--gold" };
    if (hq < 10) return { k: "eleve", label: "Élevé", v: "--orange" };
    return { k: "urgent", label: "Urgent", v: "--red" };
  }
  function cget(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#888"; }
  function doseFish(s) { return s.hgFish * (A.portion * A.meals / 7 / 1000) / A.weight; }
  function doseWater(s) { return (s.hgWater || 0) * WATER_L / A.weight; }
  function hqJ(s) { return doseFish(s) / REF.JECFA; }
  function children(s) { return Math.round(s.pop * (s.pctChild || 0) / 100); }

  /* navigation */
  var mapInited = false;
  function showScreen(name) {
    ["une", "carte", "exposes", "consequences", "projection", "agir", "science"].forEach(function (n) {
      var el = $("s-" + n); if (el) el.classList.toggle("active", n === name);
    });
    document.querySelectorAll("#topnav button,#botnav button").forEach(function (b) {
      b.setAttribute("aria-current", b.dataset.screen === name ? "true" : "false");
    });
    if (name === "carte") { ensureMap(); }
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-screen]");
    if (b) { e.preventDefault(); showScreen(b.dataset.screen); }
  });

  /* map (Leaflet + OSM) */
  var LMAP = null, MLAYER = null;
  function ensureMap() {
    var el = $("map"); if (!el) return;
    if (!mapInited) {
      if (typeof L === "undefined") { el.innerHTML = '<div style="padding:24px;font-family:monospace;font-size:13px;color:#6a5f52">Carte indisponible — connexion internet requise pour OpenStreetMap.</div>'; return; }
      LMAP = L.map(el, { scrollWheelZoom: false }).setView([7.4, -5.55], 6);
      LMAP.attributionControl.setPrefix("Leaflet");
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(LMAP);
      MLAYER = L.layerGroup().addTo(LMAP);
      mapInited = true;
      drawMarkers();
    } else if (LMAP) { setTimeout(function () { LMAP.invalidateSize(); }, 60); }
  }
  function drawMarkers() {
    if (!MLAYER) return;
    MLAYER.clearLayers();
    SITES.forEach(function (s, i) {
      var hq = hqJ(s), t = tier(hq), col = cget(t.v), act = i === sel;
      var r = 7 + Math.sqrt(s.pop) / 13;
      var m = L.circleMarker([s.lat, s.lon], { radius: r, color: act ? cget("--ink") : "#fff", weight: act ? 3 : 1.5, fillColor: col, fillOpacity: .88 });
      m.bindTooltip(s.nom + " — HQ " + fmt(hq, 1) + " · " + t.label, { direction: "top", offset: [0, -2] });
      m.on("click", (function (k) { return function () { selectSite(k); }; })(i));
      m.addTo(MLAYER);
      if (act) m.bringToFront();
    });
  }

  /* zone list */
  function renderZones() {
    var box = $("zlist"); if (!box) return;
    box.innerHTML = "";
    var order = SITES.map(function (s, i) { return i; }).sort(function (a, b) { return hqJ(SITES[b]) - hqJ(SITES[a]); });
    order.forEach(function (i) {
      var s = SITES[i], hq = hqJ(s), t = tier(hq);
      var b = document.createElement("button");
      b.className = "zrow"; b.setAttribute("aria-current", i === sel ? "true" : "false");
      b.innerHTML = '<span class="hq" style="color:' + cget(t.v) + '">' + fmt(hq, 1) + '</span>' +
        '<span class="nm">' + s.nom + '</span>' +
        '<span class="meta">' + s.pop.toLocaleString("fr-FR") + ' hab · ' + t.label + '</span>';
      b.addEventListener("click", function () { selectSite(i); });
      box.appendChild(b);
    });
  }

  /* selection */
  function selectSite(i) { sel = i; renderAll(); }

  /*  Investigation */
  function renderUne() {
    var s = SITES[sel], hq = hqJ(s), t = tier(hq), col = cget(t.v);
    $("u_hq").textContent = fmt(hq, 1) + "×"; $("u_hq").style.color = col;
    $("u_pop").textContent = s.pop.toLocaleString("fr-FR");
    $("u_child").textContent = children(s).toLocaleString("fr-FR");
    var pill = $("u_pill"); pill.style.background = cget(t.v) + "1e"; pill.style.color = col;
    pill.querySelector(".dot").style.background = col;
    $("u_pilltxt").textContent = "Risque " + t.label.toLowerCase();
    $("u_zone").textContent = s.nom;
    $("u_zmeta").textContent = fmt(hq, 1) + "× la référence · " + s.pop.toLocaleString("fr-FR") + " exposés";
    $("u_zonefig").textContent = s.nom;
    drawProjection($("u_spark"), s, "statuquo", true);
  }

  /*  science */
  function renderScience() {
    var s = SITES[sel];
    $("sc_zone").textContent = s.nom;
    $("v_portion").textContent = A.portion + " g"; $("v_meals").textContent = A.meals; $("v_weight").textContent = A.weight + " kg";
    var df = doseFish(s), dw = doseWater(s);
    var hq = { JECFA: df / REF.JECFA, EFSA: df / REF.EFSA, EPA: df / REF.EPA };
    // bars
    var order = [["JECFA", "OMS · 0,229"], ["EFSA", "UE · 0,186"], ["EPA", "US · 0,100"]];
    var scaleMax = Math.max(Math.ceil(Math.max(hq.EPA, hq.JECFA, hq.EFSA, 1.2) * 1.1), 2);
    var box = $("bars"); box.innerHTML = "";
    order.forEach(function (o) {
      var val = hq[o[0]], t = tier(val), col = cget(t.v), w = Math.max(val / scaleMax * 100, 1), inside = w > 18;
      var row = document.createElement("div"); row.className = "barrow";
      row.innerHTML = '<div class="rl">' + o[0] + '<small>' + o[1] + '</small></div>' +
        '<div class="track"><div class="thresh" style="left:' + (1 / scaleMax * 100) + '%"></div>' +
        '<div class="fill" style="width:' + w + '%;background:' + col + '"><span class="fv' + (inside ? '' : ' out') + '">' + fmt(val, 1) + ' · ' + t.label + '</span></div></div>';
      box.appendChild(row);
    });
    // doses
    $("d_fish").textContent = fmt(df, 2); $("d_fish").style.color = cget(tier(hq.JECFA).v);
    $("d_water").textContent = fmt(dw, 3);
  }

  /* projection */
  var YEARS = []; for (var y = 2024; y <= 2034; y++) YEARS.push(y);
  var TODAY = 2026;
  function projSeries(base, sc) {
    return YEARS.map(function (yr, i) {
      var f = sc === "statuquo" ? 1 + 0.02 * i : sc === "reduc" ? Math.max(0.1, 1 - 0.03 * i) : Math.exp(-0.16 * i);
      return base * f;
    });
  }
  function drawProjection(container, site, sc, compact) {
    if (!container) return;
    var base = hqJ(site), mid = projSeries(base, sc);
    var ti = YEARS.indexOf(TODAY);
    var lo = mid.map(function (v, i) { var sp = i <= ti ? 0.06 : 0.06 + 0.03 * (i - ti); return v * (1 - sp); });
    var hi = mid.map(function (v, i) { var sp = i <= ti ? 0.06 : 0.06 + 0.03 * (i - ti); return v * (1 + sp); });
    var W = compact ? 300 : 300, H = compact ? 92 : 170, PL = compact ? 6 : 26, PR = 6, PT = compact ? 8 : 16, PB = compact ? 4 : 22;
    var yMax = Math.max(2, Math.ceil(Math.max.apply(null, hi.concat([base])) * 1.05));
    var x = function (i) { return PL + (i / (YEARS.length - 1)) * (W - PL - PR); };
    var yv = function (v) { return PT + (1 - v / yMax) * (H - PT - PB); };
    var col = cget("--orange");
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" style="display:block">';
    // ref line HQ=1
    svg += '<line x1="' + PL + '" y1="' + yv(1) + '" x2="' + (W - PR) + '" y2="' + yv(1) + '" stroke="' + cget("--green") + '" stroke-width="1" stroke-dasharray="4 3"/>';
    if (!compact) svg += '<text x="' + (PL + 2) + '" y="' + (yv(1) - 4) + '" style="font:600 8px \'IBM Plex Mono\';fill:' + cget("--green") + '">RÉF. HQ 1</text>';
    // cone
    var area = "M";
    hi.forEach(function (v, i) { area += (i ? "L" : "") + x(i).toFixed(1) + " " + yv(v).toFixed(1) + " "; });
    for (var i = lo.length - 1; i >= 0; i--) { area += "L" + x(i).toFixed(1) + " " + yv(lo[i]).toFixed(1) + " "; }
    area += "Z";
    svg += '<path d="' + area + '" fill="' + col + '" opacity=".12"/>';
    // main line: past solid, future dashed
    function seg(a, b, dash) { var d = "M"; for (var i = a; i <= b; i++)d += (i > a ? "L" : "") + x(i).toFixed(1) + " " + yv(mid[i]).toFixed(1) + " "; return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (compact ? 2 : 2.6) + '"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>'; }
    svg += seg(0, ti, false) + seg(ti, YEARS.length - 1, true);
    // today marker
    svg += '<line x1="' + x(ti) + '" y1="' + PT + '" x2="' + x(ti) + '" y2="' + (H - PB) + '" stroke="' + cget("--line-2") + '" stroke-dasharray="3 3"/>';
    svg += '<circle cx="' + x(ti) + '" cy="' + yv(mid[ti]) + '" r="' + (compact ? 3 : 4) + '" fill="#fff" stroke="' + col + '" stroke-width="2.2"/>';
    svg += '<circle cx="' + x(YEARS.length - 1) + '" cy="' + yv(mid[YEARS.length - 1]) + '" r="' + (compact ? 2.6 : 3.4) + '" fill="' + col + '"/>';
    if (!compact) {
      svg += '<text x="' + x(ti) + '" y="' + (PT - 4) + '" text-anchor="middle" style="font:600 8px \'IBM Plex Mono\';fill:' + cget("--faint") + '">AUJ. ' + TODAY + '</text>';
      svg += '<text x="' + (PL - 3) + '" y="' + (yv(yMax) + 8) + '" text-anchor="end" style="font:500 8px \'IBM Plex Mono\';fill:' + cget("--faintest") + '">' + yMax + '</text>';
      svg += '<text x="' + (PL - 3) + '" y="' + yv(0) + '" text-anchor="end" style="font:500 8px \'IBM Plex Mono\';fill:' + cget("--faintest") + '">0</text>';
      svg += '<text x="' + PL + '" y="' + (H - 4) + '" style="font:500 8px \'IBM Plex Mono\';fill:' + cget("--faintest") + '">2024</text>';
      svg += '<text x="' + (W - PR) + '" y="' + (H - 4) + '" text-anchor="end" style="font:500 8px \'IBM Plex Mono\';fill:' + cget("--faintest") + '">2034</text>';
    }
    svg += '</svg>';
    container.innerHTML = svg;
  }
  function renderProjection() {
    var s = SITES[sel];
    drawProjection($("projChart"), s, scen, false);
    var mid = projSeries(hqJ(s), scen);
    $("p_now").textContent = fmt(mid[YEARS.indexOf(TODAY)], 1); $("p_now").style.color = cget(tier(mid[YEARS.indexOf(TODAY)]).v);
    var end = mid[mid.length - 1];
    $("p_2034").textContent = fmt(end, 1); $("p_2034").style.color = cget(tier(end).v);
    $("p_zone").textContent = s.nom;
  }

  /* Module 2 : toxicogenomics */
  var activeCat = null;
  function catColor(c) { return "var(--cat-" + c + ")"; }
  function renderEnrich() {
    var box = $("enrBars"); if (!box || !TOX.enrich) return;
    box.innerHTML = "";
    var maxN = Math.max.apply(null, TOX.enrich.map(function (e) { return e.n; }));
    TOX.enrich.forEach(function (e) {
      var row = document.createElement("div"); row.className = "enrow";
      row.innerHTML = '<div class="el">' + e.label + '</div><div class="et"><i style="width:' + (e.n / maxN * 100) + '%;background:' + catColor(e.cat) + '"></i></div><div class="en">' + e.n + '</div>';
      box.appendChild(row);
    });
  }
  function renderGenes() {
    var body = $("geneBody"); if (!body) return;
    var rows = TOX.nodes.filter(function (n) { return !activeCat || n.cat === activeCat; });
    body.innerHTML = "";
    rows.forEach(function (n) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td class="g">' + n.g + '</td><td>' + n.name + '</td><td>' + n.act + '</td>' +
        '<td><span class="gcat"><span class="cd" style="background:' + catColor(n.cat) + '"></span>' + TOX.pathways[n.cat] + '</span></td>' +
        '<td><span class="evpill ev-' + n.ev + '">' + n.ev + '</span></td>';
      body.appendChild(tr);
    });
  }
  function buildChips() {
    var box = $("geneChips"); if (!box) return;
    var all = document.createElement("button"); all.className = "chip"; all.type = "button"; all.setAttribute("aria-pressed", "true"); all.textContent = "Toutes les voies";
    all.addEventListener("click", function () { activeCat = null; syncChips(); renderGenes(); highlightNet(); });
    box.appendChild(all);
    Object.keys(TOX.pathways).forEach(function (c) {
      var b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.setAttribute("aria-pressed", "false"); b.dataset.cat = c;
      b.innerHTML = '<span class="cd" style="background:' + catColor(c) + '"></span>' + TOX.pathways[c];
      b.addEventListener("click", function () { activeCat = (activeCat === c ? null : c); syncChips(); renderGenes(); highlightNet(); });
      box.appendChild(b);
    });
  }
  function syncChips() {
    document.querySelectorAll("#geneChips .chip").forEach(function (ch) {
      var on = ch.dataset.cat ? ch.dataset.cat === activeCat : !activeCat;
      ch.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  var netEls = {};
  function buildNet() {
    var svg = $("netSvg"); if (!svg || !TOX.nodes.length) return;
    var W = 720, H = 440, P = 34, idx = {};
    TOX.nodes.forEach(function (n) { idx[n.g] = n; });
    function nx(x) { return P + x * (W - 2 * P); } function ny(y) { return P + y * (H - 2 * P); }
    var maxdeg = Math.max.apply(null, TOX.nodes.map(function (n) { return n.deg; }));
    var ge = mk("g", { stroke: "var(--line-2)", "stroke-width": "1", opacity: ".7" });
    TOX.edges.forEach(function (e) { var a = idx[e[0]], b = idx[e[1]]; if (!a || !b) return; var l = mk("line", { x1: nx(a.x), y1: ny(a.y), x2: nx(b.x), y2: ny(b.y) }); l.dataset.a = e[0]; l.dataset.b = e[1]; ge.appendChild(l); });
    svg.appendChild(ge);
    var nbr = {}; TOX.edges.forEach(function (e) { (nbr[e[0]] = nbr[e[0]] || {})[e[1]] = 1; (nbr[e[1]] = nbr[e[1]] || {})[e[0]] = 1; });
    netEls = { __edges: [].slice.call(ge.children), __nbr: nbr };
    var gn = mk("g", {});
    TOX.nodes.forEach(function (n) {
      var r = 6 + n.deg / maxdeg * 9, hub = TOX.hubs.indexOf(n.g) >= 0;
      var g = mk("g", { "class": "netnode", tabindex: "0", role: "button" });
      g.setAttribute("aria-label", n.g + " — " + n.name + ", " + n.deg + " connexions");
      var c = mk("circle", { cx: nx(n.x), cy: ny(n.y), r: r, fill: catColor(n.cat), opacity: ".9", stroke: "#fff", "stroke-width": "1.5" });
      var t = mk("text", { x: nx(n.x), y: ny(n.y) - r - 3, "text-anchor": "middle" }); t.textContent = n.g; t.style.opacity = hub ? "1" : "0";
      g.appendChild(c); g.appendChild(t);
      netEls[n.g] = { c: c, t: t, hub: hub, node: n };
      function show() { $("netTip").innerHTML = '<b>' + n.g + '</b> — ' + n.name + ' · ' + TOX.pathways[n.cat] + ' · ' + n.act + ' · ' + n.deg + ' connexions'; focusNode(n.g); }
      g.addEventListener("mouseenter", show); g.addEventListener("focus", show);
      g.addEventListener("mouseleave", function () { focusNode(null); }); g.addEventListener("blur", function () { focusNode(null); });
      gn.appendChild(g);
    });
    svg.appendChild(gn);
  }
  function focusNode(gn) {
    var nbr = netEls.__nbr || {};
    for (var k in netEls) {
      if (k[0] === "_") continue; var e = netEls[k];
      var near = gn && (k === gn || (nbr[gn] && nbr[gn][k]));
      e.c.setAttribute("opacity", gn ? (near ? ".95" : ".18") : ".9");
      e.t.style.opacity = gn ? (near ? "1" : "0") : (e.hub ? "1" : "0");
    }
    (netEls.__edges || []).forEach(function (l) {
      var on = gn && (l.dataset.a === gn || l.dataset.b === gn);
      l.setAttribute("opacity", gn ? (on ? ".9" : ".08") : ".7");
      l.setAttribute("stroke", on ? "var(--red)" : "var(--line-2)");
    });
  }
  function highlightNet() {
    for (var k in netEls) {
      if (k[0] === "_") continue; var e = netEls[k];
      var dim = activeCat && e.node.cat !== activeCat;
      e.c.setAttribute("opacity", dim ? ".14" : ".9");
      e.t.style.opacity = (activeCat ? (e.node.cat === activeCat && e.hub ? "1" : "0") : (e.hub ? "1" : "0"));
    }
  }

  /* CSV import 
  function parseCSV(text) {
    var lines = text.replace(/\r/g, "").split("\n").filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var head = lines[0].split(",").map(function (h) { return h.trim(); });
    var idx = {}; head.forEach(function (h, i) { idx[h] = i; });
    var num = function (v) { var x = parseFloat(v); return isNaN(x) ? null : x; };
    return lines.slice(1).map(function (l) {
      var c = l.split(",");
      return {
        nom: c[idx.nom_site] || "?", lat: num(c[idx.latitude]), lon: num(c[idx.longitude]),
        hgFish: num(c[idx.hg_poisson_ugkg]), hgWater: num(c[idx.hg_eau_ugL]),
        pop: parseInt(c[idx.population] || "0", 10) || 0, pctPreg: num(c[idx.pct_enceintes]),
        pctChild: num(c[idx.pct_enfants]), distKm: num(c[idx.distance_orpaillage_km])
      };
    }).filter(function (s) { return s.lat != null && s.lon != null; });
  }
  function initCSV() {
    var inp = $("csv"); if (!inp) return;
    inp.addEventListener("change", function () {
      var f = inp.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var rows = parseCSV(rd.result);
          if (rows.length) { SITES = rows; sel = 0; if (mapInited && LMAP) { drawMarkers(); LMAP.setView([SITES[0].lat, SITES[0].lon], 6); } renderAll(); }
        } catch (e) { alert("CSV illisible : " + e.message); }
      };
      rd.readAsText(f);
    });
  }*/

  /*  assumptions  */
  function initControls() {
    ["portion", "meals", "weight"].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener("input", function () { A[id] = +el.value; if (mapInited) drawMarkers(); renderAll(); });
    });
    document.querySelectorAll("#scenTabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        scen = b.dataset.s;
        document.querySelectorAll("#scenTabs button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        renderProjection();
      });
    });
  }

  /*  consequences par seuil  */
  var CQ = {
    faible: {
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
      horizon: { immediat: "Surveiller l'eau et les rejets.", court: "Établir une mesure de référence (poisson, eau).", long: "Suivi environnemental de fond." }
    },
    modere: {
      lead: "Dépassement du seuil : premiers signaux d'alerte. Une investigation complémentaire est recommandée.",
      env: ["Mercure détectable dans les sédiments.", "Début de bioaccumulation chez les poissons prédateurs.", "Eau parfois troublée en aval des sites."],
      health: {
        enceintes: "Surveiller l'exposition alimentaire — le fœtus est la cible prioritaire du seuil.",
        enfants: "Limiter les espèces les plus contaminées ; suivi du développement.",
        orpailleurs: "Protection respiratoire ; surveillance rénale conseillée.",
        consommateurs: "Réduire la fréquence des gros poissons prédateurs."
      },
      horizon: { immediat: "Réduire l'exposition des groupes sensibles.", court: "Confirmer par des mesures poisson/eau.", long: "Suivre la bioaccumulation." }
    },
    eleve: {
      lead: "Exposition nettement au-dessus de la référence : surveillance sanitaire prioritaire.",
      env: ["Eau souvent colorée/turbide en aval de l'orpaillage.", "Poissons accumulateurs fréquemment au-dessus du seuil Codex 0,5 mg/kg.", "Sédiments contaminés ; méthylation active en milieu humide.", "Chaîne alimentaire aquatique touchée."],
      health: {
        enceintes: "Risque d'atteinte du neurodéveloppement fœtal — éviter les espèces les plus contaminées.",
        enfants: "Effets à surveiller : cognition, motricité, audition, vision.",
        orpailleurs: "Effets neurologiques et rénaux possibles (vapeurs Hg°) ; biosurveillance.",
        consommateurs: "Effets neurologiques ; risque cardiovasculaire possible."
      },
      horizon: { immediat: "Alerter la zone ; sécuriser l'eau ; réduire la consommation.", court: "Biosurveillance (cheveux/sang) ; suivi maternel & enfants.", long: "Cohortes longitudinales ; dépollution des sédiments." }
    },
    urgent: {
      lead: "Contamination très élevée : action urgente et confirmation analytique requises.",
      env: ["Contamination généralisée eau–sédiments–poissons.", "Méthylation intense ; méthylmercure élevé dans toute la chaîne.", "Biodiversité aquatique menacée ; sols et nappes exposés.", "Eau impropre à la consommation directe."],
      health: {
        enceintes: "Risque élevé pour le neurodéveloppement fœtal — protection immédiate.",
        enfants: "Atteintes neurodéveloppementales possibles ; éloigner des sources.",
        orpailleurs: "Atteintes neurologiques, rénales et respiratoires ; retrait de l'exposition.",
        consommateurs: "Forte exposition au méthylmercure ; arrêt des espèces à risque."
      },
      horizon: { immediat: "Limiter/interdire la consommation ; protéger l'eau ; confirmer les mesures.", court: "Prise en charge sanitaire des groupes exposés.", long: "Restauration environnementale ; surveillance de longue durée." }
    }
  };
  var CQGROUPS = [["Femmes enceintes & fœtus", "enceintes"], ["Nourrissons & enfants", "enfants"], ["Orpailleurs", "orpailleurs"], ["Gros consommateurs de poisson", "consommateurs"]];
  function renderConsequences() {
    if (!$("cq_env")) return;
    var s = SITES[sel], hq = hqJ(s), t = tier(hq), col = cget(t.v), c = CQ[t.k] || CQ.faible;
    var pill = $("cq_pill"); pill.style.background = col + "1e"; pill.style.color = col; pill.querySelector(".dot").style.background = col;
    $("cq_pilltxt").textContent = "Risque " + t.label.toLowerCase();
    $("cq_zone").textContent = s.nom;
    $("cq_conc").textContent = (s.hgFish != null ? fmt(s.hgFish, 0) : "—");
    $("cq_hq").textContent = fmt(hq, 1); $("cq_hq").style.color = col;
    $("cq_lead").textContent = c.lead;
    $("cq_env").innerHTML = c.env.map(function (e) { return "<li>" + e + "</li>"; }).join("");
    $("cq_health").innerHTML = CQGROUPS.map(function (g) {
      return '<div class="cq-grp"><div class="cq-gn">' + g[0] + '</div><div class="cq-ge">' + c.health[g[1]] + '</div></div>';
    }).join("");
    var H = c.horizon;
    $("cq_horizon").innerHTML = [["Immédiat", H.immediat, "--red"], ["Court / moyen", H.court, "--gold"], ["Long terme", H.long, "--green"]].map(function (h) {
      return '<div class="cq-hz" style="border-left-color:var(' + h[2] + ')"><div class="cq-ht" style="color:var(' + h[2] + ')">' + h[0] + '</div><div class="cq-hd">' + h[1] + '</div></div>';
    }).join("");
  }

  /*  render all  */
  function renderAll() {
    renderUne(); renderZones(); renderScience(); renderProjection(); renderConsequences();
    if (mapInited) drawMarkers();
  }

  /*  science sub-tabs  */
  document.querySelectorAll("#sciTabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      var key = b.dataset.sci;
      document.querySelectorAll("#sciTabs button").forEach(function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      document.getElementById("sciTab-meca").style.display = key === "meca" ? "" : "none";
      document.getElementById("sciTab-bio").style.display = key === "bio" ? "" : "none";
    });
  });

  /*  init  */
  buildChips(); syncChips(); renderGenes(); renderEnrich(); buildNet();
  initControls();
  ensureMap();
  renderAll();
})();
