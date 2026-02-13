import { eBoardContainer } from "../../common/IocContainer";
import { IConfigService, IModelService } from "../../services";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";
import { IModel } from "../../services/modelService/type";

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
    private transformService = eBoardContainer.get<ITransformService>(ITransformService);
    private configService = eBoardContainer.get<IConfigService>(IConfigService);
    private imageCache = new Map<string, HTMLImageElement>();

    public pluginName = "PicturePlugin";
    public dependencies = [];

    public init({ board }: IPluginInitParams) {
        this.board = board;
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
                    options: {
                        ...this.configService.getCtxConfig(),
                        lineWidth: 0
                    },
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

    public dispose() {
        this.disposeList.forEach(dispose => dispose());
        this.imageCache.clear();
    }
}

export default PicturePlugin;
