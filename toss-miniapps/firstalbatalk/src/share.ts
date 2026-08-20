import { getTossShareLink } from '@apps-in-toss/web-framework';

export const DEFAULT_SHARE_PATH = 'intoss://firstalbatalk';
export const SHARE_TITLE = '첫알바톡';
export const SHARE_DESCRIPTION = '첫 알바 근무기록과 예상 급여를 간편하게 관리해 보세요.';

export function resolveSharePath(rawPath: string | undefined | null): string {
  const trimmed = rawPath?.trim() ?? '';
  return trimmed || DEFAULT_SHARE_PATH;
}

export async function createTossShareLink(path: string): Promise<string> {
  try {
    return await getTossShareLink(path);
  } catch {
    return path;
  }
}
