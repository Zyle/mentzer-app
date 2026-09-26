// Display units. Everything is stored metric (kg / cm); this only converts for
// display and input. The preference lives in AsyncStorage ('units') and is
// shared live across screens via a tiny subscriber list.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'units';
const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

let current = 'metric';
let loaded = false;
const listeners = new Set();

const load = async () => {
  if (loaded) return current;
  try { current = (await AsyncStorage.getItem(KEY)) === 'imperial' ? 'imperial' : 'metric'; } catch (_) {}
  loaded = true;
  listeners.forEach(fn => fn(current));
  return current;
};

export const setUnits = async (units) => {
  current = units === 'imperial' ? 'imperial' : 'metric';
  loaded = true;
  listeners.forEach(fn => fn(current));
  try { await AsyncStorage.setItem(KEY, current); } catch (_) {}
};

export const getUnits = load;

const round1 = n => Math.round(n * 10) / 10;

// Pure helpers — pass `imperial` explicitly
export const kgToDisplay = (kg, imperial) => (kg == null || kg === '' ? null : round1(imperial ? kg * LB_PER_KG : kg));
export const displayToKg = (val, imperial) => {
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return imperial ? Math.round((n / LB_PER_KG) * 100) / 100 : n;
};
export const cmToFtIn = (cm) => {
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - ft * 12);
  if (inches === 12) { ft += 1; inches = 0; }
  return { ft, inches };
};
export const ftInToCm = (ft, inches) =>
  Math.round(((parseFloat(ft) || 0) * 12 + (parseFloat(inches) || 0)) * CM_PER_IN * 10) / 10;

// React hook: { imperial, weightUnit, fmtWeight(kg), fmtHeight(cm), setUnits }
export function useUnits() {
  const [units, setState] = useState(current);
  useEffect(() => {
    listeners.add(setState);
    load().then(setState);
    return () => listeners.delete(setState);
  }, []);

  const imperial = units === 'imperial';
  return {
    units,
    imperial,
    weightUnit: imperial ? 'lb' : 'kg',
    fmtWeight: (kg) => {
      const v = kgToDisplay(kg, imperial);
      return v == null ? '—' : `${v}${imperial ? 'lb' : 'kg'}`;
    },
    fmtHeight: (cm) => {
      if (!cm) return '—';
      if (!imperial) return `${cm}cm`;
      const { ft, inches } = cmToFtIn(cm);
      return `${ft}'${inches}"`;
    },
    setUnits,
  };
}
