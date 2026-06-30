import React, { useEffect, useMemo, useRef, useState } from 'react';
import './DatePickerInput.css';

interface DatePickerInputProps {
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateValue = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : null;
};

const isSameDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const buildCalendarDays = (monthDate: Date) => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
};

const DatePickerInput: React.FC<DatePickerInputProps> = ({ ariaLabel, placeholder, value, onChange, className }) => {
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate || new Date());
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => new Date(), []);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const selectDate = (date: Date) => {
    onChange(formatDateValue(date));
    setIsOpen(false);
  };

  return (
    <div ref={pickerRef} className={['agent-date-field', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={`agent-date-trigger ${isOpen ? 'agent-date-trigger--open' : ''} ${value ? '' : 'agent-date-trigger--empty'}`}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="agent-date-trigger__value">{value || placeholder}</span>
        <span className="agent-date-trigger__icon" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="agent-date-picker" role="dialog" aria-label={`${ariaLabel}日期选择`}>
          <div className="agent-date-picker__header">
            <div className="agent-date-picker__nav">
              <button type="button" onClick={() => moveMonth(-12)} aria-label="上一年">&laquo;</button>
              <button type="button" onClick={() => moveMonth(-1)} aria-label="上个月">&lsaquo;</button>
            </div>
            <strong>{visibleMonth.getFullYear()} 年&nbsp;&nbsp;{visibleMonth.getMonth() + 1} 月</strong>
            <div className="agent-date-picker__nav">
              <button type="button" onClick={() => moveMonth(1)} aria-label="下个月">&rsaquo;</button>
              <button type="button" onClick={() => moveMonth(12)} aria-label="下一年">&raquo;</button>
            </div>
          </div>

          <div className="agent-date-picker__week">
            {['日', '一', '二', '三', '四', '五', '六'].map((weekDay) => (
              <span key={weekDay}>{weekDay}</span>
            ))}
          </div>

          <div className="agent-date-picker__days">
            {calendarDays.map((date) => {
              const currentMonth = date.getMonth() === visibleMonth.getMonth();
              const selected = selectedDate ? isSameDate(date, selectedDate) : false;
              const currentDay = isSameDate(date, today);

              return (
                <button
                  key={formatDateValue(date)}
                  type="button"
                  className={[
                    'agent-date-picker__day',
                    currentMonth ? '' : 'agent-date-picker__day--muted',
                    selected ? 'agent-date-picker__day--selected' : '',
                    currentDay && !selected ? 'agent-date-picker__day--today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePickerInput;
