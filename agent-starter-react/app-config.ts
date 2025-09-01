import type { AppConfig } from './lib/types';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'QuantiMedX',
  pageTitle: 'QuantiVision MiMi',
  pageDescription: 'MiMi is your virtual assistant for all things QuantiMedX.',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,

  logo: '/logo.png',
  accent: '#002cf2',
  logoDark: '/logo.png',
  accentDark: '#1fd5f9',
  startButtonText: 'Start call',
};
