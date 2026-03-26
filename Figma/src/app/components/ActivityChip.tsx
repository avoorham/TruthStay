interface ActivityChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

export function ActivityChip({ label, selected = false, onClick }: ActivityChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 border transition-colors ${
        selected 
          ? 'bg-black text-white border-black' 
          : 'bg-white text-black border-[#212121] hover:border-black'
      }`}
      style={{ fontFamily: 'Archivo, sans-serif' }}
    >
      {label}
    </button>
  );
}
