"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(
    window.navigator.userAgent
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean(
        (
          window.navigator as Navigator & {
            standalone?: boolean;
          }
        ).standalone
      ))
  );
}

export function InstallFieldsConnect() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIsIos(isIosDevice());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();

      setInstallPrompt(
        event as BeforeInstallPromptEvent
      );

      setInstalled(false);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHelp(false);
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );
    };
  }, []);

  if (installed) {
    return null;
  }

  async function handleInstall() {
    if (installPrompt) {
      await installPrompt.prompt();

      const choice =
        await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
      }

      return;
    }

    if (isIos) {
      setShowIosHelp((current) => !current);
    }
  }

  if (!installPrompt && !isIos) {
    return null;
  }

  return (
    <>
      <button
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
        onClick={handleInstall}
        type="button"
      >
        Install FieldsConnect
      </button>

      {isIos && showIosHelp && (
        <div className="mx-3 mb-2 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600">
          On iPhone or iPad, tap the Share button in Safari,
          then choose <strong>Add to Home Screen</strong>.
        </div>
      )}
    </>
  );
}
