// ============================================
// FormPageShell — FORM_BASE_V1 Shell
// ============================================
import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/config';

export interface FormSection {
  id: string;
  labelKey: string;
  content: React.ReactNode;
}

interface FormPageShellProps {
  titleKey: string;
  sections: FormSection[];
  onSave: () => void;
  onCancel: () => void;
  extraFooter?: React.ReactNode;
}

const FormPageShell: React.FC<FormPageShellProps> = ({
  titleKey,
  sections,
  onSave,
  onCancel,
  extraFooter,
}) => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  return (
    <div className="form-page animate-fadeIn">
      {/* Header */}
      <div className="form-page__header">
        <h1 className="form-page__title">{t(titleKey)}</h1>
      </div>

      {/* Body: Content + Sidebar TOC */}
      <div className="form-page__body">
        <div className="form-page__content">
          {sections.map(section => (
            <div key={section.id} id={section.id} className="form-section card">
              <div className="card__header">
                <h2 className="card__title">{t(section.labelKey)}</h2>
              </div>
              <div className="card__body">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        {/* Anchor TOC — visible on large screens (>=1280px) */}
        {sections.length >= 3 && (
          <aside className="form-page__toc">
            <div className="form-toc" id="form-toc">
              <div className="form-toc__title">{t('common.navigate') || '目录'}</div>
              {sections.map(s => (
                <div
                  key={s.id}
                  className={`form-toc__item ${activeSection === s.id ? 'form-toc__item--active' : ''}`}
                  onClick={() => scrollTo(s.id)}
                >
                  {t(s.labelKey)}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Footer — sticky action bar (FORM_BASE_V1: Cancel/Save at bottom) */}
      <div className="form-page__footer" id="form-footer">
        <div className="form-page__footer-inner">
          {extraFooter}
          <div className="form-page__footer-actions">
            <button className="btn btn--secondary" onClick={onCancel}>{t('common.cancel')}</button>
            <button className="btn btn--primary" onClick={onSave}>{t('common.save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormPageShell;
