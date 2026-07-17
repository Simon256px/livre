# 🗺️ Roadmap

**Le cap : faire de MontLivre un compagnon de lecture immersive et profonde** —
on ouvre un texte, on y reste : les définitions, les notes de bas de page, un
second livre en regard… tout vient au lecteur sans jamais lui faire perdre sa
page. La bibliothèque doit accueillir tous les formats et retrouver n'importe
quelle phrase, où qu'elle soit.

Backlog par thème ; les cases cochées sont déjà dans la version actuelle.

> **Principe** : tout fonctionne offline par défaut. Les fonctionnalités qui
> nécessitent le réseau (cloud, catalogues, IA, traduction, Wikipédia) seront
> optionnelles et clairement signalées.

## 🚀 Prochaines étapes proposées

- ~~v0.2 → v0.9 — moteur de lecture, annotations, OCR, confort, personnalisation,
  page Options, succès, stylet, mise à jour intégrée~~ ✅ livrés
- **v1.0 — Rester dans le texte** : notes de bas de page en infobulle,
  **lecture parallèle** (deux livres côte à côte), surlignage instantané,
  mode focus paragraphe
- **v1.1 — Une bibliothèque sans limites** : formats MOBI/AZW3, FB2, CBZ
  (BD & manga), **recherche plein texte dans toute la bibliothèque**,
  collections nommées, affichage liste/étagère, tri intelligent
- **v1.2 — Au-delà d'un seul PC** : versions macOS et Linux, synchronisation
  multi-appareils (progression, notes, signets), catalogues en ligne OPDS (opt-in)
- **Plus tard** : traduction/Wikipédia (opt-in), fonctions IA (opt-in),
  voix neurales locales, lecteurs d'écran, version Web

## 📚 Lecture

- [x] Reflow du texte PDF (paragraphes recollés, en-têtes/pieds supprimés)
- [x] Pagination façon livre
- [x] EPUB avec le même moteur de reflow
- [x] OCR pour les PDF scannés (Tesseract WASM, modèles fra+eng embarqués, 100 % offline)
- [x] Affichage des images et graphiques
- [x] Double page (comme un livre ouvert) — auto selon la fenêtre, ou forcée
- [x] Défilement continu en plus de la pagination
- [ ] Lecture verticale ou horizontale
- [x] Mode plein écran immersif (F11, barre escamotable)
- [x] Chapitres détectés automatiquement avec sommaire interactif
- [x] Ouverture directe depuis la ligne de commande (`livre chemin.pdf`)
- [x] Chargement interruptible des gros fichiers (barre de progression + bouton Interrompre)
- [ ] Formats supplémentaires : MOBI / AZW3 (Kindle), FB2, CBZ (BD & manga)
- [ ] **Lecture parallèle** : deux livres côte à côte en écran partagé
      (une œuvre et son analyse, une VO et sa traduction…)
- [ ] **Notes de bas de page en infobulle** : la note s'affiche dans un popover
      au clic, sans jamais quitter sa page
