import * as fs from "fs";
import * as path from "path";

interface TodoItem {
  filename: string;
  content: string[];
}

function walkDir(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

function extractTodos(filePath: string): TodoItem[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const todos: TodoItem[] = [];
  let currentTodo: TodoItem | null = null;

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("// TODO:")) {
      if (currentTodo) {
        todos.push(currentTodo);
      }
      currentTodo = {
        filename: filePath,
        content: [trimmedLine],
      };
    } else if (currentTodo && trimmedLine.startsWith("//")) {
      currentTodo.content.push(trimmedLine);
    } else if (currentTodo) {
      todos.push(currentTodo);
      currentTodo = null;
    }
  });

  if (currentTodo) {
    todos.push(currentTodo);
  }

  return todos;
}

function compileTodos(rootDir: string, outputFile: string): void {
  const files = walkDir(rootDir);
  const allTodos: TodoItem[] = [];

  files.forEach((file) => {
    if (file.endsWith(".ts") || file.endsWith(".js")) {
      const todos = extractTodos(file);
      allTodos.push(...todos);
    }
  });

  let output = "# Project TODOs\n\n";

  const groupedTodos: { [key: string]: TodoItem[] } = {};

  allTodos.forEach((todo) => {
    const relativePath = path.relative(rootDir, todo.filename);
    if (!groupedTodos[relativePath]) {
      groupedTodos[relativePath] = [];
    }
    groupedTodos[relativePath].push(todo);
  });

  Object.keys(groupedTodos)
    .sort()
    .forEach((filename) => {
      output += `## ${filename}\n\n`;
      groupedTodos[filename].forEach((todo) => {
        const todoContent = todo.content
          .join(" ")
          .replace(/^\/\/ ?TODO: ?/i, "")
          .trim();
        output += `- [ ] ${todoContent}\n`;
      });
      output += "\n";
    });

  fs.writeFileSync(outputFile, output);
  console.log(`TODOs compiled and saved to ${outputFile}`);
}

// Usage
const rootDirectory = path.join(__dirname, "..", "src");
const outputFilePath = path.join(__dirname, "TODO.md");

console.log("Compiling TODOs from", rootDirectory, "to", outputFilePath);

compileTodos(rootDirectory, outputFilePath);
