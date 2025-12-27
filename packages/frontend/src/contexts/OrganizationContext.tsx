import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

interface OrganizationContextType {
  selectedOrganizationId: string | null;
  setSelectedOrganizationId: (id: string | null) => void;
  selectedOrganization: Organization | null;
  setSelectedOrganization: (org: Organization | null) => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const STORAGE_KEY = 'planneer_selected_organization_id';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState<string | null>(() => {
    // Load from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored || null;
    }
    return null;
  });
  
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

  // Persist to localStorage whenever selectedOrganizationId changes
  useEffect(() => {
    if (selectedOrganizationId) {
      localStorage.setItem(STORAGE_KEY, selectedOrganizationId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedOrganizationId]);

  const setSelectedOrganizationId = (id: string | null) => {
    setSelectedOrganizationIdState(id);
    // Clear selected organization when ID changes
    if (!id) {
      setSelectedOrganization(null);
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        selectedOrganizationId,
        setSelectedOrganizationId,
        selectedOrganization,
        setSelectedOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganizationContext must be used within an OrganizationProvider');
  }
  return context;
}

