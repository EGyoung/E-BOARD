import { ISaveInfoService } from './type'


class SaveInfoService implements ISaveInfoService {
    async exportSaveInfo(): Promise<any[]> {
        return []
    }

    async importSaveInfo(info: any): Promise<void> {
        return
    }
}

export default SaveInfoService;
