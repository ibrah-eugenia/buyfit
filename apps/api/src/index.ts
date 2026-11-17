import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { config } from "./config.js";

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`BuyFit API → http://localhost:${info.port}`);
  const mocked = Object.entries(config.mocks)
    .filter(([, on]) => on)
    .map(([name]) => name);
  console.log(mocked.length ? `Mocks actifs : ${mocked.join(", ")}` : "Aucun mock actif");
});
