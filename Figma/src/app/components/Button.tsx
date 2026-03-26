import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  fullWidth = false, 
  children, 
  className = '',
  ...props 
}: ButtonProps) {
  const baseStyles = 'px-6 py-3 font-semibold transition-colors';
  
  const variants = {
    primary: 'bg-black text-white hover:bg-[#212121]',
    secondary: 'bg-[#dadccb] text-black hover:bg-[#c9cbb9]',
    ghost: 'bg-transparent text-black border border-black hover:bg-black hover:text-white',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      style={{ fontFamily: 'Archivo, sans-serif' }}
      {...props}
    >
      {children}
    </button>
  );
}
