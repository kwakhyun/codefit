"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

/** Select-only combobox. A styled popover stays above scroll containers and modal dialogs. */
export function Select({
  value,
  onValueChange,
  options,
  label,
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  function close() {
    popup.current?.hidePopover();
  }
  function show() {
    const button = trigger.current,
      list = popup.current;
    if (!button || !list || button.matches(":disabled")) return;
    // Safari does not focus a button on pointer activation. Keep keyboard control on the trigger.
    button.focus({ preventScroll: true });
    const rect = button.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const bottom = below < 180 && above > below;
    Object.assign(list.style, {
      width: `${Math.min(Math.max(rect.width, 190), window.innerWidth - 24)}px`,
      maxHeight: `${Math.min(320, Math.max(80, bottom ? above : below))}px`,
      left: `${Math.max(12, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 190) - 12))}px`,
      top: bottom ? "auto" : `${rect.bottom + 6}px`,
      bottom: bottom ? `${window.innerHeight - rect.top + 6}px` : "auto",
    });
    setActive(selected);
    list.showPopover();
  }
  function choose(index: number) {
    const option = options[index];
    if (option) onValueChange(option.value);
    close();
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const reposition = (event: Event) => {
      if (event.target instanceof Node && popup.current?.contains(event.target)) return;
      popup.current?.hidePopover();
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);
  useEffect(() => {
    if (open) popup.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab") {
      close();
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        show();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        choose(active);
        return;
      }
      setActive((index) =>
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : Math.max(
                0,
                Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)),
              ),
      );
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      search.current = {
        text: (now - search.current.at < 700 ? search.current.text : "") + event.key.toLowerCase(),
        at: now,
      };
      const index = options.findIndex((option) =>
        option.label.toLowerCase().startsWith(search.current.text),
      );
      if (!open) show();
      if (index >= 0) setActive(index);
    }
  }
  return (
    <span className="ui-select">
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        className="ui-select-trigger"
        onKeyDown={onKeyDown}
        onBlur={() => close()}
        onClick={() => (open ? close() : show())}
      >
        <span>{options[selected]?.label}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      <div
        ref={popup}
        id={id}
        role="listbox"
        aria-label={label}
        popover="auto"
        className="ui-select-options"
        onToggle={(event) => setOpen(event.newState === "open")}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={option.value === value}
            data-active={index === active}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}
          >
            <span>{option.label}</span>
            {option.value === value && <Check size={16} aria-hidden="true" />}
          </div>
        ))}
      </div>
    </span>
  );
}
