import type { IdentifiedItem, ProductMatch } from "@buyfit/shared";
import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { openWeb, sizeForPiece, type Account } from "@/lib/account";
import { getActiveTab } from "@/lib/active-tab";
import { api } from "@/lib/api";
import { cropToDataUrl, type NormRect } from "@/lib/crop";
import { getPinPreview } from "@/lib/link-preview";
import type { PagePreview, SelectionMessage, StartSelectMessage } from "@/lib/messages";
import { normalizePinUrl } from "@/lib/pin-url";
import { showPurchase, usePurchase } from "@/lib/purchase";
import { Checkout, PurchaseBanner } from "./Checkout";
import { Results, type SearchState } from "./Results";
import { Spinner } from "./Spinner";

type Preview =
  | { kind: "none" }
  | { kind: "loading"; url: string }
  | { kind: "ready"; url: string; data: PagePreview }
  | { kind: "failed"; url: string };

export type Piece =
  | { kind: "loading"; cropUrl: string }
  | { kind: "ready"; cropUrl: string; item: IdentifiedItem }
  | { kind: "error"; cropUrl: string; message: string };

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const SIZE_STORAGE_KEY = "buyfit:size";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const PINTEREST_HOST = /(^|\.)pinterest\.[a-z.]{2,6}$/;
const isPinterest = (url: string) => {
  try {
    return PINTEREST_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

/**
 * Recherche en cours ou terminée, par épingle : survit au changement d'onglet (ex. « Voir le prix »
 * ouvre la fiche du magasin) et aux requêtes qui se terminent pendant que l'écran est démonté.
 */
type Flow = { piece: Piece | null; search: SearchState };
const flows = new Map<string, Flow>();
const flowOf = (pinUrl: string): Flow => {
  let f = flows.get(pinUrl);
  if (!f) flows.set(pinUrl, (f = { piece: null, search: { kind: "idle" } }));
  return f;
};

/**
 * Accueil : l'épingle de l'onglet actif est chargée automatiquement (et suivie quand l'onglet
 * change). L'utilisateur choisit sa taille puis entoure une pièce ; la recherche
 * Zara / Uniqlo / Mango / Bershka démarre seule et s'affiche sur l'écran de résultats.
 */
export function Home({ userId, account }: { userId: string; account?: Account }) {
  const purchase = usePurchase();
  // Achat en cours : écran d'achat par-dessus tout (il survit au changement d'épingle),
  // ou bandeau compact s'il est masqué.
  if (purchase && !purchase.hidden) return <Checkout purchase={purchase} />;
  return (
    <>
      {purchase && <PurchaseBanner purchase={purchase} onShow={showPurchase} />}
      <PinHome userId={userId} account={account} />
    </>
  );
}

function PinHome({ userId, account }: { userId: string; account?: Account }) {
  const [pinUrl, setPinUrl] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  // Taille mémorisée d'une recherche à l'autre.
  useEffect(() => {
    browser.storage.local
      .get(SIZE_STORAGE_KEY)
      .then((r) => {
        const v = r[SIZE_STORAGE_KEY];
        if (typeof v === "string") setSize(v);
      })
      .catch(() => {});
  }, []);
  const chooseSize = (s: string) => {
    setSize(s);
    void browser.storage.local.set({ [SIZE_STORAGE_KEY]: s }).catch(() => {});
  };

  // Suit l'onglet actif : épingle ouverte → chargée ; autre page Pinterest → retirée ;
  // autre site (fiche produit ouverte depuis les résultats) → on garde la recherche affichée.
  useEffect(() => {
    const sync = async () => {
      const url = (await getActiveTab().catch(() => undefined))?.url ?? "";
      const pin = normalizePinUrl(url);
      if (pin) setPinUrl(pin);
      else if (isPinterest(url)) setPinUrl(null);
    };
    void sync();
    const onActivated = () => void sync();
    const onUpdated = (_id: number, info: { url?: string; status?: string }) => {
      if (info.url || info.status === "complete") void sync();
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.windows?.onFocusChanged?.addListener(onActivated);
    return () => {
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.windows?.onFocusChanged?.removeListener(onActivated);
    };
  }, []);

  if (!pinUrl) {
    return (
      <div className="screen">
        <div className="content empty">
          <div className="empty-icon" aria-hidden="true">
            <PinIcon />
          </div>
          <h2>Ouvre une épingle</h2>
          <p>Clique sur une épingle Pinterest : elle se charge ici automatiquement.</p>
        </div>
      </div>
    );
  }
  // Nouvelle épingle → nouveau parcours (état remis à zéro par la clé).
  return (
    <PinFlow
      key={pinUrl}
      pinUrl={pinUrl}
      userId={userId}
      account={account}
      size={size}
      onSize={chooseSize}
    />
  );
}

function PinFlow({
  pinUrl,
  userId,
  account,
  size,
  onSize: chooseSize,
}: {
  pinUrl: string;
  userId: string;
  account?: Account;
  size: string | null;
  onSize: (s: string) => void;
}) {
  const [preview, setPreview] = useState<Preview>({ kind: "loading", url: pinUrl });
  const [screenSelecting, setScreenSelecting] = useState(false); // sélection sur la page
  const [piece, setPieceState] = useState<Piece | null>(() => flowOf(pinUrl).piece);
  const [search, setSearchState] = useState<SearchState>(() => flowOf(pinUrl).search);
  const [error, setError] = useState<string | null>(null);
  /** Taille du compte selon la pièce (pantalon, veste, haut) ; sinon celle choisie ici. */
  const sizeFor = (item?: IdentifiedItem) =>
    (account && sizeForPiece(account.tailles, item?.categorie)) || size;
  const accountSizes = account?.tailles.haut ? account.tailles : null;
  // Écrit aussi dans le cache : un résultat qui arrive après démontage n'est pas perdu.
  const setPiece = (p: Piece | null) => {
    flowOf(pinUrl).piece = p;
    setPieceState(p);
  };
  const setSearch = (st: SearchState) => {
    flowOf(pinUrl).search = st;
    setSearchState(st);
  };

  // Remonté pendant une recherche : on reprend le résultat dès qu'il arrive dans le cache.
  useEffect(() => {
    if (search.kind !== "loading" && piece?.kind !== "loading") return;
    const t = setInterval(() => {
      const f = flowOf(pinUrl);
      if (f.piece !== piece) setPieceState(f.piece);
      if (f.search !== search) setSearchState(f.search);
    }, 300);
    return () => clearInterval(t);
  }, [pinUrl, piece, search]);

  useEffect(() => {
    let cancelled = false;
    void getPinPreview(pinUrl).then((data) => {
      if (cancelled) return;
      setPreview(
        data?.imageUrl ? { kind: "ready", url: pinUrl, data } : { kind: "failed", url: pinUrl },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [pinUrl]);

  /** Zone choisie → découpe → identification (vision) → recherche dans les 3 magasins. */
  const identify = async (imageUrl: string, rect: NormRect) => {
    setError(null);
    let cropUrl = "";
    try {
      cropUrl = await cropToDataUrl(imageUrl, rect);
      setPiece({ kind: "loading", cropUrl });
      setSearch({ kind: "idle" });
      const item = await api.identify({ userId, imageDataUrl: cropUrl });
      setPiece({ kind: "ready", cropUrl, item });
      void runSearch(item, cropUrl);
    } catch (e) {
      if (cropUrl) setPiece({ kind: "error", cropUrl, message: errMsg(e) });
      else setError(`Découpe impossible : ${errMsg(e)}`);
    }
  };

  const runSearch = async (item: IdentifiedItem, cropUrl: string) => {
    setSearch({ kind: "loading" });
    const taille = sizeFor(item)?.split("/")[0];
    // Genre du compte en priorité (un homme qui entoure un pull cherche au rayon homme),
    // sinon celui deviné sur l'image.
    const g = account?.genre;
    const genre = g === "homme" || g === "femme" ? g : item.genre;
    try {
      const res = await api.search({
        userId,
        requete: item.requete,
        ...(genre ? { genre } : {}),
        ...(taille ? { taille } : {}),
        imageDataUrl: cropUrl,
      });
      setSearch({ kind: "ready", resultats: res.resultats as ProductMatch[] });
    } catch (e) {
      setSearch({ kind: "error", message: errMsg(e) });
    }
  };

  // La zone sélectionnée sur la page arrive du content script (lanceur Pinterest).
  const identifyRef = useRef(identify);
  useEffect(() => {
    identifyRef.current = identify;
  });
  useEffect(() => {
    const onMessage = (msg: unknown) => {
      const m = msg as SelectionMessage;
      if (m?.type === "buyfit:selection") {
        setScreenSelecting(false);
        void identifyRef.current(m.imageUrl, m.rect);
      } else if (m?.type === "buyfit:selection-cancel") {
        setScreenSelecting(false);
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, []);

  /**
   * Sélection directement sur la page Pinterest (lanceur). Si le lanceur ne répond pas
   * (extension rechargée sans rafraîchir l'onglet), on le réinjecte puis on relance.
   */
  const startSelection = async () => {
    setError(null);
    const ask = (tabId: number) =>
      browser.tabs
        .sendMessage(tabId, { type: "buyfit:start-select" } satisfies StartSelectMessage)
        .then((r) => (r as { ok?: boolean } | undefined)?.ok === true)
        .catch(() => false);
    try {
      const tab = await getActiveTab();
      if (tab?.id === undefined) throw new Error("onglet introuvable");
      let ok = await ask(tab.id);
      if (!ok) {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["/content-scripts/launcher.js"],
        });
        ok = await ask(tab.id);
      }
      if (!ok) throw new Error("lanceur absent");
      setScreenSelecting(true);
    } catch {
      setError("Recharge la page Pinterest pour sélectionner une pièce.");
    }
  };

  /** « Relancer la recherche » : retour à l'épingle chargée. */
  const restart = () => {
    setPiece(null);
    setSearch({ kind: "idle" });
    setError(null);
  };

  if (piece) {
    return (
      <Results
        piece={piece}
        search={search}
        userId={userId}
        size={sizeFor(piece.kind === "ready" ? piece.item : undefined)}
        onRestart={restart}
        onRetry={
          piece.kind === "ready" ? () => void runSearch(piece.item, piece.cropUrl) : undefined
        }
      />
    );
  }

  return (
    <div className="screen">
      <div className="content">
        <PinCard preview={preview} />

        {accountSizes ? (
          <div className="field">
            <span className="label">Tes tailles</span>
            <div className="account-sizes">
              <span>
                Haut <strong>{accountSizes.haut}</strong>
              </span>
              {accountSizes.veste && (
                <span>
                  Veste <strong>{accountSizes.veste}</strong>
                </span>
              )}
              {accountSizes.bas && (
                <span>
                  Pantalon <strong>{accountSizes.bas}</strong>
                </span>
              )}
              <button type="button" className="link" onClick={() => openWeb("/settings")}>
                Modifier
              </button>
            </div>
          </div>
        ) : (
          <div className="field">
            <span className="label" id="size-label">
              Ta taille
            </span>
            <div className="size-row" role="radiogroup" aria-labelledby="size-label">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={size === s}
                  className={`chip${size === s ? " on" : ""}`}
                  onClick={() => chooseSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      <footer className="actions-bar">
        <button
          type="button"
          className="btn primary"
          disabled={(!size && !accountSizes) || screenSelecting || preview.kind !== "ready"}
          onClick={() => void startSelection()}
        >
          {screenSelecting ? (
            <>
              <Spinner light /> Entoure la pièce sur la page…
            </>
          ) : !size && !accountSizes ? (
            "Choisis ta taille"
          ) : (
            <>
              <CropIcon /> Sélectionner une pièce
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

function PinCard({ preview }: { preview: Preview }) {
  if (preview.kind === "loading" || preview.kind === "none") {
    return (
      <div className="pin-card loading" aria-busy="true">
        <Spinner />
      </div>
    );
  }
  if (preview.kind === "failed") {
    return (
      <div className="pin-card failed">
        <p>Impossible de charger cette épingle. Recharge la page.</p>
      </div>
    );
  }
  return (
    <figure className="pin-card">
      <img src={preview.data.imageUrl} alt={preview.data.title ?? "Épingle Pinterest"} />
    </figure>
  );
}

const icon = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const CropIcon = () => (
  <svg {...icon}>
    <path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14" />
  </svg>
);
const PinIcon = () => (
  <svg {...icon} width={28} height={28}>
    <path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
