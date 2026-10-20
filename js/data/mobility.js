// Beweglichkeit: Dehn- und Mobilisationsübungen.
// sec = Haltezeit pro Satz, reps = Wiederholungen (statt Zeit), side = je Seite
// off = standardmäßig abgewählt (eher für Fortgeschrittene)

export const MOBILITY = [
  { id: 'deep-squat', name: 'Tiefe Hocke halten', sets: 2, sec: 45, focus: 'Hüfte & Sprunggelenke',
    cues: 'Fersen am Boden, Brust aufrecht, Ellbogen drücken die Knie leicht nach außen. Bei Bedarf an der Stange oder einem Türrahmen festhalten.' },
  { id: 'couch-stretch', name: 'Hüftbeuger-Dehnung (Couch Stretch)', sets: 2, sec: 40, side: true, focus: 'Hüftbeuger',
    cues: 'Hinteres Knie an der Wand oder am Sofa, Schienbein senkrecht nach oben. Po anspannen und Hüfte nach vorn schieben.' },
  { id: 'pike-stretch', name: 'Pike-Dehnung (Vorbeuge im Sitzen)', sets: 2, sec: 45, focus: 'Beinrückseite, Kompression',
    cues: 'Beine gestreckt und geschlossen, mit geradem Rücken aus der Hüfte nach vorn beugen. Wichtig für L-Sit und Handstand-Einstieg.' },
  { id: 'pancake', name: 'Grätsche (Pancake)', sets: 2, sec: 45, focus: 'Adduktoren, Beinrückseite',
    cues: 'Beine weit gegrätscht, Zehen zeigen nach oben. Mit geradem Rücken nach vorn Richtung Boden lehnen.' },
  { id: 'frog', name: 'Frosch-Dehnung', sets: 2, sec: 40, focus: 'Adduktoren, Hüfte',
    cues: 'Vierfüßlerstand, Knie weit auseinander, Unterschenkel parallel. Hüfte langsam nach hinten sinken lassen.' },
  { id: 'bridge', name: 'Brücke', sets: 3, sec: 15, focus: 'Schultern, Brustwirbelsäule',
    cues: 'Aus der Rückenlage über Hände und Füße hochdrücken. Arme möglichst strecken, Schultern über die Hände schieben. Anfangs reicht die Kopf-Brücke oder Schulterbrücke.' },
  { id: 'hang', name: 'Passives Hängen', sets: 2, sec: 30, focus: 'Schultern, Wirbelsäule',
    cues: 'An der Stange hängen, Schultern ganz locker lassen und zu den Ohren ziehen lassen. Entlastet die Wirbelsäule.' },
  { id: 'doorway', name: 'Brustdehnung im Türrahmen', sets: 2, sec: 30, side: true, focus: 'Brust, vordere Schulter',
    cues: 'Unterarm am Türrahmen auf Schulterhöhe, Körper langsam wegdrehen, bis es in der Brust zieht.' },
  { id: 'dislocates', name: 'Schulter-Dislocates mit Band/Stock', sets: 2, reps: 10, focus: 'Schulterbeweglichkeit',
    cues: 'Band oder Besenstiel weit greifen, mit gestreckten Armen langsam über den Kopf nach hinten und zurück führen.' },
  { id: 'thoracic', name: 'Brustwirbel-Rotation (Vierfüßler)', sets: 2, reps: 8, side: true, focus: 'Brustwirbelsäule',
    cues: 'Im Vierfüßlerstand eine Hand an den Hinterkopf, Ellbogen nach unten zur anderen Hand und dann weit nach oben aufdrehen.' },
  { id: 'wrist-stretch', name: 'Handgelenk-Dehnung', sets: 2, sec: 30, focus: 'Handgelenke',
    cues: 'Im Vierfüßlerstand Finger zu den Knien drehen und Gewicht sanft nach hinten verlagern. Danach Handrücken auf den Boden.' },
  { id: 'german-hang', name: 'German Hang (Ringe)', sets: 2, sec: 15, off: true, focus: 'Schulterstreckung (fortgeschritten)',
    cues: 'Über einen Skin the Cat nach hinten durchdrehen und mit gestreckten Armen hängen. Langsam herantasten, nur schmerzfrei!' },
];

export function getMobility(id) {
  return MOBILITY.find((m) => m.id === id);
}
