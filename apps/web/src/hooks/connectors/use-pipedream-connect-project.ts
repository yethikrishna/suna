'use client';

import { useMutation } from '@tanstack/react-query';

import { errorToast, successToast } from '@/components/ui/toast';
import { runConnectLinkFlow } from '@/hooks/connectors/use-connect-link';
import {
  pipedreamConnectConnection,
  pipedreamFinalizeConnection,
  reconcileConnection,
} from '@kortix/sdk';

/**
 * Connect a labelled project-owned account under one connector.
 */
export function usePipedreamConnectProject(
  projectId: string,
  slug: string,
  onConnected: () => void,
) {
  return useMutation({
    mutationFn: async (input?: { label?: string }) => {
      const connection = await reconcileConnection(projectId, {
        connector_alias: slug,
        owner_type: 'project',
        label: input?.label?.trim() || 'Project connection',
      });
      const connect = await pipedreamConnectConnection(projectId, connection.connection_id);
      return runConnectLinkFlow(connect, () =>
        pipedreamFinalizeConnection(projectId, connection.connection_id),
      );
    },
    onSuccess: (result) => {
      if (!result.connected) return;
      successToast('Project connection created');
      onConnected();
    },
    onError: (error: Error) => errorToast(error.message),
  });
}
