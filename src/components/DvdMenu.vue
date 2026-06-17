<script setup lang="ts">
import { useApiStore } from '@/stores/api.store';
import { ref, computed, onMounted, nextTick, type Ref } from 'vue';
import { encodeMediaPath, wait } from '@/utils/miscUtils';
import VideoPlayer from './VideoPlayer.vue';
import Button from 'primevue/button';

const props = defineProps<{
}>();

const TestMenu = {
	"aspectRatio": 1.78,
	"style": {
		"textShadow": "0 0 .4em #0005",
		"fontWeight": "bold"
	},
	"fontSize": 1.8,

	"entrySequence": [
		{
			"backgroundVideo": {
				"path": "/menu/dreamworks_entry.mp4"
			}
		},
		{
			"backgroundVideo": {
				"path": "/menu/fox_entry.mp4"
			}
		},
		{
			"backgroundVideo": {
				"path": "/menu/weird_entry.mp4"
			}
		}
	],

	"pages": [
		{
			"id": "main",
			"backgroundVideo": {
				"path": "/menu/Menu_loop.mp4",
				"loopTo": 53.5
			},
			"displayDelay": 8500,
			"frames": [
				{
					"id": "main",
					"inset": "77% 19% 10% 19%",
					"layout": "flex-row-center justify-content-evenly text-center",
					"elements": [
						{
							"content": "Play",
							"action": {
								"name": "play-media",
								"args": {
									"path": "/How to Train Your Dragon 2 (2014).mp4"
								}
							}
						},
						{
							"content": "Behind the Scenes",
							"action": {
								"name": "replace-active-frame",
								"args": {
									"frameId": "behind-the-scenes"
								}
							}
						},
						{
							"content": "The World of Berk",
							"action": {
								"name": "replace-active-frame",
								"args": {
									"frameId": "world-of-berk"
								}
							}
						},
						{
							"content": "Bonus",
							"action": {
								"name": "replace-active-frame",
								"args": {
									"frameId": "bonus"
								}
							}
						}
					]
				},
				{
					"id": "behind-the-scenes",
					"inset": "77% 19% 10% 19%",
					"layout": "flex-row-center justify-content-evenly text-center",
					"elements": [
						{
							"content": "The Making of How to Train Your Dragon 2",
							"maxWidth": 22,
							"action": {
								"name": "play-media",
								"args": {
									"path": "/The Making of How to Train your Dragon 2-behindthescenes.web.mkv"
								}
							}
						},
						{
							"content": "Gallery",
							"action": {
								"name": "play-media",
								"args": {
									"path": "/Gallery-behindthescenes.web.web.mp4"
								}
							}
						},
						{
							"content": "Deleted Scenes",
							"action": {
								"name": "play-media",
								"args": {
									"path": "/Deleted Scenes-deleted.web.mkv"
								}
							}
						},
						{
							"content": "Main Menu",
							"action": {
								"name": "replace-active-frame",
								"args": {
									"frameId": "main"
								}
							}
						}
					]
				},
				{
					"id": "world-of-berk",
					"inset": "77% 19% 10% 19%",
					"layout": "flex-row-center justify-content-evenly text-center",
					"classes": "scroll-x",
					"elements": [
						{
							"content": "Berk's Dragon World",
							'minWidth': 14,
							"action": {
								"name": "play-media",
								"args": {
									"path": "/Berk's Dragon World-featurette.web.mkv"
								}
							}
						},
						{
							"content": "Hiccup's Inventions in Flight",
							"minWidth": 20,
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "hiccups-inventions"
								}
							}
						},
						{
							"content": "Fishleg's Dragon Stats",
							"minWidth": 14,
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-main"
								}
							}
						},
						{
							"content": "Drago's War Machines",
							"minWidth": 14,
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "dragos-machines"
								}
							}
						},
						{
							"content": "Main Menu",
							"minWidth": 10,
							"action": {
								"name": "replace-active-frame",
								"args": {
									"frameId": "main"
								}
							}
						}
					]
				},
				{
					"id": "bonus",
					"inset": "77% 19% 10% 19%",
					"layout": "flex-row-center justify-content-evenly text-center",
					"elements": [
						{
							"content": "Dawn of the Dragon Racers",
							"action": {
								"name": "play-media",
								"args": {
									"path": "/Dawn of the Dragon Racers-short.web.mkv"
								}
							}
						},
						{
							"content": "Fly High",
							"action": {
								"name": "play-media",
								"args": {
									"path": "/Fly High-musicvideo.web.mp4"
								}
							}
						},
						{
							"content": "Main Menu",
							"action": {
								"name": "replace-active-frame",
								"args": {
									"frameId": "main"
								}
							}
						}
					]
				}
			]
		},
		{
			"id": "hiccups-inventions",
			"backgroundVideo": {
				"path": "/Hiccup's Inventions in Flight-behindthescenes.web.web.mp4",
				"loopAt": 43.5,
				"loopTo": 13.5
			},
			"displayDelay": 12000,
			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "SWORD",
							"inset": "56% 48% 27% 36%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 103,
										"end": 159
									}
								}
							}
						},
						{
							"//": "SADDLE",
							"inset": "41% 62% 43% 25%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 159.5,
										"end": 186.2
									}
								}
							}
						},
						{
							"//": "PEGLEG",
							"inset": "83% 33% 2% 60%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 186.8,
										"end": 213.5
									}
								}
							}
						},
						{
							"//": "FLIGHTSUIT",
							"inset": "22% 37% 62% 51%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 213.7,
										"end": 241.5
									}
								}
							}
						},
						{
							"//": "HELMET",
							"inset": "34% 32% 47% 58%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 242.5,
										"end": 297.5
									}
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "19% 66% 74% 25%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "main"
								}
							}
						}
					]
				}
			]
		},
		{
			"id": "dragos-machines",
			"backgroundVideo": {
				"path": "/Drago's War Machines.web.web.mp4",
				"loopAt": 108,
				"loopTo": 48
			},
			"displayDelay": 48000,

			"exitSequence": [
				{
					"backgroundVideo": {
						"path": "/Drago's War Machines.web.web.mp4",
						"start": 255,
						"end": 261
					}
				}
			],

			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "TRAP",
							"inset": "6% 68% 53% 7%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 137.5,
										"end": 164
									}
								}
							}
						},
						{
							"//": "CANNON",
							"inset": "7% 7% 51% 68%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 164.5,
										"end": 188
									}
								}
							}
						},
						{
							"//": "SNUFFER",
							"inset": "61% 46% 6% 19%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 188,
										"end": 211
									}
								}
							}
						},
						{
							"//": "NABBER",
							"inset": "21% 41% 43% 38%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 211.5,
										"end": 230.5
									}
								}
							}
						},
						{
							"//": "CATCHER",
							"inset": "63% 7% 2% 66%",
							"style": {
								"border": "0.2cqw dashed #9e340b",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 231,
										"end": 255
									}
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "86% 84% 7% 7%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "main"
								}
							}
						}
					]
				}
			]
		},

		// FISHLEG DRAGON STATS
		{
			"id": "fishleg-main",

			"entrySequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_entry.mp4",
					}
				}
			],

			"backgroundVideo": {
				"path": "/menu/drag_main.mp4",
			},

			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "STRIKE",
							"inset": "7% 73% 65% 12%",
							"style": {
								"border": "0.2cqw dashed rgb(32, 103, 115)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-strike",
								}
							}
						},
						{
							"//": "SHARP",
							"inset": "29% 12% 43% 72%",
							"style": {
								"border": "0.2cqw dashed rgb(32, 103, 115)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-sharp",
								}
							}
						},
						{
							"//": "STOKER",
							"inset": "22% 52% 55% 34%",
							"style": {
								"border": "0.2cqw dashed rgb(32, 103, 115)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-stoker",
								}
							}
						},
						{
							"//": "TRACKER",
							"inset": "6% 32% 68% 53%",
							"style": {
								"border": "0.2cqw dashed rgb(32, 103, 115)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-tracker",
								}
							}
						},
						{
							"//": "MYSTERY",
							"inset": "64% 22% 12% 64%",
							"style": {
								"border": "0.2cqw dashed rgb(32, 103, 115)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-mystery",
								}
							}
						},
						{
							"//": "BOULDER",
							"inset": "50% 41% 24% 45%",
							"style": {
								"border": "0.2cqw dashed rgb(32, 103, 115)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-boulder",
								}
							}
						},
						{
							"//": "TIDAL",
							"inset": "50% 63% 24% 22%",
							"style": {
								"border": "0.2cqw dashed rgb(32, 103, 115)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-tidal",
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "86% 84% 7% 7%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "main"
								}
							}
						}
					]
				}
			]
		},
		// STRIKE
		{
			"id": "fishleg-strike",

			"backgroundVideo": {
				"path": "/menu/drag_strike_entry.mp4",
				"loopTo": 3,
			},
			"displayDelay": 2000,

			"exitSequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_strike_mystery.mp4",
						"start": 65,
						"end": 68,
					},
				}
			],

			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "NIGHTFURY",
							"inset": "25% 17% 36% 47%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"path": "/menu/drag_strike_mystery.mp4",
										"start": 0,
										"end": 35,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "86% 84% 7% 7%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-main",
									"skipEntry": true
								}
							}
						}
					]
				}
			]
		},
		// SHARP
		{
			"id": "fishleg-sharp",

			"entrySequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_mystery_sharp.mp4",
						"start": 117.5,
						"end": 120,
					},
				}
			],

			"backgroundVideo": {
					"path": "/menu/drag_sharp_stoker.mp4",
					"start": 38,
					"loopTo": 38,
					"loopAt": 67
			},

			"exitSequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_sharp_stoker.mp4",
						"start": 263,
						"end": 266,
					},
				}
			],

			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "RAINCUTTER",
							"inset": "42% 8% 16% 67%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 0,
										"end": 38,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "SCUTTLECLAWS",
							"inset": "61% 57% 10% 7%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 67,
										"end": 109,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "TIMBERJACK",
							"inset": "4% 67% 49% 2%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 138,
										"end": 172,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "STORMCUTTER",
							"inset": "4% 30% 53% 44%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 201,
										"end": 233,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "88% 7% 4% 85%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-main",
									"skipEntry": true
								}
							}
						}
					]
				}
			]
		},
		// STOKER
		{
			"id": "fishleg-stoker",

			"entrySequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_sharp_stoker.mp4",
						"start": 296,
						"end": 299,
					},
				}
			],

			"backgroundVideo": {
					"path": "/menu/drag_stoker_boulder.mp4",
					"start": 44,
					"loopTo": 44,
					"loopAt": 73
			},

			"exitSequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_stoker_boulder.mp4",
						"start": 217,
						"end": 220,
					},
				}
			],

			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "HOBBLEGRUNT",
							"inset": "4% 66% 49% 4%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 0,
										"end": 44,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "MONSTRUOUS NIGHTMARE",
							"inset": "26% 8% 30% 67%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 73,
										"end": 118,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "TERRIBLE TERROR",
							"inset": "48% 41% 21% 33%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 148,
										"end": 179,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "88% 7% 4% 85%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-main",
									"skipEntry": true
								}
							}
						}
					]
				}
			]
		},
		// TRACKER
		{
			"id": "fishleg-tracker",

			"entrySequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_tidal_tracker.mp4",
						"start": 239,
						"end": 243,
					},
				}
			],

			"backgroundVideo": {
					"path": "/menu/drag_tracker.mp4",
					"start": 45,
					"loopTo": 45,
					"loopAt": 70
			},

			"exitSequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_tracker.mp4",
						"start": 140,
					},
				}
			],

			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "DEADLY NADDER",
							"inset": "49% 23% 7% 49%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 0,
										"end": 44,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "RUMBLEHORN",
							"inset": "15% 32% 54% 41%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 70,
										"end": 110,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "88% 7% 4% 85%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-main",
									"skipEntry": true
								}
							}
						}
					]
				}
			]
		},
		// MYSTERY
		{
			"id": "fishleg-mystery",

			"entrySequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_strike_mystery.mp4",
						"start": 98,
						"end": 100.2,
					},
				}
			],

			"backgroundVideo": {
					"path": "/menu/drag_mystery_sharp.mp4",
					"start": 54,
					"loopTo": 54,
					"loopAt": 84.5
			},

			"exitSequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_mystery_sharp.mp4",
						"start": 84.5,
						"end": 87
					},
				}
			],

			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "ZIPPLEBACK",
							"inset": "20% 15% 29% 53%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 0,
										"end": 54,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "88% 7% 4% 85%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-main",
									"skipEntry": true
								}
							}
						}
					]
				}
			]
		},
		// BOULDER
		{
			"id": "fishleg-boulder",

			"entrySequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_stoker_boulder.mp4",
						"start": 250,
						"end": 252.5,
					},
				}
			],

			"backgroundVideo": {
					"path": "/menu/drag_boulder_tidal.mp4",
					"start": 44,
					"loopTo": 44,
					"loopAt": 74
			},

			"exitSequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_boulder_tidal.mp4",
						"start": 209,
						"end": 211
					},
				}
			],

			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "GRONCKLE",
							"inset": "58% 65% 14% 19%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 0,
										"end": 44,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "SNAFFLEFANG",
							"inset": "7% 44% 48% 31%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 74,
										"end": 111,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "HOTBURDLE",
							"inset": "9% 11% 51% 65%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 142,
										"end": 178,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "88% 7% 4% 85%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-main",
									"skipEntry": true
								}
							}
						}
					]
				}
			]
		},
		// TIDAL
		{
			"id": "fishleg-tidal",

			"entrySequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_boulder_tidal.mp4",
						"start": 241.5,
						"end": 243.5,
					},
				}
			],

			"backgroundVideo": {
					"path": "/menu/drag_tidal_tracker.mp4",
					"start": 38.5,
					"loopTo": 38.5,
					"loopAt": 69
			},

			"exitSequence": [
				{
					"backgroundVideo": {
						"path": "/menu/drag_tidal_tracker.mp4",
						"start": 207,
						"end": 210
					},
				}
			],

			"frames": [
				{
					"id": "main",
					"elements": [
						{
							"//": "BEWILDERBEAST",
							"inset": "11% 25% 51% 54%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 0,
										"end": 38.5,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "SEASHOCKER",
							"inset": "63% 29% 3% 51%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 69,
										"end": 101.5,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "THUNDERDRUM",
							"inset": "7% 64% 47% 11%",
							"style": {
								"border": "0.2cqw dashed rgb(138, 102, 16)",
								"borderRadius": "50%"
							},
							"action": {
								"name": "shift-background-video",
								"args": {
									"video": {
										"start": 132,
										"end": 176,
										"returnToLoop": true
									}
								}
							}
						},
						{
							"//": "RETURN",
							"inset": "88% 7% 4% 85%",
							"content": "Return",
							"action": {
								"name": "enter-page",
								"args": {
									"pageId": "fishleg-main",
									"skipEntry": true
								}
							}
						}
					]
				}
			]
		}
	]
}

