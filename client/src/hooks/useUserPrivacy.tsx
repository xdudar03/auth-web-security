import { useTRPC } from './TrpcContext';
import { useQuery } from '@tanstack/react-query';

export default function useUserPrivacy(
  userFields: { pseudoId: string; field: string }[]
) {
  const trpc = useTRPC();
  const getUserPrivacyQuery = useQuery(
    trpc.privacy.getUsersPrivacy.queryOptions({
      userFields: userFields,
    })
  );

  return { userPrivacy: getUserPrivacyQuery.data };
}
