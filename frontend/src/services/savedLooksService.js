/**
 * DripRig — Firestore Saved Looks & Admin Upload Logger
 * Automatically formats full absolute HTTPS URLs (e.g. https://driprig.j4du.in/uploads/...)
 * so images can be clicked & viewed directly inside Firebase Console and load cleanly in the app.
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

function toFullUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${window.location.origin}${path}`;
}

/**
 * Admin Audit Logger — Automatically logs every uploaded person photo & outfit as full clickable URLs
 */
export async function logUploadForAdmin(personUrl, outfitUrl = null) {
  const user = auth.currentUser;
  try {
    const adminRef = collection(db, 'admin_uploads');
    await addDoc(adminRef, {
      userId: user ? user.uid : 'anonymous',
      userEmail: user ? user.email : 'anonymous',
      personUrl: toFullUrl(personUrl),
      outfitUrl: toFullUrl(outfitUrl),
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
    personUrl: toFullUrl(resultData.person_url),
    outfitUrl: toFullUrl(resultData.outfit_url),
    resultUrl: toFullUrl(resultData.result_url),
    modelUsed: resultData.model_used || 'VTON',
    processingTimeMs: resultData.processing_time_ms || 0,
    savedAt: serverTimestamp(),
  };

  const docRef = await addDoc(looksRef, newLook);
  return { id: docRef.id, ...newLook };
}

/**
 * Retrieves saved looks for normal user with full absolute URLs
 */
export async function getUserSavedLooks() {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const looksRef = collection(db, `users/${user.uid}/saved_looks`);
    const q = query(looksRef, orderBy('savedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return { 
        id: d.id, 
        ...data,
        resultUrl: toFullUrl(data.resultUrl),
        personUrl: toFullUrl(data.personUrl),
        outfitUrl: toFullUrl(data.outfitUrl),
      };
    });
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
