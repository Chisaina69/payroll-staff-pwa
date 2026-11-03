
const buttonVariants = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  secondary: "border border-line bg-white text-ink-700 hover:bg-surface-alt",
  danger: "bg-danger text-white hover:opacity-90",
};

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export function Button({ variant = "primary", className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariants[variant] || buttonVariants.primary} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-ink-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Card({ children, className = "" }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Badge({ status }) {
  const styles = {
    active: "bg-success/10 text-success",
    approved: "bg-success/10 text-success",
    completed: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    rejected: "bg-danger/10 text-danger",
    inactive: "bg-surface-alt text-ink-500",
  };
  const normalizedStatus = String(status || "unknown");

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[normalizedStatus] || "bg-surface-alt text-ink-500"}`}>
      {normalizedStatus}
    </span>
  );
}

export function StatCard({ label, value, accent = false }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? "text-accent-600" : "text-ink-900"}`}>{value}</p>
    </div>
  );
}

export function TabPill({ children, active = false, onClick, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-brand-700 text-white" : "bg-surface-alt text-ink-600"}`}
    >
      {children}
      {typeof count === "number" && count > 0 && <span className="ml-2">{count}</span>}
    </button>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface-alt px-6 py-10 text-center text-sm text-ink-500">
      {children}
    </div>
  );
}
