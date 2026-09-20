import Link from "next/link";
import {
  createElement,
  type ComponentProps,
  type ComponentPropsWithRef,
  type ElementType,
} from "react";
const cx = (...values: (string | undefined | false)[]) => values.filter(Boolean).join(" ");

export function Button({ className, type, ...props }: ComponentPropsWithRef<"button">) {
  return <button {...props} type={type} className={cx("ui-button", className)} />;
}
export function TabButton(props: ComponentPropsWithRef<"button">) {
  return <Button {...props} className={cx("ui-tab", props.className)} />;
}
export function ToggleButton(props: ComponentPropsWithRef<"button">) {
  return <Button {...props} className={cx("ui-toggle", props.className)} />;
}
type SurfaceTag = "div" | "section" | "article" | "aside" | "li";
type SurfaceProps<T extends SurfaceTag> = { as?: T } & ComponentPropsWithRef<T>;
export function Card<T extends SurfaceTag = "div">({ as, className, ...props }: SurfaceProps<T>) {
  return createElement((as || "div") as ElementType, {
    ...props,
    className: cx("ui-card", className),
  });
}
export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input {...props} className={cx("ui-input", className)} />;
}
export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea {...props} className={cx("ui-textarea", className)} />;
}
export function FieldLabel({ className, ...props }: ComponentPropsWithRef<"label">) {
  return <label {...props} className={cx("ui-label", className)} />;
}
export function NativeSelect({ className, ...props }: ComponentPropsWithRef<"select">) {
  return <select {...props} className={cx("ui-native-select", className)} />;
}
export function Disclosure({ className, ...props }: ComponentPropsWithRef<"details">) {
  return <details {...props} className={cx("ui-disclosure", className)} />;
}
export function DisclosureSummary({ className, ...props }: ComponentPropsWithRef<"summary">) {
  return <summary {...props} className={cx("ui-disclosure-summary", className)} />;
}
export function AppLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} className={cx("ui-link", className)} />;
}
export function Anchor({ className, ...props }: ComponentPropsWithRef<"a">) {
  return <a {...props} className={cx("ui-link", className)} />;
}
export function Progress({ className, ...props }: ComponentPropsWithRef<"progress">) {
  return <progress {...props} className={cx("ui-progress", className)} />;
}
export function Badge({ className, ...props }: ComponentPropsWithRef<"span">) {
  return <span {...props} className={cx("ui-badge", className)} />;
}
export function Status({ className, ...props }: ComponentPropsWithRef<"p">) {
  return <p {...props} className={cx("ui-status", className)} />;
}
