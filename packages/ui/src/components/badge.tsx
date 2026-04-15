import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-1 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        pending: "bg-amber-100 text-amber-700",
        approved: "bg-teal-100 text-teal-700",
        rejected: "bg-red-100 text-red-700",
        "in-review": "bg-slate-100 text-slate-700",
        completed: "bg-green-100 text-green-700",
      },
    },
    defaultVariants: {
      status: "pending",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, status, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ status }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
