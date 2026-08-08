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
  if (url.startsWith('/uploads/') || url.startsWith('/results/')) {
    return `${window.location.origin}${url}`;
  }
  if (!url.startsWith('/')) {
    return `${window.location.origin}/uploads/${url}`;
  }
  return `${window.location.origin}${url}`;
}

/**
 * Resizes and compresses an image (from URL or Base64 Data String) via HTML Canvas
 * to ensure Base64 size remains under ~100-200 KB, guaranteeing Firestore document 
 * payload stays well under the 1MB (1,048,576 byte) cap.
 */
async function compressImageToBase64(url, maxDimension = 800, quality = 0.75) {
  if (!url) return null;
  const fullUrl = toFullUrl(url);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width || 800;
        let height = img.naturalHeight || img.height || 800;

        // Downscale maintaining aspect ratio if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Fill white background to handle transparent PNGs converting to JPEG cleanly
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let compressedBase64 = canvas.toDataURL('image/jpeg', quality);

        // Safety fallback: If still larger than 250KB (~330,000 chars), scale down further to 600px & 0.65 quality
        if (compressedBase64.length > 330000) {
          const pass2Canvas = document.createElement('canvas');
          const p2Max = 600;
          let p2W = width;
          let p2H = height;
          if (p2W > p2H) {
            p2H = Math.round((p2H * p2Max) / p2W);
            p2W = p2Max;
          } else {
            p2W = Math.round((p2W * p2Max) / p2H);
            p2H = p2Max;
          }
          pass2Canvas.width = p2W;
          pass2Canvas.height = p2H;
          const p2Ctx = pass2Canvas.getContext('2d');
          p2Ctx.fillStyle = '#FFFFFF';
          p2Ctx.fillRect(0, 0, p2W, p2H);
          p2Ctx.drawImage(img, 0, 0, p2W, p2H);
          compressedBase64 = pass2Canvas.toDataURL('image/jpeg', 0.65);
        }

        resolve(compressedBase64);
      } catch (err) {
        console.warn('[Image Compressor] Canvas export failed, using full URL:', err);
        resolve(fullUrl);
      }
    };

    img.onerror = (err) => {
      console.warn('[Image Compressor] Failed to load image element, using full URL:', err);
      resolve(fullUrl);
    };

    img.src = fullUrl;
  });
}

const _lastUploadsCache = new Set();

/**
 * Admin Audit Logger — Permanently logs uploaded person photo & outfit as Base64 in Firestore
 */
export async function logUploadForAdmin(personUrl, outfitUrl = null) {
  const user = auth.currentUser;
  const uploadKey = `${user ? user.uid : 'anon'}_${personUrl}_${outfitUrl}`;
  if (_lastUploadsCache.has(uploadKey)) {
    return; // Skip duplicate log entry
  }
  _lastUploadsCache.add(uploadKey);

  try {
    const [personB64, outfitB64] = await Promise.all([
      compressImageToBase64(personUrl),
      compressImageToBase64(outfitUrl),
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
    compressImageToBase64(resultData.result_url),
    compressImageToBase64(resultData.person_url),
    compressImageToBase64(resultData.outfit_url),
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
