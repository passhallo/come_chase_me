import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Color } from 'cc';
import { GameManager } from '../core/GameManager';
const { ccclass, property } = _decorator;

/**
 * 轻微雨丝占位：若干半透明细条自上而下坠落，离开下边界后回收到顶部并随机横移。
 * 仅视觉，不参与判定。
 */
@ccclass('RainLayer')
export class RainLayer extends Component {
  @property(SpriteFrame)
  streakFrame: SpriteFrame = null; // 雨丝纹理（占位用白色小块）

  @property({ tooltip: '雨丝数量' })
  count: number = 22;

  @property({ tooltip: '下落速度 (px/秒)' })
  speed: number = 620;

  @property({ tooltip: '横向范围 (±px)' })
  width: number = 360;

  private _drops: { node: Node; speed: number }[] = [];
  private _topY = 680;
  private _bottomY = -680;

  onLoad() {
    this.build();
  }

  private build() {
    if (!this.streakFrame) {
      return;
    }
    for (let i = 0; i < this.count; i++) {
      const n = new Node(`Rain_${i}`);
      n.layer = this.node.layer;
      n.parent = this.node;
      const ut = n.addComponent(UITransform);
      ut.setContentSize(3, 22 + Math.random() * 16);
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.spriteFrame = this.streakFrame;
      sp.color = new Color(200, 215, 235, 60 + Math.random() * 50);
      n.setPosition((Math.random() * 2 - 1) * this.width, this._bottomY + Math.random() * (this._topY - this._bottomY), 0);
      this._drops.push({ node: n, speed: this.speed * (0.8 + Math.random() * 0.5) });
    }
  }

  update(dt: number) {
    const ts = GameManager.instance ? GameManager.instance.worldTimeScale : 1.0;
    for (const d of this._drops) {
      const p = d.node.position;
      p.y -= d.speed * dt * ts;
      if (p.y < this._bottomY) {
        p.y = this._topY;
        p.x = (Math.random() * 2 - 1) * this.width;
      }
      d.node.setPosition(p);
    }
  }
}
