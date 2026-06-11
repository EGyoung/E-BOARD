
import { Emitter } from "@e-board/board-utils";
import { IBoard, IServiceInitParams } from "../../types";
import {
  IModeService,
  IModeServiceOptions,
  Mode,
  ModeChangeEvent,
} from "./type";
import { injectable } from "inversify";

@injectable()
class ModeService implements IModeService {
  private board!: IBoard;
  private currentMode: Mode = null;
  private modeHandler = new Map<Mode, IModeServiceOptions>();

  private _onModeChange = new Emitter<ModeChangeEvent>();
  public onModeChange = this._onModeChange.event;

  init({ board }: IServiceInitParams): void {
    this.board = board;
  }

  getCurrentMode(): Mode {
    return this.currentMode;
  }

  switchMode(mode: Mode): void {
    // 触发所有模式的 beforeSwitchMode
    this.modeHandler.forEach(handler => {
      handler.beforeSwitchMode?.({ currentMode: this.currentMode, nextMode: mode });
    });
    let prevMode = this.currentMode;
    this.currentMode = mode;

    // 通知模式变化监听器
    this._onModeChange.fire({ prevMode, currentMode: mode });

    // 触发所有模式的 afterSwitchMode
    this.modeHandler.forEach(handler => {
      handler.afterSwitchMode?.({ prevMode, currentMode: mode });
    });
  }

  getModeList(): string[] {
    return Array.from(this.modeHandler.keys()) as any;
  }

  registerMode(mode: Mode, options: IModeServiceOptions): void {
    if (this.modeHandler.has(mode)) {
      throw new Error(`Mode ${mode} already registered`);
    }
    this.modeHandler.set(mode, options);
  }

  unregisterMode(mode: Mode): void {
    this.modeHandler.delete(mode);
  }

  dispose(): void {
    this.modeHandler.clear();
  }
}

export default ModeService;
