"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { LockKeyhole } from "lucide-react";

import { useAppShellData } from "@/components/layout/app-shell-data-provider";

export const DEMO_READ_ONLY_MESSAGE =
  "Mode démonstration : cette action est visible pour présenter le parcours, mais elle ne peut pas modifier les données.";

export function useDemoReadOnly() {
  const { account } = useAppShellData();
  return account?.isDemoWorkspace === true;
}

type DemoButtonAttributes = ButtonHTMLAttributes<HTMLButtonElement> & {
  "data-demo-mutation"?: "submit" | "blocked";
};

type NativeButtonElement = ReactElement<DemoButtonAttributes, "button">;

function guardSubmitControls(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;

    if (child.type === "button") {
      const button = child as NativeButtonElement;
      if ((button.props.type ?? "submit") !== "submit") return child;

      return cloneElement(button, {
        disabled: true,
        "aria-disabled": true,
        "data-demo-mutation": "submit",
        title: DEMO_READ_ONLY_MESSAGE,
        children: (
          <>
            <LockKeyhole className="size-4" aria-hidden="true" />
            {button.props.children}
          </>
        ),
      });
    }

    return child;
  });
}

/**
 * Guards only forms that opt into the shared mutation action area. It does not
 * affect GET forms, filters, search fields, navigation, or ordinary buttons.
 */
export function DemoReadOnlyFormActions({ children }: { children: ReactNode }) {
  const readOnly = useDemoReadOnly();
  const boundaryRef = useRef<HTMLSpanElement>(null);
  const guardedChildren = useMemo(
    () => (readOnly ? guardSubmitControls(children) : children),
    [children, readOnly],
  );

  useEffect(() => {
    if (!readOnly) return;

    const form = boundaryRef.current?.closest("form");
    if (!form) return;

    function preventDemoMutation(event: SubmitEvent) {
      event.preventDefault();
      event.stopPropagation();
    }

    form.addEventListener("submit", preventDemoMutation, true);
    return () => form.removeEventListener("submit", preventDemoMutation, true);
  }, [readOnly]);

  return (
    <span ref={boundaryRef} className="contents" data-demo-form-actions={readOnly ? "read-only" : undefined}>
      {guardedChildren}
    </span>
  );
}

export function DemoMutationButton({
  children,
  disabled = false,
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const readOnly = useDemoReadOnly();

  return (
    <button
      {...props}
      disabled={disabled || readOnly}
      aria-disabled={disabled || readOnly || undefined}
      data-demo-mutation={readOnly ? "blocked" : undefined}
      title={readOnly ? DEMO_READ_ONLY_MESSAGE : title}
    >
      {readOnly ? <LockKeyhole className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
