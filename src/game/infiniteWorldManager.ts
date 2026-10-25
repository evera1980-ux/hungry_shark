/**
 * 模块 A：无限世界与动态边界控制器 (InfiniteWorldManager.ts)
 * 实现真正连续无缝的横向无限远洋 (Unbounded Continuous Horizontal Ocean) 与向下无限延伸的深渊相机跟随 (Infinite Downward Depth)
 * 彻底消除硬边界坐标瞬移导致的背景跳帧、鱼群瞬间消失与刷新感。
 */

export interface WorldTransform2D {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export interface CameraState2D {
  x: number;
  y: number;
  zoom?: number;
}

export interface InfiniteWorldStepResult {
  wrappedHorizontally: boolean;
  wrapDeltaX: number;
  clampedAtSurface: boolean;
  targetCameraX: number;
  targetCameraY: number;
}

export class InfiniteWorldManager {
  /**
   * 逻辑参考世界宽度尺度（用于兼容旧参数与视口估算；连续无限模式下不再强制在 ±worldWidth/2 处瞬移重置）
   */
  public worldWidth: number = 3000;

  /**
   * 海面高度基准线（Y = 0 为海面，Canvas 2D 下 Y > 0 为向海底深渊无限延伸）
   */
  public seaSurfaceY: number = 0;

  /**
   * 跨边界内缩缓冲距离（仅在显式开启硬边界包裹时使用）
   */
  public wrapPadding: number = 50;

  /**
   * 是否启用旧版硬边界瞬移（默认 false：采用连续无限水平坐标，彻底杜绝游到边界触发画面刷新/鱼群闪现）
   */
  public enableHardWrap: boolean = false;

  /**
   * 相机平滑跟随插值速率
   */
  public cameraLerpSpeed: number = 6.5;

  constructor(
    worldWidth: number = 3000,
    seaSurfaceY: number = 0,
    enableHardWrap: boolean = false
  ) {
    this.worldWidth = worldWidth;
    this.seaSurfaceY = seaSurfaceY;
    this.enableHardWrap = enableHardWrap;
  }

  /**
   * 核心帧更新：
   * 1. 连续无边界横向游动 (Unbounded Continuous Horizontal Motion):
   *    默认 enableHardWrap = false，shark.x 与 camera.x 在 (-∞, +∞) 连续平滑延展，
   *    配合视差背景的取模无缝平铺与 EcosystemSpawner 的视野外环状生成，永远不会触发边界瞬移或画面刷新。
   * 2. 垂直方向向下无边界跟随 (Infinite Downward Depth):
   *    海面限制在 Y >= seaSurfaceY (0)，向下无任何海底硬边界，相机无限跟随下潜。
   */
  public update(
    deltaTime: number,
    shark: WorldTransform2D,
    camera: CameraState2D,
    activeEntities?: Array<{ x: number; y: number }>
  ): InfiniteWorldStepResult {
    const halfW = this.worldWidth / 2;
    let wrappedHorizontally = false;
    let wrapDeltaX = 0;

    // 仅当显式开启硬包裹模式时才执行坐标回绕，并同步平移场上所有实体防止画面清空
    if (this.enableHardWrap) {
      if (shark.x > halfW) {
        const nextX = -halfW + this.wrapPadding;
        wrapDeltaX = nextX - shark.x;
        shark.x = nextX;
        camera.x += wrapDeltaX;
        wrappedHorizontally = true;
      } else if (shark.x < -halfW) {
        const nextX = halfW - this.wrapPadding;
        wrapDeltaX = nextX - shark.x;
        shark.x = nextX;
        camera.x += wrapDeltaX;
        wrappedHorizontally = true;
      }

      if (wrappedHorizontally && activeEntities) {
        for (const ent of activeEntities) {
          ent.x += wrapDeltaX;
        }
      }
    }

    // 垂直方向向下无边界跟随 (Infinite Downward Depth)
    // 海面在 Y = seaSurfaceY (0)，向下 (Y > 0) 无限延伸无底洞
    let clampedAtSurface = false;
    if (shark.y < this.seaSurfaceY) {
      shark.y = this.seaSurfaceY;
      if (typeof shark.vy === 'number' && shark.vy < 0) {
        shark.vy = Math.abs(shark.vy) * 0.35;
      }
      clampedAtSurface = true;
    }

    const targetCameraX = shark.x;
    const targetCameraY = Math.max(shark.y, this.seaSurfaceY);

    const lerpFactor =
      deltaTime > 0 ? Math.min(1, deltaTime * this.cameraLerpSpeed) : 1;
    camera.x += (targetCameraX - camera.x) * lerpFactor;
    camera.y += (targetCameraY - camera.y) * lerpFactor;

    return {
      wrappedHorizontally,
      wrapDeltaX,
      clampedAtSurface,
      targetCameraX,
      targetCameraY,
    };
  }

  /**
   * 在连续无限世界中保持实体真实连续坐标（仅在 enableHardWrap 开启时回绕）
   */
  public wrapEntityX(x: number): number {
    if (!this.enableHardWrap) {
      return x;
    }
    const halfW = this.worldWidth / 2;
    if (x > halfW) {
      return -halfW + this.wrapPadding;
    }
    if (x < -halfW) {
      return halfW - this.wrapPadding;
    }
    return x;
  }

  /**
   * 计算两点之间的横向差值（在连续无限世界中直接返回真实欧氏差值 toX - fromX）
   */
  public getShortestDeltaX(fromX: number, toX: number): number {
    let dx = toX - fromX;
    if (!this.enableHardWrap) {
      return dx;
    }
    const halfW = this.worldWidth / 2;
    if (dx > halfW) dx -= this.worldWidth;
    else if (dx < -halfW) dx += this.worldWidth;
    return dx;
  }
}

export const infiniteWorldManager = new InfiniteWorldManager(3000, 0, false);

