import type { Wand } from "@/data/types";

/** Featured characters: PotterDB slug -> display name. Normal quiz questions draw their answers from these. */
export const FEATURED: Readonly<Record<string, string>> = {
  "harry-potter": "Harry Potter",
  "hermione-granger": "Hermione Granger",
  "ronald-weasley": "Ron Weasley",
  "albus-dumbledore": "Albus Dumbledore",
  "minerva-mcgonagall": "Minerva McGonagall",
  "neville-longbottom": "Neville Longbottom",
  "draco-malfoy": "Draco Malfoy",
  "severus-snape": "Severus Snape",
  "tom-riddle": "Lord Voldemort",
  "bellatrix-lestrange": "Bellatrix Lestrange",
  "horace-slughorn": "Horace Slughorn",
  "lucius-malfoy": "Lucius Malfoy",
  "luna-lovegood": "Luna Lovegood",
  "cho-chang": "Cho Chang",
  "filius-flitwick": "Filius Flitwick",
  "padma-patil": "Padma Patil",
  "myrtle-warren": "Moaning Myrtle",
  "xenophilius-lovegood": "Xenophilius Lovegood",
  "cedric-diggory": "Cedric Diggory",
  "nymphadora-tonks": "Nymphadora Tonks",
  "pomona-sprout": "Pomona Sprout",
  "newton-scamander": "Newt Scamander",
  "hannah-abbott": "Hannah Abbott",
  "ernest-macmillan": "Ernie Macmillan",
  "ginevra-weasley": "Ginny Weasley",
  "fred-weasley": "Fred Weasley",
  "george-weasley": "George Weasley",
  "molly-weasley": "Molly Weasley",
  "arthur-weasley": "Arthur Weasley",
  "percy-weasley": "Percy Weasley",
  "sirius-black": "Sirius Black",
  "remus-lupin": "Remus Lupin",
  "peter-pettigrew": "Peter Pettigrew",
  "james-potter-i": "James Potter",
  "lily-potter-i": "Lily Potter",
  "rubeus-hagrid": "Rubeus Hagrid",
  "dolores-umbridge": "Dolores Umbridge",
  "gilderoy-lockhart": "Gilderoy Lockhart",
  "quirinus-quirrell": "Quirinus Quirrell",
  "alastor-moody": "Alastor Moody",
  "sybill-trelawney": "Sybill Trelawney",
  "kingsley-shacklebolt": "Kingsley Shacklebolt",
  "dobby": "Dobby",
  "kreacher": "Kreacher",
  "fleur-delacour": "Fleur Delacour",
  "viktor-krum": "Viktor Krum",
  "seamus-finnigan": "Seamus Finnigan",
  "dean-thomas": "Dean Thomas",
  "lavender-brown": "Lavender Brown",
  "parvati-patil": "Parvati Patil",
  "vincent-crabbe": "Vincent Crabbe",
  "gregory-goyle": "Gregory Goyle",
  "narcissa-malfoy": "Narcissa Malfoy",
  "argus-filch": "Argus Filch",
  "cornelius-fudge": "Cornelius Fudge",
  "gellert-grindelwald": "Gellert Grindelwald",
  "rita-skeeter": "Rita Skeeter",
  "poppy-pomfrey": "Poppy Pomfrey",
  "rolanda-hooch": "Rolanda Hooch",
  "aberforth-dumbledore": "Aberforth Dumbledore",
  "fenrir-greyback": "Fenrir Greyback",
};

/**
 * Slug -> the wand to show instead of the first permanent wand PotterDB lists. Ron's first entry is
 * Charlie's hand-me-down; the wand he is known for is the one he bought in his third year.
 */
export const WAND_OVERRIDES: Readonly<Record<string, Wand>> = {
  "ronald-weasley": { wood: "willow", core: "unicorn hair", lengthInches: 14 },
};

/** Slug -> the HP-API character name to match, where it differs from the featured display name. */
export const ACTOR_OVERRIDES: Readonly<Record<string, string>> = {
  "quirinus-quirrell": "Quirinus Quirrel",
  "viktor-krum": "Victor Krum",
  "poppy-pomfrey": "Madam Pomfrey",
  "rolanda-hooch": "Madam Hooch",
};
