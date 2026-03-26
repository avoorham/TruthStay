interface ActivityChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

export function ActivityChip({ label, selected = false, onClick }: ActivityChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm border transition-colors ${
        selected
          ? "bg-black text-white border-black"
          : "bg-white text-[#212121] border-[#212121] hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}
