import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface VSCodeProject {
  name: string;
  path: string;
  lastOpened?: Date;
}

/**
 * Get VS Code storage path based on platform
 */
function getVSCodeStoragePath(): string {
  const platform = os.platform();
  const homeDir = os.homedir();

  if (platform === "win32") {
    // Windows: %APPDATA%\Code\User\globalStorage\storage.json
    const appData =
      process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
    return path.join(appData, "Code", "User", "globalStorage", "storage.json");
  } else if (platform === "darwin") {
    // macOS: ~/Library/Application Support/Code/User/globalStorage/storage.json
    return path.join(
      homeDir,
      "Library",
      "Application Support",
      "Code",
      "User",
      "globalStorage",
      "storage.json",
    );
  } else {
    // Linux: ~/.config/Code/User/globalStorage/storage.json
    return path.join(
      homeDir,
      ".config",
      "Code",
      "User",
      "globalStorage",
      "storage.json",
    );
  }
}

/**
 * Parse VS Code file URI to local path
 */
function parseFileUri(uri: string): string {
  // Remove file:/// prefix
  let projectPath = uri.replace(/^file:\/\/\//, "");

  // Decode URI encoding (e.g., %3A -> :)
  projectPath = decodeURIComponent(projectPath);

  // On Windows, convert /c:/path to C:\path
  if (os.platform() === "win32") {
    projectPath = projectPath
      .replace(/^\/([a-zA-Z]:)/, "$1")
      .replace(/\//g, "\\");
  }

  return projectPath;
}

/**
 * Get recently opened projects from VS Code storage
 */
export function getRecentProjects(): VSCodeProject[] {
  try {
    const storagePath = getVSCodeStoragePath();

    if (!fs.existsSync(storagePath)) {
      console.log("VS Code storage not found at:", storagePath);
      return [];
    }

    const storageContent = fs.readFileSync(storagePath, "utf-8");
    const storage = JSON.parse(storageContent);

    const projectMap = new Map<string, VSCodeProject>();

    // Method 1: Get from opened windows (currently open projects)
    if (storage.windowsState?.openedWindows) {
      for (const window of storage.windowsState.openedWindows) {
        if (window.folder) {
          const projectPath = parseFileUri(window.folder);
          if (fs.existsSync(projectPath)) {
            const projectName = path.basename(projectPath);
            projectMap.set(projectPath, {
              name: projectName,
              path: projectPath,
              lastOpened: new Date(), // Currently opened, so most recent
            });
          }
        }
      }
    }

    // Method 2: Get from backup workspaces (recently opened)
    if (storage.backupWorkspaces?.folders) {
      for (const folder of storage.backupWorkspaces.folders) {
        if (folder.folderUri) {
          const projectPath = parseFileUri(folder.folderUri);
          if (fs.existsSync(projectPath) && !projectMap.has(projectPath)) {
            const projectName = path.basename(projectPath);
            projectMap.set(projectPath, {
              name: projectName,
              path: projectPath,
              lastOpened: new Date(),
            });
          }
        }
      }
    }

    // Method 3: Get from profile associations (all historical projects)
    if (storage.profileAssociations?.workspaces) {
      const workspaces = Object.keys(storage.profileAssociations.workspaces);
      for (const uri of workspaces) {
        if (uri.startsWith("file:///")) {
          const projectPath = parseFileUri(uri);
          if (fs.existsSync(projectPath) && !projectMap.has(projectPath)) {
            const projectName = path.basename(projectPath);
            projectMap.set(projectPath, {
              name: projectName,
              path: projectPath,
            });
          }
        }
      }
    }

    // Convert map to array and sort by last opened (opened windows first, then others)
    const projects = Array.from(projectMap.values());
    projects.sort((a, b) => {
      if (a.lastOpened && !b.lastOpened) return -1;
      if (!a.lastOpened && b.lastOpened) return 1;
      if (a.lastOpened && b.lastOpened) {
        return b.lastOpened.getTime() - a.lastOpened.getTime();
      }
      return a.name.localeCompare(b.name);
    });

    return projects;
  } catch (error) {
    console.error("Error reading VS Code projects:", error);
    return [];
  }
}

/**
 * Get VS Code executable path
 */
export function getVSCodeExecutable(): string {
  const platform = os.platform();

  if (platform === "win32") {
    const homeDir = os.homedir();

    // Try common Windows installation paths
    const paths = [
      // User installation (most common)
      path.join(
        homeDir,
        "AppData",
        "Local",
        "Programs",
        "Microsoft VS Code",
        "Code.exe",
      ),
      // System installation
      path.join(
        process.env.PROGRAMFILES || "C:\\Program Files",
        "Microsoft VS Code",
        "Code.exe",
      ),
      path.join(
        process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
        "Microsoft VS Code",
        "Code.exe",
      ),
    ];

    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          console.log("Found VS Code at:", p);
          return p;
        }
      } catch (e) {
        console.log("Error checking path:", p, e);
      }
    }

    // Fallback: try to use 'code' from PATH
    console.log("VS Code.exe not found, falling back to 'code' command");
    return "code";
  } else if (platform === "darwin") {
    return "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code";
  } else {
    return "code";
  }
}
