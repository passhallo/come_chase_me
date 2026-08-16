# 《Come Chase Me》AI + Cocos 制作指南（零基础版）

> 目标：制作一款竖屏微信小游戏。角色自动向前奔跑，固定在画面中心附近；危险可从八个方向袭来。玩家点击屏幕进入短暂无敌的“相位闪避”，在命中前极短时间点击会触发“完美闪避 + 子弹时间”。游戏免费，主要通过激励广告解锁主题与复活。

本指南有两个版本：**MVP 简版**用来尽快验证“点击时机是否好玩”；**完整版本**在 MVP 可玩后逐步加入主题、追逐氛围、广告和关卡。不要一开始制作所有主题或所有攻击。

---

## 0. 先认识制作方式

你不需要手写全部代码。工作流是：

1. 打开 Cocos Creator 项目 `D:\come_chase_me\come_chase_me`。
2. 启动项目中的 Cocos MCP 服务（当前项目已经有 `funplay-cocos-mcp.config.json`，地址为 `127.0.0.1:8765`）。
3. 在支持 MCP 的 AI 对话中，让 AI 读取项目结构、创建场景、脚本、预制体和资源引用。
4. 每完成一个小目标，要求 AI 在 Cocos 预览并报告：做了什么、测试了什么、原始报错（若有）和仍未验证的部分。

### 每次都可以复制给 AI 的总约束

```text
你正在 Cocos Creator 项目 D:\come_chase_me\come_chase_me 中工作，请通过已连接的 Cocos MCP 操作项目。
这是竖屏微信小游戏《Come Chase Me》。不要修改或删除未明确属于本任务的文件；每次只完成一个可验证的小目标。
完成后必须：
1) 列出新建/修改的文件和节点；
2) 在 Cocos 中运行或预览进行端到端验证；
3) 如实说明验证范围、原始错误和未验证项；
4) 不要把“脚本已写入”说成“游戏已完成”。
```

### 推荐项目结构

```text
assets/
  scenes/                 # Boot、Game、Menu
  scripts/
    core/                 # GameManager、EventBus、PoolManager
    player/               # PlayerController、PhaseController
    attacks/              # AttackSpawner、AttackController、WarningRing
    world/                # WorldScroller、ChaserController
    ui/                   # HUD、ResultPanel、ThemePanel
  prefabs/                # Player、Attack、Warning、Effect
  art/
    common/               # 通用 UI、预警、特效
    themes/wuxia/         # 武侠主题资源
  audio/
    music/
    sfx/
```

---

# 版本 A：MVP 简版（先做成可玩的小游戏）

## A1. 简版范围与验收标准

只做一个武侠雨夜主题、一个角色、两种攻击和无尽模式。**暂不做广告、账号、排行榜、怪兽追逐、关卡和多主题。**

验收标准：在手机竖屏比例预览中，玩家可以开始游戏；角色持续有前进感；攻击会预警后命中；点击能闪避；完美闪避触发慢时间；未闪避会结算并能重新开始。

| 模块 | MVP 内容 |
|---|---|
| 镜头 | 竖屏，45–60° 斜俯视；角色位于屏幕中心略下 |
| 人物 | 2D 骨骼或分层角色；原地跑步循环、相位、受击三种状态 |
| 场景 | 窄的江湖石板/栈道；地面纹理由上向下流动，形成前进感 |
| 攻击 | 前方暗器、左/右横切剑气 |
| 操作 | 点击任意位置触发 0.25 秒相位，无敌结束后 0.7 秒冷却 |
| 完美 | 攻击命中前 0.08 秒内触发；0.15 秒子弹时间、金色残影、连击 +1 |
| 失败 | 非无敌状态命中即结算；可直接重开 |

### A2. 核心判定（先确定，避免视觉影响公平）

角色逻辑坐标固定，不随视觉跑步移动。所有攻击都有一个预计抵达时刻 `hitTime`。

```text
当前时间 >= hitTime：检查玩家是否相位无敌
  是：攻击穿过，记为普通闪避或完美闪避
  否：玩家受击，游戏结束

点击时：若冷却结束，进入 0.25 秒相位无敌
完美条件：点击时间落在 [hitTime - 0.08 秒, hitTime] 内
```

