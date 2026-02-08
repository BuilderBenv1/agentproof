"use client";

interface SkillTagProps {
  skill: string;
  size?: "sm" | "md";
}

export default function SkillTag({ skill, size = "sm" }: SkillTagProps) {
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center ${textSize} font-mono px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full`}
    >
      {skill}
    </span>
  );
}
