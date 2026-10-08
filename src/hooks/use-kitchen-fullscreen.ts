import { useEffect, useState } from "react";

type FullscreenDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> | void };
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function useKitchenFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    const doc = document as FullscreenDocument;
    const sync = () => setFullscreen(Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement));
    sync();
    doc.addEventListener("fullscreenchange", sync);
    doc.addEventListener("webkitfullscreenchange", sync);
    return () => {
      doc.removeEventListener("fullscreenchange", sync);
      doc.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);
  const toggleFullscreen = async () => {
    if (busy) return;
    const doc = document as FullscreenDocument;
    const root = doc.documentElement as FullscreenElement;
    setBusy(true);
    try {
      if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } else if (root.requestFullscreen) await root.requestFullscreen();
      else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
      else setHelpOpen(true);
    } catch { setHelpOpen(true); }
    finally { setBusy(false); }
  };
  return { fullscreen, busy, helpOpen, setHelpOpen, toggleFullscreen };
}