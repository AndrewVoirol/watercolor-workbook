// WebGPU Context & Device Manager for Atelier Lab

export class WebGPULabContext {
  public adapter!: GPUAdapter;
  public device!: GPUDevice;
  public canvas!: HTMLCanvasElement;
  public context!: GPUCanvasContext;
  public presentationFormat!: GPUTextureFormat;
  public hasF16: boolean = false;
  public hasTimestampQuery: boolean = false;

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
  }

  public async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;

    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported on this browser.');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      throw new Error('Failed to acquire WebGPU adapter.');
    }

    this.adapter = adapter;

    const requiredFeatures: GPUFeatureName[] = [];
    if (adapter.features.has('shader-f16')) {
      requiredFeatures.push('shader-f16');
      this.hasF16 = true;
    }
    if (adapter.features.has('timestamp-query')) {
      // Note: timestamp queries can be restricted by browser security policies
      try {
        requiredFeatures.push('timestamp-query');
        this.hasTimestampQuery = true;
      } catch {
        this.hasTimestampQuery = false;
      }
    }

    this.device = await adapter.requestDevice({
      requiredFeatures,
      requiredLimits: {
        maxStorageTexturesPerShaderStage: 8
      }
    });

    this.device.lost.then((info) => {
      console.error(`[Lab WebGPU Device Lost]: ${info.message}`);
    });

    const ctx = canvas.getContext('webgpu');
    if (!ctx) {
      throw new Error('Failed to acquire canvas WebGPU context.');
    }
    this.context = ctx;

    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
      alphaMode: 'opaque'
    });
  }

  public createTexturePair(width: number, height: number, format: GPUTextureFormat = 'rgba16float', label: string = 'tex_pair') {
    const desc: GPUTextureDescriptor = {
      label: `${label}_tex`,
      size: [width, height, 1],
      format,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC
    };

    const texA = this.device.createTexture({ ...desc, label: `${label}_A` });
    const texB = this.device.createTexture({ ...desc, label: `${label}_B` });

    return {
      texA,
      texB,
      viewA: texA.createView({ label: `${label}_view_A` }),
      viewB: texB.createView({ label: `${label}_view_B` })
    };
  }

  public createShaderModule(code: string, label: string): GPUShaderModule {
    let resolved = code;
    if (this.hasF16 && !resolved.includes('enable f16;') && resolved.includes('f16')) {
      resolved = 'enable f16;\n' + resolved;
    }

    const sm = this.device.createShaderModule({
      label,
      code: resolved
    });

    sm.getCompilationInfo().then((info) => {
      for (const msg of info.messages) {
        if (msg.type === 'error') {
          console.error(`[Lab Shader Error: ${label}] line ${msg.lineNum}:${msg.linePos} - ${msg.message}`);
        }
      }
    });

    return sm;
  }
}
