import { useState, useEffect, useRef, useCallback } from "react";
import type { AgentEvent, FileNode, SessionState, ConnectionStatus, ToolCallCategory, Turn, ConnectionQuality } from "./types";
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

/** 从 diff 文本中提取 +N -M 统计 */
function extractDiffStats(text: string): { additions: number; deletions: number } {
  if (!text) return { additions: 0, deletions: 0 };
  let adds = 0;
  let dels = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) adds++;
    if (line.startsWith("-") && !line.startsWith("---")) dels++;
  }
  return { additions: adds, deletions: dels };
}

/** 从 session 的所有 turns 中提取文件变更列表（create / modify / delete），含行数统计和 diff 内容 */
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
          const content = typeof parsed.content === "string" ? parsed.content : "";
          const lines = content ? content.split("\n").length : 0;
          changes.push({
            path: parsed.path,
            action: "create",
            additions: lines,
            deletions: 0,
            diffContent: content || undefined,
          });
        }
      } else if (tc.name === "edit" && typeof parsed.path === "string") {
        if (!seen.has(parsed.path)) {
          seen.add(parsed.path);
          const output = tc.result || tc.outputFragments.join("");
          const stats = extractDiffStats(output);
          changes.push({
            path: parsed.path,
            action: "modify",
            additions: stats.additions,
            deletions: stats.deletions,
            diffContent: output || undefined,
          });
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

/**
 * 鲁棒 JSON 提取器。
 * 能处理：markdown 代码块包裹（```json / ```markdown / ```）、
 * 前后中文说明文本、BOM / 零宽字符、JSON 尾部逗号容错。
 * 多层 fallback 策略。
 */
function robustExtractJson(raw: string): string {
  let text = raw.trim();

  // Step 0: 移除 BOM 和常见零宽字符
  text = text.replace(/^[\uFEFF\u200B-\u200D\u2060]+/, "");

  // Step 1: 移除 markdown 代码块包裹 ```json / ```markdown / ```
  // 匹配开头的 ```xxx 和结尾的 ```
  const fenceMatch = text.match(/^```(?:json|markdown)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    // Step 2: 如果不在完整的代码块中，尝试提取 { ... } 部分
    const braceStart = text.indexOf("{");
    const braceEnd = text.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      text = text.slice(braceStart, braceEnd + 1);
    }
  }

  // Step 3: 容错移除尾部多余的逗号（JSON 最后一组逗号）
  // 匹配 ,} ,] ,\s+} ,\s+]
  text = text.replace(/,(\s*[}\]])/g, "$1");

  // Step 4: 再次 trim
  text = text.trim();

  // 验证是否以 { 开头以 } 结尾
  if (text.startsWith("{") && text.endsWith("}")) {
    return text;
  }

  // 兜底：返回原始内容（后续 JSON.parse 会报错，降级展示即可）
  return raw;
}

/** 从可能包含 markdown 代码块的内容中提取纯 JSON */
function extractJsonFromMarkdown(raw: string): string {
  return robustExtractJson(raw);
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
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>({
    latency: 0,
    reconnectAttempt: 0,
  });

  const wsRef = useRef<AgentWebSocket | null>(null);
  const activeStepRef = useRef<string | null>(null);
  /** 记录哪些 step 的总结已被触发，确保只触发一次 */
  const summarizingRef = useRef<Set<string>>(new Set());
  /** 当前正在总结的 step（用于分流总结事件到对应 session） */
  const summarizingStepRef = useRef<string | null>(null);

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

  // ── 回答问题 ──
  const answerQuestion = useCallback(
    async (step: string, answer: string) => {
      if (!taskId || !wsRef.current) return;
      await wsRef.current.request("session.answerQuestion", { taskId, step, answer });
    },
    [taskId],
  );

  // ── 重试整个 Agent 流程 ──
  const retrySession = useCallback(
    async (step: string, text: string, initialPrompt?: string) => {
      if (!taskId || !wsRef.current) return;
      activeStepRef.current = step;

      // 重置 session 状态（前端立即清理，等待新 session 事件覆盖）
      setSessions((prev) => ({
        ...prev,
        [step]: {
          ...defaultSession(),
          id: prev[step]?.id || "",
          messages: [],
        },
      }));

      // 清除该 step 的总结标记，允许重新触发总结
      summarizingRef.current.delete(step);

      await wsRef.current.request("session.retry", { taskId, step, text, initialPrompt });
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
      setConnectionQuality({ latency: 0, reconnectAttempt: 0 });
      return;
    }

    const wsUrl =
      import.meta.env.DEV
        ? `ws://${window.location.hostname}:3100/agent`
        : `ws://${window.location.host}/agent`;

    const ws = new AgentWebSocket(wsUrl);
    wsRef.current = ws;
    setConnectionStatus("connecting");

    ws.onOpen(() => {
      setConnectionStatus("connected");
      setConnectionQuality({ latency: 0, reconnectAttempt: 0 });
    });
    ws.onClose(() => setConnectionStatus("disconnected"));

    ws.onReconnecting((attempt: number) => {
      setConnectionStatus("reconnecting");
      setConnectionQuality((prev) => ({ ...prev, reconnectAttempt: attempt }));
    });

    ws.onStatusUpdate((quality: ConnectionQuality) => {
      setConnectionQuality(quality);
    });

    ws.onEvent((event: AgentEvent) => {
      // ── 总结事件分流（独立 session，不影响正常流程）──
      const sumStep = summarizingStepRef.current;
      if (sumStep) {
        setSessions((prev) => {
          const s = prev[sumStep] || defaultSession();

          switch (event.type) {
            case "agent_start":
              return { ...prev, [sumStep]: { ...s, summarizationRaw: "" } };

            case "text_delta":
              return {
                ...prev,
                [sumStep]: {
                  ...s,
                  summarizationRaw: (s.summarizationRaw || "") + event.delta,
                },
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

              // 校验 todos 中每个 item 的 type 必须为 "choice" 或 "fill"
              if (result?.todos) {
                const valid = result.todos.every(
                  (t) => t.type === "choice" || t.type === "fill",
                );
                if (!valid) {
                  result = undefined;
                }
              }

              summarizingStepRef.current = null;
              if (!result) {
                // 解析失败或校验不通过 → 重置状态触发重试
                summarizingRef.current.delete(sumStep);
                return {
                  ...prev,
                  [sumStep]: {
                    ...s,
                    summarizationStatus: "pending",
                    summarizationResult: undefined,
                    summarizationRaw: raw,
                  },
                };
              }
              summarizingRef.current.delete(sumStep);
              return {
                ...prev,
                [sumStep]: {
                  ...s,
                  summarizationStatus: "done",
                  summarizationResult: result,
                  summarizationRaw: raw,
                },
              };
            }

            default:
              return prev;
          }
        });
        return;
      }

      // ── 正常流程 ──
      const step = activeStepRef.current;
      if (!step) return;

      setSessions((prev) => {
        const s = prev[step] || defaultSession();

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
                // 标记待触发独立总结
                summarizationStatus: "pending",
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

  // ── 自动触发独立结构化总结 ──
  useEffect(() => {
    if (!wsRef.current || !taskId) return;

    for (const [step, session] of Object.entries(sessions)) {
      if (
        session.summarizationStatus === "pending" &&
        session.summary &&
        !summarizingRef.current.has(step)
      ) {
        summarizingRef.current.add(step);

        // Step 1: 保存 summary 到后端
        wsRef.current
          .request("summarization.save", {
            taskId,
            step,
            summary: session.summary,
          })
          .then(() => {
            // Step 2: 触发独立总结 session
            setSessions((prev) => ({
              ...prev,
              [step]: {
                ...prev[step],
                summarizationStatus: "loading",
              },
            }));

            // 设置分流标记，让后续事件路由到总结分支
            summarizingStepRef.current = step;

            return wsRef.current!.request("summarization.trigger", {
              taskId,
              step,
            });
          })
          .catch(() => {
            summarizingStepRef.current = null;
            summarizingRef.current.delete(step);
            setSessions((prev) => ({
              ...prev,
              [step]: {
                ...prev[step],
                summarizationStatus: "error",
              },
            }));
          });
      }
    }
  }, [sessions, taskId]);

  return {
    sessions,
    fileTree,
    connectionStatus,
    connectionQuality,
    createSession,
    prompt,
    steer,
    answerQuestion,
    retrySession,
    getFileTree,
    readFile,
    browseDir,
  } as const;
}
