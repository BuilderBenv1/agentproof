"use client";

export default function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  }[size];

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClass} border-2 border-gray-700 border-t-emerald-400 rounded-full animate-spin`}
      />
    </div>
  );
}
