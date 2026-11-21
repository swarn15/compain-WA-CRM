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
  Settings,
  Save,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/i18n/date-locale";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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

interface Department {
  id: string;
  name: string;
  icon: string;
  phone: string;
  title: string;
}

const DEFAULT_DEPTS: Department[] = [
  {
    id: "dept_water",
    name: "पेयजल (पानी)",
    icon: "💧",
    title: "जल निगम / हैंडपंप मरम्मत अधिकारी",
    phone: "919452600081",
  },
  {
    id: "dept_electricity",
    name: "बिजली / स्ट्रीट लाइट",
    icon: "💡",
    title: "विद्युत विभाग / लाइनमैन",
    phone: "919005600081",
  },
  {
    id: "dept_road",
    name: "सड़क / नाली मरम्मत",
    icon: "🛣️",
    title: "सड़क व नाली निर्माण अधिकारी",
    phone: "918318928330",
  },
  {
    id: "dept_clean",
    name: "ग्राम सफाई व स्वच्छता",
    icon: "🧹",
    title: "सफाई कर्मचारी / स्वच्छता सुपरवाइजर",
    phone: "918957739959",
  },
];

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

  // Department settings modal state
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPTS);
  const [editDepts, setEditDepts] = useState<Department[]>(DEFAULT_DEPTS);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [savingDepts, setSavingDepts] = useState(false);

  const fetchDepartments = useCallback(async () => {
    if (!accountId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("village_departments")
      .select("*")
      .eq("account_id", accountId);

    if (!error && data && data.length > 0) {
      const merged = DEFAULT_DEPTS.map((def) => {
        const found = data.find((d: Department) => d.id === def.id);
        return found ? { ...def, ...found } : def;
      });
      setDepartments(merged);
      setEditDepts(merged);
    }
  }, [accountId]);

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
    fetchDepartments();
  }, [fetchComplaints, fetchDepartments]);

  const handleOpenDeptModal = () => {
    setEditDepts(departments);
    setShowDeptModal(true);
  };

  const handlePhoneChange = (id: string, newPhone: string) => {
    setEditDepts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, phone: newPhone } : d))
    );
  };

  const handleSaveDepartments = async () => {
    if (!accountId) return;
    setSavingDepts(true);
    const supabase = createClient();

    const updates = editDepts.map((d) => {
      let clean = d.phone.replace(/[^0-9]/g, "");
      if (clean.length === 10) {
        clean = "91" + clean;
      }
      return {
        account_id: accountId,
        id: d.id,
        name: d.name,
        icon: d.icon,
        title: d.title,
        phone: clean,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from("village_departments")
      .upsert(updates, { onConflict: "account_id,id" });

    if (error) {
      console.error("Failed to update departments:", error);
      toast.error("नंबर सुरक्षित करने में त्रुटि: " + error.message);
    } else {
      toast.success("अधिकारी नंबर सफलतापूर्वक अपडेट हो गए!");
      setDepartments(editDepts);
      setShowDeptModal(false);
      fetchDepartments();
    }
    setSavingDepts(false);
  };

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
      toast.success("स्थिति अपडेट हो गई!");
    } else {
      toast.error("स्थिति अपडेट विफल रही");
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchComplaints}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            रिफ्रेश करें
          </Button>

          <Button
            onClick={handleOpenDeptModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm"
          >
            <Settings className="w-4 h-4" />
            अधिकारी नंबर बदलें
          </Button>
        </div>
      </div>

      {/* Departments Overview Cards */}
      <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span>📢</span> वर्तमान शिकायत फॉरवर्डिंग विभाग एवं अधिकारी नंबर
          </h2>
          <button
            onClick={handleOpenDeptModal}
            className="text-xs text-emerald-600 hover:underline font-medium"
          >
            नंबर बदलें ➔
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="p-3 rounded-lg border bg-background flex flex-col justify-between space-y-1 hover:border-emerald-500/50 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{dept.icon}</span>
                <span className="font-semibold text-sm">{dept.name}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {dept.title}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-600 pt-1">
                <Phone className="w-3.5 h-3.5" />
                +{dept.phone}
              </div>
            </div>
          ))}
        </div>
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
                        {item.forwarded_to_officer ? (
                          <span className="inline-block mt-0.5 text-[10px] text-emerald-600 font-medium">
                            ✅ व्हाट्सएप फॉरवर्डेड
                          </span>
                        ) : (
                          <span
                            className="inline-block mt-0.5 text-[10px] text-amber-600 font-medium cursor-help"
                            title="अधिकारी के नंबर से 24 घंटे में कोई मैसेज नहीं आया था इसलिए मेटा ने डिलीवरी रोकी। अधिकारी द्वारा 'Hi' भेजने या टेम्पलेट अप्रूव होने पर यह स्वतः डिलीवर होगा।"
                          >
                            ⚠️ 24h विंडो बंद (चैट शुरू करें)
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

      {/* Officer Numbers Modal */}
      <Dialog
        open={showDeptModal}
        onOpenChange={(open) => !savingDepts && setShowDeptModal(open)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-emerald-600" />
              विभाग एवं अधिकारी WhatsApp नंबर बदलें
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              जब कोई नागरिक शिकायत दर्ज करेगा, तो सिस्टम स्वचालित रूप से इन नंबरों पर शिकायत का विवरण और फोटो भेजेगा।
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editDepts.map((d) => (
              <div
                key={d.id}
                className="p-3 rounded-lg border bg-muted/20 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <span>{d.icon}</span> {d.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {d.title}
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    अधिकारी / कर्मचारी WhatsApp नंबर (देश कोड 91 के साथ):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                      +
                    </span>
                    <input
                      type="text"
                      value={d.phone}
                      onChange={(e) => handlePhoneChange(d.id, e.target.value)}
                      placeholder="91XXXXXXXXXX"
                      className="w-full pl-7 pr-3 py-1.5 text-sm font-mono rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={savingDepts}
              onClick={() => setShowDeptModal(false)}
            >
              रद्द करें
            </Button>
            <Button
              type="button"
              disabled={savingDepts}
              onClick={handleSaveDepartments}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
            >
              {savingDepts ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  सुरक्षित हो रहा है...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  सुरक्षित करें (Save)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
