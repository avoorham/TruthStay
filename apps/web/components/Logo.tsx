interface LogoProps {
  variant?: "full" | "monogram";
  size?: "sm" | "md" | "lg";
}

export function Logo({ variant = "full", size = "md" }: LogoProps) {
  const monogramSizes = { sm: "w-8 h-8 text-sm", md: "w-12 h-12 text-lg", lg: "w-16 h-16 text-2xl" };
  const fullSizes = { sm: "text-xl", md: "text-3xl", lg: "text-5xl" };

  if (variant === "monogram") {
    return (
      <div className={`${monogramSizes[size]} bg-black flex items-center justify-center`}>
        <span className="text-white font-bold">TS</span>
      </div>
    );
  }

  return (
    <div className={fullSizes[size]}>
      <span className="font-bold">Truth</span>
      <span className="italic font-light">Stay</span>
    </div>
  );
}