const menu = ref();
const pauseMenu = ref(false);
const parentTitlePath = ref('');
// const videoPlayerRef = ref<InstanceType<typeof VideoPlayer>>();
const preloaderRef = ref<HTMLVideoElement>();
const showStartButton = ref(false);


onMounted(() => {
	setTimeout(() => {
		// autoplay may not start. give user option to kickstart
		if (activeVideoPlayer.value?.videoRef?.paused) {
			showStartButton.value = true;
		}
	}, 500);
})

const activePage = ref<any>([]);
const activeFrames = ref<Array<string>>([]);

function buildMediaPath(subPath) {
	return parentTitlePath.value + subPath;
}

const activeBackgroundVideo = ref();
const backgroundVideoPath = computed(() => activeBackgroundVideo.value ? buildMediaPath(activeBackgroundVideo.value.path) : undefined);
const topVideoPath = ref('');
const preloadPath = ref('');
const loopingBackgroundVideo = ref(false);
const hideElements = ref(true);



// const queuedVideos = computed(() => {
// 	// gather all video urls
// 	const paths = new Set<string>();

// 	const page = activePage.value;
// 	if (!page) return paths;

// 	// for (const page of menu.value?.pages || []) {
// 		for (const seq of (page.entrySequence || []).concat(page.exitSequence || [])) {
// 			if (seq.backgroundVideo) {
// 				paths.add(seq.backgroundVideo.path);
// 			}
// 		}

