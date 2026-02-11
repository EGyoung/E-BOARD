export const ISaveInfoService = Symbol("ISaveInfoService");
interface SaveInfoDetail { }
export type ISaveInfoService = {
    exportSaveInfo: () => Promise<SaveInfoDetail[]>; // 导出外存模型数据
    importSaveInfo: (info: SaveInfoDetail) => Promise<void>; // 通过外存模型数据导入，转化为内存模型，并渲染
}