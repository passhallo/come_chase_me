import { _decorator, Component, Graphics, Color, Node } from 'cc';
import { GameManager, GameState } from '../core/GameManager';
import { PhaseController } from '../player/PhaseController';
import { PlayerController } from '../player/PlayerController';
const { ccclass } = _decorator;

/** 攻击的四个阶段 */
export enum AttackPhase {
  Warn = 0,      // 预警：画面上方出现警示圈
  Approach = 1,  // 接近：暗器从上方向角色飞行
  Leave = 2,     // 离场：穿过角色后继续下落
  Done = 3,      // 结束：等待销毁
}

/**
 * 单枚暗器的生命周期。逻辑判定完全时间驱动（见指南 A2）：
 * 预计抵达时刻 hitTime = warnDuration + approachDuration；
 * 抵达时若角色相位无敌则穿过（普通闪避），否则受击结算。
 *
 * 引用由 AttackSpawner 在生成时注入（非序列化）。
 */
@ccclass('AttackController')
export class AttackController extends Component {
  phaseController: PhaseController = null;
  playerController: PlayerController = null;
  gameManager: GameManager = null;

  warnDuration = 0.4;
  approachDuration = 0.9;
  leaveDuration = 0.6;

  spawnY = 650;    // 出生点（画面上方外）
  playerY = -140;  // 命中点（角色逻辑 y）
  leaveY = -650;   // 离场终点（画面下方外）

  private _phase = AttackPhase.Warn;
  private _elapsed = 0;
  private _hitResolved = false;

  private _warnNode: Node = null;
  private _warnG: Graphics = null;
  private _bodyG: Graphics = null;

  onLoad() {
    this._bodyG = this.getComponent(Graphics) || this.addComponent(Graphics);
    this._warnNode = new Node('Warn');
    this.node.addChild(this._warnNode);
    this._warnG = this._warnNode.addComponent(Graphics);

    this.drawBody();
    this.drawWarn();
    this.node.setPosition(0, this.spawnY, 0);
    this._bodyG.enabled = false; // 预警阶段先隐藏暗器本体
  }

  get phase(): AttackPhase {
    return this._phase;
  }

  /** 距离 hitTime 的剩余秒数（已过则为负），供验证/联调读取 */
  get timeToHit(): number {
    return this.warnDuration + this.approachDuration - this._elapsed;
  }

  update(dt: number) {
    if (this._phase === AttackPhase.Done) {
      return;
    }
    // 非游戏进行中：冻结（受击或结算后不再推进）
    if (this.gameManager && this.gameManager.state !== GameState.Playing) {
      return;
    }

    // 世界时间倍率（子弹时间时世界层放慢到 0.4）
    const ts = this.gameManager ? this.gameManager.worldTimeScale : 1.0;
    this._elapsed += dt * ts;

    if (this._phase === AttackPhase.Warn) {
      this.updateWarn();
    } else if (this._phase === AttackPhase.Approach) {
      this.updateApproach();
    } else if (this._phase === AttackPhase.Leave) {
      this.updateLeave();
    }
  }

  private updateWarn() {
    // 警示圈轻微脉动
    if (this._warnNode) {
      const s = 1 + 0.15 * Math.sin(this._elapsed * 18);
      this._warnNode.setScale(s, s, 1);
    }
    if (this._elapsed >= this.warnDuration) {
      this._phase = AttackPhase.Approach;
      this._bodyG.enabled = true;
      if (this._warnNode) {
        this._warnNode.active = false;
      }
    }
  }

  private updateApproach() {
    const t = (this._elapsed - this.warnDuration) / this.approachDuration;
    const y = this.spawnY + (this.playerY - this.spawnY) * Math.min(1, t);
    this.node.setPosition(0, y, 0);
    if (t >= 1) {
      this.resolveHit();
      this._phase = AttackPhase.Leave;
    }
  }

  private updateLeave() {
    const t = (this._elapsed - this.warnDuration - this.approachDuration) / this.leaveDuration;
    const y = this.playerY + (this.leaveY - this.playerY) * Math.min(1, t);
    this.node.setPosition(0, y, 0);
    if (t >= 1) {
      this._phase = AttackPhase.Done;
      this.node.destroy();
    }
  }

  private resolveHit() {
    if (this._hitResolved) {
      return;
    }
    this._hitResolved = true;

    const invincible = this.phaseController ? this.phaseController.isInvincible : false;
    if (invincible) {
      // 相位无敌：穿过；命中落在完美窗口内为 Perfect，否则普通闪避
      const isPerfect = this.phaseController ? this.phaseController.inPerfectWindow : false;
      if (this.gameManager) {
        if (isPerfect) {
          this.gameManager.onPerfectDodge();
        } else {
          this.gameManager.onNormalDodge();
        }
      }
    } else {
      // 受击：播放受击占位 + 结算
      if (this.playerController) {
        this.playerController.enterHit();
      }
      if (this.gameManager) {
        this.gameManager.gameOver();
      }
    }
  }

  private drawBody() {
    const g = this._bodyG;
    g.clear();
    g.fillColor = new Color(232, 62, 78, 255);
    g.moveTo(0, -52);
    g.lineTo(15, -8);
    g.lineTo(0, 46);
    g.lineTo(-15, -8);
    g.close();
    g.fill();
    g.lineWidth = 3;
    g.strokeColor = new Color(255, 210, 210, 255);
    g.stroke();
  }

  private drawWarn() {
    const g = this._warnG;
    g.clear();
    g.lineWidth = 6;
    g.strokeColor = new Color(255, 82, 82, 255);
    g.fillColor = new Color(255, 82, 82, 80);
    g.circle(0, 0, 44);
    g.fill();
    g.stroke();
  }
}
