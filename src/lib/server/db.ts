import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import type { Job } from './domain.js';
import { STAGES } from './config.js';

export type UserRole = 'pic' | 'viewer' | 'admin';
export type UserRecord = { id: string; username: string; displayName: string; role: UserRole; picName: string | null; passwordHash: string };
export type SessionRecord = { userId: string; createdAt: number; expiresAt: number };
export type AuditRecord = { id: string; at: string; username: string; displayName: string; jobId: string; jobTitle: string; fields: { field: string; oldValue: unknown; newValue: unknown }[]; action: string };
export type LoginAttemptRecord = { key: string; failures: number[]; blockedUntil: number };
export type AppState = {
  version: 1;
  users: UserRecord[];
  sessions: Record<string, SessionRecord>;
  loginAttempts: Record<string, LoginAttemptRecord>;
  jobs: Job[];
  audit: AuditRecord[];
  lastSync: string | null;
  // Modul Anggaran RKAP (opsional – diinisialisasi saat pertama impor)
  budgetItems?: import('./budget-db.js').BudgetItem[];
  grRecords?: import('./budget-db.js').GRRecord[];
  prognosaVersions?: import('./budget-db.js').PrognosaVersion[];
  analysisEntries?: import('./budget-db.js').AnalysisEntry[];
  importLogs?: import('./budget-db.js').ImportLog[];
  mappingConfigs?: import('./budget-db.js').MappingConfig[];
  activePrognosaVersion?: Record<string, number>;
};

const dataDir = process.env.DATA_DIR?.trim() ? resolve(process.env.DATA_DIR) : resolve(process.cwd(), 'data');
const statePath = resolve(dataDir, 'state.json');
let initPromise: Promise<void> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function dateMap(partial: Record<string, string> = {}) {
  const result: Record<string, string> = {};
  for (const stage of STAGES) result[stage.key] = partial[stage.key] || '';
  return result;
}

