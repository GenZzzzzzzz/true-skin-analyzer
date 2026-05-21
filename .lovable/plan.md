# 报告页人脸 · 质量大幅提升（重画底图 + 多层光影）

在不引入 Three.js 的前提下，把那块"立体人脸"做到肉眼可感的明显升级。两条并行升级：**A）premium 重画一张影室级写实底图**；**B）在现有 Stereo3DFace 容器里加多层光影与发光优化**。色块定位精度保持不变。

## 一、底图升级（premium 重画）

用 `imagegen` premium 生成一张新的中性写实人脸：
- 正面、闭眼/平视、无表情、无配饰
- 影室级三点布光（主光左上 45°、补光右侧、轮廓光）
- 皮肤有真实毛孔与微高光，但磨皮干净统一
- 中性偏冷的深色背景（与现在径向渐变融合）
- 头部居中，发际线 ≈ y8%、下巴 ≈ y92%，与现有 `FACE_ZONES` 坐标系完全对齐
- 出图 2x 分辨率（约 1024×1280），保留细节

保存为 `src/assets/face-mesh-v2.png`，替换 `report.tsx` 里的 `faceMeshImg` 引用。**保留旧文件**作为回退。

如果出图与原图轮廓位置有偏移，会用 `imagegen edit` 在原图基础上重渲质感而不改构图，保证色块仍然落在对应皮肤区。

## 二、Stereo3DFace 光影升级

修改 `src/components/Stereo3DFace.tsx`，在保留视差的基础上新增：

1. **点光源高光（皮肤次表面散射感）**
   - 当前的 `radial-gradient` 高光升级为两层：
     - 内层：小而亮的 specular 高光（白色，半径 15%）
     - 外层：宽柔的次表面散射（暖肉色 `oklch(0.85 0.08 30)`，半径 60%，blur）
   - 都跟随 `--mx/--my` 移动

2. **环境光遮蔽 (AO) 暗角**
   - 容器四角加柔和暗角，让脸"陷进"舞台而不是浮在表面
   - 用 `radial-gradient(120% 90% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)` 替换现有 vignette

3. **底部接触阴影**
   - 在内层底部加一道贴地的椭圆暗影 `box-shadow` 模拟脸下方阴影

4. **倾斜时的光照偏移**
   - 鼠标在右侧时，整体亮度向左衰减 1-2%；模拟"侧光"
   - 用一层 `linear-gradient` 跟随 `--ry` 移动

5. **景深焦外**
   - 边缘 5% 区域加轻微 blur(0.5px)，模拟相机浅景深

## 三、色块层（让发光更"皮下透出来"）

在 `report.tsx` 的 SVG 色块层增强：
- 给每个填充 path 加 SVG `<filter>` 实现 **inner glow**：
  - `feGaussianBlur` + `feComposite in="SourceGraphic" operator="in"` → 边缘内发光
- 整个色块组改用 `mix-blend-mode: soft-light`（替代 `multiply`），让红/黄看起来像皮下渗出而不是贴上去
- "重灾区"色块的脉冲呼吸加大幅度（透明度 0.4 → 0.7），更醒目

## 四、文件改动一览

新建：
- `src/assets/face-mesh-v2.png`（premium 重画）

改写：
- `src/components/Stereo3DFace.tsx`（多层光影 + 接触阴影 + 景深）
- `src/routes/report.tsx`：
  - 替换 `faceMeshImg` import 指向 v2
  - 给色块 SVG 加 inner-glow filter，调 blend-mode

不动：
- `FACE_ZONES` 数据与坐标
- 报告其他模块
- 视差交互逻辑（已通过用户验收）

## 验收

- 新底图：影室级布光，皮肤质感清晰，构图与旧图等价（色块不偏）
- 鼠标移动：高光跟随，且呈现"亮点 + 大柔光"两层，像真实皮肤反光
- 容器：四周自然暗下去，脸看起来"嵌"在玻璃舞台里
- 色块：从图层里"渗出"，而非贴在表面
- 移动端 / reduce-motion：仍可正常显示静态精修效果
