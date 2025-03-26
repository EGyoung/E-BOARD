import 'reflect-metadata';
export * from 'inversify';

import { Container } from 'inversify';

let eBoardContainer = new Container();

const resetContainer = () => {
  eBoardContainer = new Container();
};

export { resetContainer, eBoardContainer };
