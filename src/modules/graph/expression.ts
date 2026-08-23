/**
 * Safe expression evaluator for router node conditions.
 *
 * Deliberately NOT `eval`/`new Function`: conditions are authored on the canvas
 * (possibly by end users) and must be safe. The grammar is intentionally
 * small:
 *
 *   expr        := orExpr
 *   orExpr      := andExpr ( "||" andExpr )*
 *   andExpr     := notExpr ( "&&" notExpr )*
 *   notExpr     := "!" notExpr | primary
 *   primary     := "(" expr ")" | comparison | unary
 *   comparison  := unary ( ("==" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "startsWith" | "endsWith") unary )?
 *   unary       := ("-" number) | operand
 *   operand     := path | number | string | boolean | null
 *   path        := ("results" | "input" | "item") ( "." ident | "[" number "]" )*
 *
 * Supported context roots: `results.<nodeId>.<path>`, `input.<path>`, `item.<path>`.
 */

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

type TokenType = "ident" | "number" | "string" | "bool" | "null" | "op" | "lparen" | "rparen" | "lbrk" | "rbrk" | "dot" | "eof";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const OPERATORS = new Set([
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "&&",
  "||",
  "contains",
  "startsWith",
  "endsWith",
]);

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;

  const push = (type: TokenType, value: string, pos: number) => tokens.push({ type, value, pos });

  while (i < n) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      push("lparen", ch, i);
      i += 1;
      continue;
    }
    if (ch === ")") {
      push("rparen", ch, i);
      i += 1;
      continue;
    }
    if (ch === "[") {
      push("lbrk", ch, i);
      i += 1;
      continue;
    }
    if (ch === "]") {
      push("rbrk", ch, i);
      i += 1;
      continue;
    }
    if (ch === ".") {
      push("dot", ch, i);
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let value = "";
      while (j < n && src[j] !== quote) {
        if (src[j] === "\\" && j + 1 < n) {
          value += src[j + 1];
          j += 2;
        } else {
          value += src[j];
          j += 1;
        }
      }
      if (j >= n) throw new ExpressionError(`Unterminated string literal at position ${i}`);
      push("string", value, i);
      i = j + 1;
      continue;
    }
    // Numbers (integer or decimal, optional unary negative sign).
    const lastToken = tokens[tokens.length - 1];
    const isUnaryContext =
      !lastToken ||
      lastToken.type === "op" ||
      lastToken.type === "lparen" ||
      lastToken.type === "lbrk";

    if (/[0-9]/.test(ch) || (ch === "-" && isUnaryContext && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      if (ch === "-") j += 1;
      while (j < n && /[0-9.]/.test(src[j])) j += 1;
      push("number", src.slice(i, j), i);
      i = j;
      continue;
    }
    // Identifiers and word operators (contains, startsWith, endsWith, true/false/null).
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j += 1;
      const word = src.slice(i, j);
      if (word === "true" || word === "false") push("bool", word, i);
      else if (word === "null") push("null", word, i);
      else if (OPERATORS.has(word)) push("op", word, i);
      else push("ident", word, i);
      i = j;
      continue;
    }
    // Multi-char operators first, then single-char operators.
    const two = src.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === ">=" || two === "<=" || two === "&&" || two === "||") {
      push("op", two, i);
      i += 2;
      continue;
    }
    if (ch === ">" || ch === "<" || ch === "!" || ch === "-") {
      push("op", ch, i);
      i += 1;
      continue;
    }
    throw new ExpressionError(`Unexpected character "${ch}" at position ${i}`);
  }

  push("eof", "", n);
  return tokens;
}

export function getPath(root: unknown, segments: (string | number)[]): unknown {
  let current: unknown = root;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[String(seg)];
    } else {
      return undefined;
    }
  }
  return current;
}

export interface ExpressionContext {
  /** Outputs keyed by node id. */
  results: Record<string, unknown>;
  /** The skill's validated user input. */
  input: Record<string, unknown>;
  /** Current item during a parallel map iteration (unused outside map). */
  item?: unknown;
}

class Parser {
  private pos = 0;