初版推荐参数（必须在试玩后调整，不是最终数值）：

| 参数 | 初始建议 |
|---|---:|
| 相位无敌 | 0.25 秒 |
| 相位冷却 | 0.70 秒 |
| 完美窗口 | 0.08 秒 |
| 子弹时间 | 0.15 秒 |
| 世界时间倍率 | 0.4 |
| 角色与输入倍率 | 1.0 |

### A3. MVP 的 AI + MCP 实施顺序

每次只发送一个任务，等 AI 验证后再做下一项。

1. **建立场景与 UI**

```text
通过 Cocos MCP 在项目中创建 MVP 的 Game 场景：竖屏 720×1280 设计分辨率。
创建 Canvas、World、PlayerLogic、PlayerVisual、AttackLayer、EffectLayer、HUD、ResultPanel 节点。
角色锚定在屏幕中心略下；HUD 只显示分数、连击和相位冷却；ResultPanel 默认隐藏，包含分数与“再来一局”按钮。
不要加入最终美术，先使用颜色块和占位图。请运行预览，验证节点层级、开始和重开按钮都可用。
```

2. **持续前进的视觉**

```text
通过 Cocos MCP 为 Game 场景实现 WorldScroller：地面由至少 3 个可循环复用的石板模块组成，从屏幕上方/远处向屏幕下方/近处移动并放大；离开下边界后回收到远处。
角色逻辑位置必须固定。加入轻微雨雾和角色脚下接触阴影占位效果。请预览 30 秒，验证没有明显接缝、跳动或对象无限增长。
```

3. **角色 2D 骨骼动画与相位**

```text
通过 Cocos MCP 创建 PlayerController 和 PhaseController。角色视觉包含 Run、PhaseStart、PhaseLoop、Hit 四个可切换状态；暂时允许用分层占位角色或简单帧动画替代正式骨骼资源。
点击屏幕任意非 UI 区域时，若冷却结束，进入 0.25 秒相位无敌；角色视觉轻微上移、缩小、半透明，结束后回到 Run。HUD 显示冷却。
请在预览中连续点击，验证冷却期间不能重复开启相位，且相位结束必然恢复跑步状态。
```

4. **第一种攻击与死亡**

```text
通过 Cocos MCP 实现 AttackSpawner 和 AttackController：每 1.4–2.2 秒生成一枚来自前方的暗器。它经历预警、接近、hitTime、离场四个阶段；hitTime 时检查 PhaseController 的无敌状态。
命中后停止生成攻击、播放受击占位效果、显示 ResultPanel；再来一局必须完整重置时间、分数、攻击和相位状态。请分别验证“未点击必死”和“相位中必定躲过”。
```

5. **完美闪避与慢时间**

```text
通过 Cocos MCP 为攻击增加完美判定：攻击命中前 0.08 秒内成功开启相位则为 Perfect。
Perfect 时只降低 World、Attack、Effect、Chaser（若有）这些世界层的时间倍率到 0.4，持续 0.15 秒；Player 的输入和相位动画保持正常速度。生成金色残影、环形冲击波、PERFECT 文字占位，连击 +1。
普通闪避生成较淡的蓝白残影但不触发慢时间。请在预览中验证慢时间结束后不会永久变慢或叠加失控。
```

6. **加入侧方攻击与难度**

```text
通过 Cocos MCP 新增左/右横切剑气攻击，使用屏幕边缘预警和不同的 hitTime。攻击仍统一在角色固定判定点结算。
实现无尽难度曲线：每 20 秒略缩短攻击间隔，60 秒后允许连续两次不同方向攻击；避免两次攻击的 hitTime 间距小于 0.45 秒。请运行至少 90 秒，检查攻击对象是否正确回收、难度逐渐提升且仍可反应。
```

### A4. MVP 测试清单

- 未点击时，第一次攻击命中后必定进入结算。
- 在相位期间命中，必定穿过且不会受击。
- 冷却期间点击没有重复无敌、没有重复残影。
- 完美闪避只在设定窗口触发，世界慢时间会恢复。
- 重开后攻击、分数、连击、时间倍率和 UI 都恢复初始状态。
- 连续游玩 10 局后，节点/内存数量没有持续增长。
- 在目标微信设备上进行真机预览；编辑器预览通过不等于微信端已验证。

