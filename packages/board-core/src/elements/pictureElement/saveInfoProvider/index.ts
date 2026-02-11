class SaveInfoProvider {
    static parse(data: any) {
        return {
            imageData: data.imageData,
            width: data.width,
            height: data.height,
            points: [...data.points],
            options: { ...data.options },
        }
    }

    static importSaveInfo(info: any) {
        return {
            imageData: info.imageData,
            width: info.width,
            height: info.height,
            points: info.points,
            options: info.options,
        }
    }
}



export default SaveInfoProvider;