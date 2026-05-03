<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings.store';
import NowPlayingView from '@/views/NowPlayingView.vue';
import HomeFeed from '@/components/HomeFeed.vue';
</script>

<template>
	<NowPlayingView v-if="useSettingsStore().localSettings.now_playing_mode" />
	<HomeFeed v-else />
</template>
