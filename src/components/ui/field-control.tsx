import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FieldControl({
  icon,
  suffix,
  action,
  children,
  className,
}: {
  icon?: ReactNode;
  suffix?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("field-control", className)}>
      {icon ? <span className="field-control-icon">{icon}</span> : null}
      {children}
      {suffix ? <span className="field-control-suffix">{suffix}</span> : null}
      {action ? <span className="field-control-action">{action}</span> : null}
    </div>
  );
}
