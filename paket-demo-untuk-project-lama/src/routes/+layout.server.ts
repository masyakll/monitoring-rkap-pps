import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async () => ({
  isDemoMode: (process.env.DATA_SOURCE || 'dummy').trim().toLowerCase() === 'dummy'
});
