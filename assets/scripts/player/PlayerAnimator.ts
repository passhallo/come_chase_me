import { _decorator, Component, Node, Animation, AnimationClip, AnimationState, UIOpacity, Sprite, Color, Label, UITransform, director } from 'cc';
import { GaitConfig, runDurationForSpeed, runPlaybackSpeed } from '../core/GaitConfig';
import { WorldScroller } from '../world/WorldScroller';
const { ccclass, property } = _decorator;

/**
 * 角色 2D 骨骼动画控制器：分层 PNG + 节点父子关系 + Cocos Animation 关键帧。
 * 挂在 PlayerVisual 上，只驱动 PlayerVisual 子树（Root 下的骨骼层级），
 * 绝不动 PlayerLogic（逻辑碰撞中心保持不变）。
 *
 * 状态：
 *   Run（默认循环跑步）、PhaseStart → PhaseLoop（相位，自动回到 Run）、Hit（受击，停在受击姿势）。
 */
@ccclass('PlayerAnimator')
export class PlayerAnimator extends Component {
  @property(AnimationClip)
  runClip: AnimationClip = null;

  @property(AnimationClip)
  phaseStartClip: AnimationClip = null;

  @property(AnimationClip)
  phaseLoopClip: AnimationClip = null;

  @property(AnimationClip)
  hitClip: AnimationClip = null;

  @property({ tooltip: '相位时角色上移（纯视觉，不动 PlayerLogic）' })
  phaseLift: number = 20;

  @property({ tooltip: '相位透明度 0-255（45% ≈ 115）' })
  phaseOpacity: number = 115;

  @property({ tooltip: '相位淡入时长（秒，对应 PhaseStart）' })
  phaseInDuration: number = 0.08;

  @property({ tooltip: '相位总时长（秒，PhaseStart + PhaseLoop）' })
  phaseDuration: number = 0.25;

  @property({ tooltip: '相位染色（青白）' })
  tintColor: Color = new Color(190, 235, 245, 255);

  @property({ tooltip: '世界滚动器引用（可选，为空则运行时从场景查找）' })
  worldScroller: WorldScroller = null;

  @property({ tooltip: '步态调试 HUD（验证用，正式版可关闭）' })
  debugEnabled: boolean = true;

  @property({ tooltip: '步态调试标签（可选，为空则自动创建）' })
  debugLabel: Label = null;

  private _anim: Animation = null;
  private _opacity: UIOpacity = null;
  private _root: Node = null;
  private _sprites: Sprite[] = [];
  private _mode: 'run' | 'phase' | 'hit' | null = null;
  private _phaseStage: 'start' | 'loop' = 'start';
  private _phaseElapsed = 0;
  private _rootBaseY = 0;

  // —— 步态同步（GaitConfig）——
  private _worldScroller: WorldScroller = null;
  private _prevRunWrapped = -1;
  private _lastFoot: 'left' | 'right' | null = null;
  private _debugLabelNode: Node = null;

  onLoad() {
    this._anim = this.getComponent(Animation) || this.addComponent(Animation);
    const clips = this._anim.clips || [];
    if (clips.length === 0) {
      if (this.runClip) this._anim.addClip(this.runClip);
      if (this.phaseStartClip) this._anim.addClip(this.phaseStartClip);
      if (this.phaseLoopClip) this._anim.addClip(this.phaseLoopClip);
      if (this.hitClip) this._anim.addClip(this.hitClip);
    }

    this._opacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
    this._opacity.opacity = 255;

    for (const c of this.node.children) {
      if (c.name === 'Root') {
        this._root = c;
        break;
      }
    }
    if (this._root) {
      this._rootBaseY = this._root.position.y;
      this._sprites = this._root.getComponentsInChildren(Sprite);
    }

    // 步态同步：定位世界滚动器，准备调试 HUD。
    this._worldScroller = this.worldScroller
      || (director.getScene() ? director.getScene().getComponentInChildren(WorldScroller) : null);
    if (this.debugEnabled) {
      this._ensureDebugLabel();
    }

    this.playRun();
  }

  /** 默认：循环跑步 */
  playRun() {
    if (this._mode === 'run') return;
    this._mode = 'run';
    this._phaseElapsed = 0;
    this._clearPhaseEffects();
    this._play('Run');
  }

  /** 相位：PhaseStart → PhaseLoop → Run（自动） */
  playPhase() {
    if (this._mode === 'hit') return;
    this._mode = 'phase';
    this._phaseStage = 'start';
    this._phaseElapsed = 0;
    this._play('PhaseStart');
  }

  /** 受击：立即打断，播放 Hit，停在受击姿势 */
  playHit() {
    this._mode = 'hit';
    this._phaseElapsed = 0;
    this._clearPhaseEffects();
    this._play('Hit');
  }

  /** 复位到跑步 */
  reset() {
    this.playRun();
  }

