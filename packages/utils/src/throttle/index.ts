function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastExecTime: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    const now = Date.now();

    // 计算剩余等待时间
    const remainingTime = lastExecTime ? delay - (now - lastExecTime) : 0;

    if (remainingTime <= 0) {
      // 如果超过间隔时间，立即执行
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      func.apply(context, args);
      lastExecTime = now;
    } else if (!timeoutId) {
      // 设置定时器，在剩余时间后执行
      timeoutId = setTimeout(() => {
        func.apply(context, args);
        lastExecTime = Date.now();
        timeoutId = null;
      }, remainingTime);
    }
  };
}

// 渲染帧截流
const throttleByRaf = <T extends (...args: any[]) => any>(
  func: T
): ((...args: Parameters<T>) => void) => {
  let ticking = false;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        func.apply(context, args);
        ticking = false;
      });
    }
  };
};

// 用法
// const throttledFunction = throttle(originalFunction, 200); // 200ms间隔
// const throttledByRafFunction = throttleByRaf(originalFunction);

export { throttle, throttleByRaf };