// 		if (page.backgroundVideo) {
// 			paths.add(page.backgroundVideo.path);
// 		}

// 		for (const frame of page.frames || []) {
// 			for (const element of frame.elements || []) {
// 				const path = element.action?.args?.path || element.action?.args?.video?.path;
// 				if (path) {
// 					paths.add(path);
// 				}
// 			}
// 		}
// 	// }

// 	console.log("new queued videos", paths)
// 	return paths;
// });

// Queue of videos: previously loaded and next during transition. ActiveBackgroundVideo determines which ref to look at
const queuedVideos = ref<Set<string>>(new Set());
const videoPlayerRefs = ref(new Map<string, InstanceType<typeof VideoPlayer>>());

const activeVideoPlayer = computed(() => {
	return videoPlayerRefs.value.get(activeBackgroundVideo.value?.path || '');
})

function listenWithCleanup(event: keyof HTMLVideoElementEventMap, handler) {
	let listener;
	const cleanup = () => {
		activeVideoPlayer.value?.videoRef?.removeEventListener(event, listener);
	}
	listener = () => {
		handler(cleanup);
	};
	activeVideoPlayer.value?.videoRef?.addEventListener(event, listener);
}

async function waitForVideoEnd() {
	return new Promise<void>((res, rej) => {
		listenWithCleanup('ended', (cleanup) => { cleanup(); res(); })
	})
}

