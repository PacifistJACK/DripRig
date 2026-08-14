/**
 * DripRig — Credits Service
 * Stores per-user credit balance in Firestore: users/{uid}  → { credits, totalGenerations }
 * New users are automatically seeded with INITIAL_CREDITS on first use.
 */
import { db, auth } from '../firebase.js';
import { doc, getDoc, setDoc, runTransaction, increment } from 'firebase/firestore';

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
 * Atomically deduct credits after a successful generation.
 * Uses a Firestore transaction to prevent race conditions / double-spend.
 * @param {'fast'|'quality'} model
 * @returns {Promise<number>} new balance
 * @throws if user has insufficient credits (race condition guard)
 */
export async function deductCredits(model) {
  const user = auth.currentUser;
  if (!user) return 0;

  const cost = creditCostFor(model);
  const ref  = userRef(user.uid);

  const newBalance = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data()?.credits ?? 0;

    if (current < cost) {
      throw new Error(`Insufficient credits: need ${cost}, have ${current}`);
    }

    const updated = current - cost;
    tx.update(ref, {
      credits:          updated,
      totalGenerations: increment(1),
    });
    return updated;
  });

  return newBalance;
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
