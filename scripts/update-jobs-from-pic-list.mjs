import { readFile, copyFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

const statePath = resolve('data/state.json');
const dataPath = resolve('data/daftar-pekerjaan-pic.json');
const keys = [
  'kakReceived', 'hpsPrepared', 'hpsApprovalStarted', 'hpsFinalApproved',
  'prCreated', 'prReleased', 'tenderBriefing', 'quotationReceived',
  'technicalEvaluation', 'teSentToSom', 'negotiation', 'winnerSelected',
  'contractSigned', 'executionStarted'
];

let state;
let rows;
try {
  state = JSON.parse(await readFile(statePath, 'utf8'));
  rows = JSON.parse(await readFile(dataPath, 'utf8'));
} catch (error) {
  console.error('Gagal membaca data/state.json atau data/daftar-pekerjaan-pic.json:', error.message);
  process.exit(1);
}
if (!state || !Array.isArray(state.users) || !Array.isArray(state.jobs)) {
  console.error('Struktur data/state.json tidak sesuai; tidak ada perubahan yang disimpan.');
  process.exit(1);
}
if (!Array.isArray(rows) || rows.length !== 82) {
  console.error('Daftar pekerjaan tidak lengkap; diharapkan 82 baris. Tidak ada perubahan yang disimpan.');
  process.exit(1);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = resolve('data', `state.backup-before-pic-data-${stamp}.json`);
await copyFile(statePath, backupPath);
const jobs = rows.map((row) => ({
  id: `seed-${String(row.pic).toLowerCase()}-${row.no}`,
  no: row.no,
  year: row.year,
  title: row.title,
  commitmentItem: '',
  pic: row.pic,
  type: row.type,
  stages: Object.fromEntries(keys.map((key) => [key, ''])),
  vendor: '',
  contractAmountIDR: 0,
  startDate: '',
  finishDate: '',
  actualFinish: '',
  guaranteeUntil: '',
  paidPercent: 0,
  rkapBudgetUSD: null,
  hpsUSD: 0,
  scsDate: '',
  specialStatus: 'normal',
  fieldSources: Object.fromEntries(keys.map((key) => [`stages.${key}`, 'Manual']))
}));
state.jobs = jobs;
state.lastSync = new Date().toISOString();
const tempPath = `${statePath}.${process.pid}.tmp`;
await writeFile(tempPath, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
await rename(tempPath, statePath);
console.log(`Berhasil memperbarui ${jobs.length} pekerjaan dari daftar PIC.`);
console.log('Data pengguna/password, sesi, konfigurasi, dan log audit tidak diubah.');
console.log(`Cadangan lama: ${backupPath}`);
console.log('Catatan: riwayat audit sebelumnya mungkin masih merujuk ke pekerjaan demo lama.');
