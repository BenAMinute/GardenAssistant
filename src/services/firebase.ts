import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import { GardenLayout, UserProfile, YardElement } from '../types/garden';

/**
 * ============================================================================
 * FIREBASE CONFIGURATION (Project: gardenassistant-7720c)
 * ============================================================================
 */
export const FIREBASE_CONFIG = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyDWVEua8ovjprg-z9v_QyW_qriO4V4wnjk',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'gardenassistant-7720c.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gardenassistant-7720c',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'gardenassistant-7720c.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '644943569545',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:644943569545:web:84eaf0791088750b399c58',
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-3BMSHN92KK',
};

export const isFirebaseConfigured = Boolean(
  FIREBASE_CONFIG.apiKey &&
    !FIREBASE_CONFIG.apiKey.startsWith('YOUR_') &&
    FIREBASE_CONFIG.projectId &&
    !FIREBASE_CONFIG.projectId.startsWith('YOUR_')
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
export let analytics: Analytics | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    if (typeof window !== 'undefined') {
      isAnalyticsSupported()
        .then((supported) => {
          if (supported && app) {
            analytics = getAnalytics(app);
          }
        })
        .catch(() => {
          // Ignore analytics errors if blocked by browser privacy extensions
        });
    }
  } catch (err) {
    console.warn('Firebase initialization failed, falling back to local mode:', err);
  }
}

const LOCAL_LAYOUTS_KEY = 'garden_assistant_layouts_v1';
const LOCAL_USER_KEY = 'garden_assistant_demo_user_v1';

export const DEFAULT_SPRING_ELEMENTS: YardElement[] = [
  {
    id: 'elem-grass-1',
    type: 'grass_panel',
    name: 'Main Lawn / Grass Area',
    x: 1,
    y: 1,
    width: 14,
    height: 11,
  },
  {
    id: 'elem-gravel-1',
    type: 'gravel_path',
    name: 'Gravel Walkway',
    x: 6,
    y: 1,
    width: 2,
    height: 10,
  },
  {
    id: 'elem-gravel-2',
    type: 'gravel_path',
    name: 'Cross Gravel Path',
    x: 1,
    y: 6,
    width: 14,
    height: 2,
  },
  {
    id: 'elem-shed-1',
    type: 'shed',
    name: 'Garden Tool Shed',
    x: 9,
    y: 8,
    width: 5,
    height: 3,
  },
];

export const DEFAULT_ARCH_BED = {
  id: 'bed-arch-1',
  name: 'Twin Tomato & Cucumber Arch Box',
  bedType: 'arch_box' as const,
  irrigationType: 'drip_lines' as const,
  walkwayWidth: 2,
  width: 4, // Two 2x4 ft boxes + 2ft center arch
  height: 4,
  x: 16,
  y: 2,
  cells: {
    '0,0': 'basil',
    '1,0': 'tomato',
    '0,1': 'marigold',
    '1,1': 'tomato',
    '0,2': 'carrot',
    '1,2': 'tomato',
    '0,3': 'lettuce',
    '1,3': 'pepper',
    '2,0': 'cucumber',
    '3,0': 'dill',
    '2,1': 'cucumber',
    '3,1': 'radish',
    '2,2': 'beans_pole',
    '3,2': 'spinach',
    '2,3': 'peas',
    '3,3': 'nasturtium',
  },
};

export const DEFAULT_YARD_DRIP_CELLS: Record<string, boolean> = {
  '6,1': true,
  '6,2': true,
  '6,3': true,
  '6,4': true,
  '6,5': true,
  '6,6': true,
  '5,3': true, // Branch into Bed #1
  '7,3': true, // Branch into Bed #2
  '7,6': true,
  '8,6': true,
  '9,6': true,
  '10,6': true,
  '11,6': true,
  '12,6': true,
  '13,6': true,
  '14,6': true,
  '15,6': true,
  '15,5': true,
  '15,4': true,
  '15,3': true, // Connects over to the Twin Arch Box!
};

