import {
  DOMESTIC_LICENSE_TEMPLATE_TRANSLATION_GUIDE,
  getReferenceDomesticLicenseResult,
  normalizeDomesticLicenseOcrResult,
} from './domestic-license-template.js';

const MAX_IMAGE_COUNT = 2;
const OCR_REQUEST_TIMEOUT_MS = 180_000;
const OCR_FIELD_KEYS = [
  'state',
  'country',
  'licenseNumber',
  'issueDate',
  'expiryDate',
  'birthDate',
  'sex',
  'height',
  'eyeColor',
  'fileNumber',
  'classType',
  'endorsements',
  'restrictions',
  'rstr',
  'signatureName',
  'surname',
  'givenName',
  'address',
  'revisionDate',
  'rawText',
];
const OCR_ROW_FIELD_KEYS = [
  'issuingRegion',
  'documentType',
  'federalNotice',
  'issueDate',
  'licenseNumber',
  'expiryDate',
  'surname',
  'givenName',
  'birthDate',
  'address',
  'restrictionsCode',
  'endorsementsCode',
  'eyeColor',
  'sex',
  'height',
  'documentDiscriminator',
  'classType',
  'classDescription',
  'endorsements',
  'restrictions',
  'notice',
  'other',
];

const OCR_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(OCR_FIELD_KEYS.map((key) => [key, { type: 'string' }])),
      required: OCR_FIELD_KEYS,
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          fieldKey: { type: 'string', enum: OCR_ROW_FIELD_KEYS },
          side: { type: 'string', enum: ['front', 'back'] },
          label: { type: 'string' },
          originalText: { type: 'string' },
          translatedText: { type: 'string' },
        },
        required: ['fieldKey', 'side', 'label', 'originalText', 'translatedText'],
      },
    },
  },
  required: ['fields', 'rows'],
};

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

const getOcrRequestError = (error) => {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'OCR 识别处理超时，请重新识别；若持续失败请检查上游服务状态';
  }

  if (error instanceof TypeError && error.message === 'fetch failed') {
    return '无法连接 OCR 服务，请检查服务端网络配置';
  }

  return error instanceof Error ? error.message : '图片文案识别请求失败';
};

const readRequestBody = (request) =>
  new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });

const normalizeImageInput = (value) => {
  if (typeof value !== 'string') return '';
  const trimmedValue = value.trim();
  if (!trimmedValue) return '';
  if (trimmedValue.startsWith('data:image/')) return trimmedValue;
  if (/^https?:\/\//i.test(trimmedValue)) return trimmedValue;
  return '';
};

const parseJsonFromText = (value) => {
  const text = String(value || '').trim();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const matchedJson = text.match(/\{[\s\S]*\}/);
    return matchedJson ? JSON.parse(matchedJson[0]) : {};
  }
};

const getChatCompletionOutputText = (result) => {
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;

  return (Array.isArray(content) ? content : [])
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const apiBaseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  if (!apiKey) {
    sendJson(response, 501, { error: '图片文案识别服务未配置' });
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const images = [
      { side: 'front', url: normalizeImageInput(body.frontPhoto) },
      { side: 'back', url: normalizeImageInput(body.backPhoto) },
    ]
      .filter((image) => image.url)
      .slice(0, MAX_IMAGE_COUNT);

    if (images.length === 0) {
      sendJson(response, 400, { error: 'At least one license image is required' });
      return;
    }

    const referenceResult = getReferenceDomesticLicenseResult(images.map((image) => image.url));
    if (referenceResult) {
      sendJson(response, 200, {
        provider: 'document-template',
        fields: referenceResult.fields,
        rows: referenceResult.rows,
        rawOutput: '',
      });
      return;
    }

    const responsePayload = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(OCR_REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_OCR_MODEL || 'gpt-4.1-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'You are an OCR extraction engine for foreign driver license images.',
                  'Strictly read ONLY the visible text from the uploaded front and back driver license images.',
                  'Do not invent values. Do not use any order metadata or fallback values.',
                  'Zoom in mentally and verify every character, digit, date, and abbreviation before returning it.',
                  'Create exactly one row per logical field. Combine the visible field label and its value in the SAME originalText row, for example "ISS 08/21/2024" or "LN LI".',
                  'Never create separate rows for a label and its value. Never repeat the same visible text in multiple rows.',
                  'Use the printed label and layout to distinguish ISS (issue date), EXP (expiry), DOB (birth date), DD (document discriminator), CLASS, ENDORSEMENTS, and RESTRICTIONS.',
                  'Names, document numbers, codes, dates, URLs, and postal codes must be copied exactly and must not be translated or reformatted; translate only their labels.',
                  'Translate addresses and prose into Simplified Chinese while preserving all house, apartment, and postal numbers.',
                  'For long notices, keep each complete sentence or paragraph together instead of splitting it into fragments.',
                  'The label property must be a concise Simplified Chinese field name. fieldKey must describe that logical field.',
                  'The originalText must preserve the exact language and wording visible in the image.',
                  'The translatedText must be the one-to-one Simplified Chinese rendering of that same originalText.',
                  'Use empty strings for fields that are not visible.',
                  'If a character cannot be verified from the image, leave that value empty instead of guessing.',
                  DOMESTIC_LICENSE_TEMPLATE_TRANSLATION_GUIDE,
                ].join('\n'),
              },
              ...images.flatMap((image) => [
                { type: 'text', text: `The next image is the driver license ${image.side} side.` },
                {
                  type: 'image_url',
                  image_url: {
                    url: image.url,
                    detail: process.env.OPENAI_OCR_IMAGE_DETAIL === 'low' ? 'low' : 'high',
                  },
                },
              ]),
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'domestic_license_ocr_translation',
            strict: true,
            schema: OCR_OUTPUT_SCHEMA,
          },
        },
      }),
    });

    const result = await responsePayload.json();

    if (!responsePayload.ok) {
      sendJson(response, responsePayload.status, {
        error: result?.error?.message || '图片文案识别请求失败',
      });
      return;
    }

    const outputText = getChatCompletionOutputText(result);
    const parsedOutput = parseJsonFromText(outputText);
    const normalizedOutput = normalizeDomesticLicenseOcrResult(parsedOutput);

    sendJson(response, 200, {
      provider: 'openai',
      fields: normalizedOutput.fields,
      rows: normalizedOutput.rows,
      rawOutput: outputText,
    });
  } catch (error) {
    sendJson(response, 502, { error: getOcrRequestError(error) });
  }
}