  constructor(private tokens: Token[], private ctx: ExpressionContext) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const t = this.tokens[this.pos];
    if (t.type !== "eof") this.pos += 1;
    return t;
  }

  parse(): unknown {
    const value = this.parseOr();
    const t = this.peek();
    if (t.type !== "eof") throw new ExpressionError(`Unexpected token "${t.value}" at position ${t.pos}`);
    return value;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peek().type === "op" && this.peek().value === "||") {
      this.next();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseNot();
    while (this.peek().type === "op" && this.peek().value === "&&") {
      this.next();
      const right = this.parseNot();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseNot(): unknown {
    const t = this.peek();
    if (t.type === "op" && t.value === "!") {
      this.next();
      return !Boolean(this.parseNot());
    }
    return this.parseComparison();
  }

  private parseComparison(): unknown {
    const left = this.parseUnary();
    const t = this.peek();
    // Only comparison operators — `&&`/`||` are handled by the outer layers.
    if (
      t.type === "op" &&
      t.value !== "&&" &&
      t.value !== "||" &&
      OPERATORS.has(t.value)
    ) {
      this.next();
      const right = this.parseUnary();
      return compare(t.value, left, right);
    }
    return left;
  }

  private parseUnary(): unknown {
    const t = this.peek();
    if (t.type === "op" && t.value === "-") {
      this.next();
      const operand = this.parseUnary();
      if (typeof operand !== "number") throw new ExpressionError("Unary minus requires a number");
      return -operand;
    }
    if (t.type === "lparen") {
      this.next();
      const value = this.parseOr();
      const close = this.next();
      if (close.type !== "rparen") throw new ExpressionError(`Expected ")" at position ${close.pos}`);
      return value;
    }
    return this.parseOperand();
  }

  private parseOperand(): unknown {
    const t = this.peek();
    if (t.type === "number") {
      this.next();
      return Number(t.value);
    }
    if (t.type === "string") {
      this.next();
      return t.value;
    }
    if (t.type === "bool") {
      this.next();
      return t.value === "true";
    }
    if (t.type === "null") {
      this.next();
      return null;
    }
    if (t.type === "ident") {
      this.next();
      const rootName = t.value;
      const root =
        rootName === "results"
          ? this.ctx.results
          : rootName === "input"
            ? this.ctx.input
            : rootName === "item"
              ? this.ctx.item
              : undefined;
      if (root === undefined && rootName !== "item") {
        throw new ExpressionError(`Unknown root "${rootName}" — use results., input. or item.`);
      }
      const segments: (string | number)[] = [];
      // After the root, expect (.ident | [number])* or an index like results[nodeId] (unquoted idents already handled).
      let peek = this.peek();
      while (peek.type === "dot" || peek.type === "lbrk") {
        if (peek.type === "dot") {
          this.next();
          const ident = this.next();
          if (ident.type !== "ident") throw new ExpressionError(`Expected identifier after "." at position ${ident.pos}`);
          segments.push(ident.value);
        } else {
          this.next(); // '['
          const idx = this.next();
          if (idx.type !== "number" && idx.type !== "string") {
            throw new ExpressionError(`Expected array index at position ${idx.pos}`);
          }
          const close = this.next();
          if (close.type !== "rbrk") throw new ExpressionError(`Expected "]" at position ${close.pos}`);
          segments.push(idx.type === "number" ? Number(idx.value) : idx.value);
        }
        peek = this.peek();
      }
      return root === undefined ? undefined : getPath(root, segments);
    }
    throw new ExpressionError(`Unexpected token "${t.value}" at position ${t.pos}`);
  }
}

function compare(op: string, left: unknown, right: unknown): boolean {
  switch (op) {
    case "==":
      return looseEqual(left, right);
    case "!=":
      return !looseEqual(left, right);
    case ">":
      return (left as number) > (right as number);
    case ">=":
      return (left as number) >= (right as number);
    case "<":
      return (left as number) < (right as number);
    case "<=":
      return (left as number) <= (right as number);
    case "contains":
      return String(left ?? "").includes(String(right ?? ""));
    case "startsWith":
      return String(left ?? "").startsWith(String(right ?? ""));
    case "endsWith":
      return String(left ?? "").endsWith(String(right ?? ""));
    default:
      throw new ExpressionError(`Unsupported operator "${op}"`);
  }
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === "number" || typeof b === "number") {
    return Number(a) === Number(b);
  }
  return String(a) === String(b);
}

/** Evaluate a condition expression against a context. Throws ExpressionError on syntax errors. */
export function evaluateExpression(expression: string, ctx: ExpressionContext): boolean {
  const trimmed = expression.trim();
  if (!trimmed) throw new ExpressionError("Empty condition expression");
  const tokens = tokenize(trimmed);
  const value = new Parser(tokens, ctx).parse();
  return Boolean(value);
}