export const DEFAULT_INITIAL_LAYOUTS: GardenLayout[] = [
  {
    id: 'layout-spring-main',
    name: 'Backyard Spring Garden',
    updatedAt: Date.now(),
    elements: DEFAULT_SPRING_ELEMENTS,
    yardDripCells: DEFAULT_YARD_DRIP_CELLS,
    beds: [
      {
        id: 'bed-1',
        name: 'Sunny Raised Bed #1 (Salsa & Salad)',
        irrigationType: 'drip_lines',
        width: 4,
        height: 4,
        x: 2,
        y: 2,
        cells: {
          '0,0': 'tomato',
          '1,0': 'basil',
          '2,0': 'tomato',
          '3,0': 'marigold',
          '0,1': 'carrot',
          '1,1': 'onion',
          '2,1': 'lettuce',
          '3,1': 'pepper',
          '0,2': 'spinach',
          '1,2': 'radish',
          '3,2': 'broccoli', // Intentional conflict next to pepper (3,1) to demonstrate red warning!
        },
      },
      {
        id: 'bed-2',
        name: 'Three Sisters & Vines Bed',
        width: 6,
        height: 3,
        x: 8,
        y: 2,
        cells: {
          '0,0': 'corn',
          '1,0': 'beans_pole',
          '2,0': 'pumpkin',
          '4,0': 'cucumber',
          '5,0': 'dill',
          '4,1': 'peas',
          '5,1': 'radish',
          '0,2': 'nasturtium',
        },
      },
      DEFAULT_ARCH_BED,
      {
        id: 'bed-3',
        name: 'Herb & Berry Corner',
        width: 3,
        height: 3,
        x: 2,
        y: 8,
        cells: {
          '0,0': 'strawberry',
          '1,0': 'borage',
          '2,0': 'spinach',
          '0,2': 'rosemary',
          '1,2': 'thyme',
          '2,2': 'oregano',
        },
      },
    ],
  },
  {
    id: 'layout-fall-brassica',
    name: 'Fall Cool-Weather Plan',
    updatedAt: Date.now() - 86400000,
    elements: [
      {
        id: 'elem-fall-grass',
        type: 'grass_panel',
        name: 'Side Yard Grass',
        x: 2,
        y: 2,
        width: 10,
        height: 8,
      },
    ],
    beds: [
      {
        id: 'bed-fall-1',
        name: 'Brassica & Root Bed',
        width: 4,
        height: 4,
        x: 3,
        y: 3,
        cells: {
          '0,0': 'broccoli',
          '1,0': 'cabbage',
          '2,0': 'kale',
          '3,0': 'dill',
          '0,1': 'onion',
          '1,1': 'garlic',
          '2,1': 'beet',
          '3,1': 'carrot',
          '0,2': 'spinach',
          '1,2': 'lettuce',
          '2,2': 'radish',
          '3,2': 'nasturtium',
        },
      },
    ],
  },
];