---

# 版本 B：完整版本（在 MVP 验证后扩展）

## B1. 完整玩法

### 八方向攻击

攻击方向为：前、右前、右、右后、后、左后、左、左前。方向主要决定预警与视觉路径，**不改变“命中时间点 + 相位无敌”的统一判定**。

后方三方向必须有明确预警，不能依赖不可见攻击：

- 角色脚下八向预警环的对应 45° 扇区发亮；
- 相应屏幕边缘闪红/主题色；
- 使用对应方位的音效；
- 大型攻击给予更长预警。

### 追逐层

后方不是普通攻击，而是叙事和时间压力：经过的路面会被吞没。它默认只做视觉推进；在“追逐挑战”中才真正形成失败边界。

```text
最远层：雨雾、巨兽、黑洞、数据风暴等追逐者
中间层：已经走过、崩解或被吞掉的道路
最近层：角色周边八向预警环和后方攻击提示
```

### 游戏模式

| 模式 | 首要目标 | 解锁策略 |
|---|---|---|
| 无尽逃生 | 高分与最长存活 | 默认永久免费 |
| 章节闯关 | 完成固定攻击序列 | 主题解锁后开放 |
| 追逐挑战 | 在追逐者逼近下生存 | 完成基础章节后开放 |
| Boss 战 | 记忆 Boss 技能节奏 | 后续更新 |
| 每日挑战 | 所有人同一攻击种子 | 后续更新，不插广告 |

## B2. 广告与主题解锁

不提供付费购买；广告只给可选奖励，不能在对局中展示。

| 位置 | 规则 |
|---|---|
| 主题试玩 | 每个未解锁主题免费试玩 1 局或 1 个短关 |
| 主题永久解锁 | 玩家主动观看 1 次激励广告 |
| 失败复活 | 每局至多一次，玩家主动观看激励广告 |
| 双倍解锁进度 | 结算时可选；不影响战斗强度 |
| 首页横幅 | 可考虑；不能出现在实际对局中 |
| 插屏 | 谨慎低频，只在完整对局结束后使用；需按平台规则验证 |

广告 SDK、隐私合规、激励广告回调与微信发布规则会随平台更新，实施前必须读取当时的微信小游戏官方文档并在真机验证；本指南不把它们当作已验证的配置。

## B3. 主题包规范

同一套核心判定，替换角色外观、环境、攻击视觉、追逐层、UI 配色和音效。

| 主题 | 跑步/相位 | 攻击 | 后方追逐 |
|---|---|---|---|
| 武侠雨夜 | 轻功奔跑、雨中残影 | 暗器、剑气、落雷 | 雨雾吞没栈道 |
| 魔法逃亡 | 法阵踏步、短距传送 | 火球、冰锥、符文 | 巨兽吞掉浮空道路 |
| 赛博失控 | 机械奔跑、数据相位 | 无人机、激光、数据弹 | 红色数据风暴侵蚀街道 |
| 太空断桥 | 推进器滑行、折跃 | 陨石、离子炮、能量波 | 黑洞吞噬舰桥 |

主题资源必须保持：角色在画面中心清晰、前景不遮挡预警环、后方追逐者不遮挡后/左后/右后预警。

## B4. 完整版迭代顺序

1. MVP 稳定且完成真机测试。
2. 攻击扩展到八方向，加入对象池与攻击配置表。
3. 完成追逐层及“追逐挑战”。
4. 完成主题系统，再制作第二主题“魔法逃亡”。
5. 接入广告与本地解锁存档，并完成真机回调测试。
6. 制作章节、三星目标、Boss 与每日挑战。
7. 性能优化、微信真机测试、发布准备。

---

# AI 素材提示词库

## 通用提示词前缀

将以下要求附在每一条视觉提示词后：

```text
vertical mobile game asset, 9:16 composition, stylized premium casual mobile game art, clear silhouette, center-safe composition, no text, no logo, no watermark, no UI buttons, transparent background when requested, consistent camera angle: 55-degree elevated rear three-quarter view, readable at small size, avoid photorealism
```

视觉素材生成后仍需要检查授权、去除文字/水印，并在实际手机屏幕尺寸下验证可读性。

