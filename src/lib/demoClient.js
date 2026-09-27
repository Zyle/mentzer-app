// Demo-mode stand-in for the Supabase client, used ONLY when the app is started
// with EXPO_PUBLIC_DEMO=1 (the web preview). It signs in as a fake athlete and
// serves a few weeks of seeded training + calorie history from memory. Nothing
// is sent to the real database; changes last until the page reloads.
//
// Tip: add ?rest=2 to the preview URL to see the home screen 2 days after a
// workout (default 5 — ready to train).

import { canonicalName } from '../data/exercises';

const DAY = 86400000;
const DEMO_USER = { id: 'demo-user', email: 'demo@mentzer.app' };

const restDays = (() => {
  try {
    const v = parseFloat(new URLSearchParams(globalThis.location?.search || '').get('rest'));
    return isNaN(v) ? 5.2 : v;
  } catch (_) { return 5.2; }
})();

const iso = ms => new Date(ms).toISOString();
const localDate = ms => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── Seed data ────────────────────────────────────────────────────────────────
function seed() {
  const now = Date.now();
  const A = [['Pec Deck', 45, 10], ['Dips', 20, 8], ['Close Grip Underhand Pulldown', 65, 8], ['Lateral Raise', 12, 9]];
  const B = [['Leg Extension', 60, 11], ['Leg Press', 180, 9], ['Deadlift', 140, 7], ['Standing Calf Raise', 90, 14]];

  const profiles = [{
    id: DEMO_USER.id, email: DEMO_USER.email, name: 'Alex Carter', age: 31, sex: 'male',
    height_cm: 180, bodyweight_kg: 82, goal: 'bulk', experience_level: 'intermediate',
    calorie_adjustment: 16, last_weight_checkin: iso(now - 6 * DAY),
    routine: [...A, ...B].map(e => e[0]), routine_type: 'two_way',
  }];

  // Eight sessions, alternating A/B, ~5 days apart, getting a little stronger
  const workouts = [], sets = [], bests = {};
  const gaps = [5, 6, 4, 5, 7, 5, 3, 5];
  let t = now - restDays * DAY;
  const times = [];
  for (let i = 0; i < gaps.length; i++) { times.unshift(t); t -= gaps[i] * DAY; }
  times.forEach((ts, i) => {
    const session = i % 2 === 0 ? A : B;
    const id = `w${i + 1}`;
    workouts.push({ id, user_id: DEMO_USER.id, date: iso(ts), created_at: iso(ts) });
    const done = i === 3 ? session.slice(0, 3) : session; // one incomplete session
    done.forEach(([setupName, base, reps], j) => {
      const name = canonicalName(setupName); // sets/PBs use canonical names, like the real app
      const weight = Math.round((base + Math.floor(i / 2) * 2.5) * 4) / 4;
      const r = reps - (i % 3 === 2 ? 1 : 0);
      sets.push({ id: `${id}-s${j}`, user_id: DEMO_USER.id, workout_id: id, exercise_name: name,
        weight_kg: weight, reps: r, date: iso(ts + j * 240000), created_at: iso(ts + j * 240000) });
      const pb = bests[name];
      if (!pb || weight > pb.weight_kg || (weight === pb.weight_kg && r > pb.reps)) {
        bests[name] = { user_id: DEMO_USER.id, exercise_name: name, weight_kg: weight, reps: r, date: iso(ts) };
      }
    });
  });

  // Calorie logs: ~80% of the last 30 days, mostly near the 2,491 kcal target
  const calorie_logs = [];
  const meals = ['Oats & banana', 'Chicken rice bowl', 'Greek yoghurt', 'Salmon & potatoes', 'Steak & veg'];
  for (let d = 30; d >= 1; d--) {
    if (d % 5 === 2) continue;
    const total = 2491 + Math.round(Math.sin(d * 1.7) * 260);
    const parts = [0.25, 0.35, 0.1, 0.3];
    parts.forEach((p, k) => calorie_logs.push({
      id: `c${d}-${k}`, user_id: DEMO_USER.id, date: localDate(now - d * DAY),
      entry_name: meals[(d + k) % meals.length], calories: Math.round(total * p),
      created_at: iso(now - d * DAY + k * 3600000),
    }));
  }
  [['Oats & banana', 520], ['Chicken rice bowl', 780]].forEach(([n, c], k) => calorie_logs.push({
    id: `today-${k}`, user_id: DEMO_USER.id, date: localDate(now), entry_name: n, calories: c,
    created_at: iso(now - (3 - k) * 3600000),
  }));

  return { profiles, workouts, sets, personal_bests: Object.values(bests), calorie_logs, workout_templates: [] };
}

