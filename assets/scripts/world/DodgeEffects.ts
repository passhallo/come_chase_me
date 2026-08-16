import { _decorator, Component, Node, Sprite, SpriteFrame, Color, UIOpacity, UITransform, Graphics, Label, tween, Vec3, Vec2, Quat } from 'cc';
const { ccclass, property } = _decorator;

interface PartPose {
  frame: SpriteFrame;
  ax: number;
  ay: number;
  x: number;
  y: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  sx: number;
  sy: number;
}

interface GhostEntry {
  root: Node;
  parts: Node[];
  sprites: Sprite[];
  opacity: UIOpacity;
}

/**
 * 闪避残影（分层部件快照 + 对象池）：
 *   普通闪避 → 3 个青白残影（0.04s 间隔、0.20s 淡出、轻微缩小）；
 *   完美闪避 → 5 个金白残影（0.035s 间隔、0.30s 淡出）+ 环形冲击波 + PERFECT 文字。
 *
 * 残影在每次生成时复制 PlayerVisual 各骨骼部件的当前变换（冻结姿势，不再播放动画），
 * 并整体轻微上移（纯视觉，不动 PlayerLogic 碰撞中心）。使用对象池回收，连续闪避不会无限增长。
 */
@ccclass('DodgeEffects')
export class DodgeEffects extends Component {
  @property({ tooltip: '残影向上偏移（纯视觉，不动碰撞中心）' })
  ghostLift: number = 16;

  private _playerVisual: Node = null;
  private _sourceParts: Node[] = [];
  private _pool: GhostEntry[] = [];
  private _active: GhostEntry[] = [];

  onLoad() {
    const canvas = this.node.parent;
    if (canvas) {
      canvas.on('dodge-normal', this.onNormalDodge, this);
      canvas.on('dodge-perfect', this.onPerfectDodge, this);
    }
    this._discover();
  }

  onDestroy() {
    if (this.node.parent) {
      this.node.parent.off('dodge-normal', this.onNormalDodge, this);
      this.node.parent.off('dodge-perfect', this.onPerfectDodge, this);
    }
  }

  private _discover() {
    this._playerVisual = this._find(this.node.parent, 'PlayerVisual');
    const root = this._playerVisual ? this._findChild(this._playerVisual, 'Root') : null;
    this._sourceParts = [];
    if (root) this._collectSprites(root, this._sourceParts);
  }

  private _find(n: Node, name: string): Node {
    if (!n) return null;
    if (n.name === name) return n;
    for (const c of n.children) {
      const r = this._find(c, name);
      if (r) return r;
    }
    return null;
  }

  private _findChild(n: Node, name: string): Node {
    for (const c of n.children) if (c.name === name) return c;
    return null;
  }

  private _collectSprites(n: Node, out: Node[]) {
    if (n.getComponent(Sprite)) out.push(n);
    for (const c of n.children) this._collectSprites(c, out);
  }

  onNormalDodge() {
    this._spawnSeries(3, 0.04, new Color(180, 230, 255, 255), 0.20, 0.92);
  }

  onPerfectDodge() {
    this._spawnRing(255, 215, 90);
    this._spawnSeries(5, 0.035, new Color(255, 220, 130, 255), 0.30, 0.90);
    this._spawnText('PERFECT!', 255, 225, 140);
  }

  private _spawnSeries(count: number, interval: number, color: Color, fade: number, shrinkTo: number) {
    for (let i = 0; i < count; i++) {
      this.scheduleOnce(() => this._spawnGhost(color, fade, shrinkTo), i * interval);
    }
  }

  private _capturePose(): PartPose[] {
    const ref = this._playerVisual.worldPosition;
    const poses: PartPose[] = [];
    for (const pn of this._sourceParts) {
      const sp = pn.getComponent(Sprite);
      const ut = pn.getComponent(UITransform);
      const wp = pn.worldPosition;
      const q = pn.worldRotation;
      const ws = pn.worldScale;
      const a = ut.anchorPoint;
      poses.push({
        frame: sp.spriteFrame,
        ax: a.x, ay: a.y,
        x: wp.x - ref.x, y: wp.y - ref.y,
        qx: q.x, qy: q.y, qz: q.z, qw: q.w,
        sx: ws.x, sy: ws.y,
      });
    }
    return poses;
  }

