# DSH 移动端 UI

一个浏览器端小插件，让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的
Web UI 在手机上真正可用。为安装到主屏幕的 iOS PWA 而做，适用于任何窄屏，桌面布局保持不变。

| 侧边抽屉 | 设置 | 文件与代码面板 |
| --- | --- | --- |
| ![抽屉](docs/drawer.png) | ![设置](docs/settings.png) | ![文件](docs/right-panel.png) |

DSH 0.2.x 是桌面优先的：三栏网格、188px 的设置导航、手机上宽度为 0 的右侧面板，以及会触发
iOS 自动缩放的 14px 输入框。在 390px 宽的手机上，聊天只剩一条窄缝，设置对话框也读不清。
本插件从外部修补客户端 bundle：Host 端为空，不复制也不修改任何核心文件。

## 修复内容

1. **不再触发 iOS 自动缩放。** 当聚焦的输入框小于 16px 时 Safari 会缩放页面。在触屏设备上，
   所有 `input` / `textarea` / `contenteditable` 都变成 16px；判断依据是*设备*
   （`html.dsh-mf-touch`），而不是视口宽度，所以手机显示宽屏桌面布局（投屏并拉宽的 Mac
   屏幕）时同样有效。`touch-action: manipulation` 避免双击把下一次点击带偏。
2. **聊天占满宽度。** 侧边栏始终是 56px 的窄轨，打开的面板变成带暗色遮罩和模糊的固定抽屉。
3. **选完会话、点击面板外或点关闭按钮时抽屉自动收起**，并考虑底部安全区。
4. **会话行第一次点击就打开。** iOS 会把只带 React 处理器的
   `<div role="treeitem">` 视为「不可点击」，把它的 `click` 推迟到双击窗口之后（约 300ms）。
   之前抽屉先关闭并卸载了该行，于是点击只关掉了菜单。现在行的 `click` 在 `pointerup`
   里同步派发，随后才收起抽屉，同一次点击迟到的原生 `click` 会被吞掉。
5. **边缘滑动。** 从屏幕左缘向右滑打开，向左滑关闭；垂直拖动留给滚动
   （阈值 36px，垂直偏移最多 34px，左缘 24px）。
6. **设置适配手机。** 桌面对话框保留 188px 导航列，在 390px 屏幕上内容只剩约 150px。
   窄屏上分区列表变成内容上方的横向可滚动条。
7. **右侧面板可用。** 手机上它的网格轨道宽度为 0，Files、终端和文件/代码预览等于打开到空气里。
   面板打开时（`data-sidebar-right-open`）会变成全屏面板。
8. **代码和表格不会撑宽消息**，在块内自行滚动；文件查看器里的代码从 11px 提到 12px。
9. **iOS 键盘附件栏不再残留。** 在独立 PWA 里，键盘收起后 iOS 可能把「上一项/下一项/完成」
   栏固定在屏幕底部；插件在键盘关闭时移除输入框焦点，该栏随之消失。

## 安装

```sh
git clone https://github.com/zven73/dsh-mobile-ui.git ~/.dsh/local-plugins/dsh-mobile-ui
dsh plugin --profile web add ~/.dsh/local-plugins/dsh-mobile-ui
```

`dsh plugin` 需要 `PATH` 中有 `pnpm`。重启 `dsh web`（或让 profile 重新合成），然后在手机上
刷新页面。客户端 bundle 从磁盘按内容版本提供，之后的更新只需刷新页面。

> 包 id 仍是 `dsh-mobile-fix`（仓库已改名）；在 `~/.dsh/profiles/web/package.json` 里看到
> 这个名字不必奇怪。

## 卸载

```sh
dsh plugin --profile web remove dsh-mobile-fix
```

## 调试

如果设置面板没有出现（或跑到了屏幕外），执行

```js
localStorage.setItem('dsh-mobile-fix-debug', '1')
```

并刷新页面：红色提示条会说明发生了什么，跑到屏幕外的面板会被滚动回可见区域。
没有这个标记时插件保持静默。

## 兼容性

- DSH `0.2.x`（在 `0.2.1-rc.5` 上验证），仅限 `web` profile。
- 手机布局在 1023px 以下生效；16px 输入框规则适用于任何触屏设备。桌面布局不变。
- 已在 WebKit 的 iPhone 14 视口（390×844，触屏）和真实 iPhone PWA 上检查。

## 限制

- 选择器依赖 CSS Module 类名的稳定部分（`sidebarCol`、`centerCol`、`rightbarCol`、
  `sessionRow`、`_root`、`_collapsed`、`toggle`）以及公开的 `data-slot`。大幅改版布局时需要更新。
- 手机上的右侧面板是全屏面板，不支持拖拽调整大小。
- 没有 service worker，也没有 Host 代码：它只是一个客户端模块。

## 更新记录

- `0.6.2` — 键盘关闭时移除输入框焦点（iOS 附件栏残留）。
- `0.6.1` — 16px 规则跟随触屏设备而不是视口宽度；加入 `touch-action: manipulation`。
- `0.6.0` — 点击目标修复；诊断信息放到开关后面。
- `0.5.x` — 设置面板、全屏右侧面板、代码查看器 12px。
- `0.4.x` — 边缘滑动（打开/关闭），更早触发（36px）。
- `0.3.5` — iOS 上会话行第一次点击即打开。
- `0.3.0`–`0.3.4` — 抽屉关闭规则：外部点击、会话行点击、受保护的处理器。
- `0.1.0`–`0.2.0` — 16px 输入框、侧边抽屉、自动关闭。

## 许可证

MIT — 见 [LICENSE](LICENSE)。

---

[English](README.md) · [Русский](README.ru.md)
