// Minimal WebGPU declarations used by the canonical orb renderer.
// TypeScript's DOM lib in this repo does not yet include WebGPU.
// Keep this file narrow; it is declaration-only and emits no runtime code.

type GPUPowerPreference = "low-power" | "high-performance";
type GPUTextureFormat = "bgra8unorm" | "rgba8unorm";
type GPUCanvasAlphaMode = "opaque" | "premultiplied";
type GPUPrimitiveTopology = "triangle-list";
type GPULoadOp = "load" | "clear";
type GPUStoreOp = "store" | "discard";
type GPUBlendFactor =
  | "zero"
  | "one"
  | "src-alpha"
  | "one-minus-src-alpha";
type GPUBlendOperation = "add";
type GPUErrorFilter = "validation" | "out-of-memory" | "internal";

interface GPU {
  requestAdapter(options?: { powerPreference?: GPUPowerPreference }): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}

interface GPUAdapter {
  readonly isFallbackAdapter?: boolean;
  requestDevice(): Promise<GPUDevice>;
}

interface GPUDeviceLostInfo {
  readonly reason?: string;
  readonly message: string;
}

interface GPUValidationError {
  readonly message: string;
}

interface GPUDevice {
  readonly queue: GPUQueue;
  readonly lost: Promise<GPUDeviceLostInfo>;
  createShaderModule(descriptor: { code: string; label?: string }): GPUShaderModule;
  createRenderPipelineAsync(descriptor: GPURenderPipelineDescriptor): Promise<GPURenderPipeline>;
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createCommandEncoder(descriptor?: { label?: string }): GPUCommandEncoder;
  pushErrorScope(filter: GPUErrorFilter): void;
  popErrorScope(): Promise<GPUValidationError | null>;
  destroy(): void;
}

interface GPUShaderModule {
  readonly __webGpuType?: "GPUShaderModule";
}
interface GPURenderPipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}
interface GPUBindGroupLayout {
  readonly __webGpuType?: "GPUBindGroupLayout";
}
interface GPUBuffer {
  readonly __webGpuType?: "GPUBuffer";
}
interface GPUBindGroup {
  readonly __webGpuType?: "GPUBindGroup";
}
interface GPUTexture {
  createView(): GPUTextureView;
}
interface GPUTextureView {
  readonly __webGpuType?: "GPUTextureView";
}

interface GPUQueue {
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: BufferSource,
    dataOffset?: number,
    size?: number,
  ): void;
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

interface GPUCanvasContext {
  configure(configuration: {
    device: GPUDevice;
    format: GPUTextureFormat;
    alphaMode?: GPUCanvasAlphaMode;
  }): void;
  unconfigure(): void;
  getCurrentTexture(): GPUTexture;
}

interface GPUCommandEncoder {
  beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

interface GPUCommandBuffer {
  readonly __webGpuType?: "GPUCommandBuffer";
}

interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
  end(): void;
}

interface GPURenderPipelineDescriptor {
  label?: string;
  layout: "auto";
  vertex: {
    module: GPUShaderModule;
    entryPoint: string;
  };
  fragment: {
    module: GPUShaderModule;
    entryPoint: string;
    targets: Array<{
      format: GPUTextureFormat;
      blend?: GPUBlendState;
    }>;
  };
  primitive: {
    topology: GPUPrimitiveTopology;
  };
}

interface GPUBlendState {
  color: GPUBlendComponent;
  alpha: GPUBlendComponent;
}

interface GPUBlendComponent {
  srcFactor: GPUBlendFactor;
  dstFactor: GPUBlendFactor;
  operation: GPUBlendOperation;
}

interface GPUBufferDescriptor {
  label?: string;
  size: number;
  usage: number;
}

interface GPUBindGroupDescriptor {
  label?: string;
  layout: GPUBindGroupLayout;
  entries: Array<{
    binding: number;
    resource: { buffer: GPUBuffer };
  }>;
}

interface GPURenderPassDescriptor {
  label?: string;
  colorAttachments: Array<{
    view: GPUTextureView;
    clearValue: { r: number; g: number; b: number; a: number };
    loadOp: GPULoadOp;
    storeOp: GPUStoreOp;
  }>;
}

interface Navigator {
  readonly gpu?: GPU;
}

declare const GPUBufferUsage: {
  readonly UNIFORM: number;
  readonly COPY_DST: number;
};