function makeSeedJobs(): Job[] {
  // Daftar awal direkap dari screenshot file monitoring.
  // Tanggal tahapan, nilai keuangan, commitment item, kontrak, dan GR/SES tidak diisi
  // karena belum terlihat/terkonfirmasi. Nilai angka nol di field legacy diperlukan oleh tipe Job.
  const rows: Omit<Job, 'id'>[] = [
    { no: 2, year: 2026, title: "Renewal Pressure Oil Pump SGP", commitmentItem: '', pic: "Obed", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 3, year: 2026, title: "Renewal SWSP TNP", commitmentItem: '', pic: "Obed", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 4, year: 2026, title: "Purchasing Air Compressor", commitmentItem: '', pic: "Obed", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 5, year: 2026, title: "Instalasi Vibration Monitoring Unit 1, 2, 4 TNP", commitmentItem: '', pic: "Obed", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 6, year: 2026, title: "Renewal Truck Crane", commitmentItem: '', pic: "Obed", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 7, year: 2026, title: "Renewal PACU No. 13 TNP", commitmentItem: '', pic: "Obed", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 8, year: 2026, title: "Purchasing Bending Pipe", commitmentItem: '', pic: "Obed", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 9, year: 2026, title: "Purchasing Submersible Pump", commitmentItem: '', pic: "Obed", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 10, year: 2026, title: "Purchasing Hydraulic Jack & Electric Pump", commitmentItem: '', pic: "Obed", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 11, year: 2025, title: "Labour Supply for Routine Maintenance", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 12, year: 2025, title: "General Service Mobile Crane 25T (BQ TADANO)", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 13, year: 2025, title: "Service for AC Split", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 14, year: 2025, title: "Replacement Lubricating Equipment All Dam", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 15, year: 2025, title: "Replacement Chlorinator Pump", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 16, year: 2026, title: "Repair Guide Vane Servomotor for SGP", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 17, year: 2026, title: "Installation Utility Air Piping SGP & TNP", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 18, year: 2026, title: "Inspection Overhead Crane No. 1 & 2 SGP", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 19, year: 2026, title: "Repainting Dam Equipments", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 20, year: 2026, title: "Replacement Equipment of AC System at Telecommunication Room Paritohan (Nokia)", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 21, year: 2026, title: "Replacement FCU at Cable Tunnel MTR & Piping Installation at SGP UG", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 22, year: 2026, title: "Replacement Insulated Piping & Added FCU at Cable Gallery TNP", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 23, year: 2026, title: "Sandblasting & Repainting for Casing, Head Cover, & Steam Housing Unit 1 & 2 SGP", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 24, year: 2025, title: "Perawatan Kapal Keruk & Speed Boat", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 25, year: 2025, title: "Perawatan Alat Berat & Tools", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 26, year: 2026, title: "Refurbish Speed Boat V-19 (S.B. Asahan Raya I)", commitmentItem: '', pic: "Obed", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 2, year: 2026, title: "Renewal Fire Alarm System at TNP", commitmentItem: '', pic: "Eka", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 3, year: 2026, title: "Renewal Water Level System at RGD, SGD, TND, and Tailrace SGP & TNP", commitmentItem: '', pic: "Eka", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 4, year: 2026, title: "Renewal of Drencher System for XLPE Cable at Service Shaft SGP", commitmentItem: '', pic: "Eka", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 5, year: 2026, title: "Renewal of Fire Extinguisher NN-100 for MTR SGPU", commitmentItem: '', pic: "Eka", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 6, year: 2026, title: "Renewal of Rainfall No. 1, 3, 6", commitmentItem: '', pic: "Eka", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 7, year: 2026, title: "Installation Power Meter for SGP at Unit 1 & 2", commitmentItem: '', pic: "Eka", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 8, year: 2026, title: "Renewal of UPS System at SGPA", commitmentItem: '', pic: "Eka", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 9, year: 2026, title: "Service SCADA", commitmentItem: '', pic: "Eka", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 10, year: 2026, title: "Inspection of VHF Radio Communication Motorola", commitmentItem: '', pic: "Eka", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 11, year: 2026, title: "Inspection and Repair of Network at Paritohan Camp", commitmentItem: '', pic: "Eka", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 12, year: 2026, title: "Repair and Arrangement Backup Cable FO ADSS at TL 275 KV", commitmentItem: '', pic: "Eka", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 2, year: 2024, title: "Renewal Of Oil Cooler for Main Transformer No. 1, 2 SGP", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 3, year: 2026, title: "Upgrading CPU Gov & AVR Unit 3 TNP", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 4, year: 2026, title: "Upgrading CPU Gov & AVR Unit 4 TNP", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 5, year: 2026, title: "Upgrading CPU Gov & AVR Unit 3 SGP", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 6, year: 2026, title: "Upgrading CPU Gov & AVR Unit 4 SGP", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 7, year: 2026, title: "Precise Inspection MTR No. 1 and 2 SGP", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 8, year: 2026, title: "Renewal VCB SGP A/G", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 13, year: 2026, title: "Instalasi Dust Collector for Slipring TNP", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 14, year: 2026, title: "Pembelian Battery Tester Set", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 15, year: 2026, title: "Renewal Motion Detector for WT-Generator TNP", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 16, year: 2026, title: "BoreScope for Cooling System", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 17, year: 2026, title: "Purchasing DC High Voltage Test", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 20, year: 2026, title: "Renewal Inspection Drone", commitmentItem: '', pic: "Azwil", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 25, year: 2026, title: "Petugas Pemantauan Jaringan Transmisi dan Kebersihan Tapak Tower", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 26, year: 2025, title: "Petugas Pemantauan Jaringan Transmisi dan Kebersihan Tapak Tower", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 27, year: 2026, title: "Minor Repair Maintenance TL", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 29, year: 2026, title: "Inspection of Stator Coil SGP No. 1", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 30, year: 2026, title: "Inspection of Stator Coil SGP No. 2", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 31, year: 2025, title: "Elevator Service SGP (2025)", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 32, year: 2026, title: "Elevator Service SGP (2026)", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 33, year: 2026, title: "Labour Overhaul Unit No. 1 and 2 SGP", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 34, year: 2026, title: "Pembaharuan Sistem Penerangan Power House SGP dan TNP", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 35, year: 2026, title: "Inspection Governor 1, 2 TNP", commitmentItem: '', pic: "Azwil", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 2, year: 2026, title: "Pembelian GPS Geodetic", commitmentItem: '', pic: "Irfan", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 3, year: 2025, title: "Pengadaan Log Boom Bendungan Tangga", commitmentItem: '', pic: "Irfan", type: 'CAPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 4, year: 2026, title: "Improvement Struktur Gallery (2025)", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 5, year: 2026, title: "Improvement Struktur Gallery (2026)", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 6, year: 2026, title: "Rust Treatment and Repainting of Tower (2025)", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 7, year: 2026, title: "Rust Treatment and Repainting of Tower (2026)", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 8, year: 2026, title: "Konstruksi Jalan Patrol 275 KV (2025)", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 9, year: 2026, title: "Konstruksi Jalan Patrol 275 KV (2026)", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 10, year: 2025, title: "Proteksi Tower Transmisi 275 kV", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 11, year: 2026, title: "Konsultansi Pemutahiran Rencana Tindak Darurat Bendungan", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 12, year: 2026, title: "Konsultansi Instrumentasi Bendungan", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 13, year: 2026, title: "Pemetaan Bawah Air Intake Bendungan Tangga", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 14, year: 2026, title: "Pembongkaran Struktur Tower Microwave Batu Rosak", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 15, year: 2026, title: "Scanning Dokumen Project Completion Report", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 16, year: 2026, title: "Repair, Maintenance, & Drainase", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 17, year: 2026, title: "Renovasi Gudang Dokumen Kantor Paritohan", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 18, year: 2026, title: "Man Power Perawatan Bendungan dan PLTA", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 19, year: 2025, title: "Renovasi Bangunan PLTA", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 20, year: 2025, title: "Renovasi Kantor Siguragura Tahap I", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 21, year: 2025, title: "Renovasi Toilet Kantor Siguragura", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 22, year: 2025, title: "Pemeliharaan Gravel Switchyard SGP", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 23, year: 2026, title: "Pekerjaan Emergency (Inspeksi & Perbaikan Instrumen Bendungan)", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' },
    { no: 24, year: 2025, title: "Pengaspalan Jalan", commitmentItem: '', pic: "Irfan", type: 'OPEX', stages: dateMap(), vendor: '', contractAmountIDR: 0, startDate: '', finishDate: '', actualFinish: '', guaranteeUntil: '', paidPercent: 0, rkapBudgetUSD: null, hpsUSD: 0, scsDate: '', specialStatus: 'normal' }
  ];
  return rows.map((row) => ({
    ...row,
    id: randomUUID(),
    fieldSources: Object.fromEntries(STAGES.map((stage) => [`stages.${stage.key}`, 'Manual' as const]))
  }));
}

