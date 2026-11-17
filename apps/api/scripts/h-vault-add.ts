/**
 * Ajoute (ou met à jour) un login marchand dans un vault H Company. Le mot de passe est saisi
 * dans TON terminal (affiché en *) et part directement chez H : il n'est ni loggé, ni écrit sur
 * disque. L'agent ne le voit jamais non plus (H le tape dans la page via `fill_secret_at`).
 *
 * Usage : pnpm --filter @buyfit/api h:vault-add <vaultId> <domaine>   (ex. uniqlo.com)
 */
import { HaiAgentsClient } from "hai-agents";

const [vaultId, domaine] = process.argv.slice(2);
if (!vaultId || !domaine) {
  console.error("Usage : h:vault-add <vaultId> <domaine>");
  process.exit(1);
}

/** Lit une ligne en mode brut. Les retours à la ligne collés sont ignorés (pas de validation prématurée). */
function prompt(question: string, mask: boolean): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    let lastKeyAt = 0;
    const onData = (chunk: string) => {
      const now = Date.now();
      const pasted = chunk.length > 1 || now - lastKeyAt < 5;
      lastKeyAt = now;
      for (const ch of chunk) {
        if (ch === "\u0003") {
          process.stdout.write("\n");
          process.exit(130); // Ctrl-C
        }
        if (ch === "\r" || ch === "\n") {
          if (pasted && chunk.length > 1) continue; // saut de ligne dans un collage : ignoré
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (ch < " ") continue;
        value += ch;
        process.stdout.write(mask ? "*" : ch);
      }
    };
    stdin.on("data", onData);
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let email = "";
while (!EMAIL.test(email)) {
  email = (await prompt(`Email du compte ${domaine} : `, false)).replace(/\s+/g, "");
  if (!EMAIL.test(email)) console.log("  Email invalide, recommence.");
}

let password: string;
for (;;) {
  password = await prompt(`Mot de passe ${domaine} : `, true);
  const again = await prompt(`Confirme le mot de passe : `, true);
  if (password && password === again) break;
  console.log(password ? "  Les deux saisies diffèrent, recommence." : "  Mot de passe vide.");
}

const client = new HaiAgentsClient();
const name = `BuyFit — ${domaine}`;
const values = { email, username: email, password };
const urls = [`https://${domaine}`];

const { items } = await client.vaults.listVaultItems({ vaultId, limit: 100 });
const existing = items.find((i) => i.name === name);
const item = existing
  ? await client.vaults.updateVaultItem({ vaultId, itemId: existing.id, urls, values })
  : await client.vaults.createVaultItem({ vaultId, name, urls, values });

console.log(
  `✓ Login ${existing ? "mis à jour" : "ajouté"} (item ${item.id}) pour ${domaine} — ${email}`,
);
process.exit(0);
