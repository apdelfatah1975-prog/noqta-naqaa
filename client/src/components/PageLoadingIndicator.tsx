import { LoaderCircle } from "lucide-react";

type PageLoadingIndicatorProps = {
  label?: string;
  compact?: boolean;
};

export function PageLoadingIndicator({
  label = "جارٍ تحميل البيانات…",
  compact = false,
}: PageLoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={compact
        ? "flex items-center justify-center gap-2 py-4 text-sm font-bold text-teal-700"
        : "flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border border-teal-100 bg-white/80 px-5 py-8 text-center shadow-sm"
      }
      dir="rtl"
    >
      <LoaderCircle className="h-8 w-8 animate-spin text-teal-700" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