async function waitForVideoTime(time_sec: number) {
	return new Promise<void>((res, rej) => {
		listenWithCleanup('timeupdate', (cleanup) => {
			if (activeVideoPlayer.value!.videoRef!.currentTime >= time_sec) {
				cleanup();
				res();
			}
		})
	})
}

async function loadMenu(newMenu, path) {
	menu.value = TestMenu || newMenu;
	parentTitlePath.value = path;
	if (menu.value.entrySequence) {
		await playSequence(menu.value.entrySequence);
	}
	await enterPage(menu.value.pages[0].id);
}

function resumeMenu() {
	pauseMenu.value = false;
	activeVideoPlayer.value?.videoRef?.play();
}

async function enterPage(pageId: string, skipEntry = false) {
	const page = menu.value?.pages?.find(p => p.id === pageId);
	if (!page) return;

	const previousActivePage = { ...activePage.value };

	hideElements.value = true;
		
	// trigger background loading for all videos on page during entry
	// preloadPageVideos(page).catch(console.error);

	if (previousActivePage?.exitSequence) {
		await playSequence(previousActivePage.exitSequence);
	}

	activePage.value = page;


	if (page.entrySequence && !skipEntry) {
		await playSequence(page.entrySequence);
	}

	if (page.backgroundVideo) {
		await setBackgroundVideo(page.backgroundVideo);
		await nextTick();
	}

	if (page.displayDelay) {
		await waitForVideoTime(page.displayDelay / 1000);
	}

	hideElements.value = false;

	if (page.frames?.length && !page.frames.some(f => activeFrames.value?.some(frameId => frameId === f.id))) {
		activeFrames.value = [page.frames[0].id];
	}
}

