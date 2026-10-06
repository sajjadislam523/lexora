import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const TONES: Record<CalloutTone, { container: string; icon: LucideIcon; label: string }> = {
  info: { container: "bg-info-soft text-info", icon: Info, label: "Note" },
  success: { container: "bg-success-soft text-success", icon: CircleCheck, label: "Success" },
  warning: { container: "bg-warning-soft text-warning", icon: TriangleAlert, label: "Warning" },
  danger: { container: "bg-danger-soft text-danger", icon: CircleAlert, label: "Error" },
};

export type CalloutTone = "info" | "success" | "warning" | "danger";

type CalloutProps = Omit<React.ComponentProps<"div">, "title"> & {
  tone?: CalloutTone;
  title?: string;
};

/**
 * Inline feedback: practice results, audit findings, form-level errors. Not for toasts.
 * Static by default; pass role="alert" or role="status" when it appears in response to an action.
 */
export function Callout({ tone = "info", title, children, className, ...props }: CalloutProps) {
  const { container, icon: Icon, label } = TONES[tone];

  return (
    <div
      data-slot="callout"
      className={cn("flex gap-3 rounded-md px-3.5 py-3", container, className)}
      {...props}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        <p className="type-label">
          <span className="sr-only">{label}: </span>
          {title}
        </p>
        {children ? <div className="type-body text-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
