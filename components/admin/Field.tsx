// Shared labelled-field wrapper for admin forms. With `htmlFor` it renders a
// real <label>, so the control gets its accessible name from the visible
// label and clicking the label focuses the control. Without `htmlFor` (button
// groups like Condition/Status, which aren't labelable controls) it renders
// the same text as a span.
export function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const labelClass = "block text-sm font-medium";
  return (
    <div className={className ? `space-y-1 ${className}` : "space-y-1"}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      {children}
    </div>
  );
}
