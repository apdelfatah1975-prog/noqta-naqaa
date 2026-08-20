import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallAppButtonProps = {
  compact?: boolean;
  technician?: boolean;
};

const TECHNICIAN_MANIFEST = "/technician-app/technician-manifest.webmanifest";
const ADMIN_MANIFEST = "/manifest.webmanifest";

export function InstallAppButton({ compact = false, technician = false }: InstallAppButtonProps) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [promptManifest, setPromptManifest] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest) manifest.href = technician ? TECHNICIAN_MANIFEST : ADMIN_MANIFEST;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptManifest(manifest?.getAttribute("href") ?? null);
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallEvent(null);
      setPromptManifest(null);
      toast.success("تم تثبيت التطبيق على جهازك.");
    };

    setIsInstalled(window.matchMedia("(display-mode: standalone)").matches);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [technician]);

  async function installApp() {
    const requiredManifest = technician ? TECHNICIAN_MANIFEST : ADMIN_MANIFEST;
    const currentManifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (currentManifest && currentManifest.getAttribute("href") !== requiredManifest) {
      currentManifest.href = requiredManifest;
    }

    if (!installEvent || promptManifest !== requiredManifest) {
      toast.message("حدّث الصفحة من رابط الفني ثم اختر «تثبيت التطبيق» من جديد.");
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "dismissed") toast.message("يمكنك تثبيت التطبيق لاحقًا من قائمة المتصفح.");
    setInstallEvent(null);
    setPromptManifest(null);
  }

  if (isInstalled) return null;

  return (
    <Button onClick={installApp} variant="outline" size={compact ? "icon" : "sm"} className={compact ? "h-10 w-10 rounded-xl border-teal-950/8 bg-white text-teal-800 hover:bg-teal-50" : "h-10 rounded-xl border-teal-700/20 bg-white px-3 font-bold text-teal-800 hover:bg-teal-50"} title="تثبيت التطبيق">
      <Download className={compact ? "h-4 w-4" : "ml-1.5 h-4 w-4"} />
      {!compact ? "تثبيت التطبيق" : null}
    </Button>
  );
}

export { TECHNICIAN_MANIFEST, ADMIN_MANIFEST };

