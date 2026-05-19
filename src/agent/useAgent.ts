import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent, FileNode, SessionState, ConnectionStatus, ToolCallCategory, Turn } from "./types";
import type { FileChange, AgentSummary } from "../data/types";
import { AgentWebSocket } from "./ws";

// ── 工具函数 ─────────────────────────────────

/** 根据工具名称推断调用类别 */
function categorizeToolCall(name: string): ToolCallCategory {
  const lower = name.toLowerCase();
  if (lower.startsWith("mcp") || lower.includes("mcp")) return "mcp";
  if (lower.includes("skill") || lower === "use_skill") return "skill";
  if (lower === "subagent" || lower === "fork" || lower.includes("subagent")) return "subagent";
  if (lower === "read" || lower === "write" || lower === "edit" || lower === "bash" ||
      lower === "web_search" || lower === "web_fetch" || lower === "todo" ||
      lower === "recall" || lower === "grep" || lower === "glob" || lower === "ls") return "tool";
  return "unknown";
}

/** 从 session 的所有 turns 中提取文件变更列表（create / modify / delete） */
export function extractFileChanges(turns: Turn[]): FileChange[] {
  const seen = new Set<string>();
  const changes: FileChange[] = [];

  for (const turn of turns) {
    for (const tc of turn.toolCalls) {
      if (tc.status === "error") continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(tc.input);
      } catch {
        continue;
      }

      if (tc.name === "write" && typeof parsed.path === "string") {
        if (!seen.has(parsed.path)) {
          seen.add(parsed.path);
          changes.push({ path: parsed.path, action: "create" });
        }
      } else if (tc.name === "edit" && typeof parsed.path === "string") {
        if (!seen.has(parsed.path)) {
          seen.add(parsed.path);
          changes.push({ path: parsed.path, action: "modify" });
        }
      } else if (tc.name === "bash") {
        const cmd = typeof parsed.command === "string" ? parsed.command.trim() : "";
        const rmMatch = cmd.match(/(?:^|\s)(?:rm|unlink)\s+(?:-rf?\s+)?(["']?)([^\s"']+)\1/);
        const mvMatch = cmd.match(/(?:^|\s)mv\s+(["']?)([^\s"']+)\1\s+(["']?)([^\s"']+)\3/);
        const mkMatch = cmd.match(/(?:^|\s)mkdir\s+(?:-p\s+)?(["']?)([^\s"']+)\1/);

        if (rmMatch) {
          const p = rmMatch[2];
          if (!seen.has(p)) { seen.add(p); changes.push({ path: p, action: "delete" }); }
        }
        if (mvMatch) {
          const src = mvMatch[2];
          if (!seen.has(src)) { seen.add(src); changes.push({ path: src, action: "delete" }); }
          const dst = mvMatch[4];
          if (!seen.has(dst)) { seen.add(dst); changes.push({ path: dst, action: "create" }); }
        }
        if (mkMatch) {
          const p = mkMatch[2];
          if (!seen.has(p)) { seen.add(p); changes.push({ path: p, action: "create" }); }
        }
      }
    }
  }

  return changes;
}

/** 构造总结 Agent 的 prompt */
function buildSummarizationPrompt(summary: string): string {
  return `你是一个任务总结专家。请严格基于下面的 Agent 工作摘要，生成结构化总结。

要求：
1. 忠于原文，不添加原文中没有的内容，不自由发挥
2. 仅输出 JSON，不要有任何额外说明文字

输出 JSON schema：
{
  "brief": "核心总结，不超过200字",
  "key_points": [
    { "title": "要点概要，不超过50字", "summary": "要点内容，不超过200字" }
  ],
  "todos": [
    {
      "task": "需要用户决策或讨论的问题",
      "type": "choice" | "fill",
      "multiSelect": true/false,
      "choices": [{ "option": "选项名", "description": "选项描述" }],
      "placeholder": "填空题占位文本"
    }
  ]
}

注意：
- key_points 数量不限，提取核心要点
- todos 仅在原文中确实存在待决策事项时才出现
- type=choice 时 choices 必填，type=fill 时 choices 可为空数组、placeholder 必填
- multiSelect 仅 type=choice 时有效，默认 false
- brief 使用中文

以下是 Agent 工作摘要：
---
${summary}
---`;
}

/** 从可能包含 markdown 代码块的内容中提取纯 JSON */
function extractJsonFromMarkdown(raw: string): string {
  const trimmed = raw.trim();
  // 匹配 ```json ... ``` 或 ``` ... ```
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : trimmed;
}

/** 默认 Session 状态工厂 */
function defaultSession(): SessionState {
  return {
    id: "",
    streamingText: "",
    isStreaming: false,
    completed: false,
    summary: "",
    messages: [],
    turns: [],
    isCompacting: false,
    isRetrying: false,
    queue: { steering: [], followUp: [] },
    summarizationStatus: "idle",
  };
}

// ── Hook ──────────────────────────────────────

/**
 * useAgent — 前端 Agent 核心 Hook。
 * 管理 WebSocket 连接、多 session 状态、文件树、消息流。
 */
export function useAgent(taskId: string | null) {
  const [sessions, setSessions] = useState<Record<string, SessionState>>({});
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");

  const wsRef = useRef<AgentWebSocket | null>(null);
  const activeStepRef = useRef<string | null>(null);
  /** 记录哪些 step 的总结已被触发，确保只触发一次 */
  const summarizingRef = useRef<Set<string>>(new Set());

  // ── 创建 session ──
  const createSession = useCallback(
    async (step: string, intent: string, workspacePath?: string) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;
      const params: Record<string, unknown> = {
        taskId,
        step,
        intent,
      };
      if (workspacePath) {
        params.workspacePath = workspacePath;
      }
      const result = (await wsRef.current.request("session.create", params)) as { sessionId: string };

      setSessions((prev) => ({
        ...prev,
        [step]: { ...defaultSession(), id: result.sessionId },
      }));
    },
    [taskId],
  );

  // ── 发送 prompt ──
  const prompt = useCallback(
    async (step: string, text: string) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;

      setSessions((prev) => ({
        ...prev,
        [step]: {
          ...(prev[step] || defaultSession()),
          messages: [
            ...(prev[step]?.messages || []),
            { role: "user" as const, content: text },
          ],
          completed: false,
        },
      }));

      await wsRef.current.request("session.prompt", { taskId, step, text });
    },
    [taskId],
  );

  // ── 流式修正 ──
  const steer = useCallback(
    (step: string, text: string) => {
      if (!taskId || !wsRef.current) return;
      setSessions((prev) => ({
        ...prev,
        [step]: {
          ...(prev[step] || defaultSession()),
          completed: false,
          messages: [
            ...(prev[step]?.messages || []),
            { role: "user" as const, content: text },
          ],
        },
      }));
      wsRef.current.request("session.steer", { taskId, step, text });
    },
    [taskId],
  );

  // ── 获取文件树 ──
  const getFileTree = useCallback(async () => {
    if (!taskId || !wsRef.current) return;
    const result = (await wsRef.current.request("workspace.tree", {
      taskId,
    })) as { tree: FileNode[] };
    setFileTree(result.tree);
  }, [taskId]);

  // ── 读取文件 ──
  const readFile = useCallback(
    async (filePath: string): Promise<string> => {
      if (!taskId || !wsRef.current) return "";
      const result = (await wsRef.current.request("workspace.readFile", {
        taskId,
        filePath,
      })) as { content: string };
      return result.content;
    },
    [taskId],
  );

  // ── 浏览目录 ──
  const browseDir = useCallback(
    async (dirPath: string): Promise<{ name: string; type: string; path: string }[]> => {
      if (!wsRef.current) return [];
      const result = (await wsRef.current.request("workspace.browse", {
        dirPath,
      })) as { entries: { name: string; type: string; path: string }[] };
      return result.entries;
    },
    [],
  );

  // ── WebSocket 生命周期 ──
  useEffect(() => {
    if (!taskId) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnectionStatus("disconnected");
      return;
    }

    const wsUrl =
      import.meta.env.DEV
        ? `ws://${window.location.hostname}:3100/agent`
        : `ws://${window.location.host}/agent`;

    const ws = new AgentWebSocket(wsUrl);
    wsRef.current = ws;
    setConnectionStatus("connecting");

    ws.onOpen(() => setConnectionStatus("connected"));
    ws.onClose(() => setConnectionStatus("disconnected"));

    ws.onEvent((event: AgentEvent) => {
      const step = activeStepRef.current;
      if (!step) return;

      setSessions((prev) => {
        const s = prev[step] || defaultSession();

        // ── 总结分流：agent_start / text_delta / agent_end ──
        if (s.summarizationStatus === "loading") {
          switch (event.type) {
            case "agent_start":
              return { ...prev, [step]: { ...s, summarizationRaw: "" } };

            case "text_delta":
              return {
                ...prev,
                [step]: { ...s, summarizationRaw: (s.summarizationRaw || "") + event.delta },
              };

            case "agent_end": {
              const raw = extractJsonFromMarkdown(
                (event as { summary: string }).summary || "",
              );
              let result: AgentSummary | undefined;
              try {
                result = JSON.parse(raw);
              } catch {
                result = undefined;
              }
              return {
                ...prev,
                [step]: {
                  ...s,
                  summarizationStatus: result ? "done" : "error",
                  summarizationResult: result || undefined,
                  summarizationRaw: raw,
                },
              };
            }

            default:
              return prev;
          }
        }

        // ── 正常流程 ──
        switch (event.type) {
          case "text_delta":
            return {
              ...prev,
              [step]: {
                ...s,
                streamingText: s.streamingText + event.delta,
                turns: s.turns.length > 0
                  ? s.turns.map((t, i) =>
                      i === s.turns.length - 1 && t.status === "running"
                        ? { ...t, textContent: t.textContent + event.delta }
                        : t,
                    )
                  : [{
                      id: `turn-${Date.now()}`,
                      index: 0,
                      status: "running" as const,
                      textContent: event.delta,
                      thinking: "",
                      toolCalls: [],
                    }],
              },
            };

          case "thinking_delta":
            return {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.length > 0
                  ? s.turns.map((t, i) =>
                      i === s.turns.length - 1 && t.status === "running"
                        ? { ...t, thinking: t.thinking + event.delta }
                        : t,
                    )
                  : [{
                      id: `turn-${Date.now()}`,
                      index: 0,
                      status: "running" as const,
                      textContent: "",
                      thinking: event.delta,
                      toolCalls: [],
                    }],
              },
            };

          case "agent_start":
            return {
              ...prev,
              [step]: { ...s, isStreaming: true, streamingText: "", completed: false },
            };

          case "agent_end": {
            const finalText = s.streamingText;
            const summary = (event as { type: "agent_end"; summary: string }).summary || finalText;
            const updatedTurns = s.turns.map((t, i) =>
              i === s.turns.length - 1 && t.status === "running"
                ? { ...t, status: "done" as const }
                : i === s.turns.length - 1 ? { ...t, status: "done" as const, textContent: finalText } : t,
            );
            const lastTurn = updatedTurns.length > 0 ? updatedTurns[updatedTurns.length - 1] : null;
            if (lastTurn && !lastTurn.textContent && finalText) {
              lastTurn.textContent = finalText;
            }
            return {
              ...prev,
              [step]: {
                ...s,
                isStreaming: false,
                completed: true,
                summary,
                messages: [
                  ...s.messages,
                  ...(finalText
                    ? [{ role: "assistant" as const, content: finalText }]
                    : []),
                ],
                streamingText: "",
                turns: updatedTurns,
                // 触发结构化总结
                summarizationStatus: "loading",
              },
            };
          }

          case "turn_start": {
            const finalizedTurns = s.turns.map((t, i) =>
              i === s.turns.length - 1 && t.status === "running"
                ? { ...t, status: "done" as const }
                : t,
            );
            return {
              ...prev,
              [step]: {
                ...s,
                streamingText: "",
                turns: [
                  ...finalizedTurns,
                  {
                    id: `turn-${Date.now()}`,
                    index: finalizedTurns.length,
                    status: "running" as const,
                    textContent: "",
                    thinking: "",
                    toolCalls: [],
                  },
                ],
              },
            };
          }

          case "turn_end": {
            return {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.map((t, i) =>
                  i === s.turns.length - 1 && t.status === "running"
                    ? { ...t, status: "done" as const }
                    : t,
                ),
                streamingText: "",
              },
            };
          }

          case "tool_execution_start":
            return {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.map((t, i) =>
                  i === s.turns.length - 1
                    ? {
                        ...t,
                        toolCalls: [
                          ...t.toolCalls,
                          {
                            id: event.toolCallId,
                            name: event.toolName,
                            status: "running" as const,
                            category: categorizeToolCall(event.toolName),
                            outputFragments: [],
                            input: event.input,
                          },
                        ],
                      }
                    : t,
                ),
              },
            };

          case "tool_execution_update":
            return {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.map((t) => ({
                  ...t,
                  toolCalls: t.toolCalls.map((tc) =>
                    tc.id === event.toolCallId
                      ? { ...tc, outputFragments: [...tc.outputFragments, event.output] }
                      : tc,
                  ),
                })),
              },
            };

          case "tool_execution_end":
            return {
              ...prev,
              [step]: {
                ...s,
                turns: s.turns.map((t) => ({
                  ...t,
                  toolCalls: t.toolCalls.map((tc) =>
                    tc.id === event.toolCallId
                      ? {
                          ...tc,
                          result: event.result,
                          status: event.isError
                            ? ("error" as const)
                            : ("done" as const),
                        }
                      : tc,
                  ),
                })),
              },
            };

          case "error":
            return {
              ...prev,
              [step]: {
                ...s,
                error: event.message,
                isStreaming: false,
              },
            };

          case "queue_update":
            return {
              ...prev,
              [step]: {
                ...s,
                queue: {
                  steering: event.steering,
                  followUp: event.followUp,
                },
              },
            };

          case "compaction_start":
            return {
              ...prev,
              [step]: { ...s, isCompacting: true },
            };

          case "compaction_end":
            return {
              ...prev,
              [step]: { ...s, isCompacting: false },
            };

          case "auto_retry_start":
            return {
              ...prev,
              [step]: { ...s, isRetrying: true },
            };

          case "auto_retry_end":
            return {
              ...prev,
              [step]: { ...s, isRetrying: false },
            };

          default:
            return prev;
        }
      });
    });

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [taskId]);

  // ── 自动触发结构化总结 ──
  useEffect(() => {
    if (!wsRef.current || !taskId) return;

    for (const [step, session] of Object.entries(sessions)) {
      if (
        session.summarizationStatus === "loading" &&
        session.summary &&
        !summarizingRef.current.has(step)
      ) {
        summarizingRef.current.add(step);

        // 发送总结 prompt 到同一个 session
        // 事件分流由 summarizationStatus === "loading" 保证
        const prevStep = activeStepRef.current;
        activeStepRef.current = step;

        wsRef.current
          .request("session.prompt", {
            taskId,
            step,
            text: buildSummarizationPrompt(session.summary),
          })
          .catch(() => {
            setSessions((prev) => ({
              ...prev,
              [step]: {
                ...prev[step],
                summarizationStatus: "error",
              },
            }));
            activeStepRef.current = prevStep;
          });
      }
    }
  }, [sessions, taskId]);

  return {
    sessions,
    fileTree,
    connectionStatus,
    createSession,
    prompt,
    steer,
    getFileTree,
    readFile,
    browseDir,
  } as const;
}
