import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  // Base styles shared by all variants
  [
    "inline-flex items-center justify-center",
    "rounded-md",
    "text-sm font-medium",
    "min-w-[80px]",
    "transition-colors duration-[100ms]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
    "px-3",
  ],
  {
    variants: {
      variant: {
        primary: "bg-teal-600 text-white hover:bg-teal-500",
        outline:
          "border border-teal-600 text-teal-600 bg-transparent hover:bg-teal-100",
        destructive: "bg-red-500 text-white hover:bg-red-700",
        "destructive-outline":
          "border border-red-500 text-red-500 bg-transparent hover:bg-red-50",
        ghost: "text-slate-700 bg-transparent hover:bg-slate-100",
      },
      size: {
        default: "h-9", // 36px — Toolbox
        lg: "h-10",    // 40px — Website
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
