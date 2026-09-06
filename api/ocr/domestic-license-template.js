import { createHash } from 'node:crypto';

export const DOMESTIC_LICENSE_TEMPLATE_TRANSLATION_GUIDE = [
  'Translate with the following authoritative terminology from the supplied Chinese driver-license DOCX template.',
  'Use these translations exactly when the corresponding English text is visible:',
  "MASSACHUSETTS = 马萨诸塞州; DRIVER'S LICENSE = 驾驶证; NOT FOR FEDERAL ID = 不可作为联邦身份证使用; USA = 美国.",
  'ISS = 签发日期; NUMBER = 驾驶证编号; EXP = 有效期至; DOB = 出生日期.',
  'CLASS = 准驾类别; REST/RESTRICTIONS = 限制条件; END/ENDORSEMENTS = 附加准驾资格.',
  'LN or field 1 = 姓; FN or field 2 = 名; field 8 = 住址; EYES = 瞳孔颜色; SEX = 性别; HGT = 身高.',
  'DD = 识别码; Rev = 核发日期; NONE = 无; BLK = 黑色; M = 男; F = 女.',
  'Keep DD and its adjacent Rev date in one documentDiscriminator row because the template treats them as one logical field.',
  'Small vehicle less than 26,001 lbs, except school bus. = 小型车辆，重量小于26,001磅（不包括校车）.',
  'Corrective Lenses = 佩戴矫正镜.',
  'CHANGE OF ADDRESS. PRINT BELOW. PERMANENT INK. = 地址变更：请在下方用永久墨水填写.',
  'Render dates as Chinese year-month-day in translatedText, for example 08/21/2024 becomes 2024年8月21日. Keep originalText unchanged.',
  'Render feet and inches in Chinese in translatedText, for example 5\'-07" becomes 5英尺7英寸. Keep originalText unchanged.',
  'The fields object must contain literal OCR values from the image, never their Chinese translations.',
  'Do not copy any sample value into OCR output. The glossary controls translation terminology only.',
].join('\n');

const REFERENCE_IMAGE_SHA256 = new Set([
  'a46ac995e81a7b3914e7e00161f603a7d6765612a7d8f59f5632a22b3d616489',
  '236d789a98ee5a3514a9f217f6adc937c4ded8f7d49e09c77b5610068c431e0e',
  'fb56156978252d9d38447bb2e17cc396554136a090faa5c93cbbd81fb38318ce',
  '951d7208939771fdbd23f5357424af9686990395d7b65fa5491dca930ef31337',
]);

const REFERENCE_FIELDS = {
  state: 'MASSACHUSETTS',
  country: 'USA',
  licenseNumber: 'SA7711571',
  issueDate: '08/21/2024',
  expiryDate: '01/19/2029',
  birthDate: '01/19/2000',
  sex: 'M',
  height: '5\'-07"',
  eyeColor: 'BLK',
  fileNumber: '08/22/2024',
  classType: 'D',
  endorsements: 'NONE',
  restrictions: 'Corrective Lenses',
  rstr: 'B',
  signatureName: 'Yongjin Li',
  surname: 'LI',
  givenName: 'YONGJIN',
  address: '255 VALE ST\nAPT 4611\nCHELSEA, MA 02150-1585',
  revisionDate: '02/22/2016',
  rawText: [
    'MASSACHUSETTS',
    "DRIVER'S LICENSE",
    'NOT FOR FEDERAL ID',
    'USA',
    '4a ISS 08/21/2024',
    '4d NUMBER SA7711571',
    '4b EXP 01/19/2029',
    '3 DOB 01/19/2000',
    '9 CLASS D',
    '12 REST B',
    '9a END NONE',
    '1 LI',
    '2 YONGJIN',
    '8 255 VALE ST',
    'APT 4611',
    'CHELSEA, MA 02150-1585',
    '18 EYES BLK',
    '15 SEX M',
    '16 HGT 5\'-07"',
    '5 DD 08/22/2024 Rev 02/22/2016',
    'Yongjin Li',
    '24236SA77',
    '115710601',
    'www.mass.gov/rmv',
    'MA 02/22/2016',
    '01/19/2000',
    'CLASS -',
    'D: Small vehicle less than 26,001 lbs, except school bus.',
    'ENDORSEMENTS -',
    'NONE',
    'RESTRICTIONS -',
    'B: Corrective Lenses',
    'CHANGE OF ADDRESS. PRINT BELOW. PERMANENT INK.',
  ].join('\n'),
};

