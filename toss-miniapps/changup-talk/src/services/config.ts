export const APP_ENV = {
  appName: import.meta.env.VITE_APP_NAME ?? '창업톡',
  baseUrl: import.meta.env.VITE_APP_BASE_URL ?? 'http://localhost:5173',
  adGroupId: import.meta.env.VITE_TOSS_AD_GROUP_ID ?? 'TODO_REPLACE_WITH_OPERATIONAL_ID',
  proxyBaseUrl: import.meta.env.VITE_API_PROXY_BASE_URL ?? '',
  sbdcApiKey: import.meta.env.VITE_SBDC_API_KEY ?? '',
  rebApiKey: import.meta.env.VITE_REB_API_KEY ?? '',
  kosisApiKey: import.meta.env.VITE_KOSIS_API_KEY ?? '',
  ftcApiKey: import.meta.env.VITE_FTC_API_KEY ?? '',
  sbdcApiUrl: import.meta.env.VITE_SBDC_API_URL ?? '',
  rebApiUrl: import.meta.env.VITE_REB_API_URL ?? '',
  kosisApiUrl: import.meta.env.VITE_KOSIS_API_URL ?? '',
  ftcApiUrl: import.meta.env.VITE_FTC_API_URL ?? ''
} as const;
