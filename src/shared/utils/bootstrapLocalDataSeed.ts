import { MEIKA_LOCAL_DATA_SEED, PRODUCT_DATA_SEED_VERSION } from '../config/localDataSeed';

const PRODUCT_DATA_SEED_VERSION_STORAGE_KEY = 'meika-product-data-seed-version';

const isBrowser = () => typeof window !== 'undefined';

export const bootstrapLocalDataSeed = () => {
  if (!isBrowser()) return;

  Object.entries(MEIKA_LOCAL_DATA_SEED).forEach(([key, value]) => {
    if (window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, value);
    }
  });

  if (window.localStorage.getItem(PRODUCT_DATA_SEED_VERSION_STORAGE_KEY) !== PRODUCT_DATA_SEED_VERSION) {
    window.localStorage.setItem(PRODUCT_DATA_SEED_VERSION_STORAGE_KEY, PRODUCT_DATA_SEED_VERSION);
  }
};
