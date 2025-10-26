export let whenReady: Promise<void>;

export let setReady: () => void;

whenReady = new Promise(resolve => {
    setReady = resolve;
});