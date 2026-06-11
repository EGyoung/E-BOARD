import { IService } from "../type";

export interface ModeChangeEvent {
  prevMode: Mode;
  currentMode: Mode;
}

export interface IModeService extends IService {
  getCurrentMode(): string | null;
  switchMode(mode: string): void;
  getModeList(): string[];
  registerMode(mode: string, options?: IModeServiceOptions): void;
  onModeChange: (listener: (event: ModeChangeEvent) => void) => { dispose: () => void };
}

export const IModeService = Symbol("IModeService");

export interface IModeServiceOptions {
  beforeSwitchMode?: (event: IBeforeSwitchModeEvent) => void;
  afterSwitchMode?: (event: IAfterSwitchModeEvent) => void;
}

export interface IBeforeSwitchModeEvent {
  currentMode: Mode;
  nextMode: Mode;
}

export interface IAfterSwitchModeEvent {
  prevMode: Mode;
  currentMode: Mode;
}

export type Mode = string | null;
