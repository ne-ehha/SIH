interface EmptyStateProps {
  message?: string;
  icon?: string;
}

export function EmptyState({ message = 'No data available' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <p className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>{message}</p>
    </div>
  );
}
