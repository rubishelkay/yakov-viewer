export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <div className="loading-state" role="status"><span />{label}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      {retry && <button type="button" className="button" onClick={retry}>Try again</button>}
    </div>
  );
}
