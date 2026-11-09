import { LAST_PROGRESS_LABELS, SCS_HPS_LIMIT_USD, STAGES } from './config.js';

export type SpecialStatus = 'normal' | 'cancelled' | 'terminated' | 'retender';
export type StageDates = Record<string, string>;
export type SourceMilestone = { code: string; label: string; value: string; date: string; stageNo: number };
export type SourceDetail = { code: string; label: string; value: string };
export type Job = {
  id: string;
  no: number;
  year: number;
  title: string;
  /** Kunci penghubung ke ekspor RKAP/GR bila tersedia. */
  commitmentItem?: string;
  pic: string;
  type: 'CAPEX' | 'OPEX';
  stages: StageDates;
  vendor: string;
  contractAmountIDR: number;
  startDate: string;
  finishDate: string;
  actualFinish: string;
  guaranteeUntil: string;
  paidPercent: number;
  rkapBudgetUSD: number | null;
  hpsUSD: number;
  scsDate: string;
  specialStatus: SpecialStatus;
  fieldSources?: Record<string, 'IPRO' | 'SAP' | 'Manual'>;
  /** Read-only fields populated from the legacy monitoring spreadsheet. */
  sourceLastProgress?: string;
  sourceProgressNo?: number | null;
  sourceLastUpdateDate?: string;
  detailProgress?: string;
  sourceMilestones?: SourceMilestone[];
  sourceDetails?: SourceDetail[];
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
};

export type WorkStatus = 'Belum kontrak' | 'Terlambat' | 'Belum mulai' | 'Sedang berjalan' | 'Selesai tepat waktu' | 'Selesai terlambat' | 'Dibatalkan' | 'Terminated' | 'Retender';

