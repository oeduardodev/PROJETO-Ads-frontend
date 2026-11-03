import { InjectionToken } from '@angular/core';
import type { PublicEnvironment } from '../../environments/public-environment.model';

export const PUBLIC_ENVIRONMENT = new InjectionToken<PublicEnvironment>('publicEnvironment');
