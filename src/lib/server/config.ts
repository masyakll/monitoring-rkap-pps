import 'dotenv/config';

export const STAGES = [
  { no: 1, key: 'kakReceived', label: '01 Preparation /Waiting KAK', short: 'KAK diterima', group: 'Persiapan' },
  { no: 2, key: 'hpsPrepared', label: '02 Preparation HPS', short: 'HPS disusun', group: 'Persiapan' },
  { no: 3, key: 'hpsApprovalStarted', label: '03 Approval KAK & HPS, PME', short: 'Approval HPS dimulai', group: 'Persiapan' },
  { no: 4, key: 'hpsFinalApproved', label: '04 Approval KAK & HPS, GPO-Up', short: 'HPS final approve', group: 'Persiapan' },
  { no: 5, key: 'prCreated', label: '05 Preparation PR', short: 'PR dibuat', group: 'Persiapan' },
  { no: 6, key: 'prReleased', label: '06 Approval PR', short: 'PR final release', group: 'Persiapan' },
  { no: 7, key: 'tenderBriefing', label: '07 W/ Tender Briefing', short: 'Tender briefing / RFx', group: 'Pengadaan' },
  { no: 8, key: 'quotationReceived', label: '08 W/ Quotation', short: 'Quotation diterima', group: 'Pengadaan' },
  { no: 9, key: 'technicalEvaluation', label: '09 U/ Process TE', short: 'Evaluasi teknis', group: 'Pengadaan' },
  { no: 10, key: 'teSentToSom', label: '10 TE sent to SOM (IPRO)', short: 'TE dikirim ke SOM', group: 'Pengadaan' },
  { no: 11, key: 'negotiation', label: '11 U/ Negotiation', short: 'Negosiasi (opsional)', group: 'Pengadaan' },
  { no: 12, key: 'winnerSelected', label: '12 Penetapan Pemenang (IPRO)', short: 'Penetapan pemenang', group: 'Pengadaan' },
  { no: 13, key: 'contractSigned', label: '13 W/ SPK or Contract', short: 'Tanggal kontrak / SPK', group: 'Kontrak' },
  { no: 14, key: 'executionStarted', label: '14 U/ Execution/Delivery', short: 'Mulai eksekusi / delivery', group: 'Eksekusi' }
] as const;

export const LAST_PROGRESS_LABELS: Record<number, string> = {
  1: '01 Preparation /Waiting KAK', 2: '02 Preparation HPS',
  3: '03 Approval KAK & HPS, PME', 4: '04 Approval KAK & HPS, GPO-Up',
  5: '05 Preparation PR', 6: '06 Approval PR', 7: '07 W/ Tender Briefing',
  8: '08 W/ Quotation', 9: '09 U/ Process TE', 10: '10 TE sent to SOM (IPRO)',
  11: '11 U/ Negotiation', 12: '12 Penetapan Pemenang (IPRO)',
  13: '13 W/ SPK or Contract', 14: '14 U/ Execution/Delivery',
  15: '15 Final Completion', 16: '16 Cancelled/Postpone',
  17: '17 Terminated', 18: '18 Retender'
};

export const SPECIAL_STATUSES = ['normal', 'cancelled', 'terminated', 'retender'] as const;
export const SPECIAL_LABELS: Record<string, string> = {
  normal: 'Normal', cancelled: 'Cancelled/Postpone', terminated: 'Terminated', retender: 'Retender'
};

export const FIELD_OWNERS: Record<string, 'ipro' | 'sap' | 'manual'> = {
  'stages.tenderBriefing': 'ipro',
  'stages.quotationReceived': 'ipro',
  'stages.teSentToSom': 'ipro',
  'stages.winnerSelected': 'ipro',
  'stages.prCreated': 'sap',
  'stages.prReleased': 'sap',
  'stages.contractSigned': 'sap'
};

function envNumber(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(process.env[name] || fallback);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
export const SCS_HPS_LIMIT_USD = envNumber('SCS_HPS_LIMIT_USD', 1000, 0, 1_000_000_000);
export const USD_IDR_RATE = envNumber('USD_IDR_RATE', 16300, 1, 1_000_000_000);
export const APP_TIME_ZONE = 'Asia/Jakarta';
export const MAX_BODY_BYTES = 1024 * 1024;
