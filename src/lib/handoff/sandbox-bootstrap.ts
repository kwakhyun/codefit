/** Trusted source evaluated before learner code. The returned serializer is held
 * only by the host; no host capabilities are installed in the guest context.
 * Keep this self-contained: it runs inside QuickJS, not the browser JS engine.
 */
export const SANDBOX_BOOTSTRAP = String.raw`
(() => {
  const seen = new WeakSet();
  const harden = (value) => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) return;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const d = Object.getOwnPropertyDescriptor(value, key);
      if ('value' in d) harden(d.value);
      else { harden(d.get); harden(d.set); }
    }
    harden(Object.getPrototypeOf(value));
    Object.freeze(value);
  };
  // Built-ins participate in the test expressions as well as serialization.
  // Protect both their objects/prototypes and the global bindings. Do not freeze
  // globalThis itself: learners still declare their own functions and variables.
  for (const key of Reflect.ownKeys(globalThis)) {
    const d = Object.getOwnPropertyDescriptor(globalThis, key);
    if (!('value' in d)) continue;
    if (d.value !== globalThis) harden(d.value);
    Object.defineProperty(globalThis, key, { ...d, configurable: false, writable: false });
  }
  harden(Object.getPrototypeOf(async function () {}));
  harden(Object.getPrototypeOf(function* () {}));
  harden(Object.getPrototypeOf(async function* () {}));

  return (value) => {
    const active = new WeakSet();
    let output = '', nodes = 0;
    const fail = (message) => { throw new Error(message); };
    const append = (text) => {
      if (output.length + text.length > 1600) fail('출력은 1,600자까지만 확인할 수 있습니다.');
      output += text;
    };
    const visit = (v, depth) => {
      if (++nodes > 1000 || depth > 40) fail('결과의 항목 수나 중첩 깊이가 실행 범위를 초과했습니다.');
      if (v === null) { append('null'); return; }
      const type = typeof v;
      if (type === 'string' || type === 'boolean' || type === 'number') {
        if (type === 'number' && !Number.isFinite(v)) fail('NaN과 Infinity는 null과 다른 값입니다. 유한한 숫자를 반환해 주세요.');
        append(JSON.stringify(v));
        return;
      }
      if (type !== 'object') fail('실행 결과는 JSON으로 비교할 수 있는 값이어야 합니다. undefined, 함수, Symbol, BigInt는 지원하지 않습니다.');
      if (active.has(v)) fail('순환 참조가 있는 결과는 비교할 수 없습니다.');
      const array = Array.isArray(v);
      const proto = Object.getPrototypeOf(v);
      if (!array && proto !== Object.prototype && proto !== null) fail('일반 객체와 배열만 비교할 수 있습니다. Date, Map 등은 비교할 값으로 변환해 주세요.');
      active.add(v);
      const descriptors = Object.getOwnPropertyDescriptors(v);
      const keys = Reflect.ownKeys(descriptors).filter((key) => descriptors[key].enumerable);
      for (const key of keys) {
        if (typeof key !== 'string') fail('Symbol 속성이 있는 결과는 비교할 수 없습니다.');
        if (!Object.hasOwn(descriptors[key], 'value')) fail('getter 결과는 자동으로 실행하지 않습니다. 비교할 값을 직접 반환해 주세요.');
      }
      if (array) {
        const length = descriptors.length.value;
        if (length > 1000) fail('결과의 항목 수가 실행 범위를 초과했습니다.');
        for (const key of keys) {
          const index = Number(key);
          if (!Number.isInteger(index) || index < 0 || index >= length || String(index) !== key)
            fail('배열의 추가 속성은 비교할 수 없습니다. 일반 객체로 반환해 주세요.');
        }
        append('[');
        for (let i = 0; i < length; i++) {
          const d = descriptors[i];
          if (!d || !Object.hasOwn(d, 'value')) fail('배열의 빈 자리와 getter는 null로 바꾸지 않습니다. 각 값을 직접 지정해 주세요.');
          if (i) append(',');
          visit(d.value, depth + 1);
        }
        append(']');
      } else {
        append('{');
        for (let i = 0; i < keys.length; i++) {
          if (i) append(',');
          const key = keys[i];
          append(JSON.stringify(key)); append(':'); visit(descriptors[key].value, depth + 1);
        }
        append('}');
      }
      active.delete(v);
    };
    visit(value, 0);
    return output;
  };
})()
`;
