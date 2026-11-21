"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Phone,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/i18n/date-locale";
import { useLocale } from "next-intl";

interface Complaint {
  id: string;
  complaint_number: string;
  department: string;
  department_label: string;
  officer_phone: string;
  citizen_phone: string;
  citizen_name: string;
  description: string;
  media_url?: string | null;
  status: "open" | "in_progress" | "resolved";
  forwarded_to_officer: boolean;
  created_at: string;
  conversation_id?: string;
}

const DEPT_ICONS: Record<string, string> = {
  dept_water: "💧",
  dept_electricity: "💡",
  dept_road: "🛣️",
  dept_clean: "🧹",
};

export default function ComplaintsPage() {
  const { accountId } = useAuth();
  const dateLocale = getDateLocale(useLocale());
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchComplaints = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setComplaints(data as Complaint[]);
    }
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const updateStatus = async (
    id: string,
    newStatus: "open" | "in_progress" | "resolved"
  ) => {
    setUpdatingId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("complaints")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setComplaints((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    }
    setUpdatingId(null);
  };

  const filtered = complaints.filter((c) => {
    const matchesSearch =
      c.complaint_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.citizen_phone.includes(searchTerm) ||
      (c.citizen_name &&
        c.citizen_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.description &&
        c.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ? true : c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalOpen = complaints.filter((c) => c.status === "open").length;
  const totalInProgress = complaints.filter(
    (c) => c.status === "in_progress"
  ).length;
  const totalResolved = complaints.filter(
    (c) => c.status === "resolved"
  ).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight">
              जन शिकायत निवारण प्रणाली
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            गाँव के नागरिकों द्वारा WhatsApp पर दर्ज की गई शिकायतें एवं अधिकारी फॉरवर्डिंग स्थिति
          </p>
        </div>

        <button
          onClick={fetchComplaints}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border bg-card hover:bg-accent transition"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
          />
          रिफ्रेश करें
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card/60 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">कुल शिकायतें</p>
          <p className="text-2xl font-bold mt-1">{complaints.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-sm">
          <p className="text-xs font-medium text-amber-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> नई / खुली (Open)
          </p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalOpen}</p>
        </div>
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 shadow-sm">
          <p className="text-xs font-medium text-blue-500 flex items-center gap-1">
            <ArrowRight className="w-3.5 h-3.5" /> कार्य प्रगति पर
          </p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {totalInProgress}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-sm">
          <p className="text-xs font-medium text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> निस्तारित (Resolved)
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {totalResolved}
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="खोजें (ID, फोन, विवरण...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">सभी स्टेटस</option>
            <option value="open">खुली (Open)</option>
            <option value="in_progress">प्रगति पर (In Progress)</option>
            <option value="resolved">निस्तारित (Resolved)</option>
          </select>
        </div>
      </div>

      {/* Complaints List / Table */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            डेटा लोड हो रहा है...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            कोई शिकायत नहीं मिली।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">शिकायत ID</th>
                  <th className="px-4 py-3">विभाग</th>
                  <th className="px-4 py-3">नागरिक (फोन)</th>
                  <th className="px-4 py-3">शिकायत विवरण</th>
                  <th className="px-4 py-3">फॉरवर्डेड अधिकारी</th>
                  <th className="px-4 py-3">समय</th>
                  <th className="px-4 py-3">स्थिति (Status)</th>
                  <th className="px-4 py-3 text-right">कार्रवाई</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((item) => {
                  const icon = DEPT_ICONS[item.department] || "📋";
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-semibold text-emerald-600">
                        #{item.complaint_number}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary">
                          <span>{icon}</span> {item.department_label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium">{item.citizen_name || "नागरिक"}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {item.citizen_phone}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="truncate text-foreground font-normal">
                          {item.description || "विवरण उपलब्ध नहीं"}
                        </p>
                        {item.media_url && (
                          <a
                            href={item.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-0.5"
                          >
                            📷 फोटो देखें <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="font-mono">+{item.officer_phone}</span>
                        </div>
                        {item.forwarded_to_officer && (
                          <span className="inline-block mt-0.5 text-[10px] text-emerald-600 font-medium">
                            ✅ व्हाट्सएप फॉरवर्डेड
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <select
                          value={item.status}
                          disabled={updatingId === item.id}
                          onChange={(e) =>
                            updateStatus(
                              item.id,
                              e.target.value as "open" | "in_progress" | "resolved"
                            )
                          }
                          className={`text-xs font-medium px-2.5 py-1 rounded-md border focus:outline-none ${
                            item.status === "open"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              : item.status === "in_progress"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          }`}
                        >
                          <option value="open">खुली (Open)</option>
                          <option value="in_progress">प्रगति पर</option>
                          <option value="resolved">निस्तारित</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {item.conversation_id && (
                          <Link
                            href={`/inbox?c=${item.conversation_id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                          >
                            चैट खोलें <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
