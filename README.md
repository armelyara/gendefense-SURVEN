# GenDefense-SURVEN 

GenDefense est programme axée sur la surveillance biologique de la Côte d'Ivoire. 

Face à l'orpaillage clandestin, nous avons développé GenDefebnse-SURVEN dont le but est de prévenir le risque sanitaire lié au mercure de l'orpaillage clandestin en Côte d'Ivoire.
C'est une application web qui permet de visualiser les zones d'orpaillage clandestin et les risques sanitaires liés à l'utilisation du mercure dans l'orpaillage clandestin.

# Toxicologie computationnelle (dose, quotient de danger, carte) + toxicogénomique (gènes, voies, réseau).

## Lancer en local

1. **Serveur local** :
   ```bash
   cd mercuriscan
   python3 -m http.server 8000
   # puis ouvrir http://localhost:8000
   ```

## Installer comme application (PWA)

L'app est une **PWA installable** (icône sur le téléphone / le bureau, plein écran, hors-ligne).

1. Lance un serveur local :
   ```bash
   cd mercuriscan
   python3 -m http.server 8000
   ```
2. Ouvre `http://localhost:8000` dans Chrome / Edge / Safari.
3. **Bureau** : bouton « ⤓ Installer » en haut à droite, ou l'icône d'installation dans la barre d'adresse.
   **Android** : menu ⋮ → « Installer l'application ».
   **iOS Safari** : Partager → « Sur l'écran d'accueil ».

## Structure

```
GenDefense-SURVEN/
├── index.html        
├── styles.css        
├── app.js            
├── data/
│   ├── sites.js      
│   ├── geo.js      
│   └── tox.js      
├── vendor/
│   ├── leaflet.js    
│   └── leaflet.css
├── manifest.webmanifest  
├── sw.js             
├── icons/            
├── sites.csv         
└── README.md
```


## Notes scientifiques

- Modèle **prospectif populationnel**, jamais un diagnostic individuel.
- Méthylmercure (poisson) et mercure inorganique (eau) séparés — non additionnés.
- Références : JECFA 1,6 µg/kg/sem · EFSA 1,3 µg/kg/sem · US EPA 0,1 µg/kg/j.
- Module 2 : sous-ensemble curé de la littérature (type CTD). En production : brancher les API CTD + STRING.
- Valeurs d'exposition des sites : à confirmer sur le terrain.

## Licence

Ce projet est distribué sous licence **MIT** — voir [LICENSE](LICENSE) pour les détails.

© 2026 The Day Info — armelyara  
Contact : armelyara@thedayinfo.com
