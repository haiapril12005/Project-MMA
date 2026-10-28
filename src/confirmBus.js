let listener = null;

export const setConfirmListener = (fn) => { listener = fn; };

export const emitConfirm = (opts) => {
    if (!listener) return false;
    listener(opts);
    return true;
};