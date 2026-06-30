export type IddTemplateId = 'card' | 'full' | 'info';

export type IddTemplateItem = {
  description: string;
  fileName: string;
  id: IddTemplateId;
  previewUrl: string;
  title: string;
};

const cardTemplatePdfUrl = new URL('./assets/pdf/IDD卡片模版.pdf', import.meta.url).href;
const fullTemplatePdfUrl = new URL('./assets/pdf/IDD完整模版.pdf', import.meta.url).href;
const infoTemplatePdfUrl = new URL('./assets/pdf/IDD信息页模版.pdf', import.meta.url).href;

export const IDD_TEMPLATE_ITEMS: IddTemplateItem[] = [
  {
    id: 'card',
    title: 'IDD卡片模版',
    description: '展示 IDD 卡片模版预览。',
    fileName: 'IDD卡片模版.pdf',
    previewUrl: cardTemplatePdfUrl,
  },
  {
    id: 'full',
    title: 'IDD完整模版',
    description: '展示 IDD 完整模版预览。',
    fileName: 'IDD完整模版.pdf',
    previewUrl: fullTemplatePdfUrl,
  },
  {
    id: 'info',
    title: 'IDD信息页模版',
    description: '展示 IDD 信息页模版预览。',
    fileName: 'IDD信息页模版.pdf',
    previewUrl: infoTemplatePdfUrl,
  },
];

const getTemplateById = (templateId: IddTemplateId) =>
  IDD_TEMPLATE_ITEMS.find((item) => item.id === templateId) || IDD_TEMPLATE_ITEMS[0];

export const getIddTemplatePreviewUrl = (templateId: IddTemplateId) => getTemplateById(templateId).previewUrl;
