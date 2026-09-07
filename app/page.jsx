"use client";

import { AppHeader, SplashOverlay } from "./components/app-shell";
import { ActionToast } from "./components/action-toast";
import { StartupInstallOverlay } from "./components/startup-install-overlay";
import { useStartupAddonInstall } from "./hooks/use-startup-addon-install";
import { ProjectWorkspaceProviders } from "./context/project-workspace-context";
import { GuidedFocusProvider } from "./context/guided-focus-context";
import { PageSidebarLeft } from "./components/page-sidebar-left";
import { PageWorkspaceCenter } from "./components/page-workspace-center";
import { PageSidebarRight } from "./components/page-sidebar-right";
import { GuidedStepCoachBanner } from "./components/guided-step-coach-banner";
import { FailSafeErrorBoundary } from "./components/fail-safe-error-boundary";
import { useProjectWorkspaceProvider } from "./hooks/use-project-workspace";
import { DesktopUpdateStatusBar } from "./components/desktop-update-status-bar";
import { DesktopWindowControls } from "./components/desktop-window-controls";
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
  const startupInstall = useStartupAddonInstall();

  return (
    <main className="min-h-screen overflow-x-hidden overflow-y-auto bg-[#0b0d10] p-4 text-white md:p-8">
      <DesktopWindowControls />
      <StartupInstallOverlay {...startupInstall} />
      {showSplash && !startupInstall.open && (
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
        <FailSafeErrorBoundary name="header">
          <AppHeader
            appVersion={APP_VERSION}
            avgScore={avgScore}
            saveStatus={saveStatus}
            statusPulseKey={toast?.tick ?? 0}
          />
        </FailSafeErrorBoundary>

        <ProjectWorkspaceProviders slices={workspace}>
          <GuidedFocusProvider>
            <FailSafeErrorBoundary name="guided coach">
              <GuidedStepCoachBanner />
            </FailSafeErrorBoundary>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,380px)]">
              <FailSafeErrorBoundary name="left tools">
                <div className="min-w-0 max-w-full overflow-x-hidden">
                  <PageSidebarLeft />
                </div>
              </FailSafeErrorBoundary>
              <FailSafeErrorBoundary name="center workspace">
                <div className="min-w-0 max-w-full overflow-x-hidden">
                  <PageWorkspaceCenter />
                </div>
              </FailSafeErrorBoundary>
              <FailSafeErrorBoundary name="right tools">
                <div className="min-w-0 max-w-full overflow-x-hidden">
                  <PageSidebarRight />
                </div>
              </FailSafeErrorBoundary>
            </div>
          </GuidedFocusProvider>
        </ProjectWorkspaceProviders>

      </div>
      <div className="fixed bottom-3 left-6 z-50 rounded-full border border-orange-400/30 bg-black/50 px-3 py-1 text-xs font-bold text-orange-300 backdrop-blur">Version {APP_VERSION}</div>
      <DesktopUpdateStatusBar />
      <div className="fixed bottom-3 right-6 z-50 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-white/60 backdrop-blur">Created by <span className="font-bold text-orange-300">{AUTHOR}</span></div>
    </main>
  );
}
