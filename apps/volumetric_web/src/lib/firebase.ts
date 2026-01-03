import "server-only";
import { createFirestoreClient, type FirestoreClient } from "firebase-rest-firestore";

let firestoreClient: FirestoreClient | null = null;

export function getFirestore(): FirestoreClient {
  if (firestoreClient) {
    return firestoreClient;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase configuration environment variables");
  }

  firestoreClient = createFirestoreClient({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });

  return firestoreClient;
}
