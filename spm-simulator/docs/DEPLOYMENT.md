# SPM Simulator 部署指南

**项目**: 热轧平整机组排程沙盘模拟系统
**版本**: v1.0
**更新日期**: 2026-02-16

---

## 📋 目录

- [1. 环境准备](#1-环境准备)
- [2. 开发环境部署](#2-开发环境部署)
- [3. 生产环境构建](#3-生产环境构建)
- [4. 平台特定部署](#4-平台特定部署)
- [5. 数据库管理](#5-数据库管理)
- [6. 运维指南](#6-运维指南)
- [7. 故障排查](#7-故障排查)
- [8. 常见问题](#8-常见问题)

---

## 1. 环境准备

### 1.1 系统要求

**最低配置**:
- CPU: 双核 2.0 GHz
- 内存: 4 GB RAM
- 硬盘: 500 MB 可用空间
- 操作系统: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)

**推荐配置**:
- CPU: 四核 2.5 GHz 或更高
- 内存: 8 GB RAM 或更高
- 硬盘: 1 GB 可用空间
- 操作系统: Windows 11, macOS 12+, Linux (Ubuntu 22.04+)

### 1.2 开发工具安装

#### 1.2.1 Node.js 安装

**Windows / macOS**:
1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 LTS 版本（推荐 18.x 或更高）
3. 运行安装程序，按提示完成安装

**Linux (Ubuntu/Debian)**:
```bash
# 使用 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version  # 应显示 v18.x.x
npm --version   # 应显示 9.x.x 或更高
```

#### 1.2.2 Rust 安装

**所有平台**:
```bash
# 安装 Rust 工具链
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 选择默认安装选项 (1)
# 安装完成后，重启终端或运行：
source $HOME/.cargo/env

# 验证安装
rustc --version  # 应显示 rustc 1.77.2 或更高
cargo --version  # 应显示 cargo 1.77.0 或更高
```

**Windows 额外要求**:
- 安装 [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- 或安装 Visual Studio 2019/2022（包含 C++ 工作负载）

#### 1.2.3 Tauri 依赖安装

**Windows**:
- 已通过 Rust 安装自动配置

**macOS**:
```bash
# 安装 Xcode Command Line Tools
xcode-select --install
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

**Linux (Fedora)**:
```bash
sudo dnf install \
    webkit2gtk4.1-devel \
    openssl-devel \
    curl \
    wget \
    file \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

### 1.3 验证环境

运行以下命令验证所有工具已正确安装：

```bash
# 检查 Node.js
node --version

# 检查 npm
npm --version

# 检查 Rust
rustc --version
cargo --version

# 检查 Tauri CLI（安装项目依赖后）
npm run tauri --version
```

---

## 2. 开发环境部署

### 2.1 克隆项目

```bash
# 克隆仓库
git clone <repository-url>
cd spm-simulator

# 或者从压缩包解压
unzip spm-simulator.zip
cd spm-simulator
```

### 2.2 安装依赖

```bash
# 安装前端依赖
npm install

# 这会自动安装：
# - React 及相关库
# - Ant Design UI 组件
# - Tauri CLI 工具
# - 开发和测试工具
```

**注意**: 首次安装可能需要 5-10 分钟，取决于网络速度。

### 2.3 启动开发服务器

```bash
# 启动 Tauri 开发模式
npm run tauri dev

# 或分别启动前端和后端
# 终端 1: 启动前端开发服务器
npm run dev

# 终端 2: 启动 Tauri 应用
npm run tauri dev
```

**首次启动**:
- Rust 后端会进行编译，可能需要 5-15 分钟
- 后续启动会快很多（增量编译）
- 应用窗口会自动打开

**开发模式特性**:
- 前端热重载（HMR）
- 后端自动重新编译
- 开发者工具可用
- 详细的错误信息

### 2.4 运行测���

```bash
# 运行前端单元测试
npm run test:unit

# 运行前端单元测试（带覆盖率）
npm run test:unit:coverage

# 运行 E2E 测试
npm run test:e2e

# 运行后端测试
npm run test:backend

# 运行完整质量检查
npm run check:quality
```

---

## 3. 生产环境构建

### 3.1 构建前准备

1. **更新版本号**:
   ```bash
   # 编辑 package.json
   "version": "1.0.0"

   # 编辑 src-tauri/tauri.conf.json
   "version": "1.0.0"

   # 编辑 src-tauri/Cargo.toml
   version = "1.0.0"
   ```

2. **运行质量检查**:
   ```bash
   npm run check:quality
   ```

3. **清理构建缓存**:
   ```bash
   # 清理前端构建
   rm -rf dist

   # 清理 Rust 构建
   cd src-tauri
   cargo clean
   cd ..
   ```

### 3.2 构建应用

```bash
# 构建生产版本
npm run tauri build

# 构建过程：
# 1. 编译 TypeScript
# 2. 构建前端（Vite）
# 3. 编译 Rust 后端（Release 模式）
# 4. 打包应用程序
# 5. 生成安装包
```

**构建时间**:
- 首次构建: 10-20 分钟
- 增量构建: 2-5 分钟

**构建输出**:
```
src-tauri/target/release/
├── spm-simulator           # 可执行文件 (Linux/macOS)
├── spm-simulator.exe       # 可执行文件 (Windows)
└── bundle/                 # 安装包目录
    ├── dmg/                # macOS 安装包
    │   └── SPM Simulator_1.0.0_x64.dmg
    ├── msi/                # Windows 安装包
    │   └── SPM Simulator_1.0.0_x64_en-US.msi
    ├── deb/                # Debian/Ubuntu 安装包
    │   └── spm-simulator_1.0.0_amd64.deb
    └── appimage/           # Linux AppImage
        └── spm-simulator_1.0.0_amd64.AppImage
```

### 3.3 构建选项

**仅构建特定平台**:
```bash
# 仅构建当前平台
npm run tauri build

# 构建调试版本（更快，但体积更大）
npm run tauri build -- --debug

# 构建时跳过前端构建（前端已构建）
npm run tauri build -- --no-bundle
```

**自定义构建配置**:

编辑 `src-tauri/tauri.conf.json`:
```json
{
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],  // 仅构建 Windows 安装包
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    }
  }
}
```

---

## 4. 平台特定部署

### 4.1 Windows 部署

#### 4.1.1 安装包类型

1. **MSI 安装包** (推荐)
   - 位置: `src-tauri/target/release/bundle/msi/`
   - 特点: 标准 Windows 安装程序
   - 支持: 静默安装、卸载、升级

2. **NSIS 安装包**
   - 位置: `src-tauri/target/release/bundle/nsis/`
   - 特点: 更灵活的安装选项
   - 支持: 自定义安装界面

#### 4.1.2 安装步骤

**用户安装**:
1. 双击 `.msi` 或 `.exe` 安装包
2. 按照安装向导提示操作
3. 选择安装位置（默认: `C:\Program Files\SPM Simulator`）
4. 完成安装

**静默安装**:
```cmd
# MSI 静默安装
msiexec /i "SPM Simulator_1.0.0_x64_en-US.msi" /quiet /qn

# NSIS 静默安装
"SPM Simulator_1.0.0_x64-setup.exe" /S
```

#### 4.1.3 数据位置

- **应用数据**: `%APPDATA%\com.tauri.dev\`
- **数据库**: `%APPDATA%\com.tauri.dev\spm-simulator.db`
- **日志**: `%APPDATA%\com.tauri.dev\logs\`

### 4.2 macOS 部署

#### 4.2.1 安装包类型

1. **DMG 镜像** (推荐)
   - 位置: `src-tauri/target/release/bundle/dmg/`
   - 特点: 标准 macOS 安装方式
   - 使用: 拖拽到 Applications 文件夹

2. **App Bundle**
   - 位置: `src-tauri/target/release/bundle/macos/`
   - 特点: 独立应用包
   - 使用: 直接运行或复制到 Applications

#### 4.2.2 安装步骤

**用户安装**:
1. 打开 `.dmg` 文件
2. 将 `SPM Simulator.app` 拖拽到 `Applications` 文件夹
3. 从 Launchpad 或 Applications 文件夹启动应用

**首次运行**:
- macOS 可能提示"无法验证开发者"
- 解决方法: 右键点击应用 → 选择"打开" → 确认打开

**代码签名** (可选):
```bash
# 需要 Apple Developer 账号
codesign --force --deep --sign "Developer ID Application: Your Name" \
  "src-tauri/target/release/bundle/macos/SPM Simulator.app"
```

#### 4.2.3 数据位置

- **应用数据**: `~/Library/Application Support/com.tauri.dev/`
- **数据库**: `~/Library/Application Support/com.tauri.dev/spm-simulator.db`
- **日志**: `~/Library/Logs/com.tauri.dev/`

### 4.3 Linux 部署

#### 4.3.1 安装包类型

1. **DEB 包** (Debian/Ubuntu)
   - 位置: `src-tauri/target/release/bundle/deb/`
   - 适用: Debian, Ubuntu, Linux Mint

2. **AppImage** (通用)
   - 位置: `src-tauri/target/release/bundle/appimage/`
   - 适用: 所有 Linux 发行版
   - 特点: 无需安装，直接运行

3. **RPM 包** (Red Hat/Fedora)
   - 需要额外配置构建

#### 4.3.2 安装步骤

**DEB 包安装**:
```bash
# 使用 dpkg
sudo dpkg -i spm-simulator_1.0.0_amd64.deb

# 安装依赖（如果有缺失）
sudo apt-get install -f

# 或使用 apt
sudo apt install ./spm-simulator_1.0.0_amd64.deb
```

**AppImage 使用**:
```bash
# 添加执行权限
chmod +x spm-simulator_1.0.0_amd64.AppImage

# 直接运行
./spm-simulator_1.0.0_amd64.AppImage

# 或集成到系统
./spm-simulator_1.0.0_amd64.AppImage --appimage-extract
sudo mv squashfs-root /opt/spm-simulator
sudo ln -s /opt/spm-simulator/AppRun /usr/local/bin/spm-simulator
```

#### 4.3.3 数据位置

- **应用数据**: `~/.local/share/com.tauri.dev/`
- **数据库**: `~/.local/share/com.tauri.dev/spm-simulator.db`
- **日志**: `~/.local/share/com.tauri.dev/logs/`

---

## 5. 数据库管理

### 5.1 数据库初始化

应用首次启动时会自动：
1. 创建 SQLite 数据库文件
2. 运行所有数据库迁移
3. 初始化默认���置

**手动初始化** (开发环境):
```bash
cd src-tauri
cargo run --bin migration
```

### 5.2 数据库迁移

**查看迁移状态**:
```bash
cd src-tauri
cargo run --bin migration status
```

**运行迁移**:
```bash
# 升级到最新版本
cargo run --bin migration up

# 回滚一个版本
cargo run --bin migration down

# 重置数据库（危险操作！）
cargo run --bin migration fresh
```

### 5.3 数据备份

**应用内备份**:
1. 打开应用
2. 进入"数据管理"页面
3. 点击"备份数据库"
4. 选择保存位置

**手动备份**:
```bash
# Windows
copy "%APPDATA%\com.tauri.dev\spm-simulator.db" backup.db

# macOS/Linux
cp ~/Library/Application\ Support/com.tauri.dev/spm-simulator.db backup.db
```

### 5.4 数据恢复

**应用内恢复**:
1. 打开应用
2. 进入"数据管理"页面
3. 点击"恢复数据库"
4. 选择备份文件

**手动恢复**:
```bash
# 1. 关闭应用
# 2. 替换数据库文件

# Windows
copy backup.db "%APPDATA%\com.tauri.dev\spm-simulator.db"

# macOS/Linux
cp backup.db ~/Library/Application\ Support/com.tauri.dev/spm-simulator.db

# 3. 重新启动应用
```

---

## 6. 运维指南

### 6.1 日志管理

#### 6.1.1 日志位置

**Windows**:
- 应用日志: `%APPDATA%\com.tauri.dev\logs\app.log`
- 错误日志: `%APPDATA%\com.tauri.dev\logs\error.log`

**macOS**:
- 应用日志: `~/Library/Logs/com.tauri.dev/app.log`
- 错误日志: `~/Library/Logs/com.tauri.dev/error.log`

**Linux**:
- 应用日志: `~/.local/share/com.tauri.dev/logs/app.log`
- 错误日志: `~/.local/share/com.tauri.dev/logs/error.log`

#### 6.1.2 查看日志

**应用内查看**:
1. 打开应用
2. 进入"日志查看"页面
3. 选择日志类型和时间范围

**命令行查看**:
```bash
# Windows (PowerShell)
Get-Content "$env:APPDATA\com.tauri.dev\logs\app.log" -Tail 100

# macOS/Linux
tail -f ~/Library/Logs/com.tauri.dev/app.log
```

#### 6.1.3 日志清理

**应用内清理**:
1. 进入"数据管理"页面
2. 点击"清理日志"
3. 选择清理策略（保留最近 N 天）

**手动清理**:
```bash
# 删除 30 天前的日志
find ~/Library/Logs/com.tauri.dev/ -name "*.log" -mtime +30 -delete
```

### 6.2 性能监控

#### 6.2.1 系统资源

**查看资源占用**:
- Windows: 任务管理器
- macOS: 活动监视器
- Linux: `top` 或 `htop`

**正常资源占用**:
- CPU: 空闲时 < 5%, 排程时 < 50%
- 内存: 100-300 MB
- 磁盘: 读写峰值 < 10 MB/s

#### 6.2.2 性能优化

**数据库优化**:
```sql
-- 定期执行 VACUUM 优化数据库
VACUUM;

-- 重建索引
REINDEX;

-- 分析表统计信息
ANALYZE;
```

**应用优化**:
- 定期清理历史数据
- 限制单次排程材料数量 (< 1000)
- 关闭不必要的后台任务

### 6.3 更新升级

#### 6.3.1 检查更新

应用会自动检查更新（如果配置了更新服务器）。

**手动检查**:
1. 打开应用
2. 进入"设置中心"
3. 点击"检查更新"

#### 6.3.2 升级步骤

**Windows**:
1. 下载新版本安装包
2. 运行安装包（会自动卸载旧版本）
3. 数据会自动保留

**macOS**:
1. 下载新版本 DMG
2. 替换 Applications 文件夹中的应用
3. 数据会自动保留

**Linux**:
```bash
# DEB 包升级
sudo apt install ./spm-simulator_2.0.0_amd64.deb

# AppImage 升级
# 直接替换旧的 AppImage 文件
```

#### 6.3.3 回滚版本

如果新版本有问题，可以回滚到旧版本：

1. 卸载新版本
2. 安装旧版本
3. 如果数据库结构有变化，需要恢复备份

---

## 7. 故障排查

### 7.1 应用无法启动

**症状**: 双击应用无反应或闪退

**排查步骤**:

1. **检查系统要求**:
   ```bash
   # 检查操作系统版本
   # Windows: winver
   # macOS: sw_vers
   # Linux: lsb_release -a
   ```

2. **检查依赖库**:
   ```bash
   # Linux: 检查 WebKit2GTK
   dpkg -l | grep webkit2gtk

   # 如果缺失，安装：
   sudo apt install libwebkit2gtk-4.1-0
   ```

3. **查看错误日志**:
   - 检查日志文件中的错误信息
   - 查找 "FATAL" 或 "ERROR" 关键字

4. **重置配置**:
   ```bash
   # 备份后删除配置文件
   # Windows
   del "%APPDATA%\com.tauri.dev\config.json"

   # macOS/Linux
   rm ~/Library/Application\ Support/com.tauri.dev/config.json
   ```

### 7.2 数据库错误

**症状**: 提示"数据库损坏"或"无法打开数据库"

**解决方法**:

1. **检查数据库文件**:
   ```bash
   # 使用 SQLite 命令行工具
   sqlite3 spm-simulator.db "PRAGMA integrity_check;"
   ```

2. **修复数据库**:
   ```bash
   # 导出数据
   sqlite3 spm-simulator.db ".dump" > backup.sql

   # 重建数据库
   rm spm-simulator.db
   sqlite3 spm-simulator.db < backup.sql
   ```

3. **恢复备份**:
   - 使用应用内的"恢复数据库"功能
   - 或手动替换数据库文件

### 7.3 性能问题

**症状**: 应用响应慢、卡顿

**排查步骤**:

1. **检查数据量**:
   - 材料数量 > 10000 可能导致性能下降
   - 历史方案数量 > 100 可能影响加载速度

2. **优化数据库**:
   ```sql
   -- 清理过期数据
   DELETE FROM operation_logs WHERE created_at < date('now', '-90 days');

   -- 优化数据库
   VACUUM;
   ```

3. **检查系统资源**:
   - CPU 使用率是否过高
   - 内存是否不足
   - 磁盘空间是否充足

4. **重启应用**:
   - 完全退出应用
   - 清理临时文件
   - 重新启动

### 7.4 导入导出问题

**症状**: 无法导入 Excel/CSV 文件

**解决方法**:

1. **检查文件格式**:
   - 确保文件是 `.xlsx` 或 `.csv` 格式
   - 文件大小 < 50 MB
   - 文件未被其他程序占用

2. **检查文件内容**:
   - 第一行必须是列标题
   - 必填字段不能为空
   - 日期格式正确 (YYYY-MM-DD)

3. **使用字段映射**:
   - 如果列名不匹配，使用"字段映射"功能
   - 保存映射模板以便重复使用

---

## 8. 常见问题

### 8.1 安装相关

**Q: Windows 提示"无法验证发布者"**

A: 这是因为应用未进行代码签名。解决方法：
- 右键点击安装包 → 属性 → 解除锁定
- 或在 Windows Defender 中添加信任

**Q: macOS 提示"应用已损坏"**

A: 这是 Gatekeeper 安全机制。解决方法：
```bash
# 移除隔离属性
xattr -cr "/Applications/SPM Simulator.app"

# 或在系统偏好设置中允许
# 系统偏好设置 → 安全性与隐私 → 通用 → 仍要打开
```

**Q: Linux 缺少依赖库**

A: 安装所需依赖：
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0

# Fedora
sudo dnf install webkit2gtk4.1 gtk3
```

### 8.2 使用相关

**Q: 如何导入大量材料数据？**

A:
- 使用 CSV 格式（比 Excel 更快）
- 分批导入（每批 < 5000 条）
- 在非高峰时段导入

**Q: 排程速度慢怎么办？**

A:
- 减少材料数量（< 1000 条）
- 简化约束条件
- 使用更快的策略模板

**Q: 如何备份数据？**

A:
- 应用内备份: 数据管理 → 备份数据库
- 手动备份: 复制数据库文件
- 建议每周备份一次

### 8.3 开发相关

**Q: 如何调试应用？**

A:
```bash
# 开发模式启动（带调试信息）
npm run tauri dev

# 查看 Rust 日志
RUST_LOG=debug npm run tauri dev

# 打开浏览器开发者工具
# 在应用窗口中按 F12
```

**Q: 如何添加新功能？**

A:
1. 阅读 `docs/ARCHITECTURE.md` 了解架构
2. 在 `src/pages/` 添加新页面
3. 在 `src-tauri/src/commands/` 添加新命令
4. 编写测试用例
5. 提交 Pull Request

**Q: 如何贡献代码？**

A:
1. Fork 项目
2. 创建功能分支
3. 遵循代码规范
4. 运行 `npm run check:quality`
5. 提交 Pull Request

---

## 附录

### A. 构建脚本

**自动化构建脚本** (`scripts/build.sh`):

```bash
#!/bin/bash
set -e

echo "开始构建 SPM Simulator..."

# 清理旧构建
echo "清理旧构建..."
rm -rf dist
cd src-tauri && cargo clean && cd ..

# 运行测试
echo "运行测试..."
npm run test:unit
npm run test:backend

# 构建应用
echo "构建应用..."
npm run tauri build

echo "构建完成！"
echo "安装包位置: src-tauri/target/release/bundle/"
```

### B. 部署检查清单

**发布前检查**:
- [ ] 更新版本号（package.json, tauri.conf.json, Cargo.toml）
- [ ] 运行完整测试套件 (`npm run check:quality`)
- [ ] 更新 CHANGELOG.md
- [ ] 构建所有平台安装包
- [ ] 在干净环境测试安装
- [ ] 验证数据库迁移
- [ ] 测试升级流程
- [ ] 准备发布说明

**发布后检查**:
- [ ] 上传安装包到发布平台
- [ ] 更新下载链接
- [ ] 发布更新公告
- [ ] 监控错误报告
- [ ] 收集用户反馈

### C. 参考资料

- [Tauri 构建指南](https://tauri.app/v1/guides/building/)
- [Tauri 分发指南](https://tauri.app/v1/guides/distribution/)
- [SQLite 文档](https://www.sqlite.org/docs.html)
- [Rust 发布指南](https://doc.rust-lang.org/cargo/reference/publishing.html)

---

**文档维护**: 开发团队
**最后更新**: 2026-02-16
**版本**: v1.0
