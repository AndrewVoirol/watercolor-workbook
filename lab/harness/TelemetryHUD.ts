// Real-Time Telemetry HUD for Lab Workbench

export class TelemetryHUD {
  private elGpuTime: HTMLElement | null = null;
  private elFps: HTMLElement | null = null;
  private elBandwidth: HTMLElement | null = null;
  private elStatus: HTMLElement | null = null;

  private frameCount = 0;
  private lastTime = performance.now();
  private gpuTimeAccum = 0;
  private gpuTimeCount = 0;
  private currentBandwidthGBps = 0;

  constructor() {
    this.elGpuTime = document.getElementById('hud-gpu-time');
    this.elFps = document.getElementById('hud-fps');
    this.elBandwidth = document.getElementById('hud-bandwidth');
    this.elStatus = document.getElementById('hud-status');
  }

  public recordFrame(gpuDurationMs: number, bytesTransferredPerFrame: number = 0): void {
    this.frameCount++;
    this.gpuTimeAccum += gpuDurationMs;
    this.gpuTimeCount++;

    const now = performance.now();
    const elapsed = now - this.lastTime;

    if (bytesTransferredPerFrame > 0) {
      this.currentBandwidthGBps = (bytesTransferredPerFrame * 120) / 1e9;
    }

    if (elapsed >= 300) {
      const fps = (this.frameCount * 1000) / elapsed;
      const avgGpuMs = this.gpuTimeCount > 0 ? this.gpuTimeAccum / this.gpuTimeCount : 0;

      if (this.elFps) {
        this.elFps.textContent = fps.toFixed(1);
        this.elFps.className = `metric-val ${fps >= 100 ? 'cyan' : fps >= 60 ? 'green' : 'amber'}`;
      }

      if (this.elGpuTime) {
        this.elGpuTime.textContent = `${avgGpuMs.toFixed(2)} ms`;
        this.elGpuTime.className = `metric-val ${avgGpuMs < 1.5 ? 'green' : avgGpuMs < 4.0 ? 'cyan' : 'amber'}`;
      }

      if (this.elBandwidth) {
        this.elBandwidth.textContent = `${this.currentBandwidthGBps.toFixed(1)} GB/s`;
      }

      this.frameCount = 0;
      this.gpuTimeAccum = 0;
      this.gpuTimeCount = 0;
      this.lastTime = now;
    }
  }

  public setStatus(status: string, level: 'green' | 'amber' | 'accent' = 'green'): void {
    if (this.elStatus) {
      this.elStatus.textContent = status;
      this.elStatus.className = `metric-val ${level}`;
    }
  }
}