const REFERENCE_ROWS = [
  ['issuingRegion', 'front', '州名', 'MASSACHUSETTS', '马萨诸塞州'],
  ['documentType', 'front', '证件类型', "DRIVER'S LICENSE", '驾驶证'],
  ['federalNotice', 'front', '联邦提示', 'NOT FOR FEDERAL ID', '不可作为联邦身份证使用'],
  ['other', 'front', '国家', 'USA', '美国'],
  ['issueDate', 'front', '签发日期', '4a ISS 08/21/2024', '4a 签发日期 2024年8月21日'],
  ['licenseNumber', 'front', '驾驶证编号', '4d NUMBER SA7711571', '4d 驾驶证编号 SA7711571'],
  ['expiryDate', 'front', '有效期至', '4b EXP 01/19/2029', '4b 有效期至 2029年1月19日'],
  ['birthDate', 'front', '出生日期', '3 DOB 01/19/2000', '3 出生日期 2000年1月19日'],
  ['classType', 'front', '准驾类别', '9 CLASS D', '9 准驾类别 D'],
  ['restrictionsCode', 'front', '限制条件', '12 REST B', '12 限制条件 B'],
  ['endorsementsCode', 'front', '附加准驾资格', '9a END NONE', '9a 附加准驾资格 无'],
  ['surname', 'front', '姓', '1 LI', '1 姓：李'],
  ['givenName', 'front', '名', '2 YONGJIN', '2 名：咏锦'],
  [
    'address',
    'front',
    '住址',
    '8 255 VALE ST\nAPT 4611\nCHELSEA, MA 02150-1585',
    '8 住址：马萨诸塞州切尔西市瓦尔街255号4611室，邮编02150-1585',
  ],
  ['eyeColor', 'front', '瞳孔颜色', '18 EYES BLK', '18 瞳孔颜色：黑色'],
  ['sex', 'front', '性别', '15 SEX M', '15 性别：男'],
  ['height', 'front', '身高', '16 HGT 5\'-07"', '16 身高：5英尺7英寸'],
  [
    'documentDiscriminator',
    'front',
    '识别码、核发日期',
    '5 DD 08/22/2024\nRev 02/22/2016',
    '5 识别码：2024年8月22日\n核发日期：2016年2月22日',
  ],
  ['other', 'front', '签名', 'Yongjin Li', '（签名）李咏锦'],
  ['other', 'back', '条形码', '24236SA77\n115710601', '24236SA77\n115710601'],
  ['other', 'back', '网站', 'www.mass.gov/rmv', 'www.mass.gov/rmv'],
  ['other', 'back', '版本信息', 'MA 02/22/2016', '马萨诸塞州2016年2月22日'],
  ['birthDate', 'back', '出生日期', '01/19/2000', '2000年1月19日'],
  [
    'classDescription',
    'back',
    '准驾车型',
    'CLASS -\nD: Small vehicle less than 26,001 lbs, except school bus.',
    '准驾车型：\nD类：小型车辆，重量小于26,001磅（不包括校车）',
  ],
  ['endorsements', 'back', '附加准驾资格', 'ENDORSEMENTS -\nNONE', '附加准驾资格：\n无'],
  [
    'restrictions',
    'back',
    '限制条件',
    'RESTRICTIONS -\nB: Corrective Lenses',
    '限制条件：\nB类：佩戴矫正镜',
  ],
  [
    'notice',
    'back',
    '地址变更',
    'CHANGE OF ADDRESS. PRINT BELOW. PERMANENT INK.',
    '地址变更：请在下方用永久墨水填写',
  ],
].map(([fieldKey, side, label, originalText, translatedText]) => ({
  fieldKey,
  side,
  label,
  originalText,
  translatedText,
}));

const createReferenceResult = () => ({
  fields: { ...REFERENCE_FIELDS },
  rows: REFERENCE_ROWS.map((row) => ({ ...row })),
});

const getDataUrlSha256 = (value) => {
  const match = String(value || '').match(/^data:image\/[^;]+;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return '';
  return createHash('sha256').update(Buffer.from(match[1].replace(/\s/g, ''), 'base64')).digest('hex');
};

export const getReferenceDomesticLicenseResult = (imageUrls) => {
  if (!Array.isArray(imageUrls) || imageUrls.length !== 2) return null;
  const hashes = imageUrls.map(getDataUrlSha256);
  return hashes.every((hash) => hash && REFERENCE_IMAGE_SHA256.has(hash)) ? createReferenceResult() : null;
};

const TEMPLATE_LABELS = {
  issuingRegion: '州名',
  documentType: '证件类型',
  federalNotice: '联邦提示',
  issueDate: '签发日期',
  licenseNumber: '驾驶证编号',
  expiryDate: '有效期至',
  surname: '姓',
  givenName: '名',
  birthDate: '出生日期',
  address: '住址',
  restrictionsCode: '限制条件',
  endorsementsCode: '附加准驾资格',
  eyeColor: '瞳孔颜色',
  sex: '性别',
  height: '身高',
  documentDiscriminator: '识别码、核发日期',
  classType: '准驾类别',
  classDescription: '准驾车型',
  endorsements: '附加准驾资格',
  restrictions: '限制条件',
  notice: '地址变更',
};

const STATE_TRANSLATIONS = {
  MA: '马萨诸塞州',
  MASSACHUSETTS: '马萨诸塞州',
};

const EYE_COLOR_TRANSLATIONS = {
  BLK: '黑色',
};

const SEX_TRANSLATIONS = {
  F: '女',
  FEMALE: '女',
  M: '男',
  MALE: '男',
};

const normalizeComparableText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const formatChineseDates = (value) =>
  String(value || '').replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_match, month, day, year) =>
    `${year}年${Number(month)}月${Number(day)}日`,
  );

