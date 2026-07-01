import { MEIKA_LOCAL_DATA_SEED } from '../config/localDataSeed';

const isBrowser = () => typeof window !== 'undefined';

export const bootstrapLocalDataSeed = () => {
  if (!isBrowser()) return;

  Object.entries(MEIKA_LOCAL_DATA_SEED).forEach(([key, value]) => {
    if (window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, value);
    }
  });
};