## 武侠雨夜：生图提示词

### 1. 主角 2D 骨骼拆分素材

```text
Create a production-ready 2D skeletal-animation character asset for a vertical mobile game: a young wuxia wanderer seen from a 55-degree elevated rear three-quarter camera angle, running toward the top of the screen. Dark navy travel robe with muted teal inner layers, short tied black hair, light cloth cape, subtle silver belt ornament, agile but not bulky. Separate clean layers for head, torso, left upper arm, left forearm, right upper arm, right forearm, left thigh, left shin, right thigh, right shin, feet, cape front, cape back, and weapon sheath. Neutral running-ready pose, full body, clear outlines, soft painted cel shading, restrained rainy-night blue-green palette, transparent background, no ground shadow, no text, no logo, no watermark.
```

### 2. 场景地面模块

```text
Vertical mobile game environment, narrow ancient mountain plank road and wet stone path viewed from a 55-degree elevated rear three-quarter camera, vanishing toward the upper center, designed as seamless scrollable modular tiles. Rainy Jianghu night, dark emerald bamboo silhouettes, wet reflective stones, warm distant lantern haze, enough clean space around the central path for eight-direction attack warnings, foreground and background separated into layers, stylized premium casual game art, no characters, no enemies, no text, no logo, no watermark.
```

### 3. 八方向攻击素材

```text
Mobile game VFX sprite sheet concept, wuxia rainy-night theme: eight clearly differentiated incoming attack indicators around a center target, including flying dagger, curved sword qi slash, needle volley, lightning strike warning, each with crimson danger edge and pale cyan rain reflection. Create separate transparent-background elements with strong silhouettes and visible travel direction, not gore, no text, no logo, no watermark, suitable for additive particle effects.
```

### 4. 普通相位残影

```text
Transparent-background mobile game VFX: three soft translucent cyan-blue afterimages of a wuxia runner, arranged along a very short forward dash trajectory, rain droplets splitting around the silhouette, subtle ink-wash wisps, low intensity, readable at small mobile size, no text, no logo, no watermark.
```

### 5. 完美闪避残影与冲击波

```text
Transparent-background premium mobile game VFX for a perfect dodge: five bright white-gold and pale cyan afterimages of a wuxia runner cutting through an incoming weapon, a thin circular sword-wind shockwave expanding from the center, frozen rain droplets, elegant energy fragments, intense but clean, no damage numbers, no words, no logo, no watermark.
```

## 魔法逃亡：生图提示词

### 1. 地图与追逐巨兽

```text
Vertical 9:16 mobile game environment, a narrow floating stone causeway leading toward the upper center through a moonlit magical void. A colossal shadowy fantasy beast follows far behind at the lower edge, calmly consuming broken pieces of already-passed road; its face is partially obscured by violet mist and glowing eyes, threatening but not horror or gore. Keep the center and character area clean for gameplay, preserve space for eight-direction warnings, 55-degree elevated rear three-quarter view, stylized polished casual game art, no text, no logo, no watermark.
```

### 2. 魔法相位效果

```text
Transparent-background mobile game VFX: a short-range phase dodge in an arcane fantasy style, a runner dissolves into violet-blue rune shards, three translucent silhouettes, thin circular magic sigil under the feet, sparkling particles flowing forward, clean readable composition, no text, no logo, no watermark.
```

## 生视频提示词（仅用于宣传，不用于游戏实时玩法）

视频不能承担实时点击、无敌判定或随机攻击；只用于商店页、广告素材、开场或主题解锁演出。生成后需要剪辑、压缩并检查是否能无缝循环。

### 武侠主题 6 秒宣传循环

```text
6-second seamless vertical 9:16 premium mobile game trailer loop. Elevated rear three-quarter camera follows a lone wuxia wanderer running along a narrow rain-soaked mountain path at night. Rain and mist chase from behind, a flying dagger enters from the left, the hero performs a precise phase dodge leaving pale cyan and gold afterimages; the world briefly slows, suspended raindrops glint, then normal speed returns. Stylized polished casual game rendering, dramatic but readable, no text, no logos, no watermark, no camera cuts, no gore.
```

### 魔法主题 8 秒解锁演出

