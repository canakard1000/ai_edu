import { getTossShareLink } from '@apps-in-toss/web-framework';

export const SHARE_PATH = 'intoss://ddakmoyeo';
export const SHARE_TITLE = '딱모여';
export const SHARE_DESCRIPTION = '오늘 함께할 사람을 딱, 모아보세요.';

export async function createShareLink(): Promise<string> {
  try { return await getTossShareLink(SHARE_PATH); } catch { return SHARE_PATH; }
}