  private _acquire(): GhostEntry {
    let e = this._pool.pop();
    if (!e) e = this._createEntry();
    e.root.active = true;
    this._active.push(e);
    return e;
  }

  private _release(e: GhostEntry) {
    const i = this._active.indexOf(e);
    if (i >= 0) this._active.splice(i, 1);
    e.root.active = false;
    this._pool.push(e);
  }

  private _createEntry(): GhostEntry {
    const root = new Node('Ghost');
    root.parent = this.node;
    const opacity = root.addComponent(UIOpacity);
    opacity.opacity = 255;
    const parts: Node[] = [];
    const sprites: Sprite[] = [];
    for (const p of this._sourceParts) {
      const n = new Node(p.name);
      n.parent = root;
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.TRIMMED;
      parts.push(n);
      sprites.push(sp);
    }
    root.active = false;
    return { root, parts, sprites, opacity };
  }

  private _spawnGhost(color: Color, fade: number, shrinkTo: number) {
    if (!this._sourceParts.length || !this._playerVisual) return;
    const poses = this._capturePose();
    const entry = this._acquire();
    const ref = this._playerVisual.worldPosition;

    // 残影根放在角色中心（+轻微上移），子节点用局部变换还原冻结姿势
    entry.root.setScale(1, 1, 1);
    entry.root.setRotation(new Quat());
    entry.root.setWorldPosition(ref.x, ref.y + this.ghostLift, 0);

    for (let i = 0; i < entry.parts.length; i++) {
      const gn = entry.parts[i];
      const p = poses[i];
      const ut = gn.getComponent(UITransform);
      entry.sprites[i].spriteFrame = p.frame;
      ut.anchorPoint = new Vec2(p.ax, p.ay);
      entry.sprites[i].color = color;
      gn.setPosition(p.x, p.y, 0);
      gn.setRotation(new Quat(p.qx, p.qy, p.qz, p.qw));
      gn.setScale(p.sx, p.sy, 1);
    }

    entry.opacity.opacity = 255;
    tween(entry.opacity).to(fade, { opacity: 0 }).start();
    tween(entry.root)
      .to(fade, { scale: new Vec3(shrinkTo, shrinkTo, 1) })
      .call(() => this._release(entry))
      .start();
  }

  private _spawnRing(r: number, g: number, b: number) {
    const n = new Node('PerfectRing');
    n.parent = this.node;
    n.setPosition(0, 0, 0);
    const gr = n.addComponent(Graphics);
    gr.lineWidth = 8;
    gr.strokeColor = new Color(r, g, b, 255);
    gr.circle(0, 0, 60);
    gr.stroke();
    const op = n.addComponent(UIOpacity);
    op.opacity = 255;
    n.setScale(0.3, 0.3, 1);
    tween(n).to(0.32, { scale: new Vec3(2.0, 2.0, 1) }).start();
    tween(op).to(0.32, { opacity: 0 }).call(() => n.destroy()).start();
  }

  private _spawnText(text: string, r: number, g: number, b: number) {
    const n = new Node('PerfectLabel');
    n.parent = this.node;
    n.setPosition(0, 90, 0);
    const ut = n.addComponent(UITransform);
    ut.setContentSize(360, 90);
    const label = n.addComponent(Label);
    label.string = text;
    label.fontSize = 54;
    label.color = new Color(r, g, b, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    const op = n.addComponent(UIOpacity);
    op.opacity = 255;
    tween(n).to(0.5, { position: new Vec3(0, 190, 0) }).start();
    tween(op).to(0.5, { opacity: 0 }).call(() => n.destroy()).start();
  }
}
