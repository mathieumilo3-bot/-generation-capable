import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        warning: "border-warning/30 bg-warning-soft text-foreground [&>svg]:text-warning",
        destructive: "border-destructive/30 bg-danger-soft text-foreground [&>svg]:text-destructive",
        success: "border-success/30 bg-success-soft text-foreground [&>svg]:text-success",
        info: "border-info/30 bg-info-soft text-foreground [&>svg]:text-info",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("col-start-2 font-medium", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("col-start-2 text-sm text-muted-foreground [&_p]:leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
