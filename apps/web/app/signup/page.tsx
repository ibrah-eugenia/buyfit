"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Circle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSession } from "@/components/app-providers";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { FieldError } from "@/components/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/mocks";
import { PASSWORD_RULES, SignupSchema, type SignupInput } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const { reload } = useSession();
  const [erreur, setErreur] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { email: "", password: "", confirmation: "" },
  });
  const password = useWatch({ control, name: "password" }) ?? "";

  async function onSubmit(values: SignupInput) {
    setErreur(null);
    try {
      await signUp(values);
      await reload();
      router.push("/onboarding");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Inscription impossible.");
    }
  }

  return (
    <AuthShell
      title="Créer mon compte"
      description="Ton email et un mot de passe. On complète ton profil juste après."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {erreur && (
          <Alert variant="destructive">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="prenom@exemple.fr"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-err" : undefined}
            {...register("email")}
          />
          <FieldError id="email-err" message={errors.email?.message} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-rules"
            {...register("password")}
          />
          <ul
            id="password-rules"
            className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1"
            aria-label="Règles du mot de passe"
          >
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li
                  key={r.id}
                  className={cn(
                    "flex items-center gap-1.5 text-caption",
                    ok ? "text-success" : "text-grey",
                  )}
                >
                  {ok ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Circle className="size-3" aria-hidden="true" />
                  )}
                  {r.label}
                  <span className="sr-only">{ok ? " : respecté" : " : à respecter"}</span>
                </li>
              );
            })}
          </ul>
          <FieldError message={errors.password?.message} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
          <PasswordInput
            id="confirmation"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmation}
            aria-describedby={errors.confirmation ? "confirmation-err" : undefined}
            {...register("confirmation")}
          />
          <FieldError id="confirmation-err" message={errors.confirmation?.message} />
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? "Création du compte…" : "Créer mon compte"}
        </Button>
      </form>
    </AuthShell>
  );
}
