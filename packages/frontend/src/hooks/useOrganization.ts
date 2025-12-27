import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { organizations } from "@/lib/api";
import { useAuth } from "./useAuth";
import { useOrganizationContext } from "@/contexts/OrganizationContext";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

export function useOrganization() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const {
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedOrganization,
    setSelectedOrganization,
  } = useOrganizationContext();

  const orgsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      console.log("[useOrganization] Fetching organizations...");
      const result = await organizations.list();
      console.log("[useOrganization] API Response:", result);
      return result;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  const userOrgs: Organization[] =
    orgsQuery.data?.data?.items?.map((item: any) => {
      const org = item.organization || item;
      return org;
    }) || [];

  // Auto-select first organization if none is selected and organizations are available
  useEffect(() => {
    if (
      userOrgs.length > 0 &&
      !selectedOrganizationId &&
      !orgsQuery.isLoading &&
      isAuthenticated
    ) {
      setSelectedOrganizationId(userOrgs[0].id);
      setSelectedOrganization(userOrgs[0]);
    }
  }, [userOrgs, selectedOrganizationId, orgsQuery.isLoading, isAuthenticated, setSelectedOrganizationId, setSelectedOrganization]);

  // Update selected organization when ID changes or organizations list updates
  useEffect(() => {
    if (selectedOrganizationId && userOrgs.length > 0) {
      const org = userOrgs.find((o) => o.id === selectedOrganizationId);
      if (org) {
        setSelectedOrganization(org);
      } else {
        // Selected organization no longer exists, select first available
        if (userOrgs.length > 0) {
          setSelectedOrganizationId(userOrgs[0].id);
          setSelectedOrganization(userOrgs[0]);
        } else {
          setSelectedOrganizationId(null);
          setSelectedOrganization(null);
        }
      }
    }
  }, [selectedOrganizationId, userOrgs, setSelectedOrganizationId, setSelectedOrganization]);

  const currentOrganization = selectedOrganization || null;

  return {
    organizations: userOrgs,
    currentOrganization,
    selectedOrganizationId,
    setSelectedOrganizationId: (id: string | null) => {
      setSelectedOrganizationId(id);
      const org = id ? userOrgs.find((o) => o.id === id) : null;
      setSelectedOrganization(org || null);
    },
    hasOrganization: userOrgs.length > 0,
    isLoading: isAuthLoading || orgsQuery.isLoading,
    isError: orgsQuery.isError,
    error: orgsQuery.error,
  };
}
