# VS Code Project Manager for Raycast

A Raycast extension to quickly manage and open your Visual Studio Code projects with **Windows support**.

## Features

- 📁 List all recently opened VS Code projects
- 🚀 Quick open projects with keyboard shortcuts
- 🔍 Search and filter projects
- 🪟 Open in new window
- 📂 Open in File Explorer
- 📋 Copy project path to clipboard
- ✅ **Full Windows support** (also works on macOS and Linux)

## Usage

1. Open Raycast (default: `Alt + Space` on Windows)
2. Type "Open Project" or search for the extension
3. Select a project from the list
4. Press Enter to open, or use shortcuts:
   - `Enter` - Open project in current window
   - `Cmd + N` - Open in new window
   - `Cmd + O` - Open in File Explorer
   - `Cmd + C` - Copy project path

## Installation

### Development Mode

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development mode:
   ```bash
   npm run dev
   ```

### Build and Install

```bash
npm run build
```

## Requirements

- Visual Studio Code installed
- Raycast (with Windows support)
- Node.js >= 18

## How It Works

The extension reads VS Code's storage file to get recently opened projects:
- **Windows**: `%APPDATA%\Code\User\globalStorage\storage.json`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/storage.json`
- **Linux**: `~/.config/Code/User/globalStorage/storage.json`

## Troubleshooting

### No projects showing up?
- Make sure you have opened some projects in VS Code recently
- Check if VS Code is installed at the default location
- Try opening a folder in VS Code and restart the extension

### Can't open projects?
- Verify that the `code` command is in your PATH
- On Windows, check if VS Code is installed at:
  - `%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe`
  - or `%PROGRAMFILES%\Microsoft VS Code\Code.exe`

## License

MIT
