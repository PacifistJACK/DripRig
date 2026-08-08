/**
 * DripRig — Firestore Saved Looks & Admin Upload Logger
 * 1. logUploadForAdmin: Automatically logs every uploaded person photo & outfit for Admin in Firebase Console.
 * 2. saveLookToFirestore: Saves generated result ONLY when user explicitly clicks "Save Look".
 * 3. getUserSavedLooks: Returns clean saved looks for normal app users.
 */
import { db, auth } from '../firebase.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';

/**
 * Admin Audit Logger — Automatically logs every uploaded person photo to Firestore
 */
export async function logUploadForAdmin(personUrl, outfitUrl = null) {
  const user = auth.currentUser;
  try {
    const adminRef = collection(db, 'admin_uploads');
    await addDoc(adminRef, {
      userId: user ? user.uid : 'anonymous',
      userEmail: user ? user.email : 'anonymous',
      personUrl: personUrl || null,
      outfitUrl: outfitUrl || null,
      uploadedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[Admin Logger] Failed to log upload to Firestore:', err);
  }
}

/**
 * User Saved Looks — Saved ONLY when user clicks "Save Look"
 */
export async function saveLookToFirestore(resultData) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be logged in to save looks.");
  }

  const looksRef = collection(db, `users/${user.uid}/saved_looks`);
  const newLook = {
    userId: user.uid,
    userEmail: user.email,
    personUrl: resultData.person_url || null,
    outfitUrl: resultData.outfit_url || null,
    resultUrl: resultData.result_url,
    modelUsed: resultData.model_used || 'VTON',
    processingTimeMs: resultData.processing_time_ms || 0,
    savedAt: serverTimestamp(),
  };

  const docRef = await addDoc(looksRef, newLook);
  return { id: docRef.id, ...newLook };
}

/**
 * Retrieves saved looks for normal user
 */
export async function getUserSavedLooks() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const looksRef = collection(db, `users/${user.uid}/saved_looks`);
    const q = query(looksRef, orderBy('savedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching saved looks:', err);
    return [];
  }
}

/**
 * Deletes a saved look from user's collection
 */
export async function deleteSavedLook(lookId) {
  const user = auth.currentUser;
  if (!user) return;

  const docRef = doc(db, `users/${user.uid}/saved_looks`, lookId);
  await deleteDoc(docRef);
}
