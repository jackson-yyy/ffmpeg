import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { ref } from "vue";

const Workspace = "/workspace";

export function useFFmpeg() {
  const loaded = ref(false);
  const ffmpeg = new FFmpeg();

  const taskId = Date.now();
  const taskDir = `${Workspace}/${taskId}`;
  const taskFilePath = `${taskDir}/file`;
  const taskFrameDir = `${taskDir}/frames`;

  const initFFmpeg = async () => {
    const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";
    ffmpeg.on("log", ({ message }) => {
      console.log(message);
    });
    // toBlobURL is used to bypass CORS issue, urls with the same
    // domain can be used directly.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
      workerURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.worker.js`,
        "text/javascript"
      ),
    });
    ffmpeg.createDir(Workspace);
    ffmpeg.createDir(taskDir);
    ffmpeg.createDir(taskFrameDir);
    loaded.value = true;
  };
  const initPromise = initFFmpeg();

  const extractFrames = async (
    video: File | Blob,
    { fps = 1 }: { fps?: number } = {}
  ) => {
    if (!ffmpeg.loaded) {
      await initPromise;
    }
    ffmpeg.writeFile(taskFilePath, await fetchFile(video));
    const start = performance.now();
    const code = await ffmpeg.exec([
      "-i",
      taskFilePath, // 输入文件
      "-r",
      fps.toString(), // 从视频的开始位置提取
      "-vsync",
      "vfr",
      "-threads",
      "4",
      `${taskFrameDir}/frame_%03d.png`,
    ]);
    console.log("Time taken", performance.now() - start);

    if (code !== 0) throw new Error("Failed to extract frames");

    const ls = await ffmpeg.listDir(taskFrameDir);

    const frames = await Promise.all(
      ls
        .filter((item) => !item.isDir)
        .map(async (file) => {
          const data = await ffmpeg.readFile(`${taskFrameDir}/${file.name}`);
          await ffmpeg.deleteFile(`${taskFrameDir}/${file.name}`);
          return URL.createObjectURL(new Blob([data], { type: "image/png" }));
        })
    );

    await ffmpeg.deleteFile(taskFilePath);
    return frames;
  };

  return {
    extractFrames,
  };
}
