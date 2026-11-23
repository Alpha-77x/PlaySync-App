import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.playsync.arena',
  appName: 'PlaySync',
  webDir: 'dist',
  backgroundColor: '#000000',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
