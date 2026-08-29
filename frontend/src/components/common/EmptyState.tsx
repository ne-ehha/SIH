interface EmptyStateProps {
  message?: string;
  icon?: string;
}

export function EmptyState({ message = 'No data available', icon = '🌊' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <span className="text-3xl">{icon}</span>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
