export function useWebCodecs() {
  const extractFrames = async (
    file: File | Blob,
    { fps = 1 }: { fps?: number } = {}
  ): Promise<string[]> => {
    const worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    worker.postMessage({
      action: "extractFrames",
      data: {
        file,
        fps,
      },
    });

    return new Promise<string[]>((resolve, reject) => {
      worker.onmessage = (event) => {
        const { action, data } = event.data;
        if (action === "extractFramesDone") {
          resolve(data);
        } else if (action === "error") {
          reject(data);
        }
      };
    });
  };

  return {
    extractFrames,
  };
}
