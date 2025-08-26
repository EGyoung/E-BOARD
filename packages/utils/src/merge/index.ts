// 对象合并函数 不是undefined就覆盖
const merge = <T>(target: T, source: Partial<T>): T => {
  const result = target;
  for (const key in source) {
    if (source[key] !== undefined) {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }
  return result;
};

export { merge };
