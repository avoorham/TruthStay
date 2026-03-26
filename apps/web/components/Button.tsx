import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-black text-white hover:bg-[#212121]",
    secondary: "bg-[#dadccb] text-black hover:bg-[#c9cbb9]",
    ghost: "bg-transparent text-black border border-black hover:bg-black hover:text-white",
  };

  return (
    <button
      className={`px-6 py-3 font-semibold transition-colors ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
