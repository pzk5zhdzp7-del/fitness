// Muskeln für die Muskelgrafik und den Muskelkater (gleiche Schlüssel wie in der Gym-App)
import { getPath } from './skills.js';

export const MUSCLES = {
  chest: 'Brust',
  frontDelts: 'Schulter vorne',
  sideDelts: 'Schulter seitlich',
  rearDelts: 'Schulter hinten',
  triceps: 'Trizeps',
  biceps: 'Bizeps',
  upperBack: 'Oberer Rücken',
  lats: 'Breiter Rückenmuskel',
  lowerBack: 'Unterer Rücken',
  abs: 'Bauch',
  obliques: 'Seitliche Bauchmuskeln',
  glutes: 'Po',
  gluteMed: 'Po seitlich',
  quads: 'Oberschenkel vorne',
  hamstrings: 'Oberschenkel hinten',
  adductors: 'Oberschenkel innen',
  calves: 'Waden',
};

// [Hauptmuskeln, Hilfsmuskeln] je Skill-Pfad
const PATH_MUSCLES = {
  handstand: [['frontDelts', 'sideDelts'], ['triceps', 'upperBack', 'abs']],
  hspu: [['frontDelts', 'triceps'], ['sideDelts', 'upperBack', 'chest']],
  planche: [['frontDelts', 'chest'], ['abs', 'biceps', 'triceps']],
  frontlever: [['lats', 'abs'], ['upperBack', 'rearDelts', 'biceps', 'lowerBack']],
  muscleup: [['lats', 'biceps'], ['upperBack', 'triceps', 'chest', 'rearDelts']],
  dips: [['chest', 'triceps'], ['frontDelts']],
  rows: [['upperBack', 'lats'], ['rearDelts', 'biceps']],
  legs: [['quads', 'glutes'], ['hamstrings', 'adductors', 'calves', 'gluteMed']],
  lsit: [['abs'], ['obliques', 'quads', 'triceps']],
};

// Eigene Übungen: grob nach Bereich
const GROUP_MUSCLES = {
  Skill: PATH_MUSCLES.handstand,
  Drücken: PATH_MUSCLES.dips,
  Ziehen: [['lats', 'upperBack'], ['biceps', 'rearDelts']],
  Beine: PATH_MUSCLES.legs,
  Core: PATH_MUSCLES.lsit,
};

export function pathMuscles(pathId) {
  const [muscles, muscles2] = PATH_MUSCLES[pathId] || GROUP_MUSCLES[getPath(pathId)?.group] || [[], []];
  return { muscles, muscles2 };
}
