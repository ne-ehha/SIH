interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Unable to connect to server.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <p className="text-[10px] text-red-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[10px] text-cyan-400 hover:text-cyan-300 transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}
