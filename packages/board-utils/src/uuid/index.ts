import { nanoid } from "nanoid";

/**
 * 生成唯一标识符
 * @param size 标识符长度，默认为 21 位
 * @returns 生成的唯一标识符
 */
export function generateUUID(size: number = 21): string {
  return nanoid(size);
}

/**
 * 生成指定长度的数字标识符
 * 注意：这个方法生成的不是真正的 UUID，而是一个数字序列
 * @param length 标识符长度，默认为 10 位
 * @returns 生成的数字标识符
 */
export function generateNumericId(length: number = 10): string {
  return nanoid(length).replace(/[^0-9]/g, "0");
}

/**
 * 检查字符串是否是有效的 nanoid
 * @param id 要检查的字符串
 * @param length 期望的长度（可选）
 * @returns 如果是有效的 nanoid 则返回 true
 */
export function isValidUUID(id: string, length?: number): boolean {
  if (!id) return false;
  if (length && id.length !== length) return false;
  // nanoid 默认使用的字符集
  const pattern = /^[A-Za-z0-9_-]+$/;
  return pattern.test(id);
}

export const uuid = () => {
  return generateUUID(10);
};
