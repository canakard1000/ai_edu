/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_BASE_URL?: string;
  readonly VITE_TOSS_AD_GROUP_ID?: string;
  readonly VITE_COMMERCIAL_DISTRICT_API_KEY?: string;
  readonly VITE_RENT_API_KEY?: string;
  readonly VITE_STATISTICS_API_KEY?: string;
  readonly VITE_FRANCHISE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
