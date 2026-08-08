/**
 * DripRig — Firestore Saved Looks & Admin Upload Logger
 * Encodes image files as Base64 Data Strings directly inside Firebase Cloud Firestore
 * so images are PERMANENTLY stored in Google's cloud database with ZERO dependency on Render disk!
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
  if (url.startsWith('data:image') || url.startsWith('http://') || url.startsWith('https://')) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${window.location.origin}${path}`;
}

/**
 * Converts an image URL (relative or HTTP) to a permanent Base64 Data String
 */
async function urlToBase64(url) {
  if (!url) return null;
  if (url.startsWith('data:image')) return url;
  try {
    const fullUrl = toFullUrl(url);
    const response = await fetch(fullUrl);
    if (!response.ok) return fullUrl;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return toFullUrl(url);
  }
}

/**
 * Admin Audit Logger — Permanently logs uploaded person photo & outfit as Base64 in Firestore
 */
export async function logUploadForAdmin(personUrl, outfitUrl = null) {
  const user = auth.currentUser;
  try {
    const [personB64, outfitB64] = await Promise.all([
      urlToBase64(personUrl),
      urlToBase64(outfitUrl),
    ]);

    const adminRef = collection(db, 'admin_uploads');
    await addDoc(adminRef, {
      userId: user ? user.uid : 'anonymous',
      userEmail: user ? user.email : 'anonymous',
      personUrl: personB64,
      outfitUrl: outfitB64,
      uploadedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[Admin Logger] Failed to log upload to Firestore:', err);
  }
}

/**
 * User Saved Looks — Permanently stores Base64 image in Firestore when user clicks "Save Look"
 */
export async function saveLookToFirestore(resultData) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be logged in to save looks.");
  }

  const [resultB64, personB64, outfitB64] = await Promise.all([
    urlToBase64(resultData.result_url),
    urlToBase64(resultData.person_url),
    urlToBase64(resultData.outfit_url),
  ]);

  const looksRef = collection(db, `users/${user.uid}/saved_looks`);
  const newLook = {
    userId: user.uid,
    userEmail: user.email,
    personUrl: personB64,
    outfitUrl: outfitB64,
    resultUrl: resultB64,
    modelUsed: resultData.model_used || 'VTON',
    processingTimeMs: resultData.processing_time_ms || 0,
    savedAt: serverTimestamp(),
  };

  const docRef = await addDoc(looksRef, newLook);
  return { id: docRef.id, ...newLook };
}

/**
 * Retrieves permanent saved looks for normal user from Firestore
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
 * Deletes a saved look document from user's Firestore collection
 */
export async function deleteSavedLook(lookId) {
  const user = auth.currentUser;
  if (!user) return;

  const docRef = doc(db, `users/${user.uid}/saved_looks`, lookId);
  await deleteDoc(docRef);
}
