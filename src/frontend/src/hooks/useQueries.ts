import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type {
  UserProfile,
  ChangeRequestPublicSummary,
  ChangeRequest,
  CRForm,
  ChangeRequestId,
  ApprovalAction,
  ImplementationDetails,
  ChangeRequestStatus,
} from '../backend';
import { Principal } from '@dfinity/principal';

// User Profile Queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
  });
}

export function useGetAllUserProfiles() {
  const { actor, isFetching } = useActor();

  return useQuery<[Principal, UserProfile][]>({
    queryKey: ['allUserProfiles'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllUserProfiles();
    },
    enabled: !!actor && !isFetching,
  });
}

// Change Request Queries
export function useGetAllChangeRequests() {
  const { actor, isFetching } = useActor();

  return useQuery<ChangeRequestPublicSummary[]>({
    queryKey: ['allChangeRequests'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllPublicChangeRequests();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetChangeRequestById(crId: ChangeRequestId | null) {
  const { actor, isFetching } = useActor();

  return useQuery<ChangeRequest | null>({
    queryKey: ['changeRequest', crId?.toString()],
    queryFn: async () => {
      if (!actor || !crId) return null;
      return actor.getChangeRequestById(crId);
    },
    enabled: !!actor && !isFetching && crId !== null,
  });
}

export function useGetChangeRequestsByStatus(status: ChangeRequestStatus) {
  const { actor, isFetching } = useActor();

  return useQuery<ChangeRequestPublicSummary[]>({
    queryKey: ['changeRequestsByStatus', status],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getChangeRequestsByStatus(status);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetChangeRequestStats() {
  const { actor, isFetching } = useActor();

  return useQuery({
    queryKey: ['changeRequestStats'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getChangeRequestStats();
    },
    enabled: !!actor && !isFetching,
  });
}

// Change Request Mutations
export function useCreateChangeRequest() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (form: CRForm) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createChangeRequest(form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allChangeRequests'] });
      queryClient.invalidateQueries({ queryKey: ['changeRequestStats'] });
    },
  });
}

export function useProcessApproval() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      crId,
      action,
      comments,
    }: {
      crId: ChangeRequestId;
      action: ApprovalAction;
      comments: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.processApproval(crId, action, comments);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allChangeRequests'] });
      queryClient.invalidateQueries({ queryKey: ['changeRequest'] });
      queryClient.invalidateQueries({ queryKey: ['changeRequestStats'] });
    },
  });
}

export function useAssignImplementationTeam() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ crId, teamMember }: { crId: ChangeRequestId; teamMember: Principal }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.assignImplementationTeam(crId, teamMember);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allChangeRequests'] });
      queryClient.invalidateQueries({ queryKey: ['changeRequest'] });
    },
  });
}

export function useUpdateImplementationDetails() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ crId, details }: { crId: ChangeRequestId; details: ImplementationDetails }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.updateImplementationDetails(crId, details);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allChangeRequests'] });
      queryClient.invalidateQueries({ queryKey: ['changeRequest'] });
      queryClient.invalidateQueries({ queryKey: ['changeRequestStats'] });
    },
  });
}

export function useCloseChangeRequest() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (crId: ChangeRequestId) => {
      if (!actor) throw new Error('Actor not available');
      return actor.closeChangeRequest(crId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allChangeRequests'] });
      queryClient.invalidateQueries({ queryKey: ['changeRequest'] });
      queryClient.invalidateQueries({ queryKey: ['changeRequestStats'] });
    },
  });
}
