"use client";

import type { ButtonHTMLAttributes } from "react";

// A submit button that asks first. Delete has no undo, so it must not be one stray tap.
export function ConfirmButton({
  message,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  return (
    <button
      type="submit"
      {...rest}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
        else onClick?.(e);
      }}
    />
  );
}
