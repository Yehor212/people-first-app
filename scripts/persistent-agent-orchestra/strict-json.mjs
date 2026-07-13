export function assertNoDuplicateJsonKeys(raw) {
  if (typeof raw !== "string") throw new TypeError("JSON input must be a string");
  let cursor = 0;

  const skipWhitespace = () => {
    while (/\s/.test(raw[cursor] ?? "")) cursor += 1;
  };

  const parseStringToken = () => {
    if (raw[cursor] !== '"') throw new Error("expected JSON string");
    const start = cursor;
    cursor += 1;
    while (cursor < raw.length) {
      const character = raw[cursor];
      if (character === '"') {
        cursor += 1;
        return JSON.parse(raw.slice(start, cursor));
      }
      if (character === "\\") {
        cursor += 1;
        if (raw[cursor] === "u") cursor += 5;
        else cursor += 1;
        continue;
      }
      cursor += 1;
    }
    throw new Error("unterminated JSON string");
  };

  const parseValue = () => {
    skipWhitespace();
    const character = raw[cursor];
    if (character === "{") return parseObject();
    if (character === "[") return parseArray();
    if (character === '"') {
      parseStringToken();
      return;
    }
    const primitive = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
      raw.slice(cursor),
    );
    if (!primitive) throw new Error("invalid JSON value");
    cursor += primitive[0].length;
  };

  const parseObject = () => {
    cursor += 1;
    skipWhitespace();
    const keys = new Set();
    if (raw[cursor] === "}") {
      cursor += 1;
      return;
    }
    while (cursor < raw.length) {
      skipWhitespace();
      const key = parseStringToken();
      if (keys.has(key)) {
        const error = new Error(`duplicate JSON key: ${key}`);
        error.code = "DUPLICATE_JSON_KEY";
        throw error;
      }
      keys.add(key);
      skipWhitespace();
      if (raw[cursor] !== ":") throw new Error("expected JSON object colon");
      cursor += 1;
      parseValue();
      skipWhitespace();
      if (raw[cursor] === "}") {
        cursor += 1;
        return;
      }
      if (raw[cursor] !== ",") throw new Error("expected JSON object comma");
      cursor += 1;
    }
    throw new Error("unterminated JSON object");
  };

  const parseArray = () => {
    cursor += 1;
    skipWhitespace();
    if (raw[cursor] === "]") {
      cursor += 1;
      return;
    }
    while (cursor < raw.length) {
      parseValue();
      skipWhitespace();
      if (raw[cursor] === "]") {
        cursor += 1;
        return;
      }
      if (raw[cursor] !== ",") throw new Error("expected JSON array comma");
      cursor += 1;
    }
    throw new Error("unterminated JSON array");
  };

  parseValue();
  skipWhitespace();
  if (cursor !== raw.length) throw new Error("trailing JSON content");
}
