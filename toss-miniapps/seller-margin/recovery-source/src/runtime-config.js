export function readRuntimeConfig(environment = import.meta.env) {
  return {
    monthlySku: environment.VITE_PRO_MONTHLY_SKU?.trim() ?? '',
    annualSku: environment.VITE_PRO_ANNUAL_SKU?.trim() ?? '',
    grantEndpoint: environment.VITE_PRO_GRANT_ENDPOINT?.trim() ?? '',
  };
}

export function isSubscriptionReady(config, plan) {
  const sku = plan === 'annual' ? config.annualSku : config.monthlySku;
  return Boolean(sku && config.grantEndpoint);
}
