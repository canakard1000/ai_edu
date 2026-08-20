function required(name, environment) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

export function readConfig(environment = process.env) {
  return {
    webhookAuthorization: required('TOSS_WEBHOOK_AUTHORIZATION', environment),
    monthlySku: required('PRO_MONTHLY_SKU', environment),
    annualSku: required('PRO_ANNUAL_SKU', environment),
    kvUrl: required('ENTITLEMENT_KV_REST_URL', environment),
    kvToken: required('ENTITLEMENT_KV_REST_TOKEN', environment),
  };
}