async function playSequence(sequence) {
	for (const step of sequence) {
		if (step.backgroundVideo) {
			await setBackgroundVideo(step.backgroundVideo);
			if (step.backgroundVideo.end) {
				await waitForVideoTime(step.backgroundVideo.end);
			}
			else {
				await waitForVideoEnd();
			}
		}
	}
}

async function preloadPageVideos(page) {
	// gather all video urls
	const paths: string[] = [];

	for (const seq of (page.entrySequence || []).concat(page.exitSequence || [])) {
		if (seq.backgroundVideo) {
			paths.push(seq.backgroundVideo.path);
		}
	}

	if (page.backgroundVideo) {
		paths.push(page.backgroundVideo.path);
	}

	for (const frame of page.frames || []) {
		for (const element of frame.elements || []) {
			const path = element.action?.args?.path || element.action?.args?.video?.path;
			if (path) {
				paths.push(path);
			}
		}
	}

	for (const path of paths) {
		preloadPath.value = buildMediaPath(path);
		await nextTick();
		const videoRef = preloaderRef.value;
		if (!videoRef) {
			console.error('Could not preload video', path);
			continue;
		}
		videoRef.load();
		await new Promise(res => {
			videoRef?.addEventListener('canplay', res);
			videoRef?.addEventListener('error', res);
		})
	}
}

