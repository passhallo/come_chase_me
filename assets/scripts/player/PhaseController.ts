import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 相位无敌逻辑（与视觉/输入解耦）。
 *
 * 时序（指南 A3 步骤 3）：
 *   点击 → 进入 0.25 秒相位无敌 → 无敌结束 → 0.7 秒冷却 → 可再次相位。
 *
 * 只维护计时与状态；视觉由 PlayerController 驱动，命中判定由后续 AttackController 读取 isInvincible。
 */
@ccclass('PhaseController')
export class PhaseController extends Component {
  @property({ tooltip: '相位无敌时长（秒）' })
  phaseDuration: number = 0.25;

  @property({ tooltip: '相位冷却时长（秒），无敌结束后开始' })
  cooldownDuration: number = 0.7;

  @property({ tooltip: '完美闪避窗口（秒），相位开启后这么长时间内命中视为 Perfect' })
  perfectWindow: number = 0.08;

  private _phaseTimer = 0;
  private _cooldownTimer = 0;

  /** 是否处于相位无敌 */
  get isInvincible(): boolean {
    return this._phaseTimer > 0;
  }

  /** 现在能否开启相位 */
  get canPhase(): boolean {
    return this._phaseTimer <= 0 && this._cooldownTimer <= 0;
  }

  /** 相位剩余秒数（供视觉过渡使用，0 = 不在相位） */
  get phaseRemain(): number {
    return Math.max(0, this._phaseTimer);
  }

  /** 冷却剩余秒数（供 HUD 显示，0 = 就绪） */
  get cooldownRemain(): number {
    return Math.max(0, this._cooldownTimer);
  }

  /** 相位已开启的时长（秒），未开启时为 0（供完美判定） */
  get phaseElapsed(): number {
    return this._phaseTimer > 0 ? this.phaseDuration - this._phaseTimer : 0;
  }

  /** 当前命中是否算完美闪避（相位开启后 perfectWindow 秒内） */
  get inPerfectWindow(): boolean {
    return this.isInvincible && this.phaseElapsed <= this.perfectWindow;
  }

  /** 尝试开启相位，成功返回 true */
  tryPhase(): boolean {
    if (!this.canPhase) {
      return false;
    }
    this._phaseTimer = this.phaseDuration;
    this._cooldownTimer = 0;
    return true;
  }

  /** 复位所有计时（重开时调用） */
  reset() {
    this._phaseTimer = 0;
    this._cooldownTimer = 0;
  }

  update(dt: number) {
    if (this._phaseTimer > 0) {
      this._phaseTimer -= dt;
      if (this._phaseTimer <= 0) {
        this._phaseTimer = 0;
        // 无敌结束，开始冷却
        this._cooldownTimer = this.cooldownDuration;
      }
    } else if (this._cooldownTimer > 0) {
      this._cooldownTimer -= dt;
      if (this._cooldownTimer < 0) {
        this._cooldownTimer = 0;
      }
    }
  }
}
