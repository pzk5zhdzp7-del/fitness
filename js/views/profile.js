// Profil: Körperdaten, Trainingseinstellungen, Einstufung, Datensicherung
import { state, save, exportData, importData, resetAll } from '../store.js';
import { PATHS } from '../data/skills.js';
import { currentLevel, setLevel } from '../training.js';
import { targets, dayMacros, ensurePlan, GOALS, ACTIVITY } from '../nutrition.js';
import { esc, n0, WEEKDAYS, WEEK_ORDER, openSheet, closeSheet, rerender } from '../ui.js';
import { healthSettings } from '../health.js';
import {
  isLinked, syncStatus, members, inviteText, createHousehold, joinHousehold, unlink, validDbUrl,
} from '../sync.js';

const STATUS = { online: '🟢 verbunden', connecting: '🟡 verbindet …', offline: '⚪️ offline, Änderungen werden nachgeholt', error: '🔴 Verbindung gestört', off: '⚪️ getrennt' };

function syncSection() {
  if (isLinked()) {
    const ms = members();
    return `
    <div class="list">
      <div class="row"><div class="grow">Status</div><div class="small">${STATUS[syncStatus.value]}</div></div>
      ${ms.map((m) => `<div class="row"><span class="icon">${m.app === 'gym' ? '🏋️‍♀️' : '🤸'}</span><div class="grow">${esc(m.name)}${m.me ? ' <span class="pill">du</span>' : ''}</div><div class="small muted">${n0(m.kcal)} kcal</div></div>`).join('')}
      <button class="row" data-action="sync-invite"><span class="grow">Einladung für die andere App</span><span class="chev">›</span></button>
      <button class="row" data-action="sync-unlink" style="color:#dc2626"><span class="grow">Verbindung trennen</span></button>
    </div>
    <p class="small muted">Wochenplan und Einkaufsliste sind gemeinsam. Die Portionen rechnet jede App nach dem eigenen Kalorienziel, die Einkaufsliste enthält die Mengen für alle.</p>`;
  }
  return `
    <p class="small muted" style="margin-top:0">Teile Wochenplan und Einkaufsliste live mit einer zweiten App, z. B. der Gym-App deiner Freundin. Dafür braucht es einmalig einen kostenlosen Firebase-Speicher (siehe Anleitung).</p>
    <div class="list">
      <button class="row" data-action="sync-join"><span class="icon">📩</span><span class="grow">Einladung einfügen</span><span class="chev">›</span></button>
      <button class="row" data-action="sync-create"><span class="icon">✨</span><span class="grow">Neuen gemeinsamen Plan anlegen</span><span class="chev">›</span></button>
    </div>`;
}

function syncForm(kind) {
  const name = state.sync?.name || '';
  const field = kind === 'join'
    ? '<label class="field"><span>Einladung (aus der anderen App kopiert)</span><input id="sync-invite" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…firebasedatabase.app#…"></label>'
    : '<label class="field"><span>Adresse der Firebase-Datenbank</span><input id="sync-db" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://name-default-rtdb.europe-west1.firebasedatabase.app"></label>';
  openSheet(`<h3>${kind === 'join' ? 'Einladung einfügen' : 'Gemeinsamen Plan anlegen'}</h3>
    <p class="small muted">${kind === 'join' ? 'Der aktuelle Wochenplan wird durch den gemeinsamen ersetzt.' : 'Dein aktueller Wochenplan und deine Einkaufsliste werden zum gemeinsamen Plan.'}</p>
    <div class="list">
      <label class="field"><span>Dein Name (sieht die andere Person)</span><input id="sync-name" value="${esc(name)}" autocomplete="off"></label>
      ${field}
    </div>
    <p class="small" id="sync-error" style="color:#dc2626"></p>
    <button class="btn block" data-action="sync-${kind}-go">${kind === 'join' ? 'Verbinden' : 'Anlegen'}</button>
    <button class="btn secondary block" data-action="close-sheet" style="margin-top:8px">Abbrechen</button>`);
}

