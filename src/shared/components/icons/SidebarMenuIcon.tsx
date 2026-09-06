import type { ReactNode, SVGProps } from 'react';

export type SidebarMenuIconName =
  | 'dashboard'
  | 'orders'
  | 'translation'
  | 'license'
  | 'notary'
  | 'external-orders'
  | 'idp'
  | 'api'
  | 'klook'
  | 'hello'
  | 'products'
  | 'file-preview';

interface SidebarMenuIconProps extends SVGProps<SVGSVGElement> {
  name: SidebarMenuIconName;
}

const paths: Record<SidebarMenuIconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  orders: <><path d="M7 3h10l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M17 3v5h5M9 12h6M9 16h6" /></>,
  translation: <><path d="M4 5h8M8 3v2c0 5-2.1 8-5 10M5 11c1.3 1.8 3 3.1 5 4" /><path d="m14 19 3.5-10L21 19M15.2 16h4.6" /></>,
  license: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="12" r="2" /><path d="M13 10h5M13 14h5" /></>,
  notary: <><path d="M5 21h14M7 18h10M9 18v-5h6v5M12 3l6 4H6l6-4ZM7 7v6M12 7v6M17 7v6" /></>,
  'external-orders': <><path d="M14 3h7v7M21 3l-9 9" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></>,
  idp: <><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  api: <><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14" /></>,
  klook: <><path d="m12 3 2.1 4.9L19 8.3l-3.5 3.6.9 5.1-4.9-2.7L6.8 17l.9-5.1L4.2 8.3l4.9-.4L12 3Z" /></>,
  hello: <><path d="M20 11.5a8 8 0 0 1-8.6 8 8.1 8.1 0 0 1-3.6-1L4 20l1.5-3.4A8 8 0 1 1 20 11.5Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></>,
  products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12.1V21" /></>,
  'file-preview': <><path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M8 14l2-2 2 2 3-3 2 2" /></>,
};

export const SidebarMenuIcon = ({ name, ...props }: SidebarMenuIconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {paths[name]}
  </svg>
);
