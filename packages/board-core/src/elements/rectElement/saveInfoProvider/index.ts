class SaveInfoProvider {
    static parse(data: any) {
        return {
            type: data.type,
            points: data.points ? [...data.points] : [],
            width: data.width,
            height: data.height,
            options: data.options ? { ...data.options } : undefined,
            id: data.id
        }
    }

    static importSaveInfo(info: any) {
        return {
            type: info.type,
            isDrawing: false,
            points: info.points ? [...info.points] : [],
            width: info.width,
            height: info.height,
            options: info?.options ? { ...info.options } : undefined,
            id: info.id
        }
    }
}



export default SaveInfoProvider;