async function runSync(fn) {
  const err = document.getElementById('sync-error');
  const name = document.getElementById('sync-name').value.trim() || 'Ich';
  try {
    err.textContent = '';
    await fn(name);
    closeSheet();
    rerender();
  } catch (e) {
    err.textContent = e.message === 'Failed to fetch' ? 'Keine Verbindung zur Datenbank. Adresse prüfen?' : e.message;
  }
}


export function viewProfile() {
  const p = state.profile;
  const t = targets();
  const num = (key, label, decimal = false) => `<label class="field"><span>${label}</span><input type="text" inputmode="${decimal ? 'decimal' : 'numeric'}" data-profile="${key}" data-num value="${String(p[key]).replace('.', decimal ? ',' : '.')}"></label>`;
  const toggle = (attr, key, on, label, hint = '') => `<label class="check-row"><span class="grow">${label}${hint ? `<div class="small muted">${hint}</div>` : ''}</span><input type="checkbox" class="switch" ${attr}="${key}" ${on ? 'checked' : ''}></label>`;

  const dayBtns = WEEK_ORDER.map((wd) => `<button class="${state.trainingDays.includes(wd) ? 'on' : ''}" data-action="toggle-day" data-day="${wd}">${WEEKDAYS[wd]}</button>`).join('');

  const levels = PATHS.map((path) => `
    <label class="field"><span>${path.icon} ${esc(path.name)}</span>
      <select data-level="${path.id}">${path.levels.map((l, i) => `<option value="${i}" ${i === currentLevel(path.id).idx ? 'selected' : ''}>${i + 1}. ${esc(l.name)}</option>`).join('')}</select>
    </label>`).join('');

  return `
    <h2>Training</h2>
    <div class="list">
      <div class="days">${dayBtns}</div>
      ${toggle('data-setting', 'voice', state.settings.voice, 'Sprachansage im Training', 'Sagt Übung, Ziel und nächste Übung an.')}
      ${toggle('data-setting', 'cooldown', state.settings.cooldown, 'Cool-down mit Dehnübungen', 'Am Ende jedes Trainings ca. 5–8 Min Beweglichkeit.')}
    </div>

    <h2>Einstufung (aktuelle Stufe je Skill)</h2>
    <div class="list">${levels}</div>

    <h2>Körperdaten & Ziel</h2>
    <div class="list">
      <label class="field"><span>Geschlecht</span><select data-profile="sex">
        <option value="m" ${p.sex === 'm' ? 'selected' : ''}>männlich</option>
        <option value="f" ${p.sex === 'f' ? 'selected' : ''}>weiblich</option></select></label>
      ${num('age', 'Alter')}
      ${num('height', 'Größe (cm)')}
      ${num('weight', 'Gewicht (kg)', true)}
      <label class="field"><span>Alltag</span><select data-profile="activity">
        ${ACTIVITY.map((a) => `<option value="${a.value}" ${p.activity === a.value ? 'selected' : ''}>${a.label}</option>`).join('')}</select></label>
      <label class="field"><span>Ziel</span><select data-profile="goal">
        ${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${p.goal === k ? 'selected' : ''}>${g.label}</option>`).join('')}</select></label>
      ${num('proteinPerKg', 'Eiweiß (g pro kg Körpergewicht)', true)}
    </div>
    <div class="card"><div class="flex between"><span>Tagesbedarf</span><b>${n0(t.kcal)} kcal · ${t.protein} g Eiweiß</b></div></div>

    <h2>Ernährungsplan</h2>
    <div class="list">
      ${toggle('data-profile-bool', 'vegetarian', p.vegetarian, 'Nur vegetarische Gerichte')}
      ${toggle('data-profile-bool', 'leftovers', p.leftovers, 'Reste-Modus', 'Mittags gibt\'s das Abendessen vom Vortag – halb so oft kochen.')}
    </div>
    <p class="small muted">Diese beiden Optionen gelten ab dem nächsten neuen Wochenplan.</p>

    <h2>Apple Watch</h2>
    ${healthSettings()}

    <h2>Gemeinsam planen</h2>
    ${syncSection()}

    <h2>Daten</h2>
    <div class="list">
      <button class="row" data-action="export"><span class="grow">Backup exportieren</span><span class="chev">›</span></button>
      <label class="row"><span class="grow">Backup importieren</span><input type="file" accept="application/json,.json" data-import style="display:none"><span class="chev">›</span></label>
      <button class="row" data-action="reset" style="color:#dc2626"><span class="grow">Alle Daten löschen</span></button>
    </div>
    <p class="small muted center">Alle Daten bleiben auf diesem Gerät. Ein Backup ab und zu schadet nicht.</p>`;
}

// Kalorienziel geändert: Portionen im bestehenden Plan neu anpassen
function refitPlanTarget() {
  if (!state.mealPlan) return;
  const { kcal } = targets();
  state.mealPlan.kcal = kcal;
  for (const day of state.mealPlan.days) {
    day.scale = 1;
    const base = dayMacros(day).kcal;
    day.scale = Math.round(Math.max(0.7, Math.min(1.6, kcal / base)) * 20) / 20;
  }
}

export const profileActions = {
  'toggle-day'(el) {
    const d = Number(el.dataset.day);
    const days = new Set(state.trainingDays);
    if (days.has(d)) days.delete(d);
    else days.add(d);
    state.trainingDays = [...days].sort();
    save();
    rerender();
  },
  async export() {
    const json = exportData();
    const name = `calisthenics-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Calisthenics-Backup' }); return; } catch { /* abgebrochen */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  'sync-create'() {
    syncForm('create');
  },
  'sync-join'() {
    syncForm('join');
  },
  'sync-create-go'() {
    runSync((name) => {
      const db = document.getElementById('sync-db').value.trim();
      if (!validDbUrl(db)) throw new Error('Das sieht nicht nach einer Firebase-Adresse aus (https://….firebasedatabase.app).');
      return createHousehold(db, name, ensurePlan());
    });
  },
  'sync-join-go'() {
    runSync((name) => joinHousehold(document.getElementById('sync-invite').value, name));
  },
  async 'sync-invite'() {
    const text = inviteText();
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* abgebrochen */ }
    }
    try { await navigator.clipboard.writeText(text); } catch { /* nicht erlaubt */ }
    openSheet(`<h3>Einladung</h3><p class="small muted">Diesen Text in der anderen App unter Profil → Gemeinsam planen → Einladung einfügen eintragen.</p>
      <div class="card"><code class="invite">${esc(text)}</code></div>
      <button class="btn block" data-action="close-sheet">Fertig</button>`);
  },
  'sync-unlink'() {
    if (!confirm('Verbindung trennen? Plan und Einkaufsliste bleiben auf diesem Gerät, werden aber nicht mehr geteilt.')) return;
    unlink();
    rerender();
  },
  reset() {
    if (!confirm('Wirklich alle Daten (Trainings, Stufen, Profil) löschen?')) return;
    resetAll();
    location.hash = '#/';
    location.reload();
  },
};

// Gibt true zurück, wenn das change-Event hier behandelt wurde
export function profileChange(el) {
  if (el.dataset.profile) {
    const key = el.dataset.profile;
    const v = el.hasAttribute('data-num') || key === 'activity' ? parseFloat(String(el.value).replace(',', '.')) : el.value;
    if (typeof v === 'number' && !(v > 0)) { rerender(); return true; }
    state.profile[key] = v;
    refitPlanTarget();
    save();
    rerender();
  } else if (el.dataset.profileBool) {
    state.profile[el.dataset.profileBool] = el.checked;
    save();
  } else if (el.dataset.setting) {
    state.settings[el.dataset.setting] = el.checked;
    save();
  } else if (el.dataset.level) {
    setLevel(el.dataset.level, Number(el.value));
  } else if (el.hasAttribute('data-import') && el.files[0]) {
    el.files[0].text().then((txt) => {
      try {
        importData(txt);
        alert('Backup importiert.');
        rerender();
      } catch (err) {
        alert(`Import fehlgeschlagen: ${err.message}`);
      }
    });
  } else {
    return false;
  }
  return true;
}
