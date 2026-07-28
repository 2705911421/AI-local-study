export function StatusToast({ message }: { message: string }) {
  return (
    <div
      className={`status-toast ${message ? "is-visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
