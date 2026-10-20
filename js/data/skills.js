// Skill-Pfade: jede Stufe hat ein Ziel (min–max). Schaffst du in allen Sätzen
// das Maximum, schlägt die App die nächste Stufe vor.
// type: 'reps' = Wiederholungen, 'hold' = Sekunden halten
// side: true = Angabe gilt je Seite/Bein

export const PATHS = [
  {
    id: 'handstand',
    name: 'Handstand',
    icon: '🤸',
    group: 'Skill',
    rest: 90,
    levels: [
      { name: 'Wandhandstand (Bauch zur Wand)', type: 'hold', sets: 3, min: 20, max: 45,
        cues: 'Hände ca. 10–20 cm vor der Wand, mit den Füßen die Wand hochlaufen. Arme gestreckt, Schultern zu den Ohren schieben, Bauch und Po fest, Körper gerade wie ein Brett.' },
      { name: 'Wandhandstand mit Schulter-Taps', type: 'reps', sets: 3, min: 6, max: 12,
        cues: 'Bauch zur Wand. Gewicht auf eine Hand verlagern und mit der anderen kurz die Schulter antippen. Taps insgesamt zählen. Hüfte bleibt ruhig.' },
      { name: 'Toe Pulls (von der Wand lösen)', type: 'hold', sets: 4, min: 5, max: 15,
        cues: 'Rücken zur Wand, Fersen an der Wand. Über die Fingerspitzen Druck aufbauen und die Füße von der Wand lösen. Freie Balance halten, mit den Fingern korrigieren.' },
      { name: 'Freistehender Handstand (Kick-up)', type: 'hold', sets: 5, min: 5, max: 15,
        cues: 'Kontrolliert hochschwingen, Balance über die Finger („Krallen“) halten. Aussteigen üben: Hand vorsetzen und seitlich abrollen, wenn du kippst.' },
      { name: 'Freistehender Handstand', type: 'hold', sets: 3, min: 20, max: 45,
        cues: 'Saubere gerade Linie, Blick zwischen die Hände. Ziel: entspannt und stabil halten.' },
    ],
  },
  {
    id: 'hspu',
    name: 'Handstand-Push-up',
    icon: '⬆️',
    group: 'Drücken',
    rest: 120,
    levels: [
      { name: 'Pike Push-up', type: 'reps', sets: 3, min: 8, max: 12,
        cues: 'Hüfte hoch (umgedrehtes V), Kopf bewegt sich vor die Hände Richtung Boden. Ellbogen ca. 45° zum Körper, nicht ganz nach außen.' },
      { name: 'Erhöhter Pike Push-up', type: 'reps', sets: 3, min: 6, max: 10,
        cues: 'Füße auf Stuhl oder Sofa, Hüfte möglichst über den Schultern. Kopf kontrolliert vor die Hände absenken und kraftvoll hochdrücken.' },
      { name: 'Negativer Wand-HSPU', type: 'reps', sets: 3, min: 3, max: 6,
        cues: 'Bauch oder Rücken zur Wand im Handstand. In 4–5 Sekunden kontrolliert absenken, Kopf aufs Kissen, dann aussteigen und neu hochgehen.' },
      { name: 'Teil-HSPU an der Wand', type: 'reps', sets: 3, min: 4, max: 8,
        cues: 'Stapel aus Kissen oder Büchern unter dem Kopf, so dass die Bewegung verkürzt ist. Mit der Zeit Stapel niedriger machen.' },
      { name: 'Wand-HSPU', type: 'reps', sets: 3, min: 3, max: 8,
        cues: 'Volle Bewegung an der Wand: Kopf berührt den Boden (Kissen), dann komplett hochdrücken bis die Arme gestreckt sind.' },
      { name: 'Freistehender HSPU', type: 'reps', sets: 3, min: 1, max: 5,
        cues: 'Die Königsdisziplin: Balance halten und gleichzeitig drücken. Lieber wenige saubere Wiederholungen.' },
    ],
  },
  {
    id: 'planche',
    name: 'Planche',
    icon: '🦅',
    group: 'Drücken',
    rest: 120,
    levels: [
      { name: 'Planche Lean', type: 'hold', sets: 3, min: 15, max: 30,
        cues: 'Liegestützposition, Finger zeigen leicht nach außen/hinten. Schultern weit vor die Hände schieben, Arme gestreckt, Rücken leicht rund (Schulterblätter auseinander).' },
      { name: 'Frog Stand (Krähe)', type: 'hold', sets: 3, min: 15, max: 30,
        cues: 'Hocken, Hände schulterbreit, Knie auf die Oberarme/Ellbogen legen und nach vorn kippen, bis die Füße abheben.' },
      { name: 'Tuck Planche', type: 'hold', sets: 4, min: 5, max: 15,
        cues: 'Auf Parallettes oder Boden. Arme gestreckt, Knie eng an die Brust, Schultern vor die Hände, Rücken rund. Auch 2–3 s Versuche zählen am Anfang.' },
      { name: 'Advanced Tuck Planche', type: 'hold', sets: 4, min: 5, max: 12,
        cues: 'Wie Tuck Planche, aber Rücken flach und Hüfte auf Schulterhöhe. Knie etwas weiter vom Körper weg.' },
      { name: 'Straddle Planche', type: 'hold', sets: 4, min: 3, max: 10,
        cues: 'Beine gestreckt und weit gegrätscht, Körper parallel zum Boden.' },
    ],
  },
  {
    id: 'frontlever',
    name: 'Front Lever',
    icon: '🪵',
    group: 'Ziehen',
    rest: 120,
    levels: [
      { name: 'Skapula-Pulls', type: 'reps', sets: 3, min: 8, max: 12,
        cues: 'An der Stange hängen, Arme gestreckt. Nur über die Schulterblätter den Körper ein Stück hochziehen (Schulterblätter nach unten/hinten), kurz halten, ablassen.' },
      { name: 'Tuck Front Lever', type: 'hold', sets: 4, min: 8, max: 15,
        cues: 'Arme gestreckt, Knie zur Brust, Rücken waagerecht zum Boden. Schultern aktiv nach unten drücken, als wolltest du die Stange zur Hüfte ziehen.' },
      { name: 'Advanced Tuck Front Lever', type: 'hold', sets: 4, min: 8, max: 15,
        cues: 'Wie Tuck, aber Rücken flach und Hüfte gestreckt (Oberschenkel ca. 90° zum Oberkörper).' },
      { name: 'Einbeiniger Front Lever', type: 'hold', sets: 4, min: 6, max: 12,
        cues: 'Ein Bein gestreckt, das andere angewinkelt. Seiten pro Satz abwechseln.' },
      { name: 'Straddle Front Lever', type: 'hold', sets: 4, min: 5, max: 10,
        cues: 'Beide Beine gestreckt und gegrätscht, Körper waagerecht.' },
      { name: 'Front Lever', type: 'hold', sets: 4, min: 3, max: 8,
        cues: 'Beine geschlossen, Körper komplett waagerecht und gestreckt.' },
    ],
  },
  {
    id: 'muscleup',
    name: 'Klimmzug → Muscle-up',
    icon: '💪',
    group: 'Ziehen',
    rest: 120,
    levels: [
      { name: 'Negative Klimmzüge', type: 'reps', sets: 3, min: 3, max: 6,
        cues: 'Mit Sprung oder Stuhl über die Stange, dann in 4–5 Sekunden kontrolliert ablassen.' },
      { name: 'Klimmzüge', type: 'reps', sets: 3, min: 5, max: 10,
        cues: 'Aus dem gestreckten Hang, Schulterblätter zuerst aktivieren, Kinn über die Stange. Kein Schwung.' },
      { name: 'Brust-zur-Stange-Klimmzüge', type: 'reps', sets: 3, min: 4, max: 8,
        cues: 'Höher ziehen als beim normalen Klimmzug, bis die Brust die Stange (fast) berührt. Ellbogen nach hinten unten.' },
      { name: 'Explosive Klimmzüge', type: 'reps', sets: 3, min: 3, max: 6,
        cues: 'So schnell und hoch wie möglich ziehen, Ziel: Bauchnabel Richtung Stange. Saubere Technik vor Höhe.' },
      { name: 'Ring-Übergang mit Bodenkontakt', type: 'reps', sets: 3, min: 5, max: 8,
        cues: 'Ringe niedrig (ca. Brusthöhe im Sitzen), Füße am Boden. False Grip, Übergang vom Ziehen ins Drücken üben, Beine helfen nur so viel wie nötig.' },
      { name: 'Negativer Muscle-up (Ringe)', type: 'reps', sets: 3, min: 2, max: 4,
        cues: 'Oben im Stütz starten, langsam durch den Übergang ablassen bis in den Hang.' },
      { name: 'Muscle-up', type: 'reps', sets: 3, min: 1, max: 5,
        cues: 'Kraftvoller Zug mit False Grip, schneller Übergang, Dip nach oben. Lieber sauber als viele.' },
    ],
  },
  {
    id: 'dips',
    name: 'Ring-Dips',
    icon: '⭕',
    group: 'Drücken',
    rest: 90,
    levels: [
      { name: 'Ring-Stütz', type: 'hold', sets: 3, min: 15, max: 30,
        cues: 'Oben im Stütz, Arme gestreckt, Ringe eng am Körper, Schultern nach unten. Wackeln ist normal – stabilisieren.' },
      { name: 'Negative Ring-Dips', type: 'reps', sets: 3, min: 3, max: 6,
        cues: 'Aus dem Stütz in 4 Sekunden absenken, bis die Schultern unter den Ellbogen sind. Zurück nach oben mit Hilfe der Beine.' },
      { name: 'Ring-Dips', type: 'reps', sets: 3, min: 5, max: 10,
        cues: 'Volle Tiefe, oben komplett strecken. Ringe nah am Körper halten.' },
      { name: 'Ring-Dips mit Pause', type: 'reps', sets: 3, min: 6, max: 12,
        cues: 'Unten 2 Sekunden halten, oben Ringe leicht nach außen drehen (RTO).' },
    ],
  },
  {
    id: 'rows',
    name: 'Ring-Rudern',
    icon: '🚣',
    group: 'Ziehen',
    rest: 90,
    levels: [
      { name: 'Ring-Rudern (steil)', type: 'reps', sets: 3, min: 8, max: 15,
        cues: 'Körper schräg, je aufrechter desto leichter. Körper gerade, Brust zu den Ringen ziehen, Schulterblätter zusammen.' },
      { name: 'Ring-Rudern (flach)', type: 'reps', sets: 3, min: 8, max: 12,
        cues: 'Körper fast waagerecht, Füße am Boden. Oben kurz halten.' },
      { name: 'Ring-Rudern, Füße erhöht', type: 'reps', sets: 3, min: 6, max: 12,
        cues: 'Füße auf Stuhl, Körper waagerecht und gestreckt.' },
      { name: 'Tuck Front Lever Rudern', type: 'reps', sets: 3, min: 4, max: 8,
        cues: 'In der Tuck-Front-Lever-Position die Stange/Ringe zum Körper ziehen. Rücken bleibt waagerecht.' },
      { name: 'Archer-Rudern', type: 'reps', sets: 3, min: 4, max: 8, side: true,
        cues: 'Ein Arm zieht, der andere bleibt fast gestreckt seitlich. Seiten abwechseln.' },
    ],
  },
  {
    id: 'legs',
    name: 'Pistol Squat',
    icon: '🦵',
    group: 'Beine',
    rest: 60,
    levels: [
      { name: 'Kniebeugen', type: 'reps', sets: 3, min: 15, max: 25,
        cues: 'Füße schulterbreit, Knie folgen den Zehen, so tief wie möglich mit geradem Rücken.' },
      { name: 'Bulgarische Split-Kniebeuge', type: 'reps', sets: 3, min: 8, max: 12, side: true,
        cues: 'Hinterer Fuß auf Stuhl oder Sofa. Vorderes Knie stabil, langsam runter, kraftvoll hoch.' },
      { name: 'Box-Pistol', type: 'reps', sets: 3, min: 5, max: 10, side: true,
        cues: 'Einbeinig auf einen Stuhl/Kasten absitzen und wieder aufstehen. Anderes Bein gestreckt nach vorn.' },
      { name: 'Assistierter Pistol', type: 'reps', sets: 3, min: 5, max: 8, side: true,
        cues: 'An den Ringen oder einem Türrahmen leicht festhalten, volle Tiefe einbeinig.' },
      { name: 'Pistol Squat', type: 'reps', sets: 3, min: 3, max: 8, side: true,
        cues: 'Freie einbeinige Kniebeuge bis ganz unten. Arme nach vorn als Gegengewicht.' },
    ],
  },
  {
    id: 'lsit',
    name: 'L-Sit',
    icon: '📐',
    group: 'Core',
    rest: 60,
    levels: [
      { name: 'Hängendes Knieheben', type: 'reps', sets: 3, min: 8, max: 15,
        cues: 'An der Stange hängen, Knie kontrolliert Richtung Brust ziehen, ohne zu schwingen.' },
      { name: 'Tuck-Sitz', type: 'hold', sets: 3, min: 10, max: 20,
        cues: 'Auf Parallettes, Stühlen oder Boden stützen, Arme gestreckt, Schultern runter, Knie angezogen, Po vom Boden.' },
      { name: 'Einbeiniger L-Sit', type: 'hold', sets: 3, min: 8, max: 15,
        cues: 'Ein Bein gestreckt, eines angewinkelt. Seiten pro Satz abwechseln.' },
      { name: 'L-Sit', type: 'hold', sets: 3, min: 8, max: 15,
        cues: 'Beide Beine gestreckt und waagerecht, Zehen gestreckt, Schultern tief.' },
      { name: 'L-Sit an den Ringen', type: 'hold', sets: 3, min: 10, max: 20,
        cues: 'Wie L-Sit, aber im Ringstütz – deutlich instabiler.' },
    ],
  },
];

