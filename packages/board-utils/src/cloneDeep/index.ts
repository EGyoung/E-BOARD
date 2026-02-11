// 高性能cloneDeep
export function cloneDeep<T>(obj: T, hash = new WeakMap()): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (hash.has(obj)) {
        return hash.get(obj) as T;
    }

    const cloneObj = Array.isArray(obj) ? [] : {};
    hash.set(obj, cloneObj);

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            (cloneObj as any)[key] = cloneDeep((obj as any)[key], hash);
        }
    }

    return cloneObj as T;
}