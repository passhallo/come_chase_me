import { _decorator, Component, Node } from 'cc';
import { GameManager, GameState } from '../core/GameManager';
import { PhaseController } from './PhaseController';
import { PlayerAnimator } from './PlayerAnimator';
const { ccclass, property } = _decorator;

/** 角色视觉状态：Run / PhaseStart / PhaseLoop / Hit */
export enum PlayerState {
  Run = 0,
  PhaseStart = 1,
  PhaseLoop = 2,
  Hit = 3,
}

/**
 * 角色输入 + 相位逻辑状态机。
 *
 * 逻辑位置固定（PlayerLogic 不动），本组件只负责：点击触发相位、命中进入受击、复位；
 * 具体视觉（跑步 / 相位 / 受击动画、上移、半透明、染色）由 PlayerVisual 上的
 * PlayerAnimator 驱动，动画不移动 PlayerLogic。
 */
@ccclass('PlayerController')
export class PlayerController extends Component {
  @property(Node)
  playerVisual: Node = null;

  @property(PhaseController)
  phaseController: PhaseController = null;

  @property(GameManager)
  gameManager: GameManager = null;

  @property(Node)
  touchArea: Node = null;

  private _state: PlayerState = PlayerState.Run;
  private _animator: PlayerAnimator = null;

  onLoad() {
    if (this.playerVisual) {
      this._animator = this.playerVisual.getComponent(PlayerAnimator);
    }
    if (this.touchArea) {
      this.touchArea.on(Node.EventType.TOUCH_START, this.onTouch, this);
    }
    if (this.node.parent) {
      this.node.parent.on('game-ready', this.reset, this);
    }
    this.setState(PlayerState.Run);
  }

  onDestroy() {
    if (this.touchArea) {
      this.touchArea.off(Node.EventType.TOUCH_START, this.onTouch, this);
    }
    if (this.node.parent) {
      this.node.parent.off('game-ready', this.reset, this);
    }
  }

  /** 点击非 UI 区域：若在游戏中且冷却结束，尝试开启相位 */
  private onTouch() {
    if (!this.gameManager || this.gameManager.state !== GameState.Playing) {
      return;
    }
    if (this._state === PlayerState.Hit) {
      return;
    }
    if (this.phaseController) {
      this.phaseController.tryPhase();
    }
  }

  update(_dt: number) {
    const pc = this.phaseController;
    if (!pc || !this.gameManager) {
      return;
    }

    // 非游戏中：强制回到 Run（受击态 Hit 保持）
    if (this.gameManager.state !== GameState.Playing) {
      if (this._state !== PlayerState.Run && this._state !== PlayerState.Hit) {
        this.setState(PlayerState.Run);
        if (this._animator) this._animator.playRun();
      }
      return;
    }

    if (this._state === PlayerState.Hit) {
      return;
    }

    if (pc.isInvincible) {
      // 进入相位（PlayerAnimator 内部负责 PhaseStart → PhaseLoop → Run 的动画时序）
      if (this._state !== PlayerState.PhaseStart) {
        this.setState(PlayerState.PhaseStart);
        if (this._animator) this._animator.playPhase();
      }
    } else {
      if (this._state !== PlayerState.Run) {
        this.setState(PlayerState.Run);
        if (this._animator) this._animator.playRun();
      }
    }

    this.updateHud(pc);
  }

  private updateHud(pc: PhaseController) {
    let text: string;
    if (pc.isInvincible) {
      text = '相位 中…';
    } else if (pc.cooldownRemain > 0) {
      text = '冷却 ' + pc.cooldownRemain.toFixed(1) + 's';
    } else {
      text = '冷却 就绪';
    }
    this.gameManager.setCooldownText(text);
  }

  /** 受击：交给 PlayerAnimator 播放 Hit 动画，停在受击姿势 */
  enterHit() {
    this.setState(PlayerState.Hit);
    if (this._animator) this._animator.playHit();
  }

  /** 复位到跑步状态 */
  reset() {
    if (this.phaseController) {
      this.phaseController.reset();
    }
    this.setState(PlayerState.Run);
    if (this._animator) {
      this._animator.reset();
    }
  }

  private setState(s: PlayerState) {
    this._state = s;
  }
}
