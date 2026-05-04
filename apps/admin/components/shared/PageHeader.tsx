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
    <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-8">
      <div>
        <h1 className="text-2xl font-normal text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 ml-4 shrink-0">{actions}</div>}
    </div>
  );
}
