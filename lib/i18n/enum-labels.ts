import type {
  AdminLocale,
  Condition,
  PostStatus,
  StockTransactionType,
  SupplyOrderStatus,
  SubscriberStatus,
} from "@prisma/client";

function pick<T extends string>(
  map: Record<T, { nl: string; en: string }>,
  value: T,
  locale: AdminLocale,
): string {
  return locale === "EN" ? map[value].en : map[value].nl;
}

const CONDITION_LABELS: Record<Condition, { nl: string; en: string }> = {
  NEW: { nl: "Nieuw", en: "New" },
  SECONDHAND: { nl: "Tweedehands", en: "Secondhand" },
};

export function conditionLabel(value: Condition, locale: AdminLocale): string {
  return pick(CONDITION_LABELS, value, locale);
}

const POST_STATUS_LABELS: Record<PostStatus, { nl: string; en: string }> = {
  DRAFT: { nl: "Concept", en: "Draft" },
  PUBLISHED: { nl: "Gepubliceerd", en: "Published" },
};

export function postStatusLabel(value: PostStatus, locale: AdminLocale): string {
  return pick(POST_STATUS_LABELS, value, locale);
}

const STOCK_TRANSACTION_TYPE_LABELS: Record<StockTransactionType, { nl: string; en: string }> = {
  IN: { nl: "In", en: "In" },
  OUT: { nl: "Uit", en: "Out" },
  ADJUSTMENT: { nl: "Aanpassing", en: "Adjustment" },
};

export function stockTransactionTypeLabel(
  value: StockTransactionType,
  locale: AdminLocale,
): string {
  return pick(STOCK_TRANSACTION_TYPE_LABELS, value, locale);
}

const SUPPLY_ORDER_STATUS_LABELS: Record<SupplyOrderStatus, { nl: string; en: string }> = {
  PENDING: { nl: "in behandeling", en: "pending" },
  PARTIAL: { nl: "deels ontvangen", en: "partial" },
  RECEIVED: { nl: "ontvangen", en: "received" },
};

export function supplyOrderStatusLabel(
  value: SupplyOrderStatus,
  locale: AdminLocale,
): string {
  return pick(SUPPLY_ORDER_STATUS_LABELS, value, locale);
}

const SUBSCRIBER_STATUS_LABELS: Record<SubscriberStatus, { nl: string; en: string }> = {
  CONFIRMED: { nl: "Bevestigd", en: "Confirmed" },
  PENDING: { nl: "In behandeling", en: "Pending" },
};

export function subscriberStatusLabel(
  value: SubscriberStatus,
  hasConfirmEmailSentAt: boolean,
  locale: AdminLocale,
): string {
  if (value === "PENDING" && !hasConfirmEmailSentAt) {
    return locale === "EN"
      ? "Pending (no email sent)"
      : "In behandeling (geen e-mail verzonden)";
  }
  return pick(SUBSCRIBER_STATUS_LABELS, value, locale);
}
