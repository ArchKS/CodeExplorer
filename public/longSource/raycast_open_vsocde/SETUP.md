# 设置说明

## 1. 添加扩展图标

扩展需要一个 512x512 的 PNG 图标。你可以：

1. 下载 VS Code 官方图标：https://code.visualstudio.com/brand
2. 或创建自定义图标
3. 将图标保存为：`assets/extension-icon.png`

如果暂时不添加图标，可以先注释掉 `package.json` 中的 `icon` 字段。

## 2. 安装 Raycast（如果还没安装）

访问 https://www.raycast.com/ 下载并安装 Raycast for Windows

## 3. 开发模式运行

```bash
npm run dev
```

这会启动 Raycast 开发模式，自动加载你的扩展。

## 4. 使用扩展

1. 打开 Raycast（默认快捷键：`Alt + Space`）
2. 输入 "Open Project" 或搜索扩展名称
3. 选择项目并打开

## 5. 调试

如果遇到问题：

### 找不到项目？
检查 VS Code 存储文件位置：
```
%APPDATA%\Code\User\globalStorage\storage.json
```

你可以运行以下命令查看：
```bash
echo %APPDATA%\Code\User\globalStorage\storage.json
```

### 无法打开项目？
确保 VS Code 的 `code` 命令在 PATH 中：
```bash
code --version
```

如果没有，需要在 VS Code 中运行：
`Shell Command: Install 'code' command in PATH`

## 6. 自定义配置

你可以编辑 `src/utils.ts` 来：
- 修改 VS Code 存储路径
- 更改排序逻辑
- 添加过滤规则

## Windows 特定说明

### VS Code 安装位置
扩展会自动检测以下位置：
- `%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe`
- `%PROGRAMFILES%\Microsoft VS Code\Code.exe`
- PATH 中的 `code` 命令

### 路径格式
Windows 路径会自动转换：
- `file:///C:/Users/...` → `C:\Users\...`
- 支持带空格的路径

## 构建和发布

```bash
# 构建扩展
npm run build

# 发布到 Raycast Store（需要先登录）
npm run publish
```

## 故障排除

### Node 版本警告
当前使用 Node.js v18.16.0，建议升级到 v22+ 以获得最佳兼容性：
```bash
# 使用 nvm 升级（如果已安装）
nvm install 22
nvm use 22
```

### 依赖问题
如果遇到依赖问题：
```bash
rm -rf node_modules package-lock.json
npm install
```
