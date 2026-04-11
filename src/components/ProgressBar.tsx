"use client";

interface ProgressBarProps {
  answered: number;
  total: number;
}

export default function ProgressBar({ answered, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">
          {answered} av {total} besvarade
        </span>
        <span className="text-sm font-bold text-primary">{percentage}%</span>
      </div>
      <div className="w-full bg-surface-muted rounded-full h-2.5">
        <div
          className="bg-primary h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
