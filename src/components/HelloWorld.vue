<script setup lang="ts">
import { NButton, NUpload, type UploadFileInfo } from "naive-ui";
import { ref } from "vue";
import { useFFmpeg } from "../hooks/useFFmpeg";

const frames = ref<string[]>([]);

const { extractFrames } = useFFmpeg();

const handleChange = async (options: { fileList: UploadFileInfo[] }) => {
  const file = options.fileList[0];
  if (!file.file) return;
  frames.value = await extractFrames(file.file);
};
</script>

<template>
  <n-upload
    ref="upload"
    :default-upload="false"
    @change="handleChange"
    :multiple="false"
  >
    <n-button>选择文件</n-button>
  </n-upload>

  <div v-if="frames.length" style="display: flex; flex-wrap: wrap">
    {{ frames.length }} 张图片
    <div v-for="frame in frames" :key="frame">
      <img width="100" object-fit="cover" :src="frame" />
    </div>
  </div>
</template>
