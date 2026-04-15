import * as React from "react";
import { cn } from "../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // Base
          "flex h-9 w-full rounded-md px-3",
          "text-sm text-slate-900 placeholder:text-slate-500",
          "bg-white",
          // Border
          "border border-slate-200",
          // Focus
          "focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms]",
          // Disabled
          "disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed",
          // Error
          error && "border-2 border-red-500 focus:border-red-500",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
