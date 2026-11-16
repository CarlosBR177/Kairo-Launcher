export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${on ? "on" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
    >
      <span />
    </button>
  );
}
