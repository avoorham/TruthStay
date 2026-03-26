interface LogoProps {
  variant?: 'full' | 'monogram';
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ variant = 'full', size = 'md' }: LogoProps) {
  const sizes = {
    sm: variant === 'monogram' ? 'w-8 h-8 text-sm' : 'text-xl',
    md: variant === 'monogram' ? 'w-12 h-12 text-lg' : 'text-3xl',
    lg: variant === 'monogram' ? 'w-16 h-16 text-2xl' : 'text-5xl',
  };

  if (variant === 'monogram') {
    return (
      <div className={`${sizes[size]} bg-black flex items-center justify-center`}>
        <span className="text-white font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
          TS
        </span>
      </div>
    );
  }

  return (
    <div className={`${sizes[size]}`} style={{ fontFamily: 'Archivo, sans-serif' }}>
      <span className="font-bold">Truth</span>
      <span className="italic font-light">Stay</span>
    </div>
  );
}