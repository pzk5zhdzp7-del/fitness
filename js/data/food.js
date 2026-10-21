// Nährwerte je 100 g (bzw. 100 ml), gerundete Durchschnittswerte.
// piece: Gewicht eines Stücks in g, damit die Einkaufsliste "3 Stk" statt "180 g" zeigt.
// cat: Abteilung im Supermarkt für die Einkaufsliste

export const CATEGORIES = [
  'Obst & Gemüse',
  'Kühlregal',
  'Fleisch & Fisch',
  'Brot & Getreide',
  'Konserven & Vorrat',
  'Sonstiges',
];

export const INGREDIENTS = {
  haferflocken: { name: 'Haferflocken', kcal: 370, p: 13.5, c: 59, f: 7, cat: 'Brot & Getreide' },
  milch: { name: 'Milch 1,5 %', kcal: 47, p: 3.4, c: 4.9, f: 1.5, cat: 'Kühlregal', unit: 'ml' },
  magerquark: { name: 'Magerquark', kcal: 67, p: 12, c: 4, f: 0.2, cat: 'Kühlregal' },
  skyr: { name: 'Skyr', kcal: 63, p: 11, c: 4, f: 0.2, cat: 'Kühlregal' },
  joghurt: { name: 'Naturjoghurt 3,5 %', kcal: 64, p: 3.8, c: 4.5, f: 3.5, cat: 'Kühlregal' },
  huettenkaese: { name: 'Hüttenkäse', kcal: 98, p: 12.3, c: 3, f: 4.3, cat: 'Kühlregal' },
  feta: { name: 'Feta', kcal: 260, p: 15, c: 1, f: 21, cat: 'Kühlregal' },
  kaese: { name: 'Geriebener Käse', kcal: 356, p: 25, c: 2, f: 27, cat: 'Kühlregal' },
  eier: { name: 'Eier', kcal: 137, p: 12.5, c: 0.7, f: 9.5, cat: 'Kühlregal', piece: 60 },
  tofu: { name: 'Tofu natur', kcal: 120, p: 12, c: 1.5, f: 7, cat: 'Kühlregal' },
  hummus: { name: 'Hummus', kcal: 280, p: 7, c: 13, f: 21, cat: 'Kühlregal' },
  wraps: { name: 'Weizen-Wraps', kcal: 300, p: 8.5, c: 50, f: 7, cat: 'Brot & Getreide', piece: 60 },

  haehnchen: { name: 'Hähnchenbrust', kcal: 105, p: 23, c: 0, f: 1.2, cat: 'Fleisch & Fisch' },
  rinderhack: { name: 'Rinderhack (mager)', kcal: 130, p: 21, c: 0, f: 5, cat: 'Fleisch & Fisch' },
  lachs: { name: 'Lachsfilet', kcal: 200, p: 20, c: 0, f: 13, cat: 'Fleisch & Fisch' },

  vollkornbrot: { name: 'Vollkornbrot', kcal: 220, p: 7.5, c: 38, f: 1.5, cat: 'Brot & Getreide', piece: 50, pieceName: 'Scheiben' },
  reis: { name: 'Reis', kcal: 350, p: 7, c: 78, f: 0.6, cat: 'Brot & Getreide' },
  nudeln: { name: 'Vollkornnudeln', kcal: 350, p: 13, c: 64, f: 2.5, cat: 'Brot & Getreide' },
  linsen: { name: 'Rote Linsen', kcal: 340, p: 24, c: 50, f: 1.5, cat: 'Brot & Getreide' },
  reiswaffeln: { name: 'Reiswaffeln', kcal: 390, p: 8, c: 80, f: 3, cat: 'Brot & Getreide', piece: 10 },

  thunfisch: { name: 'Thunfisch (Dose, natur)', kcal: 110, p: 25, c: 0, f: 1, cat: 'Konserven & Vorrat' },
  kichererbsen: { name: 'Kichererbsen (Dose)', kcal: 120, p: 7, c: 16, f: 2.5, cat: 'Konserven & Vorrat' },
  kidney: { name: 'Kidneybohnen (Dose)', kcal: 105, p: 7.5, c: 15, f: 0.6, cat: 'Konserven & Vorrat' },
  mais: { name: 'Mais (Dose)', kcal: 80, p: 2.9, c: 15, f: 1.2, cat: 'Konserven & Vorrat' },
  dosentomaten: { name: 'Gehackte Tomaten (Dose)', kcal: 22, p: 1.2, c: 3.5, f: 0.2, cat: 'Konserven & Vorrat' },
  kokosmilch: { name: 'Kokosmilch', kcal: 190, p: 1.8, c: 3, f: 19, cat: 'Konserven & Vorrat', unit: 'ml' },
  olivenoel: { name: 'Olivenöl', kcal: 884, p: 0, c: 0, f: 100, cat: 'Konserven & Vorrat', unit: 'ml' },
  sojasauce: { name: 'Sojasauce', kcal: 60, p: 8, c: 5, f: 0, cat: 'Konserven & Vorrat', unit: 'ml' },
  erdnussmus: { name: 'Erdnussmus', kcal: 610, p: 25, c: 13, f: 50, cat: 'Konserven & Vorrat' },
  honig: { name: 'Honig', kcal: 310, p: 0.4, c: 76, f: 0, cat: 'Konserven & Vorrat' },
  mandeln: { name: 'Mandeln', kcal: 590, p: 21, c: 7, f: 52, cat: 'Konserven & Vorrat' },
  whey: { name: 'Proteinpulver', kcal: 380, p: 75, c: 8, f: 6, cat: 'Sonstiges' },

  banane: { name: 'Bananen', kcal: 93, p: 1.1, c: 20, f: 0.2, cat: 'Obst & Gemüse', piece: 120 },
  apfel: { name: 'Äpfel', kcal: 54, p: 0.3, c: 12, f: 0.2, cat: 'Obst & Gemüse', piece: 150 },
  beeren: { name: 'Beeren (TK)', kcal: 45, p: 1, c: 8, f: 0.5, cat: 'Obst & Gemüse' },
  tomate: { name: 'Tomaten', kcal: 18, p: 0.9, c: 3.9, f: 0.2, cat: 'Obst & Gemüse' },
  paprika: { name: 'Paprika', kcal: 30, p: 1, c: 6, f: 0.3, cat: 'Obst & Gemüse', piece: 160 },
  zwiebel: { name: 'Zwiebeln', kcal: 40, p: 1.1, c: 9, f: 0.1, cat: 'Obst & Gemüse', piece: 80 },
  knoblauch: { name: 'Knoblauch', kcal: 149, p: 6, c: 33, f: 0.5, cat: 'Obst & Gemüse', piece: 5, pieceName: 'Zehen' },
  brokkoli: { name: 'Brokkoli', kcal: 34, p: 2.8, c: 4, f: 0.4, cat: 'Obst & Gemüse' },
  spinat: { name: 'Spinat (TK oder frisch)', kcal: 23, p: 2.9, c: 1.4, f: 0.4, cat: 'Obst & Gemüse' },
  zucchini: { name: 'Zucchini', kcal: 19, p: 1.5, c: 2, f: 0.4, cat: 'Obst & Gemüse' },
  gurke: { name: 'Gurke', kcal: 15, p: 0.6, c: 2.5, f: 0.1, cat: 'Obst & Gemüse' },
  moehren: { name: 'Möhren', kcal: 41, p: 0.9, c: 9, f: 0.2, cat: 'Obst & Gemüse' },
  salat: { name: 'Blattsalat', kcal: 17, p: 1.3, c: 2, f: 0.2, cat: 'Obst & Gemüse' },
  kartoffeln: { name: 'Kartoffeln', kcal: 77, p: 2, c: 16, f: 0.1, cat: 'Obst & Gemüse' },
  suesskartoffel: { name: 'Süßkartoffeln', kcal: 86, p: 1.6, c: 20, f: 0.1, cat: 'Obst & Gemüse' },
};

