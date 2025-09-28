function ChatLoadingSpinner({
  title = "AI is generating…",
  className = "",
}: {
  title?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-label={title}
      title={title}
    >
      <span className="relative inline-block">
        {/* glow */}
        <span className="absolute inset-0 rounded-full bg-blue-500/20 blur-[3px]" />
        {/* dual ring */}
        <svg
          className="relative w-3.5 h-3.5 animate-spin text-blue-600"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v3.5a4.5 4.5 0 00-4.5 4.5H4z"
          />
        </svg>
      </span>
    </span>
  );
}

export default ChatLoadingSpinner;
