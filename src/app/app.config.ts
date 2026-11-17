import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';

import { pt_BR, provideZardI18n } from '@/shared/core/i18n';
import { provideZard } from '@/shared/core/provider/providezard';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    provideZard(),
    provideZardI18n(pt_BR),
    provideHttpClient(withXhr()),
  ],
};
