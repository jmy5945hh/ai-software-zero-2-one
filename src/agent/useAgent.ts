import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent, FileNode, SessionState, ConnectionStatus, ToolCallCategory } from "./types";
import { AgentWebSocket } from "./ws";

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

/**
 * useAgent — 前端 Agent 核心 Hook。
 * 管理 WebSocket 连接、多 session 状态、文件树、消息流。
 *
 * 用法：
 *   const agent = useAgent(taskId);
 *   agent.createSession("intent", intent);
 *   agent.prompt("intent", "请分析这个业务意图");
 *   const tree = agent.getFileTree();
 */
export function useAgent(taskId: string | null) {
  const [sessions, setSessions] = useState<Record<string, SessionState>>({});
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");

  const wsRef = useRef<AgentWebSocket | null>(null);
  const activeStepRef = useRef<string | null>(null);

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
        [step]: {
          id: result.sessionId,
          streamingText: "",
          isStreaming: false,
          completed: false,
          summary: "",
          messages: [],
          turns: [],
          isCompacting: false,
          isRetrying: false,
          queue: { steering: [], followUp: [] },
        },
      }));
    },
    [taskId],
  );

  // ── 发送 prompt ──
  const prompt = useCallback(
    async (step: string, text: string) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;

      // 在 messages 中添加用户消息
      setSessions((prev) => ({
        ...prev,
        [step]: {
          ...(prev[step] || {
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
          }),
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
      // 修正时重置 completed，等待新一轮输出
      setSessions((prev) => ({
        ...prev,
        [step]: {
          ...(prev[step] || {
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
          }),
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

  // ── 浏览目录（用于工作空间选择器） ──
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
      // 无 taskId 时断开连接
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
        const s = prev[step] || {
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
        };

        switch (event.type) {
          case "text_delta":
            return {
              ...prev,
              [step]: {
                ...s,
                streamingText: s.streamingText + event.delta,
                // 实时写入当前轮次的 textContent
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
            // Ensure textContent is set on the last turn if it's empty
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
              },
            };
          }

          case "turn_start": {
            // 开始新一轮，标记上一轮完成
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
