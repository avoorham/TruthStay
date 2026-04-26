"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils";

type Partner = {
  id: string;
  name: string;
  type: string;
  region: string | null;
  contact_email: string | null;
  commission_rate: number;
  status: string;
  created_at: string;
  booking_commissions?: { commission_amount: number; status: string }[];
};

export default function PartnersPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "hotel", contact_email: "", region: "", commission_rate: "" });

  async function load() {
    setLoading(true);
    const data = await fetch("/api/admin/partners").then((r) => r.json());
    setPartners(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, commission_rate: Number(form.commission_rate) }),
    });
    setShowForm(false);
    setForm({ name: "", type: "hotel", contact_email: "", region: "", commission_rate: "" });
    load();
  }

  const columns: ColumnDef<Partner, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <button onClick={() => router.push(`/partners/${row.original.id}`)}
          className="text-blue font-medium hover:underline text-left">
          {row.original.name}
        </button>
      ),
    },
    { accessorKey: "type", header: "Type", cell: ({ getValue }) => <span className="text-sm capitalize">{getValue<string>()}</span> },
    { accessorKey: "region", header: "Region", cell: ({ getValue }) => <span className="text-xs text-grey-700">{getValue<string | null>() || "—"}</span> },
    {
      accessorKey: "commission_rate",
      header: "Commission",
      cell: ({ getValue }) => <span className="text-sm font-semibold">{getValue<number>()}%</span>,
    },
    {
      id: "earned",
      header: "Earned",
      accessorFn: (r) => r.booking_commissions?.filter(c => c.status === "paid").reduce((acc, c) => acc + c.commission_amount, 0) ?? 0,
      cell: ({ getValue }) => <span className="text-sm">{formatCurrency(getValue<number>())}</span>,
    },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge value={getValue<string>()} /> },
    { accessorKey: "created_at", header: "Added", cell: ({ getValue }) => <span className="text-xs text-grey-700">{formatDate(getValue<string>())}</span> },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button onClick={() => router.push(`/partners/${row.original.id}`)} className="p-1.5 rounded-lg hover:bg-grey-100 text-grey-700 transition">
          <ExternalLink size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Booking Partners"
        description="Hotels, tour operators, and other booking partners."
        actions={
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">
            <Plus size={14} /> New partner
          </button>
        }
      />

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-grey-300 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-dark text-sm">Add partner</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Name *", key: "name", required: true },
              { label: "Contact email", key: "contact_email" },
              { label: "Region", key: "region" },
              { label: "Commission rate (%) *", key: "commission_rate", type: "number", required: true },
            ].map(({ label, key, type, required }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-grey-700 mb-1">{label}</label>
                <input required={required} type={type || "text"} value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Type *</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue/60">
                {["hotel", "hostel", "villa", "tour_operator", "activity_provider", "restaurant"].map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">Add partner</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-grey-700 px-4 py-2 hover:text-dark">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <div className="text-center py-20 text-grey-500 text-sm">Loading…</div> :
        <DataTable data={partners} columns={columns} searchKey="name" searchPlaceholder="Search partners…" />}
    </div>
  );
}
