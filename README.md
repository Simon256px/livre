# 📖 Livre

**Un lecteur de livres élégant qui transforme vos PDF en véritable expérience de lecture.**

Livre est une application de bureau (Electron) qui prend vos PDF — et bientôt EPUB, MOBI, TXT — et les re-met en page comme un vrai livre : texture papier, typographie soignée, modes lumière, Bionic Reading. 100 % offline, aucun compte, aucune donnée envoyée.

> 🗺️ La liste complète des fonctionnalités envisagées et leur avancement : [ROADMAP.md](ROADMAP.md)

## ✨ Fonctionnalités prévues

### Lecture & transformation du PDF
- **Reflow intelligent** : extraction du texte et re-mise en page façon livre (détection des chapitres, suppression des en-têtes/pieds de page parasites)
- **Texture livre réaliste** : grain papier, pages crème, animation de tournage de page, ombre de reliure
- **OCR intégré** pour les PDF scannés
- **Multi-formats** : PDF, EPUB, MOBI, TXT, Markdown

### Confort de lecture
- **Bionic Reading** avec intensité réglable
- **Modes lumière** : clair, sépia, ambre (sans lumière bleue), nuit — avec bascule automatique selon l'heure
- **Typographie fine** : polices lecture (Literata, OpenDyslexic…), interligne, marges, justification, césure
- **Mode focus** : règle de lecture, estompage du reste de la page
- **Mode RSVP** : lecture rapide mot à mot, vitesse réglable
- **Défilement automatique**

### Annotations & organisation
- Surlignage multi-couleurs, notes en marge, marque-pages
- **Export des annotations en Markdown**
- **Bibliothèque visuelle** : couvertures auto-extraites, tags, progression par livre
- **Dictionnaire au clic** (offline)

### Motivation
- **Statistiques** : temps lu, vitesse (mots/min), temps restant estimé, streaks
- **Objectifs de lecture** quotidiens/hebdomadaires
- **Reprise exacte** de la lecture à la réouverture

## 🛠️ Stack technique

- [Electron](https://www.electronjs.org/) — application de bureau multiplateforme
- [pdf.js](https://mozilla.github.io/pdf.js/) — parsing et extraction de texte des PDF
- HTML/CSS/JS pour le rendu « livre »

## 🚀 Développement

```bash
npm install
npm start
```

## 📄 Licence

MIT
