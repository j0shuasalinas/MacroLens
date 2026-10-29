import { QueryClient } from '@tanstack/react-query';

// A separate, memory-only cache per signed-in identity. Never persist meal data.
export function createAccountQueryClient() {
  return new QueryClient({ defaultOptions: {
    queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
  } });
}
