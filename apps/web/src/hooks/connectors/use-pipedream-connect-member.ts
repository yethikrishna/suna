'use client';

import { useMutation } from '@tanstack/react-query';

import { errorToast, successToast } from '@/components/ui/toast';
import { runConnectLinkFlow } from '@/hooks/connectors/use-connect-link';
import {
  pipedreamConnectConnection,
  pipedreamFinalizeConnection,
  reconcileMemberConnection,
} from '@kortix/sdk';

/**
 * Connect the current user's private account for a connector.
 */
export function usePipedreamConnectMember(
  projectId: string,
  slug: string,
  onConnected: () => void,
) {
  return useMutation({
    mutationFn: async (input?: { label?: string }) => {
      const connection = await reconcileMemberConnection(projectId, {
        connector_alias: slug,
        label: input?.label?.trim() || 'Private connection',
      });
      const connect = await pipedreamConnectConnection(projectId, connection.connection_id);
      return runConnectLinkFlow(connect, () =>
        pipedreamFinalizeConnection(projectId, connection.connection_id),
      );
    },
    onSuccess: (res) => {
      if (!res.connected) return;
      successToast('Connected privately — only you can use this');
      onConnected();
    },
    onError: (err: Error) => errorToast(err.message),
  });
}
