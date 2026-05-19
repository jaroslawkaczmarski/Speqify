/**
 * Reusable component layer — Convergence design system (Components.html / DS).
 * Each component renders the canonical DS class names (defined in index.css),
 * so visual parity is guaranteed and the markup stays declarative + typed.
 *
 * Single import surface for pages: re-exports Page/Placeholder/useAsync etc.
 */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { IconAlert, IconCheck, IconInfo, IconX } from "./icons.js";

export { Page, useAsync, csvToList } from "./ui.js";
import { Page as PageLayout } from "./ui.js";

type AlertKind = "info" | "success" | "warning" | "danger";

/* ---- 06 · Buttons --------------------------------------------------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger-ghost";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [
    "btn",
    `btn-${variant}`,
    size === "lg" ? "btn-lg" : size === "sm" ? "btn-sm" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

/* ---- 07 · Icon button ----------------------------------------------- */
export function IconButton({
  label,
  bordered,
  children,
  className,
  ...rest
}: { label: string; bordered?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`iconbtn${bordered ? " iconbtn-bordered" : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---- 12/13 · Status pills ------------------------------------------- */
export function Pill({
  kind,
  children,
}: {
  kind: "live" | "paused" | "archived" | "warn" | "danger" | "info";
  children: ReactNode;
}) {
  return (
    <span className={`pill ${kind}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

export function EnvPill({ env }: { env: "prod" | "stg" | "dev" }) {
  return <span className={`env-pill env-${env}`}>{env}</span>;
}

export function RoleBadge({ role }: { role: "sa" | "po" | "rev" }) {
  return (
    <span className={`role-badge ${role}`}>
      {role === "sa" ? "SA" : role === "po" ? "PO" : "Reviewer"}
    </span>
  );
}

export function CountChip({ children, tone }: { children: ReactNode; tone?: "hot" | "info" }) {
  return <span className={`count-chip${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

export function Chip({
  children,
  variant,
  onRemove,
}: {
  children: ReactNode;
  variant?: "suggest" | "add";
  onRemove?: () => void;
}) {
  return (
    <span className={`chip${variant ? ` ${variant}` : ""}`}>
      {children}
      {onRemove ? (
        <button
          type="button"
          className="x"
          aria-label="Usuń"
          onClick={onRemove}
          style={{ background: "none", border: 0, cursor: "pointer", color: "inherit" }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

/* ---- 17 · Card ------------------------------------------------------ */
export function Card({
  pad,
  className,
  children,
  ...rest
}: { pad?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card${pad ? " card-pad" : ""}${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card-h">
      <div>
        <h2>{title}</h2>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

/* ---- 18 · Stat ------------------------------------------------------ */
export function Stat({
  label,
  value,
  delta,
  deltaNeg,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaNeg?: boolean;
}) {
  return (
    <div className="stat">
      <span className="l">{label}</span>
      <span className="n">{value}</span>
      {delta ? <span className={`d${deltaNeg ? " neg" : ""}`}>{delta}</span> : null}
    </div>
  );
}

/* ---- 23 · Inline alert ---------------------------------------------- */
const ALERT_ICON: Record<AlertKind, ReactNode> = {
  info: <IconInfo />,
  success: <IconCheck />,
  warning: <IconAlert />,
  danger: <IconAlert />,
};

export function Alert({
  kind,
  title,
  children,
  onClose,
}: {
  kind: AlertKind;
  title?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className={`alert alert-${kind}`} role={kind === "danger" ? "alert" : "status"}>
      <span className="ic" aria-hidden="true">
        {ALERT_ICON[kind]}
      </span>
      <div>
        {title ? <strong>{title}</strong> : null}
        {children}
      </div>
      {onClose ? (
        <button className="close" aria-label="Zamknij" onClick={onClose}>
          <IconX />
        </button>
      ) : null}
    </div>
  );
}

/* ---- 08/09 · Forms -------------------------------------------------- */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? " error" : ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/* ---- 10 · Toggle / checkbox ----------------------------------------- */
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle${on ? " on" : ""}`}
      onClick={() => onChange(!on)}
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

/* ---- 11 · Segmented control ----------------------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---- 20 · Avatars --------------------------------------------------- */
const GRADIENTS = [
  "linear-gradient(135deg,#A855F7,#6366F1)",
  "linear-gradient(135deg,#22D3EE,#3B82F6)",
  "linear-gradient(135deg,#22C55E,#0EA5E9)",
  "linear-gradient(135deg,#F59E0B,#EF4444)",
  "linear-gradient(135deg,#EC4899,#8B5CF6)",
];
function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length] as string;
}
export function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={`av${size === "sm" ? " av-sm" : size === "lg" ? " av-lg" : ""}`}
      style={{ background: gradientFor(initials) }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}
export function AvatarStack({ people, max = 5 }: { people: string[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="av-stack">
      {shown.map((p, i) => (
        <Avatar key={`${p}-${i}`} initials={p} />
      ))}
      {extra > 0 ? <span className="more">+{extra}</span> : null}
    </span>
  );
}

/* ---- 28 · Empty state ----------------------------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="ic" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

/* ---- 29 · Skeleton -------------------------------------------------- */
export function Skeleton({
  width,
  height,
  circle,
  line,
}: {
  width?: number | string;
  height?: number | string;
  circle?: boolean;
  line?: boolean;
}) {
  return (
    <div
      className={`sk sk-anim${line ? " sk-line" : ""}`}
      style={{
        width,
        height,
        borderRadius: circle ? "50%" : undefined,
      }}
    />
  );
}

/* ---- 25 · Confirm modal --------------------------------------------- */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Potwierdź",
  danger,
  requireAck,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** DS §25: destructive actions gate confirm behind an explicit acknowledgement. */
  requireAck?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [acked, setAcked] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAcked(false);
    const prevFocus = document.activeElement as HTMLElement | null;
    const focusables = (): HTMLElement[] =>
      Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    // Focus the first control once mounted.
    queueMicrotask(() => focusables()[0]?.focus());

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const active = modalRef.current?.contains(document.activeElement)
        ? (document.activeElement as HTMLElement)
        : null;
      if (e.shiftKey && (active === first || active === null)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      prevFocus?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="modal-bg"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={String(title)}
        ref={modalRef}
      >
        <div className="modal-head">
          {danger ? (
            <div className="modal-warn-ic" aria-hidden="true">
              <IconAlert />
            </div>
          ) : null}
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {requireAck ? (
          <div className="modal-body">
            <Checkbox checked={acked} onChange={setAcked}>
              {requireAck}
            </Checkbox>
          </div>
        ) : null}
        <div className="modal-foot">
          <Button variant="secondary" onClick={onCancel}>
            Anuluj
          </Button>
          <Button
            variant={danger ? "danger-ghost" : "primary"}
            disabled={requireAck ? !acked : false}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---- 24 · Toasts ---------------------------------------------------- */
type ToastKind = "ok" | "info" | "warn" | "danger";
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}
interface ToastApi {
  push: (t: Omit<ToastItem, "id">) => void;
}
const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const TOAST_ICON: Record<ToastKind, ReactNode> = {
  ok: <IconCheck />,
  info: <IconInfo />,
  warn: <IconAlert />,
  danger: <IconX />,
};

/** A view that exists in the design but has no backend in this build. */
export function Placeholder(props: { crumbs: string[]; title: string; note: string }) {
  return (
    <PageLayout crumbs={props.crumbs}>
      <div className="page-h">
        <div>
          <h1>{props.title}</h1>
          <p className="sub">Widok z projektu graficznego</p>
        </div>
      </div>
      <Card pad style={{ maxWidth: 640 }}>
        <Alert kind="info">{props.note}</Alert>
        <p className="hint">
          Makieta tego ekranu jest częścią dostarczonego designu. Logika/endpoint API nie wchodzi w
          zakres bieżącej fazy — patrz raport luk w odpowiedzi.
        </p>
      </Card>
    </PageLayout>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useId();
  const counter = useRef(0);
  const remove = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);
  const push = useCallback<ToastApi["push"]>(
    (t) => {
      const id = ++counter.current;
      setItems((xs) => [...xs, { ...t, id }]);
      if (t.kind === "ok" || t.kind === "info") {
        setTimeout(() => remove(id), t.kind === "ok" ? 4000 : 6000);
      }
    },
    [remove],
  );
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-host" aria-live="polite" aria-label="Powiadomienia" data-seq={seq}>
        {items.map((t) => (
          <div className="toast" key={t.id} role="status">
            <span className={`ic ${t.kind}`} aria-hidden="true">
              {TOAST_ICON[t.kind]}
            </span>
            <div className="body">
              <strong>{t.title}</strong>
              {t.message ? <p>{t.message}</p> : null}
            </div>
            <button className="close" aria-label="Zamknij" onClick={() => remove(t.id)}>
              <IconX />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
