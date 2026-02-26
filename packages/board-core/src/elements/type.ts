export interface IModel {
    points: { x: number, y: number }[],
    options: any,
    id: string,
    type: string,
    _clockMap?: Record<string, number>,
    _v?: number,
    _by?: string
}
export interface IPoint { x: number, y: number }
export interface IProps { model: IModel }

