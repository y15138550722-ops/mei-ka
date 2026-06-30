import { buildDocxPreviewHtml as buildRichDocxPreviewHtml } from './docxPreview';

type WordPreviewOptions = {
  title?: string;
  documentPath?: string;
  resolveAssetPath?: (documentPath: string, assetPath: string) => Promise<string> | string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const previewShellStyle = `
  <style>
    html, body {
      margin: 0;
      padding: 24px;
      min-height: 100%;
      box-sizing: border-box;
      background: #eef2f7;
    }

    body {
      overflow: auto;
    }

    div.Section0 {
      width: 820px;
      max-width: 100%;
      margin: 0 auto;
      padding: 44px 52px;
      background: #ffffff;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
    }

    img {
      max-width: 100%;
      height: auto;
    }

    table {
      max-width: 100%;
    }

    @media (max-width: 768px) {
      html, body {
        padding: 12px;
      }

      div.Section0 {
        padding: 24px 18px;
        box-shadow: none;
      }
    }
  </style>
`;

export const isZipWordDocument = (buffer: ArrayBuffer) => {
  const header = new Uint8Array(buffer.slice(0, 4));
  return header[0] === 0x50 && header[1] === 0x4b;
};

export const decodeLegacyWordDocument = (buffer: ArrayBuffer) => {
  const encodings = ['gb18030', 'gbk', 'utf-8'];

  for (const encoding of encodings) {
    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch {
      continue;
    }
  }

  return new TextDecoder().decode(buffer);
};

export const buildLegacyWordPreviewHtml = async (
  rawHtml: string,
  options?: Pick<WordPreviewOptions, 'documentPath' | 'resolveAssetPath'>,
) => {
  const normalizedHtml = rawHtml
    .replace(/<link[^>]+File-List[^>]*>/gi, '')
    .replace(/charset=gb2312/gi, 'charset=utf-8');

  const assetPattern = /(["'])([^"']+?\.files\/[^"']+\.(?:png|jpg|jpeg|gif|webp|bmp|svg))\1/gi;
  const assetPaths = Array.from(normalizedHtml.matchAll(assetPattern), (match) => match[2]);
  const uniqueAssetPaths = Array.from(new Set(assetPaths));
  const resolvedAssetMap = new Map<string, string>();

  if (options?.documentPath && options.resolveAssetPath) {
    const documentPath = options.documentPath;
    const resolveAssetPath = options.resolveAssetPath;
    const resolvedEntries = await Promise.all(
      uniqueAssetPaths.map(async (assetPath) => [assetPath, await resolveAssetPath(documentPath, assetPath)] as const),
    );

    resolvedEntries.forEach(([assetPath, resolvedPath]) => {
      if (resolvedPath) {
        resolvedAssetMap.set(assetPath, resolvedPath);
      }
    });
  }

  const htmlWithResolvedAssets = normalizedHtml.replace(assetPattern, (_match, quote: string, assetPath: string) => {
    const resolvedPath = resolvedAssetMap.get(assetPath) || assetPath;
    return `${quote}${escapeHtml(resolvedPath)}${quote}`;
  });

  if (htmlWithResolvedAssets.includes('</head>')) {
    return htmlWithResolvedAssets.replace('</head>', `${previewShellStyle}</head>`);
  }

  return `<head>${previewShellStyle}</head>${htmlWithResolvedAssets}`;
};

export const buildWordPreviewHtml = async (buffer: ArrayBuffer, options?: WordPreviewOptions) => {
  if (isZipWordDocument(buffer)) {
    return buildRichDocxPreviewHtml(buffer, { title: options?.title });
  }

  return buildLegacyWordPreviewHtml(decodeLegacyWordDocument(buffer), options);
};
