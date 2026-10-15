import type { RepositoryFile } from "../project-check/repository";

type Line = RepositoryFile["lines"][number];

/** Lexical masking only: preserve source positions, never evaluate repository code. */
function maskCode(lines: Line[]) {
  let quote = "",
    blockComment = false,
    escaped = false,
    regexClass = false;
  return lines.map((line, index) => {
    if (index && line.number !== lines[index - 1].number + 1) {
      quote = "";
      blockComment = false;
      escaped = false;
      regexClass = false;
    }
    let code = "";
    for (let at = 0; at < line.text.length; at++) {
      const char = line.text[at],
        next = line.text[at + 1];
      if (blockComment) {
        if (char === "*" && next === "/") {
          blockComment = false;
          at++;
        }
        continue;
      }
      if (quote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (quote === "/" && char === "[") regexClass = true;
        if (quote === "/" && char === "]") regexClass = false;
        if (char === quote && !regexClass) quote = "";
        continue;
      }
      if (char === "/" && next === "/") break;
      if (char === "/" && next === "*") {
        blockComment = true;
        at++;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        code += " literal ";
        continue;
      }
      // Slash after an expression introducer starts a regular expression,
      // while division keeps its operator and therefore its continuation.
      if (char === "/" && /(?:^|[=(:,!&|?;\[{}]|\breturn|\bthrow)\s*$/.test(code)) {
        quote = "/";
        regexClass = false;
        code += " literal ";
        continue;
      }
      code += char;
    }
    return { text: code, openLiteral: Boolean(quote) };
  });
}

/** Keep multiline JS/TS expressions atomic during both extraction and budgeting.
 * Other languages retain their existing sampling rather than guessing their grammar.
 */
export function sourceStatements(filePath: string, lines: Line[]): Line[][] {
  if (!/\.[cm]?[jt]sx?$/.test(filePath)) return lines.map((line) => [line]);
  const code = maskCode(lines);
  const groups: Line[][] = [];
  let parens = 0,
    brackets = 0,
    previous = "";
  for (const [index, line] of lines.entries()) {
    const current = code[index].text.trim();
    const adjacent = index > 0 && line.number === lines[index - 1].number + 1;
    const continues =
      adjacent &&
      (code[index - 1].openLiteral ||
        parens > 0 ||
        brackets > 0 ||
        /(?:=>|[=?:+\-*/%&|^<>])$/.test(previous) ||
        /^(?:&&|\|\||\?\?|\?(?!\.)|\.(?!\d)|:)/.test(current));
    if (!continues) {
      groups.push([]);
      parens = 0;
      brackets = 0;
    }
    groups.at(-1)!.push(line);
    for (const char of current) {
      if (char === "(") parens++;
      if (char === ")") parens = Math.max(0, parens - 1);
      if (char === "[") brackets++;
      if (char === "]") brackets = Math.max(0, brackets - 1);
      // An object/callback body is a new sampling boundary. Do not turn an
      // enclosing tool({ execute: () => { ... } }) call into one huge unit.
      if (char === "{") {
        parens = 0;
        brackets = 0;
      }
    }
    if (current) previous = current;
    else if (!continues) previous = "";
  }
  return groups;
}
