import Editor from "@monaco-editor/react";

export function CodeEditor({
  language,
  code,
  fontSize,
  theme,
  tabSize,
  wordWrap,
  minimap,
  onChange
}: {
  language: string;
  code: string;
  fontSize: number;
  theme: "vs-dark" | "light" | "hc-black";
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  onChange: (code: string) => void;
}) {
  // monaco can pass undefined when the editor is cleared
  function handleChange(value: string | undefined) {
    if (value === undefined) {
      onChange("");
    } else {
      onChange(value);
    }
  }

  return (
    <Editor
      theme={theme}
      language={language}
      value={code}
      onChange={handleChange}
      options={{
        fontSize,
        minimap: { enabled: minimap },
        scrollBeyondLastLine: false,
        wordWrap: wordWrap ? "on" : "off",
        tabSize,
        automaticLayout: true
      }}
    />
  );
}
