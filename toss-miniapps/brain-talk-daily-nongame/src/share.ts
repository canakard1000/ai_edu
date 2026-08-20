import { getTossShareLink } from '@apps-in-toss/web-framework';
export const SHARE_PATH='intoss://brain-talk-daily-nongame';
export async function createShareLink():Promise<string>{try{return await getTossShareLink(SHARE_PATH);}catch{return SHARE_PATH;}}
