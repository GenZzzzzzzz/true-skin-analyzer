# 报告页人脸 · 伪 3D 立体感增强

保留现在的 `face-mesh.png` 底图和 SVG 色块系统（位置/精度完全不动），通过 CSS 3D + 鼠标视差 + 多层光影，把那个区域做出"真有体积"的观感。零额外依赖、零 bundle 成本，色块定位精度与现状一致。

## 改动范围

仅 `src/routes/report.tsx` 中"面部分区示意"那一块（约 413–530 行的容器），其余报告内容、数据流、分析逻辑全部不动。

## 具体做法

**1. 容器加 3D 透视舞台**
- 外层包一层 `perspective: 1200px` 的容器
- 内层 `transform-style: preserve-3d`，跟随鼠标 X/Y 做轻微 `rotateX` / `rotateY`（最大 ±6°），加 `transition` 让回弹自然
- 移动端无 hover：改为缓慢自动呼吸式倾斜（CSS keyframe，幅度更小）

**2. 多层分层（制造景深）**
从后到前 4 层，每层用不同 `translateZ`：
- 背景径向渐变层（保持现在的暗色光晕）—— `translateZ(0)`
- 人脸 PNG 主体 —— `translateZ(20px)`
- SVG 色块层 —— `translateZ(35px)`（贴合脸部、漂浮感）
- 标签层 —— `translateZ(60px)`（最靠近相机）

**3. 光影增强（让 PNG 看起来不是贴纸）**
- 在 PNG 顶部叠一层 radial-gradient 高光（左上柔光）
- 底部叠一层暗角 vignette
- 整个容器加 `box-shadow` 双层：内嵌高光描边 + 外发光大柔影
- 鼠标移动时，高光位置跟随光标移动（CSS custom property `--mx` / `--my`）

**4. 色块层贴合优化**
- 色块 SVG 加极轻 `drop-shadow(0 1px 2px rgba(0,0,0,0.4))`，让它"压"在脸上而不是浮空
- 当前 `mix-blend-multiply` 保留

**5. 性能与无障碍**
- 鼠标事件用 `requestAnimationFrame` 节流
- 监听 `prefers-reduced-motion`：开启则关闭视差与呼吸动画，仅保留静态光影

## 技术细节

```tsx
// 伪代码示意
const ref = useRef<HTMLDivElement>(null);
const onMove = (e) => {
  const r = ref.current!.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  ref.current!.style.setProperty('--rx', `${-y * 6}deg`);
  ref.current!.style.setProperty('--ry', `${x * 6}deg`);
  ref.current!.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
  ref.current!.style.setProperty('--my', `${(y + 0.5) * 100}%`);
};
```

样式（Tailwind + 内联 style）：
- `style={{ perspective: '1200px' }}` 外层
- `style={{ transform: 'rotateX(var(--rx,0)) rotateY(var(--ry,0))', transformStyle: 'preserve-3d', transition: 'transform 0.2s ease-out' }}` 内层
- 高光覆盖层：`background: radial-gradient(circle at var(--mx,50%) var(--my,30%), rgba(255,255,255,0.12), transparent 50%)`

## 不会改动

- `FACE_ZONES` 数据、color/强度逻辑、SVG path、clipPath 全部保持原样 → 色块定位精度与现状完全一致
- 报告其他模块（环形分数、风险卡、雷达图等）不动
- `face-mesh.png` 资产不替换

## 验收

- 鼠标在人脸区域移动 → 整块轻微 3D 倾斜，高光跟随
- 移动端 → 缓慢呼吸式倾斜（无 hover）
- 系统开启 reduce-motion → 完全静态，仅保留增强后的光影
- 色块位置与现在完全一致，不发生偏移