async function setBackgroundVideo(backgroundVideo) {
	queuedVideos.value.add(backgroundVideo.path);

	let previousBackgroundVideoPath = activeBackgroundVideo.value?.path;
	let previousBackgroundVideoEl = activeVideoPlayer.value?.videoRef;

	await nextTick();

	const videoEl = videoPlayerRefs.value.get(backgroundVideo.path)?.videoRef;

	if (!videoEl) {
		console.error("Video player is not mounted!")
		return;
	}

	videoEl.currentTime = backgroundVideo.start || 0;
	loopingBackgroundVideo.value = true;
	videoEl.addEventListener('timeupdate', loopHandler);
	videoEl.play();
	
	activeBackgroundVideo.value = backgroundVideo;

	if (previousBackgroundVideoPath !== activeBackgroundVideo.value?.path) {
		previousBackgroundVideoEl?.pause();
		await new Promise<void>((resolve, reject) => {
			videoEl.addEventListener('canplay', () => {
				resolve();
			});
			videoEl.addEventListener('error', () => {
				reject();
			});
		}).catch((error) => {
			console.error('Error occurred while waiting for video to load:', error);
		});
		// queuedVideos.value.delete(previousBackgroundVideoPath);
	}

	topVideoPath.value = activeBackgroundVideo.value.path;
}

function loopHandler() {
	const videoEl = activeVideoPlayer.value?.videoRef;

	if (videoEl && (activeBackgroundVideo.value.loopAt || activeBackgroundVideo.value.loopTo)) {
		const loopAt = activeBackgroundVideo.value.loopAt || videoEl.duration;

		const time = videoEl.currentTime;
		if (time >= (loopAt - 0.3) && loopingBackgroundVideo.value === true) {
			videoEl.currentTime = activeBackgroundVideo.value.loopTo || 0;
		}
	}
}

async function shiftBackgroundVideo(shiftVideoConfig) {
	if (!activeVideoPlayer.value?.videoRef) return;

	// save and hide page elements
	hideElements.value = true;

	// save current video
	const previousVideo = {...activeBackgroundVideo.value};
	
	const isNewPath = shiftVideoConfig.path && shiftVideoConfig.path !== previousVideo.path;
	if (isNewPath) {
		activeBackgroundVideo.value!.path = shiftVideoConfig.path;
		await nextTick();
	}

	loopingBackgroundVideo.value = false;
	activeVideoPlayer.value!.videoRef!.currentTime = shiftVideoConfig.start || 0;
	activeVideoPlayer.value!.videoRef!.play();
	console.log(activeVideoPlayer.value?.videoRef)
	console.log("waiting for video end", shiftVideoConfig.end)
	await waitForVideoTime(shiftVideoConfig.end);
	console.log("done")
	loopingBackgroundVideo.value = true;

	const returnVideo = {
		...previousVideo,
		start: shiftVideoConfig.returnToLoop ? previousVideo.loopTo : previousVideo.start,
	};

	console.log("returning to video", returnVideo)

	await setBackgroundVideo(returnVideo);
	hideElements.value = false;
}

const emit = defineEmits<{ play: [ string ], close: [] }>();

function doAction(action) {
	if (!action) return;

	if (action.name === 'play-media') {
		pauseMenu.value = true;
		activeVideoPlayer.value?.videoRef?.pause();
		emit('play', buildMediaPath(action.args.path));
	}
	else if (action.name === 'add-active-frame') {
		const frameId = action.args.frameId;
		if (frameId && !activeFrames.value.includes(frameId)) {
			activeFrames.value.push(frameId);
			}
	}
	else if (action.name === 'remove-active-frame') {
		const frameId = action.args.frameId;
		activeFrames.value = activeFrames.value.filter(id => id !== frameId);
	}
	else if (action.name === 'replace-active-frame') {
		const frameId = action.args.frameId;
		activeFrames.value = frameId ? [frameId] : [];
	}
	else if (action.name === 'enter-page') {
		const pageId = action.args.pageId;
		enterPage(pageId, action.args.skipEntry);
	}
	else if (action.name === 'shift-background-video') {
		shiftBackgroundVideo(action.args.video);
	}
}

