/**
 * DripRig — Credits Service
 * Stores per-user credit balance in Firestore: users/{uid}  → { credits, totalGenerations }
 * New users are automatically seeded with INITIAL_CREDITS on first use.
 */
import { db, auth } from '../firebase.js';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

export const INITIAL_CREDITS   = 10;
export const COST_FAST         = 1;
export const COST_QUALITY      = 2;

/** Returns the Firestore document ref for the current user's profile. */
function userRef(uid) {
  return doc(db, 'users', uid);
}

/**
 * Fetch credit balance for the logged-in user.
 * If no document exists yet, create it with INITIAL_CREDITS.
 * @returns {Promise<number>}
 */
export async function getCredits() {
  const user = auth.currentUser;
  if (!user) return 0;

  const ref  = userRef(user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // First time — seed the account
    await setDoc(ref, {
      credits:          INITIAL_CREDITS,
      totalGenerations: 0,
      createdAt:        new Date().toISOString(),
      email:            user.email || '',
    });
    return INITIAL_CREDITS;
  }

  return snap.data().credits ?? 0;
}

/**
 * Returns the credit cost for a given model key.
 * @param {'fast'|'quality'} model
 * @returns {number}
 */
export function creditCostFor(model) {
  return model === 'quality' ? COST_QUALITY : COST_FAST;
}

/**
 * Deduct credits after a successful generation.
 * @param {'fast'|'quality'} model
 * @returns {Promise<number>} new balance
 */
export async function deductCredits(model) {
  const user = auth.currentUser;
  if (!user) return 0;

  const cost = creditCostFor(model);
  const ref  = userRef(user.uid);

  await updateDoc(ref, {
    credits:          increment(-cost),
    totalGenerations: increment(1),
  });

  const snap = await getDoc(ref);
  return snap.data().credits ?? 0;
}

/**
 * Check if user has enough credits without deducting.
 * @param {'fast'|'quality'} model
 * @returns {Promise<boolean>}
 */
export async function hasEnoughCredits(model) {
  const balance = await getCredits();
  return balance >= creditCostFor(model);
}
