# 🗺️ Roadmap

Backlog des fonctionnalités envisagées pour Livre, par thème.
Les cases cochées sont déjà dans la version actuelle.

> **Principe** : tout fonctionne offline par défaut. Les fonctionnalités qui
> nécessitent le réseau (cloud, IA, traduction, Wikipédia) seront optionnelles
> et clairement signalées.

## 🚀 Prochaines étapes proposées

- ~~v0.2 — Lire confortablement + annoter~~ ✅ livré
- ~~v0.2.1 — Chargement interruptible, RSVP libre~~ ✅ livré
- ~~v0.3 — Dictionnaire (Wiktionnaire), reprise fiable~~ ✅ livré
- ~~v0.4 — RSVP visuel, TTS retiré, installeur Windows~~ ✅ livré
- ~~v0.5 — OCR des PDF scannés (Tesseract embarqué)~~ ✅ livré
- ~~v0.6 — Confort : objectif quotidien, Pomodoro, favoris/tags/étagères~~ ✅ livré
- ~~v0.7 — Export PDF, recherche notes, import/export biblio, contraste, marges, sons~~ ✅ livré
- ~~v0.8 — Personnalisation : thème/couleurs sur mesure, import de polices, page tournée~~ ✅ livré
- ~~v0.9 — Patch gros PDF, page Options, succès, mise en page d'auteur, stylet, MàJ intégrée~~ ✅ livré
- **v1.0 — Confort avancé** : lecture verticale/horizontale, affichage liste/étagère,
  collections nommées, tri intelligent, pages lues par jour
- **Plus tard** : traduction/Wikipédia (opt-in), fonctions IA (opt-in),
  voix neurales locales, sync automatique multi-appareils, lecteurs d'écran

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

## ✍️ Annotations

- [x] Surlignage de plusieurs couleurs (sélection → palette flottante)
- [x] Notes attachées à un passage
- [x] Signets (bookmarks)
- [x] Dessin au stylet (croquis sur la page, pression gérée, galerie dans Notes)
- [x] Export des annotations en Markdown
- [x] Export des annotations en PDF (PDF de notes mis en page)
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
- [ ] Synchronisation automatique entre PC, Mac et Linux
- [ ] Historique des versions des annotations

## 🔎 Recherche

- [x] Livres récemment ouverts (tri par dernière ouverture)
- [x] Recherche plein texte dans le livre (Ctrl+F, insensible aux accents)
- [x] Recherche dans la bibliothèque (titre, auteur et tags)
- [x] Recherche dans les annotations (champ dans le panneau Notes)
- [x] Recherche par tags (puces de filtrage + étagères)
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

## 🧪 Fonctionnalités avancées

- [ ] Comparaison de deux éditions d'un même livre
- [ ] Lecture collaborative
- [ ] Partage de citations
- [ ] Plugin système
- [ ] API pour extensions
- [ ] Scripts personnalisés
- [ ] Mode développeur pour créer des thèmes et des extensions
