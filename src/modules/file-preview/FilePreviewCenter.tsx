import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildSpreadsheetPreviewHtml } from '../../shared/utils/spreadsheetPreview';
import { buildWordPreviewHtml } from '../../shared/utils/wordPreview';
import './FilePreviewCenter.css';

type PreviewKind = 'image' | 'pdf' | 'word' | 'spreadsheet' | 'unsupported';
type PreviewStatus = 'loading' | 'ready' | 'error';
type PreviewSource = 'local' | 'docs';

type PreviewItem = {
  id: string;
  name: string;
  kind: PreviewKind;
  source: PreviewSource;
  size?: number;
  path: string;
  status: PreviewStatus;
  html?: string;
  error?: string;
  file?: File;
};

type ProjectWordDocument = {
  name: string;
  relativePath: string;
  size: number;
  url: string;
};

type ProjectPreviewDocument = ProjectWordDocument;

const FILE_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.xltx',
  '.xltm',
  '.csv',
  '.tsv',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.svg',
  'image/*',
].join(',');

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);
const SPREADSHEET_EXTENSIONS = new Set(['xls', 'xlsx', 'xlsm', 'xltx', 'xltm', 'csv', 'tsv']);

const getFileExtension = (nameOrPath: string) =>
  nameOrPath.split(/[?#]/)[0].split('.').pop()?.trim().toLowerCase() || '';

const getPreviewKind = (nameOrPath: string, mimeType = ''): PreviewKind => {
  const extension = getFileExtension(nameOrPath);
  const normalizedType = mimeType.toLowerCase();

  if (IMAGE_EXTENSIONS.has(extension) || normalizedType.startsWith('image/')) {
    return 'image';
  }

  if (extension === 'pdf' || normalizedType === 'application/pdf') {
    return 'pdf';
  }

  if (extension === 'doc' || extension === 'docx') {
    return 'word';
  }

  if (
    SPREADSHEET_EXTENSIONS.has(extension) ||
    ['text/csv', 'text/tab-separated-values', 'application/vnd.ms-excel'].includes(normalizedType)
  ) {
    return 'spreadsheet';
  }

  return 'unsupported';
};

const kindLabelMap: Record<PreviewKind, string> = {
  image: '图片',
  pdf: 'PDF',
  word: 'Word',
  spreadsheet: '表格',
  unsupported: '文件',
};

const formatFileSize = (size?: number) => {
  if (!size && size !== 0) {
    return 'docs路径';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const normalizeDocsPath = (value: string) => {
  const normalizedValue = value.trim().replace(/\\/g, '/').replace(/^\/?docs\//i, '');

  if (!normalizedValue) {
    return '';
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue;
  }

  return normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`;
};

const getNameFromPath = (path: string) => {
  const rawName = path.split(/[?#]/)[0].split('/').filter(Boolean).pop() || 'docs文件';

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
};

const buildItemId = (name: string) => `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`;

const getProjectDocumentKind = (document: ProjectPreviewDocument): PreviewKind => getPreviewKind(document.name);

const FilePreviewCenter: React.FC = () => {
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [docsPathInput, setDocsPathInput] = useState('');
  const [projectPreviewDocuments, setProjectPreviewDocuments] = useState<ProjectPreviewDocument[]>([]);
  const [projectPreviewScanStatus, setProjectPreviewScanStatus] = useState<PreviewStatus>('loading');
  const [projectPreviewScanError, setProjectPreviewScanError] = useState('');
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const selectedItem = useMemo(
    () => previewItems.find((item) => item.id === selectedItemId) || previewItems[0] || null,
    [previewItems, selectedItemId],
  );

  useEffect(() => {
    if (!selectedItem && selectedItemId) {
      setSelectedItemId('');
    }
  }, [selectedItem, selectedItemId]);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => window.URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    let disposed = false;

    const loadProjectPreviewDocuments = async () => {
      setProjectPreviewScanStatus('loading');
      setProjectPreviewScanError('');

      try {
        const response = await fetch('/api/project-files/preview-documents');

        if (!response.ok) {
          throw new Error('项目文档列表加载失败');
        }

        const payload = (await response.json()) as { files?: ProjectPreviewDocument[] };

        if (disposed) {
          return;
        }

        setProjectPreviewDocuments(Array.isArray(payload.files) ? payload.files : []);
        setProjectPreviewScanStatus('ready');
      } catch (error) {
        if (disposed) {
          return;
        }

        setProjectPreviewDocuments([]);
        setProjectPreviewScanStatus('error');
        setProjectPreviewScanError(error instanceof Error ? error.message : '项目文档列表加载失败');
      }
    };

    void loadProjectPreviewDocuments();

    return () => {
      disposed = true;
    };
  }, []);

  const updatePreviewItem = (id: string, update: Partial<PreviewItem>) => {
    setPreviewItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  };

  const createObjectUrl = (file: File) => {
    const objectUrl = window.URL.createObjectURL(file);
    objectUrlsRef.current.add(objectUrl);
    return objectUrl;
  };

  const removePreviewItem = (id: string) => {
    setPreviewItems((currentItems) => {
      const removedItem = currentItems.find((item) => item.id === id);
      if (removedItem?.path.startsWith('blob:')) {
        window.URL.revokeObjectURL(removedItem.path);
        objectUrlsRef.current.delete(removedItem.path);
      }

      return currentItems.filter((item) => item.id !== id);
    });
  };

  const buildHtmlPreview = async (item: PreviewItem, buffer: ArrayBuffer) => {
    if (item.kind === 'word') {
      return buildWordPreviewHtml(buffer, { documentPath: item.path, title: item.name });
    }

    if (item.kind === 'spreadsheet') {
      return buildSpreadsheetPreviewHtml(buffer, item.name);
    }

    return '';
  };

  const loadDocumentPreview = async (item: PreviewItem) => {
    if (item.kind !== 'word' && item.kind !== 'spreadsheet') {
      return;
    }

    try {
      const buffer = item.file
        ? await item.file.arrayBuffer()
        : await fetch(encodeURI(item.path)).then((response) => {
            if (!response.ok) {
              throw new Error('文件读取失败');
            }

            return response.arrayBuffer();
          });
      const html = await buildHtmlPreview(item, buffer);
      updatePreviewItem(item.id, { html, status: 'ready', error: undefined });
    } catch {
      updatePreviewItem(item.id, {
        status: 'error',
        error: item.kind === 'word' ? 'Word 文件暂时无法解析为页面预览。' : '表格文件暂时无法解析为页面预览。',
      });
    }
  };

  const addPreviewItems = (items: PreviewItem[]) => {
    setPreviewItems((currentItems) => [...items, ...currentItems]);
    if (!selectedItemId && items[0]) {
      setSelectedItemId(items[0].id);
    }

    items.forEach((item) => {
      void loadDocumentPreview(item);
    });
  };

  const addProjectPreviewDocument = (document: ProjectPreviewDocument) => {
    const existingItem = previewItems.find((item) => item.path === document.url);

    if (existingItem) {
      setSelectedItemId(existingItem.id);
      return;
    }

    const kind = getProjectDocumentKind(document);

    addPreviewItems([
      {
        id: buildItemId(document.relativePath),
        name: document.name,
        kind,
        source: 'docs',
        size: document.size,
        path: document.url,
        status: kind === 'word' || kind === 'spreadsheet' ? 'loading' : 'ready',
      },
    ]);
  };

  const addAllProjectPreviewDocuments = () => {
    if (!projectPreviewDocuments.length) {
      return;
    }

    const existingPaths = new Set(previewItems.map((item) => item.path));
    const newItems = projectPreviewDocuments
      .filter((document) => !existingPaths.has(document.url))
      .map<PreviewItem>((document) => {
        const kind = getProjectDocumentKind(document);

        return {
          id: buildItemId(document.relativePath),
          name: document.name,
          kind,
          source: 'docs',
          size: document.size,
          path: document.url,
          status: kind === 'word' || kind === 'spreadsheet' ? 'loading' : 'ready',
        };
      });

    if (!newItems.length) {
      const firstDocument = projectPreviewDocuments[0];
      const firstExistingItem = previewItems.find((item) => item.path === firstDocument.url);
      if (firstExistingItem) {
        setSelectedItemId(firstExistingItem.id);
      }
      return;
    }

    addPreviewItems(newItems);
  };

  const projectWordDocuments = useMemo(
    () => projectPreviewDocuments.filter((document) => getProjectDocumentKind(document) === 'word'),
    [projectPreviewDocuments],
  );

  const projectSpreadsheetDocuments = useMemo(
    () => projectPreviewDocuments.filter((document) => getProjectDocumentKind(document) === 'spreadsheet'),
    [projectPreviewDocuments],
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const items = files.map<PreviewItem>((file) => {
      const kind = getPreviewKind(file.name, file.type);
      const shouldParse = kind === 'word' || kind === 'spreadsheet';

      return {
        id: buildItemId(file.name),
        name: file.name,
        kind,
        source: 'local',
        size: file.size,
        path: createObjectUrl(file),
        status: shouldParse ? 'loading' : kind === 'unsupported' ? 'error' : 'ready',
        error: kind === 'unsupported' ? '当前文件格式暂不支持页面内预览。' : undefined,
        file,
      };
    });

    addPreviewItems(items);
    event.target.value = '';
  };

  const handleAddDocsPath = () => {
    const normalizedPath = normalizeDocsPath(docsPathInput);

    if (!normalizedPath) {
      return;
    }

    const name = getNameFromPath(normalizedPath);
    const kind = getPreviewKind(name || normalizedPath);
    const shouldParse = kind === 'word' || kind === 'spreadsheet';
    const item: PreviewItem = {
      id: buildItemId(normalizedPath),
      name,
      kind,
      source: 'docs',
      path: normalizedPath,
      status: shouldParse ? 'loading' : kind === 'unsupported' ? 'error' : 'ready',
      error: kind === 'unsupported' ? '当前文件格式暂不支持页面内预览。' : undefined,
    };

    addPreviewItems([item]);
    setDocsPathInput('');
  };

  const renderViewer = () => {
    if (!selectedItem) {
      return (
        <div className="file-preview-empty">
          <strong>暂无预览文件</strong>
          <span>选择文件后将在这里显示。</span>
        </div>
      );
    }

    if (selectedItem.kind === 'image' && selectedItem.status === 'ready') {
      return (
        <div className="file-preview-image-wrap">
          <img src={selectedItem.path} alt={`${selectedItem.name}预览`} />
        </div>
      );
    }

    if (selectedItem.kind === 'pdf' && selectedItem.status === 'ready') {
      return <iframe className="file-preview-frame" src={selectedItem.path} title={`${selectedItem.name}预览`} />;
    }

    if (selectedItem.status === 'loading') {
      return (
        <div className="file-preview-state">
          <strong>{kindLabelMap[selectedItem.kind]}</strong>
          <span>正在加载预览。</span>
        </div>
      );
    }

    if (selectedItem.status === 'ready' && selectedItem.html) {
      return (
        <iframe
          className="file-preview-frame"
          srcDoc={selectedItem.html}
          title={`${selectedItem.name}预览`}
        />
      );
    }

    return (
      <div className="file-preview-state">
        <strong>{kindLabelMap[selectedItem.kind]}</strong>
        <span>{selectedItem.error || '当前文件暂时无法预览。'}</span>
        {selectedItem.kind !== 'unsupported' && (
          <a href={selectedItem.path} target="_blank" rel="noreferrer">
            打开原文件
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fadeIn">
      <header className="app-topbar file-preview-topbar">
        <div>
          <div className="app-topbar__breadcrumb">文件中心 / docs预览</div>
          <h1 className="app-topbar__title">文件预览</h1>
        </div>
      </header>

      <main className="app-main file-preview-page">
        <section className="file-preview-upload">
          <div className="file-preview-upload__primary">
            <label className="btn btn--primary file-preview-upload__button" htmlFor="file-preview-upload-input">
              上传文件
            </label>
            <input
              id="file-preview-upload-input"
              className="file-preview-upload__input"
              type="file"
              accept={FILE_ACCEPT}
              multiple
              onChange={handleFileUpload}
            />
          </div>

          <div className="file-preview-path">
            <input
              className="form-input file-preview-path__input"
              value={docsPathInput}
              onChange={(event) => setDocsPathInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleAddDocsPath();
                }
              }}
              placeholder="/ETC/xlsx/用户画像.xlsx"
            />
            <button className="btn btn--secondary" type="button" onClick={handleAddDocsPath}>
              添加docs路径
            </button>
          </div>
        </section>

        <section className="file-preview-project-word">
          <div className="file-preview-project-word__summary">
            <div>
              <div className="app-topbar__breadcrumb">项目识别 / Word 与 Excel</div>
              <strong>meika 项目文档识别与预览</strong>
            </div>
            <div className="file-preview-project-word__actions">
              <span>
                {projectPreviewScanStatus === 'loading'
                  ? '扫描中...'
                  : projectPreviewScanStatus === 'error'
                    ? '扫描失败'
                    : `已识别 ${projectPreviewDocuments.length} 个`}
              </span>
              <button
                className="btn btn--primary"
                type="button"
                onClick={addAllProjectPreviewDocuments}
                disabled={projectPreviewScanStatus !== 'ready' || projectPreviewDocuments.length === 0}
              >
                载入全部文档
              </button>
            </div>
          </div>

          {projectPreviewScanStatus === 'error' ? (
            <div className="file-preview-project-word__state">{projectPreviewScanError || '项目文档扫描失败。'}</div>
          ) : projectPreviewDocuments.length > 0 ? (
            <div className="file-preview-project-groups">
              <section className="file-preview-project-group">
                <div className="file-preview-project-group__head">
                  <strong>Word</strong>
                  <span>{projectWordDocuments.length}</span>
                </div>
                <div className="file-preview-project-word__list">
                  {projectWordDocuments.map((document) => (
                    <button
                      key={document.relativePath}
                      type="button"
                      className="file-preview-project-word__item"
                      onClick={() => addProjectPreviewDocument(document)}
                    >
                      <strong>{document.name}</strong>
                      <span>{document.relativePath}</span>
                      <small>{formatFileSize(document.size)}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="file-preview-project-group">
                <div className="file-preview-project-group__head">
                  <strong>Excel / 表格</strong>
                  <span>{projectSpreadsheetDocuments.length}</span>
                </div>
                <div className="file-preview-project-word__list">
                  {projectSpreadsheetDocuments.map((document) => (
                    <button
                      key={document.relativePath}
                      type="button"
                      className="file-preview-project-word__item"
                      onClick={() => addProjectPreviewDocument(document)}
                    >
                      <strong>{document.name}</strong>
                      <span>{document.relativePath}</span>
                      <small>{formatFileSize(document.size)}</small>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="file-preview-project-word__state">
              {projectPreviewScanStatus === 'loading' ? '正在识别项目内 Word 与 Excel 文档。' : '当前项目中未识别到可预览文档。'}
            </div>
          )}
        </section>

        <section className="file-preview-workbench">
          <aside className="file-preview-list">
            <div className="file-preview-list__head">
              <strong>文件列表</strong>
              <span>{previewItems.length}</span>
            </div>

            {previewItems.length > 0 ? (
              <div className="file-preview-list__items">
                {previewItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`file-preview-list-item ${
                      selectedItem?.id === item.id ? 'file-preview-list-item--active' : ''
                    }`}
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <span className="file-preview-list-item__type">{kindLabelMap[item.kind]}</span>
                    <span className="file-preview-list-item__body">
                      <strong>{item.name}</strong>
                      <small>{item.source === 'docs' ? item.path : formatFileSize(item.size)}</small>
                    </span>
                    <span
                      className={`file-preview-list-item__status file-preview-list-item__status--${item.status}`}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="file-preview-list__empty">未选择文件</div>
            )}
          </aside>

          <div className="file-preview-viewer-panel">
            <div className="file-preview-viewer-panel__meta">
              {selectedItem ? (
                <>
                  <div className="file-preview-meta">
                    <span>{kindLabelMap[selectedItem.kind]}</span>
                    <strong>{selectedItem.name}</strong>
                  </div>
                  <div className="file-preview-actions">
                    <a className="btn btn--secondary" href={selectedItem.path} target="_blank" rel="noreferrer">
                      打开原文件
                    </a>
                    <button className="btn btn--ghost" type="button" onClick={() => removePreviewItem(selectedItem.id)}>
                      移除
                    </button>
                  </div>
                </>
              ) : (
                <div className="file-preview-meta">
                  <span>预览</span>
                  <strong>等待文件</strong>
                </div>
              )}
            </div>

            <div className="file-preview-viewer">{renderViewer()}</div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default FilePreviewCenter;
