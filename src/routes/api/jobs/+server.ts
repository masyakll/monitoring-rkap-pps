import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { computeJob, todayJakarta, isValidDateString } from '$lib/server/domain.js';
import { requireLogin } from '$lib/server/security.js';
import { loadJobs, getReadOnlyFields, getSourceMode, getSourceConfigStatus } from '$lib/server/sources.js';
import { readState } from '$lib/server/db.js';
import { SCS_HPS_LIMIT_USD, USD_IDR_RATE } from '$lib/server/config.js';

export const GET: RequestHandler = async (event) => {
  const auth = requireLogin(event);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  const asOfParam = event.url.searchParams.get('asOf');
  const asOf = asOfParam && isValidDateString(asOfParam) ? asOfParam : todayJakarta();
  let jobs;
  try { jobs = await loadJobs(); }
  catch (e) { return json({ error: e instanceof Error ? e.message : 'Sumber data belum tersedia.' }, { status: 503 }); }
  const state = await readState();
  const sourceMode = getSourceMode();
  const budgetItems = sourceMode === 'google-sheets' ? [] : (state.budgetItems ?? []);
  const hasImportedBudget = budgetItems.length > 0;
  const enrichedJobs = jobs.map((job) => {
    if (sourceMode === 'google-sheets') return {
      ...job,
      rkapBudgetSource: job.rkapBudgetUSD === null ? 'Belum tersedia di sheet' : 'Monitoring Google Sheets',
      rkapBudgetImportedAt: null,
      rkapBudgetReadOnly: true,
      hpsSource: 'Monitoring Google Sheets',
      hpsReadOnly: true
    };
    const budget = budgetItems.find((item) => item.linkedJobId === job.id && item.matchStatus === 'confirmed');
    const importedHps = budget?.hpsUsd != null;
    return {
      ...job,
      rkapBudgetUSD: budget ? budget.planRkapUsd : (hasImportedBudget ? null : job.rkapBudgetUSD),
      hpsUSD: importedHps ? budget!.hpsUsd! : job.hpsUSD,
      rkapBudgetSource: budget ? 'Impor RKAP' : (hasImportedBudget ? 'Belum cocok' : 'Dummy / manual'),
      rkapBudgetImportedAt: budget?.importedAt ?? null,
      rkapBudgetReadOnly: hasImportedBudget,
      hpsSource: importedHps ? 'Impor RKAP' : 'Manual / data pekerjaan',
      hpsReadOnly: importedHps,
    };
  });
  const computed = enrichedJobs.map((job) => computeJob(job, asOf));
  const totalBudget = computed.reduce((sum, job) => sum + Number(job.rkapBudgetUSD || 0), 0);
  const totalContractUSD = computed.reduce((sum, job) => sum + Number(job.contractAmountIDR || 0) / USD_IDR_RATE, 0);
  const totalContractIDR = computed.reduce((sum, job) => sum + Number(job.contractAmountIDR || 0), 0);
  const totalPaidIDR = computed.reduce((sum, job) => sum + Number(job.contractAmountIDR || 0) * Number(job.paidPercent || 0) / 100, 0);
  const statuses: Record<string, number> = {};
  for (const job of computed) statuses[job.status] = (statuses[job.status] || 0) + 1;
  const stagesStats = {
    preparation: computed.filter((j) => j.lastProgress >= 1 && j.lastProgress <= 6).length,
    procurement: computed.filter((j) => (j.lastProgress >= 7 && j.lastProgress <= 12) || j.lastProgress === 18).length,
    execution: computed.filter((j) => j.lastProgress >= 13 && j.lastProgress <= 15).length
  };
  const waitingScs = computed.filter((job) => job.scsStatus === 'Menunggu SCS').length;
  const attentionSetting = Number(process.env.PROGRESS_ATTENTION_DAYS || 30);
  const progressAttentionDays = Number.isFinite(attentionSetting) && attentionSetting >= 1 && attentionSetting <= 365 ? Math.floor(attentionSetting) : 30;
  const finishedStatuses = ['Selesai tepat waktu', 'Selesai terlambat', 'Dibatalkan', 'Terminated', 'Retender'];
  const staleProgress = computed.filter((job) => job.daysInStage !== null && job.daysInStage >= progressAttentionDays && !finishedStatuses.includes(job.status)).length;
  const missingProgress = sourceMode === 'google-sheets' ? computed.filter((job) => !job.sourceLastUpdateDate).length : 0;
  const contracted = computed.filter((job) => job.contracted).length;
  const active = computed.filter((job) => job.isActive).length;
  const stageDurationAverages = [] as { label: string; averageDays: number; count: number }[];
  const stageKeys = ['kakReceived', 'hpsPrepared', 'hpsApprovalStarted', 'hpsFinalApproved', 'prCreated', 'prReleased', 'tenderBriefing', 'quotationReceived', 'technicalEvaluation', 'teSentToSom', 'negotiation', 'winnerSelected', 'contractSigned', 'executionStarted'];
  for (let i = 1; i < stageKeys.length; i++) {
    const deltas = computed.map((job) => {
      const a = job.stages[stageKeys[i - 1]], b = job.stages[stageKeys[i]];
      if (!a || !b || b < a) return null;
      const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number);
      return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
    }).filter((n): n is number => n !== null);
    stageDurationAverages.push({ label: `${String(i).padStart(2, '0')}→${String(i + 1).padStart(2, '0')}`, averageDays: deltas.length ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0, count: deltas.length });
  }
  return json({
    jobs: computed,
    summary: {
      totalJobs: computed.length, active, contracted, contractPercent: computed.length ? Math.round(contracted / computed.length * 100) : 0,
      totalBudgetUSD: totalBudget, totalContractUSD, absorptionPercent: totalBudget ? totalContractUSD / totalBudget * 100 : 0,
      totalContractIDR, totalPaidIDR, totalUnpaidIDR: totalContractIDR - totalPaidIDR,
      totalPaidPercent: totalContractIDR ? totalPaidIDR / totalContractIDR * 100 : 0,
      waitingScs, staleProgress, missingProgress, statuses, stagesStats, stageDurationAverages,
      attention: computed.filter((job) => job.status === 'Terlambat' || (job.daysInStage !== null && job.daysInStage >= progressAttentionDays && !finishedStatuses.includes(job.status)) || (sourceMode === 'google-sheets' && !job.sourceLastUpdateDate))
    },
    config: { asOf, timeZone: 'Asia/Jakarta', usdIdrRate: USD_IDR_RATE, scsHpsLimitUSD: SCS_HPS_LIMIT_USD, source: getSourceMode(), sourceConfigured: getSourceConfigStatus().configured, progressAttentionDays, lastSync: state.lastSync, readOnlyFields: getReadOnlyFields() }
  }, { headers: { 'Cache-Control': 'no-store' } });
};
