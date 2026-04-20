import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  setDoc,
  doc, 
  query, 
  orderBy, 
  onSnapshot,
  FirestoreError,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Use the database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Simple connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or connection.");
    }
  }
}
testConnection();

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string | null;
    email: string | null;
    emailVerified: boolean | null;
    isAnonymous: boolean | null;
  }
}

export function handleFirestoreError(error: any, operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write', path: string | null = null): never {
  const firestoreError = error as FirestoreError;
  const errorInfo: FirestoreErrorInfo = {
    error: firestoreError.message,
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    }
  };
  throw new Error(JSON.stringify(errorInfo));
}
