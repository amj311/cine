<script setup lang="ts">
import HomeFeed from '@/components/HomeFeed.vue';
import NowPlayingView from '@/views/NowPlayingView.vue';
import { useProfileStore } from '@/stores/profile.store';
</script>

<template>
	<NowPlayingView v-if="useProfileStore().isTheaterMode" />
	<HomeFeed v-else />
</template>
