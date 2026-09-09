interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading data...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-t-transparent" style={{ borderColor: 'var(--os-argo)', borderTopColor: 'transparent' }} />
      <p className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>{message}</p>
    </div>
  );
}
