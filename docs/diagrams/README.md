# Diagrammes UML — LeaseManager

Neuf diagrammes PlantUML, écrits d'après le code tel qu'il est : les noms de
classes, de colonnes, de gardes et de services sont ceux du dépôt, pas ceux
d'une conception initiale.

| Fichier | Diagramme | Orientation |
|---|---|---|
| `01-use-case-global.puml` | Cas d'utilisation | portrait |
| `02-class-diagram.puml` | Classes du domaine | portrait |
| `03-package-architecture.puml` | Architecture en couches | paysage |
| `04-sequence-authorisation.puml` | Séquence — autorisation | paysage |
| `05-sequence-onboarding.puml` | Séquence — intégration d'un locataire | portrait |
| `06-sequence-booking.puml` | Séquence — demande au bail signé | portrait |
| `07-state-booking.puml` | États d'une réservation | portrait |
| `08-sequence-ai-triage.puml` | Séquence — classement assisté | portrait |
| `09-deployment.puml` | Déploiement Docker | paysage |

`_theme.puml` porte la charte commune — palette, polices, épaisseurs. Tous les
diagrammes l'incluent, donc une modification s'y applique partout.

## Générer

```bash
./render.sh          # SVG + PNG dans ./out
./render.sh svg      # vectoriel seul — pour le rapport
./render.sh png      # 200 dpi — pour les diapositives
```

Le script télécharge `plantuml.jar` au premier lancement.

### Prérequis

**Java** — déjà présent si vous avez un JDK ou un JRE :

```bash
java -version
```

**Graphviz** — moteur de placement utilisé par PlantUML pour les diagrammes de
classes, de composants, d'états, de déploiement et de cas d'utilisation.
Fortement recommandé : sans lui le rendu reste possible mais nettement moins
lisible.

```powershell
winget install Graphviz.Graphviz     # Windows
```

```bash
sudo apt install graphviz            # Debian / Ubuntu
brew install graphviz                # macOS
```

Vérifier que PlantUML le détecte :

```bash
java -jar plantuml.jar -testdot
```

Pas de Graphviz et pas le droit d'installer ? Décommentez
`!pragma layout smetana` dans `_theme.puml` : c'est un portage Java inclus dans
`plantuml.jar`, qui rend tout sans dépendance externe.

## Insérer dans le rapport

**Utilisez le SVG.** Il reste net à n'importe quelle échelle, à l'impression
comme à l'écran.

- **Word** : Insertion → Images → depuis ce fichier. Le SVG est redimensionnable
  sans perte.
- **LaTeX** : convertir une fois en PDF, puis `\includegraphics`.

  ```bash
  inkscape out/01-use-case-global.svg --export-type=pdf
  ```

- **Diapositives** : le PNG à 200 dpi suffit.

Les trois diagrammes en paysage (`03`, `04`, `09`) demandent une page en
orientation paysage, ou une réduction à environ 70 %.

## Modifier

Les fichiers sont du texte : une ligne par relation. Pour ajouter un acteur au
diagramme de cas d'utilisation, par exemple :

```plantuml
actor "Auditeur externe" as AUD
UC9 <-- AUD
```

Puis relancer `./render.sh`. Le suivi de version fonctionne normalement — un
`git diff` montre exactement ce qui a changé dans un diagramme, ce qu'aucun
outil graphique ne permet.

### Où PlantUML place les acteurs

Dans un diagramme de cas d'utilisation, les acteurs déclarés **avant** le
`rectangle` du système se placent à gauche, ceux déclarés **après** à droite.
Répartir la distribution des deux côtés évite une colonne unique et des liens
qui traversent toute la figure.

### Un piège à connaître

PlantUML tronque silencieusement toute image dépassant 4096 px. Le diagramme de
classes dépasse cette limite. `render.sh` passe donc
`-DPLANTUML_LIMIT_SIZE=16384` ; en appelant `plantuml.jar` à la main, pensez à
faire de même, sinon le bas du diagramme disparaît sans message d'erreur.
