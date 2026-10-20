# Calisthenics – persönlicher Trainings- und Ernährungscoach

Eine Web-App (PWA) fürs iPhone, die sich wie eine normale App auf den Home-Bildschirm legen lässt. Ohne App Store, ohne Mac, ohne Account. Alle Daten bleiben auf dem Gerät.

## Funktionen

- **Skill-Pfade** mit Stufenleitern: Handstand, Handstand-Push-up, Planche, Front Lever, Klimmzug → Muscle-up, Ring-Dips, Ring-Rudern, Pistol Squat, L-Sit
- **Adaptiver Plan**: Ganzkörper A/B im Wechsel, 3× pro Woche. Schaffst du in allen Sätzen das obere Ziel, schlägt die App die nächste Stufe vor. Liegst du zweimal unter dem Minimum, schlägt sie eine Stufe zurück vor.
- **Workout-Modus**: Aufwärmen, Satz-Eingabe, Stoppuhr für Halteübungen (Signalton bei Minimal- und Zielzeit), Pausen-Countdown, Bildschirm bleibt an
- **Ernährung**: Kalorien- und Eiweißziel aus Körperdaten, Wochenplan mit Rezepten, Portionen werden automatisch angepasst, Gerichte tauschbar, vegetarisch und Reste-Modus optional
- **Einkaufsliste** aus dem Wochenplan, nach Supermarkt-Abteilungen sortiert, zum Abhaken, mit eigenen Einträgen
- Offline nutzbar, Hell- und Dunkelmodus, Backup als JSON

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
| `js/data/skills.js` | Skill-Pfade, Stufen, Ziele, Trainingseinheiten, Aufwärmen |
| `js/data/food.js` | Zutaten mit Nährwerten, Rezepte |
| `js/training.js` | Workout erstellen, auswerten, Stufen anpassen |
| `js/nutrition.js` | Kalorienbedarf, Wochenplan, Einkaufsliste |
| `js/app.js` | Oberfläche und Navigation |
| `sw.js` | Offline-Cache (bei Änderungen `VERSION` erhöhen) |
