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
- **v0.4 — OCR** : PDF scannés via Tesseract embarqué
- **v0.5 — Confort** : objectifs quotidiens, Pomodoro, collections et tags
- **v0.6 — Écosystème** : import/export de la bibliothèque, thèmes
  personnalisés, import de polices

## 📚 Lecture

- [x] Reflow du texte PDF (paragraphes recollés, en-têtes/pieds supprimés)
- [x] Pagination façon livre
- [x] EPUB avec le même moteur de reflow
- [ ] OCR pour les PDF scannés
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
- [ ] Dessin au stylet
- [x] Export des annotations en Markdown
- [ ] Export des annotations en PDF
- [ ] Synchronisation des annotations entre appareils

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
      reprise à n'importe quel mot, barre de progression, contexte estompé)
- [ ] Lecture rapide avec mise en évidence
- [ ] Entraînement à la vitesse de lecture
- [ ] Objectifs quotidiens
- [ ] Sessions Pomodoro intégrées

## 📊 Statistiques

- [x] Temps de lecture cumulé par livre
- [x] Pourcentage terminé
- [x] Estimation du temps restant
- [x] Temps de lecture quotidien (graphique des 14 derniers jours)
- [ ] Pages lues par jour
- [x] Vitesse moyenne (mots/minute, sur 30 jours)
- [x] Calendrier de lecture (streak)
- [ ] Historique de progression détaillé

## 🎨 Personnalisation

- [x] 4 thèmes (crème, sépia, ambre, nuit) avec grain papier
- [x] Taille, interligne, largeur de page, justification réglables
- [x] 7 polices (Literata, Atkinson Hyperlegible, IBM Plex Serif,
      OpenDyslexic, Georgia, Palatino, Segoe UI)
- [ ] Import de polices personnalisées
- [ ] Création de thèmes
- [ ] Couleurs personnalisables
- [ ] Marges et colonnes réglables
- [ ] Animation de changement de page
- [ ] Sons de page

## ☁️ Synchronisation

- [x] Reprise fiable de la position (sauvegarde immédiate à la fermeture, bouton « Reprendre »)
- [ ] Sauvegarde dans le cloud (opt-in)
- [ ] Synchronisation entre PC, Mac et Linux
- [ ] Historique des versions des annotations
- [ ] Import/export de la bibliothèque

## 🔎 Recherche

- [x] Livres récemment ouverts (tri par dernière ouverture)
- [x] Recherche plein texte dans le livre (Ctrl+F, insensible aux accents)
- [x] Recherche dans la bibliothèque (titre et auteur)
- [ ] Recherche dans les annotations
- [ ] Recherche par tags
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

- [x] Lecture vocale (Text-to-Speech, voix système, vitesse réglable)
- [x] Suivi visuel pendant la lecture audio (paragraphe surligné, pages tournées)
- [ ] Compatibilité avec les lecteurs d'écran
- [ ] Contraste élevé
- [x] Police OpenDyslexic
- [ ] Contrôle vocal
- [x] Navigation au clavier dans le lecteur
      (flèches, espace, Ctrl+F, F11, échap)

## 📱 Bibliothèque

- [x] Couvertures extraites automatiquement, progression par livre
- [ ] Collections personnalisées
- [ ] Étagères virtuelles
- [ ] Étiquettes (tags)
- [ ] Favoris
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
