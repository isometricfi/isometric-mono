import { type App, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;

function getFirebaseApp(): App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase configuration environment variables");
  }

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });

  return firebaseApp;
}

export function getDb(): Firestore {
  if (firestoreDb) {
    return firestoreDb;
  }
  firestoreDb = getFirestore(getFirebaseApp());
  return firestoreDb;
}
