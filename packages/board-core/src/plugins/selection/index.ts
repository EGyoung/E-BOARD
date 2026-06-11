import { IBoard, IPluginInitParams } from "../../types";
import { eBoardContainer } from "../../common/IocContainer";
import { IModel, IModelService } from "../../services/modelService/type";
import { IPlugin } from "../type";
import { IModeService, IRenderService } from "../../services";
import { ITransformService } from "../../services/transformService/type";
import { Emitter } from "@e-board/board-utils";

import { SelectionOperator } from "./operator";
import { SelectionDOMOverlay } from "./overlay";
import { SelectionInteraction, InteractionState, InteractionCallbacks } from "./interaction";

const CURRENT_MODE = "selection";

class SelectionPlugin implements IPlugin {
  private board!: IBoard;

  // -- 依赖（createDependencies 中创建）--------------------------
  private disposeList!: (() => void)[];
  private state!: InteractionState;
  private modelService!: IModelService;
  private transformService!: ITransformService;
  private renderService!: IRenderService;
  private operator!: SelectionOperator;
  private overlay!: SelectionDOMOverlay;
  private interaction!: SelectionInteraction;

  // -- 事件（无依赖，inline 初始化）-------------------------------
  private readonly _onSelectedElements = new Emitter<IModel[]>();
  private readonly _onElementsMoving = new Emitter<IModel[]>();
  private readonly _onDraggingChange = new Emitter<boolean>();

  public onElementMoving = this._onElementsMoving.event;
  public onSelectedElements = this._onSelectedElements.event;
  public onDraggingChange = this._onDraggingChange.event;
  public pluginName = "SelectionPlugin";

  public exports = {
    getSelectedModelsId: this.getSelectedModelsId.bind(this),
    getSelectedModels: this.getSelectedModels.bind(this),
    addSelectedModels: this.addSelectedModels.bind(this),
    onSelectedElements: this.onSelectedElements.bind(this),
    onElementsMoving: this.onElementMoving.bind(this),
    onDraggingChange: this.onDraggingChange.bind(this),
  };

  // ===================================================================
  // 生命周期
  // ===================================================================

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.createDependencies();
    this.bindEvents();

    const modeService = eBoardContainer.get<IModeService>(IModeService);
    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.interaction.detach();
          this.disposeList.forEach(d => d());
          this.state.selectModels.clear();
          this.resetAllState();
          this._onSelectedElements.fire([]);
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.bindEvents();
          const container = this.board.getContainer();
          if (container) this.interaction.attach(container);
        }
      },
    });
  }

  public dispose() {
    if (this.state.rafId !== null) {
      cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }
    this.interaction.detach();
    this.overlay.remove();
    this.disposeList.forEach(d => d());
    this.disposeList = [];
  }

  // ===================================================================
  // 依赖创建
  // ===================================================================

  private createDependencies() {
    this.disposeList = [];
    this.state = {
      selectModels: new Set(),
      AABbBox: null,
      initialModelPositions: new Map(),
      initialModelSizes: new Map(),
      currentSelectRange: null,
      isDragging: false,
      rafId: null,
    };

    this.modelService = eBoardContainer.get<IModelService>(IModelService);
    this.transformService = eBoardContainer.get<ITransformService>(ITransformService);
    this.renderService = eBoardContainer.get<IRenderService>(IRenderService);
    this.operator = new SelectionOperator(this.modelService, this.transformService);
    this.overlay = new SelectionDOMOverlay();

    const callbacks: InteractionCallbacks = {
      renderOverlay: this.renderOverlay,
      addSelectedModels: this.addSelectedModels.bind(this),
      resetAllState: this.resetAllState.bind(this),
      onElementsMoving: (models) => this._onElementsMoving.fire(models as IModel[]),
      onDraggingChange: (d) => this._onDraggingChange.fire(d),
      onSelectedElements: (models) => this._onSelectedElements.fire(models as IModel[]),
    };

    this.interaction = new SelectionInteraction({
      state: this.state,
      operator: this.operator,
      overlay: this.overlay,
      modelService: this.modelService,
      callbacks,
      getContainer: () => this.board.getContainer(),
    });
  }

  private bindEvents() {
    this.disposeList.push(
      this.renderService.onRenderEnd(() => this.renderOverlay()).dispose,
      this.modelService.onModelOperation((event: any) => {
        if (this.state.selectModels.has(event.modelId)) {
          requestAnimationFrame(() => this.renderOverlay());
        }
      }).dispose,
    );
  }

  // ===================================================================
  // DOM Overlay
  // ===================================================================

  private renderOverlay = () => {
    if (this.state.isDragging) return;
    const container = this.board.getContainer();
    if (!container) return;
    this.state.AABbBox = this.overlay.update(container, this.state.selectModels, this.modelService);
  };

  // ===================================================================
  // 工具
  // ===================================================================

  private resetAllState() {
    this.overlay.remove();
    this.state.initialModelPositions.clear();
    this.state.currentSelectRange = null;
  }

  private addSelectedModels(id: string) {
    if (!this.state.selectModels.has(id)) {
      this.state.selectModels.add(id);
      this._onSelectedElements.fire(this.getCurrentModels());
    }
  }

  private getCurrentModels(): IModel[] {
    return Array.from(this.state.selectModels)
      .map(id => this.modelService.getModelById(id))
      .filter(Boolean) as IModel[];
  }

  public getSelectedModelsId(): string[] {
    return Array.from(this.state.selectModels);
  }

  public getSelectedModels(): IModel[] {
    return this.getCurrentModels();
  }
}

export default SelectionPlugin;