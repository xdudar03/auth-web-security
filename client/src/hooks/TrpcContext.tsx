'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { useMemo, useState } from 'react';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from '../../../server/src/app';
import useJwt from './useJwt';

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}
let browserQueryClient: QueryClient | undefined = undefined;
function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
export function TrpcContext({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const { jwt } = useJwt();
  console.log('jwt in trpc context before creating client: ', jwt);

  const trpcClient = useMemo(
    () =>
      createTRPCClient<AppRouter>({
        links: [
          httpBatchLink({
            url: 'http://localhost:4000/trpc',
            headers() {
              return jwt ? { Authorization: `Bearer ${jwt}` } : {};
            },
            fetch(url, options) {
              return globalThis.fetch(url, {
                ...options,
                credentials: 'include',
              });
            },
          }),
        ],
      }),
    [jwt] // Recreate client when JWT changes
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {/* Your app here */}
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
