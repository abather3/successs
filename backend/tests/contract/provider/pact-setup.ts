import { Pact } from '@pact-foundation/pact';
import { resolve } from 'path';

export const setupProvider = ({ providerName }: { providerName: string }) => {
  return new Pact({
    cors: true,
    port: 1234,
    log: resolve(process.cwd(), 'logs', 'pact.log'),
    dir: resolve(process.cwd(), 'pacts'),
    spec: 2,
    consumer: 'FrontendClient',
    provider: providerName,
  });
};
