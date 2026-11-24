import type { HouseName } from "@/data/types";

/** Featured character IDs (PotterDB slugs) per house, in display order. */
export const ROSTER: Readonly<Record<HouseName, readonly string[]>> = {
  GRYFFINDOR: [
    "harry-potter", // Harry Potter
    "hermione-granger", // Hermione Granger
    "ronald-weasley", // Ron Weasley
    "albus-dumbledore", // Albus Dumbledore
    "minerva-mcgonagall", // Minerva McGonagall
    "neville-longbottom", // Neville Longbottom
  ],
  SLYTHERIN: [
    "draco-malfoy", // Draco Malfoy
    "severus-snape", // Severus Snape
    "tom-riddle", // Lord Voldemort
    "bellatrix-lestrange", // Bellatrix Lestrange
    "horace-slughorn", // Horace Slughorn
    "lucius-malfoy", // Lucius Malfoy
  ],
  RAVENCLAW: [
    "luna-lovegood", // Luna Lovegood
    "cho-chang", // Cho Chang
    "filius-flitwick", // Filius Flitwick
    "padma-patil", // Padma Patil
    "myrtle-warren", // Moaning Myrtle
    "xenophilius-lovegood", // Xenophilius Lovegood
  ],
  HUFFLEPUFF: [
    "cedric-diggory", // Cedric Diggory
    "nymphadora-tonks", // Nymphadora Tonks
    "pomona-sprout", // Pomona Sprout
    "newton-scamander", // Newt Scamander
    "hannah-abbott", // Hannah Abbott
    "ernest-macmillan", // Ernie Macmillan
  ],
};
