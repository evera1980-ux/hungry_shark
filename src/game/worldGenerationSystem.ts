/**
 * 海底程序化世界生成系统 (Procedural Ocean World Generation System) — Barrel Export
 * 已按职责拆分为 `src/game/world/` 下 10 个无环子模块，保持全部既有导出 100% 向后兼容。
 */
export * from './world/worldCore';
export * from './world/terrainSystem';
export * from './world/biomeSystem';
export * from './world/ecologyAndPoi';
export * from './world/chunkStateAndPersistence';
export * from './world/worldAssetRegistry';
export * from './world/seabedRenderer';
export * from './world/worldRenderer';
export * from './world/chunkLifecycleManager';
export * from './world/worldDebug';
export * from './world/proceduralWorldSystem';
