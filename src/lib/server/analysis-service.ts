import { readState } from './db.js';
import { getBudgetItems, getGRRecords, getAnalysisEntries } from './budget-db.js';
import { hitungAktual, hitungNilaiKontrak, hitungNilaiDibayar, hitungPersen, AKTUAL_FORMULA_LABEL } from './aktual.js';
import { computeJob } from './domain.js';
import { USD_IDR_RATE } from './config.js';
import { CAPEX_CAUSES, OPEX_CAUSES } from '../../../config/mapping-analisa.js';

export async function buildAnalysisPayload() {
  const state = await readState();
  const budgets = await getBudgetItems();
  const grs = await getGRRecords();
  const analyses = await getAnalysisEntries();
  const prognosisVersions = state.prognosaVersions ?? [];
  const usdRate = USD_IDR_RATE;

  const rows = state.jobs.map((job) => {
    const computed = computeJob(job);
    const budget = budgets.find((b) => b.linkedJobId === job.id && b.matchStatus === 'confirmed');
    const gr = grs.find((g) => g.linkedJobId === job.id && g.matchStatus === 'confirmed');
    const analysis = analyses.find((a) => a.jobId === job.id);
    const planUsd = budget ? budget.planRkapUsd : (budgets.length ? null : job.rkapBudgetUSD ?? null);
    const aktualUsd = hitungAktual(job, gr ?? null, usdRate);
    const latestForecast = prognosisVersions.filter((v) => v.jobId === job.id).sort((a, b) => b.version - a.version)[0];
    const prognosaUsd = latestForecast?.totalUsd ?? null;
    const nilaiKontrakUsd = hitungNilaiKontrak(job, usdRate);
    const nilaiDibayarUsd = hitungNilaiDibayar(job, usdRate);
    return {
      jobId: job.id, no: job.no, title: job.title, pic: job.pic, tipe: job.type,
      lastProgress: computed.lastProgress, lastProgressLabel: computed.lastProgressLabel,
      planUsd, planSource: budget ? `Impor: ${new Date(budget.importedAt).toLocaleDateString('id-ID')}` : (budgets.length ? 'Belum cocok — periksa Rekonsiliasi' : 'Dummy / manual'),
      budgetImportedAt: budget?.importedAt ?? null, aktualUsd, aktualSource: gr ? `GR: ${new Date(gr.importedAt).toLocaleDateString('id-ID')}` : null,
      aktualPct: hitungPersen(aktualUsd, planUsd), nilaiKontrakUsd, nilaiDibayarUsd, nilaiKontrakIDR: job.contractAmountIDR,
      prognosaUsd, prognosaPct: hitungPersen(prognosaUsd, planUsd), updateProgres: analysis?.updateProgres ?? '',
      penyebabKategori: analysis?.penyebabKategori ?? '', penyebabDetail: analysis?.penyebabDetail ?? '', quickWin: analysis?.quickWin ?? '',
      grupKategori: analysis?.grupKategori ?? '', analysisUpdatedAt: analysis?.updatedAt ?? null, analysisUpdatedBy: analysis?.updatedBy ?? null,
      grMonthly: gr?.monthly ?? null, grLinkedBy: gr?.matchStatus ?? null,
      forecastVersion: latestForecast?.version ?? null, forecastLocked: Boolean(latestForecast && !latestForecast.unlockedAt),
    };
  });
  const capexRows = rows.filter((r) => r.tipe === 'CAPEX');
  const opexRows = rows.filter((r) => r.tipe === 'OPEX');
  function buildSummary(subset: typeof rows, causes: string[]) {
    const baseBudget = subset.reduce((sum, row) => sum + (row.planUsd ?? 0), 0);
    return causes.map((cause, idx) => {
      const matching = subset.filter((r) => r.penyebabKategori === cause);
      const budgetUsd = matching.reduce((sum, row) => sum + (row.planUsd ?? 0), 0);
      return { no: idx + 1, item: cause, qty: matching.length, budgetUsd, pct: baseBudget > 0 ? budgetUsd / baseBudget : 0 };
    });
  }
  const totalCapexPlan = capexRows.reduce((sum, row) => sum + (row.planUsd ?? 0), 0);
  const totalOpexPlan = opexRows.reduce((sum, row) => sum + (row.planUsd ?? 0), 0);
  const totalCapexAktual = capexRows.reduce((sum, row) => sum + (row.aktualUsd ?? 0), 0);
  const totalOpexAktual = opexRows.reduce((sum, row) => sum + (row.aktualUsd ?? 0), 0);
  const capexPlannedRows = capexRows.filter((row) => row.planUsd != null && row.planUsd > 0);
  const opexPlannedRows = opexRows.filter((row) => row.planUsd != null && row.planUsd > 0);
  const capexForecastComplete = capexPlannedRows.length > 0 && capexPlannedRows.every((row) => row.prognosaUsd !== null);
  const opexForecastComplete = opexPlannedRows.length > 0 && opexPlannedRows.every((row) => row.prognosaUsd !== null);
  const totalCapexPrognosa = capexForecastComplete ? capexRows.reduce((sum, row) => sum + (row.prognosaUsd ?? 0), 0) : null;
  const totalOpexPrognosa = opexForecastComplete ? opexRows.reduce((sum, row) => sum + (row.prognosaUsd ?? 0), 0) : null;
  return {
    rows,
    summary: {
      capex: { summary: buildSummary(capexRows, CAPEX_CAUSES), totalPlan: totalCapexPlan, totalAktual: totalCapexAktual, totalPrognosa: totalCapexPrognosa, pctAktual: totalCapexPlan > 0 ? totalCapexAktual / totalCapexPlan : null, pctPrognosa: totalCapexPlan > 0 && totalCapexPrognosa !== null ? totalCapexPrognosa / totalCapexPlan : null },
      opex: { summary: buildSummary(opexRows, OPEX_CAUSES), totalPlan: totalOpexPlan, totalAktual: totalOpexAktual, totalPrognosa: totalOpexPrognosa, pctAktual: totalOpexPlan > 0 ? totalOpexAktual / totalOpexPlan : null, pctPrognosa: totalOpexPlan > 0 && totalOpexPrognosa !== null ? totalOpexPrognosa / totalOpexPlan : null },
    },
    causes: { capex: CAPEX_CAUSES, opex: OPEX_CAUSES },
    aktualFormulaLabel: AKTUAL_FORMULA_LABEL,
    usdIdrRate: usdRate,
  };
}
