<script setup lang="ts">
import { computed, ref } from 'vue';
import api from '@/services/api';
import VideoPlayer from '@/components/VideoPlayer.vue'; // Import the VideoPlayer component
import MetadataLoader from '@/components/MetadataLoader.vue';
import MediaCard from '@/components/MediaCard.vue';

</script>

<template>
	<div>
		<h1>🍿 Simply Olives Cine</h1>
	</div>
</template>

<style scoped lang="scss">
ul {
	list-style: none;
	padding: 0;
}

li {
	margin: 5px 0;
}

.poster-tile {
	display: inline-block;
	width: 150px;
	height: 200px;
	margin: 10px;
}
</style>