function configuredPassword(key: string): string | undefined {
  const val = process.env[key];
  return val && val.trim() ? val : undefined;
}

async function createInitialState(): Promise<AppState> {
  await mkdir(dataDir, { recursive: true });
  const roundsRaw = Number(process.env.BCRYPT_ROUNDS || 12);
  const rounds = Math.max(10, Math.min(14, Number.isFinite(roundsRaw) ? Math.floor(roundsRaw) : 12));
  const definitions = [
    { username: 'eka', displayName: 'Eka', role: 'pic' as const, picName: 'Eka', env: 'DEMO_PASSWORD_EKA' },
    { username: 'azwil', displayName: 'Azwil', role: 'pic' as const, picName: 'Azwil', env: 'DEMO_PASSWORD_AZWIL' },
    { username: 'irfan', displayName: 'Irfan', role: 'pic' as const, picName: 'Irfan', env: 'DEMO_PASSWORD_IRFAN' },
    { username: 'obed', displayName: 'Obed', role: 'pic' as const, picName: 'Obed', env: 'DEMO_PASSWORD_OBED' },
    { username: 'mentor', displayName: 'Mentor PPS', role: 'viewer' as const, picName: null, env: 'DEMO_PASSWORD_MENTOR' },
    { username: 'admin', displayName: 'Administrator PPS', role: 'admin' as const, picName: null, env: 'DEMO_PASSWORD_ADMIN' }
  ];
  const users: UserRecord[] = [];
  const generated: { username: string; password: string }[] = [];
  for (const def of definitions) {
    const password = configuredPassword(def.env) || randomBytes(12).toString('base64url');
    if (!configuredPassword(def.env)) generated.push({ username: def.username, password });
    users.push({ id: randomUUID(), username: def.username, displayName: def.displayName, role: def.role, picName: def.picName, passwordHash: await bcrypt.hash(password, rounds) });
  }
  const state: AppState = {
    version: 1, users, sessions: {}, loginAttempts: {}, jobs: makeSeedJobs(), audit: [], lastSync: new Date().toISOString()
  };
  await saveInitialState(state);
  if (generated.length) {
    console.log('\n[Aplikasi Monitoring RKAP] Kata sandi demo dibuat secara acak. Simpan sekarang; kata sandi hanya ditampilkan saat akun pertama dibuat.');
    for (const item of generated) console.log(`  ${item.username} : ${item.password}`);
    console.log('Atur kata sandi eksplisit lewat .env sebelum pengguna pertama kali dibuat bila diperlukan.\n');
  }
  return state;
}