export function loadLocalLayouts(): GardenLayout[] {
  try {
    const raw = localStorage.getItem(LOCAL_LAYOUTS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_LAYOUTS_KEY, JSON.stringify(DEFAULT_INITIAL_LAYOUTS));
      return DEFAULT_INITIAL_LAYOUTS;
    }
    const parsed = JSON.parse(raw) as GardenLayout[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_INITIAL_LAYOUTS;
    }
    // Upgrade existing layouts that were created before `elements` or `bed-arch-1` existed
    let upgraded = false;
    const migrated = parsed.map((layout) => {
      let nextLayout = layout;
      if (nextLayout.elements === undefined) {
        upgraded = true;
        nextLayout = {
          ...nextLayout,
          elements:
            nextLayout.id === 'layout-spring-main' ? DEFAULT_SPRING_ELEMENTS : [],
        };
      }
      if (
        nextLayout.id === 'layout-spring-main' &&
        !nextLayout.beds.some((b) => b.bedType === 'arch_box')
      ) {
        upgraded = true;
        nextLayout = {
          ...nextLayout,
          beds: [...nextLayout.beds, DEFAULT_ARCH_BED],
        };
      }
      if (
        nextLayout.id === 'layout-spring-main' &&
        nextLayout.yardDripCells === undefined
      ) {
        upgraded = true;
        nextLayout = {
          ...nextLayout,
          yardDripCells: DEFAULT_YARD_DRIP_CELLS,
        };
      }
      return nextLayout;
    });
    if (upgraded) {
      localStorage.setItem(LOCAL_LAYOUTS_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return DEFAULT_INITIAL_LAYOUTS;
  }
}

export function saveLocalLayouts(layouts: GardenLayout[]): void {
  try {
    localStorage.setItem(LOCAL_LAYOUTS_KEY, JSON.stringify(layouts));
  } catch (err) {
    console.error('Failed to save layouts locally:', err);
  }
}

export async function signInWithGoogle(): Promise<UserProfile> {
  if (isFirebaseConfigured && auth) {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      return {
        uid: u.uid,
        displayName: u.displayName || 'Gardener',
        email: u.email || '',
        photoURL: u.photoURL || undefined,
        isDemo: false,
      };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/configuration-not-found' ||
        code === 'auth/operation-not-allowed'
      ) {
        alert(
          'Google Sign-In is not enabled yet in your Firebase project.\n\n' +
            'Open: https://console.firebase.google.com/project/gardenassistant-7720c/authentication/providers\n' +
            '1. Click "Get started" (if shown)\n' +
            '2. Click "Google" -> Toggle "Enable" ON -> Choose your support email -> Click "Save".'
        );
      } else if (code === 'auth/unauthorized-domain') {
        alert(
          `This domain (${window.location.hostname}) is not in your Firebase Authorized Domains list.\n\n` +
            'Use https://gardenassistant-7720c.web.app or http://localhost:5173, or add this domain in Firebase Console -> Authentication -> Settings -> Authorized domains.'
        );
      }
      throw err;
    }
  }

  // Fallback Demo Google Account when Firebase placeholders have not been replaced yet
  const demoUser: UserProfile = {
    uid: 'demo-google-user',
    displayName: 'Google Gardener (Demo Mode)',
    email: 'gardener@gmail.com',
    isDemo: true,
  };
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(demoUser));
  return demoUser;
}

export async function signOutUser(): Promise<void> {
  if (isFirebaseConfigured && auth) {
    await fbSignOut(auth);
  }
  localStorage.removeItem(LOCAL_USER_KEY);
}

export function subscribeToAuth(callback: (user: UserProfile | null) => void): () => void {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        callback({
          uid: u.uid,
          displayName: u.displayName || 'Gardener',
          email: u.email || '',
          photoURL: u.photoURL || undefined,
          isDemo: false,
        });
      } else {
        callback(null);
      }
    });
  }

  // Check stored demo user
  try {
    const stored = localStorage.getItem(LOCAL_USER_KEY);
    if (stored) {
      callback(JSON.parse(stored));
    } else {
      callback(null);
    }
  } catch {
    callback(null);
  }
  return () => {};
}

export async function fetchUserLayouts(uid: string): Promise<GardenLayout[]> {
  if (isFirebaseConfigured && db && uid !== 'demo-google-user') {
    const snap = await getDocs(collection(db, 'users', uid, 'layouts'));
    const layouts: GardenLayout[] = [];
    snap.forEach((docSnap) => {
      layouts.push(docSnap.data() as GardenLayout);
    });
    if (layouts.length > 0) {
      return layouts.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    // Seed initial layouts to Firestore on first login
    const local = loadLocalLayouts();
    for (const layout of local) {
      await saveUserLayout(uid, layout);
    }
    return local;
  }
  return loadLocalLayouts();
}

export async function saveUserLayout(uid: string | null, layout: GardenLayout): Promise<void> {
  if (isFirebaseConfigured && db && uid && uid !== 'demo-google-user') {
    const cleanLayout = JSON.parse(JSON.stringify(layout)) as GardenLayout;
    await setDoc(doc(db, 'users', uid, 'layouts', layout.id), cleanLayout);
  }
}

export async function deleteUserLayout(uid: string | null, layoutId: string): Promise<void> {
  if (isFirebaseConfigured && db && uid && uid !== 'demo-google-user') {
    await deleteDoc(doc(db, 'users', uid, 'layouts', layoutId));
  }
}
