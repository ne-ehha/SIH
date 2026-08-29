interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading data...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
