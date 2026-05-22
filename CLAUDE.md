# Mentzer Method — App Context

This file is read automatically by Claude Code at the start of every session.
It contains verified source material and app context so Claude doesn't need to be re-briefed.

---

## What this app is

A Mike Mentzer Heavy Duty II (HD2) training app. Not a generic workout tracker —
a faithful coaching tool built around Mentzer's specific philosophy.
Business model: 1-month free trial, then £9.99/month.
Stack: React Native (Expo SDK 54), Supabase, React Navigation v7.

Collaborators: Zyle (owner), twlawler / Toby Wosahlo-Lawler (contributor).

---

## Verified Mentzer Principles (sourced from docs/)

Source files are in `/docs`. The nutrition text is `mentzer_nutrition.txt`.
The HD2 text is `Hd2.txt` (note: this is a Portuguese/Spanish translation — use for
structure only, not direct quotes).

### Calorie Surplus for Muscle Gain — VERIFIED FROM SOURCE
Direct quote from mentzer_nutrition.txt:
> "Since one pound of muscle tissue yields about 600 calories, and you are going to
> gain 10 pounds of muscle, you'd have to consume 600 times 10, or 6,000 calories a
> year, above your maintenance level. That's right! 6,000 extra calories a year. Not a
> day, a week or a month... divide 6,000 by 365 and you come up with about 16 extra
> calories a day."

**The 16 cal/day figure is real and directly from Mentzer.**
The surplus slider for bulking should be anchored to this. Recommended range: 16–200 cal/day.
Default/recommended position: 16 cal/day (labelled "Mentzer Method").

### Protein — VERIFIED FROM SOURCE
Direct quote:
> "Muscle is comprised of up to 72% water in healthy individuals, with only 22% being
> protein... Most bodybuilders make the mistake of force-feeding themselves hundreds
> of extra grams of protein and thousands of extra calories a day beyond maintenance
> needs."

Mentzer was **against** excess protein. He did not give a specific gram-per-pound target
in the nutrition text. The app's current 0.8g/kg target is reasonable and conservative.
Do NOT use aggressive protein targets (e.g. 1g/lb) — this contradicts Mentzer.

### Calorie Deficit for Fat Loss — NOT SPECIFIED IN SOURCE
Mentzer's nutrition book does not give a specific deficit number.
The 500 cal/day deficit currently hardcoded is a standard recommendation, not Mentzer's.
Slider range for cutting: 200–500 cal/day. Recommended: 300 cal/day (safe, muscle-preserving).

### Rep Range — VERIFIED FROM SOURCE
Direct quote:
> "Select a weight for each of the listed exercises which allows for the performance
> of approximately 6-10 reps... fewer than six will not tax your reserves sufficiently,
> and more than 12 could cause you to terminate the set due to cardiorespiratory
> insufficiency before muscular failure is reached."

**6-10 reps is the verified HD2 rep range.** Some isolation exercises use 8-12.

### Sets — VERIFIED FROM SOURCE
1 set per exercise, taken to absolute muscular failure (momentary muscular failure).
This is non-negotiable in HD2. Do not suggest multiple sets anywhere in the app.

### Rest Between Exercises — VERIFIED FROM SOURCE
Direct quote:
> "There should be no rest between exercises listed as a superset. Minimize the rest
> time between sets not listed as a superset. Rest just long enough so that you can
> go into the next set without being hampered by cardiorespiratory insufficiency."

### Training Frequency — VERIFIED FROM SOURCE
Early stage: every other day (Mon/Wed/Fri or Tue/Thu/Sat).
As strength increases: reduce frequency. Eventually: 4-7 days between sessions.
The app uses 4-7 days which aligns with HD2's advanced protocol.

### Core Philosophy — VERIFIED FROM SOURCE
- Intensity over volume. One set to failure beats 20 sets to fatigue.
- Brief and infrequent training is the goal, not a compromise.
- Recovery and growth are separate physiological processes — both require time.
- Overtraining is the primary enemy. When in doubt, rest more.
- "The body is very economical with its adaptive biochemical reserves."

---

## App Architecture

```
src/
  screens/         HomeScreen, WorkoutScreen, ProgressScreen, ProfileScreen, OnboardingScreen, LoginScreen
  components/      Card, ScreenHeader, ErrorBoundary
  lib/             supabase.js, progression.js
  data/            exercises.js, quotes.js
  theme.js         Single source of truth for all colors, spacing, typography
docs/
  Hd2.txt                  HD2 book (Portuguese/Spanish translation)
  mentzer_nutrition.txt    Nutrition book (English, verified source)
```

All colors use `COLORS.*` from `theme.js`. Never hardcode hex values in screens.
All fetch functions are named `loadData()` across all screens.

### Supabase tables
- `profiles` — id, name, email, age, sex, height_cm, bodyweight_kg, goal, experience_level, last_weight_checkin, calorie_adjustment, routine (text[])
- `workouts` — id, user_id, date (created lazily on first set log, not on screen mount)
- `sets` — id, user_id, workout_id, exercise_name, weight_kg, reps, date
- `personal_bests` — user_id, exercise_name, weight_kg, reps, date (unique on user_id + exercise_name)

### Key technical decisions
- No react-native-svg (broken at SDK 54). Circular progress uses pure RN half-circle masks.
- metro.config.js has `unstable_enablePackageExports = false` — required for Supabase, do not remove.
- Workout records created lazily via `ensureWorkout()` — not on screen mount.
- Onboarding checks all 7 profile fields: name, age, sex, height_cm, bodyweight_kg, goal, experience_level.

---

## Features built
- Auth (Supabase email/password)
- 6-step onboarding with metric/imperial toggle
- Home screen with recovery status, circular progress, phase bar
- Workout logging with previous best, HD2 analysis, PR tracking
- Progress screen with next session targets
- Profile screen with TDEE, nutrition targets, HD2 protocol info, calorie sliders
- Calorie adjustment sliders (bulk: 50-300 cal, cut: 100-500 cal) with live weight-loss prediction
- Workout history screen (4th tab — sessions, exercises, sets, total volume)
- Exercise selection screen (post-onboarding — tier 1/2/3 system, experience-based defaults, coverage validation)

## Features remaining
- Weight check-in prompts (biweekly)
- Push notifications ("you're ready to train" when recovery hits day 4)
- Progress graphs (weight over time per exercise — line chart)
- Subscription paywall (RevenueCat, £9.99/month, 1 month free trial)
- Rest timer between sets
- App Store submission
