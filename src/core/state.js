"use strict";
const APP_NAME = "Food Run",
  DB_NAME = "Eat Cheap",
  DB_VERSION = 3,
  SEED_FLAG = "food-run-starter-seeded",
  CORE_STORES = ["inventory", "prices", "recipes", "schedule"],
  STORES = [...CORE_STORES, "savedLists"];
let db,
  state = {
    inventory: [],
    prices: [],
    recipes: [],
    schedule: [],
    savedLists: [],
  },
  currentPlan = null,
  draftRequested = false,
  openSavedListId;
