export const SINGLE_CERTIFICATE_LANGUAGES = ['英语', '法语', '西班牙语', '意大利语', '德语'];
export const DOUBLE_CERTIFICATE_LANGUAGES = ['英语', '意大利语'];

export const getLanguageOptionsForProduct = (productTitle = '') => {
  const compactTitle = productTitle.replace(/\s+/g, '');

  if (!compactTitle) {
    return [];
  }

  if (compactTitle.includes('公证双号') || compactTitle.includes('公证海牙双号')) {
    return [...DOUBLE_CERTIFICATE_LANGUAGES];
  }

  return [...SINGLE_CERTIFICATE_LANGUAGES];
};
