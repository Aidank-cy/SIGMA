import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-[length:200%_100%] [animation:shimmer_1.4s_ease-in-out_infinite] [background-image:linear-gradient(90deg,rgb(var(--sigma-elevated))_25%,rgb(var(--sigma-surface))_50%,rgb(var(--sigma-elevated))_75%)]",
        className
      )}
    />
  );
}
