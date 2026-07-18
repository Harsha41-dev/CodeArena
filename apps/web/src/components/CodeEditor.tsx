import Editor from "@monaco-editor/react";

export function CodeEditor({
  language,
  code,
  fontSize,
  onChange
}: {
  language: string;
  code: string;
  fontSize: number;
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
      theme="vs-dark"
      language={language}
      value={code}
      onChange={handleChange}
      options={{
        fontSize,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true
      }}
    />
  );
}
