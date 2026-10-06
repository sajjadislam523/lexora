import { cn } from "@/lib/utils";

/** Standard page frame inside the shell: page width, responsive gutters, section rhythm. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-page px-4 py-8 sm:px-6 lg:px-10 lg:py-12", className)}
      {...props}
    />
  );
}
