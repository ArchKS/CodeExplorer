// @ts-nocheck
import {
  ActionPanel,
  Action,
  List,
  Icon,
  showToast,
  Toast,
  open,
} from "@raycast/api";
import React, { useState, useEffect } from "react";
import { spawn } from "child_process";
import { getRecentProjects, getVSCodeExecutable, VSCodeProject } from "./utils";

export default function Command() {
  const [projects, setProjects] = useState<VSCodeProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        let recentProjects = getRecentProjects();
        console.log("=>RC", recentProjects);
        if (recentProjects) {
          recentProjects = recentProjects.filter((v) => {
            return v.name != "src" && v.name.trim();
          });
        }
        setProjects(recentProjects);
      } catch (error) {
        console.error("Failed to load projects:", error);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to load projects",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadProjects();
  }, []);

  async function openProject(projectPath: string) {
    try {
      const vscodeExe = getVSCodeExecutable();

      showToast({
        style: Toast.Style.Animated,
        title: "Opening project...",
      });

      // Use spawn for better handling of paths with spaces
      const child = spawn(vscodeExe, [projectPath], {
        detached: true,
        stdio: "ignore",
      });

      child.unref();

      showToast({
        style: Toast.Style.Success,
        title: "Project opened",
        message: projectPath,
      });
    } catch (error) {
      console.error("Failed to open project:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to open project",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function openInNewWindow(projectPath: string) {
    try {
      const vscodeExe = getVSCodeExecutable();

      showToast({
        style: Toast.Style.Animated,
        title: "Opening in new window...",
      });

      // -n flag opens in a new window
      const child = spawn(vscodeExe, ["-n", projectPath], {
        detached: true,
        stdio: "ignore",
      });

      child.unref();

      showToast({
        style: Toast.Style.Success,
        title: "Project opened in new window",
        message: projectPath,
      });
    } catch (error) {
      console.error("Failed to open project:", error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to open project",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function openInFileExplorer(projectPath: string) {
    try {
      await open(projectPath);
      showToast({
        style: Toast.Style.Success,
        title: "Opened in File Explorer",
      });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to open in File Explorer",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search projects...">
      {projects.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Folder}
          title="No VS Code Projects Found"
          description="Open some projects in VS Code to see them here"
        />
      ) : (
        projects.map((project) => (
          <List.Item
            key={project.path}
            title={project.name}
            subtitle={project.path}
            accessories={[
              {
                text: project.lastOpened
                  ? new Date(project.lastOpened).toLocaleDateString()
                  : "",
                icon: Icon.Clock,
              },
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="Open Project"
                  icon={Icon.Folder}
                  onAction={() => openProject(project.path)}
                />
                <Action
                  title="Open in New Window"
                  icon={Icon.Window}
                  onAction={() => openInNewWindow(project.path)}
                  shortcut={{ modifiers: ["cmd"], key: "n" }}
                />
                <Action
                  title="Open in File Explorer"
                  icon={Icon.Finder}
                  onAction={() => openInFileExplorer(project.path)}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
                <Action.CopyToClipboard
                  title="Copy Path"
                  content={project.path}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
