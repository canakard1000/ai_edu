import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'seller-margin',
  brand: { primaryColor: '#3182F6' },
  permissions: [],
  webBundleDir: 'dist',
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
    withTitle: true,
    transparentBackground: false,
    theme: 'light',
  },
});