export function todayJakarta(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function daysBetween(from: string, to: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function getLastProgress(job: Job): number {
  if (job.specialStatus === 'cancelled') return 16;
  if (job.specialStatus === 'terminated') return 17;
  if (job.specialStatus === 'retender') return 18;
  if (job.actualFinish) return 15;
  if (job.sourceProgressNo && job.sourceProgressNo >= 1 && job.sourceProgressNo <= 18) return job.sourceProgressNo;
  let highest = 0;
  for (const stage of STAGES) {
    if (job.stages?.[stage.key]) highest = stage.no;
  }
  return highest;
}

export function getScs(job: Job): { required: boolean; status: 'Tidak perlu' | 'Belum diajukan' | 'Menunggu SCS' | 'Disetujui' } {
  const required = Number(job.hpsUSD || 0) > SCS_HPS_LIMIT_USD;
  if (!required) return { required: false, status: 'Tidak perlu' };
  if (job.scsDate) return { required: true, status: 'Disetujui' };
  if (job.stages?.hpsFinalApproved) return { required: true, status: 'Menunggu SCS' };
  return { required: true, status: 'Belum diajukan' };
}

export function getGuarantee(job: Job, asOf: string): { status: string; daysRemaining: number | null } {
  if (!job.guaranteeUntil) return { status: '—', daysRemaining: null };
  const remaining = daysBetween(asOf, job.guaranteeUntil);
  if (remaining < 0) return { status: 'Berakhir', daysRemaining: remaining };
  if (remaining < 30) return { status: 'Segera habis', daysRemaining: remaining };
  return { status: 'Aktif', daysRemaining: remaining };
}


export function computeJob(job: Job, asOf = todayJakarta()) {
  const lastProgress = getLastProgress(job);

  const lastProgressLabel =
    job.sourceLastProgress?.trim() ||
    (lastProgress
      ? LAST_PROGRESS_LABELS[lastProgress]
      : 'Belum ada progres');

  const contractDate = job.stages?.contractSigned || '';
  const scs = getScs(job);

  let status: WorkStatus;
  let lateDays = 0;

  const followUpStatus = (job.sourceFollowUpStatus || '')
    .trim()
    .toLowerCase();

  const followUpCompleted =
    /^(selesai|closed|completed|complete|done|ditutup)$/.test(
      followUpStatus
    );

  const overdueFollowUp =
    Boolean(job.sourceDeadline) &&
    asOf > job.sourceDeadline! &&
    !followUpCompleted;

  // Status khusus harus selalu diprioritaskan.
  if (job.specialStatus === 'cancelled') {
    status = 'Dibatalkan';
  } else if (job.specialStatus === 'terminated') {
    status = 'Terminated';
  } else if (job.specialStatus === 'retender') {
    status = 'Retender';
  } else if (job.actualFinish) {
    if (job.finishDate && job.actualFinish > job.finishDate) {
      status = 'Selesai terlambat';
      lateDays = daysBetween(job.finishDate, job.actualFinish);
    } else {
      status = 'Selesai tepat waktu';
    }
  } else if (overdueFollowUp) {
    // Deadline tindak lanjut sudah terlewati.
    status = 'Terlambat';
    lateDays = daysBetween(job.sourceDeadline!, asOf);
  } else if (job.finishDate && asOf > job.finishDate) {
    // Tanggal selesai kontrak yang direncanakan sudah terlewati.
    status = 'Terlambat';
    lateDays = daysBetween(job.finishDate, asOf);
  } else if (!contractDate) {
    status = 'Belum kontrak';
  } else if (job.startDate && asOf < job.startDate) {
    status = 'Belum mulai';
  } else {
    status = 'Sedang berjalan';
  }

  const isPreContract = lastProgress >= 1 && lastProgress <= 12;

  const lastStageDate = isPreContract
    ? job.stages?.[STAGES[lastProgress - 1]?.key] || ''
    : '';

  const progressDate = job.sourceLastUpdateDate || lastStageDate;

  const daysInStage = progressDate
    ? Math.max(0, daysBetween(progressDate, asOf))
    : null;

  const guarantee = getGuarantee(job, asOf);

  const finishedStatuses: WorkStatus[] = [
    'Selesai tepat waktu',
    'Selesai terlambat',
    'Dibatalkan',
    'Terminated',
    'Retender'
  ];

  return {
    ...job,
    lastProgress,
    lastProgressLabel,
    status,
    lateDays,
    daysInStage,
    guaranteeStatus: guarantee.status,
    guaranteeDaysRemaining: guarantee.daysRemaining,
    scsRequired: scs.required,
    scsStatus: scs.status,
    contracted: Boolean(contractDate),
    isActive: !finishedStatuses.includes(status)
  };
}

export function validateJobPatch(current: Job, patch: unknown): { ok: true; job: Job; changed: string[] } | { ok: false; error: string } {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, error: 'Data perubahan tidak valid.' };
  const input = patch as Record<string, unknown>;
  const allowedRoot = new Set(['stages', 'vendor', 'contractAmountIDR', 'startDate', 'finishDate', 'actualFinish', 'guaranteeUntil', 'paidPercent', 'rkapBudgetUSD', 'hpsUSD', 'scsDate', 'specialStatus']);
  for (const key of Object.keys(input)) if (!allowedRoot.has(key)) return { ok: false, error: `Kolom ${key} tidak boleh diubah.` };
  const updated: Job = { ...current, stages: { ...current.stages } };
  const changed: string[] = [];
  if ('stages' in input) {
    if (!input.stages || typeof input.stages !== 'object' || Array.isArray(input.stages)) return { ok: false, error: 'Tanggal tahapan harus berupa objek.' };
    const stages = input.stages as Record<string, unknown>;
    const validKeys = new Set<string>(STAGES.map((s) => s.key));
    for (const key of Object.keys(stages)) {
      if (!validKeys.has(key)) return { ok: false, error: `Tahap tanggal ${key} tidak dikenal.` };
      const value = stages[key];
      if (value !== '' && value !== null && !isValidDateString(value)) return { ok: false, error: `Tanggal ${key} harus menggunakan format YYYY-MM-DD yang valid.` };
      const normalized = value == null ? '' : String(value);
      if (updated.stages[key] !== normalized) {
        updated.stages[key] = normalized;
        changed.push(`stages.${key}`);
      }
    }
  }
  const dateFields = ['startDate', 'finishDate', 'actualFinish', 'guaranteeUntil', 'scsDate'] as const;
  for (const key of dateFields) {
    if (!(key in input)) continue;
    const value = input[key];
    if (value !== '' && value !== null && !isValidDateString(value)) return { ok: false, error: `${key} harus berupa tanggal valid dengan format YYYY-MM-DD.` };
    const normalized = value == null ? '' : String(value);
    if (updated[key] !== normalized) {
      (updated as unknown as Record<string, unknown>)[key] = normalized;
      changed.push(key);
    }
  }
  if ('vendor' in input) {
    if (typeof input.vendor !== 'string' || input.vendor.length > 160) return { ok: false, error: 'Nama vendor harus berupa teks maksimal 160 karakter.' };
    if (updated.vendor !== input.vendor) { updated.vendor = input.vendor; changed.push('vendor'); }
  }
  const numericRules: Record<string, { min: number; max: number }> = {
    contractAmountIDR: { min: 0, max: 1_000_000_000_000_000 },
    paidPercent: { min: 0, max: 100 },
    rkapBudgetUSD: { min: 0, max: 1_000_000_000_000 },
    hpsUSD: { min: 0, max: 1_000_000_000_000 }
  };
  for (const [key, rule] of Object.entries(numericRules)) {
    if (!(key in input)) continue;
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < rule.min || value > rule.max) return { ok: false, error: `${key} harus berupa angka antara ${rule.min} dan ${rule.max}.` };
    if ((updated as unknown as Record<string, unknown>)[key] !== value) {
      (updated as unknown as Record<string, unknown>)[key] = value;
      changed.push(key);
    }
  }
  if ('specialStatus' in input) {
    if (!['normal', 'cancelled', 'terminated', 'retender'].includes(String(input.specialStatus))) return { ok: false, error: 'Status khusus tidak dikenal.' };
    const value = input.specialStatus as Job['specialStatus'];
    if (updated.specialStatus !== value) { updated.specialStatus = value; changed.push('specialStatus'); }
  }
  if (updated.startDate && updated.finishDate && updated.finishDate < updated.startDate) return { ok: false, error: 'Finish Date tidak boleh lebih awal daripada Start Date.' };
  if (updated.actualFinish && !updated.finishDate) return { ok: false, error: 'Isi Finish Date sebelum Actual Finish.' };
  if (updated.actualFinish && updated.startDate && updated.actualFinish < updated.startDate) return { ok: false, error: 'Actual Finish tidak boleh lebih awal daripada Start Date.' };
  return { ok: true, job: updated, changed };
}

export function statusForSummary(status: string): string {
  return status;
}
