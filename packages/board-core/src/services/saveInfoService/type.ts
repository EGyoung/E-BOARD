export const ISaveInfoService = Symbol("ISaveInfoService");
import type { OperationSource } from "../modelService/type";

export interface SaveInfoDetail { }
export type ISaveInfoService = {
    exportSaveInfo: () => Promise<SaveInfoDetail[]>; // 导出外存模型数据
    importSaveInfo: (info: SaveInfoDetail, operationSource?: OperationSource) => void; // 通过外存模型数据导入，转化为内存模型，并渲染
    importSaveInfoList: (infoList: SaveInfoDetail[], operationSource?: OperationSource) => void; // 批量导入
}