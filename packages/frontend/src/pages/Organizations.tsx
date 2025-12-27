import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Crown,
  Shield,
  User,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { organizations } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";

// Modal wrapper using portal
function Modal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  createdAt: string;
  updatedAt: string;
}

interface Member {
  id: string;
  role: "owner" | "admin" | "member";
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

export function Organizations() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [viewingMembers, setViewingMembers] = useState<Organization | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const orgsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizations.list(),
  });

  const orgList: Organization[] = orgsQuery.data?.data?.items || [];

  const filteredOrgs = orgList.filter(
    (org) =>
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleMenuClick = (orgId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenu(activeMenu === orgId ? null : orgId);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Organizações
          </h1>
          <p className="text-slate-600 mt-1">
            Gerencie suas organizações e equipes
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Organização
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar organizações..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Organizations Grid */}
      {orgsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-slate-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredOrgs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrgs.map((org) => (
            <div key={org.id} className="card-hover p-6 group relative">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {org.logo ? (
                    <img
                      src={org.logo}
                      alt={org.name}
                      className="w-14 h-14 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900">{org.name}</h3>
                    <p className="text-sm text-slate-500">@{org.slug}</p>
                  </div>
                </div>

                <div className="relative">
                  <button
                    className="p-1.5 hover:bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleMenuClick(org.id, e)}
                  >
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>

                  {activeMenu === org.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setActiveMenu(null)}
                      />
                      <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                        <button
                          onClick={() => {
                            setViewingMembers(org);
                            setActiveMenu(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Users className="w-4 h-4" />
                          Ver Membros
                        </button>
                        <button
                          onClick={() => {
                            setEditingOrg(org);
                            setActiveMenu(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setDeletingOrg(org);
                            setActiveMenu(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setViewingMembers(org)}
                  className="text-slate-500 hover:text-primary-600 flex items-center gap-1.5 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  Ver equipe
                </button>
                <span className="text-slate-400">
                  {formatRelativeTime(org.updatedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Nenhuma organização encontrada
          </h3>
          <p className="text-slate-500 mb-6">
            {search
              ? "Tente uma busca diferente"
              : "Crie sua primeira organização para começar"}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar Organização
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingOrg) && (
        <OrganizationModal
          organization={editingOrg}
          onClose={() => {
            setShowCreateModal(false);
            setEditingOrg(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingOrg && (
        <DeleteConfirmModal
          organization={deletingOrg}
          onClose={() => setDeletingOrg(null)}
        />
      )}

      {/* Members Modal */}
      {viewingMembers && (
        <MembersModal
          organization={viewingMembers}
          onClose={() => setViewingMembers(null)}
        />
      )}
    </div>
  );
}

// Create/Edit Organization Modal
function OrganizationModal({
  organization,
  onClose,
}: {
  organization: Organization | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(organization?.name || "");
  const [slug, setSlug] = useState(organization?.slug || "");
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!organization;

  const generateSlug = (name: string) => {
    return (
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || ""
    );
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!isEditing) {
      setSlug(generateSlug(value));
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      organizations.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Erro ao criar organização");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      organizations.update(organization!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Erro ao atualizar organização");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("O nome é obrigatório");
      return;
    }

    if (!slug.trim()) {
      setError("O identificador é obrigatório");
      return;
    }

    const data = { name: name.trim(), slug: slug.trim() };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <h2 className="text-xl font-display font-bold text-slate-900">
              {isEditing ? "Editar Organização" : "Nova Organização"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nome da Organização
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Minha Empresa"
                  className="input"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Identificador (slug)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    @
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) =>
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                      )
                    }
                    placeholder="minha-empresa"
                    className="input pl-8"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Usado para identificar sua organização. Apenas letras minúsculas, números e hífens.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={isPending || !name.trim() || !slug.trim()}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {isEditing ? "Salvando..." : "Criando..."}
                  </>
                ) : isEditing ? (
                  "Salvar Alterações"
                ) : (
                  "Criar Organização"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  organization,
  onClose,
}: {
  organization: Organization;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => organizations.delete(organization.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Erro ao excluir organização");
    },
  });

  const handleDelete = () => {
    if (confirmName !== organization.name) {
      setError("O nome não corresponde");
      return;
    }
    deleteMutation.mutate();
  };

  return (
    <Modal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
          <div className="p-6">
            <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>

            <h2 className="text-xl font-display font-bold text-slate-900 text-center mb-2">
              Excluir Organização
            </h2>

            <p className="text-slate-600 text-center mb-6">
              Esta ação é <strong>irreversível</strong>. Todos os projetos,
              cronogramas e dados associados a{" "}
              <strong>"{organization.name}"</strong> serão permanentemente
              excluídos.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Digite <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{organization.name}</span> para confirmar
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder="Nome da organização"
                className="input"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger flex-1"
                disabled={
                  deleteMutation.isPending || confirmName !== organization.name
                }
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Members Modal
function MembersModal({
  organization,
  onClose,
}: {
  organization: Organization;
  onClose: () => void;
}) {
  const membersQuery = useQuery({
    queryKey: ["organization-members", organization.id],
    queryFn: () => organizations.getMembers(organization.id),
  });

  const members: Member[] = membersQuery.data?.data?.items || [];

  return (
    <Modal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900">
                Membros da Equipe
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">{organization.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {membersQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 animate-pulse"
                  >
                    <div className="w-10 h-10 bg-slate-200 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : members.length > 0 ? (
              <div className="space-y-2">
                {members.map((member) => {
                  const RoleIcon = ROLE_ICONS[member.role] || User;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      {member.user.image ? (
                        <img
                          src={member.user.image}
                          alt={member.user.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-700">
                            {member.user.name?.[0] || member.user.email?.[0] || "?"}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {member.user.name || "Sem nome"}
                        </p>
                        <p className="text-sm text-slate-500 truncate">
                          {member.user.email}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                          member.role === "owner"
                            ? "bg-amber-100 text-amber-700"
                            : member.role === "admin"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        <RoleIcon className="w-3.5 h-3.5" />
                        {ROLE_LABELS[member.role]}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nenhum membro encontrado</p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-200">
            <p className="text-sm text-slate-500 text-center">
              {members.length} {members.length === 1 ? "membro" : "membros"} na
              organização
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

