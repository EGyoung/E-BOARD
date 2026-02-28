class SaveInfoProvider {
    static parse(data: any) {
        return {
            type: data.type,
            text: data.text,
            points: data.points ? [...data.points] : [],
            width: data.width,
            height: data.height,
            fontSize: data.fontSize,
            lineHeight: data.lineHeight,
            padding: data.padding,
            options: data.options ? { ...data.options } : undefined,
            id: data.id
        }
    }

    static importSaveInfo(info: any) {
        return {
            type: info.type,
            text: info.text,
            points: info.points ? [...info.points] : [],
            width: info.width,
            height: info.height,
            fontSize: info.fontSize,
            lineHeight: info.lineHeight,
            padding: info.padding,
            options: info?.options ? { ...info.options } : undefined,
            id: info.id
        }
    }
}

export default SaveInfoProvider;
