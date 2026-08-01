# MARTOVER - 火星农业科幻叙事交互体验

🚀 **MARTOVER火星农业计划** - 一个结合火星陨石坑探索与土豆培育的沉浸式3D Web科幻叙事应用

## 🌟 项目概述
<img width="2954" height="1772" alt="CleanShot 2026-01-19 at 20 24 16@2x" src="https://github.com/user-attachments/assets/e12364e6-60d0-4825-a548-d4faaec2a449" />

MARTOVER是一个创新的Web科幻叙事交互体验，模拟未来人类在火星上进行农业开发的场景。用户作为"TOVER联盟第101号成员"，将参与火星农业时代核心项目的全流程：

1. **🪐 农业目标地选择** - 在3D火星地球仪上探索并选择合适的陨石坑作为农业基地
2. **🥔 土豆太空育种** - 基于选定的陨石坑环境，培育适合火星环境的土豆品种
3. **🏭 火星本土自动化生产** - 建设自动化生产系统，实现火星本土化农业生产

## ✨ 核心特性

### 沉浸式科幻叙事
- 完整的TOVER联盟世界观设定
- 分步式信封引导系统
- 配乐增强的沉浸体验
- 科幻风格UI设计

### 3D交互体验
- 基于Three.js的3D火星地球仪
- 真实火星陨石坑数据可视化
- 动态云层穿越效果
- 流畅的相机控制和转场动画

### 数据驱动
- 基于真实科学数据的陨石坑信息
- 详细的形态特征可视化
- 智能的农业适宜性评估

## 🛠️ 技术栈

- **前端框架**: React 19 + React Router 7
- **3D渲染**: Three.js + React Three Fiber + @react-three/drei
- **动画**: React Spring + GSAP
- **样式**: TailwindCSS + CSS Modules
- **状态管理**: Context API + Zustand
- **数据处理**: PapaParse
- **构建工具**: Vite

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式运行
```bash
npm run dev
```
应用将在 http://localhost:5173 启动

### 构建生产版本
```bash
npm run build
```

### 运行测试
```bash
npm test          # watch 模式
npx vitest run    # 单次运行
```

游戏逻辑（基因组、模拟、人体、状态机、坑体几何）由 52 个单元测试覆盖。
其中若干测试专门锁定容易被静默改坏的契约：`stableHash` 的哈希值、
种子噪声的分隔符、以及三个种植区必须落在各自地形分带内。

## 📁 项目结构

