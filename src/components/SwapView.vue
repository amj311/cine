<script
  setup
  lang="ts"
>
defineProps<{
  views: string[],
  currentView: string
}>()

</script>

<template>
  <template
    v-for="view of views"
    :key="view"
  >
    <slot
      :name="view"
      v-if="currentView === view"
    ></slot>
  </template>
</template>

<style scoped></style>