const db = seed();
let nextId = 1;

// ── Query builder (thenable, chainable) ─────────────────────────────────────
function query(table) {
  const rows = () => (db[table] = db[table] || []);
  const filters = [];
  let op = 'select', payload = null, one = false, maybe = false, sort = null, lim = null, upsertKey = null;

  const run = () => {
    const match = r => filters.every(f => f(r));
    let data = null;
    if (op === 'insert' || op === 'upsert') {
      const list = (Array.isArray(payload) ? payload : [payload]).map(r => ({ ...r }));
      data = list.map(r => {
        const keys = upsertKey ? upsertKey.split(',') : ['id'];
        const existing = op === 'upsert' && rows().find(x => keys.every(k => r[k] !== undefined && x[k] === r[k]));
        if (existing) { Object.assign(existing, r); return existing; }
        const row = { id: `demo-${nextId++}`, created_at: new Date().toISOString(), ...r };
        if (table !== 'profiles' && !row.date && table !== 'calorie_logs') row.date = row.created_at;
        rows().push(row);
        return row;
      });
    } else if (op === 'update') {
      data = rows().filter(match);
      data.forEach(r => Object.assign(r, payload));
    } else if (op === 'delete') {
      data = rows().filter(match);
      db[table] = rows().filter(r => !match(r));
    } else {
      data = rows().filter(match).map(r => ({ ...r }));
    }
    if (sort) data = [...data].sort((a, b) => (a[sort.col] > b[sort.col] ? 1 : a[sort.col] < b[sort.col] ? -1 : 0) * (sort.asc ? 1 : -1));
    if (lim !== null) data = data.slice(0, lim);
    if (one) {
      if (!data.length && !maybe) return { data: null, error: { message: 'No rows (demo)', code: 'PGRST116' } };
      return { data: data[0] ? { ...data[0] } : null, error: null };
    }
    return { data, error: null };
  };

  const b = {
    select: () => b,
    insert: v => { op = 'insert'; payload = v; return b; },
    upsert: (v, opts) => { op = 'upsert'; payload = v; upsertKey = opts?.onConflict || null; return b; },
    update: v => { op = 'update'; payload = v; return b; },
    delete: () => { op = 'delete'; return b; },
    eq:  (c, v) => { filters.push(r => r[c] === v); return b; },
    neq: (c, v) => { filters.push(r => r[c] !== v); return b; },
    in:  (c, v) => { filters.push(r => v.includes(r[c])); return b; },
    gte: (c, v) => { filters.push(r => r[c] >= v); return b; },
    lte: (c, v) => { filters.push(r => r[c] <= v); return b; },
    gt:  (c, v) => { filters.push(r => r[c] > v); return b; },
    lt:  (c, v) => { filters.push(r => r[c] < v); return b; },
    is:  (c, v) => { filters.push(r => (r[c] ?? null) === v); return b; },
    order: (col, o) => { sort = { col, asc: o?.ascending !== false }; return b; },
    limit: n => { lim = n; return b; },
    single: () => { one = true; return b; },
    maybeSingle: () => { one = true; maybe = true; return b; },
    then: (res, rej) => Promise.resolve().then(run).then(res, rej),
  };
  return b;
}

// ── Client ───────────────────────────────────────────────────────────────────
export function createDemoClient() {
  const session = { user: DEMO_USER, access_token: 'demo' };
  const ok = extra => Promise.resolve({ data: extra || {}, error: null });
  return {
    from: query,
    auth: {
      getSession: () => ok({ session }),
      getUser: () => ok({ user: DEMO_USER }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: () => ok({ session }),
      signUp: () => ok({}),
      signOut: () => { console.log('[demo] sign-out is disabled in demo mode'); return ok(); },
      updateUser: () => ok({ user: DEMO_USER }),
      resetPasswordForEmail: () => ok(),
      verifyOtp: () => ok({ session }),
    },
  };
}