```text
8-second vertical 9:16 mobile game theme-unlock cinematic. A young mage runs along a floating stone road through a violet magical void. A huge distant creature behind gently devours the collapsing road, without attacking the hero directly. Fireballs and rune projectiles approach from diagonals; the mage phase-teleports through one, leaving glowing rune afterimages. Keep the hero centered and the motion readable; polished stylized game art, no text, no logo, no watermark, no horror gore.
```

## 音乐提示词

### 武侠雨夜循环 BGM

```text
Create an original 60-second seamless looping instrumental soundtrack for a fast-reacting mobile game, Chinese wuxia rainy-night atmosphere. 112 BPM, tense but elegant, plucked guzheng and bamboo flute fragments over restrained taiko-like percussion, rain texture and low strings, leave space for gameplay sound effects, intensity gradually rises over 45 seconds then resolves cleanly into the loop point. No vocals, no recognizable melody from existing works, no spoken words, deliver loop-ready game music.
```

### 魔法追逐循环 BGM

```text
Create an original 60-second seamless looping instrumental for a fantasy chase mobile game. 118 BPM, urgent magical pursuit, celesta pulses, low choir-like synth pads without lyrics, hand percussion, rising strings, distant monster-scale bass accents. Begin mysterious, become more urgent, then return smoothly to the opening energy. No vocals, no recognizable existing melody, loop-ready, gameplay-friendly dynamic range.
```

## 音效提示词（分别生成短音频，不要让 AI 生成一整段混合音频）

| 使用时机 | 提示词 |
|---|---|
| 普通点击相位 | `Create a clean 0.25-second mobile game SFX for activating a short invincibility phase in a wuxia rain theme: quick cloth whoosh, airy bamboo-flute breath, subtle watery shimmer, crisp attack, no voice, no music, mono-compatible.` |
| 普通闪避成功 | `Create a clean 0.35-second mobile game SFX for an incoming dagger passing harmlessly through a spectral wuxia afterimage: soft reverse whoosh followed by a light rain-sparkle tail, no voice, no music, mono-compatible.` |
| 完美闪避 | `Create a high-impact 0.6-second mobile game SFX for a perfect dodge: sharp sword-chime transient, brief time-stretch swoosh, bright gold energy burst, then a short sparkling tail. Triumphant and precise, not harsh, no voice, no music, mono-compatible.` |
| 子弹时间开启 | `Create a 0.4-second game SFX for entering bullet time: descending filtered world-whoosh, soft low-frequency dip, delicate suspended raindrop sparkle, no voice, no music, mono-compatible.` |
| 子弹时间恢复 | `Create a 0.25-second game SFX for time returning to normal: rising air release, one subtle bright chime, no voice, no music, mono-compatible.` |
| 受击 | `Create a concise 0.5-second non-gory mobile game hit SFX: blunt impact, cloth snap, low rain-muted thud, brief energy crackle, communicates failure without pain vocal, no music, mono-compatible.` |
| 后方危险预警 | `Create a 0.3-second directional-ready game warning SFX for danger approaching from behind: low muted pulse with a short rising breath, clear but not alarming, no voice, no music, mono-compatible.` |
| 完美连击增长 | `Create a 0.2-second mobile game combo increment SFX: bright pentatonic chime with a very short sparkling tail, distinct but gentle when repeated rapidly, no voice, no music, mono-compatible.` |

为避免听觉疲劳：普通点击、普通闪避、完美闪避必须有明显层级；同一音效快速连续播放时应有最短重播间隔或随机微小音高变化。所有音效需在手机扬声器与耳机上分别测试。

---

# 最终交付与发布前核验

在宣布“完成”前，必须至少验证：

1. Cocos 编辑器预览：所有核心状态可走通。
2. 微信小游戏开发者工具：构建无阻断错误。
3. 至少一台真机：点击、音频、广告回调（若已接入）、暂停/恢复正常。
4. 连续 10 局以上：无明显内存增长、时间倍率残留或攻击池泄漏。
5. 广告拒绝、加载失败、网络断开：不会卡住游戏，奖励不会误发。
6. 主题未解锁、试玩、解锁后重启游戏：状态符合设计。

任何一项没有完成，应写为“未验证”，不要仅因脚本生成或编辑器未报错而称为游戏可用。
