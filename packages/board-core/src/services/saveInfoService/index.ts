import { IServiceInitParams } from 'src/types';
import type EBoard from '../../board';
import { ISaveInfoService } from './type'


class SaveInfoService implements ISaveInfoService {
    private board!: EBoard
    public init({ board }: IServiceInitParams) {
        this.board = board as any
    }

    get modelService() {
        return this.board.getService('modelService')
    }

    get elementService() {
        return this.board.getService('elementService')
    }

    async exportSaveInfo(): Promise<any[]> {
        const allModels = this.modelService.getAllModels()
        const saveInfoList = allModels.map(model => {
            const element = this.elementService.getElement(model.type)
            if (!element) {
                console.warn(`Element of type ${model.type} not found, skipping...`)
                return null
            }
            if (!element.saveInfoProvider) {
                console.warn(`SaveInfoProvider for element type ${model.type} not found, skipping...`)
                return null
            }
            console.log(element.saveInfoProvider, 'element.saveInfoProvider')
            const saveInfo = element.saveInfoProvider.parse(model)
            return {
                type: model.type,
                ...saveInfo
            }
        }).filter(info => info !== null)
        return saveInfoList as any[]
    }

    importSaveInfo(info: any) {
        const element = this.elementService.getElement(info.type)
        if (!element) {
            console.warn(`Element of type ${info.type} not found, skipping...`)
            return
        }
        if (!element.saveInfoProvider) {
            console.warn(`SaveInfoProvider for element type ${info.type} not found, skipping...`)
            return
        }
        const model = element.saveInfoProvider.importSaveInfo(info)
        this.modelService.createModel(model.type, model)
    }

    importSaveInfoList(infoList: any[]) {
        return infoList.forEach(info => this.importSaveInfo(info))
    }


}

export default SaveInfoService;