async function saveInitialState(state: AppState) {
  await mkdir(dirname(statePath), { recursive: true });
  const tmp = `${statePath}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tmp, statePath);
}

async function init() {
  try {
    const text = await readFile(statePath, 'utf8');
    const state = JSON.parse(text) as AppState;
    // Migrasi aman: tambahkan akun admin terpisah pada data lama tanpa menimpa pekerjaan.
    if (!state.users.some((user) => user.role === 'admin')) {
      const configured = configuredPassword('DEMO_PASSWORD_ADMIN');
      const password = configured || randomBytes(16).toString('base64url');
      const roundsRaw = Number(process.env.BCRYPT_ROUNDS || 12);
      const rounds = Math.max(10, Math.min(14, Number.isFinite(roundsRaw) ? Math.floor(roundsRaw) : 12));
      state.users.push({
        id: randomUUID(), username: 'admin', displayName: 'Administrator PPS',
        role: 'admin', picName: null, passwordHash: await bcrypt.hash(password, rounds)
      });
      await saveInitialState(state);
      if (!configured) console.log(`\n[Monitoring RKAP] Akun admin baru dibuat. Simpan kata sandi ini sekarang: admin : ${password}\n`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    await createInitialState();
  }
}

export async function ensureInitialized() {
  if (!initPromise) initPromise = init();
  await initPromise;
}

export async function readState(): Promise<AppState> {
  await ensureInitialized();
  const text = await readFile(statePath, 'utf8');
  return JSON.parse(text) as AppState;
}

export async function updateState<T>(updater: (state: AppState) => T | Promise<T>): Promise<T> {
  await ensureInitialized();
  let resolveResult!: (value: T | PromiseLike<T>) => void;
  let rejectResult!: (reason?: unknown) => void;
  const result = new Promise<T>((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
  writeQueue = writeQueue.then(async () => {
    try {
      const state = await readState();
      const value = await updater(state);
      await saveInitialState(state);
      resolveResult(value);
    } catch (err) { rejectResult(err); }
  });
  await writeQueue;
  return result;
}

export async function addAudit(record: Omit<AuditRecord, 'id' | 'at'>) {
  return updateState((state) => {
    state.audit.unshift({ ...record, id: randomUUID(), at: new Date().toISOString() });
    if (state.audit.length > 10000) state.audit.length = 10000;
  });
}

export async function updateSyncTimestamp() {
  const at = new Date().toISOString();
  await updateState((state) => { state.lastSync = at; });
  return at;
}

export function getStateFilePath() { return statePath; }
