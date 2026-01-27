import { eBoardContainer } from "../../common/IocContainer";
import { IModelService } from "../../services";
import { IRenderService } from "../../services/renderService/type";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";
import { IModel } from "../../services/modelService/type";
import { RectCtrlElement } from "../../board/element/rectElement";

interface PictureModel extends IModel {
    type: "picture";
    imageData?: string;
    width?: number;
    height?: number;
}

class PicturePlugin implements IPlugin {
    private board!: IBoard;
    private disposeList: (() => void)[] = [];
    private modelService = eBoardContainer.get<IModelService>(IModelService);
    private renderService = eBoardContainer.get<IRenderService>(IRenderService);
    private transformService = eBoardContainer.get<ITransformService>(ITransformService);
    private imageCache = new Map<string, HTMLImageElement>();

    public pluginName = "PicturePlugin";
    public dependencies = [];

    public init({ board }: IPluginInitParams) {
        this.board = board;
        this.registerPictureDrawHandler();
    }

    public insertImage = (
        imageData: string,
        position?: { x: number; y: number },
        width?: number,
        height?: number
    ): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                let finalPosition = position;

                if (!finalPosition) {
                    const canvas = this.board.getCanvas();
                    if (canvas) {
                        const rect = canvas.getBoundingClientRect();
                        // 获取画布中心的画布坐标
                        const canvasCenter = {
                            x: rect.width / 2,
                            y: rect.height / 2
                        };
                        // 转换为世界坐标
                        const worldCenter = this.transformPoint(canvasCenter, true);

                        // 让图片中心对齐到画布中心，需要减去图片宽高的一半（世界坐标系）
                        const imgWidth = width || img.width;
                        const imgHeight = height || img.height;
                        finalPosition = {
                            x: worldCenter.x - imgWidth / 2,
                            y: worldCenter.y - imgHeight / 2
                        };
                    } else {
                        finalPosition = { x: 0, y: 0 };
                    }
                }


                const model = this.modelService.createModel("picture", {
                    type: 'picture',
                    imageData,
                    width: img.width,
                    height: img.height,
                    points: [finalPosition],
                    ctrlElementConstructor: RectCtrlElement
                } as Partial<PictureModel>);

                resolve(model.id);
            };

            img.onerror = () => {
                reject(new Error("Failed to load image"));
            };

            img.src = imageData;
        });
    };

    public exports = {
        insertImage: this.insertImage
    };

    private transformPoint(point: { x: number; y: number }, inverse = false) {
        return this.transformService.transformPoint(point, inverse);
    }

    private registerPictureDrawHandler() {
        this.renderService.registerDrawModelHandler("picture", this.drawPictureModelHandler);
    }

    private drawPictureModelHandler = (model: PictureModel) => {
        const context = this.board.getCtx();
        if (!context || !model.imageData || !model.points) return;

        context.save();

        let img = this.imageCache.get(model.id);
        if (!img) {
            img = new Image();
            img.src = model.imageData;
            this.imageCache.set(model.id, img);
        }

        if (img.complete) {
            const transformedPos = this.transformPoint(model.points[0]);
            const zoom = this.transformService.getView().zoom;
            const width = (model.width || img.width) * zoom;
            const height = (model.height || img.height) * zoom;

            // 将图片中心对齐到指定位置，而不是左上角
            const drawX = transformedPos.x
            const drawY = transformedPos.y

            context.drawImage(img, drawX, drawY, width, height);
        } else {
            img.onload = () => {
                this.renderService.reRender();
            };
        }

        context.restore();
    };


    public dispose() {
        this.disposeList.forEach(dispose => dispose());
        this.renderService.unregisterDrawModelHandler("picture");
        this.imageCache.clear();
    }
}

export default PicturePlugin;
