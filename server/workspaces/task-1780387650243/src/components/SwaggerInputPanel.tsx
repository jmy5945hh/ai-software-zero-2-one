import { useRef, useState, useCallback } from "react";
import { Upload, Clipboard, FileText, Check, X } from "lucide-react";
import type { SwaggerInputState, InputMethod } from "../types/swagger-diff";

interface SwaggerInputPanelProps {
  /** 面板标题 */
  label: string;
  /** 当前状态 */
  value: SwaggerInputState;
  /** 变更回调 */
  onChange: (state: SwaggerInputState) => void;
  /** 是否作为源文档（左面板） */
  isSource?: boolean;
}

/**
 * Swagger 文档输入面板
 * 支持粘贴 JSON / 上传文件 / 使用 Mock 数据三种方式。
 */
export function SwaggerInputPanel({
  label,
  value,
  onChange,
  isSource,
}: SwaggerInputPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pasteMode, setPasteMode] = useState(value.method === "paste");

  /** 切换输入方式 */
  const switchMethod = useCallback(
    (method: InputMethod) => {
      if (method === "mock") {
        onChange({ label, method: "mock", content: "" });
      } else {
        onChange({ ...value, method, content: value.content || "" });
      }
      setPasteMode(method === "paste");
    },
    [label, value, onChange],
  );

  /** 处理文件上传 */
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onChange({
          label,
          method: "upload",
          content: reader.result as string,
          fileName: file.name,
        });
      };
      reader.readAsText(file);
    },
    [label, onChange],
  );

  /** 处理粘贴内容 */
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ ...value, method: "paste", content: e.target.value });
    },
    [value, onChange],
  );

  /** 清空内容 */
  const handleClear = useCallback(() => {
    onChange({ label, method: "paste", content: "" });
    if (textareaRef.current) textareaRef.current.value = "";
  }, [label, onChange]);

  const isValidJson = (() => {
    if (!value.content.trim()) return null;
    try {
      JSON.parse(value.content);
      return true;
    } catch {
      return false;
    }
  })();

  const hasContent = value.method === "mock" || value.content.trim().length > 0;

  return (
    <div className={`swagger-input-panel ${isSource ? "source" : "target"}`}>
      <div className="swagger-input-header">
        <h3>
          <FileText size={16} />
          {label}
        </h3>
        {value.method === "upload" && value.fileName && (
          <span className="swagger-file-name">{value.fileName}</span>
        )}
      </div>

      {/* 输入方式切换 */}
      <div className="swagger-input-tabs">
        <button
          type="button"
          className={`swagger-input-tab ${value.method === "paste" ? "active" : ""}`}
          onClick={() => switchMethod("paste")}
        >
          <Clipboard size={14} />
          粘贴
        </button>
        <button
          type="button"
          className={`swagger-input-tab ${value.method === "upload" ? "active" : ""}`}
          onClick={() => {
            switchMethod("upload");
            fileInputRef.current?.click();
          }}
        >
          <Upload size={14} />
          上传
        </button>
        <button
          type="button"
          className={`swagger-input-tab ${value.method === "mock" ? "active" : ""}`}
          onClick={() => switchMethod("mock")}
        >
          <Check size={14} />
          示例数据
        </button>
      </div>

      {/* 输入区域 */}
      {value.method === "paste" && (
        <div className="swagger-textarea-wrap">
          <textarea
            ref={textareaRef}
            className="swagger-textarea"
            placeholder='粘贴 Swagger/OpenAPI JSON 文档内容...'
            value={value.content}
            onChange={handleContentChange}
            spellCheck={false}
          />
          {value.content.trim() && (
            <div className="swagger-textarea-meta">
              {isValidJson === true && <span className="swagger-valid">JSON 格式正确</span>}
              {isValidJson === false && <span className="swagger-invalid">JSON 格式有误</span>}
              <span className="swagger-chars">{value.content.length} 字符</span>
              <button type="button" className="swagger-clear-btn" onClick={handleClear}>
                <X size={14} />
                清空
              </button>
            </div>
          )}
        </div>
      )}

      {value.method === "upload" && (
        <div className="swagger-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.yaml,.yml"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          {value.content ? (
            <div className="swagger-upload-done">
              <Check size={24} />
              <span>已加载 {value.fileName || "文件"}</span>
              <span className="swagger-chars">{value.content.length} 字符</span>
            </div>
          ) : (
            <button
              type="button"
              className="swagger-upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={20} />
              <span>点击上传 JSON/YAML 文件</span>
            </button>
          )}
        </div>
      )}

      {value.method === "mock" && (
        <div className="swagger-mock-badge">
          <Check size={16} />
          <span>将使用内置示例 Swagger 文档</span>
        </div>
      )}

      {hasContent && (
        <div className="swagger-input-status">
          <span className={`swagger-status-dot ${hasContent ? "loaded" : ""}`} />
          {value.method === "mock"
            ? "示例数据已就绪"
            : isValidJson
              ? "文档已就绪，可进行对比"
              : "请输入有效的 JSON"}
        </div>
      )}
    </div>
  );
}
