import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';
import './DateTimePicker.css';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateDisplay(date) {
  if (!date) return '';
  const d = date.getDate();
  const m = MONTHS[date.getMonth()].slice(0, 3);
  const y = date.getFullYear();
  const h = date.getHours();
  const min = date.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${d} ${m} ${y}, ${h12}:${min} ${ampm}`;
}

function toLocalInputValue(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

function fromLocalInputValue(str) {
  if (!str) return null;
  const [datePart, timePart] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

export default function DateTimePicker({
  value,
  onChange,
  placeholder = 'Select date & time',
  minDate,
  disabled = false,
  name,
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const initial = value ? new Date(value) : null;
  const [viewDate, setViewDate] = useState(initial || new Date());
  const [selected, setSelected] = useState(initial);
  const [hours, setHours] = useState(initial ? initial.getHours() : 9);
  const [minutes, setMinutes] = useState(initial ? initial.getMinutes() : 0);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const positionDropdown = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < 340;
    setDropdownStyle({
      position: 'fixed',
      top: flipUp ? rect.top - 340 - 6 : rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 316),
      zIndex: 9999,
    });
  }, []);

  const handleDayClick = useCallback((day) => {
    const d = new Date(year, month, day);
    if (minDate && d < new Date(minDate)) return;
    setSelected(d);
    setViewDate(new Date(d));
    const result = new Date(d);
    result.setHours(hours, minutes, 0, 0);
    if (minDate && result < new Date(minDate)) return;
    onChange?.(toLocalInputValue(result));
    setOpen(false);
  }, [year, month, hours, minutes, minDate, onChange]);

  const handleToday = useCallback(() => {
    const now = new Date();
    setViewDate(now);
    setSelected(now);
    setHours(now.getHours());
    setMinutes(now.getMinutes());
    now.setSeconds(0, 0);
    if (minDate && now < new Date(minDate)) return;
    onChange?.(toLocalInputValue(now));
    setOpen(false);
  }, [minDate, onChange]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    setSelected(null);
    onChange?.(null);
    setOpen(false);
  }, [onChange]);

  useEffect(() => {
    if (!open) return;
    positionDropdown();
    const handleClick = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const handleScroll = () => positionDropdown();
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, positionDropdown]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const adjustTime = useCallback((field, delta) => {
    if (field === 'hours') {
      setHours((prev) => {
        const next = (prev + delta + 24) % 24;
        if (selected) {
          const d = new Date(selected);
          d.setHours(next, minutes, 0, 0);
          if (minDate && d < new Date(minDate)) return prev;
          onChange?.(toLocalInputValue(d));
        }
        return next;
      });
    } else {
      setMinutes((prev) => {
        const next = (prev + delta + 60) % 60;
        if (selected) {
          const d = new Date(selected);
          d.setHours(hours, next, 0, 0);
          if (minDate && d < new Date(minDate)) return prev;
          onChange?.(toLocalInputValue(d));
        }
        return next;
      });
    }
  }, [selected, hours, minutes, minDate, onChange]);

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    const prevMonthDays = getDaysInMonth(year, month - 1);
    days.push({ day: prevMonthDays - firstDay + i + 1, outside: true, date: new Date(year, month - 1, prevMonthDays - firstDay + i + 1) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, outside: false, date: new Date(year, month, d) });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, outside: true, date: new Date(year, month + 1, i) });
  }

  return (
    <div className="dtp-wrapper" style={{ position: 'relative', width: '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        className={`dtp-trigger${open ? ' open' : ''}`}
        onClick={() => { if (!disabled) setOpen((p) => !p); }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        name={name}
      >
        {selected ? (
          <span>{formatDateDisplay(selected)}</span>
        ) : (
          <span className="dtp-trigger-placeholder">{placeholder}</span>
        )}
        <CalendarBlank className="dtp-trigger-icon" weight="duotone" />
      </button>

      {selected && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear date"
          style={{
            position: 'absolute', right: '2rem', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
            padding: '2px', display: 'flex', lineHeight: 1, fontSize: '14px',
          }}
        >
          &times;
        </button>
      )}

      {open && createPortal(
        <div ref={dropdownRef} className="dtp-dropdown" style={dropdownStyle} role="dialog" aria-label="Date time picker">
          {/* Calendar */}
          <div className="dtp-cal-header">
            <span className="dtp-cal-title">{MONTHS[month]} {year}</span>
            <div className="dtp-cal-nav">
              <button type="button" onClick={() => setViewDate(new Date(year, month - 1))} aria-label="Previous month">
                <CaretLeft weight="bold" size={14} />
              </button>
              <button type="button" onClick={() => setViewDate(new Date(year, month + 1))} aria-label="Next month">
                <CaretRight weight="bold" size={14} />
              </button>
            </div>
          </div>

          <div className="dtp-cal-weekdays">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="dtp-cal-weekday">{wd}</div>
            ))}
          </div>

          <div className="dtp-cal-days">
            {days.map((d, i) => {
              const isDisabled = minDate && d.date < new Date(minDate).setHours(0,0,0,0);
              const isSelected = selected && isSameDay(d.date, selected);
              const isToday = isSameDay(d.date, today);
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    'dtp-cal-day',
                    d.outside && 'dtp-cal-day--outside',
                    isSelected && 'dtp-cal-day--selected',
                    isToday && 'dtp-cal-day--today',
                    isDisabled && 'dtp-cal-day--disabled',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !isDisabled && !d.outside && handleDayClick(d.day)}
                  disabled={isDisabled || d.outside}
                  tabIndex={d.outside ? -1 : 0}
                >
                  {d.day}
                </button>
              );
            })}
          </div>

          <div className="dtp-divider" />

          {/* Time */}
          <div className="dtp-time">
            <div className="dtp-time-col">
              <span className="dtp-time-label">Hour</span>
              <div className="dtp-time-spinner">
                <button type="button" onClick={() => adjustTime('hours', -1)} aria-label="Decrease hour">&lsaquo;</button>
                <span>{hours.toString().padStart(2, '0')}</span>
                <button type="button" onClick={() => adjustTime('hours', 1)} aria-label="Increase hour">&rsaquo;</button>
              </div>
            </div>

            <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '1rem', paddingBottom: '1rem' }}>:</span>

            <div className="dtp-time-col">
              <span className="dtp-time-label">Min</span>
              <div className="dtp-time-spinner">
                <button type="button" onClick={() => adjustTime('minutes', -5)} aria-label="Decrease minutes">&lsaquo;</button>
                <span>{minutes.toString().padStart(2, '0')}</span>
                <button type="button" onClick={() => adjustTime('minutes', 5)} aria-label="Increase minutes">&rsaquo;</button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="dtp-footer">
            <button type="button" onClick={handleToday}>Today</button>
            {selected && (
              <button type="button" onClick={handleClear}>Clear</button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
