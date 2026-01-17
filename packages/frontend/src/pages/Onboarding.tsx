import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Calendar,
  Building2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { organizations } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createOrgMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      organizations.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setStep(3);
      // Redirect after a short delay to show success
      setTimeout(() => {
        navigate({ to: "/" });
      }, 2000);
    },
    onError: (err: Error) => {
      setError(err.message || "Erro ao criar organização. Tente novamente.");
    },
  });

  const generateSlug = (name: string) => {
    return (
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `org-${Date.now()}`
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orgName.trim()) {
      setError("Por favor, insira um nome para sua organização.");
      return;
    }

    createOrgMutation.mutate({
      name: orgName.trim(),
      slug: generateSlug(orgName),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Calendar className="w-9 h-9 text-white" />
          </div>
          <h1 className="font-display font-bold text-3xl text-gradient">
            Planneer
          </h1>
          <p className="text-slate-500 mt-1">Cronogramas Inteligentes</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-8 bg-primary-500"
                  : s < step
                  ? "w-8 bg-primary-300"
                  : "w-2 bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="card p-8">
          {step === 1 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-primary-600" />
              </div>
              <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">
                Bem-vindo, {user?.name?.split(" ")[0] || "usuário"}! 👋
              </h2>
              <p className="text-slate-600 mb-8">
                Vamos configurar sua conta em poucos passos para você começar a
                criar cronogramas incríveis com inteligência artificial.
              </p>
              <button
                onClick={() => setStep(2)}
                className="btn-primary w-full text-lg py-3"
              >
                Começar
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit}>
              <div className="w-16 h-16 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-display font-bold text-slate-900 text-center mb-2">
                Crie sua Organização
              </h2>
              <p className="text-slate-600 text-center mb-6">
                Organizações permitem gerenciar projetos, cronogramas e
                colaborar com sua equipe.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome da Organização
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Ex: Minha Empresa, Equipe de Projetos..."
                  className="input text-lg"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-2">
                  Você pode alterar isso depois nas configurações.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary flex-1"
                  disabled={createOrgMutation.isPending}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={createOrgMutation.isPending || !orgName.trim()}
                >
                  {createOrgMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Criando...
                    </>
                  ) : (
                    <>
                      Criar Organização
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">
                Tudo pronto! 🎉
              </h2>
              <p className="text-slate-600 mb-4">
                Sua organização <strong>"{orgName}"</strong> foi criada com
                sucesso.
              </p>
              <p className="text-slate-500 text-sm">
                Redirecionando para o dashboard...
              </p>
              <div className="mt-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
              </div>
            </div>
          )}
        </div>

        {/* Features preview */}
        {step === 1 && (
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              {
                icon: "🤖",
                title: "IA Inteligente",
                desc: "Cronogramas personalizados",
              },
              {
                icon: "📊",
                title: "Exportação P6",
                desc: "XER e XML compatíveis",
              },
              {
                icon: "📚",
                title: "Templates",
                desc: "Base histórica de projetos",
              },
              { icon: "👥", title: "Colaboração", desc: "Trabalhe em equipe" },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white/60 backdrop-blur rounded-xl p-4 text-center"
              >
                <div className="text-2xl mb-2">{feature.icon}</div>
                <p className="font-medium text-slate-900 text-sm">
                  {feature.title}
                </p>
                <p className="text-xs text-slate-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





