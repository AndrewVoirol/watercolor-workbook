// WebGPU Device, Adapter, Context and Pipeline Helper

export class WebGPUContext {
  public adapter!: GPUAdapter;
  public device!: GPUDevice;
  public canvas!: HTMLCanvasElement;
  public context!: GPUCanvasContext;
  public presentationFormat!: GPUTextureFormat;
  public hasF16: boolean = false;

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
  }

  public async init(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;

    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser. Please use Chrome 113+, Edge 113+, or Safari 18+.');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      throw new Error('No suitable WebGPU graphics adapter was found.');
    }

    this.adapter = adapter;

    // Feature detection: Check for hardware half-precision float (shader-f16) support
    const requiredFeatures: GPUFeatureName[] = [];
    if (adapter.features.has('shader-f16')) {
      requiredFeatures.push('shader-f16');
      this.hasF16 = true;
    }

    // Request device with supported adapter limits and optional features
    const requiredLimits: Record<string, number> = {};
    if (adapter.limits.maxStorageTexturesPerShaderStage) {
      requiredLimits.maxStorageTexturesPerShaderStage = Math.min(8, adapter.limits.maxStorageTexturesPerShaderStage);
    }

    this.device = await adapter.requestDevice({
      requiredFeatures,
      requiredLimits
    });

    // Handle lost device
    this.device.lost.then((info: GPUDeviceLostInfo) => {
      console.error(`WebGPU device lost: ${info.message} (reason: ${info.reason})`);
    });

    const ctx = canvas.getContext('webgpu');
    if (!ctx) {
      throw new Error('Failed to create WebGPU canvas context.');
    }
    this.context = ctx;

    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
      alphaMode: 'opaque'
    });
  }

  // Create Ping-Pong RGBA16F Float Texture Pair for high-efficiency simulation
  // 50% memory bandwidth and VRAM reduction compared to RGBA32F
  public createSimulationTexturePair(width: number, height: number, label: string): {
    texA: GPUTexture;
    texB: GPUTexture;
    viewA: GPUTextureView;
    viewB: GPUTextureView;
  } {
    const desc: GPUTextureDescriptor = {
      label: `${label}_texture`,
      size: [width, height, 1],
      format: 'rgba16float',
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

  // Create RGBA8Unorm texture (e.g. for parchment texture)
  public createTexture8(width: number, height: number, label: string): {
    texture: GPUTexture;
    view: GPUTextureView;
  } {
    const texture = this.device.createTexture({
      label,
      size: [width, height, 1],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST
    });

    return {
      texture,
      view: texture.createView({ label: `${label}_view` })
    };
  }

  // Create a shader module resolving `#include "common.wgsl"` and conditional `enable f16;`
  public createShaderModule(code: string, commonCode: string, label: string): GPUShaderModule {
    let resolvedCode = code;
    if (resolvedCode.includes('#include "common.wgsl"')) {
      resolvedCode = resolvedCode.replace('#include "common.wgsl"', commonCode);
    }

    if (this.hasF16 && !resolvedCode.includes('enable f16;')) {
      resolvedCode = `enable f16;\n` + resolvedCode;
    }

    const sm = this.device.createShaderModule({
      label,
      code: resolvedCode
    });

    sm.getCompilationInfo().then((info) => {
      for (const msg of info.messages) {
        if (msg.type === 'error') {
          console.error(`[Shader Compilation Error: ${label}] line ${msg.lineNum}:${msg.linePos} - ${msg.message}`);
        }
      }
    });

    return sm;
  }
}
