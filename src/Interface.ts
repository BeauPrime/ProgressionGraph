import { sprintf } from "./Utils";

var logElement: HTMLDivElement = null;
var frameElement: HTMLDivElement = null;
const queuedLogLines: string[] = [];

export function LogInitialize() {
    logElement = <HTMLDivElement> document.getElementById("log");
    frameElement = <HTMLDivElement> document.getElementById("page-body-frame");
}

export function LogReset() {
    logElement.innerHTML = "";
    queuedLogLines.length = 0;
}

export function LogWrite(msg: string, ...args: any[]) {
    queuedLogLines.push(sprintf(msg, args).replace("\n", "<br/>"));
}

export function LogWarn(msg: string, ...args: any[]) {
    queuedLogLines.push(sprintf("<span class='warning'>" + msg + "</span>", args).replace("\n", "<br/>"));
}

export function LogError(msg: string, ...args: any[]) {
    queuedLogLines.push(sprintf("<span class='error'>" + msg + "</span>", args).replace("\n", "<br/>"));
}

export function LogFlush() {
    if (queuedLogLines.length > 0) {
        const queued = queuedLogLines.join("<br/>");
        queuedLogLines.length = 0;

        let innerHtml = logElement.innerHTML;
        if (innerHtml.length > 0) {
            innerHtml = innerHtml.concat("<br/>", queued);
        } else {
            innerHtml = queued;
        }

        logElement.innerHTML = innerHtml;

        frameElement.scrollTo(0, frameElement.scrollHeight);
    }
}
