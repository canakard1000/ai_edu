import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'skinroutine',
  brand: {
    primaryColor: '#FF846B',
  },
  permissions: [{ name: 'camera', access: 'access' }],
  webBundleDir: 'dist',
});
