"use client";

import { AppHeader, SplashOverlay } from "./components/app-shell";
import { ActionToast } from "./components/action-toast";
import { ProjectWorkspaceContext } from "./context/project-workspace-context";
import { PageSidebarLeft } from "./components/page-sidebar-left";
import { PageWorkspaceCenter } from "./components/page-workspace-center";
import { PageSidebarRight } from "./components/page-sidebar-right";
import { useProjectWorkspaceProvider } from "./hooks/use-project-workspace";
import { APP_VERSION, AUTHOR } from "./lib/music-config";

export default function Page() {
  const {
    avgScore,
    canvasRef,
    clearToast,
    dismissSplash,
    saveStatus,
    setStatusWithTime,
    showSplash,
    toast,
    workspace,
  } = useProjectWorkspaceProvider();

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0d10] p-4 text-white md:p-8">
      {showSplash && (
        <SplashOverlay
          onDismiss={() => {
            dismissSplash();
            setStatusWithTime("Ready — build your prompt step by step", "info");
          }}
        />
      )}

      <ActionToast toast={toast} onDismiss={clearToast} />

      <canvas ref={canvasRef} className="hidden"/>
      <div className="fixed inset-0 pointer-events-none opacity-40" style={{background:"radial-gradient(circle at 18% 0%, rgba(184,115,51,.25), transparent 34%), radial-gradient(circle at 82% 12%, rgba(34,211,238,.16), transparent 36%), linear-gradient(135deg, rgba(255,255,255,.05), transparent 35%)"}}/>
      <div className="relative mx-auto max-w-7xl pb-12">
        <AppHeader
          appVersion={APP_VERSION}
          avgScore={avgScore}
          saveStatus={saveStatus}
          statusPulseKey={toast?.tick ?? 0}
        />

        <ProjectWorkspaceContext.Provider value={workspace}>
          <div className="grid gap-4 lg:grid-cols-[300px_1fr_380px]">
            <PageSidebarLeft />
            <PageWorkspaceCenter />
            <PageSidebarRight />
          </div>
        </ProjectWorkspaceContext.Provider>

      </div>
      <div className="fixed bottom-3 left-6 z-50 rounded-full border border-orange-400/30 bg-black/50 px-3 py-1 text-xs font-bold text-orange-300 backdrop-blur">Version {APP_VERSION}</div>
      <div className="fixed bottom-3 right-6 z-50 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-white/60 backdrop-blur">Created by <span className="font-bold text-orange-300">{AUTHOR}</span></div>
    </main>
  );
}
