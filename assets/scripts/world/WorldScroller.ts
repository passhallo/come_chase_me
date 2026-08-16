import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { GameManager } from '../core/GameManager';
import { GaitConfig } from '../core/GaitConfig';
const { ccclass, property } = _decorator;

/**
 * 持续前进的视觉：地面石板模块自上而下（远处→近处）滚动，
 * 离开下边界后回收到最上方，形成无限奔跑的前进感。
 *
 * 角色逻辑位置固定不动，本组件只驱动视觉，不参与任何判定。
 *
 * 注：指南中的“移动并放大”（透视近大远小）暂缓 —— 当前为纯色/条纹占位图，
 * 单块放大在视觉上不可见，且需要遮罩或自定义 shader 才能无缝；等正式石板美术到位后
 * 再在模块上叠加随深度变化的 scale。
 */
@ccclass('WorldScroller')
export class WorldScroller extends Component {
  @property(Node)
  pathRoot: Node = null; // 模块挂载点（World 下的空节点）

  @property(SpriteFrame)
  slabFrame: SpriteFrame = null; // 石板纹理（单块）

  // 世界速度 worldSpeed（px/s）。默认取 GaitConfig 基准值，跑步动画据此派生周期，
  // 禁止与此处互不关联地单独修改 Run 动画速度。
  @property({ tooltip: '世界滚动速度 (px/秒)。跑步动画周期按 GaitConfig 自动同步' })
  speed: number = GaitConfig.baselineWorldSpeed;

  /** 世界速度（px/s）—— 跑步动画绑定的唯一速度来源。 */
  get worldSpeed(): number {
    return this.speed;
  }

  @property({ tooltip: '模块数量（≥3）' })
  moduleCount: number = 4;

  @property({ tooltip: '单模块高度 (px)' })
  moduleHeight: number = 420;

  @property({ tooltip: '模块宽度 (px)' })
  moduleWidth: number = 260;

  private _modules: Node[] = [];
  private _topY = 640; // 屏幕上边界（Canvas 局部坐标，中心为原点）
  private _bottomY = -640; // 屏幕下边界

  onLoad() {
    this.buildModules();
  }

  /** 重建模块（幂等：先清空 pathRoot 下的旧模块）。 */
  private buildModules() {
    if (!this.pathRoot || !this.slabFrame) {
      return;
    }
    // 清空旧的模块（保证 onLoad 可重复调用）
    for (const child of [...this.pathRoot.children]) {
      child.destroy();
    }
    this._modules = [];

    const n = Math.max(3, Math.floor(this.moduleCount));
    const H = this.moduleHeight;
    // 首块中心：顶边对齐屏幕上边界，向下依次排布，覆盖屏幕并多出底部回收余量
    const startY = this._topY - H / 2;
    for (let i = 0; i < n; i++) {
      const m = new Node(`PathModule_${i}`);
      m.layer = this.pathRoot.layer;
      m.parent = this.pathRoot;
      const ut = m.addComponent(UITransform);
      ut.setContentSize(this.moduleWidth, H);
      const sp = m.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.spriteFrame = this.slabFrame;
      m.setPosition(0, startY - i * H, 0);
      this._modules.push(m);
    }
  }

  update(dt: number) {
    if (this._modules.length === 0) {
      return;
    }
    const n = this._modules.length;
    const H = this.moduleHeight;
    // 模块顶边完全低于下边界时回收
    const recycleY = this._bottomY - H / 2;
    const ts = GameManager.instance ? GameManager.instance.worldTimeScale : 1.0;
    const step = this.speed * dt * ts;

    for (const m of this._modules) {
      const p = m.position;
      p.y -= step;
      if (p.y <= recycleY) {
        // 回收到最上方：整体上移 n*H，落到当前最上模块之上（间距保持 H，无缝）
        p.y += n * H;
      }
      m.setPosition(p);
    }
  }
}
