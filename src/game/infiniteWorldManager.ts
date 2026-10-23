/**
 * 模块 A：无限世界与动态边界控制器 (InfiniteWorldManager.ts)
 * 实现无边界横向循环 (Infinite Horizontal Wrap-around) 与向下无限延伸的深渊相机跟随 (Infinite Downward Depth)
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
   * 虚拟世界的横向边界宽度（超出 [-worldWidth/2, +worldWidth/2] 后自动平滑传送到另一侧，制造无限循环感）
   */
  public worldWidth: number = 3000;

  /**
   * 海面高度基准线（Y = 0 为海面，Canvas 2D 下 Y > 0 为向海底深渊无限延伸）
   */
  public seaSurfaceY: number = 0;

  /**
   * 跨边界内缩缓冲距离（与 Cocos 组件一致：+50 / -50）
   */
  public wrapPadding: number = 50;

  /**
   * 相机平滑跟随插值速率
   */
  public cameraLerpSpeed: number = 6.5;

  constructor(worldWidth: number = 3000, seaSurfaceY: number = 0) {
    this.worldWidth = worldWidth;
    this.seaSurfaceY = seaSurfaceY;
  }

  /**
   * 核心帧更新：
   * 1. 无限横向循环逻辑 (Infinite Wrap-around):
   *    当 shark.x > worldWidth / 2 时传送至 -worldWidth / 2 + 50
   *    当 shark.x < -worldWidth / 2 时传送至 worldWidth / 2 - 50
   *    同时同步平移 camera.x，确保跨边界瞬间画面与视差背景零跳帧。
   * 2. 垂直方向向下无边界跟随 (Infinite Downward Depth):
   *    海面限制在 Y >= seaSurfaceY (0)，向下无任何海底硬边界，相机无限跟随下潜。
   */
  public update(
    deltaTime: number,
    shark: WorldTransform2D,
    camera: CameraState2D
  ): InfiniteWorldStepResult {
    const halfW = this.worldWidth / 2;
    let wrappedHorizontally = false;
    let wrapDeltaX = 0;

    // 1. 无限横向循环逻辑 (Infinite Wrap-around)
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

    // 2. 垂直方向向下无边界跟随 (Infinite Downward Depth)
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
   * 对海洋猎物或掉落物执行相同的 [-worldWidth/2, +worldWidth/2] 横向循环包裹
   */
  public wrapEntityX(x: number): number {
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
   * 计算循环世界中两点之间的最短横向差值 (用于跨边界平滑索敌/磁吸/视野裁剪)
   */
  public getShortestDeltaX(fromX: number, toX: number): number {
    let dx = toX - fromX;
    const halfW = this.worldWidth / 2;
    if (dx > halfW) dx -= this.worldWidth;
    else if (dx < -halfW) dx += this.worldWidth;
    return dx;
  }
}

export const infiniteWorldManager = new InfiniteWorldManager(3000, 0);
