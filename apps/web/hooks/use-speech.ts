"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Types minimaux de la Web Speech API (absents de lib.dom selon les versions). */
type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type SpeechErrorEvent = { error: string };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MESSAGES: Record<string, string> = {
  "not-allowed": "Micro refusé. Autorise l'accès au micro dans ton navigateur.",
  "no-speech": "Je n'ai rien entendu. Réessaie en parlant plus près du micro.",
  "audio-capture": "Aucun micro détecté.",
  network: "La dictée a besoin d'une connexion internet.",
};

/** Dictée vocale en français (fr-FR). */
export function useSpeech(onFinal: (texte: string) => void) {
  const [supporte, setSupporte] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const [interim, setInterim] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const ref = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    // Détection côté navigateur uniquement.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupporte(!!getCtor());
    return () => ref.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setErreur(null);
    setInterim("");
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let texte = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        texte += r[0]?.transcript ?? "";
        final = final || r.isFinal;
      }
      setInterim(texte);
      if (final) onFinalRef.current(texte.trim());
    };
    rec.onerror = (e) => setErreur(MESSAGES[e.error] ?? "La dictée a échoué. Réessaie.");
    rec.onend = () => setEcoute(false);
    ref.current = rec;
    rec.start();
    setEcoute(true);
  }, []);

  const stop = useCallback(() => ref.current?.stop(), []);

  return { supporte, ecoute, interim, erreur, start, stop };
}