// Startstufen für "etwas Basis" (4–8 Klimmzüge, 10–25 Liegestütze)
export const DEFAULT_LEVELS = {
  handstand: 0, hspu: 0, planche: 0, frontlever: 0, muscleup: 1,
  dips: 1, rows: 1, legs: 1, lsit: 1,
};

// Ganzkörper A/B im Wechsel. Jeder Block ist entweder eine einzelne Übung
// (gerade Sätze) oder ein Supersatz aus zwei Übungen im Wechsel (Drücken/Ziehen).
// Handstand immer zuerst, solange die Schultern frisch sind.
export const SESSIONS = {
  A: { name: 'Ganzkörper A', blocks: [['handstand'], ['hspu', 'frontlever'], ['dips', 'legs'], ['lsit']] },
  B: { name: 'Ganzkörper B', blocks: [['handstand'], ['planche', 'muscleup'], ['rows', 'legs'], ['lsit']] },
};

// sec = läuft automatisch als Countdown, reps = mit "Fertig" bestätigen
export const WARMUP = [
  { name: 'Handgelenke kreisen & dehnen', sec: 90, cues: 'Im Vierfüßlerstand Handflächen und Handrücken in alle Richtungen belasten. Wichtig für Handstand und Planche!' },
  { name: 'Arm- und Schulterkreisen', sec: 45, cues: 'Große Kreise vorwärts und rückwärts.' },
  { name: 'Katze-Kuh', reps: 10, cues: 'Im Vierfüßlerstand Rücken abwechselnd rund und hohl.' },
  { name: 'Skapula-Liegestütze', reps: 10, cues: 'In der Liegestützposition nur die Schulterblätter zusammen und auseinander bewegen.' },
  { name: 'Aktives Hängen', sec: 20, sets: 2, cues: 'An der Stange hängen, Schultern aktiv nach unten ziehen.' },
  { name: 'Kniebeugen locker', reps: 10, cues: 'Langsam, tief, Hüfte mobilisieren.' },
];

export function getPath(id) {
  return PATHS.find((p) => p.id === id);
}
