import { _decorator, Component, Node, Label } from 'cc';
const { ccclass, property } = _decorator;

export enum GameState {
  Ready = 0,
  Playing = 1,
  GameOver = 2,
}

/**
 * MVP 核心状态机：负责开始 / 结算 / 重开流程与 HUD 显示。
 * 后续步骤会在此基础上接入相位闪避、攻击与完美判定。
 */
@ccclass('GameManager')
export class GameManager extends Component {
  @property(Node)
  startPanel: Node = null;

  @property(Node)
  hud: Node = null;

  @property(Node)
  resultPanel: Node = null;

  @property(Label)
  scoreLabel: Label = null;

  @property(Label)
  comboLabel: Label = null;

  @property(Label)
  cooldownLabel: Label = null;

  @property(Label)
  resultScoreLabel: Label = null;

  @property({ tooltip: '子弹时间时长（秒）' })
  bulletTimeDuration: number = 0.15;

  @property({ tooltip: '子弹时间世界倍率' })
  bulletTimeScale: number = 0.4;

  private _state: GameState = GameState.Ready;
  private _score: number = 0;
  private _combo: number = 0;

  private _worldTimeScale = 1.0;
  private _bulletTimeRemain = 0;

  // 静态单例：供无 @property 引用的世界层组件（WorldScroller/RainLayer）读取世界时间倍率
  private static _instance: GameManager = null;
  static get instance(): GameManager {
    return GameManager._instance;
  }

  onLoad() {
    GameManager._instance = this;
    this.enterReady();
  }

  onDestroy() {
    if (GameManager._instance === this) {
      GameManager._instance = null;
    }
  }

  get state(): GameState {
    return this._state;
  }

  /** 世界时间倍率（子弹时间时为 0.4，正常为 1.0） */
  get worldTimeScale(): number {
    return this._worldTimeScale;
  }

  get combo(): number {
    return this._combo;
  }

  enterReady() {
    this._state = GameState.Ready;
    this._score = 0;
    this._combo = 0;
    this._worldTimeScale = 1.0;
    this._bulletTimeRemain = 0;
    this.setActive(this.startPanel, true);
    this.setActive(this.hud, false);
    this.setActive(this.resultPanel, false);
    this.refreshHud();
    this.emit('game-ready');
  }

  onStartButton() {
    if (this._state !== GameState.Ready) {
      return;
    }
    this._state = GameState.Playing;
    this.setActive(this.startPanel, false);
    this.setActive(this.hud, true);
    this.setActive(this.resultPanel, false);
    this.refreshHud();
    this.emit('game-playing');
  }

  onRestartButton() {
    this.enterReady();
    this.onStartButton();
  }

  gameOver() {
    if (this._state !== GameState.Playing) {
      return;
    }
    this._state = GameState.GameOver;
    this.setActive(this.hud, false);
    this.setActive(this.resultPanel, true);
    if (this.resultScoreLabel) {
      this.resultScoreLabel.string = '分数 ' + this._score;
    }
    this.emit('game-over');
  }

  addScore(delta: number) {
    this._score += delta;
    this.refreshHud();
  }

  /** 普通闪避：分数 +1，连击清零，淡蓝白残影（不慢放） */
  onNormalDodge() {
    this._score += 1;
    this._combo = 0;
    this.refreshHud();
    this.emit('dodge-normal');
  }

  /** 完美闪避：分数 +1，连击 +1，触发子弹时间，金色残影 */
  onPerfectDodge() {
    this._score += 1;
    this._combo += 1;
    this.refreshHud();
    this.triggerBulletTime();
    this.emit('dodge-perfect');
  }

  private triggerBulletTime() {
    this._worldTimeScale = this.bulletTimeScale;
    this._bulletTimeRemain = this.bulletTimeDuration;
  }

  update(dt: number) {
    if (this._bulletTimeRemain > 0) {
      this._bulletTimeRemain -= dt;
      if (this._bulletTimeRemain <= 0) {
        this._bulletTimeRemain = 0;
        this._worldTimeScale = 1.0;
      }
    }
  }

  setCombo(value: number) {
    this._combo = value;
    this.refreshHud();
  }

  setCooldownReady(ready: boolean) {
    if (this.cooldownLabel) {
      this.cooldownLabel.string = ready ? '冷却 就绪' : '冷却 中…';
    }
  }

  /** 相位冷却 HUD：由 PlayerController 按 PhaseController 计时驱动文案 */
  setCooldownText(text: string) {
    if (this.cooldownLabel) {
      this.cooldownLabel.string = text;
    }
  }

  /** 在 Canvas 上广播状态事件，供解耦组件（PlayerController/AttackSpawner 等）监听 */
  private emit(event: string) {
    if (this.node.parent) {
      this.node.parent.emit(event);
    }
  }

  private setActive(node: Node, active: boolean) {
    if (node) {
      node.active = active;
    }
  }

  private refreshHud() {
    if (this.scoreLabel) {
      this.scoreLabel.string = '分数 ' + this._score;
    }
    if (this.comboLabel) {
      this.comboLabel.string = '连击 ' + this._combo;
    }
    if (this.cooldownLabel) {
      this.cooldownLabel.string = '冷却 就绪';
    }
  }
}
