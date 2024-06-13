Rakis is something interesting.

Run `bun install` and then `bun dev` to start.

Initial Lumentis docs are at [https://rakis-docs.vercel.app](https://rakis-docs.vercel.app).

To generate a quick compressed code block you can throw into an LLM and ask questions, you can run:

```bash
(echo "<CoreCode>\n"; find src/rakis-core -type f \( -name "*.sql" -o -name "*.ts" -o -name "*.csv" -o -name "*.md" -o -name "*.tsx" \) -print -exec cat {} \; | sed -E 's/import[^;]+;//g'; echo "\n</CoreCode>") > help/core-code.txt
```

in the main directory.
