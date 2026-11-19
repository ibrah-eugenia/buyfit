import { TryOnResultSchema } from "@buyfit/shared";
import { z } from "zod";
import assert from "node:assert/strict";
import { test } from "node:test";

const userId = "642ea5ce-6ef4-4b26-aff6-5cfa272875dd";
const avatarPath = userId + "/mannequin/fixture.png";
const png = new Blob(["fixture-mannequin"], { type: "image/png" });

test("le modèle utilise le mannequin du compte authentifié pour chaque vêtement", async (t) => {
  Object.assign(process.env, {
    SUPABASE_URL: "https://storage.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fixture",
    TRYON_SERVICE_URL: "https://model.invalid",
    MOCK_SUPABASE: "false",
  });
  const { app } = await import("../src/app.js");
  let hasAvatar = false;
  let modelCalls = 0;
  let stored = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const request = new Request(input, init);
      const { pathname, searchParams } = new URL(request.url);
      if (pathname === "/auth/v1/user") {
        assert.equal(request.headers.get("authorization"), "Bearer fixture-user");
        return Response.json({ id: userId, aud: "authenticated", email: "owner@example.test" });
      }
      if (pathname === "/rest/v1/user_photos") {
        assert.equal(searchParams.get("user_id"), "eq." + userId);
        assert.equal(searchParams.get("storage_path"), "like." + userId + "/mannequin/%");
        return Response.json(hasAvatar ? [{ id: "photo", storage_path: avatarPath }] : []);
      }
      if (pathname.endsWith("/user-photos/" + avatarPath)) return new Response(png);
      if (pathname === "/tryon/account") {
        assert.equal(request.headers.get("X-BuyFit-Request"), "internal");
        const form = await request.formData();
        const person = form.get("person");
        assert.ok(person instanceof File);
        assert.equal(await person.text(), "fixture-mannequin");
        assert.equal(form.get("garment_url"), "https://i.pinimg.com/garment.png");
        modelCalls++;
        return new Response(new Blob(["fixture-result"], { type: "image/png" }));
      }
      if (pathname.startsWith("/storage/v1/object/sign/tryon-results/" + userId + "/"))
        return Response.json({
          signedURL: "/object/sign/tryon-results/" + userId + "/result?token=fixture",
        });
      if (pathname.startsWith("/storage/v1/object/tryon-results/" + userId + "/"))
        return Response.json({});
      if (pathname === "/rest/v1/tryons") {
        const row = z
          .object({ user_id: z.string(), result_storage_path: z.string() })
          .parse(await request.json());
        assert.equal(row.user_id, userId);
        assert.ok(row.result_storage_path.startsWith(userId + "/"));
        stored++;
        return new Response(null, { status: 201 });
      }
      throw new Error("Appel inattendu dans la fixture : " + pathname);
    },
  );
  const submit = (token: boolean) =>
    app.request("/tryon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: "Bearer fixture-user" }),
      },
      body: JSON.stringify({
        userId: "autre-compte",
        garmentImageUrl: "https://i.pinimg.com/garment.png",
      }),
    });
  assert.equal((await submit(false)).status, 401);
  assert.equal((await submit(true)).status, 409);
  hasAvatar = true;
  for (let i = 0; i < 2; i++) {
    const result = await submit(true);
    const body = await result.json();
    assert.equal(result.status, 200, JSON.stringify(body));
    assert.match(TryOnResultSchema.parse(body).resultImageUrl, /^https:\/\/storage\.invalid\//);
  }
  assert.equal(modelCalls, 2);
  assert.equal(stored, 2);
});
