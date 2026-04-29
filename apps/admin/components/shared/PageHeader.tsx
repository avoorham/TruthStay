export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-dark tracking-tight">{title}</h1>
        {description && <p className="text-sm text-grey-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4 shrink-0">{actions}</div>}
    </div>
  );
}
