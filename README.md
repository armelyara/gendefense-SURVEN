# GenDefense-SURVEN 

GenDefense est programme axée sur la surveillance biologique de la Côte d'Ivoire. 

Face à l'orpaillage clandestin, nous avons développé GenDefebnse-SURVEN dont le but est de prévenir le risque sanitaire lié au mercure de l'orpaillage clandestin en Côte d'Ivoire.
C'est une application web qui permet de visualiser les zones d'orpaillage clandestin et les risques sanitaires liés à l'utilisation du mercure dans l'orpaillage clandestin.

# Toxicologie computationnelle (dose, quotient de danger, carte) + toxicogénomique (gènes, voies, réseau).

## Lancer en local

Deux façons :

1. **Double-clic** sur `index.html` — s'ouvre dans le navigateur.
   La carte OpenStreetMap et les polices Google ont besoin d'internet ; le reste marche hors ligne.

2. **Serveur local** (recommandé, évite tout blocage navigateur) :
   ```bash
   cd mercuriscan
   python3 -m http.server 8000
   # puis ouvrir http://localhost:8000
   ```

## Installer comme application (PWA)

L'app est une **PWA installable** (icône sur le téléphone / le bureau, plein écran, hors-ligne).

⚠️ L'installation exige que l'app soit **servie en http/https** — pas en double-clic `file://`.

1. Lance un serveur local :
   ```bash
   cd mercuriscan
   python3 -m http.server 8000
   ```
2. Ouvre `http://localhost:8000` dans Chrome / Edge / Safari.
3. **Bureau** : bouton « ⤓ Installer » en haut à droite, ou l'icône d'installation dans la barre d'adresse.
   **Android** : menu ⋮ → « Installer l'application ».
   **iOS Safari** : Partager → « Sur l'écran d'accueil ».

Une fois installée, elle fonctionne **hors-ligne** (sauf le fond de carte OpenStreetMap et les polices, qui ont besoin d'internet la première fois ; ils sont ensuite mis en cache).

Pour un vrai déploiement, héberge le dossier sur n'importe quel hébergeur statique (Netlify, GitHub Pages, Vercel…) — l'installation marchera pour tes utilisateurs.

### Mettre à jour l'app installée
Change le `CACHE` (build id) en haut de `sw.js` à chaque déploiement — le service worker recharge alors les nouveaux fichiers.

## Structure

```
mercuriscan/
├── index.html        structure (aucune logique)
├── styles.css        toute la mise en forme (charte « Récit éditorial »)
├── app.js            toute la logique (calculs, carte, graphes, réseau)
├── data/
│   ├── sites.js      les 6 sites mesurés (issus de sites.csv)
│   ├── geo.js        tracé Côte d'Ivoire + voisins (Natural Earth)
│   └── tox.js        gènes / voies / réseau (toxicogénomique curée)
├── vendor/
│   ├── leaflet.js    carte (local, aucune dépendance externe)
│   └── leaflet.css
├── manifest.webmanifest  déclaration PWA (nom, icônes, couleurs)
├── sw.js             service worker (cache hors-ligne)
├── icons/            icônes de l'app (192, 512, maskable, apple-touch)
├── sites.csv         tes mesures — modifiable
└── README.md
```

## Changer les données

- Édite `sites.csv` puis régénère `data/sites.js`, **ou**
- Dans l'app → écran **Science** → « Charger un CSV de mesures » (import direct, sans toucher au code).

Colonnes du CSV :
`nom_site, latitude, longitude, hg_poisson_ugkg, hg_eau_ugL, population, pct_enceintes, pct_enfants, distance_orpaillage_km`

## Notes scientifiques

- Modèle **prospectif populationnel**, jamais un diagnostic individuel.
- Méthylmercure (poisson) et mercure inorganique (eau) séparés — non additionnés.
- Références : JECFA 1,6 µg/kg/sem · EFSA 1,3 µg/kg/sem · US EPA 0,1 µg/kg/j.
- Module 2 : sous-ensemble curé de la littérature (type CTD). En production : brancher les API CTD + STRING.
- Valeurs d'exposition des sites : à confirmer sur le terrain.

## Licence

**By © The Day Info, tous droits réservés.**
Voir [LICENSE](LICENSE).
Contact : armelyara@thedayinfo.com
