<template>
  <div class="version-display" :class="{ 'version-display--small': small }">
    {{ versionText }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getVersionString } from '@/services/versionService';

const props = defineProps({
  small: {
    type: Boolean,
    default: false
  },
  prefix: {
    type: String,
    default: 'v'
  }
});

const versionText = computed(() => {
  return `${props.prefix}${getVersionString()}`;
});
</script>

<style scoped>
.version-display {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  padding: 0.25rem 0.5rem;
}

.version-display--small {
  font-size: 0.7rem;
  opacity: 0.6;
}
</style>