defineExpose({
	loadMenu,
	resumeMenu,
})

</script>

<template>
	<div class="wrapper tvNavigationFocusArea" ref="wrapperRef" v-if="menu">
		<Button variant="text" severity="contrast" icon="pi pi-arrow-left" @click="$emit('close')" class="fixed top-0 left-0 text-xl" style="z-index: 2" />

		<!-- <video ref="preloaderRef" class="video-player" :controls="false" :src="useApiStore().getStreamUrl(preloadPath)" preload="true" crossorigin="use-credentials" allow></video> -->
		<div v-for="path in queuedVideos" class="absolute-full queued-video" :class="{ 'top': path === topVideoPath ? 1 : 0 }" ><VideoPlayer :key="path" :ref="(ref) => videoPlayerRefs.set(path, ref as InstanceType<typeof VideoPlayer>)" :hideControls="true" :hideLoading="true" :inactive="true" :relativePath="buildMediaPath(path)" /></div>
		<!-- <VideoPlayer :key="backgroundVideoPath" ref="videoPlayerRef" :hideControls="true" :hideLoading="true" :noEvents="true" :relativePath="backgroundVideoPath" /> -->

		<div class="menu-wrapper"
			:style="{
				aspectRatio: menu.aspectRatio,
				maxWidth: `calc(100vh * ${menu.aspectRatio})`,
				...(menu.style || {}),
			}"
		>
			<div
				v-if="activePage && !hideElements"
				class="page-wrapper"
				:style="{
					fontSize: `${activePage.fontSize || menu.fontSize || 1.5}cqw`,
				}"
			>
				<template v-for="frame of activePage.frames">
					<div v-if="activeFrames.includes(frame.id)"
						class="frame-wrapper"
						:class="`${frame.layout || ''} ${frame.classes || ''}`"
						:style="{
							inset: frame.inset || '0%',
							fontFamily: frame.font?.family || 'inherit',
							fontWeight: frame.font?.weight || 'inherit',
							...(frame.style || {}),
						}"
					>
						<div v-for="element of frame.elements"
							class="frame-element"
							:tabindex="element.action ? 0 : undefined"
							@click="() => doAction(element.action)"
							:class="element.classes"
							:style="{
								position: element.inset ? 'absolute' : undefined,
								inset: element.inset,
								minWidth: element.minWidth ? `${element.minWidth}cqw` : undefined,
								maxWidth: element.maxWidth ? `${element.maxWidth}cqw` : undefined,
								...element.style,
							}"
						>
							{{ element.content }}
						</div>
					</div>
				</template>
			</div>
		</div>

		<div
			v-if="showStartButton"
			class="absolute-full flex-center-all bg-contain cursor-pointer"
				:style="{ zIndex: 5, backgroundImage: `url('${useApiStore().apiUrl + '/thumb/' + encodeMediaPath(backgroundVideoPath || '') + '?seek=3&width=1200'}')`}"
				@click="() => { showStartButton = false; activeVideoPlayer?.videoRef?.play() }"
			>
				<Button class="square text-7xl" text btn-blur-hover btn-drop-shadow severity="contrast" data-focus-priority="1">
					<i class="material-symbols-outlined">play_arrow</i>
				</Button>
			</div>
		</div>
	</template>

<style scoped lang="scss">
.wrapper {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
	user-select: none;
	background: black;

	.menu-wrapper {
		position: fixed;
		z-index: 5;
		top: 50%;
		left: 50%;
		width: 100%;
		translate: -50% -50%;
		// border: 1px solid white;
		container-type: inline-size;
	}

	.frame-wrapper {
		position: absolute;
		// border: 1px solid white;

		&.scroll-x {
			overflow-x: auto;
			overflow-y: hidden;
			padding: 0 2px;
		}

		.frame-element {
			padding: .5em;

			&:hover, &:focus-within, &[tv-focus] {
				outline: 1px solid #fff;
			}
		}
	}

	.queued-video {
		opacity: 0;

		&.top {
			opacity: 1;
			z-index: 1;
		}
	}

}
</style>
