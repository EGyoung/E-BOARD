import { IBoard } from '../types';

export interface IPlugin {
  init({ board }: { board: IBoard }): void;
  dispose(): void;
}
