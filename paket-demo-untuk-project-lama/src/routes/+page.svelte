<script lang="ts">
  import { onMount } from "svelte";
  import AnalysisPage from "$lib/components/AnalysisPage.svelte";
  import ImportPage from "$lib/components/ImportPage.svelte";
  import ReconciliationPage from "$lib/components/ReconciliationPage.svelte";
  import MappingPage from "$lib/components/MappingPage.svelte";
  import ForecastPage from "$lib/components/ForecastPage.svelte";
  import AbsorptionPage from "$lib/components/AbsorptionPage.svelte";
  import IntegrationPage from "$lib/components/IntegrationPage.svelte";
  import { countUp } from "$lib/utils/countUp";

  type User = {
    id: string;
    username: string;
    displayName: string;
    role: "pic" | "viewer" | "admin";
    picName: string | null;
  };
  type Job = {
    id: string;
    no: number;
    commitmentItem?: string;
    sourceLastProgress?: string;
    sourceProgressNo?: number | null;
    sourceLastUpdateDate?: string;
    detailProgress?: string;
    sourceMilestones?: {
      code: string;
      label: string;
      value: string;
      date: string;
      stageNo: number;
    }[];
    sourceDetails?: { code: string; label: string; value: string }[];
    sourceIssue?: string;
    sourceAction?: string;
    sourceFollowUpPic?: string;
    sourceDeadline?: string;
    sourceFollowUpStatus?: string;
    sourceRevisionCount?: number | null;
    sourceScsStatus?: string;
    sourceScsSubmissionDate?: string;
    sourceScsApprovedDate?: string;
    sourceScsRemarks?: string;
    grSesPercent?: number | null;
    grSesDate?: string;
    year: number;
    title: string;
    pic: string;
    type: "CAPEX" | "OPEX";
    stages: Record<string, string>;
    vendor: string;
    contractAmountIDR: number;
    startDate: string;
    finishDate: string;
    actualFinish: string;
    guaranteeUntil: string;
    paidPercent: number;
    rkapBudgetUSD: number | null;
    hpsUSD: number;
    rkapBudgetSource?: string;
    rkapBudgetImportedAt?: string | null;
    rkapBudgetReadOnly?: boolean;
    hpsSource?: string;
    hpsReadOnly?: boolean;
    scsDate: string;
    specialStatus: string;
    lastProgress: number;
    lastProgressLabel: string;
    status: string;
    lateDays: number;
    daysInStage: number | null;
    guaranteeStatus: string;
    guaranteeDaysRemaining: number | null;
    scsRequired: boolean;
    scsStatus: string;
    contracted: boolean;
    isActive: boolean;
    fieldSources?: Record<string, string>;
  };
  type Summary = {
    totalJobs: number;
    active: number;
    contracted: number;
    contractPercent: number;
    totalBudgetUSD: number;
    totalContractUSD: number;
    absorptionPercent: number;
    totalContractIDR: number;
    totalPaidIDR: number;
    totalUnpaidIDR: number;
    totalPaidPercent: number;
    waitingScs: number;
    staleProgress: number;
    missingProgress: number;
    statuses: Record<string, number>;
    stagesStats: Record<string, number>;
    stageDurationAverages: {
      label: string;
      averageDays: number;
      count: number;
    }[];
    attention: Job[];
  };
  const STAGES = [
    {
      no: 1,
      key: "kakReceived",
      label: "01 Preparation /Waiting KAK",
      short: "KAK",
      source: "Manual",
    },
    {
      no: 2,
      key: "hpsPrepared",
      label: "02 Preparation HPS",
      short: "HPS",
      source: "Manual",
    },
    {
      no: 3,
      key: "hpsApprovalStarted",
      label: "03 Approval KAK & HPS, PME",
      short: "PME",
      source: "Manual",
    },
    {
      no: 4,
      key: "hpsFinalApproved",
      label: "04 Approval KAK & HPS, GPO-Up",
      short: "GPO-Up",
      source: "Manual",
    },
    {
      no: 5,
      key: "prCreated",
      label: "05 Preparation PR",
      short: "PR",
      source: "SAP",
    },
    {
      no: 6,
      key: "prReleased",
      label: "06 Approval PR",
      short: "PR Rel.",
      source: "SAP",
    },
    {
      no: 7,
      key: "tenderBriefing",
      label: "07 W/ Tender Briefing",
      short: "Briefing",
      source: "IPRO",
    },
    {
      no: 8,
      key: "quotationReceived",
      label: "08 W/ Quotation",
      short: "Quote",
      source: "IPRO",
    },
    {
      no: 9,
      key: "technicalEvaluation",
      label: "09 U/ Process TE",
      short: "TE",
      source: "Manual",
    },
    {
      no: 10,
      key: "teSentToSom",
      label: "10 TE sent to SOM (IPRO)",
      short: "TE SOM",
      source: "IPRO",
    },
    {
      no: 11,
      key: "negotiation",
      label: "11 U/ Negotiation",
      short: "Negosiasi",
      source: "Manual",
    },
    {
      no: 12,
      key: "winnerSelected",
      label: "12 Penetapan Pemenang (IPRO)",
      short: "Pemenang",
      source: "IPRO",
    },
    {
      no: 13,
      key: "contractSigned",
      label: "13 W/ SPK or Contract",
      short: "Kontrak",
      source: "SAP",
    },
    {
      no: 14,
      key: "executionStarted",
      label: "14 U/ Execution/Delivery",
      short: "Eksekusi",
      source: "Manual",
    },
  ];
  const STATUS_META = [
    { label: "Terlambat", color: "#e11d48" },
    { label: "Sedang berjalan", color: "#2563eb" },
    { label: "Belum mulai", color: "#64748b" },
    { label: "Belum kontrak", color: "#94a3b8" },
    { label: "Selesai tepat waktu", color: "#0284c7" },
    { label: "Selesai terlambat", color: "#d97706" },
    { label: "Dibatalkan", color: "#6b7280" },
    { label: "Terminated", color: "#475569" },
    { label: "Retender", color: "#7c3aed" },
  ];
  const PIC_NAMES = ["Eka", "Azwil", "Irfan", "Obed"];
  const SPECIAL_OPTIONS = [
    { value: "normal", label: "Normal" },
    { value: "cancelled", label: "Cancelled/Postpone" },
    { value: "terminated", label: "Terminated" },
    { value: "retender", label: "Retender" },
  ];
  let username = "";
  let password = "";
  let user: User | null = null;
  let jobs: Job[] = [];
  let summary: Summary | null = null;
  let config: {
    asOf: string;
    timeZone: string;
    usdIdrRate: number;
    scsHpsLimitUSD: number;
    source: string;
    sourceConfigured?: boolean;
    progressAttentionDays?: number;
    lastSync: string | null;
    readOnlyFields: string[];
  } | null = null;
  let activeTab = "Ringkasan";
  let dataSourceMode = "dummy";
  let sourceConfigured = true;

  // ── State modul Analisa Penyerapan ──────────────────────────────────────────
  const CAPEX_CAUSES = [
    "Delivery Material",
    "Harga Penawaran > Pagu",
    "Nilai Kontrak < Pagu",
  ];
  const OPEX_CAUSES = [
    "Delivery Material",
    "Proses Pengadaan",
    "Harga Penawaran > Pagu",
    "Nilai Kontrak < Pagu",
    "Perubahan Jadwal Maintenance",
  ];
  type AnalysisRow = {
    jobId: string;
    no: number;
    title: string;
    pic: string;
    tipe: string;
    lastProgress: number;
    lastProgressLabel: string;
    planUsd: number | null;
    planSource: string;
    budgetImportedAt: string | null;
    aktualUsd: number | null;
    aktualSource: string | null;
    aktualPct: number | null;
    nilaiKontrakUsd: number | null;
    nilaiDibayarUsd: number | null;
    nilaiKontrakIDR: number;
    prognosaUsd: number | null;
    prognosaPct: number | null;
    updateProgres: string;
    penyebabKategori: string;
    penyebabDetail: string;
    quickWin: string;
    grupKategori: string;
    analysisUpdatedAt: string | null;
    analysisUpdatedBy: string | null;
    grMonthly: Record<string, number | null> | null;
    grLinkedBy: string | null;
  };
  type AnalysisSummaryItem = {
    no: number;
    item: string;
    qty: number;
    budgetUsd: number;
    pct: number;
  };
  type AnalysisData = {
    rows: AnalysisRow[];
    summary: {
      capex: {
        summary: AnalysisSummaryItem[];
        totalPlan: number;
        totalAktual: number;
        totalPrognosa: number;
        pctAktual: number | null;
        pctPrognosa: number | null;
      };
      opex: {
        summary: AnalysisSummaryItem[];
        totalPlan: number;
        totalAktual: number;
        totalPrognosa: number;
        pctAktual: number | null;
        pctPrognosa: number | null;
      };
    };
    causes: { capex: string[]; opex: string[] };
    aktualFormulaLabel: string;
    usdIdrRate: number;
  };
  let analysisData: AnalysisData | null = null;
  let analysisLoading = false;
  let analysisError = "";
  let analysisTypeFilter: "CAPEX" | "OPEX" | "" = "";
  let editingAnalysisJobId = "";
  let editForm = {
    updateProgres: "",
    penyebabKategori: "",
    penyebabDetail: "",
    quickWin: "",
    prognosaUsd: "",
  };
  let suggestAccepted: Record<string, boolean> = {};

  // ── State Impor Data ─────────────────────────────────────────────────────────
  type ImportType = "budget" | "gr";
  let importType: ImportType = "budget";
  let importStep: "upload" | "preview" | "confirm" = "upload";
  let importFileEl: HTMLInputElement | undefined = undefined;
  let importPreview: any = null;
  let importLoading = false;
  let importError = "";
  let importSuccess = "";

  // ── State Rekonsiliasi ───────────────────────────────────────────────────────
  let reconcileData: any = null;
  let reconcileLoading = false;

  // ── State Atur Pemetaan ──────────────────────────────────────────────────────
  let mappingData: any = null;
  let mappingLoading = false;
  let mappingType: "budget" | "gr" | "analisa" = "budget";
  let asOf = "";
  let searchText = "";
  let picFilter = "";
  let typeFilter = "";
  let statusFilter = "";
  let selectedId = "";
  let loginError = "";
  let pageError = "";
  let toast = "";
  let loading = false;
  let saving = false;
  let syncing = false;
  let importing = false;
  let auditEntries: any[] = [];
  let importInput: HTMLInputElement;
  let lastRefresh = "";
  let filteredJobs: Job[] = [];
  let selectedJob: Job | null = null;
  let canEditSelected = false;
  let totalJobs = 0;
  let totalStatusCount = 0;
  let availablePicNames: string[] = [];
  let sourceGrCount = 0;
  let sourceNoContractCount = 0;
  let picContractStats: {
    pic: string;
    total: number;
    contracted: number;
    percent: number;
  }[] = [];

  $: filteredJobs = jobs.filter((job) => {
    const q = searchText.trim().toLowerCase();
    const matchesSearch =
      !q ||
      `${job.title} ${job.pic} ${job.no} ${job.vendor} ${job.commitmentItem || ""} ${job.detailProgress || ""} ${job.sourceLastProgress || ""}`
        .toLowerCase()
        .includes(q);
    return (
      matchesSearch &&
      (!picFilter || job.pic === picFilter) &&
      (!typeFilter || job.type === typeFilter) &&
      (!statusFilter || job.status === statusFilter)
    );
  });
  $: selectedJob = jobs.find((job) => job.id === selectedId) || null;
  $: canEditSelected = Boolean(selectedJob && isEditable(selectedJob));
  $: totalJobs = summary?.totalJobs || 0;
  $: totalStatusCount = Object.values(summary?.statuses || {}).reduce(
    (a, b) => a + b,
    0,
  );
  $: availablePicNames = Array.from(
    new Set([...PIC_NAMES, ...jobs.map((job) => job.pic).filter(Boolean)]),
  ).sort((a, b) => a.localeCompare(b, "id"));
  $: sourceGrCount = jobs.filter(
    (job) =>
      (job.grSesPercent !== null && job.grSesPercent !== undefined) ||
      Boolean(job.grSesDate),
  ).length;
  $: sourceNoContractCount = jobs.filter(
    (job) =>
      !job.sourceDetails?.some(
        (detail) => detail.code === "A97" && detail.value.trim(),
      ),
  ).length;
  $: picContractStats = availablePicNames.map((pic) => {
    const owned = jobs.filter((job) => job.pic === pic);
    const contracted = owned.filter((job) => job.contracted).length;
    return {
      pic,
      total: owned.length,
      contracted,
      percent: owned.length ? (contracted / owned.length) * 100 : 0,
    };
  });

  onMount(() => {
    let disposed = false;
    let refreshInFlight = false;

    async function initialize() {
      try {
        const response = await fetch("/api/session", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Gagal memeriksa sesi.");
        }

        if (disposed) return;

        if (data.authenticated) {
          user = data.user;
          dataSourceMode = data.source || "dummy";
          sourceConfigured = Boolean(data.sourceConfigured ?? true);
          asOf = jakartaToday();

          await refreshJobs();
        }
      } catch {
        if (!disposed) {
          pageError =
            "Tidak dapat menghubungi server. Pastikan aplikasi sedang berjalan.";
        }
      }
    }

    void initialize();

    const refreshTimer = window.setInterval(async () => {
      if (
        disposed ||
        !user ||
        dataSourceMode !== "google-sheets" ||
        syncing ||
        refreshInFlight
      ) {
        return;
      }

      refreshInFlight = true;

      try {
        await refreshJobs();
      } catch {
        if (!disposed) {
          pageError = "Pembaruan data otomatis gagal. Coba sinkronkan kembali.";
        }
      } finally {
        refreshInFlight = false;
      }
    }, 60_000);

    return () => {
      disposed = true;
      window.clearInterval(refreshTimer);
    };
  });

  function jakartaToday() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values: Record<string, string> = {};
    for (const part of parts) values[part.type] = part.value;
    return `${values.year}-${values.month}-${values.day}`;
  }
  function rupiah(value: number | null | undefined) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value || 0);
  }
  function dollar(value: number | null | undefined) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);
  }
  function number(value: number | null | undefined) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(
      value || 0,
    );
  }
  function dateLabel(value: string | null) {
    if (!value) return "—";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  function statusClass(status: string) {
    return (
      "status-" +
      status
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );
  }
  function getStageSummary(job: Job) {
    const progress = Math.max(0, Math.min(18, Number(job.lastProgress) || 0));

    if (job.specialStatus === "cancelled" || progress === 16) {
      return {
        label: "Dibatalkan",
        detail: "Cancelled / Postpone",
        progress: 0,
        kind: "special",
        meta: "Status khusus",
      };
    }
    if (job.specialStatus === "terminated" || progress === 17) {
      return {
        label: "Terminated",
        detail: "Pekerjaan dihentikan",
        progress: 0,
        kind: "special",
        meta: "Status khusus",
      };
    }
    if (job.specialStatus === "retender" || progress === 18) {
      return {
        label: "Retender",
        detail: "Proses tender diulang",
        progress: 0,
        kind: "special",
        meta: "Status khusus",
      };
    }
    if (progress === 15 || job.actualFinish) {
      return {
        label: "Selesai",
        detail: "Final completion",
        progress: 100,
        kind: "complete",
        meta: "Tahap selesai",
      };
    }
    if (progress === 0) {
      return {
        label: "Belum mulai",
        detail: "Belum ada milestone yang tercatat",
        progress: 0,
        kind: "empty",
        meta: `0 dari ${STAGES.length} tahapan`,
      };
    }

    const currentStage = STAGES.find((stage) => stage.no === progress);
    const percent = Math.round((progress / STAGES.length) * 100);
    return {
      label: currentStage?.short || `Tahap ${progress}`,
      detail: currentStage?.label.replace(/^\d+\s*/, "") || job.lastProgressLabel,
      progress: percent,
      kind: "active",
      meta: `Tahap ${String(progress).padStart(2, "0")} dari ${STAGES.length}`,
    };
  }
  function stageSource(job: Job, stageKey: string) {
    const actualSource =
      job.fieldSources?.[`stages.${stageKey}`] || job.fieldSources?.[stageKey];
    if (actualSource)
      return actualSource === "Manual" && config?.source === "dummy"
        ? "Manual (data dummy)"
        : actualSource;
    const stage = STAGES.find((s) => s.key === stageKey);
    if (config?.source === "dummy") return "Manual (data dummy)";
    return stage?.source || "Manual";
  }
  function isFieldReadOnly(field: string) {
    return Boolean(config?.readOnlyFields?.includes(field));
  }
  function isEditable(job: Job) {
    const assignedPic = (user?.picName || user?.displayName || "")
      .trim()
      .toLowerCase();

    return Boolean(
      dataSourceMode === "dummy" &&
        user?.role === "pic" &&
        assignedPic &&
        assignedPic === job.pic.trim().toLowerCase(),
    );
  }
  function statusCounts(status: string) {
    return summary?.statuses?.[status] || 0;
  }
  function formatSynced(value: string | null | undefined) {
    if (!value) return "Belum ada";
    const date = new Date(value);
    return (
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(date) + " WIB"
    );
  }
  function selectedFilters() {
    const params = new URLSearchParams();
    params.set("q", searchText);
    params.set("pic", picFilter);
    params.set("type", typeFilter);
    params.set("status", statusFilter);
    params.set("asOf", asOf || jakartaToday());
    return params.toString();
  }

  async function handleLogin(event: SubmitEvent) {
    event.preventDefault();
    loginError = "";
    loading = true;
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal masuk.");
      user = data.user;
      password = "";
      asOf = jakartaToday();
      await refreshJobs();
    } catch (err) {
      loginError =
        err instanceof Error
          ? err.message
          : "Gagal masuk. Periksa koneksi server.";
    } finally {
      loading = false;
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* Sesi server akan kedaluwarsa secara otomatis. */
    }
    user = null;
    jobs = [];
    summary = null;
    config = null;
    selectedId = "";
    activeTab = "Ringkasan";
  }

  async function refreshJobs() {
    pageError = "";
    const query = new URLSearchParams();
    if (asOf) query.set("asOf", asOf);
    const response = await fetch(`/api/jobs?${query.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      pageError = data.error || "Data pekerjaan tidak dapat dimuat.";
      return;
    }
    jobs = data.jobs;
    summary = data.summary;
    config = data.config;
    dataSourceMode = data.config.source || dataSourceMode;
    sourceConfigured = Boolean(data.config.sourceConfigured ?? true);
    lastRefresh = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (selectedId && !jobs.some((job) => job.id === selectedId))
      selectedId = "";
  }

  async function changeAsOf() {
    if (!asOf) asOf = jakartaToday();
    await refreshJobs();
  }

  async function savePatch(job: Job, patch: Record<string, unknown>) {
    if (!isEditable(job)) {
      toast = "Anda hanya dapat mengubah pekerjaan milik PIC Anda sendiri.";
      return;
    }
    saving = true;
    pageError = "";
    toast = "";
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Perubahan tidak tersimpan.");
      jobs = jobs.map((entry) => (entry.id === job.id ? data.job : entry));
      const refreshed = await fetch(
        `/api/jobs?asOf=${encodeURIComponent(asOf || jakartaToday())}`,
      );
      const all = await refreshed.json();
      if (refreshed.ok) {
        jobs = all.jobs;
        summary = all.summary;
        config = all.config;
      }
      toast =
        "Tersimpan otomatis. Last Progress dan status dihitung ulang oleh server.";
    } catch (err) {
      toast = err instanceof Error ? err.message : "Perubahan tidak tersimpan.";
      await refreshJobs();
    } finally {
      saving = false;
    }
  }

  async function changeStage(job: Job, key: string, value: string) {
    await savePatch(job, { stages: { [key]: value } });
  }
  async function changeValue(job: Job, key: string, value: string | number) {
    const numeric = [
      "contractAmountIDR",
      "paidPercent",
      "rkapBudgetUSD",
      "hpsUSD",
    ].includes(key);
    await savePatch(job, { [key]: numeric ? Number(value || 0) : value });
  }
  async function changeSpecialStatus(job: Job, value: string) {
    await savePatch(job, { specialStatus: value });
  }

  async function syncNow() {
    syncing = true;
    toast = "";
    pageError = "";
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sinkronisasi gagal.");
      toast = data.message;
      await refreshJobs();
    } catch (err) {
      toast = err instanceof Error ? err.message : "Sinkronisasi gagal.";
    } finally {
      syncing = false;
    }
  }

  function download(format: "csv" | "xlsx") {
    window.location.href = `/api/export?format=${format}&${selectedFilters()}`;
  }
  async function copyForSheets() {
    const sourceColumns =
      dataSourceMode === "google-sheets"
        ? Array.from(
            new Map(
              filteredJobs
                .flatMap((job) => job.sourceDetails || [])
                .map((detail) => [detail.code, detail.label] as const),
            ).entries(),
          ).sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))
        : [];
    const sourceHeaders = sourceColumns.map(
      ([code, label]) => `${code} - ${label}`,
    );
    const sourceRows =
      dataSourceMode === "google-sheets"
        ? filteredJobs.map((job) => [
            ...sourceColumns.map(
              ([code]) =>
                job.sourceDetails?.find((detail) => detail.code === code)
                  ?.value || "",
            ),
            job.lastProgressLabel,
            job.daysInStage ?? "",
            job.status,
            job.detailProgress || "",
          ])
        : [];
    const rows =
      dataSourceMode === "google-sheets"
        ? sourceRows
        : filteredJobs.map((job) => [
            job.no,
            job.year,
            job.type,
            job.pic,
            job.title,
            job.rkapBudgetUSD,
            job.hpsUSD,
            job.scsStatus,
            ...STAGES.map((s) => job.stages[s.key] || ""),
            job.vendor,
            job.contractAmountIDR,
            job.startDate,
            job.finishDate,
            job.actualFinish,
            job.paidPercent,
            job.guaranteeUntil,
            job.lastProgressLabel,
            job.status,
          ]);
    const clean = (value: unknown) => {
      const text = String(value ?? "");
      return /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    };
    const text = [
      dataSourceMode === "google-sheets"
        ? [
            ...sourceHeaders,
            "Last Progress (hasil dashboard)",
            "Hari sejak progres terakhir",
            "Status monitoring",
            "Detail Progress / Remarks",
          ]
        : [
            "No",
            "Year",
            "Tipe",
            "PIC",
            "Pekerjaan",
            "Anggaran RKAP USD",
            "HPS USD",
            "Status SCS",
            ...STAGES.map((s) => s.label),
            "Vendor",
            "Nilai Kontrak IDR",
            "Start",
            "Finish",
            "Actual Finish",
            "% Dibayar",
            "Garansi sampai",
            "Last Progress",
            "Status",
          ],
      ...rows,
    ]
      .map((row) => row.map(clean).join("\t"))
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast = `${filteredJobs.length} baris tersalin. Buka Google Sheets dan tekan Ctrl+V.`;
    } catch {
      toast =
        "Clipboard tidak diizinkan browser. Gunakan Unduh CSV sebagai alternatif.";
    }
  }

  async function openAudit() {
    activeTab = "Audit Log";
    pageError = "";
    try {
      const response = await fetch("/api/audit");
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Audit log tidak dapat dibuka.");
      auditEntries = data.entries;
    } catch (err) {
      pageError =
        err instanceof Error ? err.message : "Audit log tidak dapat dibuka.";
    }
  }

  // ─── Fungsi Analisa Penyerapan ──────────────────────────────────────────────

  function fmtUsd(val: number | null | undefined): string {
    if (val === null || val === undefined) return "—";
    if (val === 0) return "$ 0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  }
  function fmtPct(val: number | null | undefined): string {
    if (val === null || val === undefined) return "—";
    if (val === 0) return "0,0%";
    return `${(val * 100).toFixed(1).replace(".", ",")}%`;
  }
  function pctClass(val: number | null): string {
    if (val === null) return "";
    if (val >= 1) return "pct-over";
    if (val >= 0.7) return "pct-ok";
    return "pct-low";
  }

  async function loadAnalysis() {
    if (analysisLoading) return;
    analysisLoading = true;
    analysisError = "";
    try {
      const res = await fetch("/api/analysis");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat data analisa.");
      analysisData = data;
    } catch (err) {
      analysisError = err instanceof Error ? err.message : "Gagal memuat.";
    } finally {
      analysisLoading = false;
    }
  }

  function openAnalysisEdit(row: AnalysisRow) {
    editingAnalysisJobId = row.jobId;
    editForm = {
      updateProgres: row.updateProgres,
      penyebabKategori: row.penyebabKategori,
      penyebabDetail: row.penyebabDetail,
      quickWin: row.quickWin,
      prognosaUsd: row.prognosaUsd !== null ? String(row.prognosaUsd) : "",
    };
  }

  async function saveAnalysisEdit(jobId: string) {
    try {
      const body: Record<string, unknown> = {
        jobId,
        updateProgres: editForm.updateProgres,
        penyebabKategori: editForm.penyebabKategori,
        penyebabDetail: editForm.penyebabDetail,
        quickWin: editForm.quickWin,
      };
      if (editForm.prognosaUsd !== "")
        body.prognosaUsd = Number(editForm.prognosaUsd);
      const res = await fetch("/api/analysis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");
      toast = "Analisa tersimpan.";
      editingAnalysisJobId = "";
      await loadAnalysis();
    } catch (err) {
      toast = err instanceof Error ? err.message : "Gagal menyimpan.";
    }
  }

  function canEditAnalysis(row: AnalysisRow): boolean {
    if (!user) return false;
    if (user.role === "viewer") return false;
    if (user.role === "pic")
      return user.picName?.toLowerCase() === row.pic.toLowerCase();
    return true;
  }

  function getSuggestion(row: AnalysisRow): string | null {
    if (!row.nilaiKontrakUsd || !row.planUsd) return null;
    if (
      row.nilaiKontrakUsd < row.planUsd &&
      row.penyebabKategori !== "Nilai Kontrak < Pagu"
    ) {
      return "Nilai Kontrak < Pagu";
    }
    return null;
  }

  // ─── Fungsi Impor Data ──────────────────────────────────────────────────────

  async function doImportPreview() {
    if (!importFileEl?.files?.length) {
      importError = "Pilih file terlebih dahulu.";
      return;
    }
    const file = importFileEl.files[0];
    const fname = file.name.toLowerCase();
    if (fname.endsWith(".xlsm") || fname.endsWith(".xlsb")) {
      importError = "Format xlsm/xlsb tidak didukung.";
      return;
    }
    importLoading = true;
    importError = "";
    importPreview = null;
    try {
      const form = new FormData();
      form.set("file", file);
      const endpoint =
        importType === "budget" ? "/api/budget?preview=1" : "/api/gr?preview=1";
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pratinjau gagal.");
      importPreview = data;
      importStep = "preview";
    } catch (err) {
      importError = err instanceof Error ? err.message : "Gagal pratinjau.";
    } finally {
      importLoading = false;
    }
  }

  async function doImportConfirm() {
    if (!importFileEl?.files?.length) return;
    importLoading = true;
    importError = "";
    try {
      const form = new FormData();
      form.set("file", importFileEl.files[0]);
      const endpoint = importType === "budget" ? "/api/budget" : "/api/gr";
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impor gagal.");
      importSuccess = data.message;
      importStep = "upload";
      importPreview = null;
      if (importFileEl) importFileEl.value = "";
      toast = data.message;
      await loadAnalysis();
    } catch (err) {
      importError = err instanceof Error ? err.message : "Impor gagal.";
    } finally {
      importLoading = false;
    }
  }

  // ─── Fungsi Rekonsiliasi ────────────────────────────────────────────────────

  async function loadReconcile() {
    reconcileLoading = true;
    try {
      const res = await fetch("/api/reconcile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal.");
      reconcileData = data;
    } catch {
      /* tampilkan error */
    } finally {
      reconcileLoading = false;
    }
  }

  async function confirmMatch(
    type: "budget" | "gr",
    sourceId: string,
    jobId: string,
  ) {
    await fetch("/api/reconcile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, sourceId, jobId, action: "confirm" }),
    });
    await loadReconcile();
  }

  async function rejectMatch(type: "budget" | "gr", sourceId: string) {
    await fetch("/api/reconcile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, sourceId, jobId: "", action: "reject" }),
    });
    await loadReconcile();
  }

  // ─── Fungsi Atur Pemetaan ───────────────────────────────────────────────────

  async function loadMapping() {
    mappingLoading = true;
    try {
      const res = await fetch("/api/mapping");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal.");
      mappingData = data;
    } catch {
      /* ignore */
    } finally {
      mappingLoading = false;
    }
  }

  async function afterImport() {
    await refreshJobs();
    analysisData = null;
  }

  // ─── Navigasi tab dengan lazy loading ──────────────────────────────────────

  async function switchTab(tab: string) {
    activeTab = tab;
    pageError = "";
    toast = "";
    if (tab === "Audit Log") await openAudit();
  }
</script>

<svelte:head>
  <title>Monitoring RKAP 2026 | PPS</title>
  <meta
    name="description"
    content="Pemantauan progres pekerjaan RKAP 2026 departemen PPS."
  />
</svelte:head>

{#if !user}
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <img
          src="/api/branding/logo"
          alt="Logo INALUM"
          on:error={(event) => ((event.currentTarget as HTMLElement).style.display = "none")}
        />
        <div>
          <span class="brand-small">PT INALUM (PERSERO)</span>
          <span class="brand-unit">DEPARTEMEN PPS · PARITOHAN</span>
        </div>
      </div>
      <div class="login-copy">
        <div class="eyebrow">SISTEM INTERNAL PERUSAHAAN</div>
        <h1>Portal Monitoring</h1>
        <p>
          Masuk untuk memantau progres pekerjaan dan realisasi penyerapan RKAP 2026.
        </p>
      </div>
      <form class="login-form" on:submit={handleLogin}>
        <label class="floating-label">
          <span>Username</span>
          <input
            bind:value={username}
            autocomplete="username"
            required
            maxlength="128"
            placeholder="Masukkan username"
          />
        </label>
        <label class="floating-label">
          <span>Kata Sandi</span>
          <input
            bind:value={password}
            type="password"
            autocomplete="current-password"
            required
            maxlength="1024"
            placeholder="Masukkan kata sandi"
          />
        </label>
        {#if loginError}
          <div class="alert error-alert" role="alert">
            <span>{loginError}</span>
          </div>
        {/if}
        <button
          class="btn primary login-submit"
          type="submit"
          disabled={loading}
        >
          {loading ? "Memverifikasi kredensial…" : "Masuk ke Sistem"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <div class="login-footnote">
        Akses khusus personil Departemen PPS. Seluruh interaksi dan pembaruan data dicatat pada audit log server.
      </div>
    </div>
  </div>
{:else}
  <div class="app-shell">
    <div class="app-frame">
      <!-- Slim Dark Left Sidebar (Matching Primary Visual Reference) -->
      <aside class="app-sidebar" aria-label="Navigasi Samping">
        <div class="sidebar-logo" title="PT INALUM (PERSERO) - PPS">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
          </svg>
        </div>

        <nav class="sidebar-nav">
          <button
            class="sidebar-item"
            class:active={activeTab === "Ringkasan"}
            on:click={() => switchTab("Ringkasan")}
            title="Ringkasan (Overview)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="14" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" />
            </svg>
            <span class="tooltip">Ringkasan</span>
          </button>

          <button
            class="sidebar-item"
            class:active={activeTab === "Daftar Pekerjaan"}
            on:click={() => switchTab("Daftar Pekerjaan")}
            title="Daftar Pekerjaan"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
            <span class="tooltip">Daftar Pekerjaan</span>
          </button>

          <button
            class="sidebar-item"
            class:active={activeTab === "Tabel Master"}
            on:click={() => switchTab("Tabel Master")}
            title="Tabel Master"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3h18v18H3z" />
              <path d="M3 9h18" />
              <path d="M3 15h18" />
              <path d="M9 3v18" />
            </svg>
            <span class="tooltip">Tabel Master</span>
          </button>

          <button
            class="sidebar-item"
            class:active={activeTab === "Penyerapan RKAP" || activeTab === "Analisa Penyerapan" || activeTab === "Prognosa"}
            on:click={() => switchTab(dataSourceMode === "dummy" ? "Analisa Penyerapan" : "Penyerapan RKAP")}
            title="Analisa & Penyerapan"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 20V10" />
              <path d="M12 20V4" />
              <path d="M6 20v-6" />
            </svg>
            <span class="tooltip">Analisa & Penyerapan</span>
          </button>

          {#if user.role === "admin" || user.role === "viewer"}
            <button
              class="sidebar-item"
              class:active={activeTab === "Impor Data" || activeTab === "Rekonsiliasi" || activeTab === "Atur Pemetaan" || activeTab === "Integrasi Data"}
              on:click={() => switchTab(dataSourceMode === "dummy" && user?.role === "admin" ? "Impor Data" : "Integrasi Data")}
              title="Data & Pengaturan"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <span class="tooltip">Data & Integrasi</span>
            </button>

            <button
              class="sidebar-item"
              class:active={activeTab === "Audit Log"}
              on:click={() => switchTab("Audit Log")}
              title="Audit Log"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              <span class="tooltip">Audit Log</span>
            </button>
          {/if}
        </nav>

        <div class="sidebar-footer">
          <button
            class="sidebar-item"
            on:click={logout}
            title="Keluar dari sesi"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span class="tooltip">Keluar</span>
          </button>
        </div>
      </aside>

      <!-- Main Canvas Area -->
      <div class="app-main">
        <!-- Top Navigation Header -->
        <header class="app-topbar">
          <div class="topbar-left">
            <h1 class="topbar-title">
              {activeTab === "Ringkasan" ? "Overview" : activeTab}
            </h1>
            <p class="topbar-subtitle">
              Departemen PPS · PT INALUM (PERSERO) · Data per {dateLabel(asOf)}
            </p>
          </div>

          <div class="topbar-right">
            <!-- As of Date Simulator Pill -->
            <label class="asof-pill" title="Ubah tanggal simulasi">
              <span>Per tanggal:</span>
              <input
                type="date"
                bind:value={asOf}
                on:change={changeAsOf}
                aria-label="Tanggal simulasi"
              />
            </label>

            {#if user.role === "admin" || user.role === "viewer"}
              <button
                class="btn outline small"
                on:click={syncNow}
                disabled={syncing}
                title="Sinkronisasi data"
              >
                {syncing ? "Menyinkronkan…" : "Sinkron"}
              </button>
            {/if}

            {#if summary && (summary.attention.length > 0 || summary.waitingScs > 0)}
              <button
                class="topbar-control-btn"
                aria-label="Pemberitahuan perhatian dan SCS"
                title={`${summary.attention.length} pekerjaan butuh perhatian, ${summary.waitingScs} menunggu SCS`}
                on:click={() => { activeTab = "Daftar Pekerjaan"; }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span class="notification-dot"></span>
              </button>
            {/if}

            <div class="user-profile-pill">
              <span class="profile-avatar">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
              <div class="profile-info">
                <span class="profile-name">{user.displayName}</span>
                <span class="profile-role">
                  {user.role === "viewer" ? "Viewer" : user.role === "admin" ? "Admin" : `PIC ${user.picName}`}
                </span>
              </div>
            </div>
          </div>
        </header>

        <!-- Sub-Navigation for multi-tab sections -->
        {#if activeTab === "Penyerapan RKAP" || activeTab === "Analisa Penyerapan" || activeTab === "Prognosa"}
          <nav class="subnav-tabs" aria-label="Sub navigasi analisa">
            <button
              class="subnav-tab"
              class:active={activeTab === "Penyerapan RKAP"}
              on:click={() => switchTab("Penyerapan RKAP")}
            >
              Penyerapan RKAP
            </button>
            {#if dataSourceMode === "dummy"}
              <button
                class="subnav-tab"
                class:active={activeTab === "Analisa Penyerapan"}
                on:click={() => switchTab("Analisa Penyerapan")}
              >
                Analisa Penyerapan
              </button>
              <button
                class="subnav-tab"
                class:active={activeTab === "Prognosa"}
                on:click={() => switchTab("Prognosa")}
              >
                Prognosa
              </button>
            {/if}
          </nav>
        {:else if activeTab === "Impor Data" || activeTab === "Rekonsiliasi" || activeTab === "Atur Pemetaan" || activeTab === "Integrasi Data"}
          <nav class="subnav-tabs" aria-label="Sub navigasi data">
            {#if dataSourceMode === "dummy" && (user.role === "admin" || user.role === "viewer")}
              <button
                class="subnav-tab"
                class:active={activeTab === "Impor Data"}
                on:click={() => switchTab("Impor Data")}
              >
                Impor Data
              </button>
            {/if}
            {#if dataSourceMode === "dummy" && user.role === "admin"}
              <button
                class="subnav-tab"
                class:active={activeTab === "Rekonsiliasi"}
                on:click={() => switchTab("Rekonsiliasi")}
              >
                Rekonsiliasi
              </button>
              <button
                class="subnav-tab"
                class:active={activeTab === "Atur Pemetaan"}
                on:click={() => switchTab("Atur Pemetaan")}
              >
                Atur Pemetaan
              </button>
            {/if}
            <button
              class="subnav-tab"
              class:active={activeTab === "Integrasi Data"}
              on:click={() => switchTab("Integrasi Data")}
            >
              Integrasi Data
            </button>
          </nav>
        {/if}

        <main class="page-content">
          {#if pageError}<div class="alert error-alert global-alert" role="alert">
              {pageError}
            </div>{/if}
          {#if toast}<div class="alert toast-alert" role="status">
              {toast}<button aria-label="Tutup pesan" on:click={() => (toast = "")}>×</button>
            </div>{/if}

          {#if activeTab === "Ringkasan"}
            {#if summary}
              <!-- Top KPI Grid: Portfolio featured card + 3 Tinted Cards (Animated Numbers) -->
              <section class="stats-grid" aria-label="Ringkasan Statistik Utama">
                <!-- 1. Portfolio Featured Wide Card -->
                <article class="card-portfolio">
                  <div class="portfolio-header">
                    <div>
                      <span class="portfolio-badge">Total Anggaran RKAP</span>
                      <div class="portfolio-amount">
                        <span use:countUp={{ value: summary.totalBudgetUSD, format: "dollar" }}>—</span>
                      </div>
                      <span class="portfolio-sub">Portfolio Pagu 2026 · {summary.totalJobs} Pekerjaan Terdaftar</span>
                    </div>
                    <div class="portfolio-floating-pill" title="Realisasi penyerapan anggaran">
                      <span>{number(summary.absorptionPercent)}% Terkontrak</span>
                    </div>
                  </div>

                  <!-- SVG Sparkline Area Chart -->
                  <div class="portfolio-sparkline" aria-hidden="true">
                    <svg viewBox="0 0 300 60" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="budgetGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2" />
                          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0 45 Q 40 38, 80 40 T 160 30 T 220 35 T 260 22 L 300 18 L 300 60 L 0 60 Z"
                        fill="url(#budgetGrad)"
                      />
                      <path
                        d="M 0 45 Q 40 38, 80 40 T 160 30 T 220 35 T 260 22 L 300 18"
                        fill="none"
                        stroke="#2563eb"
                        stroke-width="2.5"
                        stroke-linecap="round"
                      />
                      <circle cx="260" cy="22" r="4" fill="#2563eb" />
                    </svg>
                  </div>

                  <div class="portfolio-time-filters">
                    <span class="portfolio-time-btn active">Semua</span>
                    <span class="portfolio-time-btn">CAPEX</span>
                    <span class="portfolio-time-btn">OPEX</span>
                    <div style="flex:1"></div>
                    <span style="font-size: 11px; color: var(--text-muted);">
                      {dollar(summary.totalContractUSD)} sudah dikontrakkan
                    </span>
                  </div>
                </article>

                <!-- 2. Lavender Tint Card: Sudah Dikontrakkan -->
                <article class="card-tinted lavender">
                  <div class="tinted-top">
                    <h3 class="tinted-title">Sudah Kontrak</h3>
                    <span class="tinted-badge">{number(summary.contractPercent)}%</span>
                  </div>
                  <div>
                    <div class="tinted-val-primary">
                      <span use:countUp={{ value: summary.totalContractUSD, format: "dollar" }}>—</span>
                    </div>
                    <p class="tinted-val-secondary">
                      {summary.contracted} dari {summary.totalJobs} berkontrak
                    </p>
                  </div>
                  <div class="tinted-bottom">
                    <div class="tinted-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                      </svg>
                    </div>
                    <span style="font-size: 11px; font-weight: 600; color: #6b5fb5;">
                      {rupiah(summary.totalContractIDR)}
                    </span>
                  </div>
                </article>

                <!-- 3. Soft Slate-Blue Tint Card: Sudah Dibayar (NO GREEN) -->
                <article class="card-tinted slate">
                  <div class="tinted-top">
                    <h3 class="tinted-title">Sudah Dibayar</h3>
                    <span class="tinted-badge">{number(summary.totalPaidPercent)}%</span>
                  </div>
                  <div>
                    <div class="tinted-val-primary">
                      <span use:countUp={{ value: summary.totalPaidIDR, format: "rupiah" }}>—</span>
                    </div>
                    <p class="tinted-val-secondary">
                      Realisasi pembayaran vendor
                    </p>
                  </div>
                  <div class="tinted-bottom">
                    <div class="tinted-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                    </div>
                    <span style="font-size: 11px; font-weight: 600; color: #475569;">
                      {rupiah(summary.totalUnpaidIDR)} sisa
                    </span>
                  </div>
                </article>

                <!-- 4. Warm Sand Tint Card: Pekerjaan Aktif -->
                <article class="card-tinted sand">
                  <div class="tinted-top">
                    <h3 class="tinted-title">Pekerjaan Aktif</h3>
                    <span class="tinted-badge">{summary.totalJobs} Total</span>
                  </div>
                  <div>
                    <div class="tinted-val-primary">
                      <span use:countUp={{ value: summary.active, format: "integer" }}>—</span>
                      <small style="font-size: 13px; font-weight: 600; color: var(--text-muted);">aktif</small>
                    </div>
                    <p class="tinted-val-secondary">
                      {summary.staleProgress} tanpa milestone baru
                    </p>
                  </div>
                  <div class="tinted-bottom">
                    <div class="tinted-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <span style="font-size: 11px; font-weight: 600; color: #b45309;">
                      {summary.waitingScs} Menunggu SCS
                    </span>
                  </div>
                </article>
              </section>

              <!-- Two-Column Balanced Bottom Content -->
              <div class="dashboard-columns">
                <!-- Left Column: Recent Jobs & Attention List -->
                <div class="column-main">
                  <div class="content-section-head">
                    <h2 class="section-headline">Perlu Perhatian & Update Terkini</h2>
                    <div class="section-filter-group">
                      <button
                        class="filter-pill-btn"
                        on:click={() => { activeTab = "Daftar Pekerjaan"; }}
                      >
                        <span>Buka Semua ({summary.attention.length})</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div class="content-table-card">
                    {#if summary.attention.length}
                      <table class="table-clean">
                        <thead>
                          <tr>
                            <th>Pekerjaan</th>
                            <th>PIC</th>
                            <th>Last Progress</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each summary.attention.slice(0, 7) as job}
                            <tr
                              style="cursor: pointer;"
                              on:click={() => {
                                selectedId = job.id;
                                activeTab = "Daftar Pekerjaan";
                              }}
                            >
                              <td>
                                <div class="job-cell-title">
                                  <div class="job-icon-box">
                                    {job.no}
                                  </div>
                                  <div>
                                    <span class="job-title-text" title={job.title}>{job.title}</span>
                                    <span class="job-sub-text">{job.type} · Finish {dateLabel(job.finishDate)}</span>
                                  </div>
                                </div>
                              </td>
                              <td style="font-weight: 600;">{job.pic}</td>
                              <td>
                                <span style="font-weight: 500; font-size: 11px;">{job.lastProgressLabel}</span>
                              </td>
                              <td>
                                <span class={`status-tag ${statusClass(job.status)}`}>
                                  {job.status}{job.lateDays ? ` +${job.lateDays}h` : ''}
                                </span>
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    {:else}
                      <div style="padding: 36px; text-align: center; color: var(--text-muted); font-size: 13px;">
                        Tidak ada pekerjaan yang memenuhi kriteria perhatian saat ini.
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Right Column: Dark Callout Card + Status & Stage Breakdown -->
                <div class="column-side">
                  <!-- Coinview Earn style dark card -->
                  <article class="card-dark-callout">
                    <span class="callout-badge">SISTEM MONITORING RKAP</span>
                    <h3>
                      Ringkasan <span class="highlight-pill">Eksekutif</span> PPS
                    </h3>
                    <p>
                      {summary.waitingScs} pekerjaan menunggu verifikasi SCS dan {summary.staleProgress} pekerjaan belum ada update ≥ {config?.progressAttentionDays || 30} hari.
                    </p>
                    <button
                      class="callout-btn"
                      on:click={() => { activeTab = "Daftar Pekerjaan"; }}
                    >
                      Lihat Pekerjaan
                      <span aria-hidden="true">→</span>
                    </button>
                    <!-- Decorative abstract wireframe lines -->
                    <svg class="callout-wires" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                      <path d="M10 90 Q 50 10, 90 90" stroke-width="1.5" />
                      <path d="M20 90 Q 60 20, 95 85" stroke-width="1.5" />
                      <path d="M30 90 Q 70 30, 100 80" stroke-width="1.5" />
                    </svg>
                  </article>

                  <!-- Status Distribution Card -->
                  <div class="summary-card">
                    <div class="summary-card-head">
                      <h4>Distribusi Status Pekerjaan</h4>
                      <span>{totalStatusCount} Total</span>
                    </div>
                    <div class="progress-list">
                      {#each STATUS_META as meta}
                        {#if statusCounts(meta.label) > 0}
                          <div class="progress-row">
                            <div class="progress-row-label">
                              <span>{meta.label}</span>
                              <span>{statusCounts(meta.label)}</span>
                            </div>
                            <div class="progress-track-sleek">
                              <div
                                class="progress-fill-sleek"
                                style={`width: ${totalJobs ? (statusCounts(meta.label) / totalJobs) * 100 : 0}%; background: ${meta.color};`}
                              ></div>
                            </div>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  </div>

                  <!-- PIC Workload Card -->
                  <div class="summary-card">
                    <div class="summary-card-head">
                      <h4>Beban Kerja per PIC</h4>
                      <span>Kontrak Selesai</span>
                    </div>
                    <div class="progress-list">
                      {#each picContractStats as stat}
                        <div class="progress-row">
                          <div class="progress-row-label">
                            <span>{stat.pic}</span>
                            <span>{stat.contracted} / {stat.total}</span>
                          </div>
                          <div class="progress-track-sleek">
                            <div
                              class="progress-fill-sleek"
                              style={`width: ${stat.percent}%; background: #475569;`}
                            ></div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            {/if}
      {:else if activeTab === "Daftar Pekerjaan"}
        <section class="page-heading">
          <div>
            <div class="eyebrow">MONITORING DETAIL</div>
            <h1>Daftar Pekerjaan</h1>
            <p>
              Pilih pekerjaan untuk melihat milestone, tanggal, dan catatan
              progres dari sumber monitoring.
            </p>
          </div>
          {#if user.role === "admin" || user.role === "viewer"}<button
              class="btn outline"
              on:click={syncNow}
              disabled={syncing}
              >{syncing ? "Menyinkronkan…" : "Sinkron sekarang"}</button
            >{/if}
        </section>
        <section class="status-distribution" aria-label="Proporsi status">
          {#each STATUS_META as meta}
            {#if statusCounts(meta.label) > 0}<button
                aria-label={`${meta.label}: ${statusCounts(meta.label)} pekerjaan`}
                title={`${meta.label}: ${statusCounts(meta.label)} pekerjaan`}
                on:click={() =>
                  (statusFilter =
                    statusFilter === meta.label ? "" : meta.label)}
                class:chosen={statusFilter === meta.label}
                style={`--status-color:${meta.color};flex:${statusCounts(meta.label)}`}
              ></button>{/if}
          {/each}
        </section>
        <div class="legend-row">
          {#each STATUS_META as meta}<button
              class:chosen={statusFilter === meta.label}
              on:click={() =>
                (statusFilter = statusFilter === meta.label ? "" : meta.label)}
              ><i style={`background:${meta.color}`}></i>{meta.label}<b
                >{statusCounts(meta.label)}</b
              ></button
            >{/each}
        </div>
        <section class="filter-toolbar">
          <label class="search-control"
            ><span aria-hidden="true">⌕</span><input
              bind:value={searchText}
              placeholder="Cari pekerjaan, PIC, vendor…"
              aria-label="Cari pekerjaan"
            /></label
          ><label class="filter-control"
            ><span>PIC</span><select bind:value={picFilter}
              ><option value="">Semua PIC</option
              >{#each availablePicNames as pic}<option value={pic}>{pic}</option
                >{/each}</select
            ></label
          ><label class="filter-control"
            ><span>Tipe</span><select bind:value={typeFilter}
              ><option value="">CAPEX & OPEX</option><option value="CAPEX"
                >CAPEX</option
              ><option value="OPEX">OPEX</option></select
            ></label
          >
          <div class="export-actions">
            <button class="btn primary small" on:click={() => download("xlsx")}
              >Unduh Excel</button
            ><button class="btn outline small" on:click={() => download("csv")}
              >Unduh CSV</button
            ><button class="btn outline small" on:click={copyForSheets}
              >Salin untuk Google Sheets</button
            >
          </div>
        </section>
        <div class:has-detail={Boolean(selectedId)} class="jobs-layout">
          <section class="panel jobs-panel">
            <div class="table-topline">
              <b>{filteredJobs.length} pekerjaan</b><span
                >{lastRefresh ? `Diperbarui ${lastRefresh}` : ""}</span
              >
            </div>
            <div class="table-wrap jobs-table-wrap">
              <table class="jobs-table">
                <thead
                  ><tr
                    ><th>No</th><th>Pekerjaan / Last Progress</th><th>PIC</th
                    ><th>Tipe</th><th>Progres tahapan</th><th>Finish</th
                    ><th>Status</th><th>Sejak milestone / update</th><th
                      >Garansi</th
                    ></tr
                  ></thead
                ><tbody>
                  {#each filteredJobs as job, rowIndex (job.id)}
                    {@const stageSummary = getStageSummary(job)}
                    <tr
                      class:row-selected={job.id === selectedId}
                      role="button"
                      tabindex="0"
                      on:click={() =>
                        (selectedId = selectedId === job.id ? "" : job.id)}
                      on:keydown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectedId = selectedId === job.id ? "" : job.id;
                        }
                      }}
                    >
                      <td class="no-cell">{rowIndex + 1}</td><td
                        class="job-title-cell"
                        ><b>{job.title}</b><span>{job.lastProgressLabel}</span
                        ></td
                      ><td>{job.pic}</td><td
                        ><span
                          class={`type-pill type-${job.type.toLowerCase()}`}
                          >{job.type}</span
                        ></td
                      >
                      <td>
                        <div
                          class={`stage-summary stage-summary-${stageSummary.kind}`}
                          aria-label={`${stageSummary.label}. ${stageSummary.detail}`}
                          title={stageSummary.detail}
                        >
                          <div class="stage-summary-heading">
                            <strong>{stageSummary.label}</strong>
                            <span>{stageSummary.meta}</span>
                          </div>
                          <small>{stageSummary.detail}</small>
                          {#if stageSummary.kind !== "special"}
                            <div
                              class="stage-progress-track"
                              role="progressbar"
                              aria-label="Progres tahapan pekerjaan"
                              aria-valuemin="0"
                              aria-valuemax="100"
                              aria-valuenow={stageSummary.progress}
                            >
                              <span style={`width: ${stageSummary.progress}%`}></span>
                            </div>
                          {/if}
                        </div>
                      </td>
                      <td>{dateLabel(job.finishDate)}</td><td
                        ><span class={`status-pill ${statusClass(job.status)}`}
                          >{job.status}{job.lateDays
                            ? ` +${job.lateDays} hari`
                            : ""}</span
                        ></td
                      ><td
                        >{job.daysInStage === null
                          ? "—"
                          : `${job.daysInStage} hari`}</td
                      ><td
                        ><span
                          class={`guarantee-text ${job.guaranteeStatus === "Berakhir" ? "expired" : job.guaranteeStatus === "Segera habis" ? "warning" : ""}`}
                          >{job.guaranteeStatus}</span
                        ></td
                      >
                    </tr>
                  {/each}
                  {#if !filteredJobs.length}<tr
                      ><td colspan="9"
                        ><div class="empty-state">
                          Tidak ada pekerjaan yang sesuai dengan filter.
                        </div></td
                      ></tr
                    >{/if}
                </tbody>
              </table>
            </div>
            <div class="table-footnote">
              Klik satu baris untuk membuka rincian pekerjaan. Pada mode Google
              Sheets, data adalah hanya-baca dan Last Progress mengikuti kolom
              sumber jika tersedia.
            </div>
          </section>
          {#if selectedJob}
            <aside class="panel detail-panel">
              <div class={`detail-heading ${statusClass(selectedJob.status)}`}>
                <button
                  class="detail-close"
                  aria-label="Tutup detail"
                  on:click={() => (selectedId = "")}>×</button
                ><span class="eyebrow">PEKERJAAN NO. {selectedJob.no}</span>
                <h2>{selectedJob.title}</h2>
                <div class="detail-stage">{selectedJob.lastProgressLabel}</div>
                <span class={`status-pill ${statusClass(selectedJob.status)}`}
                  >{selectedJob.status}{selectedJob.lateDays
                    ? ` · terlambat ${selectedJob.lateDays} hari`
                    : ""}</span
                >
                <div class="detail-mini-grid">
                  <div>
                    <small
                      >{dataSourceMode === "google-sheets"
                        ? "Sejak progres terakhir"
                        : "Lama di tahap"}</small
                    ><b
                      >{selectedJob.daysInStage === null
                        ? "—"
                        : `${selectedJob.daysInStage} hari`}</b
                    >
                  </div>
                  <div>
                    <small>Garansi</small><b>{selectedJob.guaranteeStatus}</b>
                  </div>
                </div>
              </div>
              <div class="detail-body">
                {#if !canEditSelected}<div class="readonly-note">
                    {dataSourceMode === "google-sheets"
                      ? "Data Google Sheets saat ini bersifat hanya-baca di website. Perubahan harus dilakukan pada spreadsheet sumber yang memiliki akses edit."
                      : user?.role !== "pic"
                        ? "Hanya akun PIC yang dapat mengubah pekerjaan melalui website."
                        : `Pekerjaan ini milik PIC ${selectedJob.pic}. Anda hanya dapat mengubah pekerjaan yang ditugaskan kepada akun Anda.`}
                  </div>{:else}<div class="edit-note">
                    Perubahan tanggal tersimpan otomatis. <span
                      >{saving
                        ? "Menyimpan…"
                        : "Tidak perlu klik Simpan."}</span
                    >
                  </div>{/if}
                {#if dataSourceMode === "google-sheets"}
                  <section class="detail-section source-progress-section">
                    <h3>Detail progres dari Excel</h3>
                    <div class="source-progress-facts">
                      <div>
                        <span>Last Progress</span><b
                          >{selectedJob.sourceLastProgress ||
                            selectedJob.lastProgressLabel ||
                            "Belum tersedia"}</b
                        >
                      </div>
                      <div>
                        <span>Commitment Item</span><b
                          >{selectedJob.commitmentItem ||
                            "— (perlu verifikasi carry-over)"}</b
                        >
                      </div>
                      <div>
                        <span>GR/SES (%)</span><b
                          >{selectedJob.grSesPercent === null ||
                          selectedJob.grSesPercent === undefined
                            ? "—"
                            : `${number(selectedJob.grSesPercent)}%`}</b
                        >
                      </div>
                      <div>
                        <span>Tanggal GR/SES</span><b
                          >{dateLabel(selectedJob.grSesDate || "")}</b
                        >
                      </div>
                      <div>
                        <span>Tanggal milestone terakhir / update progres</span
                        ><b
                          >{dateLabel(
                            selectedJob.sourceLastUpdateDate || "",
                          )}</b
                        >
                      </div>
                    </div>
                    {#if !selectedJob.commitmentItem}
                      <div class="source-schema-note">
                        Commitment Item belum tercatat di sumber. Konfirmasi
                        apakah pekerjaan ini carry-over dari tahun sebelumnya;
                        jika bukan, data commitment perlu diverifikasi.
                      </div>
                    {/if}
                    <div class="source-followup-grid">
                      <div>
                        <span>Kendala / Root Cause</span>
                        <p>
                          {selectedJob.sourceIssue ||
                            "Belum dicatat pada kolom khusus."}
                        </p>
                      </div>
                      <div>
                        <span>Tindak lanjut</span>
                        <p>
                          {selectedJob.sourceAction ||
                            "Belum dicatat pada kolom khusus."}
                        </p>
                      </div>
                      <div>
                        <span>PIC tindak lanjut</span><b
                          >{selectedJob.sourceFollowUpPic ||
                            "Belum ditentukan"}</b
                        >
                      </div>
                      <div>
                        <span>Deadline tindak lanjut</span><b
                          >{dateLabel(selectedJob.sourceDeadline || "")}</b
                        >
                      </div>
                      <div>
                        <span>Status tindak lanjut</span><b
                          >{selectedJob.sourceFollowUpStatus ||
                            "Belum dicatat"}</b
                        >
                      </div>
                      <div>
                        <span>Jumlah revisi</span><b
                          >{selectedJob.sourceRevisionCount === null ||
                          selectedJob.sourceRevisionCount === undefined
                            ? "—"
                            : number(selectedJob.sourceRevisionCount)}</b
                        >
                      </div>
                      <div>
                        <span>Status SCS</span><b
                          >{selectedJob.sourceScsStatus ||
                            "Belum tersedia di sumber"}</b
                        >
                      </div>
                      <div>
                        <span>Tanggal pengajuan SCS</span><b
                          >{dateLabel(
                            selectedJob.sourceScsSubmissionDate || "",
                          )}</b
                        >
                      </div>
                      <div>
                        <span>Tanggal persetujuan SCS</span><b
                          >{dateLabel(
                            selectedJob.sourceScsApprovedDate || "",
                          )}</b
                        >
                      </div>
                    </div>
                    {#if selectedJob.sourceScsRemarks}
                      <div class="source-remarks">
                        <span>Catatan SCS</span>
                        <p>{selectedJob.sourceScsRemarks}</p>
                      </div>
                    {/if}
                    {#if !selectedJob.sourceIssue && !selectedJob.sourceAction && !selectedJob.sourceDeadline && !selectedJob.sourceScsStatus && !selectedJob.sourceScsSubmissionDate && !selectedJob.sourceScsApprovedDate && !selectedJob.sourceScsRemarks}
                      <div class="source-schema-note">
                        <strong>Catatan sumber:</strong> file monitoring lama belum
                        menyediakan kendala, tindak lanjut, deadline, atau rincian
                        SCS dalam kolom khusus yang terbaca. Untuk menampilkan data
                        itu secara terstruktur, mentor dapat menambahkan kolom opsional
                        A111–A121 setelah A110 (atau gunakan kolom remarks yang sudah
                        tersedia jika belum ingin mengubah sheet).
                      </div>
                    {/if}
                    <div class="source-remarks">
                      <span>Detail Progress of Work / Remarks</span>
                      <p>
                        {selectedJob.detailProgress ||
                          "Belum ada catatan di sumber monitoring."}
                      </p>
                    </div>
                    {#if selectedJob.sourceMilestones?.length}
                      <h4>Riwayat milestone yang terisi</h4>
                      <div class="source-milestone-table-wrap">
                        <table class="source-milestone-table">
                          <thead
                            ><tr
                              ><th>Proses</th><th>Kode Excel</th><th
                                >Nilai / tanggal</th
                              ></tr
                            ></thead
                          ><tbody>
                            {#each selectedJob.sourceMilestones as milestone (milestone.code)}
                              <tr
                                ><td>{milestone.label}</td><td
                                  >{milestone.code}</td
                                ><td>{milestone.value}</td></tr
                              >
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {:else}
                      <p class="helper-text">
                        Belum ada milestone yang terisi untuk pekerjaan ini.
                      </p>
                    {/if}
                  </section>
                  <details class="source-raw-details">
                    <summary
                      >Semua kolom Excel yang terisi ({selectedJob.sourceDetails
                        ?.length || 0})</summary
                    >
                    {#if selectedJob.sourceDetails?.length}
                      <div class="source-milestone-table-wrap">
                        <table class="source-milestone-table">
                          <thead
                            ><tr
                              ><th>Kolom</th><th>Field</th><th>Nilai sumber</th
                              ></tr
                            ></thead
                          ><tbody>
                            {#each selectedJob.sourceDetails as detail (detail.code)}
                              <tr
                                ><td>{detail.code}</td><td>{detail.label}</td
                                ><td>{detail.value}</td></tr
                              >
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {:else}
                      <p class="helper-text">
                        Tidak ada nilai terisi pada baris sumber ini.
                      </p>
                    {/if}
                  </details>
                {:else}
                  <section class="detail-section">
                    <h3>Identitas pekerjaan</h3>
                    <div class="field-grid">
                      <label>No<input disabled value={selectedJob.no} /></label
                      ><label
                        >Tahun<input disabled value={selectedJob.year} /></label
                      ><label
                        >PIC<input disabled value={selectedJob.pic} /></label
                      ><label
                        >Tipe<input disabled value={selectedJob.type} /></label
                      >{#if selectedJob.commitmentItem}<label class="wide-field"
                          >Commitment Item<input
                            disabled
                            value={selectedJob.commitmentItem}
                          /></label
                        >{/if}
                    </div>
                  </section>
                  <section class="detail-section">
                    <h3>KAK dan HPS</h3>
                    <div class="date-field-list">
                      {#each STAGES.slice(0, 4) as stage}<label
                          class="date-field"
                          ><span
                            >{stage.label}<small
                              >Sumber: {stageSource(
                                selectedJob!,
                                stage.key,
                              )}</small
                            ></span
                          ><input
                            type="date"
                            value={selectedJob.stages[stage.key] || ""}
                            disabled={!canEditSelected ||
                              isFieldReadOnly(`stages.${stage.key}`)}
                            on:change={(event) =>
                              changeStage(
                                selectedJob!,
                                stage.key,
                                event.currentTarget.value,
                              )}
                          /></label
                        >{/each}
                    </div>
                    <div class="field-grid budget-fields">
                      <label
                        >Anggaran RKAP (USD)<input
                          type="number"
                          min="0"
                          step="0.01"
                          value={selectedJob.rkapBudgetUSD ?? ""}
                          disabled={!canEditSelected ||
                            Boolean(selectedJob.rkapBudgetReadOnly)}
                          on:change={(event) =>
                            changeValue(
                              selectedJob!,
                              "rkapBudgetUSD",
                              event.currentTarget.value,
                            )}
                        /><small class="field-source"
                          >Sumber: {selectedJob.rkapBudgetSource ||
                            "Dummy / manual"}{#if selectedJob.rkapBudgetImportedAt}
                            · impor {dateLabel(
                              selectedJob.rkapBudgetImportedAt.slice(0, 10),
                            )}{/if}</small
                        ></label
                      ><label
                        >HPS (USD)<input
                          type="number"
                          min="0"
                          step="0.01"
                          value={selectedJob.hpsUSD}
                          disabled={!canEditSelected ||
                            Boolean(selectedJob.hpsReadOnly)}
                          on:change={(event) =>
                            changeValue(
                              selectedJob!,
                              "hpsUSD",
                              event.currentTarget.value,
                            )}
                        /><small class="field-source"
                          >Sumber: {selectedJob.hpsSource ||
                            "Manual / data pekerjaan"}</small
                        ></label
                      >
                    </div>
                    <div class="scs-status-line">
                      <span>Perlu SCS?</span><b
                        >{selectedJob.scsRequired ? "Ya" : "Tidak"}</b
                      ><span>Status SCS</span><b
                        class:scs-wait={selectedJob.scsStatus ===
                          "Menunggu SCS"}>{selectedJob.scsStatus}</b
                      >
                    </div>
                    <label class="full-field"
                      >Tanggal SCS<input
                        type="date"
                        value={selectedJob.scsDate || ""}
                        disabled={!canEditSelected}
                        on:change={(event) =>
                          changeValue(
                            selectedJob!,
                            "scsDate",
                            event.currentTarget.value,
                          )}
                      /></label
                    >
                  </section>
                  <section class="detail-section">
                    <h3>PR</h3>
                    <div class="date-field-list">
                      {#each STAGES.slice(4, 6) as stage}<label
                          class="date-field"
                          ><span
                            >{stage.label}<small
                              >Sumber: {stageSource(
                                selectedJob!,
                                stage.key,
                              )}</small
                            ></span
                          ><input
                            type="date"
                            value={selectedJob.stages[stage.key] || ""}
                            disabled={!canEditSelected ||
                              isFieldReadOnly(`stages.${stage.key}`)}
                            on:change={(event) =>
                              changeStage(
                                selectedJob!,
                                stage.key,
                                event.currentTarget.value,
                              )}
                          /></label
                        >{/each}
                    </div>
                  </section>
                  <section class="detail-section">
                    <h3>Tender dan evaluasi teknis</h3>
                    <div class="date-field-list">
                      {#each STAGES.slice(6, 10) as stage}<label
                          class="date-field"
                          ><span
                            >{stage.label}<small
                              >Sumber: {stageSource(
                                selectedJob!,
                                stage.key,
                              )}</small
                            ></span
                          ><input
                            type="date"
                            value={selectedJob.stages[stage.key] || ""}
                            disabled={!canEditSelected ||
                              isFieldReadOnly(`stages.${stage.key}`)}
                            on:change={(event) =>
                              changeStage(
                                selectedJob!,
                                stage.key,
                                event.currentTarget.value,
                              )}
                          /></label
                        >{/each}
                    </div>
                  </section>
                  <section class="detail-section">
                    <h3>Negosiasi dan pemenang</h3>
                    <div class="date-field-list">
                      {#each STAGES.slice(10, 12) as stage}<label
                          class="date-field"
                          ><span
                            >{stage.label}<small
                              >Sumber: {stageSource(
                                selectedJob!,
                                stage.key,
                              )}</small
                            ></span
                          ><input
                            type="date"
                            value={selectedJob.stages[stage.key] || ""}
                            disabled={!canEditSelected ||
                              isFieldReadOnly(`stages.${stage.key}`)}
                            on:change={(event) =>
                              changeStage(
                                selectedJob!,
                                stage.key,
                                event.currentTarget.value,
                              )}
                          /></label
                        >{/each}
                    </div>
                  </section>
                  <section class="detail-section">
                    <h3>Kontrak (PO) dan eksekusi</h3>
                    <div class="date-field-list">
                      {#each STAGES.slice(12, 14) as stage}<label
                          class="date-field"
                          ><span
                            >{stage.label}<small
                              >Sumber: {stageSource(
                                selectedJob!,
                                stage.key,
                              )}</small
                            ></span
                          ><input
                            type="date"
                            value={selectedJob.stages[stage.key] || ""}
                            disabled={!canEditSelected ||
                              isFieldReadOnly(`stages.${stage.key}`)}
                            on:change={(event) =>
                              changeStage(
                                selectedJob!,
                                stage.key,
                                event.currentTarget.value,
                              )}
                          /></label
                        >{/each}
                    </div>
                    <label class="full-field"
                      >Nama vendor<input
                        maxlength="160"
                        value={selectedJob.vendor}
                        disabled={!canEditSelected}
                        on:change={(event) =>
                          changeValue(
                            selectedJob!,
                            "vendor",
                            event.currentTarget.value,
                          )}
                      /></label
                    >
                    <div class="field-grid">
                      <label
                        >Nilai kontrak (IDR)<input
                          type="number"
                          min="0"
                          step="1"
                          value={selectedJob.contractAmountIDR}
                          disabled={!canEditSelected}
                          on:change={(event) =>
                            changeValue(
                              selectedJob!,
                              "contractAmountIDR",
                              event.currentTarget.value,
                            )}
                        /></label
                      ><label
                        >Persen dibayar (%)<input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={selectedJob.paidPercent}
                          disabled={!canEditSelected}
                          on:change={(event) =>
                            changeValue(
                              selectedJob!,
                              "paidPercent",
                              event.currentTarget.value,
                            )}
                        /></label
                      ><label
                        >Start Date<input
                          type="date"
                          value={selectedJob.startDate || ""}
                          disabled={!canEditSelected}
                          on:change={(event) =>
                            changeValue(
                              selectedJob!,
                              "startDate",
                              event.currentTarget.value,
                            )}
                        /></label
                      ><label
                        >Finish Date<input
                          type="date"
                          value={selectedJob.finishDate || ""}
                          disabled={!canEditSelected}
                          on:change={(event) =>
                            changeValue(
                              selectedJob!,
                              "finishDate",
                              event.currentTarget.value,
                            )}
                        /></label
                      ><label
                        >Actual Finish<input
                          type="date"
                          value={selectedJob.actualFinish || ""}
                          disabled={!canEditSelected}
                          on:change={(event) =>
                            changeValue(
                              selectedJob!,
                              "actualFinish",
                              event.currentTarget.value,
                            )}
                        /></label
                      ><label
                        >Garansi sampai<input
                          type="date"
                          value={selectedJob.guaranteeUntil || ""}
                          disabled={!canEditSelected}
                          on:change={(event) =>
                            changeValue(
                              selectedJob!,
                              "guaranteeUntil",
                              event.currentTarget.value,
                            )}
                        /></label
                      >
                    </div>
                  </section>
                  <section class="detail-section">
                    <h3>Status khusus</h3>
                    <label class="full-field"
                      >Pilih status khusus<select
                        value={selectedJob.specialStatus}
                        disabled={!canEditSelected}
                        on:change={(event) =>
                          changeSpecialStatus(
                            selectedJob!,
                            event.currentTarget.value,
                          )}
                        >{#each SPECIAL_OPTIONS as option}<option
                            value={option.value}>{option.label}</option
                          >{/each}</select
                      ></label
                    >
                    <p class="helper-text">
                      Cancelled/Postpone, Terminated, dan Retender
                      mengesampingkan tahap berbasis tanggal untuk menentukan
                      Last Progress.
                    </p>
                  </section>
                {/if}
                {#if toast}<div class="inline-message" role="status">
                    {toast}
                  </div>{/if}
              </div>
            </aside>
          {/if}
        </div>
      {:else if activeTab === "Tabel Master"}
        <section class="page-heading">
          <div>
            <div class="eyebrow">TAMPILAN MIRIP LEMBAR KERJA</div>
            <h1>Master Pekerjaan RKAP 2026</h1>
            <p>
              {dataSourceMode === "google-sheets"
                ? "Ringkasan pekerjaan yang dibaca dari file monitoring lama. Nominal keuangan ditampilkan dari sheet penyerapan terpisah."
                : "Kolom dikelompokkan menyerupai file monitoring untuk mode demo lokal."}
              Geser tabel secara horizontal untuk melihat kolom tambahan.
            </p>
          </div>
          {#if user.role === "admin" || user.role === "viewer"}<button
              class="btn outline"
              on:click={syncNow}
              disabled={syncing}
              >{syncing ? "Menyinkronkan…" : "Sinkron sekarang"}</button
            >{/if}
        </section>
        {#if summary}
          {#if dataSourceMode === "google-sheets"}
            <section class="master-metrics">
              <article>
                <span>Total pekerjaan</span><b>{summary.totalJobs}</b><small
                  >Data dari sheet monitoring</small
                >
              </article>
              <article class:highlight={summary.staleProgress > 0}>
                <span
                  >Tanpa milestone baru ≥ {config?.progressAttentionDays || 30} hari</span
                ><b>{summary.staleProgress}</b><small
                  >Indikator perhatian, bukan SLA resmi</small
                >
              </article>
              <article>
                <span>Memiliki data GR/SES</span><b>{sourceGrCount}</b><small
                  >Persentase atau tanggal GR/SES terisi</small
                >
              </article>
              <article>
                <span>Belum ada tanggal kontrak</span><b
                  >{sourceNoContractCount}</b
                ><small>Tanggal kontrak pada kolom A97 belum tercatat</small>
              </article>
            </section>
          {:else}
            <section class="master-metrics">
              <article>
                <span>Anggaran RKAP (USD)</span><b
                  >{dollar(summary.totalBudgetUSD)}</b
                >
              </article>
              <article>
                <span>Sudah dikontrakkan (USD)</span><b
                  >{dollar(summary.totalContractUSD)}</b
                ><small>Rumus penyerapan sementara</small>
              </article>
              <article>
                <span>Sudah dibayar (IDR)</span><b
                  >{rupiah(summary.totalPaidIDR)}</b
                >
              </article>
              <article class:highlight={summary.waitingScs > 0}>
                <span>Menunggu SCS</span><b>{summary.waitingScs}</b>
              </article>
            </section>
          {/if}
        {/if}
        <section class="filter-toolbar master-filters">
          <label class="search-control"
            ><span aria-hidden="true">⌕</span><input
              bind:value={searchText}
              placeholder="Cari pekerjaan…"
              aria-label="Cari pekerjaan master"
            /></label
          ><label class="filter-control"
            ><span>PIC</span><select bind:value={picFilter}
              ><option value="">Semua PIC</option
              >{#each availablePicNames as pic}<option value={pic}>{pic}</option
                >{/each}</select
            ></label
          ><label class="filter-control"
            ><span>Tipe</span><select bind:value={typeFilter}
              ><option value="">Semua tipe</option><option value="CAPEX"
                >CAPEX</option
              ><option value="OPEX">OPEX</option></select
            ></label
          ><label class="filter-control"
            ><span>Status</span><select bind:value={statusFilter}
              ><option value="">Semua status</option
              >{#each STATUS_META as meta}<option value={meta.label}
                  >{meta.label}</option
                >{/each}</select
            ></label
          >
          <div class="export-actions">
            <button class="btn primary small" on:click={() => download("xlsx")}
              >Unduh Excel</button
            ><button class="btn outline small" on:click={() => download("csv")}
              >Unduh CSV</button
            ><button class="btn outline small" on:click={copyForSheets}
              >Salin untuk Google Sheets</button
            >
          </div>
        </section>
        <section class="panel master-table-panel">
          {#if dataSourceMode === "google-sheets"}
            <div class="table-wrap master-table-wrap">
              <table class="master-table source-master-table">
                <thead
                  ><tr
                    ><th>No</th><th>Tahun</th><th>PIC</th><th>Tipe</th><th
                      >Commitment Item</th
                    ><th>Title FC / Pekerjaan</th><th>PR Number</th><th
                      >Full Release</th
                    ><th>Contract Date</th><th>Finish Date</th><th
                      >Actual Finish</th
                    ><th>GR/SES (%)</th><th>Status SCS</th><th>Last Progress</th
                    ><th>Sejak milestone / update</th><th>Kendala</th><th
                      >Tindak lanjut</th
                    ><th>Deadline</th><th>Detail Progress / Remarks</th></tr
                  ></thead
                >
                <tbody>
                  {#each filteredJobs as job (job.id)}
                    <tr>
                      <td>{job.no}</td><td>{job.year}</td><td>{job.pic}</td><td
                        ><span
                          class={`type-pill type-${job.type.toLowerCase()}`}
                          >{job.type}</span
                        ></td
                      >
                      <td>{job.commitmentItem || "—"}</td>
                      <td class="master-title"
                        ><button
                          class="text-link"
                          on:click={() => {
                            selectedId = job.id;
                            activeTab = "Daftar Pekerjaan";
                          }}>{job.title}</button
                        ></td
                      >
                      <td
                        >{job.sourceDetails?.find(
                          (detail) => detail.code === "A26",
                        )?.value || "—"}</td
                      >
                      <td
                        >{job.sourceDetails?.find(
                          (detail) => detail.code === "A35",
                        )?.value || "—"}</td
                      >
                      <td
                        >{job.sourceDetails?.find(
                          (detail) => detail.code === "A97",
                        )?.value || "—"}</td
                      >
                      <td>{dateLabel(job.finishDate)}</td><td
                        >{dateLabel(job.actualFinish)}</td
                      >
                      <td
                        >{job.grSesPercent === null ||
                        job.grSesPercent === undefined
                          ? "—"
                          : `${number(job.grSesPercent)}%`}</td
                      ><td>{job.sourceScsStatus || "—"}</td>
                      <td class="last-progress-cell">{job.lastProgressLabel}</td
                      ><td
                        >{job.daysInStage === null
                          ? "—"
                          : `${job.daysInStage} hari`}</td
                      ><td class="source-remarks-cell"
                        >{job.sourceIssue || "—"}</td
                      ><td class="source-remarks-cell"
                        >{job.sourceAction || "—"}</td
                      ><td>{dateLabel(job.sourceDeadline || "")}</td><td
                        class="source-remarks-cell"
                        >{job.detailProgress || "—"}</td
                      >
                    </tr>
                  {/each}
                  {#if !filteredJobs.length}<tr
                      ><td colspan="19"
                        ><div class="empty-state">
                          Tidak ada pekerjaan sesuai filter.
                        </div></td
                      ></tr
                    >{/if}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="table-wrap master-table-wrap">
              <table class="master-table">
                <thead
                  ><tr class="group-head"
                    ><th colspan="5">Identitas</th><th colspan="2"
                      >Budget USD</th
                    ><th colspan="3">Persetujuan SCS</th><th colspan="4"
                      >KAK dan HPS</th
                    ><th colspan="2">PR</th><th colspan="4"
                      >Tender dan TE (IPRO)</th
                    ><th colspan="2">Negosiasi dan Pemenang</th><th colspan="1"
                      >Contract (PO)</th
                    ><th colspan="4">Execution</th><th colspan="2">Payment</th
                    ><th colspan="1">Guarantee</th><th colspan="2"
                      >Last Progress</th
                    ></tr
                  ><tr
                    ><th>No</th><th>Year</th><th>OPEX/CAPEX</th><th>PIC</th><th
                      >Title FC</th
                    ><th>Anggaran</th><th>HPS</th><th>Perlu SCS?</th><th
                      >Tgl SCS</th
                    ><th>Status SCS</th>{#each STAGES.slice(0, 4) as stage}<th
                        >{stage.no}. {stage.short}</th
                      >{/each}{#each STAGES.slice(4, 6) as stage}<th
                        >{stage.no}. {stage.short}</th
                      >{/each}{#each STAGES.slice(6, 10) as stage}<th
                        >{stage.no}. {stage.short}</th
                      >{/each}{#each STAGES.slice(10, 12) as stage}<th
                        >{stage.no}. {stage.short}</th
                      >{/each}<th>Tanggal kontrak / SPK</th><th
                      >Mulai eksekusi (14)</th
                    ><th>Start Date</th><th>Finish Date</th><th
                      >Actual Finish</th
                    ><th>Nilai kontrak (IDR)</th><th>% dibayar</th><th
                      >Garansi sampai</th
                    ><th>Last Progress</th><th>Status</th></tr
                  ></thead
                ><tbody>
                  {#each filteredJobs as job}
                    <tr
                      ><td>{job.no}</td><td>{job.year}</td><td>{job.type}</td
                      ><td>{job.pic}</td><td class="master-title"
                        ><button
                          class="text-link"
                          on:click={() => {
                            selectedId = job.id;
                            activeTab = "Daftar Pekerjaan";
                          }}>{job.title}</button
                        ></td
                      ><td class="numeric budget-source-cell"
                        >{dollar(job.rkapBudgetUSD)}<small
                          >{job.rkapBudgetSource || "Dummy / manual"}</small
                        >{#if job.rkapBudgetImportedAt}<small
                            >Impor {dateLabel(
                              job.rkapBudgetImportedAt.slice(0, 10),
                            )}</small
                          >{/if}</td
                      ><td class="numeric">{dollar(job.hpsUSD)}</td><td
                        >{job.scsRequired ? "Ya" : "Tidak"}</td
                      ><td>{dateLabel(job.scsDate)}</td><td
                        ><span class:scs-wait={job.scsStatus === "Menunggu SCS"}
                          >{job.scsStatus}</span
                        ></td
                      >{#each STAGES.slice(0, 4) as stage}<td
                          >{dateLabel(job.stages[stage.key])}</td
                        >{/each}{#each STAGES.slice(4, 6) as stage}<td
                          >{dateLabel(job.stages[stage.key])}</td
                        >{/each}{#each STAGES.slice(6, 10) as stage}<td
                          >{dateLabel(job.stages[stage.key])}</td
                        >{/each}{#each STAGES.slice(10, 12) as stage}<td
                          >{dateLabel(job.stages[stage.key])}</td
                        >{/each}<td>{dateLabel(job.stages.contractSigned)}</td
                      ><td>{dateLabel(job.stages.executionStarted)}</td><td
                        >{dateLabel(job.startDate)}</td
                      ><td>{dateLabel(job.finishDate)}</td><td
                        >{dateLabel(job.actualFinish)}</td
                      ><td class="numeric">{rupiah(job.contractAmountIDR)}</td
                      ><td>{number(job.paidPercent)}%</td><td
                        >{dateLabel(job.guaranteeUntil)}</td
                      ><td class="last-progress-cell"
                        >{job.lastProgressLabel}</td
                      ><td
                        ><span class={`status-pill ${statusClass(job.status)}`}
                          >{job.status}</span
                        ></td
                      ></tr
                    >
                  {/each}
                  {#if !filteredJobs.length}<tr
                      ><td colspan="32"
                        ><div class="empty-state">
                          Tidak ada pekerjaan sesuai filter.
                        </div></td
                      ></tr
                    >{/if}
                </tbody>
              </table>
            </div>
          {/if}
          <div class="master-bottom">
            <span>Jumlah baris ditampilkan: {filteredJobs.length}</span><span
              >Data sumber: {dataSourceMode.toUpperCase()} · Sinkron terakhir: {formatSynced(
                config?.lastSync,
              )}</span
            >
          </div>
        </section>
      {:else if activeTab === "Penyerapan RKAP"}
        <AbsorptionPage
          canRefresh={user.role === "admin" || user.role === "viewer"}
        />
      {:else if activeTab === "Integrasi Data"}
        <IntegrationPage />
      {:else if activeTab === "Analisa Penyerapan"}
        <AnalysisPage {user} />
      {:else if activeTab === "Impor Data"}
        <ImportPage {user} onImported={afterImport} />
      {:else if activeTab === "Rekonsiliasi"}
        <ReconciliationPage {user} {jobs} />
      {:else if activeTab === "Atur Pemetaan"}
        <MappingPage {user} />
      {:else if activeTab === "Prognosa"}
        <ForecastPage {user} />
      {:else if activeTab === "Audit Log"}
        <section class="page-heading">
          <div>
            <div class="eyebrow">CATATAN AKTIVITAS</div>
            <h1>Audit Log</h1>
            <p>
              Riwayat perubahan disimpan di server dan hanya dapat dilihat akun
              mentor atau admin.
            </p>
          </div>
          <button class="btn outline" on:click={openAudit}>Muat ulang</button>
        </section>
        <section class="panel audit-panel">
          <div class="table-wrap">
            <table class="audit-table">
              <thead
                ><tr
                  ><th>Waktu (WIB)</th><th>Pengguna</th><th>Aksi</th><th
                    >Pekerjaan</th
                  ><th>Rincian perubahan</th></tr
                ></thead
              ><tbody
                >{#each auditEntries as entry}<tr
                    ><td>{formatSynced(entry.at)}</td><td
                      ><b>{entry.displayName}</b><small>{entry.username}</small
                      ></td
                    ><td>{entry.action}</td><td>{entry.jobTitle}</td><td
                      >{#if entry.fields?.length}{#each entry.fields as field}<div
                            class="audit-change"
                          >
                            <b>{field.field}</b><span
                              >{JSON.stringify(field.oldValue)} → {JSON.stringify(
                                field.newValue,
                              )}</span
                            >
                          </div>{/each}{:else}—{/if}</td
                    ></tr
                  >{/each}{#if !auditEntries.length}<tr
                    ><td colspan="5"
                      ><div class="empty-state">
                        Belum ada aktivitas tercatat.
                      </div></td
                    ></tr
                  >{/if}</tbody
              >
            </table>
          </div>
          <div class="table-footnote">
            Maksimal 500 catatan terakhir ditampilkan. Log disimpan pada berkas
            data lokal; atur backup di lingkungan produksi.
          </div>
        </section>
      {/if}
        <footer class="app-footer">
          <span>MONITORING RKAP 2026 · DEPARTEMEN PPS · PARITOHAN</span>
          <span>Terakhir dimuat: {lastRefresh || "—"} WIB · Zona waktu Asia/Jakarta</span>
          <span>Mode: {dataSourceMode.toUpperCase()}</span>
        </footer>
      </main>
    </div>
  </div>
</div>
{/if}
