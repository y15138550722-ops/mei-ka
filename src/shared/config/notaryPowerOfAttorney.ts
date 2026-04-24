export type NotaryPowerOfAttorneyKey = 'zhangjiang' | 'beibuGulf' | 'foreignAffairsOffice';

export interface NotaryPowerOfAttorneyExportOption {
  buttonClassName: string;
  buttonLabel: string;
  exportLabel: string;
  key: NotaryPowerOfAttorneyKey;
  path: string;
}

export interface NotaryPowerOfAttorneyPreviewFileDescriptor {
  id: string;
  key: NotaryPowerOfAttorneyKey;
  name: string;
}

type NotaryPowerOfAttorneyDefinition = Omit<NotaryPowerOfAttorneyExportOption, 'path'> & {
  fileId: string;
  getPreviewFileName: (customerName: string) => string;
};

const NOTARY_POWER_OF_ATTORNEY_DEFINITIONS: Record<
  NotaryPowerOfAttorneyKey,
  NotaryPowerOfAttorneyDefinition
> = {
  zhangjiang: {
    key: 'zhangjiang',
    fileId: 'power-of-attorney',
    exportLabel: '张江',
    buttonLabel: '导出张江委托书',
    buttonClassName: 'order-audit-topbar__action-btn--power',
    getPreviewFileName: (customerName) => `${customerName}.docx`,
  },
  beibuGulf: {
    key: 'beibuGulf',
    fileId: 'beibu-gulf-power-of-attorney',
    exportLabel: '北部湾',
    buttonLabel: '导出北部湾委托书',
    buttonClassName: 'order-audit-topbar__action-btn--beibu-gulf',
    getPreviewFileName: (customerName) => `${customerName}的北部湾委托书.docx`,
  },
  foreignAffairsOffice: {
    key: 'foreignAffairsOffice',
    fileId: 'foreign-affairs-power-of-attorney',
    exportLabel: '外事办',
    buttonLabel: '导出外事办委托书',
    buttonClassName: 'order-audit-topbar__action-btn--foreign-affairs',
    getPreviewFileName: (customerName) => `${customerName}的外事办委托书.docx`,
  },
};

const NOTARY_POWER_OF_ATTORNEY_EXPORT_ORDER: NotaryPowerOfAttorneyKey[] = [
  'foreignAffairsOffice',
  'beibuGulf',
  'zhangjiang',
];

const NOTARY_POWER_OF_ATTORNEY_PREVIEW_ORDER: NotaryPowerOfAttorneyKey[] = [
  'zhangjiang',
  'beibuGulf',
  'foreignAffairsOffice',
];

export const buildNotaryPowerOfAttorneyExportOptions = (
  path: string,
): NotaryPowerOfAttorneyExportOption[] =>
  NOTARY_POWER_OF_ATTORNEY_EXPORT_ORDER.map((key) => {
    const definition = NOTARY_POWER_OF_ATTORNEY_DEFINITIONS[key];

    return {
      key: definition.key,
      exportLabel: definition.exportLabel,
      buttonLabel: definition.buttonLabel,
      buttonClassName: definition.buttonClassName,
      path,
    };
  });

export const buildNotaryPowerOfAttorneyPreviewFileDescriptors = (
  customerName: string,
): NotaryPowerOfAttorneyPreviewFileDescriptor[] =>
  NOTARY_POWER_OF_ATTORNEY_PREVIEW_ORDER.map((key) => {
    const definition = NOTARY_POWER_OF_ATTORNEY_DEFINITIONS[key];

    return {
      key: definition.key,
      id: definition.fileId,
      name: definition.getPreviewFileName(customerName),
    };
  });