```
mars-craters/
├── public/                              # 静态资源
│   ├── sounds/                          # 音频文件
│   ├── imgs/                            # 图片资源
│   ├── fonts/                           # 字体文件
│   ├── ply/                             # 3D模型文件
│   ├── test/                            # SVG测试文件
│   ├── figures/                         # 图表资源
│   ├── mars_normal.jpg                  # 火星法线贴图
│   ├── marsmap_normal.jpg               # 火星地图
│   └── MartoverTotalLogo.svg            # Logo
│
├── src/
│   ├── Components/                      # 通用组件库
│   │   ├── common/                      # 基础组件
│   │   │   └── Button/                  # 按钮组件
│   │   ├── CustomCursor/                # 自定义光标
│   │   ├── GaussianViewer/              # 高斯溅射查看器
│   │   ├── LiquidDistortion/            # 液体扭曲效果
│   │   ├── RdOverlay/                   # 射线坑覆盖层
│   │   ├── TypeShuffle/                 # 文字洗牌动画
│   │   ├── VisShape/                    # 陨石坑形状可视化
│   │   ├── CraterRadarChart/            # 陨石坑雷达图
│   │   ├── EnvironmentEffects/          # 环境效果
│   │   ├── PotatoSliceViewer/           # 土豆切片查看器
│   │   ├── ActiveCraterBackground/      # 活动陨石坑背景
│   │   ├── Panel.js                     # 信息面板
│   │   ├── ProgressBar.js               # 进度条
│   │   ├── IntroCard.js                 # 介绍卡片
│   │   ├── LoadingScreen.js             # 加载屏幕
│   │   ├── NavigationButtons.js         # 导航按钮
│   │   ├── OverlayLayers.js             # 覆盖层
│   │   ├── TimestampDisplay.js          # 时间戳显示
│   │   └── Illustrations.js             # 插图组件
│   │
│   ├── Pages/                           # 页面组件
│   │   ├── CloudDownPage/               # 主页面（云层下降）
│   │   │   ├── CloudDownPage.js         # 主页面组件
│   │   │   ├── CloudsComponent.js       # 云层组件
│   │   │   ├── DecorationClouds.js      # 装饰云层
│   │   │   └── styles.module.css        # 样式
│   │   ├── MarsGlobe/                   # 火星地球仪
│   │   │   ├── MarsComponent.js         # 火星组件
│   │   │   ├── MarsGuideTooltips.js     # 火星导览提示
│   │   │   └── TourGuide.js             # 导览指南
│   │   ├── Part3Gallery/                # 第三部分画廊
│   │   │   ├── Part3Gallery.js          # 画廊主组件
│   │   │   ├── ImageDetailModal.js      # 图片详情模态窗
│   │   │   ├── GalleryImages.js         # 画廊图片
│   │   │   ├── HeaderUI.js              # 头部UI
│   │   │   ├── FooterUI.js              # 底部UI
│   │   │   ├── Rock.js                  # 岩石着色器
│   │   │   ├── BackgroundCanvas.js      # 背景画布
│   │   │   ├── PixelEffectCanvas.js     # 像素效果
│   │   │   └── SystemIndicators.js      # 系统指示器
│   │   ├── PotatoPages/                 # 土豆相关页面
│   │   │   ├── PotatoPlanet.js          # 土豆星球
│   │   │   ├── PotatoGrid.js            # 土豆网格
│   │   │   ├── PotatoPerGrid.js         # 单个土豆网格
│   │   │   └── Curve.js                 # 曲线组件
│   │   ├── CraterGrid/                  # 陨石坑网格
│   │   ├── CraterGridPages/             # 陨石坑网格页面
│   │   ├── Home/                        # 首页
│   │   ├── MRIPotatoPage/               # MRI土豆页面
│   │   ├── PotatoGrid/                  # 土豆网格页面
│   │   └── Test/                        # 测试页面
│   │
│   ├── game/                            # 育种游戏核心（纯逻辑 + 3D 场景）
│   │   ├── simulation/                  # 模拟层
│   │   │   ├── genome.js                # 11 维隐藏基因组、跨代漂变、性状冲突
│   │   │   └── breedingSimulation.js    # SOL 推进、干预、收获、绝收判定
│   │   ├── human/                       # 人体反馈
│   │   │   └── humanEngine.js           # 喂食效果、每代衰减、安全边界与病症
│   │   ├── planting/                    # 环境派生
│   │   │   └── plantingEngine.js        # 由真实坑数据派生环境向量
│   │   ├── session/                     # 单局状态机
│   │   │   ├── gameSessionReducer.js    # 全部状态转移与本局结束条件
│   │   │   └── GameSessionContext.js    # Provider（动作与状态分层 memo）
│   │   ├── world/                       # 三维世界
│   │   │   ├── worldCoordinates.js      # 经纬度到球面坐标的唯一投影
│   │   │   ├── craterVisualModel.js     # 尺度、地形分带、种植区几何唯一定义
│   │   │   ├── CraterCultivationScene.js # 程序化坑体、植株、干预反馈
│   │   │   ├── WorldCameraRig.js        # 星球与坑内镜头转场
│   │   │   └── CraterViewEffects.js     # 近景地表锐化后处理
│   │   ├── ui/                          # HUD
│   │   │   ├── GameHUD.js               # 分阶段 HUD
│   │   │   └── HumanFeedbackPanel.js    # 右侧人体反馈面板
│   │   ├── util/                        # 共享工具
│   │   │   └── deterministic.js         # stableHash / clamp / 种子噪声唯一定义
│   │   └── data/                        # 陨石坑目录
│   │
│   ├── features/                        # 功能模块
│   │   ├── clouds/                      # 云层系统
│   │   │   └── CloudsComponent.js
│   │   ├── mars/                        # 火星系统
│   │   │   ├── MarsComponent.js
│   │   │   └── MarsGuideTooltips.js
│   │   └── potato/                      # 土豆系统
│   │       └── PotatoPlanet.js
│   │
│   ├── context/                         # 状态管理
│   │   ├── AppContext.js                # 应用全局状态
│   │   ├── DataContext.js               # 数据状态
│   │   └── ThemeContext.js              # 主题状态
│   │
│   ├── Data/                            # 数据提供者
│   │   ├── CraterDataProvider.js        # 陨石坑数据加载
│   │   └── PotatoDataProvider.js        # 土豆数据加载
│   │
│   ├── hooks/                           # 自定义Hooks
│   │   ├── useDataLoader.js             # 数据加载钩子
│   │   └── useTransition.js             # 转场动画钩子
│   │
│   ├── utils/                           # 工具函数
│   │   ├── breedingLogic.js             # 育种逻辑
│   │   └── craterScoring.js             # 陨石坑评分
│   │
│   ├── LogoPage/                        # Logo页面
│   │   ├── LogoPage.js
│   │   └── LogoPage.css
│   │
│   ├── App.js                           # 主应用组件
│   ├── App.css                          # 应用样式
│   ├── index.js                         # 应用入口
│   ├── index.css                        # 全局样式
│   ├── darkmode.css                     # 暗色模式样式
│   └── store.js                         # Zustand状态存储
│
├── .gitignore                           # Git忽略文件
├── index.html                           # HTML入口
├── package.json                         # 项目配置
├── vite.config.js                       # Vite配置
├── tailwind.config.js                   # Tailwind配置
├── postcss.config.js                    # PostCSS配置
├── README.md                            # 项目说明
├── USER_GUIDE.md                        # 用户指南
└── LICENSE                              # 许可证
```

## 🎮 使用流程

1. **阅读信封** - 了解TOVER联盟背景和您的使命
2. **探索火星** - 在3D火星地球仪上浏览陨石坑
3. **选择基地** - 查看陨石坑详情并选择农业基地
4. **培育土豆** - 进入土豆培育系统
5. **自动化生产** - 建设火星本土生产系统

## 🎵 音频系统

- **universe.mp3** - 背景音乐（点击第一个"下一页"后循环播放）
- **30000targets.mp3** - 信封音乐（点击第二个"下一页"后播放）
- **welcome.mp3** - 降落音乐（点击"已阅"后播放）

## 📖 文档

- [用户指南](USER_GUIDE.md) - 详细的使用说明

## 📄 许可证

本项目采用 GNU General Public License v3.0 许可证 - 查看 [LICENSE](./LICENSE) 文件了解详情

### Human model attribution

“Basic Human Male” by DNC44

https://sketchfab.com/3d-models/basic-human-male-598d1d1866df48f999fabadb017429d1

Licensed under CC-BY-4.0.

## 📬 联系方式

- 📧 邮箱: euan@mail.bnu.edu.cn
- 🔗 GitHub: [https://github.com/EuanTop/martover](https://github.com/EuanTop/martover)

---

*"在赤壤中，改写人类文明的食谱"* - MARTOVER 🟠