// Mengen in g bzw. ml für EINE Portion
export const RECIPES = [
  // Frühstück
  { id: 'overnight-oats', name: 'Overnight Oats mit Beeren', slot: 'breakfast', veg: true, time: 5,
    items: { haferflocken: 60, skyr: 150, milch: 100, beeren: 100, honig: 10 },
    steps: ['Haferflocken, Skyr und Milch in einem Glas verrühren.', 'Beeren drauf, mit Honig süßen.', 'Über Nacht in den Kühlschrank stellen.'] },
  { id: 'ruehrei', name: 'Rührei mit Vollkornbrot', slot: 'breakfast', veg: true, time: 10,
    items: { eier: 180, vollkornbrot: 100, tomate: 100, olivenoel: 5 },
    steps: ['Eier verquirlen, salzen, pfeffern.', 'In Öl bei mittlerer Hitze stocken lassen und dabei rühren.', 'Mit Brot und geschnittenen Tomaten servieren.'] },
  { id: 'quark-bowl', name: 'Quark-Bowl mit Banane & Erdnussmus', slot: 'breakfast', veg: true, time: 5,
    items: { magerquark: 250, banane: 120, haferflocken: 30, erdnussmus: 15 },
    steps: ['Quark mit einem Schuss Wasser cremig rühren.', 'Banane in Scheiben schneiden, mit Haferflocken darauf geben.', 'Erdnussmus darüber.'] },
  { id: 'porridge', name: 'Apfel-Zimt-Porridge', slot: 'breakfast', veg: true, time: 10,
    items: { haferflocken: 70, milch: 250, apfel: 150, mandeln: 15 },
    steps: ['Haferflocken mit Milch aufkochen und 3–5 Min. köcheln.', 'Apfel würfeln und unterrühren, mit Zimt würzen.', 'Gehackte Mandeln darüber streuen.'] },
  { id: 'huettenkaese-brot', name: 'Hüttenkäse-Brote mit Gemüse', slot: 'breakfast', veg: true, time: 5,
    items: { vollkornbrot: 100, huettenkaese: 150, gurke: 80, tomate: 80 },
    steps: ['Brot mit Hüttenkäse bestreichen.', 'Gurke und Tomate in Scheiben darauf legen, salzen und pfeffern.'] },

  // Hauptgerichte (Mittag und Abend)
  { id: 'chicken-bowl', name: 'Hähnchen-Reis-Bowl mit Brokkoli', slot: 'main', veg: false, time: 25,
    items: { haehnchen: 150, reis: 80, brokkoli: 200, olivenoel: 10, sojasauce: 15 },
    steps: ['Reis nach Packung kochen.', 'Hähnchen in Streifen schneiden und in Öl rundum anbraten.', 'Brokkoli in Röschen 5 Min. dämpfen oder mitbraten.', 'Mit Sojasauce ablöschen, auf Reis anrichten.'] },
  { id: 'bolognese', name: 'Vollkornpasta Bolognese', slot: 'main', veg: false, time: 30,
    items: { nudeln: 100, rinderhack: 125, dosentomaten: 200, zwiebel: 50, moehren: 50, olivenoel: 5, knoblauch: 5 },
    steps: ['Zwiebel, Knoblauch und Möhre klein würfeln.', 'Hack in Öl krümelig braten, Gemüse dazu und 3 Min. mitbraten.', 'Tomaten dazu, mit Salz, Pfeffer, Oregano würzen, 15 Min. köcheln.', 'Nudeln kochen und mit der Soße servieren.'] },
  { id: 'linsen-curry', name: 'Rotes Linsen-Curry mit Reis', slot: 'main', veg: true, time: 25,
    items: { linsen: 70, reis: 50, kokosmilch: 60, dosentomaten: 150, spinat: 100, zwiebel: 50 },
    steps: ['Zwiebel würfeln und anschwitzen, 1 TL Currypulver kurz mitrösten.', 'Linsen, Tomaten, Kokosmilch und 150 ml Wasser dazu, 15 Min. köcheln.', 'Spinat unterrühren, bis er zusammenfällt. Salzen.', 'Mit Reis servieren.'] },
  { id: 'lachs-ofen', name: 'Lachs mit Ofenkartoffeln & Gemüse', slot: 'main', veg: false, time: 40,
    items: { lachs: 130, kartoffeln: 300, zucchini: 150, paprika: 100, olivenoel: 10 },
    steps: ['Ofen auf 200 °C vorheizen.', 'Kartoffeln vierteln, mit der Hälfte des Öls und Salz mischen, 20 Min. backen.', 'Zucchini und Paprika schneiden, mit dem Lachs aufs Blech legen, Rest-Öl darüber.', 'Weitere 15 Min. backen.'] },
  { id: 'chili', name: 'Chili con Carne mit Reis', slot: 'main', veg: false, time: 35,
    items: { rinderhack: 125, kidney: 120, mais: 60, dosentomaten: 200, paprika: 100, zwiebel: 50, reis: 50 },
    steps: ['Zwiebel und Paprika würfeln.', 'Hack scharf anbraten, Gemüse dazu.', 'Tomaten, Bohnen, Mais dazu, mit Chili, Kreuzkümmel, Paprikapulver würzen, 20 Min. köcheln.', 'Mit Reis servieren. Lässt sich super vorkochen.'] },
  { id: 'wraps', name: 'Hähnchen-Wraps', slot: 'main', veg: false, time: 20,
    items: { wraps: 120, haehnchen: 120, salat: 50, tomate: 80, paprika: 80, joghurt: 50, kaese: 20 },
    steps: ['Hähnchen in Streifen anbraten, mit Paprikapulver würzen.', 'Joghurt mit Salz, Pfeffer, Knoblauch zu einer Soße verrühren.', 'Wraps kurz erwärmen, mit Soße, Salat, Gemüse, Hähnchen und Käse füllen und einrollen.'] },
  { id: 'thunfisch-pasta', name: 'Thunfisch-Pasta mit Tomatensoße', slot: 'main', veg: false, time: 20,
    items: { nudeln: 100, thunfisch: 100, dosentomaten: 200, zwiebel: 40, olivenoel: 10 },
    steps: ['Nudeln kochen.', 'Zwiebel in Öl glasig dünsten, Tomaten dazu, 10 Min. köcheln, würzen.', 'Abgetropften Thunfisch unterheben, mit den Nudeln mischen.'] },
  { id: 'tofu-pfanne', name: 'Tofu-Gemüse-Pfanne mit Reis', slot: 'main', veg: true, time: 25,
    items: { tofu: 200, reis: 70, paprika: 100, brokkoli: 150, sojasauce: 20, olivenoel: 10 },
    steps: ['Reis kochen.', 'Tofu trocken tupfen, würfeln und in Öl knusprig braten.', 'Gemüse dazu und 5 Min. mitbraten.', 'Mit Sojasauce ablöschen und auf Reis servieren.'] },
  { id: 'suesskartoffel-bowl', name: 'Süßkartoffel-Kichererbsen-Bowl mit Feta', slot: 'main', veg: true, time: 35,
    items: { suesskartoffel: 250, kichererbsen: 120, feta: 50, spinat: 60, joghurt: 100, olivenoel: 10 },
    steps: ['Ofen auf 200 °C vorheizen.', 'Süßkartoffel würfeln, mit Kichererbsen, Öl und Gewürzen (Paprika, Kreuzkümmel) mischen, 25 Min. backen.', 'Auf frischem Spinat anrichten, Feta darüber bröseln.', 'Mit Joghurt-Dip (Joghurt, Salz, Zitrone) servieren.'] },
  { id: 'omelett', name: 'Gemüse-Omelett mit Brot', slot: 'main', veg: true, time: 15,
    items: { eier: 180, spinat: 100, paprika: 80, kaese: 20, vollkornbrot: 50 },
    steps: ['Paprika würfeln und kurz anbraten, Spinat dazu.', 'Verquirlte Eier darüber gießen, Käse darauf, bei niedriger Hitze mit Deckel stocken lassen.', 'Mit Brot servieren.'] },

  // Snacks
  { id: 'skyr-beeren', name: 'Skyr mit Beeren', slot: 'snack', veg: true, time: 2,
    items: { skyr: 200, beeren: 100 }, steps: ['Beeren (aufgetaut) über den Skyr geben.'] },
  { id: 'shake', name: 'Protein-Shake mit Banane', slot: 'snack', veg: true, time: 2,
    items: { whey: 30, milch: 300, banane: 120 }, steps: ['Alles in den Mixer oder Shaker, kräftig mixen.'] },
  { id: 'apfel-mandeln', name: 'Apfel & Mandeln', slot: 'snack', veg: true, time: 1,
    items: { apfel: 150, mandeln: 25 }, steps: ['Einfach so – ideal für unterwegs.'] },
  { id: 'reiswaffeln', name: 'Reiswaffeln mit Hüttenkäse', slot: 'snack', veg: true, time: 3,
    items: { reiswaffeln: 30, huettenkaese: 100, gurke: 50 }, steps: ['Reiswaffeln mit Hüttenkäse bestreichen, Gurke darauf.'] },
  { id: 'hummus-sticks', name: 'Hummus mit Gemüsesticks', slot: 'snack', veg: true, time: 5,
    items: { hummus: 60, moehren: 100, paprika: 100 }, steps: ['Möhren und Paprika in Sticks schneiden, in Hummus dippen.'] },
];

// Eigene Rezepte und Zutaten, befüllt von recipes.js (lokal oder aus dem gemeinsamen Plan)
export const CUSTOM = { recipes: [], ingredients: {} };

export function allRecipes() {
  return [...RECIPES, ...CUSTOM.recipes];
}

export function getRecipe(id) {
  return RECIPES.find((r) => r.id === id) || CUSTOM.recipes.find((r) => r.id === id);
}

export function getIngredient(id) {
  return INGREDIENTS[id] || CUSTOM.ingredients[id];
}

export function allIngredients() {
  return { ...INGREDIENTS, ...CUSTOM.ingredients };
}
