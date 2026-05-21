import type { DomesticLicenseInfo, Order } from '../types';

const DB_NAME = 'meika-local-image-store';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const LOCAL_IMAGE_REF_PREFIX = 'meika-local-image://';

type StoredLocalImage = {
  dataUrl: string;
  id: string;
  updatedAt: number;
};

const memoryCache = new Map<string, string>();
let dbPromise: Promise<IDBDatabase> | null = null;

const isBrowser = () => typeof window !== 'undefined';

const canUseIndexedDb = () => isBrowser() && 'indexedDB' in window;

const openDatabase = () => {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('IndexedDB is unavailable'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open image store'));
    request.onblocked = () => reject(new Error('Image store is blocked'));
  });

  return dbPromise;
};

const createLocalImageRef = (id: string) => `${LOCAL_IMAGE_REF_PREFIX}${encodeURIComponent(id)}`;

const getLocalImageId = (source: string) => decodeURIComponent(source.slice(LOCAL_IMAGE_REF_PREFIX.length));

export const isLocalImageRef = (source?: string | null) =>
  Boolean(source?.startsWith(LOCAL_IMAGE_REF_PREFIX));

export const resolveLocalImageSource = async (source?: string | null) => {
  if (!source) {
    return '';
  }

  if (!isLocalImageRef(source)) {
    return source;
  }

  const id = getLocalImageId(source);
  const cachedSource = memoryCache.get(id);
  if (cachedSource) {
    return cachedSource;
  }

  try {
    const database = await openDatabase();

    return await new Promise<string>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as StoredLocalImage | undefined;
        const dataUrl = result?.dataUrl || '';
        if (dataUrl) {
          memoryCache.set(id, dataUrl);
        }
        resolve(dataUrl);
      };
      request.onerror = () => reject(request.error || new Error('Failed to read image'));
    });
  } catch {
    return '';
  }
};

export const saveLocalImageSource = async (id: string, source?: string | null) => {
  if (!source || isLocalImageRef(source) || !source.startsWith('data:image/')) {
    return source || '';
  }

  if (!canUseIndexedDb()) {
    return source;
  }

  try {
    const database = await openDatabase();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        dataUrl: source,
        id,
        updatedAt: Date.now(),
      } satisfies StoredLocalImage);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Failed to save image'));
    });

    memoryCache.set(id, source);
    return createLocalImageRef(id);
  } catch {
    return source;
  }
};

export const saveDomesticLicenseImages = async (info: DomesticLicenseInfo, storageKey: string) => {
  const [frontPhoto, backPhoto, passportPhoto] = await Promise.all([
    saveLocalImageSource(`${storageKey}-front`, info.frontPhoto),
    saveLocalImageSource(`${storageKey}-back`, info.backPhoto),
    info.passportPhoto ? saveLocalImageSource(`${storageKey}-passport`, info.passportPhoto) : Promise.resolve(undefined),
  ]);

  return {
    ...info,
    frontPhoto,
    backPhoto,
    passportPhoto: passportPhoto || undefined,
  };
};

export const saveNotaryCertificateImages = async (images: Record<string, string>, storageKey: string) => {
  const entries = await Promise.all(
    Object.entries(images).map(async ([key, source]) => [
      key,
      await saveLocalImageSource(`${storageKey}-${key}`, source),
    ] as const),
  );

  return Object.fromEntries(entries.filter(([, source]) => source.trim())) as Record<string, string>;
};

export const migrateDomesticLicenseOrderImages = async (orders: Order[]) => {
  let didChange = false;

  const migratedOrders = await Promise.all(
    orders.map(async (order) => {
      const domesticInfo = order.domesticLicenseInfo;
      if (!domesticInfo) {
        return order;
      }

      const nextDomesticInfo = await saveDomesticLicenseImages(domesticInfo, `domestic-license-${order.orderId}`);
      const changed =
        nextDomesticInfo.frontPhoto !== domesticInfo.frontPhoto ||
        nextDomesticInfo.backPhoto !== domesticInfo.backPhoto ||
        nextDomesticInfo.passportPhoto !== domesticInfo.passportPhoto;

      if (!changed) {
        return order;
      }

      didChange = true;
      return {
        ...order,
        domesticLicenseInfo: nextDomesticInfo,
      };
    }),
  );

  return {
    didChange,
    orders: migratedOrders,
  };
};
