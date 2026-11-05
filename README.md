# SIN Red Paris, maquette du hero

Le logo SIN fond en languette rouge au scroll, la casquette se révèle en tournant, puis les coloris défilent.

```bash
npm install
npm run dev
```

- `src/cap.js` : casquette 3D et liste des coloris (`COLORS`)
- `src/morph.js` : transformation logo vers languette
- `src/main.js` : scénario de scroll (`KEYS` pour la caméra, `setScene` pour la lumière)
- `index.html` : textes, avec `data-in` et `data-out` pour leur moment d'apparition