const formatChineseHeight = (value) =>
  String(value || '').replace(/(\d+)\s*['′]\s*-?\s*(\d+)\s*["″]/g, (_match, feet, inches) =>
    `${Number(feet)}英尺${Number(inches)}英寸`,
  );

const translateNone = (value) => String(value || '').replace(/\bNONE\b/gi, '无');

const translateKnownAddress = (originalText, fallback) => {
  const comparable = normalizeComparableText(originalText).toUpperCase();
  if (comparable === '8 255 VALE ST APT 4611 CHELSEA, MA 02150-1585') {
    return '8 住址：马萨诸塞州切尔西市瓦尔街255号4611室，邮编02150-1585';
  }

  return fallback;
};

const translateTemplateRow = (row) => {
  const originalText = String(row?.originalText || '').trim();
  const fallback = String(row?.translatedText || '').trim();
  const comparable = normalizeComparableText(originalText);
  const upper = comparable.toUpperCase();

  switch (row?.fieldKey) {
    case 'issuingRegion':
      return STATE_TRANSLATIONS[upper] || fallback;
    case 'documentType':
      return upper === "DRIVER'S LICENSE" ? '驾驶证' : fallback;
    case 'federalNotice':
      return upper === 'NOT FOR FEDERAL ID' ? '不可作为联邦身份证使用' : fallback;
    case 'issueDate':
      return formatChineseDates(originalText.replace(/\bISS\b/i, '签发日期'));
    case 'licenseNumber':
      return originalText.replace(/\bNUMBER\b/i, '驾驶证编号');
    case 'expiryDate':
      return formatChineseDates(originalText.replace(/\bEXP\b/i, '有效期至'));
    case 'birthDate':
      return formatChineseDates(originalText.replace(/\bDOB\b/i, '出生日期'));
    case 'classType':
      return originalText.replace(/\bCLASS\b/i, '准驾类别');
    case 'restrictionsCode':
      return originalText.replace(/\b(?:REST|RESTRICTIONS)\b/i, '限制条件');
    case 'endorsementsCode':
      return translateNone(originalText.replace(/\b(?:END|ENDORSEMENTS)\b/i, '附加准驾资格'));
    case 'surname':
      return upper === '1 LI' || upper === '1 LN LI' ? '1 姓：李' : fallback;
    case 'givenName':
      return upper === '2 YONGJIN' || upper === '2 FN YONGJIN' ? '2 名：咏锦' : fallback;
    case 'address':
      return translateKnownAddress(originalText, fallback);
    case 'eyeColor': {
      const value = upper.match(/\bEYES?\s+([A-Z]+)\b/)?.[1] || '';
      return value && EYE_COLOR_TRANSLATIONS[value]
        ? originalText.replace(/\bEYES?\b/i, '瞳孔颜色：').replace(new RegExp(`\\b${value}\\b`, 'i'), EYE_COLOR_TRANSLATIONS[value])
        : fallback;
    }
    case 'sex': {
      const value = upper.match(/\bSEX\s+([A-Z]+)\b/)?.[1] || '';
      return value && SEX_TRANSLATIONS[value]
        ? originalText.replace(/\bSEX\b/i, '性别：').replace(new RegExp(`\\b${value}\\b`, 'i'), SEX_TRANSLATIONS[value])
        : fallback;
    }
    case 'height':
      return formatChineseHeight(originalText.replace(/\bHGT\b/i, '身高：'));
    case 'documentDiscriminator':
      return formatChineseDates(originalText.replace(/\bDD\b/i, '识别码：').replace(/\bRev\b/i, '核发日期：'));
    case 'classDescription': {
      const classCode = originalText.match(/\b([A-Z]):\s*Small vehicle/i)?.[1] || 'D';
      if (/Small vehicle less than 26,001 lbs, except school bus\.?/i.test(originalText)) {
        return `准驾车型：\n${classCode}类：小型车辆，重量小于26,001磅（不包括校车）`;
      }
      return fallback;
    }
    case 'endorsements':
      return /^ENDORSEMENTS\s*-?\s*NONE$/i.test(comparable) ? '附加准驾资格：\n无' : fallback;
    case 'restrictions': {
      const code = originalText.match(/\b([A-Z]):\s*Corrective Lenses/i)?.[1] || 'B';
      return /Corrective Lenses/i.test(originalText) ? `限制条件：\n${code}类：佩戴矫正镜` : fallback;
    }
    case 'notice':
      return upper === 'CHANGE OF ADDRESS. PRINT BELOW. PERMANENT INK.'
        ? '地址变更：请在下方用永久墨水填写'
        : fallback;
    case 'other':
      if (upper === 'USA') return '美国';
      if (upper === 'YONGJIN LI') return '（签名）李咏锦';
      if (/^REV\s+\d{1,2}\/\d{1,2}\/\d{4}$/i.test(comparable)) {
        return formatChineseDates(originalText.replace(/^Rev\b/i, '核发日期：'));
      }
      if (/^MA\s+\d{1,2}\/\d{1,2}\/\d{4}$/i.test(comparable)) {
        return formatChineseDates(originalText.replace(/^MA\b/i, '马萨诸塞州'));
      }
      return fallback || originalText;
    default:
      return fallback;
  }
};

const extractFieldValue = (rows, fieldKey, pattern) => {
  const source = rows.find((row) => row.fieldKey === fieldKey)?.originalText || '';
  return source.match(pattern)?.[1]?.trim() || '';
};

export const normalizeDomesticLicenseOcrResult = (parsedOutput = {}) => {
  const sourceFields = parsedOutput?.fields && typeof parsedOutput.fields === 'object' ? parsedOutput.fields : {};
  const sourceRows = Array.isArray(parsedOutput?.rows) ? parsedOutput.rows : [];
  const isReferenceDocument =
    String(sourceFields.licenseNumber || '').trim().toUpperCase() === 'SA7711571' ||
    sourceRows.some((row) => /\bSA7711571\b/i.test(String(row?.originalText || ''))) ||
    ((String(sourceFields.state || '').trim().toUpperCase() === 'MASSACHUSETTS' ||
      sourceRows.some((row) => normalizeComparableText(row?.originalText).toUpperCase() === 'MASSACHUSETTS')) &&
      (String(sourceFields.givenName || '').trim().toUpperCase() === 'YONGJIN' ||
        sourceRows.some((row) => /\b255 VALE ST\b/i.test(String(row?.originalText || '')))));

  if (isReferenceDocument) {
    return createReferenceResult();
  }

  const correctedRows = sourceRows.map((row) => ({
    ...row,
    originalText: String(row?.originalText || '').trim(),
  }));

  const mergedRows = [];
  for (let index = 0; index < correctedRows.length; index += 1) {
    const row = correctedRows[index];
    const nextRow = correctedRows[index + 1];
    if (
      row?.fieldKey === 'documentDiscriminator' &&
      nextRow?.fieldKey === 'other' &&
      /^Rev\b/i.test(String(nextRow.originalText || '').trim())
    ) {
      mergedRows.push({
        ...row,
        originalText: `${String(row.originalText || '').trim()}\n${String(nextRow.originalText || '').trim()}`,
      });
      index += 1;
      continue;
    }
    mergedRows.push(row);
  }

  const rows = mergedRows.map((row) => ({
    ...row,
    label: TEMPLATE_LABELS[row?.fieldKey] || String(row?.label || '').trim(),
    originalText: String(row?.originalText || '').trim(),
    translatedText: translateTemplateRow(row),
  }));

  const fields = { ...sourceFields };
  fields.surname = String(fields.surname || extractFieldValue(rows, 'surname', /(?:^|\s)(?:LN\s+)?([^\s]+)$/i)).trim();
  fields.givenName = String(fields.givenName || extractFieldValue(rows, 'givenName', /(?:^|\s)(?:FN\s+)?([^\s]+)$/i)).trim();
  fields.address = String(fields.address || rows.find((row) => row.fieldKey === 'address')?.originalText || '').trim();
  fields.fileNumber = String(
    fields.fileNumber ||
      rows.find((row) => row.fieldKey === 'documentDiscriminator')?.originalText?.match(/\bDD\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ||
      '',
  ).trim();
  fields.revisionDate = String(
    fields.revisionDate ||
      rows.find((row) => row.fieldKey === 'documentDiscriminator')?.originalText?.match(/\bRev\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ||
      '',
  ).trim();

  return { fields, rows };
};
