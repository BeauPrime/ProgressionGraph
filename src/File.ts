export type ReadCallback<T> = (result: T) => void;

/**
 * Reads the given file as text.
 */
export function ReadFileAsText(file: File | Blob, callback: ReadCallback<string>): void {
    const reader: FileReader = new FileReader();
    reader.onloadend = (e) => callback(<string> e.target.result);
    reader.readAsText(file);
}

/**
 * Reads the given file as a json object.
 */
export function ReadFileAsJSON(file: File | Blob, callback: ReadCallback<object>): void {
    const reader: FileReader = new FileReader();
    reader.onloadend = (e) => {
        const obj = JSON.parse(<string> e.target.result);
        callback(obj);
    };
    reader.readAsText(file);
}

/**
 * Reads the given file as an array buffer.
 */
export function ReadFileAsBuffer(file: File | Blob, callback: ReadCallback<ArrayBufferLike>): void {
    const reader: FileReader = new FileReader();
    reader.onloadend = (e) => callback(<ArrayBufferLike> e.target.result);
    reader.readAsArrayBuffer(file);
}