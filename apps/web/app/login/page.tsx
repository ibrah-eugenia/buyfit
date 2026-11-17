"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSession } from "@/components/app-providers";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-input";
import { FieldError } from "@/components/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/mocks";
import { LoginSchema, type LoginInput } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { reload } = useSession();
  const [erreur, setErreur] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setErreur(null);
    try {
      await signIn(values);
      await reload();
      router.push("/dashboard");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Connexion impossible.");
    }
  }

  return (
    <AuthShell
      title="Se connecter"
      description="Content de te revoir."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link
            href="/signup"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Créer mon compte
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
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-err" : undefined}
            {...register("password")}
          />
          <FieldError id="password-err" message={errors.password?.message} />
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </AuthShell>
  );
}
