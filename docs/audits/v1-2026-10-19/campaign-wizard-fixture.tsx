// Audit-only host for the unchanged current Campaigns page. Authentication and APIs
// are fixture boundaries; browser tests do not contact Clerk or any application DB.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import Campaigns from '@/pages/campaigns';
import { queryClient } from '@/lib/queryClient';
import { ClientProvider } from '@/lib/clientContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}><ClientProvider><TooltipProvider>
    <Campaigns /><Toaster />
  </TooltipProvider></ClientProvider></QueryClientProvider>
);
