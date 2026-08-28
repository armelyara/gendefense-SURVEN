/* GenDefense · SURVEN — application */
(function () {
  "use strict";
  if (!window.GD) { console.error("core.js manquant (doit être chargé avant app.js)"); return; }
  var GD = window.GD, el = GD.el, esc = GD.esc, fmt = GD.fmt, color = GD.color, risk = GD.risk;
  var $ = function (id) { return document.getElementById(id); };
  var NS = "http://www.w3.org/2000/svg";
  function mk(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }

  var SITES = (window.MS_SITES || []).slice();
  var GEO = window.MS_GEO || { civ: [], neighbors: {}, bbox: [-8.6, 4.3, -2.5, 10.5] };
  var TOX = window.MS_TOX || { nodes: [], edges: [], pathways: {}, enrich: [], hubs: [] };

  var A = { portion: 200, meals: 7, weight: 60, waterL: 2 };
  var sel = 0;
  var scen = "statuquo";
  var cnConc = 40;                 // cyanure dans l'eau (µg/L), hypothèse ajustable
  var current = "une";
  var mapInited = false, LMAP = null, MLAYER = null;

  function hqJ(s) { return GD.hq(s, A); }

  /* navigation */
  var RENDER = {
    une: renderUne,
    carte: function () { renderZones(); drawMarkers(); },
    exposes: renderExposes,
    consequences: renderConsequences,
    projection: renderProjection,
    agir: renderAgir,
    science: renderScience
  };
  function renderActive() { (RENDER[current] || function () { })(); }

  function showScreen(name) {
    current = name;
    Object.keys(RENDER).forEach(function (n) { var s = $("s-" + n); if (s) s.classList.toggle("active", n === name); });
    document.querySelectorAll("#topnav button,#botnav button").forEach(function (b) {
      b.setAttribute("aria-current", b.dataset.screen === name ? "true" : "false");
    });
    if (name === "carte") ensureMap();
    renderActive();
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-screen]");
    if (b) { e.preventDefault(); showScreen(b.dataset.screen); }
  });

  function selectSite(i) { sel = i; renderActive(); if (mapInited) drawMarkers(); }

  /* map */
  function ensureMap() {
    var box = $("map"); if (!box) return;
    if (!mapInited) {
      if (typeof L === "undefined") { box.appendChild(el("div", { style: "padding:24px;font-family:monospace;font-size:13px;color:#6a5f52", text: "Carte indisponible — connexion internet requise pour OpenStreetMap." })); return; }
      LMAP = L.map(box, { scrollWheelZoom: false }).setView([7.4, -5.55], 6);
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
    var ink = color("--ink");
    SITES.forEach(function (s, i) {
      var hq = hqJ(s), t = risk(hq), col = color(t.token), act = i === sel;
      var m = L.circleMarker([s.lat, s.lon], { radius: 7 + Math.sqrt(s.pop) / 13, color: act ? ink : "#fff", weight: act ? 3 : 1.5, fillColor: col, fillOpacity: .88 });
      m.bindTooltip(esc(s.nom) + " — HQ " + fmt(hq, 1) + " · " + t.label, { direction: "top", offset: [0, -2] });  // esc : anti-XSS
      m.on("click", (function (k) { return function () { selectSite(k); }; })(i));
      m.addTo(MLAYER);
      if (act) m.bringToFront();
    });
  }

  /* zone list */
  function renderZones() {
    var box = $("zlist"); if (!box) return;
    var order = SITES.map(function (s, i) { return i; }).sort(function (a, b) { return hqJ(SITES[b]) - hqJ(SITES[a]); });
    var frag = document.createDocumentFragment();
    order.forEach(function (i) {
      var s = SITES[i], hq = hqJ(s), t = risk(hq);
      var b = el("button", { "class": "zrow", "aria-current": i === sel ? "true" : "false" }, [
        el("span", { "class": "hq", style: "color:" + color(t.token), text: fmt(hq, 1) }),
        el("span", { "class": "nm", text: s.nom }),                                   // text : anti-XSS
        el("span", { "class": "meta", text: s.pop.toLocaleString("fr-FR") + " hab · " + t.label })
      ]);
      b.addEventListener("click", (function (k) { return function () { selectSite(k); }; })(i));
      frag.appendChild(b);
    });
    box.textContent = ""; box.appendChild(frag);
  }

  /* homepage */
  function renderUne() {
    var s = SITES[sel]; if (!$("u_hq")) return;
    var hq = hqJ(s), t = risk(hq), col = color(t.token);
    $("u_hq").textContent = fmt(hq, 1) + "×"; $("u_hq").style.color = col;
    $("u_pop").textContent = s.pop.toLocaleString("fr-FR");
    $("u_child").textContent = GD.children(s).toLocaleString("fr-FR");
    var pill = $("u_pill"); pill.style.background = col + "1e"; pill.style.color = col;
    pill.querySelector(".dot").style.background = col;
    $("u_pilltxt").textContent = "Risque " + t.label.toLowerCase();
    $("u_zone").textContent = s.nom;
    $("u_zmeta").textContent = fmt(hq, 1) + "× la référence · " + s.pop.toLocaleString("fr-FR") + " exposés";
    $("u_zonefig").textContent = s.nom;
    drawProjection($("u_spark"), s, "statuquo", true);
  }

  /* Science */
  function renderScience() {
    var s = SITES[sel]; if (!$("bars")) return;
    $("sc_zone").textContent = s.nom;
    $("v_portion").textContent = A.portion + " g"; $("v_meals").textContent = A.meals; $("v_weight").textContent = A.weight + " kg";
    var df = GD.doseFish(s, A), dw = GD.doseWater(s, A), hq = GD.hqAll(s, A);
    var order = [["JECFA", "OMS · 0,229"], ["EFSA", "UE · 0,186"], ["EPA", "US · 0,100"]];
    var scaleMax = Math.max(Math.ceil(Math.max(hq.EPA, hq.JECFA, hq.EFSA, 1.2) * 1.1), 2);
    var box = $("bars"); var frag = document.createDocumentFragment();
    order.forEach(function (o) {
      var val = hq[o[0]], t = risk(val), col = color(t.token), w = Math.max(val / scaleMax * 100, 1), inside = w > 18;
      var fv = el("span", { "class": "fv" + (inside ? "" : " out"), text: fmt(val, 1) + " · " + t.label });
      var fill = el("div", { "class": "fill", style: "width:" + w + "%;background:" + col }, [fv]);
      var track = el("div", { "class": "track" }, [el("div", { "class": "thresh", style: "left:" + (1 / scaleMax * 100) + "%" }), fill]);
      var rl = el("div", { "class": "rl" }, [o[0], el("small", { text: o[1] })]);
      frag.appendChild(el("div", { "class": "barrow" }, [rl, track]));
    });
    box.textContent = ""; box.appendChild(frag);
    $("d_fish").textContent = fmt(df, 2); $("d_fish").style.color = color(risk(hq.JECFA).token);
    $("d_water").textContent = fmt(dw, 3);
    renderCyanide();
  }

  /* Cyanure — contaminant distinct (voie eau), jamais additionné au mercure */
  function renderCyanide() {
    if (!$("cnConc")) return;
    var C = GD.CYANIDE;
    $("cn_mech").textContent = C.mech;
    $("cn_aigu").textContent = C.aigu;
    $("cn_chronique").textContent = C.chronique;
    $("cn_cas").textContent = C.cas;
    $("cn_ref").textContent = C.ref;
    $("v_cn").textContent = cnConc + " µg/L";
    var dose = GD.doseCyanide(cnConc, A), h = GD.hqCyanide(cnConc, A), t = risk(h), col = color(t.token);
    $("cn_dose").textContent = fmt(dose, 3);
    $("cn_hq").textContent = fmt(h, 1); $("cn_hq").style.color = col;
    var pill = $("cn_pill"); pill.style.background = col + "1e"; pill.style.color = col;
    pill.querySelector(".dot").style.background = col;
    $("cn_pilltxt").textContent = "Risque " + t.label.toLowerCase();
  }

  /* projection */
  var YEARS = []; for (var y = 2024; y <= 2034; y++) YEARS.push(y);
  var TODAY = new Date().getFullYear();
  function projSeries(base, sc) {
    return YEARS.map(function (yr, i) {
      var f = sc === "statuquo" ? 1 + 0.02 * i : sc === "reduc" ? Math.max(0.1, 1 - 0.03 * i) : Math.exp(-0.16 * i);
      return base * f;
    });
  }
  function drawProjection(container, site, sc, compact) {
    if (!container) return;
    var base = hqJ(site), mid = projSeries(base, sc);
    var ti = Math.max(0, Math.min(YEARS.length - 1, YEARS.indexOf(TODAY) < 0 ? 2 : YEARS.indexOf(TODAY)));
    var lo = mid.map(function (v, i) { var sp = i <= ti ? 0.06 : 0.06 + 0.03 * (i - ti); return v * (1 - sp); });
    var hi = mid.map(function (v, i) { var sp = i <= ti ? 0.06 : 0.06 + 0.03 * (i - ti); return v * (1 + sp); });
    var W = 300, H = compact ? 92 : 170, PL = compact ? 6 : 26, PR = 6, PT = compact ? 8 : 16, PB = compact ? 4 : 22;
    var yMax = Math.max(2, Math.ceil(Math.max.apply(null, hi.concat([base])) * 1.05));
    var x = function (i) { return PL + (i / (YEARS.length - 1)) * (W - PL - PR); };
    var yv = function (v) { return PT + (1 - v / yMax) * (H - PT - PB); };
    var col = color("--orange"), green = color("--green");
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" style="display:block">';
    svg += '<line x1="' + PL + '" y1="' + yv(1) + '" x2="' + (W - PR) + '" y2="' + yv(1) + '" stroke="' + green + '" stroke-width="1" stroke-dasharray="4 3"/>';
    if (!compact) svg += '<text x="' + (PL + 2) + '" y="' + (yv(1) - 4) + '" style="font:600 8px \'IBM Plex Mono\';fill:' + green + '">RÉF. HQ 1</text>';
    var area = "M";
    hi.forEach(function (v, i) { area += (i ? "L" : "") + x(i).toFixed(1) + " " + yv(v).toFixed(1) + " "; });
    for (var i = lo.length - 1; i >= 0; i--) area += "L" + x(i).toFixed(1) + " " + yv(lo[i]).toFixed(1) + " ";
    area += "Z";
    svg += '<path d="' + area + '" fill="' + col + '" opacity=".12"/>';
    function seg(a, b, dash) { var d = "M"; for (var j = a; j <= b; j++)d += (j > a ? "L" : "") + x(j).toFixed(1) + " " + yv(mid[j]).toFixed(1) + " "; return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (compact ? 2 : 2.6) + '"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>'; }
    svg += seg(0, ti, false) + seg(ti, YEARS.length - 1, true);
    svg += '<line x1="' + x(ti) + '" y1="' + PT + '" x2="' + x(ti) + '" y2="' + (H - PB) + '" stroke="' + color("--line-2") + '" stroke-dasharray="3 3"/>';
    svg += '<circle cx="' + x(ti) + '" cy="' + yv(mid[ti]) + '" r="' + (compact ? 3 : 4) + '" fill="#fff" stroke="' + col + '" stroke-width="2.2"/>';
    svg += '<circle cx="' + x(YEARS.length - 1) + '" cy="' + yv(mid[YEARS.length - 1]) + '" r="' + (compact ? 2.6 : 3.4) + '" fill="' + col + '"/>';
    if (!compact) {
      svg += '<text x="' + x(ti) + '" y="' + (PT - 4) + '" text-anchor="middle" style="font:600 8px \'IBM Plex Mono\';fill:' + color("--faint") + '">AUJ. ' + YEARS[ti] + '</text>';
      svg += '<text x="' + (PL - 3) + '" y="' + (yv(yMax) + 8) + '" text-anchor="end" style="font:500 8px \'IBM Plex Mono\';fill:' + color("--faintest") + '">' + yMax + '</text>';
      svg += '<text x="' + (PL - 3) + '" y="' + yv(0) + '" text-anchor="end" style="font:500 8px \'IBM Plex Mono\';fill:' + color("--faintest") + '">0</text>';
      svg += '<text x="' + PL + '" y="' + (H - 4) + '" style="font:500 8px \'IBM Plex Mono\';fill:' + color("--faintest") + '">2024</text>';
      svg += '<text x="' + (W - PR) + '" y="' + (H - 4) + '" text-anchor="end" style="font:500 8px \'IBM Plex Mono\';fill:' + color("--faintest") + '">2034</text>';
    }
    svg += '</svg>';
    container.innerHTML = svg;
  }
  function renderProjection() {
    var s = SITES[sel]; if (!$("projChart")) return;
    drawProjection($("projChart"), s, scen, false);
    var mid = projSeries(hqJ(s), scen), tiv = mid[Math.max(0, YEARS.indexOf(TODAY) < 0 ? 2 : YEARS.indexOf(TODAY))];
    $("p_now").textContent = fmt(tiv, 1); $("p_now").style.color = color(risk(tiv).token);
    var end = mid[mid.length - 1];
    $("p_2034").textContent = fmt(end, 1); $("p_2034").style.color = color(risk(end).token);
    $("p_zone").textContent = s.nom;
  }

  /* consequences */
  function renderConsequences() {
    if (!$("cq_env")) return;
    var s = SITES[sel], hq = hqJ(s), t = risk(hq), col = color(t.token);
    var pill = $("cq_pill"); pill.style.background = col + "1e"; pill.style.color = col; pill.querySelector(".dot").style.background = col;
    $("cq_pilltxt").textContent = "Risque " + t.label.toLowerCase();
    $("cq_zone").textContent = s.nom;
    $("cq_conc").textContent = (s.hgFish != null ? fmt(s.hgFish, 0) : "—");
    $("cq_hq").textContent = fmt(hq, 1); $("cq_hq").style.color = col;
    $("cq_lead").textContent = t.lead;
    fillList($("cq_env"), (t.env || []).map(function (e) { return el("li", { text: e }); }));
    fillList($("cq_health"), GD.GROUPS.map(function (g) {
      return el("div", { "class": "cq-grp" }, [el("div", { "class": "cq-gn", text: g.nom }), el("div", { "class": "cq-ge", text: (t.health && t.health[g.key]) || "" })]);
    }));
    var H = t.agir ? { immediat: t.agir.immediat, court: t.agir.moyen, long: t.agir.long } : { immediat: [], court: [], long: [] };
    var horizonSummary = [["Immédiat", H.immediat[0] || "—", "--red"], ["Court / moyen", H.court[0] || "—", "--gold"], ["Long terme", H.long[0] || "—", "--green"]];
    fillList($("cq_horizon"), horizonSummary.map(function (h) {
      return el("div", { "class": "cq-hz", style: "border-left-color:var(" + h[2] + ")" }, [
        el("div", { "class": "cq-ht", style: "color:var(" + h[2] + ")", text: h[0] }), el("div", { "class": "cq-hd", text: h[1] })]);
    }));
  }
  function fillList(box, nodes) { if (!box) return; box.textContent = ""; nodes.forEach(function (n) { box.appendChild(n); }); }

  /* Exposed */
  function svgIcon(inner) { var s = mk("svg", { viewBox: "0 0 24 24" }); s.innerHTML = inner; return s; }
  var ICONS = {
    enceintes: '<circle cx="12" cy="7" r="3.2"/><path d="M12 10.5c-1 3-1 6 0 10"/>',
    enfants: '<circle cx="12" cy="8" r="3"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>',
    orpailleurs: '<path d="M12 3v18M5 8l7 4 7-4"/>',
    consommateurs: '<path d="M4 14c3-6 13-6 16 0M8 14a4 4 0 0 0 8 0"/>'
  };
  function dots(n, col) {
    n = Math.max(1, Math.min(4, n));
    return [el("span", { style: "color:" + col, text: Array(n + 1).join("●") }), el("span", { style: "color:var(--line-2)", text: Array(4 - n + 1).join("○") })];
  }
  function renderExposes() {
    var box = $("exlist"); if (!box) return;
    var s = SITES[sel], t = risk(hqJ(s)), col = color(t.token), base = t.base || 1;
    if ($("ex_lead")) $("ex_lead").textContent = "Des effets à surveiller pour ces groupes — gravité pour " + s.nom + " (risque " + t.label.toLowerCase() + ").";
    fillList(box, GD.GROUPS.map(function (g) {
      var n = Math.max(1, Math.min(4, base + g.exBonus));
      var th = el("div", { "class": "th" }, [svgIcon(ICONS[g.key] || "")]);
      var txt = el("div", { style: "flex:1" }, [el("div", { "class": "nm", text: g.nom }), el("div", { "class": "d", text: g.desc })]);
      var sev = el("span", { "class": "sev" }, dots(n, col));
      return el("div", { "class": "exrow" }, [th, txt, sev]);
    }));
  }

  /* Take action */
  function renderAgir() {
    var box = $("agirBlocks"); if (!box) return;
    var s = SITES[sel], t = risk(hqJ(s)), a = t.agir || { immediat: [], moyen: [], long: [] };
    if ($("agir_lead")) $("agir_lead").textContent = "Priorités adaptées au risque de " + s.nom + " (HQ " + fmt(hqJ(s), 1) + ", risque " + t.label.toLowerCase() + ").";
    var steps = [["Immédiat", "0–3 mois", "--red", a.immediat], ["Moyen terme", "3–18 mois", "--gold", a.moyen], ["Long terme", "18 mois +", "--green", a.long]];
    fillList(box, steps.map(function (st) {
      var hh = el("div", { "class": "hh", style: "border-color:var(" + st[2] + ")" }, [el("h3", { style: "color:var(" + st[2] + ")", text: st[0] }), el("span", { "class": "when", text: st[1] })]);
      var ul = el("ul", null, (st[3] || []).map(function (li) { return el("li", { text: li }); }));
      return el("div", { "class": "hzblock" }, [hh, ul]);
    }));
  }

  /* toxicogenomic */
  var activeCat = null;
  function catColor(c) { return "var(--cat-" + c + ")"; }
  function renderEnrich() {
    var box = $("enrBars"); if (!box || !TOX.enrich) return;
    var maxN = Math.max.apply(null, TOX.enrich.map(function (e) { return e.n; }));
    fillList(box, TOX.enrich.map(function (e) {
      var bar = el("i", { style: "width:" + (e.n / maxN * 100) + "%;background:" + catColor(e.cat) });
      return el("div", { "class": "enrow" }, [el("div", { "class": "el", text: e.label }), el("div", { "class": "et" }, [bar]), el("div", { "class": "en", text: String(e.n) })]);
    }));
  }
  function renderGenes() {
    var body = $("geneBody"); if (!body) return;
    var rows = TOX.nodes.filter(function (n) { return !activeCat || n.cat === activeCat; });
    fillList(body, rows.map(function (n) {
      var cat = el("td", null, [el("span", { "class": "gcat" }, [el("span", { "class": "cd", style: "background:" + catColor(n.cat) }), TOX.pathways[n.cat] || ""])]);
      var ev = el("td", null, [el("span", { "class": "evpill ev-" + n.ev, text: n.ev })]);
      return el("tr", null, [el("td", { "class": "g", text: n.g }), el("td", { text: n.name }), el("td", { text: n.act }), cat, ev]);
    }));
  }
  function buildChips() {
    var box = $("geneChips"); if (!box) return;
    var all = el("button", { "class": "chip", type: "button", "aria-pressed": "true", text: "Toutes les voies" });
    all.addEventListener("click", function () { activeCat = null; syncChips(); renderGenes(); highlightNet(); });
    box.appendChild(all);
    Object.keys(TOX.pathways).forEach(function (c) {
      var b = el("button", { "class": "chip", type: "button", "aria-pressed": "false" }, [el("span", { "class": "cd", style: "background:" + catColor(c) }), TOX.pathways[c]]);
      b.dataset.cat = c;
      b.addEventListener("click", function () { activeCat = (activeCat === c ? null : c); syncChips(); renderGenes(); highlightNet(); });
      box.appendChild(b);
    });
  }
  function syncChips() { document.querySelectorAll("#geneChips .chip").forEach(function (ch) { var on = ch.dataset.cat ? ch.dataset.cat === activeCat : !activeCat; ch.setAttribute("aria-pressed", on ? "true" : "false"); }); }
  var netEls = {};
  function buildNet() {
    var svg = $("netSvg"); if (!svg || !TOX.nodes.length) return;
    var W = 720, H = 440, P = 34, idx = {};
    TOX.nodes.forEach(function (n) { idx[n.g] = n; });
    function nx(x) { return P + x * (W - 2 * P); } function ny(yy) { return P + yy * (H - 2 * P); }
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
      var tx = mk("text", { x: nx(n.x), y: ny(n.y) - r - 3, "text-anchor": "middle" }); tx.textContent = n.g; tx.style.opacity = hub ? "1" : "0";
      g.appendChild(c); g.appendChild(tx);
      netEls[n.g] = { c: c, t: tx, hub: hub, node: n };
      function show() { showTip(n); focusNode(n.g); }
      g.addEventListener("mouseenter", show); g.addEventListener("focus", show);
      g.addEventListener("mouseleave", function () { focusNode(null); }); g.addEventListener("blur", function () { focusNode(null); });
      gn.appendChild(g);
    });
    svg.appendChild(gn);
  }
  function showTip(n) {
    var tip = $("netTip"); if (!tip) return;
    fillList(tip, [el("b", { text: n.g }), " — " + n.name + " · " + (TOX.pathways[n.cat] || "") + " · " + n.act + " · " + n.deg + " connexions"]);
  }
  function focusNode(gn) {
    var nbr = netEls.__nbr || {};
    for (var k in netEls) { if (k[0] === "_") continue; var e = netEls[k]; var near = gn && (k === gn || (nbr[gn] && nbr[gn][k])); e.c.setAttribute("opacity", gn ? (near ? ".95" : ".18") : ".9"); e.t.style.opacity = gn ? (near ? "1" : "0") : (e.hub ? "1" : "0"); }
    (netEls.__edges || []).forEach(function (l) { var on = gn && (l.dataset.a === gn || l.dataset.b === gn); l.setAttribute("opacity", gn ? (on ? ".9" : ".08") : ".7"); l.setAttribute("stroke", on ? "var(--red)" : "var(--line-2)"); });
  }
  function highlightNet() { for (var k in netEls) { if (k[0] === "_") continue; var e = netEls[k]; var dim = activeCat && e.node.cat !== activeCat; e.c.setAttribute("opacity", dim ? ".14" : ".9"); e.t.style.opacity = (activeCat ? (e.node.cat === activeCat && e.hub ? "1" : "0") : (e.hub ? "1" : "0")); } }

  /* controls */
  function initControls() {
    ["portion", "meals", "weight"].forEach(function (id) {
      var e = $(id); if (!e) return;
      e.addEventListener("input", function () { A[id] = +e.value; renderActive(); if (mapInited) drawMarkers(); });
    });
    var cn = $("cnConc");
    if (cn) cn.addEventListener("input", function () { cnConc = +cn.value; renderCyanide(); });
    document.querySelectorAll("#scenTabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        scen = b.dataset.s;
        document.querySelectorAll("#scenTabs button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        if (current === "projection") renderProjection();
      });
    });
    document.querySelectorAll("#sciTabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.dataset.sci;
        document.querySelectorAll("#sciTabs button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        var m = $("sciTab-meca"), bi = $("sciTab-bio");
        if (m) m.style.display = key === "meca" ? "" : "none";
        if (bi) bi.style.display = key === "bio" ? "" : "none";
      });
    });
    // follow system theme : refresh color cache and re-render
    if (window.matchMedia) {
      var mq = matchMedia("(prefers-color-scheme: dark)");
      (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(function () { GD.refreshColors(); renderActive(); if (mapInited) drawMarkers(); });
    }
  }

  /* init */
  buildChips(); syncChips(); renderGenes(); renderEnrich(); buildNet();
  initControls();
  var startEl = document.querySelector(".screen.active");
  var start = startEl ? startEl.id.replace(/^s-/, "") : "carte";
  if (!RENDER[start]) start = "carte";
  showScreen(start);
})();