- [ ] Coloration syntaxique du code (manuels techniques, livres d'informatique)

## ✍️ Annotations

- [x] Surlignage de plusieurs couleurs (sélection → palette flottante)
- [x] Notes attachées à un passage
- [x] Signets (bookmarks)
- [x] Dessin au stylet (croquis sur la page, pression gérée, galerie dans Notes)
- [x] Export des annotations en Markdown
- [x] Export des annotations en PDF (PDF de notes mis en page)
- [ ] Surlignage instantané : un seul geste applique la dernière couleur
      utilisée, sans passer par la palette
- [ ] Synchronisation automatique des annotations entre appareils
      (l'import/export de bibliothèque permet déjà un transfert manuel)

## 🧠 Aides à la lecture

- [x] Dictionnaire intégré (double-clic sur un mot, Wiktionnaire — en ligne, opt-in)
- [ ] Traduction instantanée
- [ ] Définition Wikipédia
- [ ] Prononciation d'un mot
- [ ] Résumé automatique d'un chapitre
- [ ] Explication des passages complexes avec IA
- [ ] Flashcards générées automatiquement

## ⚡ Vitesse de lecture

- [x] Bionic reading à intensité réglable
- [x] Mode focus (règle de lecture)
- [ ] Mode focus paragraphe : le paragraphe courant net, le reste estompé,
      on avance au clic ou à la flèche
- [x] Mode RSVP (un mot à la fois, point de fixation rouge, vitesse réglable,
      reprise à n'importe quel mot via un aperçu lisible cliquable, repères de
      chapitres sur la barre de progression)
- [ ] Lecture rapide avec mise en évidence
- [ ] Entraînement à la vitesse de lecture
- [x] Objectifs quotidiens (anneau de progression + ligne d'objectif sur le graphique)
- [x] Sessions Pomodoro intégrées (lecture/pause, badge compte à rebours, bip)

## 📊 Statistiques

- [x] Temps de lecture cumulé par livre
- [x] Pourcentage terminé
- [x] Estimation du temps restant
- [x] Temps de lecture quotidien (graphique des 14 derniers jours)
- [ ] Pages lues par jour
- [x] Vitesse moyenne (mots/minute, sur 30 jours)
- [x] Calendrier de lecture (streak)
- [x] Succès à débloquer (14 : livres, mots, heures, streak, objectif…)
- [ ] Historique de progression détaillé

## 🎨 Personnalisation

- [x] 4 thèmes (crème, sépia, ambre, nuit) avec grain papier
- [x] Taille, interligne, largeur de page, justification réglables
- [x] 8 polices (Literata, Atkinson Hyperlegible, IBM Plex Serif, Manrope,
      OpenDyslexic, Georgia, Palatino, Segoe UI)
- [x] Mise en page d'auteur : chapitres sur nouvelle page, titres ornés,
      lettrines (activable)
- [x] Page Options plein écran façon menu de jeu (remplace le tiroir latéral)
- [x] Remise à zéro : statistiques, réglages, ou tout effacer
- [x] Import de polices personnalisées (.ttf/.otf/.woff, embarquées dans le profil)
- [x] Création de thèmes (thème « perso » sur mesure)
- [x] Couleurs personnalisables (fond, page, texte)
- [x] Marges et colonnes réglables (marges + simple/double page/défilement)
- [x] Animation de changement de page (glissement / page tournée / aucune)
- [x] Sons de page (souffle de tournage, activable)

## ☁️ Synchronisation

- [x] Reprise fiable de la position (sauvegarde immédiate à la fermeture, bouton « Reprendre »)
- [x] Import/export de la bibliothèque (JSON : livres, annotations, tags, stats — sauvegarde/migration)
- [ ] Sauvegarde dans le cloud (opt-in)
- [ ] Synchronisation automatique entre appareils : fichiers, progression,
      notes et signets (opt-in)
- [ ] Synchronisation de la progression avec une liseuse e-ink
- [ ] Historique des versions des annotations

## 🔎 Recherche

- [x] Livres récemment ouverts (tri par dernière ouverture)
- [x] Recherche plein texte dans le livre (Ctrl+F, insensible aux accents)
- [x] Recherche dans la bibliothèque (titre, auteur et tags)
- [x] Recherche dans les annotations (champ dans le panneau Notes)
- [x] Recherche par tags (puces de filtrage + étagères)
- [ ] **Recherche plein texte dans toute la bibliothèque** : retrouver une
      citation sans savoir dans quel livre elle se trouve (le cache
      d'extraction s'y prête déjà)
- [ ] Filtres intelligents

## 🤖 Fonctionnalités IA (opt-in, jamais requises)

- [ ] Résumé d'un livre
- [ ] Résumé d'un chapitre
- [ ] Questions/Réponses sur le livre
- [ ] Recherche sémantique
- [ ] Génération de quiz
- [ ] Explication adaptée au niveau du lecteur
- [ ] Extraction automatique des concepts clés

## 🎧 Accessibilité

- [ ] Lecture vocale (Text-to-Speech) — retirée en v0.4 : les voix système
      françaises étaient trop robotiques ; à reconsidérer avec des voix
      neurales locales (type Piper)
- [ ] Compatibilité avec les lecteurs d'écran
- [x] Contraste élevé (thème dédié, sans grain, noir sur blanc)
- [x] Police OpenDyslexic
- [ ] Contrôle vocal
- [x] Navigation au clavier dans le lecteur
      (flèches, espace, Ctrl+F, F11, échap)

## 📱 Bibliothèque

- [x] Couvertures extraites automatiquement, progression par livre
- [ ] Collections personnalisées (nommées, manuelles)
- [x] Étagères virtuelles (À lire / En cours / Terminés, automatiques)
- [x] Étiquettes (tags) éditables par livre
- [x] Favoris
- [ ] Tri intelligent
- [ ] Recommandations basées sur les habitudes de lecture
- [ ] Affichage en grille, liste ou étagère
- [ ] Catalogues en ligne OPDS (opt-in) : parcourir les bibliothèques
      publiques et ouvrir un livre en deux clics
- [ ] Intégration Calibre (opt-in) : accéder à sa bibliothèque Calibre existante

## 💻 Plateformes

- [x] Windows (installeur NSIS + mise à jour intégrée)
- [ ] macOS
- [ ] Linux (AppImage / Flatpak)
- [ ] Version Web : lire sa bibliothèque depuis un navigateur

## 🧪 Fonctionnalités avancées

- [ ] Comparaison de deux éditions d'un même livre (la lecture parallèle en
      sera la première brique)
- [ ] Lecture collaborative
- [ ] Partage de citations
- [ ] Plugin système
- [ ] API pour extensions
- [ ] Scripts personnalisés
- [ ] Mode développeur pour créer des thèmes et des extensions
