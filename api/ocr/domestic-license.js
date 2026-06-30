const MAX_IMAGE_COUNT = 2;

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
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

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(response, 501, { error: '图片文案识别服务未配置' });
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(request) || '{}');
    const images = [normalizeImageInput(body.frontPhoto), normalizeImageInput(body.backPhoto)]
      .filter(Boolean)
      .slice(0, MAX_IMAGE_COUNT);

    if (images.length === 0) {
      sendJson(response, 400, { error: 'At least one license image is required' });
      return;
    }

    const responsePayload = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_OCR_MODEL || 'gpt-4.1-mini',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: [
                  'You are an OCR extraction engine for foreign driver license images.',
                  'Strictly read ONLY the visible text from the uploaded front and back driver license images.',
                  'Do not invent values. Do not use any order metadata or fallback values.',
                  'The originalText must preserve the language and wording visible in the image, including English labels such as DL, DOB, EXP, ISS, CLASS, ENDORSEMENTS, RESTRICTIONS, SEX, HGT, EYES.',
                  'Translate each originalText into Simplified Chinese for a Chinese driver-license translation template.',
                  'Return JSON only. Do not include markdown.',
                  'Use empty strings for fields that are not visible.',
                  'JSON shape: { "fields": { "state": "", "country": "", "licenseNumber": "", "issueDate": "", "expiryDate": "", "birthDate": "", "sex": "", "height": "", "eyeColor": "", "fileNumber": "", "classType": "", "endorsements": "", "restrictions": "", "rstr": "", "signatureName": "", "rawText": "" }, "rows": [{ "label": "", "originalText": "", "translatedText": "" }] }.',
                  'For rows, label should be a short Chinese field label, originalText should be the exact visible image text for that item, and translatedText should be the Chinese translation.',
                ].join('\n'),
              },
              ...images.map((imageUrl) => ({
                type: 'input_image',
                image_url: imageUrl,
                detail: 'high',
              })),
            ],
          },
        ],
      }),
    });

    const result = await responsePayload.json();

    if (!responsePayload.ok) {
      sendJson(response, responsePayload.status, {
        error: result?.error?.message || '图片文案识别请求失败',
      });
      return;
    }

    sendJson(response, 200, {
      provider: 'openai',
      fields: parseJsonFromText(result.output_text),
      rows: parseJsonFromText(result.output_text)?.rows || [],
      rawOutput: result.output_text || '',
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : '图片文案识别请求失败',
    });
  }
}
