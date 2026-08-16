import { _decorator, Component, Node } from 'cc';
import { GameManager } from '../core/GameManager';
import { PhaseController } from '../player/PhaseController';
import { PlayerController } from '../player/PlayerController';
import { AttackController } from './AttackController';
const { ccclass, property } = _decorator;

/**
 * 攻击生成器：挂载在 AttackLayer 上。
 * 游戏进行中每 1.4–2.2 秒生成一枚来自前方的暗器（本步只有正前方）。
 * 结算或重开时停止生成并清空所有攻击节点。
 */
@ccclass('AttackSpawner')
export class AttackSpawner extends Component {
  @property(PhaseController)
  phaseController: PhaseController = null;

  @property(PlayerController)
  playerController: PlayerController = null;

  @property(GameManager)
  gameManager: GameManager = null;

  @property(Node)
  playerLogic: Node = null;

  @property({ tooltip: '生成间隔下限（秒）' })
  minInterval = 1.4;

  @property({ tooltip: '生成间隔上限（秒）' })
  maxInterval = 2.2;

  private _active = false;
  private _timer = 0;

  onLoad() {
    // 事件挂在 Canvas 上（GameManager 广播），AttackLayer 的父节点即 Canvas
    const canvas = this.node.parent;
    if (canvas) {
      canvas.on('game-playing', this.onPlaying, this);
      canvas.on('game-over', this.onGameOver, this);
      canvas.on('game-ready', this.onReady, this);
    }
  }

  onDestroy() {
    if (this.node.parent) {
      this.node.parent.off('game-playing', this.onPlaying, this);
      this.node.parent.off('game-over', this.onGameOver, this);
      this.node.parent.off('game-ready', this.onReady, this);
    }
  }

  onPlaying() {
    this._active = true;
    this._timer = this.nextInterval();
  }

  onGameOver() {
    this._active = false;
    this.clearAttacks();
  }

  onReady() {
    this._active = false;
    this._timer = 0;
    this.clearAttacks();
  }

  private nextInterval(): number {
    return this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
  }

  update(dt: number) {
    if (!this._active) {
      return;
    }
    this._timer -= dt;
    if (this._timer <= 0) {
      this.spawn();
      this._timer += this.nextInterval();
    }
  }

  private spawn() {
    const node = new Node('Attack');
    this.node.addChild(node);
    const ac = node.addComponent(AttackController);
    ac.phaseController = this.phaseController;
    ac.playerController = this.playerController;
    ac.gameManager = this.gameManager;
    ac.playerY = this.playerLogic ? this.playerLogic.position.y : -140;
  }

  private clearAttacks() {
    for (const child of this.node.children.slice()) {
      child.destroy();
    }
  }
}
