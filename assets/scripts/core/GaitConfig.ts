/**
 * 统一步态配置 —— 跑步动画与世界滚动速度的唯一绑定来源。
 *
 * 约束（严禁绕过）：
 *   - 一整轮完整跑步循环中，地面视觉上经过角色的距离恒为 baselineStrideDistance。
 *   - 跑步周期必须由世界速度导出：runDuration = baselineStrideDistance / worldSpeed。
 *   - 世界速度变化时，只能通过调整 Run 动画播放倍率（或等价地改 runDuration）来同步，
 *     不允许只改地面速度或只改 Run 动画速度。
 *
 * 约定：
 *   - WorldScroller.speed 即世界速度 worldSpeed（px/s）。
 *   - Run.anim 的 duration 固定为 baselineRunDuration（基准周期），
 *     运行时用 runPlaybackSpeed(worldSpeed) 作为 AnimationState.speed 缩放播放。
 */
export const GaitConfig = {
  /** 一整轮完整跑步循环中，地面视觉上经过角色的距离 (px)。 */
  baselineStrideDistance: 165,

  /** 基准世界速度 (px/s)：此速度下跑步周期 = baselineRunDuration。 */
  baselineWorldSpeed: 300,

  /** 基准跑步周期（秒），等于 Run.anim 的 duration。 */
  baselineRunDuration: 0.55,

  /** 一个循环内两次落脚的时刻（占周期的比例）：[左脚, 右脚]。
   *  右脚本应在 0.5 周期处落地（基准 0.55s × 0.5 = 0.275s，即“t=0.275 右脚”）。 */
  footContactFractions: [0.0, 0.5],
} as const;

/** 由世界速度计算跑步周期（秒）：runDuration = baselineStrideDistance / worldSpeed。 */
export function runDurationForSpeed(worldSpeed: number): number {
  return GaitConfig.baselineStrideDistance / worldSpeed;
}

/** 由世界速度计算 Run 动画播放倍率（作用于 AnimationState.speed）。 */
export function runPlaybackSpeed(worldSpeed: number): number {
  return GaitConfig.baselineRunDuration / runDurationForSpeed(worldSpeed);
}
