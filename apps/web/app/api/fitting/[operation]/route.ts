import { createClient } from "@/lib/supabase/server";

export const maxDuration = 240;

// The web session also works in the Chrome side panel with a host permission for BuyFit.
// A custom header forces a preflight for cross-origin web pages; no CORS permission is issued.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ operation: string }> },
) {
  const { operation } = await params;
  if (!["avatar", "tryon", "capture", "identify", "search"].includes(operation))
    return new Response(null, { status: 404 });
  if (request.headers.get("X-BuyFit-Request") !== "fitting")
    return Response.json({ error: "Requête invalide." }, { status: 403 });
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session)
    return Response.json(
      { error: "Connecte-toi sur le site BuyFit dans ce navigateur." },
      { status: 401 },
    );
  const type = request.headers.get("content-type");
  if (!type || !request.body) return new Response(null, { status: 400 });
  // The API independently verifies the forwarded access token and enforces the upload limit.
  const upstream = await fetch(
    new URL("/" + operation, process.env.API_URL || "http://localhost:8787"),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": type },
      body: request.body,
      duplex: "half",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(215_000),
    } as RequestInit,
  ).catch(() => null);
  if (!upstream) return Response.json({ error: "L’API BuyFit est indisponible." }, { status: 503 });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}
