import React from 'react';

/** SVG geometry uses native attributes rather than inline CSS. */
export type MetricTone = 'primary' | 'secondary' | 'dark' | 'accent' | 'neutral' | 'income' | 'withholding' | 'travel';
export type MetricSegment = { value: number; tone: MetricTone };

const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const percentage = (value: number, total: number) => safe(total) > 0 ? Math.min(100, 100 * safe(value) / total) : 0;

export function MetricBar({value, total, tone = 'primary', className = ''}: {
  value: number; total: number; tone?: MetricTone; className?: string;
}) {
  return <svg className={`ui-metric-bar ${className}`} viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <rect className={`ui-metric-tone--${tone}`} x="0" y="0" width={percentage(value, total)} height="1" />
  </svg>;
}

export function MetricStack({segments, total, className = ''}: {
  segments: readonly MetricSegment[]; total: number; className?: string;
}) {
  let cursor = 0;
  return <svg className={`ui-metric-stack ${className}`} viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {segments.map((segment, index) => {
      const x = cursor;
      const width = Math.min(100 - x, percentage(segment.value, total));
      cursor += width;
      return <rect key={index} className={`ui-metric-tone--${segment.tone}`} x={x} y="0" width={width} height="1" />;
    })}
  </svg>;
}

export function MetricDonut({segments, total, className = ''}: {
  segments: readonly MetricSegment[]; total: number; className?: string;
}) {
  const circumference = 2 * Math.PI * 40;
  let cursor = 0;
  return <svg className={`ui-metric-donut ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <circle className="ui-metric-donut__track" cx="50" cy="50" r="40" />
    {segments.map((segment, index) => {
      const start = cursor;
      const fraction = Math.min(100 - start, percentage(segment.value, total));
      cursor += fraction;
      return <circle key={index} className={`ui-metric-tone--${segment.tone}`} cx="50" cy="50" r="40"
        transform="rotate(-90 50 50)" strokeDasharray={`${fraction * circumference / 100} ${circumference}`}
        strokeDashoffset={-start * circumference / 100} />;
    })}
  </svg>;
}

export function MetricColumn({value, total, tone = 'primary', className = ''}: {
  value: number; total: number; tone?: MetricTone; className?: string;
}) {
  const height = percentage(value, total);
  return <svg className={`ui-metric-column ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <rect className={`ui-metric-tone--${tone}`} x="0" y={100 - height} width="100" height={height} />
  </svg>;
}

export function MetricDot({tone}: {tone: MetricTone}) {
  return <span aria-hidden="true" className={`ui-metric-dot ui-metric-tone--${tone}`} />;
}