  update(dt: number) {
    this._syncRunSpeed();

    if (this._mode !== 'phase') return;
    this._phaseElapsed += dt;
    if (this._phaseStage === 'start' && this._phaseElapsed >= this.phaseInDuration) {
      this._phaseStage = 'loop';
      this._play('PhaseLoop');
    }
    if (this._phaseElapsed >= this.phaseDuration) {
      this.playRun();
      return;
    }
    this._applyPhaseEffects();
  }

  private _play(name: string) {
    if (!this._anim) return;
    const clips = this._anim.clips || [];
    if (clips.length === 0) return;
    this._anim.play(name);
  }

  /** 相位视觉：Root 上移（阴影不动）+ 半透明 + 青白染色 */
  private _applyPhaseEffects() {
    const t = Math.min(1, this._phaseElapsed / this.phaseInDuration);
    if (this._root) {
      this._root.setPosition(this._root.position.x, this._rootBaseY + this.phaseLift * t, this._root.position.z);
    }
    if (this._opacity) {
      this._opacity.opacity = Math.round(255 + (this.phaseOpacity - 255) * t);
    }
    this._applyTint(t);
  }

  private _clearPhaseEffects() {
    if (this._root) {
      this._root.setPosition(this._root.position.x, this._rootBaseY, this._root.position.z);
    }
    if (this._opacity) {
      this._opacity.opacity = 255;
    }
    this._applyTint(0);
  }

  private _applyTint(t: number) {
    const r = Math.round(255 + (this.tintColor.r - 255) * t);
    const g = Math.round(255 + (this.tintColor.g - 255) * t);
    const b = Math.round(255 + (this.tintColor.b - 255) * t);
    for (const sp of this._sprites) {
      if (sp) sp.color = new Color(r, g, b, 255);
    }
  }

  // ===================== 步态同步（GaitConfig）=====================

  /** 每帧：按世界速度同步 Run 播放倍率，并检测左右脚落地事件。 */
  private _syncRunSpeed() {
    if (!this._anim) return;
    const state = this._anim.getState('Run');
    if (!state) return;

    const worldSpeed = this._worldScroller ? this._worldScroller.worldSpeed : GaitConfig.baselineWorldSpeed;
    const runDuration = runDurationForSpeed(worldSpeed);
    const speed = runPlaybackSpeed(worldSpeed);
    if (state.speed !== speed) {
      state.speed = speed;
    }

    this._detectFootContact(state);
    this._updateDebugLabel(state, worldSpeed, runDuration);
  }

  /** 按 Run 剪辑当前时间检测左右脚落地（t=0 左脚，t=0.275 右脚，循环）。 */
  private _detectFootContact(state: AnimationState) {
    const dur = state.duration;
    if (dur <= 0) return;
    const wrapped = state.time - Math.floor(state.time / dur) * dur;

    if (this._prevRunWrapped < 0) {
      this._prevRunWrapped = wrapped;
      this._onFootContact('left'); // 起跑即左脚落地
      return;
    }

    const rightFrac = GaitConfig.footContactFractions[1]; // 0.5（右脚本应在半周期 t=0.275s 落地）
    const rightTime = rightFrac * dur;
    if (this._prevRunWrapped < rightTime && wrapped >= rightTime) {
      this._onFootContact('right');
    }
    if (wrapped < this._prevRunWrapped) {
      // 时间回卷 = 一个循环结束，回到左脚落地
      this._onFootContact('left');
    }
    this._prevRunWrapped = wrapped;
  }

  private _onFootContact(foot: 'left' | 'right') {
    this._lastFoot = foot;
    this.node.emit('foot-contact', foot);
    if (this.node.parent) {
      this.node.parent.emit('foot-contact', foot);
    }
  }

  private _updateDebugLabel(state: AnimationState, worldSpeed: number, runDuration: number) {
    if (!this.debugEnabled) return;
    const label = this.debugLabel || (this._debugLabelNode ? this._debugLabelNode.getComponent(Label) : null);
    if (!label) return;
    const frac = state.duration > 0 ? (state.time % state.duration) / state.duration : 0;
    const foot = this._lastFoot || '-';
    label.string =
      `Gait speed=${worldSpeed} runDur=${runDuration.toFixed(3)}s\n` +
      `phase=${frac.toFixed(2)} foot=${foot}`;
  }

  /** 无手动指定标签时，自动在 Canvas 顶部创建调试 Label。 */
  private _ensureDebugLabel() {
    if (this.debugLabel) return;
    let canvas = this.node.parent;
    while (canvas && canvas.name !== 'Canvas') canvas = canvas.parent;
    if (!canvas) return;
    const labelNode = new Node('GaitDebugLabel');
    labelNode.layer = canvas.layer;
    canvas.addChild(labelNode);
    const ut = labelNode.addComponent(UITransform);
    ut.setContentSize(460, 64);
    const label = labelNode.addComponent(Label);
    label.fontSize = 16;
    label.lineHeight = 22;
    label.color = new Color(255, 235, 140, 255);
    labelNode.setPosition(0, 560, 0);
    this._debugLabelNode = labelNode;
    this.debugLabel = label;
  }
}
