export const SELLER_MARGIN_DEEP_LINK = 'intoss://seller-margin';

export function createShareMessage(link) {
  return `셀러마진\n판매 전에 순이익을 빠르게 계산해 보세요.\n${link}`;
}

export async function shareSellerMargin({ createLink, sendMessage }) {
  const link = await createLink(SELLER_MARGIN_DEEP_LINK);
  await sendMessage({ message: createShareMessage(link) });
  return link;
}
