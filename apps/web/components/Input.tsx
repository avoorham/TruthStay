import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-sm font-medium">{label}</label>
      )}
      <input
        className={`w-full px-4 py-3 border border-[#212121] focus:outline-none focus:border-black bg-white ${className}`}
        {...props}
      />
    </div>
  );
}
