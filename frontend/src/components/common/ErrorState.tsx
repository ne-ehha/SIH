interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Unable to connect to server.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <span className="text-3xl">⚠️</span>
      <p className="text-sm text-red-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md bg-cyan-600 px-4 py-1.5 text-sm text-white transition hover:bg-cyan-500"
        >
          Retry
        </button>
      )}
    </div>
  );
}
