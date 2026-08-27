/* GenDefense · enregistrement du service worker + bouton d'installation (externalisé pour la CSP) */
(function () {
  "use strict";
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { }); });
  }
  var deferred = null, btn = document.getElementById("installBtn");
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e; if (btn) btn.style.display = "inline-flex";
  });
  if (btn) btn.addEventListener("click", function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; btn.style.display = "none"; });
  });
  window.addEventListener("appinstalled", function () { if (btn) btn.style.display = "none"; });
})();
