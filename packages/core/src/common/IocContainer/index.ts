import "reflect-metadata";
export * from "inversify";

import { Container } from "inversify";

// 这个B玩意儿的 get方法 性能特别差，如果频繁调用会拖垮整个应用，建议通过单例的方式来引入.
let eBoardContainer = new Container();

const resetContainer = () => {
  eBoardContainer = new Container();
};

export { resetContainer, eBoardContainer };
