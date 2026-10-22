# Calisthenics – persönlicher Trainings- und Ernährungscoach

Eine Web-App (PWA) fürs iPhone, die sich wie eine normale App auf den Home-Bildschirm legen lässt. Ohne App Store, ohne Mac, ohne Account. Alle Daten bleiben auf dem Gerät.

## Funktionen

**Training (aufgebaut wie Simple Calisthenics)**
- **Periodisierung**: Zyklen aus 7 Wochen – 3× Hypertrophie, 3× Kraft, 1× Deload – mit Kalenderansicht und Vorschau jedes Trainingstags
- **Skill-Pfade** als Progressionsketten: Handstand, Handstand-Push-up, Planche, Front Lever, Klimmzug → Muscle-up, Ring-Dips, Ring-Rudern, Pistol Squat, L-Sit
- **Supersätze**: Drücken und Ziehen im Wechsel, Handstand als Skill-Block zu Beginn
- **Konkrete Satz-Ziele** aus dem Verlauf (Doppelprogression). Ziel in allen Sätzen erreicht → Vorschlag für die nächste Stufe, zweimal unter dem Minimum → Vorschlag zum Zurückstufen
- **Geführter Player**: Aufwärmen, automatische Pausen- und Übungs-Countdowns, Stoppuhr für Halteübungen, Signaltöne, Sprachansage, Übersicht zum Springen, Bildschirm bleibt an
- **Beweglichkeit**: Cool-down nach jedem Training (rotierend) und eigene Mobility-Einheit
- **Übungsübersicht**: jede Übung für den Plan an- oder abwählbar (abgewählt → nächstleichtere Variante)
- **Eigene Übungen** mit einer oder mehreren Stufen, laufen in Ganzkörper A, B oder beiden mit
- **Fortschritt**: Statistik, Sätze pro Woche, Stufen je Skill, Meilensteine, Bestleistungen, Körpergewicht, Trainingsverlauf

**Ernährung**
- Kalorien- und Eiweißziel aus Körperdaten, Wochenplan mit Rezepten, Portionen automatisch angepasst, Gerichte tauschbar, vegetarisch und Reste-Modus optional
- Alle Rezepte zum Durchblättern, einzeln an- und abwählbar, Gericht für eine Mahlzeit selbst aussuchen
- Eigene Rezepte und Zutaten (bei gemeinsamem Plan in beiden Apps sichtbar)
- Einkaufsliste aus dem Wochenplan, nach Abteilungen sortiert, mit eigenen Einträgen
- „Auswärts gegessen“: Essen fotografieren, Claude schätzt kcal, Eiweiß, Kohlenhydrate und Fett, Werte prüfen und für den Tag eintragen (zusätzlich oder statt einer geplanten Mahlzeit). Ohne Schlüssel über die Claude-App (Teilen und Antwort einfügen), mit eigenem API-Schlüssel direkt in der App
- „Anderes Training“: Fußball, Joggen & Co. in eigenen Worten beschreiben, Claude macht daraus Einträge (Dauer, Intensität, Mehrverbrauch, Belastung je Körperbereich) und einen Tipp fürs nächste Training. Die Einträge stehen im Kalender und im Verlauf, der Mehrverbrauch erhöht das Kalorienziel des Tages. Läuft über die Claude-App (Teilen und Antwort einfügen), mit dem API-Schlüssel aus „Auswärts gegessen“ auch direkt

Offline nutzbar, Hell- und Dunkelmodus, Backup als JSON.

## Aufs iPhone bringen (GitHub Pages)

1. Den Code in den Branch `main` übernehmen (Pull Request mergen).
2. Auf GitHub im Repo: **Settings → Pages → Build and deployment**: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`, speichern.
   GitHub Pages ist bei kostenlosen Accounts nur für **öffentliche** Repos verfügbar. Alternativ geht kostenloses Hosting über Netlify oder Cloudflare Pages, dort kann das Repo privat bleiben.
3. Nach ein bis zwei Minuten läuft die App unter `https://<benutzername>.github.io/fitness/`.
4. Die Adresse in **Safari** öffnen → **Teilen** → **Zum Home-Bildschirm**.

## Lokal testen

```sh
npx http-server -c-1 .
```

## Struktur

| Datei | Inhalt |
| --- | --- |
| `js/data/skills.js` | Skill-Pfade, Stufen, Trainingseinheiten (Blöcke/Supersätze), Aufwärmen |
| `js/data/mobility.js` | Dehn- und Mobilisationsübungen |
| `js/data/food.js` | Zutaten mit Nährwerten, Rezepte |
| `js/training.js` | Periodisierung, Satz-Ziele, Workout erstellen und auswerten, Statistik, Kalender |
| `js/nutrition.js` | Kalorienbedarf, Wochenplan, Einkaufsliste |
| `js/recipes.js` | Eigene Rezepte und Zutaten, Rezepte an/aus |
| `js/custom.js` | Eigene Übungen |
| `js/views/*.js` | Ansichten (Heute, Plan, Übungen, Fortschritt, Essen, Profil, Player) |
| `js/app.js` | Navigation und Ereignisse |
| `sw.js` | Offline-Cache (bei Änderungen `VERSION` erhöhen) |
