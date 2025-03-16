import MP4Box from "mp4box";

self.addEventListener("message", async (event) => {
  const { action, data } = event.data;

  if (action === "extractFrames") {
    const { file } = data;

    // 读取视频文件

    // 使用 WebCodecs API 解码视频
    const frames = await decodeVideo(file);

    // 将处理结果发送回主线程
    self.postMessage({ action: "extractFramesDone", data: frames });
  }
});

function decodeVideo(file) {
  return new Promise((resolve) => {
    const frames = [];
    const decoder = new VideoDecoder({
      output: (frame) => {
        // 将帧绘制到 OffscreenCanvas
        const canvas = new OffscreenCanvas(frame.codedWidth, frame.codedHeight);
        const context = canvas.getContext("2d");
        context.drawImage(frame, 0, 0);

        // 将帧转换为 Blob URL
        canvas.convertToBlob().then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          frames.push(blobUrl);
        });

        frame.close();
      },
      error: (error) => {
        console.error("VideoDecoder error:", error);
      },
    });

    const mp4boxFile = MP4Box.createFile();
    mp4boxFile.onReady = (info) => {
      const track = info.videoTracks[0];
      const trak = mp4boxFile.getTrackById(track.id);

      const config = {
        codec: track.codec.startsWith("vp08") ? "vp8" : track.codec,
        codedHeight: track.video.height,
        codedWidth: track.video.width,
        description: new Uint8Array(), // 需要从视频文件中提取 avcC 数据
      };

      for (const entry of trak.mdia.minf.stbl.stsd.entries) {
        const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
        if (box) {
          const stream = new MP4Box.DataStream(
            undefined,
            0,
            MP4Box.DataStream.BIG_ENDIAN
          );
          box.write(stream);
          config.description = new Uint8Array(stream.buffer, 8); // Remove the box header.
        }
      }

      decoder.configure(config);
      mp4boxFile.start();
    };

    mp4boxFile.onError = (error) => {
      reject(new Error(`MP4Box error: ${error}`));
    };

    mp4boxFile.onSamples = (track_id, ref, samples) => {
      for (const sample of samples) {
        decoder.decode(
          new EncodedVideoChunk({
            type: sample.is_sync ? "key" : "delta",
            timestamp: (1e6 * sample.cts) / sample.timescale,
            duration: (1e6 * sample.duration) / sample.timescale,
            data: sample.data,
          })
        );
      }
      resolve(frames);
    };

    processFileInChunks(file, mp4boxFile);
  });
}

const processFileInChunks = (file, mp4boxFile) => {
  return new Promise((resolve, reject) => {
    const chunkSize = 1024 * 1024; // 每次读取 1MB
    let offset = 0; // 当前读取的偏移量

    const readNextChunk = () => {
      if (offset >= file.size) {
        // 文件读取完成
        resolve();
        return;
      }

      // 计算当前块的结束位置
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = file.slice(offset, end); // 获取当前块

      // 使用 FileReader 读取当前块
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        const arrayBuffer = event.target.result;

        // 将当前块传递给 mp4box.js
        arrayBuffer.fileStart = offset;
        mp4boxFile.appendBuffer(arrayBuffer);
        mp4boxFile.flush();

        // 更新偏移量，继续读取下一块
        offset = end;
        readNextChunk();
      };

      fileReader.onerror = (error) => {
        reject(new Error(`FileReader error: ${error}`));
      };

      fileReader.readAsArrayBuffer(chunk);
    };

    // 开始读取第一块
    readNextChunk();
  });
};
